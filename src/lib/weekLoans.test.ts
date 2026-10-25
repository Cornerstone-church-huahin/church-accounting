import { describe, expect, it } from 'vitest'
import { ownLoanLines } from './weekLoans'
import type { Loan } from './types'

const ln = (o: Partial<Loan>): Loan => ({ id: 'x', updated: 1, lender: { kind: 'own' }, borrower: 'r', purpose: 'จ่าย สวัสดิการ อ.พิชิต แทนกองทุน S', date: '2026-10-20', principal: 500000, repayments: [], ...o }) as Loan
describe('ownLoanLines', () => {
  it('เฉพาะเงินหมุนเวียนให้ยืมในสัปดาห์นั้น', () => {
    const out = ownLoanLines([ln({}), ln({ id: 'b', date: '2026-10-10' }), ln({ id: 'c', lender: { kind: 'person', name: 'ก' } }), ln({ id: 'd', deleted: true })], () => 'ห้องพัก', '2026-10-19', '2026-10-25')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ amount: 500000, kind: 'loan' })
    expect(out[0].desc).toContain('ให้ห้องพักยืมจากเงินหมุนเวียน')
  })
})
