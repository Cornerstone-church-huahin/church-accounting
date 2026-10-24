import { describe, expect, it } from 'vitest'
import { advanceGroups, buildAdvance, checkAdvance, debtTotal, undoAdvance } from './advancePay'
import { fundAccounts } from './fundAccounts'
import { computeBalances } from './balances'
import { summarizeLoans } from './loans'
import type { IncomeType, Loan } from './types'

const types: IncomeType[] = [{ id: 'S', name: 'กองทุน-ผู้รับใช้', order: 0, active: true, fund: true, updated: 1 }, { id: 'R', name: 'กองทุน-ห้องพัก', order: 1, active: true, fund: true, updated: 1 }]
// ผู้รับใช้ให้ห้องพักยืม 200,000 (เมื่อวันที่ 1 ก.ค.)
const base = (): Loan[] => [{ id: 'l0', updated: 1, lender: { kind: 'fund', fundId: 'S' }, borrower: 'R', purpose: 'สร้างห้องพัก', date: '2026-07-01', principal: 20000000, repayments: [] }]
const input = { fundId: 'S', borrowerId: 'R', amount: 500000, date: '2026-10-25', desc: 'สวัสดิการผู้รับใช้ ต.ค.', group: 'g1' }
const opening = { id: 'o', updated: 1, date: '2026-01-01', accounts: {}, cash: 0, unmoved: {}, own: 10000000, funds: { S: 20000000, R: 0 } } as never

describe('จ่ายสวัสดิการผ่านเงินยืมหมุนเวียน', () => {
  it('ตรวจก่อนทำ', () => {
    expect(checkAdvance(base(), input)).toBe('')
    expect(checkAdvance(base(), { ...input, amount: 20000001 })).toMatch(/เกินยอด/)
    expect(checkAdvance([], input)).toMatch(/ไม่มีหนี้/)
    expect(checkAdvance(base(), { ...input, desc: ' ' })).toMatch(/รายการ/)
  })
  it('หลังทำ: ห้องพักค้างผู้รับใช้ลดเหลือ 195,000 · ค้างเงินหมุนเวียน 5,000 · ผู้รับใช้ยอดสุทธิไม่เปลี่ยน · เงินหมุนเวียนลด 5,000', () => {
    const before = base()
    const plan = buildAdvance(before, input, 'กองทุน-ผู้รับใช้', 'กองทุน-ห้องพัก')
    const loans = [...before.filter((l) => !plan.updated.some((u) => u.id === l.id)), ...plan.updated, plan.newLoan]
    expect(debtTotal(loans, 'S', 'R')).toBe(19500000)
    const sum = summarizeLoans(loans)
    expect(sum.fromOwn).toBe(500000)
    expect(sum.fromFunds).toBe(19500000 + 500000)
    const args = { income: [], rounds: [], vouchers: [], lines: [], funds: [], entries: [], types, cats: [], expenses: [plan.expense], passbook: [], opening, today: '2026-10-25' }
    const b0 = computeBalances({ ...args, expenses: [], loans: before })
    const b1 = computeBalances({ ...args, loans })
    expect(b0.own.balance - b1.own.balance).toBe(500000) // เงินหมุนเวียนลดครั้งเดียว 5,000
    const f = (ls: Loan[], ex = [plan.expense]) => fundAccounts({ types, opening, income: [], rounds: [], expenses: ex, loans: ls })
    const S0 = f(before, [])[0].balance, S1 = f(loans)[0].balance
    const R0 = f(before, [])[1].balance, R1 = f(loans)[1].balance
    expect(S1 - S0).toBe(0) // ผู้รับใช้: +5,000 ที่ได้คืน − 5,000 ที่จ่ายจริง
    expect(R1 - R0).toBe(0) // ห้องพัก: +5,000 ยืมหมุนเวียน − 5,000 คืนผู้รับใช้
    expect(b1.total - b0.total).toBe(-500000) // เงินรวมลดเท่าที่จ่ายออกจริง 5,000 (ผู้รับใช้ได้รับ)
  })
  it('ยกเลิกทั้งชุดแล้วกลับเป็นเดิม และรายการหลายก้อนหักจากก้อนเก่าก่อน', () => {
    const two: Loan[] = [...base(), { id: 'l1', updated: 1, lender: { kind: 'fund', fundId: 'S' }, borrower: 'R', purpose: '', date: '2026-08-01', principal: 300000, repayments: [] }]
    const plan = buildAdvance(two, { ...input, amount: 20100000 - 100 }, 'S', 'R')
    expect(plan.updated.map((l) => l.id)).toEqual(['l0', 'l1'])
    const plan2 = buildAdvance(base(), input, 'S', 'R')
    const loans = [{ ...base()[0], ...plan2.updated[0] }, plan2.newLoan]
    const u = undoAdvance(loans, 'g1')
    expect(u.removeLoanIds).toEqual(['ln-g1'])
    expect(u.put[0].repayments).toEqual([])
    expect(u.removeExpenseId).toBe('ex-g1')
    expect(advanceGroups(loans).map((l) => l.group)).toEqual(['g1'])
  })
})
