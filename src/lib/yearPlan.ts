import type { YearPlanRow } from './types'

export const DAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
export const MONTH_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const pad = (n: number) => String(n).padStart(2, '0')
export const headId = (year: number) => `yp-head-${year}`
export const baseId = (date: string) => `yp-${date}-0`
const dow = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay()

/** วันอาทิตย์ทุกวันของปี (ค.ศ.) ตั้งแต่ต้นปีถึงสิ้นปี */
export function sundaysOf(year: number): string[] {
  const out: string[] = []
  const d = new Date(Date.UTC(year, 0, 1))
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCFullYear() === year) { out.push(`${year}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`); d.setUTCDate(d.getUTCDate() + 7) }
  return out
}

export interface PlanLine { id: string; date: string; seq: number; base: boolean; day: string; dateTxt: string; month: number; text: string; owner: string; budget: string; done: boolean }

/** แถวของตารางทั้งปี: ทุกวันอาทิตย์ (แถวเริ่มต้น) + แถวที่แก้/เพิ่ม · ซ่อนแถวที่ลบ · เรียงตามวันที่ */
export function buildRows(year: number, items: YearPlanRow[]): PlanLine[] {
  const by = new Map(items.map((x) => [x.id, x]))
  const rows: PlanLine[] = []
  const mk = (id: string, date: string, seq: number, base: boolean, o?: YearPlanRow): PlanLine => ({
    id, date, seq, base, day: o?.dayText || DAY_FULL[dow(date)], dateTxt: o?.dateText || String(Number(date.slice(8))), month: Number(date.slice(5, 7)) - 1,
    text: o?.text ?? '', owner: o?.owner ?? '', budget: o?.budget ?? '', done: !!o?.done,
  })
  for (const d of sundaysOf(year)) {
    const o = by.get(baseId(d))
    if (o?.deleted) continue
    rows.push(mk(baseId(d), o?.date || d, 0, true, o))
  }
  for (const o of items) {
    if (o.deleted || !o.id.startsWith('yp-x-') || !o.date || o.year !== year) continue
    rows.push(mk(o.id, o.date, o.seq, false, o))
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq || a.id.localeCompare(b.id))
}

/** rowSpan ของช่อง “เดือน”: แถวแรกของแต่ละเดือน = จำนวนแถวของเดือนนั้น · แถวอื่น = 0 (ไม่วาดช่อง) */
export function monthSpans(lines: { month: number }[]): number[] {
  const out = lines.map(() => 0)
  let start = 0
  lines.forEach((l, i) => { if (i > 0 && l.month !== lines[i - 1].month) start = i; out[start]++ })
  return out
}

/** รวมงบประมาณจากข้อความ เช่น "2,000" "1,000 บาท" (เอาเฉพาะตัวเลขชุดแรกของแต่ละช่อง) */
export const sumBudget = (xs: string[]): number => xs.reduce((n, s) => { const m = /[\d,]+(\.\d+)?/.exec(s); return n + (m ? Number(m[0].replace(/,/g, '')) || 0 : 0) }, 0)
