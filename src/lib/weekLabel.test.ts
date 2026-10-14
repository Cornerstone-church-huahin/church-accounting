import { describe, expect, it } from 'vitest'
import { weekRange, weekTitle } from './money'

describe('week labels (อาทิตย์ที่ N ของเดือน · ระหว่างวันที่)', () => {
  it('numbers Sundays by day of month, ranges run Monday–Sunday', () => {
    expect(weekTitle('2026-10-04')).toBe('อาทิตย์ที่ 1 ของเดือนตุลาคม 2569')
    expect(weekRange('2026-10-04')).toBe('28 ก.ย. – 4 ต.ค. 69')
    expect(weekTitle('2026-10-11')).toBe('อาทิตย์ที่ 2 ของเดือนตุลาคม 2569')
    expect(weekRange('2026-10-11')).toBe('5–11 ต.ค. 69')
    expect(weekTitle('2026-10-18')).toBe('อาทิตย์ที่ 3 ของเดือนตุลาคม 2569')
    expect(weekRange('2026-10-18')).toBe('12–18 ต.ค. 69')
    expect(weekTitle('2026-10-25')).toBe('อาทิตย์ที่ 4 ของเดือนตุลาคม 2569')
    expect(weekRange('2026-10-25')).toBe('19–25 ต.ค. 69')
    expect(weekTitle('2026-11-01')).toBe('อาทิตย์ที่ 1 ของเดือนพฤศจิกายน 2569')
    expect(weekRange('2026-11-01')).toBe('26 ต.ค. – 1 พ.ย. 69')
  })
})
