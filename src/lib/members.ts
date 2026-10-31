import { useEffect, useState } from 'react'
import { getMe, normalizeRoles, primaryRole, rolesOf, INVITE_FOR_KEY, INVITE_ROLE_KEY, INVITE_WORK_KEY, MEMBERS_KEY, myRole, ROLE_EVENT, STORE_EVENT, type AccessRole, type FundAssign, type Member, type Role, type WorkLevel } from './access'
import { isInstalled } from './install'
import { useSharedStore } from './sharedStore'
import { getSync, saveSync, SYNC_EVENT } from './sync'

/** สิทธิ์ของเครื่องนี้ (อัปเดตอัตโนมัติเมื่อรายชื่อผู้ใช้ร่วมเปลี่ยน) */
export function useRole(): AccessRole {
  const [role, setRole] = useState<AccessRole>(myRole)
  useEffect(() => {
    const on = () => setRole(myRole())
    window.addEventListener(STORE_EVENT, on)
    window.addEventListener(SYNC_EVENT, on)
    window.addEventListener(ROLE_EVENT, on)
    on()
    return () => {
      window.removeEventListener(STORE_EVENT, on)
      window.removeEventListener(SYNC_EVENT, on)
      window.removeEventListener(ROLE_EVENT, on)
    }
  }, [])
  return role
}

const invitedRole = (): Role => {
  const r = localStorage.getItem(INVITE_ROLE_KEY)
  return r === 'bookkeeper' || r === 'auditor' || r === 'worship' ? r : 'viewer' // ลิงก์เชิญให้ได้ไม่เกินผู้บันทึก/ผู้ตรวจสอบ · แอดมินตั้งตอนอนุมัติเท่านั้น
}

