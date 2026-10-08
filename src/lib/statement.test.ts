import { describe, expect, it } from 'vitest'
import { guessMap, parseCSV, parseRows, parseStmtAmount, parseStmtDate, suggest, suggestGroups } from './statement'
import type { StatementLine } from './types'

describe('statement parsing', () => {
  it('parses dates in Thai/CE formats', () => {
    expect(parseStmtDate('04/10/2569')).toBe('2026-10-04')
    expect(parseStmtDate('04/10/2026 10:23')).toBe('2026-10-04')
    expect(parseStmtDate('04-10-69')).toBe('2026-10-04')
    expect(parseStmtDate('2026-10-04')).toBe('2026-10-04')
    expect(parseStmtDate('31/02/2569')).toBe('')
  })
  it('parses amounts', () => {
    expect(parseStmtAmount('1,234.50')).toBe(123450)
    expect(parseStmtAmount('(500.00)')).toBe(-50000)
    expect(parseStmtAmount('')).toBe(0)
    expect(parseStmtAmount('x')).toBeNaN()
  })
  it('handles quoted CSV and builds stable ids', () => {
    const csv = 'วันที่,รายการ,ถอน,ฝาก,ยอดคงเหลือ\n04/10/2569,"ฝากเงินสด, สาขาหัวหิน",,"12,000.00","50,000.00"\n05/10/2569,โอนออก,3000.00,,47000.00\n'
    const rows = parseCSV(csv)
    const map = guessMap(rows[0])
    expect(map).toMatchObject({ date: 0, desc: 1, debit: 2, credit: 3, balance: 4 })
    const a = parseRows(rows.slice(1), map, 'acc1')
    const b = parseRows(rows.slice(1), map, 'acc1')
    expect(a.lines.map((l) => l.id)).toEqual(b.lines.map((l) => l.id))
    expect(a.lines[0]).toMatchObject({ date: '2026-10-04', credit: 1200000, debit: 0, desc: 'ฝากเงินสด, สาขาหัวหิน' })
    expect(a.from).toBe('2026-10-04')
  })
  it('supports a single signed amount column', () => {
    const rows = [['Date', 'Description', 'Amount'], ['2026-10-04', 'A', '100.00'], ['2026-10-05', 'B', '-40.00']]
    const map = guessMap(rows[0])
    const p = parseRows(rows.slice(1), map, 'x')
    expect(p.lines.map((l) => [l.credit, l.debit])).toEqual([[10000, 0], [0, 4000]])
  })
})

describe('suggest', () => {
  const line = (id: string, date: string, credit: number, debit = 0, desc = ''): StatementLine => ({ id, batchId: 'b', accountId: 'a', date, desc, credit, debit, updated: 1 })
  it('matches equal amounts within the window, one-to-one, preferring transfer refs', () => {
    const lines = [line('l1', '2026-10-05', 500000), line('l2', '2026-10-06', 50000, 0, 'โอน REF9876')]
    const out = suggest(lines, [
      { kind: 'deposit', refId: 'r1', date: '2026-10-04', amount: 500000, label: '' },
      { kind: 'income', refId: 'i1', date: '2026-10-06', amount: 50000, ref: '9876', label: '' },
      { kind: 'income', refId: 'i2', date: '2026-10-06', amount: 50000, ref: '1111', label: '' },
    ], 7)
    expect(out.find((s) => s.lineId === 'l1')?.cand.refId).toBe('r1')
    expect(out.find((s) => s.lineId === 'l2')?.cand.refId).toBe('i1')
    expect(out.length).toBe(2)
  })
  it('does not match outside the date window or crossing credit/debit', () => {
    const lines = [line('l1', '2026-11-05', 500000), line('l2', '2026-10-05', 0, 500000)]
    expect(suggest(lines, [{ kind: 'deposit', refId: 'r1', date: '2026-10-04', amount: 500000, label: '' }], 7)).toEqual([])
  })
})

describe('suggestGroups (many bank credits = one weekly transfer total)', () => {
  const l = (id: string, date: string, credit: number): StatementLine => ({ id, batchId: 'b', accountId: 'a', date, desc: '', credit, debit: 0, updated: 1 })
  it('finds the group whose sum equals the sheet total', () => {
    const lines = [l('1', '2026-09-29', 100000), l('2', '2026-10-02', 3200000), l('3', '2026-10-04', 57500), l('4', '2026-09-20', 777)]
    const g = suggestGroups(lines, [{ sunday: '2026-10-04', amount: 3357500 }])
    expect(g).toHaveLength(1)
    expect(g[0].lineIds.sort()).toEqual(['1', '2', '3'])
  })
  it('ignores unrelated credits (e.g. a cash deposit) in the same window', () => {
    const lines = [l('1', '2026-10-02', 100000), l('2', '2026-10-03', 50000), l('x', '2026-10-04', 500000)]
    const g = suggestGroups(lines, [{ sunday: '2026-10-04', amount: 150000 }])
    expect(g[0].lineIds.sort()).toEqual(['1', '2'])
  })
  it('suggests nothing when the sum differs', () => {
    expect(suggestGroups([l('1', '2026-10-02', 100)], [{ sunday: '2026-10-04', amount: 200 }])).toEqual([])
  })
})
