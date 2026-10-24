import type { Loan } from './types'

export const repaidOf = (l: Loan, asOf?: string) => l.repayments.filter((r) => !asOf || r.date <= asOf).reduce((s, r) => s + r.amount, 0)
/** ยอดค้างคืน ณ วันที่ (ไม่ระบุ = ปัจจุบัน) — ยังไม่ถึงวันยืมถือว่า 0 */
export const loanBalance = (l: Loan, asOf?: string) => (asOf && l.date > asOf ? 0 : Math.max(0, l.principal - repaidOf(l, asOf)))

export interface LoanSummary { external: number; /** หนี้ภายใน: ยืมจากกองทุนอื่น + ยืมจากเงินหมุนเวียน */ fromFunds: number; /** ส่วนที่ยืมจากเงินหมุนเวียน (รวมอยู่ใน fromFunds แล้ว) */ fromOwn: number; total: number; lentByFund: Record<string, number> }
/** สรุปหนี้ค้างคืน: ภายนอก / ยืมจากกองทุนอื่น / ที่แต่ละกองทุนถูกยืมไป */
export function summarizeLoans(loans: Loan[], asOf?: string): LoanSummary {
  const out: LoanSummary = { external: 0, fromFunds: 0, fromOwn: 0, total: 0, lentByFund: {} }
  for (const l of loans) {
    if (l.deleted) continue
    const b = loanBalance(l, asOf)
    if (b <= 0) continue
    if (l.lender.kind === 'own') { out.fromFunds += b; out.fromOwn += b } else if (l.lender.kind === 'fund') { out.fromFunds += b; const id = l.lender.fundId ?? ''; out.lentByFund[id] = (out.lentByFund[id] ?? 0) + b } else out.external += b
    out.total += b
  }
  return out
}
export const lenderLabel = (l: Loan, fundName: (id?: string) => string) => (l.lender.kind === 'own' ? 'เงินหมุนเวียน' : l.lender.kind === 'fund' ? `กองทุน${fundName(l.lender.fundId).replace(/^กองทุน(เพื่อ)?/, '')}`.replace(/^กองทุน$/, 'กองทุน') : l.lender.name || 'บุคคลภายนอก')

/** เงินหมุนเวียนให้กองทุนยืมไป ยังไม่คืน ณ วันที่ (ไม่ระบุ = ปัจจุบัน) — เงินก้อนนี้ออกจากเงินหมุนเวียนไปแล้ว */
export const ownLent = (loans: Loan[], asOf?: string) => loans.filter((l) => !l.deleted && l.lender.kind === 'own').reduce((s, l) => s + loanBalance(l, asOf), 0)
/** หนี้ภายใน = ผู้ให้ยืมเป็นกองทุนหรือเงินหมุนเวียน (ไม่ใช่บุคคลภายนอก) */
export const isInternalLoan = (l: Loan) => l.lender.kind !== 'person'
