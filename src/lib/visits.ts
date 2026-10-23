import { addDays, dow, weekStart } from './money'
import type { Visit } from './types'

export const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
/** ชนิดของวันในตารางเยี่ยม: อาทิตย์ = นมัสการ · จันทร์ = วันหยุด (ขึ้นอัตโนมัติ) · อังคาร–เสาร์ = วันเยี่ยม */
export type DayKind = 'worship' | 'off' | 'visit'
export const dayKind = (iso: string): DayKind => { const d = dow(iso); return d === 0 ? 'worship' : d === 1 ? 'off' : 'visit' }
/** 7 วันของสัปดาห์ที่เริ่มวันอาทิตย์ */
export const weekDays = (sunday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(sunday, i))
export const sundayOf = (iso: string) => weekStart(iso)
export const visitsOn = (visits: Visit[], iso: string) => visits.filter((v) => !v.deleted && v.date === iso)
export const visitsOfWeek = (visits: Visit[], sunday: string) => visits.filter((v) => !v.deleted && v.date >= sunday && v.date <= addDays(sunday, 6))
/** จำนวนครั้งที่เยี่ยม · จำนวนคนที่ได้รับการเยี่ยม (นับคนละครั้ง) · ผู้เยี่ยมที่ลงชื่อ */
export function weekStats(visits: Visit[]) {
  return { count: visits.length, people: new Set(visits.map((v) => v.memberId)).size, visitors: [...new Set(visits.map((v) => v.visitor.trim()).filter(Boolean))] }
}
