import { describe, expect, it } from 'vitest'
import { addNextDay, datesBetween, dateRowsFor, dayLabel, fitRows, moveAt, newTable } from './actTables'
import type { FundActivity } from './types'

const act = { id: 'a1', name: 'วันคริสต์มาส', date: '2026-12-21', endDate: '2026-12-25' } as FundActivity
describe('actTables', () => {
  it('ป้ายวัน', () => { expect(dayLabel('2026-12-21')).toBe('จ. 21'); expect(dayLabel('2026-12-25')).toBe('ศ. 25') })
  it('ช่วงวันที่', () => { expect(datesBetween('2026-12-21', '2026-12-25')).toHaveLength(5); expect(datesBetween('2026-12-21', undefined)).toEqual(['2026-12-21']); expect(datesBetween('2026-12-21', '2027-12-21', 7)).toHaveLength(7) })
  it('ตารางรายวันสร้างแถววันที่จากกิจกรรม', () => {
    const t = newTable('daily', act, 0, 't1')
    expect(t.cols).toHaveLength(4); expect(t.rows.map((r) => r.cells[0])).toEqual(['จ. 21', 'อ. 22', 'พ. 23', 'พฤ. 24', 'ศ. 25'])
  })
  it('ตารางเวที 3 คอลัมน์ และตารางว่าง', () => { expect(newTable('stage', act, 1, 't2').cols).toEqual(['เวลา', 'รายการ', 'ผู้รับผิดชอบ']); expect(newTable('free', act, 2, 't3').rows).toHaveLength(3) })
  it('ปรับจำนวนช่องตามคอลัมน์ · ย้ายลำดับ', () => {
    expect(fitRows([{ id: 'x', cells: ['a'] }], 3)[0].cells).toEqual(['a', '', ''])
    expect(fitRows([{ id: 'x', cells: ['a', 'b', 'c'] }], 2)[0].cells).toEqual(['a', 'b'])
    expect(moveAt([1, 2, 3], 0, 1)).toEqual([2, 1, 3]); expect(moveAt([1, 2], 0, -1)).toEqual([1, 2])
  })
  it('เพิ่มวันถัดไป และสร้างแถวตามช่วงที่กำหนดเอง', () => {
    const one = newTable('daily', { ...act, endDate: undefined }, 0, 't')
    expect(one.rows.map((r) => r.cells[0])).toEqual(['จ. 21'])
    const more = addNextDay(act, one.rows, 4)
    expect(more.map((r) => r.cells[0])).toEqual(['จ. 21', 'อ. 22'])
    const range = dateRowsFor(act, [], 4, '2026-12-21', '2026-12-25')
    expect(range.map((r) => r.date)).toEqual(['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25'])
  })
  it('สร้างแถววันที่ใหม่โดยคงข้อความเดิม', () => {
    const rows = dateRowsFor(act, [{ id: 'k', cells: ['เก่า', 'ซ้อม', '', ''] }], 4)
    expect(rows).toHaveLength(5); expect(rows[0].cells).toEqual(['จ. 21', 'ซ้อม', '', '']); expect(rows[0].id).toBe('k')
  })
})