/** ตัดสิทธิ์บัญชี “ผู้บันทึกการนมัสการ” ออก (ย้ายไปเป็นผู้ช่วยงานของงานทะเบียนแทน) */
export const withoutWorshipRole = (rs: Role[]): Role[] => normalizeRoles(rs.filter((r) => r !== 'worship'))
/** ผู้ใช้ที่ยังมีสิทธิ์เดิม “ผู้บันทึกการนมัสการ”: แปลงเป็นผู้ช่วยงานของงานทะเบียน (คนที่มีสิทธิ์บัญชีสูงกว่าอยู่แล้ว แค่ตัดสิทธิ์เดิมออก) */
export const migrateWorshipRole = (m: Member): Member | null => {
  const rs = rolesOf(m)
  if (!rs.includes('worship')) return null
  const rest = withoutWorshipRole(rs)
  const solo = rest.length === 1 && rest[0] === 'viewer'
  const roles = rest.length > 1 ? rest : undefined
  const base = { ...m, role: primaryRole(rest), roles }
  if (!solo || m.workRoles?.['2']) return base
  return { ...base, works: [...new Set([...(m.works ?? []), 2])].sort((a, b) => a - b), workRoles: { ...(m.workRoles ?? {}), '2': 'helper' as WorkLevel } }
}
/** รายชื่อผู้ใช้ร่วม (members.json) + การจัดการโดยแอดมิน */
export function useMembers() {
  const store = useSharedStore<Member>({ localKey: MEMBERS_KEY, file: 'members.json', label: 'ผู้ใช้ร่วม', scope: 'members' })
  const me = getMe()
  const isAdmin = myRole() === 'admin'
  const everyone = store.items
  const pending = everyone.filter((m) => m.status === 'pending')
  const active = everyone.filter((m) => m.status !== 'pending')
  const adminCount = active.filter((m) => m.role === 'admin').length
  const announce = () => window.dispatchEvent(new Event(ROLE_EVENT))
  return {
    members: [...active].sort((a, b) => (a.joined ?? 0) - (b.joined ?? 0)),
    pending: [...pending].sort((a, b) => (a.joined ?? 0) - (b.joined ?? 0)),
    /** รายชื่อสำหรับเลือกผู้นับเงิน/ผู้ตรวจ */
    all: store.all,
    sync: store.sync,
    syncNow: store.syncNow,
    meId: me?.id ?? '',
    isAdmin,
    adminCount,
    /** work: undefined = ตามที่ลิงก์ระบุ (invitedWork) · null = ไม่ให้เข้าห้องงาน · {n, level} = แอดมินกำหนดห้องงาน+ตำแหน่งตอนอนุมัติ */
    approve: (id: string, roles: Role | Role[], work?: { n: number; level: WorkLevel } | null) => {
      if (!isAdmin) return false
      const m = pending.find((x) => x.id === id)
      if (!m) return false
      const asked = normalizeRoles(Array.isArray(roles) ? roles : [roles])
      const rs = withoutWorshipRole(asked)
      const iw = work === undefined ? m.invitedWork : work ?? undefined
      let works = iw ? [...new Set([...(m.works ?? []), iw.n])].sort((a, b) => a - b) : m.works
      let workRoles = iw ? { ...(m.workRoles ?? {}), [String(iw.n)]: iw.level } : m.workRoles
      // ลิงก์/สิทธิ์เดิม “ผู้บันทึกการนมัสการ” = ผู้ช่วยงานของงานทะเบียน
      if (asked.includes('worship') && !workRoles?.['2']) { works = [...new Set([...(works ?? []), 2])].sort((a, b) => a - b); workRoles = { ...(workRoles ?? {}), '2': 'helper' } }
      store.put([{ ...m, status: 'active', role: primaryRole(rs), roles: rs.length > 1 ? rs : undefined, ...(iw ? { works, workRoles, invitedWork: undefined } : { invitedWork: undefined }) }])
      announce()
      return true
    },
    /** แอดมินเปิดแอป: แปลงสิทธิ์เดิม “ผู้บันทึกการนมัสการ” ของทุกคนเป็นผู้ช่วยงานของงานทะเบียน · คืนชื่อคนที่ถูกแปลง */
    migrateWorship: (): string[] => {
      if (!isAdmin) return []
      const changed = everyone.map((m) => (m.deleted ? null : migrateWorshipRole(m))).filter((x): x is Member => !!x).map((x) => ({ ...x, updated: Date.now() }))
      if (changed.length === 0 || !store.put(changed)) return []
      announce()
      return changed.map((x) => x.name)
    },
    reject: (id: string) => {
      if (!isAdmin) return false
      const m = pending.find((x) => x.id === id)
      if (!m) return false
      store.put([{ ...m, deleted: true }])
      announce()
      return true
    },
    /** แอดมินคนแรกลงทะเบียนเอง (active) หรือผู้ใช้ขอร่วม (pending รออนุมัติ) */
    register: (role: Role, status: 'active' | 'pending' = 'active', invitedFor = '') => {
      const cfg = getSync()
      if (!me || !cfg) return
      let invitedWork: { n: number; level: WorkLevel } | undefined
      try { const w = JSON.parse(localStorage.getItem(INVITE_WORK_KEY) ?? 'null'); if (w && Number.isInteger(w.n) && ['owner', 'deputy', 'lead', 'helper', 'advisor'].includes(w.level)) invitedWork = { n: w.n, level: w.level } } catch { /* ignore */ }
      const ua = navigator.userAgent
      const device = `${/iphone|ipad|ipod/i.test(ua) ? 'iPhone/iPad' : /android/i.test(ua) ? 'Android' : 'คอมพิวเตอร์'} · ${isInstalled() ? 'แอปที่ติดตั้ง' : 'เบราว์เซอร์'}`
      store.put([{ id: me.id, name: cfg.name.trim(), role, joined: Date.now(), status, device, ...(invitedFor ? { invitedFor } : {}), ...(invitedWork ? { invitedWork } : {}), updated: 0 }])
      announce()
    },
    rename: (name: string) => {
      const mine = store.all.find((m) => m.id === me?.id)
      if (mine && mine.name !== name) store.put([{ ...mine, name }])
    },
    /** แอดมินเปลี่ยนสิทธิ์: ห้ามลดแอดมินคนสุดท้าย */
    setRole: (id: string, roles: Role | Role[]) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      const rs = normalizeRoles(Array.isArray(roles) ? roles : [roles])
      if (rolesOf(m).includes('admin') && !rs.includes('admin') && adminCount <= 1) return false
      store.put([{ ...m, role: primaryRole(rs), roles: rs.length > 1 ? rs : undefined }])
      announce()
      return true
    },
    /** แอดมินพักสิทธิ์ (ปิดชั่วคราว) / เปิดคืน โดยไม่ลบคน · พักแอดมินคนสุดท้ายไม่ได้ */
    /** แอดมินกำหนดกองทุน (และหมวด) ที่ผู้ดูแลกองทุนคนนั้นดูแล */
    setFunds: (id: string, funds: FundAssign[]) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      store.put([{ ...m, funds: funds.length ? funds : undefined }])
      announce()
      return true
    },
    /** แอดมินกำหนดงานที่คนนั้นอยู่ในห้องทำงาน (ว่าง = ไม่จำกัด) · งานที่เพิ่มใหม่เริ่มที่ "ผู้ช่วย" (ปลอดภัย) · งานที่ถอดออกลบตำแหน่งด้วย */
    setWorks: (id: string, works: number[]) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      const next = works.length ? [...new Set(works)].sort((a, b) => a - b) : undefined
      const roles: Record<string, WorkLevel> = {}
      for (const n of next ?? []) roles[String(n)] = m.workRoles?.[String(n)] ?? (m.works?.includes(n) ? 'lead' : 'helper')
      store.put([{ ...m, works: next, workRoles: next ? roles : undefined }])
      announce()
      return true
    },
    /** แอดมินตั้งตำแหน่งของคนนั้นในทุกงานพร้อมกัน (ตัวเลือกเหมือนกันทุกงาน) · null = ไม่อยู่ในงานนั้น */
    setPositions: (id: string, positions: Record<number, WorkLevel | null>) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      const roles: Record<string, WorkLevel> = {}
      for (const [k, v] of Object.entries(positions)) if (v) roles[k] = v
      const works = Object.keys(roles).map(Number).sort((a, b) => a - b)
      store.put([{ ...m, works: works.length ? works : undefined, workRoles: works.length ? roles : undefined }])
      announce()
      return true
    },
    /** แอดมินเปลี่ยนตำแหน่งของคนนั้นในห้องงาน n (ผู้ดูแลหลัก/ผู้ช่วย/ที่ปรึกษา) — เปลี่ยนได้ทุกเมื่อ */
    setWorkLevel: (id: string, n: number, level: WorkLevel) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m || !m.works?.includes(n)) return false
      store.put([{ ...m, workRoles: { ...(m.workRoles ?? {}), [String(n)]: level } }])
      announce()
      return true
    },
    setPaused: (id: string, paused: boolean) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      if (paused && m.role === 'admin') return false
      store.put([{ ...m, paused: paused ? true : undefined }])
      announce()
      return true
    },
    /** แอดมินลบคน: ห้ามลบแอดมินคนสุดท้าย (เครื่องของคนนั้นจะหยุดใช้ร่วมเมื่อซิงก์ครั้งถัดไป) */
    removeMember: (id: string) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      if (m.role === 'admin' && adminCount <= 1) return false
      store.put([{ ...m, deleted: true }])
      announce()
      return true
    },
  }
}

