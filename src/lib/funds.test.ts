import { describe, expect, it } from 'vitest'
import { fundLedger, isFundType, suggestMoves } from './funds'
import type { FundMove, IncomeType, PassbookLine } from './types'

const T = (id: string, name: string, extra: Partial<IncomeType> = {}) => ({ id, name, order: 0, active: true, updated: 0, ...extra }) as IncomeType
describe('funds', () => {
  const types = [T('tt1', 'สิบลด'), T('tt4', 'กองทุนเพื่อที่ดินคริสตจักร'), T('tt5', 'กองทุนเพื่ออาหาร'), T('b', 'ถวายสร้างอาคารนมัสการ'), T('x', 'สุสาน'), T('y', 'รถตู้', { fund: true })]
  it('detects funds by flag or name', () => {
    expect(types.filter(isFundType).map((t) => t.id)).toEqual(['tt4', 'tt5', 'b', 'y'])
    expect(isFundType(T('z', 'กองทุนอื่น', { fund: false }))).toBe(false)
  })
  it('unmoved = opening + received − moved', () => {
    const moves = [{ id: 'm', updated: 1, date: '2026-10-05', amount: 500000, alloc: { tt4: 300000, tt5: 200000 } }] as FundMove[]
    const rows = fundLedger(types, { tt4: 500000, tt5: 200000, b: 100000, tt1: 999 }, moves, { id: 'opening', updated: 1, date: '2026-09-27', accounts: {}, cash: 0, unmoved: { tt5: 50000 } })
    const by = Object.fromEntries(rows.map((r) => [r.id, r.unmoved]))
    expect(by).toMatchObject({ tt4: 200000, tt5: 50000, b: 100000, y: 0 })
    expect(rows.find((r) => r.id === 'tt1')).toBeUndefined()
  })
  it('suggests pairing a cash withdrawal from operating with a cash deposit into the purpose account', () => {
    const accts = [{ id: 'op', role: 'operating' }, { id: 'rs', role: 'restricted' }]
    const lines = [
      { id: 'w', updated: 1, date: '2026-10-05', kind: 'withdraw', amount: 500000, accountId: 'op' },
      { id: 'd', updated: 1, date: '2026-10-05', kind: 'deposit', amount: 500000, accountId: 'rs' },
      { id: 'w2', updated: 1, date: '2026-10-06', kind: 'withdraw', amount: 100, accountId: 'op' },
    ] as PassbookLine[]
    expect(suggestMoves(lines, accts).map((p) => [p.out.id, p.into.id])).toEqual([['w', 'd']])
  })
})
