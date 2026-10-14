import { describe, expect, it } from 'vitest'
import { loanBalance, summarizeLoans } from './loans'
import { circulatingOnly, incomeBeforeCutoff, type Balances } from './balances'
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
  it('circulating-only balance drops money borrowed from funds but keeps outside loans', () => {
    const b = { own: { balance: 30000000 } } as unknown as Balances
    const fromFund = L({ borrower: 'own', lender: { kind: 'fund', fundId: 'tt4' }, principal: 5000000 })
    const outside = L({ id: 'l2', borrower: 'own', principal: 2000000 })
    expect(circulatingOnly(b, [fromFund, outside])).toBe(25000000)
    expect(circulatingOnly(b, [{ ...fromFund, deleted: true }])).toBe(30000000)
  })
  it('income dated before the opening cutoff is reported (fund types excluded)', () => {
    const types = [{ id: 'a', name: 'สิบลด' }, { id: 'f', name: 'กองทุนสุสาน', fund: true }] as never
    const income = [{ id: '1', date: '2026-10-04', typeId: 'a', amount: 7238070 }, { id: '2', date: '2026-10-04', typeId: 'f', amount: 100 }, { id: '3', date: '2026-10-12', typeId: 'a', amount: 500 }, { id: '4', date: '2026-10-03', typeId: 'a', amount: 9, deleted: true }] as never
    const opening = { id: 'opening', date: '2026-10-11', accounts: {}, cash: 0, unmoved: {}, updated: 0 }
    expect(incomeBeforeCutoff({ income, rounds: [], types }, opening)).toMatchObject({ count: 1, total: 7238070 })
    expect(incomeBeforeCutoff({ income, rounds: [], types }, undefined)).toMatchObject({ count: 0, total: 0 })
  })
})
