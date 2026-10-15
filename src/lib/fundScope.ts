import type { ExpenseEntry, IncomeEntry } from './types'
import type { FundMove } from './fundAccounts'

/** กองทุนที่หน้ารับ/จ่ายใช้เป็นขอบเขต: ข้อมูลเฉพาะกองทุนนี้ + เงินยืมที่เกี่ยวข้อง (แสดงในใบเป็นแถวอ่านอย่างเดียว) */
export interface FundScope {
  id: string
  name: string
  balance: number
  /** รายการเงินยืม/คืน ของกองทุนนี้ (จาก fundAccounts: key ขึ้นต้น ln: lr: lb: lq:) — + เข้า · − ออก */
  loanMoves?: FundMove[]
}

export const isLoanMove = (m: FundMove) => /^l[nrbq]:/.test(m.key)

/** แถวรายรับในใบบันทึกการถวาย: ยืมเข้ามา / รับคืนจากผู้ยืม */
export const loanIncomeRows = (f: FundScope): IncomeEntry[] => (f.loanMoves ?? []).filter((m) => m.amount > 0).map((m) => ({ id: m.key, date: m.date, typeId: f.id, amount: m.amount, method: 'cash', source: 'manual', note: m.label, updated: 0 }) as IncomeEntry)
/** แถวรายจ่ายในใบเบิก-จ่าย: ให้ยืมไป / คืนเงินยืม */
export const loanExpenseRows = (f: FundScope): ExpenseEntry[] => (f.loanMoves ?? []).filter((m) => m.amount < 0).map((m) => ({ id: m.key, channel: 'manual', date: m.date, amount: -m.amount, desc: m.label, status: 'paid', paidDate: m.date, method: 'cash', requester: 'เงินยืม', updated: 0 }) as ExpenseEntry)
/** ผลรวมเงินยืมเข้า/ออกในช่วงวันที่ */
export const loanFlows = (f: FundScope | undefined, from: string, to: string) => {
  const ms = (f?.loanMoves ?? []).filter((m) => m.date >= from && m.date <= to)
  return { inn: ms.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0), out: ms.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0) }
}
