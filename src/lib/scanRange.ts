import { addDays, sheetSunday } from './money'

/** ช่วงวันที่จากสัปดาห์ (ระบุด้วยวันอาทิตย์) ถึงสัปดาห์ — จันทร์ของสัปดาห์แรก ถึง อาทิตย์ของสัปดาห์หลัง (สลับลำดับให้เอง) */
export function rangeOfWeeks(a: string, b: string): { from: string; to: string } {
  const [s1, s2] = a <= b ? [a, b] : [b, a]
  return { from: addDays(s1, -6), to: s2 }
}
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
/** บรรทัดอยู่ในช่วงไหม — อ่านวันที่ไม่ออก/ไม่ครบ ถือว่า "อยู่ในช่วง" เพื่อให้ขึ้นให้ตรวจเอง ไม่ทิ้งเงียบ ๆ */
export const inScan = (date: string, from: string, to: string) => !isDate(date) || (date >= from && date <= to)
/** สรุปจำนวนบรรทัดที่อ่านได้แยกตามสัปดาห์ (เรียงจากใหม่ไปเก่า) ใช้เสนอช่วงอัตโนมัติ */
export function weekCounts(dates: string[]): { sunday: string; n: number }[] {
  const m = new Map<string, number>()
  for (const d of dates) if (isDate(d)) { const s = sheetSunday(d); m.set(s, (m.get(s) ?? 0) + 1) }
  return [...m.entries()].map(([sunday, n]) => ({ sunday, n })).sort((x, y) => y.sunday.localeCompare(x.sunday))
}
/** รวมแบบร่างกับบรรทัดที่อ่านมาทั้งหมด (pool) ตามช่วงใหม่: ตัดแบบร่างที่ออกนอกช่วง (ยกเว้นไม่มีวันที่) แล้วเติมบรรทัดจาก pool ที่อยู่ในช่วงและยังไม่ซ้ำ */
export function applyScanRange<T extends { date: string }>(drafts: T[], pool: T[], from: string, to: string, same: (a: T, b: T) => boolean): T[] {
  const keep = drafts.filter((d) => inScan(d.date, from, to))
  const out = [...keep]
  for (const p of pool) if (inScan(p.date, from, to) && !out.some((x) => same(x, p))) out.push(p)
  return out
}
