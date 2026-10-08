import { describe, expect, it } from 'vitest'
import { approveBlock, budgetRows, buckets, entriesFromRound, isFullyApproved, periodOf, shiftPeriod, stageOf, weekSummary } from './ledger'
import type { Voucher } from './types'

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
