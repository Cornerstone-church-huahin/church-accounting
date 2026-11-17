import { describe, expect, it } from 'vitest'
import { applyScanRange, inScan, rangeOfWeeks, weekCounts } from './scanRange'

describe('scanRange', () => {
  it('rangeOfWeeks: สัปดาห์เดียวและหลายสัปดาห์ (สลับลำดับได้)', () => {
    expect(rangeOfWeeks('2026-11-22', '2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    expect(rangeOfWeeks('2026-11-29', '2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-29' })
  })
  it('inScan: วันที่อ่านไม่ออกถือว่าอยู่ในช่วง', () => {
    expect(inScan('2026-11-16', '2026-11-16', '2026-11-22')).toBe(true)
    expect(inScan('2026-11-23', '2026-11-16', '2026-11-22')).toBe(false)
    expect(inScan('', '2026-11-16', '2026-11-22')).toBe(true)
  })
  it('weekCounts นับแยกสัปดาห์ ใหม่ก่อน', () => {
    expect(weekCounts(['2026-11-16', '2026-11-17', '2026-11-12', ''])).toEqual([{ sunday: '2026-11-22', n: 2 }, { sunday: '2026-11-15', n: 1 }])
  })
  it('applyScanRange เติม/ตัดตามช่วงใหม่ ไม่ซ้ำ', () => {
    const same = (a: { date: string; v: number }, b: { date: string; v: number }) => a.date === b.date && a.v === b.v
    const pool = [{ date: '2026-11-12', v: 1 }, { date: '2026-11-17', v: 2 }, { date: '2026-11-25', v: 3 }]
    const d1 = applyScanRange([], pool, '2026-11-16', '2026-11-22', same)
    expect(d1.map((x) => x.v)).toEqual([2])
    const d2 = applyScanRange(d1, pool, '2026-11-09', '2026-11-22', same)
    expect(d2.map((x) => x.v)).toEqual([2, 1])
    const d3 = applyScanRange(d2, pool, '2026-11-16', '2026-11-30', same)
    expect(d3.map((x) => x.v)).toEqual([2, 3])
  })
})
