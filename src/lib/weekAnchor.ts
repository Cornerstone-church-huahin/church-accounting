import { addDays } from './money'
import { sundayOf } from './visits'

const KEY = 'acct.visittable.week'
/** สัปดาห์ จันทร์–อาทิตย์ ที่มีวันนี้ (คีย์ = วันอาทิตย์ก่อนหน้า) */
export const weekKeyOf = (iso: string): string => sundayOf(addDays(iso, -1))

/**
 * สัปดาห์ที่จำไว้ในเครื่อง (ใช้ร่วมกันทุกหน้าตารางเยี่ยม/เส้นทาง): จำเฉพาะภายในสัปดาห์ปัจจุบัน —
 * เมื่อขึ้นสัปดาห์ใหม่ (วันจันทร์) ให้เปิดสัปดาห์ปัจจุบันอัตโนมัติ ไม่ค้างสัปดาห์เก่า
 */
export function loadWeekAnchor(today: string): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return today
    const o = JSON.parse(raw) as { d?: string; w?: string }
    return o && typeof o.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.d) && o.w === weekKeyOf(today) ? o.d : today
  } catch { return today }
}
export function saveWeekAnchor(d: string, today: string): void {
  try { localStorage.setItem(KEY, JSON.stringify({ d, w: weekKeyOf(today) })) } catch { /* ignore */ }
}
