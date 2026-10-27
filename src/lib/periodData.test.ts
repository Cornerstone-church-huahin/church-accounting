import { describe, expect, it } from 'vitest'
import { buildPeriod } from './periodData'
import { periodReport, type ReportInput } from './report'
import type { ExpenseCat, ExpenseEntry, IncomeEntry, IncomeType } from './types'

const types: IncomeType[] = [{ id: 't1', name: 'สิบลด', order: 0, active: true, updated: 1 }, { id: 'f1', name: 'กองทุนที่ดิน', order: 1, active: true, fund: true, updated: 1 }]
const cats: ExpenseCat[] = [{ id: 'g1', kind: 'group', group: 'g1', code: '1', name: 'ดูแลผู้รับใช้', order: 0, active: true, updated: 1 }, { id: 'g2', kind: 'group', group: 'g2', code: '2', name: 'อาคาร', order: 1, active: true, updated: 1 }]
const inc = (id: string, date: string, typeId: string, amount: number): IncomeEntry => ({ id, updated: 1, date, typeId, amount, method: 'cash' } as IncomeEntry)
const ex = (id: string, date: string, amount: number, o: Partial<ExpenseEntry> = {}): ExpenseEntry => ({ id, updated: 1, channel: 'manual', date, amount, desc: 'รายการ' + id, status: 'paid', catId: 'g2', ...o })
const a: ReportInput = {
  income: [inc('i1', '2026-10-06', 't1', 10000), inc('i2', '2026-10-14', 't1', 8000), inc('i3', '2026-10-21', 't1', 5000), inc('i4', '2026-10-21', 'f1', 700)],
  rounds: [], vouchers: [], lines: [], funds: [], entries: [], types, cats, passbook: [],
  expenses: [ex('a', '2026-10-07', 3000), ex('b', '2026-10-15', 15000, { catId: 'g1', desc: 'เงินเดือน อ.กฤต', biller: 'อ.กฤต' }), ex('c', '2026-10-22', 5000, { catId: 'g1', desc: 'เงินเดือน อ.กฤต', biller: 'อ.กฤต' })],
}
describe('ข้อมูลใบสรุปรายเดือน/รายปี', () => {
  const m = buildPeriod('month', 2026, 10, a, [], '2026-10-27')
  it('แท่งรายสัปดาห์รวมเท่ายอดเดือน และยอดตรงรายงานเดิม', () => {
    const r = periodReport({ from: '2026-10-01', to: '2026-10-31' }, a)
    expect(m.r.inTotal).toBe(r.inTotal)
    expect(m.pairs.reduce((s, p) => s + p.inn, 0)).toBe(m.r.inTotal)
    expect(m.pairs.reduce((s, p) => s + p.out, 0)).toBe(m.r.outTotal)
    expect(m.r.inTotal).toBe(23000)
    expect(m.r.outTotal).toBe(23000)
  })
  it('ร้อยละรายจ่ายต่อรายรับ และรวมค่าตอบแทนรายบุคคล', () => {
    expect(m.catRows.map((x) => [x.label, x.amount, x.pct])).toEqual([['ดูแลผู้รับใช้', 20000, 87], ['อาคาร', 3000, 13]])
    expect(m.comp).toEqual([{ name: 'อ.กฤต', amount: 20000 }])
    expect(m.compTotal).toBe(20000)
  })
  it('รายปี: แท่งรายเดือนรวมเท่ายอดปี · แนวโน้มถึงเดือนปัจจุบัน', () => {
    const y = buildPeriod('year', 2026, 10, a, [], '2026-10-27')
    expect(y.pairs).toHaveLength(12)
    expect(y.pairs.reduce((s, p) => s + p.inn, 0)).toBe(y.r.inTotal)
    expect(y.trend).toHaveLength(10)
    expect(y.complete.total).toBe(12)
  })
})
