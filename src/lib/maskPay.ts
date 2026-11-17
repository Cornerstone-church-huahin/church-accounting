import { FUEL_LABEL, isFuelAuto } from './fuelCharges'
import type { ExpenseEntry } from './types'

const isFuelRow = (e: { id?: string; key?: string; derived?: string; fuel?: boolean }) => isFuelAuto(e)

/** รายการค่าตอบแทนผู้รับใช้ (เงินเดือน/สวัสดิการ/ค่าตอบแทน) — ผู้นำงานเห็นเป็นยอดรวม ไม่เห็นรายคน */
export const isCompensation = (e: { desc?: string; note?: string }) => /เงินเดือน|สวัสดิการ|ค่าตอบแทน/.test(`${e.desc ?? ''} ${e.note ?? ''}`)
export const COMP_LABEL = 'สวัสดิการผู้รับใช้ (ยอดรวม)'

/** รวมรายการค่าตอบแทนในใบเป็นแถวเดียว (ไม่มีชื่อ/หมายเหตุ/ผู้วางบิล/รูป) · รายการอื่นเหมือนเดิม */
export function maskExpenses(entries: ExpenseEntry[]): ExpenseEntry[] {
  const fuel = entries.filter(isFuelRow)
  if (fuel.length > 0) {
    const last = fuel.reduce((m, e) => (e.date > m ? e.date : m), fuel[0].date)
    entries = [...entries.filter((e) => !isFuelRow(e)), { id: 'mask:fuel', updated: Math.max(...fuel.map((e) => e.updated)), channel: 'manual', date: last, amount: fuel.reduce((s, e) => s + e.amount, 0), desc: FUEL_LABEL, status: 'paid', method: 'cash' }]
  }
  const comp = entries.filter(isCompensation)
  if (comp.length === 0) return entries
  const rest = entries.filter((e) => !isCompensation(e))
  const last = comp.reduce((m, e) => (e.date > m ? e.date : m), comp[0].date)
  return [...rest, { id: 'mask:comp', updated: Math.max(...comp.map((e) => e.updated)), channel: 'manual', date: last, amount: comp.reduce((s, e) => s + e.amount, 0), desc: COMP_LABEL, status: 'paid', method: 'cash' }]
}

/** รายการ "ต้องเบิก" ใต้ใบ: ค่าตอบแทนรวมเป็นแถวเดียวไม่ระบุชื่อ */
export function maskPending<T extends { desc: string; person: string; kind: string; amount: number; fuel?: boolean }>(items0: T[]): T[] {
  const fuel = items0.filter(isFuelRow)
  const items: T[] = fuel.length ? [...items0.filter((x) => !isFuelRow(x)), { ...fuel[0], desc: FUEL_LABEL, person: '', amount: fuel.reduce((s, x) => s + x.amount, 0) }] : items0
  const comp = items.filter((x) => x.kind !== 'loan' && isCompensation(x))
  if (comp.length === 0 && !items.some((x) => x.kind === 'loan')) return items
  const rest = items.filter((x) => x.kind === 'loan' ? false : !isCompensation(x))
  const loans = items.filter((x) => x.kind === 'loan').map((x) => ({ ...x, desc: 'ให้กองทุนยืมจากเงินหมุนเวียน' }))
  if (comp.length === 0) return [...rest, ...loans]
  return [...rest, ...loans, { ...comp[0], desc: COMP_LABEL, person: '', amount: comp.reduce((s, x) => s + x.amount, 0) }]
}

/** ใบสรุปรายสัปดาห์: ค่าตอบแทนรวมเป็นแถวเดียว (ตัดชื่อผู้เบิก) */
export function maskNoticeOut<T extends { key: string; date: string; desc: string; amount: number; by?: string }>(out0: T[]): T[] {
  const fuel = out0.filter(isFuelRow)
  const out: T[] = fuel.length ? [...out0.filter((x) => !isFuelRow(x)), (() => { const { by: _b, ...r } = fuel.reduce((a, x) => (x.date < a.date ? x : a), fuel[0]); return { ...r, key: 'mask:fuel', desc: FUEL_LABEL, amount: fuel.reduce((s, x) => s + x.amount, 0) } as unknown as T })()].sort((a, b) => a.date.localeCompare(b.date)) : out0
  const comp = out.filter((x) => isCompensation(x))
  if (comp.length === 0) return out
  const first = comp.reduce((a, x) => (x.date < a.date ? x : a), comp[0])
  const { by: _by, ...rest } = first
  return [...out.filter((x) => !isCompensation(x)), { ...rest, key: 'mask:comp', desc: COMP_LABEL, amount: comp.reduce((s, x) => s + x.amount, 0) } as unknown as T].sort((a, b) => a.date.localeCompare(b.date))
}
