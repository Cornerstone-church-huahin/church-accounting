import { loanBalance } from './loans'
import type { ExpenseEntry, Loan } from './types'

/**
 * จ่ายสวัสดิการ (หรือรายจ่ายตามวัตถุประสงค์) ของกองทุน S ที่เงินถูกกองทุน R ยืมไปหมด โดย R ยืมเงินหมุนเวียนมาจ่ายแทน
 * ทำ 3 รายการพร้อมกัน (ผูกเป็นชุดเดียว ยกเลิกทั้งชุดได้):
 *  1) เงินหมุนเวียนให้ R ยืม  → เงินหมุนเวียน −amt · R +amt · R ติดหนี้เงินหมุนเวียน
 *  2) R คืนหนี้ให้ S         → R −amt · S +amt · หนี้ของ R ต่อ S ลดลง
 *  3) S จ่ายรายจ่ายจริง       → S −amt (เท่ากับที่ได้คืนมา ยอดสุทธิของ S ไม่เปลี่ยน)
 */
export interface AdvanceInput { fundId: string; borrowerId: string; amount: number; date: string; desc: string; group: string }
export const expenseIdOf = (group: string) => `ex-${group}`

const oldest = (a: Loan, b: Loan) => a.date.localeCompare(b.date)
/** เงินยืมที่ R ยังค้างคืนให้ S (เรียงเก่าสุดก่อน) */
export const openDebts = (loans: Loan[], fundId: string, borrowerId: string) =>
  loans.filter((l) => !l.deleted && l.lender.kind === 'fund' && l.lender.fundId === fundId && l.borrower === borrowerId && loanBalance(l) > 0).sort(oldest)
export const debtTotal = (loans: Loan[], fundId: string, borrowerId: string) => openDebts(loans, fundId, borrowerId).reduce((s, l) => s + loanBalance(l), 0)

/** ตรวจก่อนทำ: คืนข้อความผิดพลาด (ไม่มี = ทำได้) */
export function checkAdvance(loans: Loan[], i: AdvanceInput): string {
  if (!i.fundId) return 'เลือกกองทุนที่ต้องจ่าย'
  if (!i.borrowerId) return 'เลือกผู้ที่ต้องคืนกองทุนนี้'
  if (!i.amount || i.amount <= 0) return 'ใส่จำนวนเงิน'
  if (!i.desc.trim()) return 'ใส่รายการที่จ่าย'
  const owed = debtTotal(loans, i.fundId, i.borrowerId)
  if (owed <= 0) return 'ไม่มีหนี้ค้างคืนกองทุนนี้'
  if (i.amount > owed) return 'จำนวนเกินยอดที่ค้างคืนกองทุนนี้'
  return ''
}

export interface AdvancePlan { newLoan: Loan; updated: Loan[]; expense: ExpenseEntry }
export function buildAdvance(loans: Loan[], i: AdvanceInput, fundName: string, borrowerName: string): AdvancePlan {
  const note = `${i.desc.trim()} (ผ่านเงินยืมเงินหมุนเวียน)`
  const newLoan: Loan = { id: `ln-${i.group}`, updated: 0, group: i.group, lender: { kind: 'own' }, borrower: i.borrowerId, purpose: `จ่าย ${i.desc.trim()} แทน${fundName}`, date: i.date, principal: i.amount, repayments: [] }
  let left = i.amount, n = 0
  const updated: Loan[] = []
  for (const l of openDebts(loans, i.fundId, i.borrowerId)) {
    if (left <= 0) break
    const take = Math.min(left, loanBalance(l))
    left -= take
    updated.push({ ...l, repayments: [...l.repayments, { id: `${i.group}:${n++}`, date: i.date, amount: take, note }] })
  }
  const expense: ExpenseEntry = { id: expenseIdOf(i.group), updated: 0, channel: 'manual', date: i.date, amount: i.amount, desc: i.desc.trim(), status: 'paid', paidDate: i.date, method: 'cash', fundId: i.fundId, who: 'ผู้รับใช้', note: `${borrowerName}ยืมเงินหมุนเวียนจ่ายแทน → คืนหนี้${fundName}` }
  return { newLoan, updated, expense }
}

/** ยกเลิกทั้งชุด: ลบเงินยืมที่สร้าง · เอาการคืนของชุดนี้ออกจากเงินยืมเดิม · ลบรายจ่ายของชุด */
export function undoAdvance(loans: Loan[], group: string): { put: Loan[]; removeLoanIds: string[]; removeExpenseId: string } {
  const removeLoanIds = loans.filter((l) => l.group === group).map((l) => l.id)
  const put = loans.filter((l) => l.group !== group && l.repayments.some((r) => r.id.startsWith(`${group}:`))).map((l) => ({ ...l, repayments: l.repayments.filter((r) => !r.id.startsWith(`${group}:`)) }))
  return { put, removeLoanIds, removeExpenseId: expenseIdOf(group) }
}
/** ชุดที่เคยสร้างไว้ (เรียงใหม่ → เก่า) */
export const advanceGroups = (loans: Loan[]) => loans.filter((l) => !l.deleted && l.group && l.lender.kind === 'own').sort((a, b) => b.date.localeCompare(a.date))
