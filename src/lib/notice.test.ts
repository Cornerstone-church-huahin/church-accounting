import { describe, expect, it } from 'vitest'
import { expenseLines, weekNotice } from './notice'
import type { ExpenseEntry } from './types'
import type { LRow } from './weekLedger'

const r = (key: string, label: string, cash: number, transfer = 0, cn = 1, tn = 0): LRow => ({ key, label, cash: { n: cn, amt: cash }, transfer: { n: tn, amt: transfer }, pending: { n: 0, amt: 0 } })
describe('ใบประกาศ', () => {
  it('รายรับแยกเงินสด/โอน แยกกองทุน ตัดแถวสมุดไม่ทราบที่มา', () => {
    const n = weekNotice({ incRows: [r('tt1', 'สิบลด', 285500), r('tt2', 'ประจำสัปดาห์', 361000, 30000, 11, 1), r('__bank:p1', 'ไม่ทราบที่มา', 0, 100000), r('tt3', 'ว่าง', 0)], fundRows: [r('tt4', 'กองทุน-ที่ดิน', 12000)] }, [{ key: 'a', date: '2026-10-15', desc: 'ค่าน้ำมัน อ.กฤต', amount: 100000 }])
    expect(n.inc.map((x) => [x.label, x.cash, x.tr, x.amt])).toEqual([['สิบลด', 285500, 0, 285500], ['ประจำสัปดาห์', 361000, 30000, 391000]])
    expect([n.totalInc, n.totalFund, n.totalOut, n.net]).toEqual([676500, 12000, 100000, 576500])
  })
  it('รายจ่ายขึ้นทีละรายการจริง (ไม่รวมหมวด ไม่รวมของกองทุน)', () => {
    const ex = (id: string, date: string, desc: string, amount: number, fundId?: string): ExpenseEntry => ({ id, updated: 1, channel: 'manual', date, amount, desc, status: 'paid', ...(fundId ? { fundId } : {}) })
    const l = expenseLines({ from: '2026-10-12', to: '2026-10-18' }, { vouchers: [], entries: [], expenses: [ex('1', '2026-10-15', 'ค่าน้ำมัน อ.กฤต', 100000), ex('2', '2026-10-15', 'ค่าน้ำมัน อ.พิชิต', 100000), ex('3', '2026-10-16', 'ค่าหนังสือ', 15000, 'tt4'), ex('4', '2026-10-30', 'นอกสัปดาห์', 5)] })
    expect(l.map((x) => [x.desc, x.amount])).toEqual([['ค่าน้ำมัน อ.กฤต', 100000], ['ค่าน้ำมัน อ.พิชิต', 100000]])
  })
})
