import { describe, expect, it } from 'vitest'
import { monthPages, shiftMonth, shortThaiDate, sundaysOfMonth } from './foodRoster'

describe('ตารางถวายอาหาร: วันอาทิตย์ของเดือน', () => {
  it('ตุลาคม 2569 = 4 11 18 25 · พฤศจิกายน 2569 = 1 8 15 22 29 (5 วัน)', () => {
    expect(sundaysOfMonth(2026, 10)).toEqual(['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'])
    expect(sundaysOfMonth(2026, 11)).toEqual(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'])
  })
  it('ทุกวันที่ที่ได้เป็นวันอาทิตย์ และอยู่ในเดือนนั้นทั้งปี', () => {
    for (let m = 1; m <= 12; m++) for (const d of sundaysOfMonth(2027, m)) { expect(new Date(d + 'T00:00:00Z').getUTCDay()).toBe(0); expect(Number(d.slice(5, 7))).toBe(m) }
  })
  it('แผ่นละ 2 เดือนต่อเนื่องข้ามปี และเดือนสุดท้ายเดี่ยวได้', () => {
    expect(monthPages({ y: 2026, m: 11 }, 4)).toEqual([[{ y: 2026, m: 11 }, { y: 2026, m: 12 }], [{ y: 2027, m: 1 }, { y: 2027, m: 2 }]])
    expect(monthPages({ y: 2026, m: 10 }, 3)).toHaveLength(2)
    expect(shiftMonth({ y: 2026, m: 12 }, 1)).toEqual({ y: 2027, m: 1 })
  })
  it('รูปแบบวันที่แบบเขียนมือ 4/10/69', () => { expect(shortThaiDate('2026-10-04')).toBe('4/10/69') })
})
