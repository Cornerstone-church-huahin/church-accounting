import { occurrences, DAY_NAMES } from './calendar'
import { addDays, monthName } from './money'
import type { CalEvent } from './types'

export interface PlanRow {
  key: string
  eventId: string
  /** เดือน (1–12) ของแถวนี้ */
  month: number
  dates: string[]
  /** "อาทิตย์" · "เสาร์ - จันทร์" (ช่วงหลายวัน) */
  dayLabel: string
  /** "18" · "05 - 07" · "23, 26" */
  dateLabel: string
  title: string
  lead: string
  /** งบประมาณต่อครั้ง (สตางค์) */
  budget: number
  /** ผ่านไปแล้ว (ทุกวันของแถวนี้ก่อนวันนี้) หรือทำเครื่องหมายเสร็จแล้ว → ขีดฆ่าวันที่ */
  struck: boolean
  tab: number
}

export const quarterMonths = (q: 1 | 2 | 3 | 4): [number, number, number] => [q * 3 - 2, q * 3 - 1, q * 3]
const p2 = (n: number) => String(n).padStart(2, '0')
const dayName = (iso: string) => DAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()]

/** แบ่งวันที่ของกิจกรรมเป็นชุดวันติดกัน: [23,24,25,27] → [[23,24,25],[27]]? — ที่นี่: วันติดกันเป็นช่วงเดียว ที่เหลือแยกแถว */
function runs(dates: string[]): string[][] {
  const out: string[][] = []
  for (const d of dates) {
    const last = out[out.length - 1]
    if (last && addDays(last[last.length - 1], 1) === d) last.push(d)
    else out.push([d])
  }
  return out
}

/** แถวของใบแผนงานรายไตรมาส: กิจกรรมที่ติ๊ก "แสดงในแผนงาน" ขยายวันที่ในไตรมาส (รวมทำซ้ำ) — วันติดกัน = ช่วงเดียวแถวเดียว · เรียงตามวันที่ */
export function planRows(events: CalEvent[], year: number, q: 1 | 2 | 3 | 4, today: string): PlanRow[] {
  const [m1, , m3] = quarterMonths(q)
  const from = `${year}-${p2(m1)}-01`, to = `${year}-${p2(m3)}-31`
  const rows: PlanRow[] = []
  for (const e of events) {
    if (e.deleted || !e.plan) continue
    const ds = occurrences(e, from, to)
    const byMonth = new Map<number, string[]>()
    for (const d of ds) byMonth.set(Number(d.slice(5, 7)), [...(byMonth.get(Number(d.slice(5, 7))) ?? []), d])
    for (const [month, list] of byMonth) {
      for (const run of runs(list)) {
        const first = run[0], last = run[run.length - 1]
        const dateLabel = run.length === 1 ? p2(Number(first.slice(8))) : `${p2(Number(first.slice(8)))} - ${p2(Number(last.slice(8)))}`
        rows.push({
          key: `${e.id}:${first}`, eventId: e.id, month, dates: run,
          dayLabel: run.length === 1 ? dayName(first) : `${dayName(first)} - ${dayName(last)}`.replace(/^(\S+) - \1$/, '$1'),
          dateLabel, title: e.title, lead: e.lead ?? '', budget: e.budget ?? 0,
          struck: !!e.done || last < today, tab: e.tab,
        })
      }
    }
  }
  return rows.sort((a, b) => a.dates[0].localeCompare(b.dates[0]) || a.title.localeCompare(b.title, 'th'))
}

/** รวมงบประมาณ (สตางค์) ของแถวทั้งหมด / รายเดือน */
export const planTotal = (rows: PlanRow[]) => rows.reduce((s, r) => s + r.budget, 0)
export const planTotalOf = (rows: PlanRow[], month: number) => planTotal(rows.filter((r) => r.month === month))
export const quarterLabel = (year: number, q: 1 | 2 | 3 | 4) => { const [a, , c] = quarterMonths(q); return `${monthName(a)} – ${monthName(c)} ${year + 543}` }
