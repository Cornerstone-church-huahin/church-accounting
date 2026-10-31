import { describe, expect, it } from 'vitest'
import { defaultTerm, termStatus, thaiShort, ymd } from './workTerm'
describe('วาระงาน', () => {
  it('ค่าตั้งต้น 1 ม.ค. ปีหน้า ถึง 31 ธ.ค. อีกปี', () => { expect(defaultTerm('2026-10-31')).toEqual({ start: '2027-01-01', end: '2028-12-31' }) })
  it('ปี เดือน วัน', () => {
    expect(ymd('2027-01-01', '2029-01-01')).toEqual({ years: 2, months: 0, days: 0 })
    expect(ymd('2026-10-31', '2027-01-01')).toEqual({ years: 0, months: 2, days: 1 })
  })
  it('สถานะ', () => {
    const t = { start: '2027-01-01', end: '2028-12-31' }
    expect(termStatus(t, '2026-10-31').kind).toBe('before')
    const a = termStatus(t, '2027-01-01'); expect(a.kind).toBe('active'); expect(a.left).toEqual({ years: 2, months: 0, days: 0 })
    expect(termStatus(t, '2029-02-01').kind).toBe('ended')
  })
  it('วันที่ไทย', () => { expect(thaiShort('2027-01-01')).toBe('1 ม.ค. 2570') })
})
