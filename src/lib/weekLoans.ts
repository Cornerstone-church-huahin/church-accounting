import type { Loan } from './types'

/** เงินหมุนเวียนให้กองทุนยืมในช่วงวันที่ — ไม่ใช่รายจ่าย แต่เงินสดต้องออกจริง จึงขึ้นในช่อง "ต้องเบิก" ของใบเบิก-จ่าย */
export function ownLoanLines(loans: Loan[], nameOf: (id?: string) => string, from: string, to: string) {
  return loans
    .filter((l) => !l.deleted && l.lender.kind === 'own' && l.date >= from && l.date <= to && l.principal > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ desc: `ให้${nameOf(l.borrower)}ยืมจากเงินหมุนเวียน${l.purpose ? ` (${l.purpose})` : ''}`, person: '', kind: 'loan' as const, amount: l.principal }))
}
