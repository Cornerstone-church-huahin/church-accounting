import { describe, expect, it } from 'vitest'
import { fundSheets } from './fundSheet'
import type { FundAccount } from './fundAccounts'

describe('fundSheets', () => {
  const f: FundAccount = { id: 'tt7', name: 'กองทุน-อาหาร', opening: 10000, moneyIn: 0, moneyOut: 0, balance: 0, moves: [
    { key: 'in:b', date: '2026-10-25', label: 'โอน', amount: 700 },
    { key: 'in:a', date: '2026-10-18', label: 'เงินสด', amount: 3000 },
    { key: 'ex:e', date: '2026-10-20', label: 'จ่าย · ซื้อของ', amount: -1500 },
  ] }
  it('แยกใบรับ/ใบจ่าย เรียงวันที่ ยอดสะสม และคงเหลือ', () => {
    const s = fundSheets(f)
    expect(s.inn.map((x) => [x.date, x.amount, x.balance])).toEqual([['2026-10-18', 3000, 13000], ['2026-10-25', 700, 12200]])
    expect(s.out.map((x) => [x.amount, x.balance])).toEqual([[1500, 11500]])
    expect([s.totalIn, s.totalOut, s.balance]).toEqual([3700, 1500, 12200])
  })
})
