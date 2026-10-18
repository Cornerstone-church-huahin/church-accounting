import { useEffect, useState } from 'react'
import { getSync, SYNC_EVENT, type SyncStatus } from './sync'

/** สถานะการซิงก์รวมทุกไฟล์ ไว้แสดงที่ปุ่มรีเฟรชหัวแอป (ซิงก์ล่าสุดเมื่อไร / ไฟล์ไหนผิดพลาดเพราะอะไร) */
export interface GlobalSync { syncing: number; lastOk?: number; errors: string[] }
const EVENT = 'acct-sync-global'
let syncing = 0
let lastOk: number | undefined
const errors = new Map<string, string>()
let snap: GlobalSync = { syncing: 0, errors: [] }
const emit = () => { snap = { syncing, lastOk, errors: [...new Set(errors.values())] }; if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT)) }

/** sharedStore เรียกทุกครั้งที่สถานะของไฟล์หนึ่งเปลี่ยน */
export function noteSync(key: string, s: SyncStatus) {
  if (s.state === 'syncing') syncing++
  else if (s.state === 'ok') { syncing = Math.max(0, syncing - 1); lastOk = s.at ?? Date.now(); errors.delete(key) }
  else if (s.state === 'error') { syncing = Math.max(0, syncing - 1); errors.set(key, s.message) }
  else return
  emit()
}
export const resetSyncStatus = () => { syncing = 0; errors.clear(); lastOk = undefined; emit() }

export function useGlobalSync(): GlobalSync & { connected: boolean } {
  const [g, setG] = useState(snap)
  const [connected, setConnected] = useState(() => !!getSync())
  useEffect(() => {
    const on = () => setG(snap)
    const onCfg = () => setConnected(!!getSync())
    window.addEventListener(EVENT, on)
    window.addEventListener(SYNC_EVENT, onCfg)
    on()
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener(SYNC_EVENT, onCfg) }
  }, [])
  return { ...g, connected }
}
