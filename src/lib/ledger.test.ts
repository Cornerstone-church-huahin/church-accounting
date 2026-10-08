import { describe, expect, it } from 'vitest'
import { approveBlock, budgetRows, buckets, entriesFromRound, isFullyApproved, paidItems, periodOf, shiftPeriod, stageOf, voucherItems, weekSummary, weekTransfers } from './ledger'
import type { IncomeEntry, Voucher } from './types'

const v = (o: Partial<Voucher> = {}): Voucher => ({
  id: 'v1', no: 'V1', date: '2026-10-05', requester: { id: 'u1', name: 'ก' }, payee: 'ร้าน', purpose: 'ซื้อของ', amount: 100000, lineId: 'b1',
  status: 'submitted', approvals: [], attachments: [], updated: 1, ...o,
})

describe('voucher approvals', () => {
  it('blocks self-approval, duplicates and non-approvers', () => {
    expect(approveBlock(v(), { id: 'u1', name: '', role: 'admin' }, 200000)).toMatch(/ตัวเอง/)
    expect(approveBlock(v(), { id: 'u2', name: '', role: 'bookkeeper' }, 200000)).toMatch(/เฉพาะ/)
    expect(approveBlock(v(), { id: 'u2', name: '', role: 'auditor' }, 200000)).toBe('')
    expect(approveBlock(v({ approvals: [{ id: 'u2', name: 'ข', role: 'auditor', at: 1 }] }), { id: 'u2', name: '', role: 'auditor' }, 200000)).toMatch(/แล้ว/)
  })
  it('requires an admin among two approvers above the threshold', () => {
    const big = v({ amount: 500000, approvals: [{ id: 'u2', name: 'ข', role: 'auditor', at: 1 }] })
    expect(approveBlock(big, { id: 'u3', name: '', role: 'auditor' }, 200000)).toMatch(/แอดมิน/)
    expect(approveBlock(big, { id: 'u3', name: '', role: 'admin' }, 200000)).toBe('')
    expect(isFullyApproved(big, 200000)).toBe(false)
    expect(isFullyApproved({ ...big, approvals: [...big.approvals, { id: 'u3', name: 'ค', role: 'admin', at: 2 }] }, 200000)).toBe(true)
    expect(isFullyApproved(v({ approvals: [{ id: 'u2', name: 'ข', role: 'auditor', at: 1 }] }), 200000)).toBe(true)
  })
  it('derives stages', () => {
    expect(stageOf(v())).toBe('review')
    expect(stageOf(v({ status: 'approved' }))).toBe('pay')
    expect(stageOf(v({ status: 'paid' }))).toBe('receipt')
    expect(stageOf(v({ status: 'paid', attachments: [{ path: 'p', name: 'n', kind: 'receipt', at: 1, by: 'x' }] }))).toBe('check')
  })
})

describe('budget, weeks, periods', () => {
  it('computes budget rows with adjustments, spent and committed', () => {
    const rows = budgetRows(
      [{ id: 'b1', year: 2026, name: 'ซ่อม', base: 1000000, order: 0, updated: 1 }],
      [{ id: 'a1', year: 2026, lineId: 'b1', delta: 200000, kind: 'emergency', reason: 'x', date: '2026-05-01', updated: 1 }],
      [v({ status: 'paid', amount: 300000 }), v({ id: 'v2', status: 'approved', amount: 100000 }), v({ id: 'v3', status: 'rejected', amount: 999 })],
    )
    expect(rows[0]).toMatchObject({ current: 1200000, spent: 300000, committed: 100000, remaining: 800000 })
  })
  it('summarises a Sunday-based week', () => {
    const s = weekSummary([v(), v({ id: 'v2', date: '2026-09-20', status: 'approved' })], '2026-10-07')
    expect(s.from).toBe('2026-10-04')
    expect(s.filed).toEqual({ count: 1, total: 100000 })
    expect(s.open.find((o) => o.stage === 'pay')?.count).toBe(1)
  })
  it('builds periods and buckets', () => {
    expect(periodOf('month', '2026-02-10')).toEqual({ kind: 'month', from: '2026-02-01', to: '2026-02-28' })
    expect(shiftPeriod(periodOf('month', '2026-01-10'), -1).from).toBe('2025-12-01')
    expect(shiftPeriod(periodOf('month', '2026-12-10'), 1).from).toBe('2027-01-01')
    expect(buckets(periodOf('year', '2026-03-03')).length).toBe(12)
    expect(buckets(periodOf('week', '2026-10-07')).length).toBe(7)
    const wk = buckets(periodOf('month', '2026-10-10'))
    expect(wk[0].from).toBe('2026-10-01')
    expect(wk[wk.length - 1].to).toBe('2026-10-31')
  })
  it('creates stable cash entries from a round', () => {
    const e = entriesFromRound({ id: 'rd-2026-10-04', date: '2026-10-04', lines: { t1: 100, t2: 0 }, denoms: {}, status: 'verified', counter: { id: 'a', name: 'a' }, updated: 1 })
    expect(e.map((x) => [x.id, x.deleted])).toEqual([['rd-2026-10-04:t1', false], ['rd-2026-10-04:t2', true]])
  })
})

