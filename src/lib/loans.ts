import type { Loan } from './types'

export const repaidOf = (l: Loan, asOf?: string) => l.repayments.filter((r) => !asOf || r.date <= asOf).reduce((s, r) => s + r.amount, 0)
/** ยอดค้างคืน ณ วันที่ (ไม่ระบุ = ปัจจุบัน) — ยังไม่ถึงวันยืมถือว่า 0 */
export const loanBalance = (l: Loan, asOf?: string) => (asOf && l.date > asOf ? 0 : Math.max(0, l.principal - repaidOf(l, asOf)))

export interface LoanSummary { external: number; fromFunds: number; total: number; lentByFund: Record<string, number> }
/** สรุปหนี้ค้างคืน: ภายนอก / ยืมจากกองทุนอื่น / ที่แต่ละกองทุนถูกยืมไป */
export function summarizeLoans(loans: Loan[], asOf?: string): LoanSummary {
  const out: LoanSummary = { external: 0, fromFunds: 0, total: 0, lentByFund: {} }
  for (const l of loans) {
    if (l.deleted) continue
    const b = loanBalance(l, asOf)
    if (b <= 0) continue
    if (l.lender.kind === 'fund') { out.fromFunds += b; const id = l.lender.fundId ?? ''; out.lentByFund[id] = (out.lentByFund[id] ?? 0) + b } else out.external += b
    out.total += b
  }
  return out
}
export const lenderLabel = (l: Loan, fundName: (id?: string) => string) => (l.lender.kind === 'fund' ? `กองทุน${fundName(l.lender.fundId).replace(/^กองทุน(เพื่อ)?/, '')}`.replace(/^กองทุน$/, 'กองทุน') : l.lender.name || 'บุคคลภายนอก')
