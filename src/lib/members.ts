import { useEffect, useState } from 'react'
import { getMe, INVITE_FOR_KEY, INVITE_ROLE_KEY, MEMBERS_KEY, myRole, ROLE_EVENT, STORE_EVENT, type AccessRole, type Member, type Role } from './access'
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
  return r === 'bookkeeper' || r === 'auditor' ? r : 'viewer' // ลิงก์เชิญให้ได้ไม่เกินผู้บันทึก/ผู้ตรวจสอบ · แอดมินตั้งตอนอนุมัติเท่านั้น
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
    approve: (id: string, role: Role) => {
      if (!isAdmin) return false
      const m = pending.find((x) => x.id === id)
      if (!m) return false
      store.put([{ ...m, status: 'active', role }])
      announce()
      return true
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
      store.put([{ id: me.id, name: cfg.name.trim(), role, joined: Date.now(), status, ...(invitedFor ? { invitedFor } : {}), updated: 0 }])
      announce()
    },
    rename: (name: string) => {
      const mine = store.all.find((m) => m.id === me?.id)
      if (mine && mine.name !== name) store.put([{ ...mine, name }])
    },
    /** แอดมินเปลี่ยนสิทธิ์: ห้ามลดแอดมินคนสุดท้าย */
    setRole: (id: string, role: Role) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      if (m.role === 'admin' && role !== 'admin' && adminCount <= 1) return false
      store.put([{ ...m, role }])
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
