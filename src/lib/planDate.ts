import { useState } from 'react'

const KEY = 'acct.visitplan.date'
/** วันที่วางแผนเยี่ยม (ใช้ร่วมกันขั้น 1 วางแผน · ขั้น 2 จัดกลุ่ม): ตั้งต้น = วันนี้ · เลือกวันล่วงหน้าได้ · วันที่ผ่านมาแล้วกลับเป็นวันนี้ */
export function usePlanDate(today: string): [string, (d: string) => void] {
  const read = () => { try { const v = localStorage.getItem(KEY); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= today ? v : today } catch { return today } }
  const [d, setD] = useState(read)
  return [d, (v: string) => { const x = v && v >= today ? v : today; setD(x); try { localStorage.setItem(KEY, x) } catch { /* ignore */ } }]
}
