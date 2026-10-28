import { useCallback, useEffect, useState } from 'react'
import { useAdminNotes } from './data'
import { decryptJson, deriveKey, encryptJson, exportKey, importKey, makeCheck, randomSalt, verifyKey } from './vault'
import type { AdminNote, VaultItem } from './types'

const SESSION_KEY = 'acct.vault.k'
export const MIN_PASS = 6
export type BookState = 'nopass' | 'locked' | 'open'
type Body = Omit<AdminNote, 'id' | 'updated' | 'deleted' | 'by'>

/**
 * สมุดส่วนตัวแอดมิน (เข้ารหัส): เนื้อหาถูกล็อกด้วยรหัสผ่านของแอดมินก่อนส่งขึ้นที่เก็บกลาง
 * กุญแจเก็บในหน่วยความจำ/แท็บนี้เท่านั้น (ปิดแท็บ = ล็อก) · ลืมรหัส = กู้ไม่ได้
 */
export function useAdminBook() {
  const store = useAdminNotes()
  const vault = store.items.find((x) => x.id === 'vault')
  const [key, setKey] = useState<CryptoKey | null>(null)
  const [list, setList] = useState<AdminNote[]>([])
  const sig = store.items.map((x) => `${x.id}:${x.updated}`).join(',')

  // กลับมาเปิดต่อในแท็บเดิม (ไม่ต้องใส่รหัสซ้ำเมื่อรีเฟรช)
  useEffect(() => {
    if (key || !vault?.check) return
    let dead = false
    ;(async () => {
      try {
        const saved = sessionStorage.getItem(SESSION_KEY); if (!saved) return
        const k = await importKey(saved)
        if (!dead && await verifyKey(k, vault.check!)) setKey(k)
      } catch { /* ignore */ }
    })()
    return () => { dead = true }
  }, [vault?.check, key])

  // ถอดรหัสรายการทั้งหมดเมื่อเปิดสมุด (รายการรุ่นก่อนเข้ารหัสแสดงได้ทันที)
  useEffect(() => {
    let dead = false
    ;(async () => {
      if (!key) { setList([]); return }
      const out: AdminNote[] = []
      for (const it of store.items) {
        if (it.id === 'vault' || it.deleted) continue
        if (it.enc) { try { out.push({ ...(await decryptJson<Body>(key, it.enc)), id: it.id, updated: it.updated }) } catch { /* ข้ามรายการที่ถอดไม่ได้ */ } }
        else if (it.kind) out.push(it as AdminNote)
      }
      if (!dead) setList(out)
    })()
    return () => { dead = true }
  }, [key, sig]) // eslint-disable-line react-hooks/exhaustive-deps

  const sealItem = async (k: CryptoKey, x: AdminNote): Promise<VaultItem> => {
    const { id, updated, deleted, by: _by, ...body } = x; void _by
    return deleted ? { id, updated, deleted: true } : { id, updated, enc: await encryptJson(k, body) }
  }
  const persistKey = async (k: CryptoKey) => { try { sessionStorage.setItem(SESSION_KEY, await exportKey(k)) } catch { /* ignore */ } }

  /** ตั้งรหัสครั้งแรก: สร้างตัวตรวจรหัส + เข้ารหัสรายการรุ่นก่อนที่ยังไม่เข้ารหัส */
  const setup = useCallback(async (pass: string) => {
    if (pass.length < MIN_PASS) return `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASS} ตัวอักษร`
    const salt = randomSalt(), k = await deriveKey(pass, salt)
    const legacy = await Promise.all(store.items.filter((x) => x.id !== 'vault' && !x.deleted && !x.enc && x.kind).map((x) => sealItem(k, x as AdminNote)))
    const ok = store.put([{ id: 'vault', updated: Date.now(), salt, check: await makeCheck(k) }, ...legacy.map((x) => ({ ...x, updated: Date.now() }))])
    if (!ok) return 'ไม่มีสิทธิ์บันทึก'
    await persistKey(k); setKey(k); return ''
  }, [store]) // eslint-disable-line react-hooks/exhaustive-deps

  const unlock = useCallback(async (pass: string) => {
    if (!vault?.salt || !vault.check) return 'ยังไม่ได้ตั้งรหัส'
    const k = await deriveKey(pass, vault.salt)
    if (!(await verifyKey(k, vault.check))) return 'รหัสผ่านไม่ถูกต้อง'
    await persistKey(k); setKey(k); return ''
  }, [vault?.salt, vault?.check])

  const lock = useCallback(() => { try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ } setKey(null) }, [])

  /** บันทึก/ลบรายการ (เข้ารหัสก่อนส่ง) */
  const put = useCallback(async (x: AdminNote) => {
    if (!key) return false
    return store.put([await sealItem(key, { ...x, updated: Date.now() })])
  }, [key, store]) // eslint-disable-line react-hooks/exhaustive-deps

  const state: BookState = !vault?.check ? 'nopass' : key ? 'open' : 'locked'
  return { state, list, setup, unlock, lock, put }
}
