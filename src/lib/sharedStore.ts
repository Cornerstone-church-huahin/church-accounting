import { useCallback, useEffect, useRef, useState } from 'react'
import { blocked, MEMBERS_KEY, myRole, STORE_EVENT, whoAmI, type Perm } from './access'
import { getSync, mergeItems, pullFile, pushFile, SYNC_EVENT, type SharedItem, type SyncStatus } from './sync'

/**
 * ที่เก็บข้อมูลที่ใช้ร่วมกัน: บันทึกในเครื่องทันที แล้วซิงก์ขึ้น GitHub (repo ส่วนตัว) อัตโนมัติ
 * ทุกเครื่องที่ใส่รหัสเข้าใช้ร่วมจะเห็นข้อมูลชุดเดียวกัน (ใหม่กว่าชนะ รายการที่ลบถูกจำไว้)
 * หน้าที่ใช้ข้อมูลรายปีต้องใส่ key={ปี} ที่คอมโพเนนต์ เพื่อให้เปลี่ยนไฟล์ได้ถูกต้อง
 */
export function useSharedStore<T extends SharedItem>(opts: {
  localKey: string
  file: string
  label: string
  seed?: () => T[]
  /** members = รายชื่อผู้ใช้ร่วม (ซิงก์ได้แม้ยังรออนุมัติ) · shared = ข้อมูลบัญชี */
  scope?: 'shared' | 'members'
  /** สิทธิ์ที่ต้องมีเพื่อเขียน (ค่าเริ่มต้น: ไม่ตรวจ) */
  write?: Perm
}) {
  const { localKey, file, label } = opts
  const scope = opts.scope ?? 'shared'
  const read = (): T[] | null => {
    try {
      const v = JSON.parse(localStorage.getItem(localKey) ?? 'null')
      return Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }
  const [all, setAll] = useState<T[]>(() => read() ?? opts.seed?.() ?? [])
  const [sync, setSync] = useState<SyncStatus>(getSync() ? { state: 'idle' } : { state: 'off' })
  const syncNowRef = useRef<() => void>(() => undefined)
  const latest = useRef(all)
  latest.current = all
  const timer = useRef<number | undefined>(undefined)
  const [me] = useState(() => Symbol('store'))

  const setLocal = useCallback(
    (next: T[]) => {
      latest.current = next
      setAll(next)
      try { localStorage.setItem(localKey, JSON.stringify(next)) } catch { /* ignore */ }
      // ส่วนอื่นของแอปที่ใช้ข้อมูลชุดเดียวกันอัปเดตตามทันที
      window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: { key: localKey, from: me } }))
    },
    [localKey, me],
  )
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; from: symbol }>).detail
      if (scope !== 'members' && d.key === MEMBERS_KEY) { syncNowRef.current(); return } // รายชื่อ/สิทธิ์เปลี่ยน: ซิงก์ทันที
      if (d.key !== localKey || d.from === me) return
      const v = read()
      if (v) { latest.current = v; setAll(v) }
    }
    window.addEventListener(STORE_EVENT, on)
    return () => window.removeEventListener(STORE_EVENT, on)
  }, [localKey, me]) // eslint-disable-line react-hooks/exhaustive-deps

  const syncNow = useCallback(async () => {
    const cfg = getSync()
    if (!cfg) return setSync({ state: 'off' })
    // ยังไม่รู้สิทธิ์ (รายชื่อผู้ใช้ร่วมยังไม่เคยซิงก์) หรือรออนุมัติ: ยังไม่ดึง/ส่งข้อมูลบัญชี
    if (scope !== 'members' && (localStorage.getItem(MEMBERS_KEY) === null || myRole() === 'pending')) return setSync({ state: 'idle' })
    setSync({ state: 'syncing' })
    try {
      const remote = await pullFile<T>(cfg, file)
      const merged = mergeItems(latest.current, remote.items)
      setLocal(merged)
      const localNewer = merged.some((x) => {
        const r = remote.items.find((y) => y.id === x.id)
        return !r || x.updated > r.updated
      })
      if (localNewer) await pushFile(cfg, file, label, merged, remote.sha)
      setSync({ state: 'ok', at: Date.now() })
    } catch (e) {
      setSync({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [file, label, setLocal, scope])

  syncNowRef.current = syncNow
  useEffect(() => {
    syncNow()
    const onVis = () => document.visibilityState === 'visible' && syncNow()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener(SYNC_EVENT, syncNow)
    const t = window.setInterval(syncNow, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener(SYNC_EVENT, syncNow)
      window.clearInterval(t)
    }
  }, [syncNow])

  /** บันทึกรายการ (เพิ่ม/แก้ไข) แล้วส่งขึ้นออนไลน์ทันที · คืน false ถ้าสิทธิ์ไม่พอ */
  const put = useCallback(
    (items: T[]): boolean => {
      if (opts.write && blocked(opts.write)) return false
      const by = getSync() ? whoAmI().name : undefined
      const now = Date.now()
      const stamped = items.map((x, i) => ({ ...x, updated: now + i, by: by ?? x.by }))
      const ids = new Set(stamped.map((x) => x.id))
      setLocal([...latest.current.filter((x) => !ids.has(x.id)), ...stamped])
      if (getSync()) {
        setSync({ state: 'syncing' })
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(syncNow, 600)
      }
      return true
    },
    [setLocal, syncNow, opts.write],
  )

  return {
    items: all.filter((x) => !x.deleted),
    all,
    sync,
    syncNow,
    put,
    remove: (id: string) => {
      const x = latest.current.find((y) => y.id === id)
      return x ? put([{ ...x, deleted: true }]) : false
    },
  }
}
