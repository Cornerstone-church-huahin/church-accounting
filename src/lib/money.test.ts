import { describe, expect, it } from 'vitest'
import { addDays, dow, fmtBaht, fmtDate, parseBaht, sundaysOf, weekStart } from './money'

describe('money', () => {
  it('parses and formats satang', () => {
    expect(parseBaht('1,234.50')).toBe(123450)
    expect(parseBaht('0.1')).toBe(10)
    expect(parseBaht('12.345')).toBeNaN()
    expect(parseBaht('abc')).toBeNaN()
    expect(fmtBaht(123450)).toBe('1,234.50')
    expect(fmtBaht(-5000, { dec: false })).toBe('−50')
  })
  it('handles Sunday-based weeks and Buddhist years', () => {
    expect(dow('2026-10-04')).toBe(0)
    expect(weekStart('2026-10-08')).toBe('2026-10-04')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(fmtDate('2026-10-04')).toBe('4 ต.ค. 69')
    expect(sundaysOf(2026)[0]).toBe('2026-01-04')
    expect(sundaysOf(2026).length).toBe(52)
  })
})
