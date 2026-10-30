import { addDays, dow, weekStart } from './money'
import { distanceM } from './geo'
import type { Visit, VisitorName } from './types'

export const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
/** ชนิดของวันในตารางเยี่ยม: อาทิตย์ = นมัสการ · จันทร์ = วันหยุด (ขึ้นอัตโนมัติ) · อังคาร–เสาร์ = วันเยี่ยม */
export type DayKind = 'worship' | 'off' | 'visit'
export const dayKind = (iso: string): DayKind => { const d = dow(iso); return d === 0 ? 'worship' : d === 1 ? 'off' : 'visit' }
/** 7 วันของสัปดาห์ที่เริ่มวันอาทิตย์ */
export const weekDays = (sunday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(sunday, i))
export const sundayOf = (iso: string) => weekStart(iso)
export const visitsOn = (visits: Visit[], iso: string) => visits.filter((v) => !v.deleted && v.date === iso)
export const visitsOfWeek = (visits: Visit[], sunday: string) => visits.filter((v) => !v.deleted && v.date >= sunday && v.date <= addDays(sunday, 6))
/** ผู้ออกเยี่ยมหลายคนเก็บในช่องเดียวคั่นด้วย “, ” (ข้อมูลเดิมที่มีคนเดียวใช้ได้เหมือนเดิม) */
export const splitVisitors = (s: string): string[] => s.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean)
export const joinVisitors = (xs: string[]): string => [...new Set(xs.map((x) => x.replace(/,/g, ' ').trim()).filter(Boolean))].join(', ')
/** บ้านที่เช็คอินห่างกันไม่เกินนี้ (เมตร · เดินถึงกันได้) ในวันเดียวกัน นับเป็น “ออกเยี่ยมครั้งเดียว” */
export const TRIP_RADIUS_M = 300
/**
 * จัดกลุ่มการเยี่ยมเป็น “ครั้งที่ออกเยี่ยม” (ใช้คำนวณค่าเดินทาง/น้ำมัน): วันเดียวกัน + จุดเช็คอินอยู่ใกล้กัน (ต่อเนื่องกันได้ เช่น บ้าน A–B–C เรียงติดกัน)
 * รายการที่ไม่มีเช็คอิน (ข้อมูลก่อนมีระบบเช็คอิน) นับเป็นครั้งของตัวเอง · เรียงตามวัน แล้วตามเวลาเช็คอินแรกของแต่ละครั้ง
 */
export function tripsOf(visits: Visit[], radius = TRIP_RADIUS_M): Visit[][] {
  const live = visits.filter((v) => !v.deleted)
  const parent = live.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]
    if (a.date === b.date && a.checkin && b.checkin && distanceM(a.checkin, b.checkin) <= radius) parent[find(i)] = find(j)
  }
  const groups = new Map<number, Visit[]>()
  live.forEach((v, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), v]) })
  const t = (v: Visit) => v.checkin?.at ?? v.updated
  return [...groups.values()].map((g) => g.sort((x, y) => t(x) - t(y))).sort((x, y) => x[0].date.localeCompare(y[0].date) || t(x[0]) - t(y[0]))
}
/** เลขครั้งที่ออกเยี่ยม (1, 2, …) ของแต่ละการเยี่ยมในรายการที่ให้ */
export const tripNumbers = (visits: Visit[]): Map<string, number> => new Map(tripsOf(visits).flatMap((g, i) => g.map((v) => [v.id, i + 1] as [string, number])))
/** ออกเยี่ยมกี่ครั้ง (trips) · เยี่ยมกี่ราย (count) · กี่คน (people นับคนละครั้ง) · ผู้ออกเยี่ยมที่ลงชื่อ */
export function weekStats(visits: Visit[]) {
  return { count: visits.length, trips: tripsOf(visits).length, people: new Set(visits.map((v) => v.memberId)).size, visitors: [...new Set(visits.flatMap((v) => splitVisitors(v.visitor)))] }
}

/** รายชื่อผู้ออกเยี่ยมที่ให้เลือก: ทีมงานอภิบาล + ที่เพิ่มเอง − ที่ซ่อนไว้ (ไม่ซ้ำ เรียงตามที่เพิ่ม) */
export function visitorRoster(team: string[], items: Pick<VisitorName, 'name' | 'hide' | 'deleted'>[]): string[] {
  const live = items.filter((x) => !x.deleted)
  const hidden = new Set(live.filter((x) => x.hide).map((x) => x.name))
  return [...new Set([...team, ...live.filter((x) => !x.hide).map((x) => x.name)].map((n) => n.trim()).filter(Boolean))].filter((n) => !hidden.has(n))
}
