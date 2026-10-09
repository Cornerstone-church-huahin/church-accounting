import { describe, expect, it } from 'vitest'
import { chainGap, checkChain, classify, dedupeLines, dupIndexes, normalizeRows, reconcileWeek } from './passbook'
import type { IncomeEntry, PassbookLine } from './types'

describe('passbook', () => {
  it('classifies cash deposit, transfer in, withdraw, interest', () => {
    expect(classify({ desc: 'ฝากเงินสด', deposit: 100 })).toBe('deposit')
    expect(classify({ desc: 'รับโอนจาก K PLUS', deposit: 100 })).toBe('in')
    expect(classify({ desc: 'ถอนเงินสด', withdraw: 100 })).toBe('withdraw')
    expect(classify({ desc: 'ดอกเบี้ย', deposit: 5 })).toBe('other')
  })
  it('flags rows whose balance chain breaks', () => {
    const rows = [{ balance: 1000 }, { deposit: 500, balance: 1500 }, { withdraw: 200, balance: 1400 }, { deposit: 10, balance: 1410 }]
    expect(checkChain(rows)).toEqual([2])
  })
  it('drops overlapping lines already saved', () => {
    const a = { date: '2026-10-11', kind: 'deposit', amount: 5000, balance: 9000 }
    expect(dedupeLines([a], [a, { ...a, amount: 1 }])).toHaveLength(1)
  })
  it('re-scanning an old page plus new rows only adds the new rows (even if the kind was classified differently)', () => {
    const saved = [
      { date: '2026-10-02', kind: 'in', amount: 3200000, balance: 8738670 },
      { date: '2026-10-04', kind: 'in', amount: 1000, balance: 8739670 },
      { date: '2026-10-04', kind: 'deposit', amount: 526000, balance: 9323170 },
    ]
    const page = [
      { date: '2026-10-02', kind: 'deposit', amount: 3200000, balance: 8738670 },
      { date: '2026-10-04', kind: 'in', amount: 1000, balance: 8739670 },
      { date: '2026-10-04', kind: 'deposit', amount: 526000, balance: 9323170 },
      { date: '2026-10-05', kind: 'withdraw', amount: 350000, balance: 8973170 },
    ]
    expect(dedupeLines(saved, page).map((r) => r.date + r.amount)).toEqual(['2026-10-05350000'])
    expect([...dupIndexes(saved, page)]).toEqual([0, 1, 2])
  })
  it('keeps two identical real rows with different balances and rows without balance by count', () => {
    const two = [{ date: '2026-10-01', amount: 200000, balance: 5538670 }, { date: '2026-10-01', amount: 200000, balance: 5738670 }]
    expect(dedupeLines([], two)).toHaveLength(2)
    const nb = { date: '2026-10-01', amount: 100 }
    expect(dedupeLines([nb], [nb, nb])).toHaveLength(1)
  })
  it('reconciles a week: matches transfer to slip, reports closing balance', () => {
    const sun = '2026-10-11'
    const lines = [
      { id: 'a', updated: 1, date: '2026-10-11', kind: 'deposit', amount: 526000, balance: 1000000 },
      { id: 'b', updated: 1, date: '2026-10-09', kind: 'in', amount: 16900, balance: 600000 },
      { id: 'c', updated: 1, date: '2026-10-08', kind: 'in', amount: 55500, balance: 570000 },
      { id: 'd', updated: 1, date: '2026-10-12', kind: 'withdraw', amount: 283100, balance: 700000 },
    ] as PassbookLine[]
    const inc = [{ id: 'i1', updated: 1, date: '2026-10-08', amount: 16900, method: 'transfer', typeId: 't' }] as IncomeEntry[]
    const r = reconcileWeek(sun, lines, inc)
    expect(r.depositSum).toBe(526000)
    expect(r.matchedIn).toHaveLength(1)
    expect(r.unmatchedIn.map((l) => l.id)).toEqual(['c'])
    expect(r.withdraws).toHaveLength(0) // Monday withdrawal belongs to the next week
    expect(r.closing).toBe(1000000)
  })
})

// ข้อมูลจริงจากสมุดคู่ฝากธนาคารกรุงเทพที่ผู้ใช้ถ่ายมา (เลขบัญชีไม่เกี่ยวข้อง)
const REAL = [
  { code: 'NBD', amt: 476200, bal: 16068143 }, { code: 'W/D', amt: 9000000, bal: 7068143, wd: true },
  { code: 'TRD', amt: 5000, bal: 7073143 }, { code: 'TRD', amt: 30000, bal: 7103143 }, { code: 'TRD', amt: 95000, bal: 7198143 },
  { code: 'TRD', amt: 100027, bal: 7298170 }, { code: 'DEP', amt: 340500, bal: 7638670 }, { code: 'W/D', amt: 2500000, bal: 5138670, wd: true },
  { code: 'TRD', amt: 200000, bal: 5338670 }, { code: 'TRD', amt: 200000, bal: 5538670 }, { code: 'TRD', amt: 3200000, bal: 8738670 },
  { code: 'TRD', amt: 1000, bal: 8739670 }, { code: 'TRD', amt: 57500, bal: 8797170 }, { code: 'NBD', amt: 526000, bal: 9323170 }, { code: 'W/D', amt: 350000, bal: 8973170, wd: true },
]
describe('real passbook (Bangkok Bank codes)', () => {
  it('classifies by code', () => {
    const k = REAL.map((r) => classify({ code: r.code, deposit: r.wd ? 0 : r.amt, withdraw: r.wd ? r.amt : 0 }))
    expect(k).toEqual(['deposit', 'withdraw', 'in', 'in', 'in', 'in', 'deposit', 'withdraw', 'in', 'in', 'in', 'in', 'in', 'deposit', 'withdraw'])
  })
  it('fixes rows put in the wrong column using the balance chain and fills missing amounts', () => {
    // ผู้อ่านรูปใส่ทุกอย่างช่อง "ถอน" และบางบรรทัดไม่มีจำนวนเงิน
    const raw = REAL.map((r, i) => ({ withdraw: i % 4 === 3 ? undefined : r.amt, balance: r.bal }))
    const fixed = normalizeRows(raw)
    for (let i = 1; i < REAL.length; i++) {
      const want = REAL[i].wd ? { withdraw: REAL[i].amt } : { deposit: REAL[i].amt }
      expect(fixed[i]).toMatchObject(want)
    }
    expect(checkChain(fixed)).toEqual([])
  })
  it('reports the missing amount when a row is skipped', () => {
    const rows = [{ balance: 1000 }, { deposit: 100, balance: 1600 }]
    expect(chainGap(rows, 1)).toBe(500)
  })
})
