import { describe, expect, it } from 'vitest'
import { weekNotice } from './notice'
import type { LRow } from './weekLedger'

const r = (key: string, label: string, cash: number, transfer = 0, pending = 0): LRow => ({ key, label, cash: { n: 1, amt: cash }, transfer: { n: 0, amt: transfer }, pending: { n: 0, amt: pending } })
describe('weekNotice', () => {
  it('รวมเงินสด+โอน แยกกองทุน ตัดแถวสมุดไม่ทราบที่มา และคำนวณสุทธิ', () => {
    const n = weekNotice({
      incRows: [r('tt1', 'สิบลด', 285500), r('tt2', 'ประจำสัปดาห์', 361000, 30000), r('__bank:p1', 'ไม่ทราบที่มา', 0, 100000), r('tt3', 'ว่าง', 0)],
      fundRows: [r('tt4', 'กองทุน-ที่ดิน', 12000)],
      outRows: [r('g1', 'ค่าอาหาร', 100000, 0, 50000), r('__bank:x', 'ไม่ทราบรายจ่าย', 0, 99900)],
    })
    expect(n.inc.map((x) => [x.label, x.amt])).toEqual([['สิบลด', 285500], ['ประจำสัปดาห์', 391000]])
    expect(n.totalInc).toBe(676500)
    expect(n.totalFund).toBe(12000)
    expect(n.out.map((x) => x.amt)).toEqual([150000])
    expect(n.net).toBe(526500)
  })
})
