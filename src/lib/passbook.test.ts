import { describe, expect, it } from 'vitest'
import { checkChain, classify, dedupeLines, reconcileWeek } from './passbook'
import type { IncomeEntry, PassbookLine } from './types'

describe('passbook', () => {
  it('classifies cash deposit, transfer in, withdraw, interest', () => {
    expect(classify({ desc: 'ฝากเงินสด', deposit: 100 })).toBe('deposit')
    expect(classify({ desc: 'รับโอนจาก K PLUS', deposit: 100 })).toBe('in')
    expect(classify({ desc: 'ถอนเงินสด', withdraw: 100 })).toBe('withdraw')
    expect(classify({ desc: 'ดอกเบี้ย', deposit: 5 })).toBe('other')
  })
  it('flags rows whose balance chain breaks', () => {
    const rows = [{ balance: 1000 }, { deposit: 500, balance: 1500 }, { withdraw: 200, balance: 1400 }, { deposit: 10, balance: 1410 }]
    expect(checkChain(rows)).toEqual([2])
  })
  it('drops overlapping lines already saved', () => {
    const a = { date: '2026-10-11', kind: 'deposit', amount: 5000, balance: 9000 }
    expect(dedupeLines([a], [a, { ...a, amount: 1 }])).toHaveLength(1)
  })
  it('reconciles a week: matches transfer to slip, reports closing balance', () => {
    const sun = '2026-10-11'
    const lines = [
      { id: 'a', updated: 1, date: '2026-10-11', kind: 'deposit', amount: 526000, balance: 1000000 },
      { id: 'b', updated: 1, date: '2026-10-09', kind: 'in', amount: 16900, balance: 600000 },
      { id: 'c', updated: 1, date: '2026-10-08', kind: 'in', amount: 55500, balance: 570000 },
      { id: 'd', updated: 1, date: '2026-10-12', kind: 'withdraw', amount: 283100, balance: 700000 },
    ] as PassbookLine[]
    const inc = [{ id: 'i1', updated: 1, date: '2026-10-08', amount: 16900, method: 'transfer', typeId: 't' }] as IncomeEntry[]
    const r = reconcileWeek(sun, lines, inc)
    expect(r.depositSum).toBe(526000)
    expect(r.matchedIn).toHaveLength(1)
    expect(r.unmatchedIn.map((l) => l.id)).toEqual(['c'])
    expect(r.withdraws).toHaveLength(0) // Monday withdrawal belongs to the next week
    expect(r.closing).toBe(1000000)
  })
})
