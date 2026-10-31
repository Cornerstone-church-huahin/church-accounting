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
  it('ไม่ได้กำหนดห้อง: ผู้ใช้ทั่วไปไม่เห็นห้องใดเลย · ห้องที่ยังไม่มีชื่อ (15–18) เห็นเฉพาะแอดมิน', () => {
    expect(visibleWorks([], { all: false, admin: false })).toEqual([])
    expect(visibleWorks([], { all: true, admin: true }).length).toBe(18)
    expect(visibleWorks([], { all: true, admin: false }).map((t) => t.n)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1))
    expect(visibleWorks([2, 16], { all: false, admin: false }).map((t) => t.n)).toEqual([2])
    expect(visibleWorks([2, 16], { admin: true }).map((t) => t.n)).toEqual([2, 16])
  })
})
