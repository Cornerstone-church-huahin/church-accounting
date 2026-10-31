import { describe, expect, it } from 'vitest'
import { lastSunday, weekDates } from './attendanceWeeks'

describe('attendanceWeeks', () => {
  it('วันอาทิตย์ล่าสุดไม่เกินวันที่ให้', () => {
    expect(lastSunday('2026-10-31')).toBe('2026-10-25')
    expect(lastSunday('2026-10-25')).toBe('2026-10-25')
  })
  it('รายการอาทิตย์: เรียงเก่า → ใหม่ รวมวันที่มีบันทึก + ย้อนหลังทุกอาทิตย์ + วันนี้ ไม่ซ้ำ', () => {
    const w = weekDates(['2026-10-18', '2026-03-04'], '2026-10-31', 3)
    expect(w).toEqual(['2026-03-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-10-31'])
  })
})
