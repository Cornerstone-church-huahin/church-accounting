import { describe, expect, it } from 'vitest'
import { dayKind, sundayOf, visitsOfWeek, visitsOn, weekDays, weekStats } from './visits'
import type { Visit } from './types'

const v = (id: string, date: string, memberId: string, visitor = 'คศ.กฤต', deleted = false): Visit => ({ id, date, memberId, memberName: memberId, reason: '', visitor, updated: 1, ...(deleted ? { deleted: true } : {}) })
describe('ตารางเยี่ยม', () => {
  it('สัปดาห์เริ่มวันอาทิตย์ 7 วัน: อาทิตย์นมัสการ จันทร์หยุด อังคาร–เสาร์เยี่ยม', () => {
    expect(sundayOf('2026-10-23')).toBe('2026-10-18') // ศุกร์
    expect(sundayOf('2026-10-18')).toBe('2026-10-18')
    const d = weekDays('2026-10-18')
    expect(d[0]).toBe('2026-10-18'); expect(d[6]).toBe('2026-10-24')
    expect(d.map(dayKind)).toEqual(['worship', 'off', 'visit', 'visit', 'visit', 'visit', 'visit'])
  })
  it('รายการของวัน/สัปดาห์ ไม่นับที่ลบ และนับสถิติ', () => {
    const xs = [v('1', '2026-10-20', 'a'), v('2', '2026-10-21', 'a', 'คศ.พิชิต'), v('3', '2026-10-22', 'b'), v('4', '2026-10-25', 'c'), v('5', '2026-10-20', 'd', 'x', true)]
    expect(visitsOn(xs, '2026-10-20').map((x) => x.id)).toEqual(['1'])
    const w = visitsOfWeek(xs, '2026-10-18')
    expect(w.map((x) => x.id)).toEqual(['1', '2', '3'])
    expect(weekStats(w)).toEqual({ count: 3, people: 2, visitors: ['คศ.กฤต', 'คศ.พิชิต'] })
  })
})

import { joinVisitors, splitVisitors, visitorRoster } from './visits'
describe('ผู้ออกเยี่ยมหลายคน', () => {
  it('แยก/รวมชื่อ และข้อมูลเดิมคนเดียวใช้ได้', () => {
    expect(splitVisitors('คศ.กฤต, อ.ดารา')).toEqual(['คศ.กฤต', 'อ.ดารา'])
    expect(splitVisitors('คศ.กฤต')).toEqual(['คศ.กฤต'])
    expect(joinVisitors(['ก', 'ข', 'ก', ' '])).toBe('ก, ข')
  })
  it('รายชื่อผู้ออกเยี่ยม = ทีม + ที่เพิ่ม − ที่ซ่อน', () => {
    expect(visitorRoster(['ก', 'ข'], [{ name: 'ค' }, { name: 'ข', hide: true }, { name: 'ง', deleted: true }, { name: 'ก' }])).toEqual(['ก', 'ค'])
  })
})
