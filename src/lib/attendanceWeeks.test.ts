import { describe, expect, it } from 'vitest'
import { lastSunday, orderedAttendees, weekDates } from './attendanceWeeks'

describe('attendanceWeeks', () => {
  it('วันอาทิตย์ล่าสุดไม่เกินวันที่ให้', () => {
    expect(lastSunday('2026-10-31')).toBe('2026-10-25')
    expect(lastSunday('2026-10-25')).toBe('2026-10-25')
  })
  it('รายการอาทิตย์: เรียงเก่า → ใหม่ รวมวันที่มีบันทึก + ย้อนหลังทุกอาทิตย์ + วันนี้ ไม่ซ้ำ', () => {
    const w = weekDates(['2026-10-18', '2026-03-04'], '2026-10-31', 3)
    expect(w).toEqual(['2026-03-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-10-31'])
  })
  it('ลำดับที่มา: ไม่มีเวลา (นำเข้าเดิม) ก่อน แล้วเรียงตามเวลาที่ลง · เลขลำดับเริ่ม 1', () => {
    const cks = [
      { date: 'd', mid: 'b', updated: 200, tm: '09:10', rec: 'ก' },
      { date: 'd', mid: 'c', updated: 300, tm: '09:20', rec: 'ข' },
      { date: 'd', mid: 'a', updated: 100, tm: '09:00', rec: 'ก' },
      { date: 'd', mid: 'x', updated: 50, tm: '08:00', deleted: true },
    ]
    const r = orderedAttendees(['c', 'old', 'a', 'b'], 'd', cks)
    expect(r.map((x) => [x.id, x.no])).toEqual([['old', 1], ['a', 2], ['b', 3], ['c', 4]])
    expect(r[3].rec).toBe('ข')
  })
})
