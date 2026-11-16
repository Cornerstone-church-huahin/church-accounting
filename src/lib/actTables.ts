import { addDays } from './money'
import type { ActTable, ActTableRow, FundActivity } from './types'

const DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
/** ป้ายวัน เช่น “ส. 21” (วันในสัปดาห์ + วันที่) */
export const dayLabel = (iso: string): string => `${DAY_SHORT[new Date(iso + 'T00:00:00Z').getUTCDay()]} ${Number(iso.slice(8))}`
/** วันที่ตั้งแต่ start ถึง end (รวมทั้งสองวัน) ไม่เกิน max วัน */
export const datesBetween = (start: string, end: string | undefined, max = 21): string[] => {
  const out: string[] = []
  const last = end && end >= start ? end : start
  for (let d = start; d <= last && out.length < max; d = addDays(d, 1)) out.push(d)
  return out
}
let n = 0
const rid = () => `r${Date.now().toString(36)}${(n++).toString(36)}`
const emptyRow = (cols: number): ActTableRow => ({ id: rid(), cells: Array.from({ length: cols }, () => '') })

/** เติม/ตัดช่องของทุกแถวให้เท่าจำนวนคอลัมน์ */
export const fitRows = (rows: ActTableRow[], cols: number): ActTableRow[] => rows.map((r) => ({ ...r, cells: Array.from({ length: cols }, (_, i) => r.cells[i] ?? '') }))

export const moveAt = <T,>(xs: T[], i: number, d: number): T[] => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c }

/** ตารางใหม่ตามแบบ: daily = แถววันที่ของกิจกรรม × ช่วงเวลา · stage = เวลา/รายการ/ผู้รับผิดชอบ · free = ว่าง */
export function newTable(kind: ActTable['kind'], act: FundActivity, order: number, id: string): ActTable {
  if (kind === 'daily') {
    const cols = ['วัน / วันที่', 'ช่วงเช้า', 'ช่วงบ่าย', 'ช่วงค่ำ']
    const rows = datesBetween(act.date, act.endDate, 14).map((d) => ({ id: rid(), date: d, cells: [dayLabel(d), '', '', ''] }))
    return { id, updated: 0, actId: act.id, title: `กำหนดการรายวัน · ${act.name}`, kind, order, cols, rows: rows.length ? rows : [emptyRow(4)] }
  }
  if (kind === 'stage') {
    const cols = ['เวลา', 'รายการ', 'ผู้รับผิดชอบ']
    return { id, updated: 0, actId: act.id, title: `รายการบนเวที · ${act.name}`, kind, order, cols, rows: Array.from({ length: 5 }, () => emptyRow(3)) }
  }
  const cols = ['หัวข้อ 1', 'หัวข้อ 2', 'หัวข้อ 3']
  return { id, updated: 0, actId: act.id, title: `ตาราง · ${act.name}`, kind, order, cols, rows: Array.from({ length: 3 }, () => emptyRow(3)) }
}
export const newRow = (cols: number): ActTableRow => emptyRow(cols)

/** แทนค่าคอลัมน์แรกของตาราง daily ด้วยวันที่ของกิจกรรม (ที่เหลือคงเดิมตามลำดับ) */
export function dateRowsFor(act: FundActivity, rows: ActTableRow[], cols: number, from?: string, to?: string): ActTableRow[] {
  const ds = datesBetween(from || act.date, from ? to : act.endDate, 31)
  return ds.map((d, i) => { const old = rows[i]; const cells = old ? [...old.cells] : Array.from({ length: cols }, () => ''); cells[0] = dayLabel(d); return { id: old?.id ?? rid(), date: d, cells } })
}
/** เพิ่มแถววันถัดไปต่อจากแถวสุดท้ายที่มีวันที่ (ไม่มี = วันเริ่มของกิจกรรม) */
export function addNextDay(act: FundActivity, rows: ActTableRow[], cols: number): ActTableRow[] {
  const last = [...rows].reverse().find((r) => r.date)?.date
  const d = last ? addDays(last, 1) : act.date
  const cells = Array.from({ length: cols }, () => ''); cells[0] = dayLabel(d)
  return [...rows, { id: rid(), date: d, cells }]
}
export const DAILY_COLS = ['วัน / วันที่', 'ช่วงเช้า', 'ช่วงบ่าย', 'ช่วงค่ำ']
