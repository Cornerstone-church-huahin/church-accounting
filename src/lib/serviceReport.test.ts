import { describe, expect, it } from 'vitest'
import { reportText, serviceReport } from './serviceReport'
import type { CheckIn, ChurchMember } from './types'

const m = (id: string, name: string, status: string, gender?: 'ชาย' | 'หญิง', since?: string): ChurchMember => ({ id, name, status, gender, ...(since ? { since } : {}), updated: 1 })
const ci = (date: string, mid: string, deleted = false): CheckIn => ({ id: `${date}_${mid}`, date, mid, updated: 1, ...(deleted ? { deleted: true } : {}) })
const members = [
  m('a', 'สมชาย', 'สมบูรณ์ ( 1 )', 'ชาย', '2000-01-01'),
  m('b', 'สมหญิง', 'สมบูรณ์ ( 2 )', 'หญิง', '2000-01-01'),
  m('c', 'สมศรี', 'ผู้ร่วมนมัสการ', 'หญิง', '2020-05-03'),
  m('d', 'ดารา เผ่าดี', 'คนใหม่', 'หญิง', '2026-09-27'), // สถานะคนใหม่ แต่มาแล้วหลายครั้ง = ไม่ใช่คนมาใหม่
  m('e', 'สมาชิกเก่า ไม่มีประวัติ', 'สมาชิกสำรอง', undefined, '2000-01-01'), // ทะเบียนเก่า แค่ระบบเพิ่งไม่มีประวัติ
  m('f', 'มาใหม่ มีวันเริ่ม', 'ผู้ร่วมนมัสการ', 'ชาย', '2026-10-18'),
  m('g', 'มาใหม่ ไม่มีวันเริ่ม', 'คนใหม่', 'หญิง'),
]
const day = '2026-10-18'
const rows = [
  ci(day, 'a'), ci(day, 'b'), ci(day, 'c'), ci(day, 'd'), ci(day, 'e'), ci(day, 'f'), ci(day, 'g'),
  ci('2026-10-11', 'a'), ci('2026-10-11', 'b'), ci('2026-10-11', 'c'), ci('2026-09-27', 'd'), ci('2026-10-11', 'd'), // d มาก่อนแล้ว
  ci('2026-10-25', 'f'), // วันหลังวันที่สรุป ไม่ทำให้ f เป็นคนเก่า
  ci(day, 'zz'), ci(day, 'b', true),
]

describe('สรุปผู้มานมัสการ', () => {
  const r = serviceReport(rows, members, day)
  it('นับรวม เพศ และไม่นับวันอื่น/รายการยกเลิก/คนที่ไม่อยู่ในทะเบียน', () => {
    expect(r.total).toBe(7)
    expect([r.male, r.female, r.noGender]).toEqual([2, 4, 1])
  })
  it('คนมาใหม่ = ลงชื่อครั้งแรกในระบบวันนั้น (ไม่ใช่แค่สถานะคนใหม่)', () => {
    expect(r.newcomers).toHaveLength(2)
    expect(r.newcomers).toEqual(expect.arrayContaining(['มาใหม่ ไม่มีวันเริ่ม', 'มาใหม่ มีวันเริ่ม']))
    expect(r.newcomers).not.toContain('ดารา เผ่าดี') // มาแล้ว 3 ครั้ง
  })
  it('สมาชิกเก่าที่ระบบเพิ่งไม่มีประวัติ ไม่นับเป็นคนใหม่', () => {
    expect(r.newcomers).not.toContain('สมาชิกเก่า ไม่มีประวัติ')
    expect(r.reserve).toBe(1)
  })
  it('แยกสถานะโดยไม่นับคนมาใหม่ซ้ำ (ผลรวมเท่ายอดทั้งหมด) · ดาราที่สถานะ คนใหม่แต่เคยมาแล้ว นับเป็นผู้ร่วมนมัสการ', () => {
    expect(r.complete + r.reserve + r.worshiper + r.other + r.newcomers.length).toBe(r.total)
    expect([r.complete, r.reserve, r.worshiper, r.other]).toEqual([2, 1, 2, 0])
  })
  it('ข้อความส่งต่อมีตัวเลขครบ', () => {
    const t = reportText(r)
    expect(t).toContain('ผู้เข้าร่วมทั้งหมด 7 คน')
    expect(t).toContain('ชาย 2 · หญิง 4 · ไม่ระบุเพศ 1')
    expect(t).toContain('คนมาใหม่ 2 คน: ')
    expect(t).toContain('มาใหม่ มีวันเริ่ม')
  })
  it('วันที่ไม่มีใครมา', () => {
    expect(reportText(serviceReport([], members, day))).toContain('ผู้เข้าร่วมทั้งหมด 0 คน')
  })
})
