import { describe, expect, it } from 'vitest'
import { baseId, buildRows, monthSpans, sumBudget, sundaysOf } from './yearPlan'
import type { YearPlanRow } from './types'

describe('yearPlan', () => {
  it('วันอาทิตย์ทุกวันของปี 2027 ตั้งแต่ 3 ม.ค. ถึง 26 ธ.ค.', () => {
    const s = sundaysOf(2027)
    expect(s[0]).toBe('2027-01-03'); expect(s[s.length - 1]).toBe('2027-12-26'); expect(s).toHaveLength(52)
  })
  it('แถวเริ่มต้น = อาทิตย์ทุกวัน · แก้/ลบ/เพิ่มแถวได้ และเรียงตามวันที่', () => {
    const items: YearPlanRow[] = [
      { id: baseId('2027-01-10'), year: 2027, date: '2027-01-10', seq: 0, text: 'ประชุม', budget: '2,000', updated: 1 },
      { id: baseId('2027-01-17'), year: 2027, date: '2027-01-17', seq: 0, deleted: true, updated: 1 },
      { id: 'yp-x-a', year: 2027, date: '2027-01-08', seq: 5, text: 'ศุกร์พิเศษ', dayText: 'ศุกร์', updated: 1 },
    ]
    const r = buildRows(2027, items)
    expect(r).toHaveLength(52)
    expect(r.find((x) => x.date === '2027-01-17')).toBeUndefined()
    expect(r[1].text).toBe('ศุกร์พิเศษ'); expect(r[1].day).toBe('ศุกร์'); expect(r[1].base).toBe(false)
    expect(r[2].text).toBe('ประชุม'); expect(r[0].day).toBe('อาทิตย์')
  })
  it('แถวเดือนรวมช่องเดียว และรวมงบจากข้อความ', () => {
    const sp = monthSpans([{ month: 0 }, { month: 0 }, { month: 1 }, { month: 1 }, { month: 1 }])
    expect(sp).toEqual([2, 0, 3, 0, 0])
    expect(sumBudget(['2,000', '1,000 บาท', '', 'ฟรี'])).toBe(3000)
  })
})
