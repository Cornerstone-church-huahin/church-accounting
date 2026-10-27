import { describe, expect, it } from 'vitest'
import { visibleWorks, workHomePath } from './workTabs'

describe('ปุ่ม ‹ หน้าแรก ในหัวของทุกงาน', () => {
  it('ทุกบทบาท ทุกงาน → หน้าแรก', () => {
    for (const w of [[], [1], [9], [1, 9]]) expect(workHomePath(w)).toBe('/')
  })
  it('หน้าเลือกงานแสดงเฉพาะงานของตน (ไม่ได้กำหนด = ทุกงาน)', () => {
    expect(visibleWorks([]).length).toBe(18)
    expect(visibleWorks([9, 1]).map((t) => t.n)).toEqual([1, 9])
  })
})