describe('multi-item vouchers and weekly transfer totals', () => {
  const multi = v({ amount: 150000, status: 'paid', paid: { date: '2026-10-05', by: 'ก' }, items: [
    { desc: 'น้ำมัน', amount: 100000, lineId: 'b1', method: 'cash' },
    { desc: 'ถวายสิบลดภาค 7', amount: 50000, lineId: 'b2', method: 'advance', ref: 'X1' },
  ] })
  it('falls back to a single item for old vouchers', () => {
    expect(voucherItems(v())).toEqual([{ desc: 'ซื้อของ', amount: 100000, lineId: 'b1', method: 'cash' }])
  })
  it('spends budget per item line', () => {
    const rows = budgetRows(
      [{ id: 'b1', year: 2026, name: 'A', base: 500000, order: 0, updated: 1 }, { id: 'b2', year: 2026, name: 'B', base: 100000, order: 1, updated: 1 }],
      [], [multi],
    )
    expect(rows.map((r) => r.spent)).toEqual([100000, 50000])
    expect(paidItems([multi], { kind: 'year', from: '2026-01-01', to: '2026-12-31' }).length).toBe(2)
  })
  it('counts income of the linked income types on a budget line', () => {
    const inc: IncomeEntry[] = [
      { id: '1', date: '2026-01-04', typeId: 'tt5', amount: 300000, method: 'cash', updated: 1 },
      { id: '2', date: '2026-02-01', typeId: 'tt5', amount: 200000, method: 'transfer', updated: 1 },
      { id: '3', date: '2026-02-01', typeId: 'tt1', amount: 999, method: 'cash', updated: 1 },
    ]
    const rows = budgetRows([{ id: 'b', year: 2026, name: 'อาหาร', base: 1, order: 0, updated: 1, incomeTypeIds: ['tt5'] }, { id: 'c', year: 2026, name: 'x', base: 1, order: 1, updated: 1 }], [], [], inc)
    expect(rows.map((r) => r.income)).toEqual([500000, 0])
  })
  it('adds direct budget entries to income (green) and spending (red)', () => {
    const rows = budgetRows([{ id: 'b', year: 2026, name: 'สวัสดิการ', base: 5000000, order: 0, updated: 1 }], [], [], [], [
      { id: 'e1', year: 2026, lineId: 'b', kind: 'in', amount: 2000000, date: '2026-01-05', note: '', updated: 1 },
      { id: 'e2', year: 2026, lineId: 'b', kind: 'out', amount: 500000, date: '2026-02-05', note: '', updated: 1 },
      { id: 'e3', year: 2026, lineId: 'b', kind: 'out', amount: 100, date: '2026-02-05', note: '', deleted: true, updated: 1 },
    ])
    expect(rows[0]).toMatchObject({ income: 2000000, spent: 500000, remaining: 4500000 })
  })
  it('a fund with money but no budget: balance is income minus spending, budget bar stays at zero', () => {
    const rows = budgetRows([{ id: 'f', year: 2026, name: 'กองทุน', base: 0, order: 0, updated: 1 }], [], [], [], [
      { id: 'e1', year: 2026, lineId: 'f', kind: 'in', amount: 300000, date: '2026-01-05', note: '', updated: 1 },
      { id: 'e2', year: 2026, lineId: 'f', kind: 'out', amount: 100000, date: '2026-02-05', note: '', updated: 1 },
    ])
    expect(rows[0]).toMatchObject({ current: 0, income: 300000, spent: 100000, balance: 200000, remaining: 200000 })
  })
  it('opening balances are editable starting points for the green and red bars', () => {
    const rows = budgetRows([{ id: 'f', year: 2026, name: 'กองทุน', base: 0, order: 0, updated: 1, openingIn: 400000, openingOut: 50000 }], [], [], [], [
      { id: 'e1', year: 2026, lineId: 'f', kind: 'in', amount: 100000, date: '2026-01-05', note: '', updated: 1 },
    ])
    expect(rows[0]).toMatchObject({ income: 500000, spent: 50000, balance: 450000, inParts: { opening: 400000, linked: 0, entries: 100000 } })
  })
  it('“คริสตจักร” source takes every income type that is not owned by a fund', () => {
    const inc: IncomeEntry[] = [
      { id: '1', date: '2026-01-04', typeId: 'tt1', amount: 100000, method: 'cash', updated: 1 },
      { id: '2', date: '2026-01-04', typeId: '', amount: 50000, method: 'transfer', updated: 1 },
      { id: '3', date: '2026-01-04', typeId: 'fund-type', amount: 999999, method: 'cash', updated: 1 },
    ]
    const rows = budgetRows([{ id: 'b', year: 2026, name: 'x', base: 1, order: 0, updated: 1, incomeTypeIds: ['__church'] }], [], [], inc, [], ['fund-type'])
    expect(rows[0].income).toBe(150000)
  })
  it('groups Mon–Sun transfers into the Sunday sheet (matches the real 4 Oct sheet)', () => {
    const t = (id: string, date: string, amount: number): IncomeEntry => ({ id, date, typeId: '', amount, method: 'transfer', updated: 1 })
    const xs = [t('a', '2026-09-27', 95000), t('b', '2026-09-28', 1000), t('c', '2026-10-02', 3200000), t('d', '2026-10-04', 57500), t('e', '2026-10-05', 999)]
    expect(weekTransfers(xs, '2026-10-04').total).toBe(3258500)
    expect(weekTransfers(xs, '2026-09-27').total).toBe(95000)
    expect(weekTransfers(xs, '2026-10-11').total).toBe(999)
  })
})
