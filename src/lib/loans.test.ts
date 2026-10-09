import { describe, expect, it } from 'vitest'
import { loanBalance, summarizeLoans } from './loans'
import type { Loan } from './types'

const L = (o: Partial<Loan>) => ({ id: 'l', updated: 1, lender: { kind: 'person', name: 'พี่ก' }, purpose: 'สุสาน', date: '2026-08-01', principal: 10000000, repayments: [], ...o }) as Loan
describe('loans', () => {
  it('balance = principal − repayments as of a date', () => {
    const l = L({ repayments: [{ id: 'r1', date: '2026-09-01', amount: 2000000 }, { id: 'r2', date: '2026-10-01', amount: 1000000 }] })
    expect(loanBalance(l)).toBe(7000000)
    expect(loanBalance(l, '2026-09-15')).toBe(8000000)
    expect(loanBalance(l, '2026-07-31')).toBe(0)
  })
  it('summarises external vs fund loans and what each fund has lent out', () => {
    const s = summarizeLoans([
      L({ id: 'a', principal: 10000000 }),
      L({ id: 'b', principal: 5000000, purpose: 'ห้องพัก' }),
      L({ id: 'c', lender: { kind: 'fund', fundId: 'tt9' }, principal: 5000000 }),
      L({ id: 'd', lender: { kind: 'fund', fundId: 'tt9' }, principal: 3000000, repayments: [{ id: 'r', date: '2026-09-01', amount: 3000000 }] }),
      L({ id: 'e', deleted: true, principal: 99 }),
    ])
    expect(s).toEqual({ external: 15000000, fromFunds: 5000000, total: 20000000, lentByFund: { tt9: 5000000 } })
  })
})
