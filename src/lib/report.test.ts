import { describe, expect, it } from 'vitest'
import { fundAsOf, fundTable, fundsOf, monthWeeks, outLinesOf, periodReport, yearMonths, type ReportInput } from './report'
import { expenseLines, weekNotice } from './notice'
import { computeLedger } from './weekLedger'
import type { ExpenseCat, ExpenseEntry, IncomeEntry, IncomeType, Round } from './types'

const types: IncomeType[] = [
  { id: 't1', name: 'สิบลด', order: 0, active: true, updated: 1 }, { id: 't2', name: 'บำรุงวันอาทิตย์', order: 1, active: true, updated: 1 },
  { id: 'f1', name: 'กองทุนที่ดิน', order: 2, active: true, fund: true, updated: 1 }, { id: 'f2', name: 'กองทุนสุสาน', order: 3, active: true, fund: true, updated: 1 },
]
const cats: ExpenseCat[] = ['เดินทาง', 'อาหาร'].map((name, i) => ({ id: `xq-${i + 1}`, kind: 'group', group: `xq-${i + 1}`, code: String(i + 1), name, order: i, active: true, updated: 1 }))
const inc = (id: string, date: string, typeId: string, amount: number, method: 'cash' | 'transfer' = 'transfer'): IncomeEntry => ({ id, updated: 1, date, typeId, amount, method } as IncomeEntry)
const ex = (id: string, date: string, amount: number, o: Partial<ExpenseEntry> = {}): ExpenseEntry => ({ id, updated: 1, channel: 'manual', date, amount, desc: 'รายการ' + id, status: 'paid', catId: 'xq-1', ...o })
const rd: Round = { id: 'r1', updated: 1, date: '2026-10-18', lines: { t1: 100000, t2: 50000, f1: 20000 }, denoms: {}, status: 'counted' } as unknown as Round
const base = (): ReportInput => ({
  income: [inc('i1', '2026-10-14', 't1', 30000), inc('i2', '2026-10-30', 't2', 7000), inc('i3', '2026-11-02', 'f2', 9000)], rounds: [rd], vouchers: [], lines: [], funds: [], entries: [], types, cats, passbook: [],
  expenses: [ex('a', '2026-10-15', 100000), ex('b', '2026-10-16', 40000, { catId: 'xq-2', channel: 'bill', status: 'open' }), ex('c', '2026-10-18', 56400, { channel: 'advance', status: 'open', who: 'นายก' }), ex('d', '2026-10-19', 5000, { catId: undefined }), ex('e', '2026-10-20', 7000, { fundId: 'f1' })],
  opening: { id: 'o', updated: 1, date: '2026-09-30', accounts: {}, cash: 0, unmoved: {}, own: 0, funds: { f1: 1000000 } } as never,
})
const W = { from: '2026-10-12', to: '2026-10-18' }

describe('รายงานสรุป', () => {
  it('ยอดสัปดาห์ตรงกับใบประกาศเดิม', () => {
    const a = base(), p = periodReport(W, a)
    const L = computeLedger({ range: W, ...a, withFunds: false })
    const n = weekNotice(L, expenseLines(W, { vouchers: a.vouchers, expenses: a.expenses, entries: a.entries }))
    expect([p.inTotal, p.fundTotal, p.outTotal]).toEqual([n.totalInc, n.totalFund, n.totalOut])
    expect(p.inTotal).toBe(180000)
    expect(p.fundTotal).toBe(20000)
  })
  it('แยกเงินสำรองจ่ายออกจากค่าใช้จ่ายแต่ยอดรวมเท่าเดิม', () => {
    const p = periodReport(W, base())
    expect(p.advance).toBe(56400)
    expect(p.expenseTotal + p.advance).toBe(p.outTotal)
    expect(p.catBars.reduce((s, b) => s + b.amount, 0)).toBe(p.expenseTotal)
    expect(p.catBars.map((b) => b.label)).toEqual(['เดินทาง', 'อาหาร'])
  })
  it('รายละเอียดรายรับรวมเท่ายอดแท่ง และรายจ่ายไม่รวมของกองทุน', () => {
    const a = base(), p = periodReport(W, a)
    expect(p.incLines.reduce((s, x) => s + x.amount, 0)).toBe(p.inTotal)
    expect(outLinesOf(W, a).some((x) => x.desc === 'รายการe')).toBe(false)
  })
  it('รายการต้องติดตามมาจากสถานะจริง', () => {
    const p = periodReport({ from: '2026-10-12', to: '2026-10-25' }, base())
    expect(p.follow.map((f) => f.key)).toEqual(['uncat', 'bill', 'adv'])
    expect(p.follow[0].text).toContain('50 บาท')
    expect(periodReport({ from: '2026-01-05', to: '2026-01-11' }, base()).follow).toEqual([])
  })
  it('สัปดาห์คร่อมเดือนนับเฉพาะวันในเดือน', () => {
    const a = base(), ws = monthWeeks(2026, 11, a)
    expect(ws[0].sunday).toBe('2026-11-01')
    expect(ws[0].partial).toBe(true)
    expect(ws[0].clipped).toEqual({ from: '2026-11-01', to: '2026-11-01' })
    expect(ws[1].clipped.from).toBe('2026-11-02')
    expect(ws.find((w) => w.report.incBars.length)).toBeUndefined() // กองทุนไม่นับเป็นรายรับหมุนเวียน
    const oct = monthWeeks(2026, 10, a)
    expect(oct.reduce((s, w) => s + w.report.outTotal, 0)).toBe(periodReport({ from: '2026-10-01', to: '2026-10-31' }, a).outTotal)
  })
  it('ปี: เดือนไม่มีข้อมูลเป็น empty ไม่ใช่ 0 และเดือนที่มีบางสัปดาห์เป็น partial', () => {
    const ms = yearMonths(2026, base())
    expect(ms[0].report.empty).toBe(true)
    expect(ms[9].report.empty).toBe(false)
    expect(ms[9].partial).toBe(true)
  })
  it('ตารางกองทุน: ยอดปลาย = ต้น + รับ − จ่าย และไม่มียอดตั้งต้นก็ไม่เดา', () => {
    const a = base(), f = fundsOf(a)
    const t = fundTable(f, { from: '2026-10-01', to: '2026-10-31' }, a.opening)
    const l = t.find((x) => x.id === 'f1')!
    expect(l).toMatchObject({ start: 1000000, moneyIn: 20000, moneyOut: 7000, end: 1013000 })
    expect(fundTable(f, { from: '2026-09-01', to: '2026-09-30' }, a.opening)[0].start).toBeNull()
    expect(fundTable(f, { from: '2026-10-01', to: '2026-10-31' }, undefined)[0].end).toBeNull()
    expect(fundAsOf(f, '2026-10-31', a.opening).find((x) => x.id === 'f1')!.balance).toBe(1013000)
    expect(fundAsOf(f, '2026-08-01', a.opening)[0].balance).toBeNull()
  })
})
