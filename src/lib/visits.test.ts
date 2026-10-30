import { describe, expect, it } from 'vitest'
import { metVisits, notMetVisits, timesVisited, dayKind, sundayOf, tripNumbers, tripsOf, visitsOfWeek, visitsOn, weekDays, weekStats } from './visits'
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
    expect(weekStats(w)).toEqual({ count: 3, trips: 3, people: 2, notMet: 0, visitors: ['คศ.กฤต', 'คศ.พิชิต'] })
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

describe('ครั้งที่ออกเยี่ยม (บ้านใกล้กันนับครั้งเดียว)', () => {
  const at = (id: string, date: string, lat: number, t: number) => ({ ...v(id, date, id), checkin: { lat, lng: 99.9577, at: t } })
  it('วันเดียวกัน จุดเช็คอินห่างกันไม่เกิน 300 ม. (ต่อเนื่องกันได้) = ครั้งเดียว · ไกลกว่า/คนละวัน/ไม่มีเช็คอิน = แยกครั้ง', () => {
    const xs = [at('a', '2026-10-29', 12.5684, 1), at('b', '2026-10-29', 12.5700, 2), at('c', '2026-10-29', 12.5720, 3), at('far', '2026-10-29', 12.6, 4), at('d2', '2026-10-30', 12.5684, 5), v('old', '2026-10-29', 'old')]
    // a–b ≈ 178 ม., b–c ≈ 222 ม. → a,b,c ต่อเนื่องกัน (a–c ≈ 400 ม. แต่ผ่าน b)
    expect(tripsOf(xs).map((g) => g.map((x) => x.id))).toEqual([['a', 'b', 'c'], ['old'], ['far'], ['d2']])
    expect(tripNumbers(xs).get('c')).toBe(1); expect(tripNumbers(xs).get('far')).toBe(3)
    expect(weekStats(xs)).toMatchObject({ count: 6, trips: 4 })
  })
  it('ไปแล้วไม่พบ: นับเป็นการเดินทาง (ครั้ง/เช็คอิน) แต่ไม่นับเป็นการถูกเยี่ยม', () => {
    const at = { lat: 12.5, lng: 99.9, at: 1 }
    const vs = [
      { id: 'a', date: '2026-10-30', memberId: 'm1', memberName: 'ก', reason: '', visitor: 'x', checkin: at, updated: 1 },
      { id: 'b', date: '2026-10-30', memberId: 'm2', memberName: 'ข', reason: '', visitor: 'x', checkin: at, absent: true, updated: 2 },
      { id: 'c', date: '2026-11-02', memberId: 'm2', memberName: 'ข', reason: '', visitor: 'x', updated: 3 },
    ] as never[]
    expect(weekStats(vs)).toMatchObject({ count: 3, trips: 2, people: 2, notMet: 1 })
    expect(tripsOf(vs)[0].map((v) => v.id)).toEqual(['a', 'b']) // ไม่พบก็อยู่ในเส้นทางเดียวกัน
    expect(metVisits(vs).length).toBe(2); expect(notMetVisits(vs).map((v) => v.id)).toEqual(['b'])
    expect(timesVisited(vs, 'm2')).toBe(1); expect(timesVisited(vs, 'm1')).toBe(1)
  })
})