/** ใช้ครั้งเดียวที่ AppShell: ลงทะเบียนเครื่องนี้เข้ารายชื่อ · ตรวจว่าถูกลบหรือไม่ · ถามแอดมินคนแรก */
export function useMembership() {
  const m = useMembers()
  const [needAdmin, setNeedAdmin] = useState(false)
  const [noAdminYet, setNoAdminYet] = useState(false)
  const [removed, setRemoved] = useState(() => localStorage.getItem('acct.removed') === '1')
  const cfg = getSync()
  const mine = m.all.find((x) => x.id === m.meId)
  useEffect(() => {
    if (!cfg || m.sync.state !== 'ok' || !m.meId) return
    if (mine?.deleted && localStorage.getItem('acct.rejoin') === '1') {
      // เปิดลิงก์เชิญใหม่โดยตั้งใจ: กลับเข้ามาขออนุมัติอีกครั้ง
      try { localStorage.removeItem('acct.rejoin') } catch { /* ignore */ }
      m.register(invitedRole(), 'pending', localStorage.getItem(INVITE_FOR_KEY) ?? '')
      return
    }
    if (mine?.deleted) {
      saveSync(null) // ถูกแอดมินลบ: หยุดใช้ร่วมบนเครื่องนี้
      try { localStorage.setItem('acct.removed', '1') } catch { /* ignore */ }
      setRemoved(true)
      return
    }
    if (mine) {
      try { localStorage.removeItem('acct.rejoin') } catch { /* ignore */ }
      setNeedAdmin(false)
      setNoAdminYet(false)
      m.rename(cfg.name.trim())
      return
    }
    if (m.members.length === 0) {
      // ยังไม่มีใครเป็นแอดมิน: ถ้ามาจากลิงก์เชิญ ห้ามอ้างตัวเป็นแอดมิน ให้รอเจ้าของตั้งค่าก่อน
      if (localStorage.getItem(INVITE_ROLE_KEY)) setNoAdminYet(true)
      else setNeedAdmin(true)
      return
    }
    setNeedAdmin(false)
    m.register(invitedRole(), 'pending', localStorage.getItem(INVITE_FOR_KEY) ?? '')
  }, [m.sync.state, m.all.length, m.meId, mine?.deleted, mine?.name, cfg?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    needAdmin,
    noAdminYet,
    removed,
    becomeAdmin: () => { m.register('admin'); setNeedAdmin(false) },
    pendingCount: m.pending.length,
    cancelRequest: () => { saveSync(null) },
    syncNow: m.syncNow,
    myName: cfg?.name ?? '',
    dismissRemoved: () => { try { localStorage.removeItem('acct.removed') } catch { /* ignore */ } setRemoved(false) },
  }
}
