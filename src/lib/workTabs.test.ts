import { describe, expect, it } from 'vitest'
import { visibleWorks, workHomePath } from './workTabs'

describe('ปุ่ม ‹ ทุกแท็บ ตามงานที่รับผิดชอบ', () => {
  it('แอดมิน/ไม่ได้กำหนด → หน้าเลือกงาน · งานเดียว → หน้าหลักของงานนั้น', () => {
    expect(workHomePath([])).toBe('/meeting')
    expect(workHomePath([1])).toBe('/meeting/1')
    expect(workHomePath([9])).toBe('/meeting/9')
    expect(workHomePath([1, 9])).toBe('/meeting')
  })
  it('หน้าเลือกงานแสดงเฉพาะงานของตน (ไม่ได้กำหนด = ทุกงาน)', () => {
    expect(visibleWorks([]).length).toBe(12)
    expect(visibleWorks([9, 1]).map((t) => t.n)).toEqual([1, 9])
  })
})
