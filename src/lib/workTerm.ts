/** วาระ (2 ปี) ของแต่ละงานในห้องทำงาน: วันเริ่ม–วันสิ้นสุด และเวลาที่เหลือ */
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const parts = (s: string) => s.split('-').map(Number) as [number, number, number]

/** วันที่แบบไทย พ.ศ. เช่น 1 ม.ค. 2570 */
export function thaiShort(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—'
  const [y, m, day] = parts(d)
  return `${day} ${MONTHS[m - 1]} ${y + 543}`
}

/** ค่าตั้งต้น: เริ่ม 1 ม.ค. ของปีหน้า สิ้นสุด 31 ธ.ค. ปีถัดไปอีกปี (รวม 2 ปีเต็ม) */
export function defaultTerm(today: string): { start: string; end: string } {
  const y = parts(today)[0] + 1
  return { start: iso(y, 1, 1), end: iso(y + 1, 12, 31) }
}

/** ระยะจาก from ถึง to เป็น ปี/เดือน/วัน (from <= to) */
export function ymd(from: string, to: string): { years: number; months: number; days: number } {
  const [fy, fm, fd] = parts(from), [ty, tm, td] = parts(to)
  let months = (ty - fy) * 12 + (tm - fm)
  let days = td - fd
  if (days < 0) { months--; days += new Date(ty, tm - 1, 0).getDate() } // จำนวนวันของเดือนก่อนหน้า to
  return { years: Math.floor(months / 12), months: months % 12, days }
}

export const ymdText = (r: { years: number; months: number; days: number }) => `${r.years} ปี ${r.months} เดือน ${r.days} วัน`

/** สถานะวาระ ณ วันนี้: ยังไม่เริ่ม / กำลังดำรงตำแหน่ง (นับถอยหลังถึงวันสิ้นสุด รวมวันสิ้นสุด) / หมดวาระแล้ว */
export function termStatus(t: { start: string; end: string }, today: string) {
  if (today < t.start) return { kind: 'before' as const, left: ymd(today, t.start), pct: 0 }
  if (today > t.end) return { kind: 'ended' as const, left: ymd(t.end, today), pct: 100 }
  const tot = (Date.parse(t.end) - Date.parse(t.start)) / 864e5 + 1, used = (Date.parse(today) - Date.parse(t.start)) / 864e5
  const next = new Date(Date.parse(t.end) + 864e5).toISOString().slice(0, 10) // นับถึงสิ้นวันสิ้นสุด
  return { kind: 'active' as const, left: ymd(today, next), pct: Math.min(100, Math.max(0, Math.round((used / tot) * 100))) }
}
