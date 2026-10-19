import { describe, expect, it } from 'vitest'
import { fundSheetRows } from './fundSheet'
import type { FundAccount } from './fundAccounts'

describe('fundSheetRows', () => {
  const f: FundAccount = { id: 'tt7', name: 'กองทุน-อาหาร', opening: 10000, moneyIn: 0, moneyOut: 0, balance: 0, moves: [
    { key: 'in:a', date: '2026-10-18', label: 'เงินสด', amount: 3000 },
    { key: 'rd:x', date: '2026-10-18', label: 'นับเงินถวาย', amount: 2000 },
    { key: 'ex:e', date: '2026-10-20', label: 'จ่าย · ซื้อของ', amount: -1500 },
    { key: 'in:b', date: '2026-10-25', label: 'โอน', amount: 700 },
  ] }
  it('ยอดตั้งต้นก่อน แล้วเรียงต่อเนื่องข้ามสัปดาห์ พร้อมยอดสะสม', () => {
    const r = fundSheetRows(f)
    expect(r.map((x) => [x.kind, x.inn, x.out, x.balance])).toEqual([
      ['open', 0, 0, 10000],
      ['week', 5000, 0, 15000], // สัปดาห์ที่ 12–18 รวม 2 รายการ
      ['move', 0, 1500, 13500],
      ['week', 700, 0, 14200], // สัปดาห์ถัดไปต่อเป็นแถวที่ 2
    ])
  })
})
