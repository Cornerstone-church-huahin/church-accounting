import { describe, expect, it } from 'vitest'
import { reportText, serviceReport } from './serviceReport'
import type { CheckIn, ChurchMember } from './types'

const m = (id: string, name: string, status: string, gender?: 'ชาย' | 'หญิง', since = '2000-01-01'): ChurchMember => ({ id, name, status, gender, since, updated: 1 })
const ci = (date: string, mid: string, deleted = false): CheckIn => ({ id: `${date}_${mid}`, date, mid, updated: 1, ...(deleted ? { deleted: true } : {}) })
const members = [
  m('a', 'สมชาย', '1.สมบูรณ์ ( 1 )', 'ชาย'), m('b', 'สมหญิง', '2.สมบูรณ์ ( 2 )', 'หญิง'), m('c', 'สมศรี', '4.ผู้ร่วมนมัสการ', 'หญิง'),
  m('d', 'ดารา เผ่าดี', '5.คนใหม่', 'หญิง', '2026-10-18'), m('e', 'ไม่ระบุ', '3.สมาชิกสำรอง'), m('f', 'มาใหม่วันนี้', '4.ผู้ร่วมนมัสการ', 'ชาย', '2026-10-18'),
]
const day = '2026-10-18'

describe('สรุปผู้มานมัสการ', () => {
  const r = serviceReport([ci(day, 'a'), ci(day, 'b'), ci(day, 'c'), ci(day, 'd'), ci(day, 'e'), ci(day, 'f'), ci('2026-10-11', 'a'), ci(day, 'zz'), ci(day, 'b', true)], members, day)
  it('นับรวม เพศ สถานะ และไม่นับวันอื่น/รายการยกเลิก/คนที่ไม่อยู่ในทะเบียน', () => {
    expect(r.total).toBe(6)
    expect([r.male, r.female, r.noGender]).toEqual([2, 3, 1])
  })
  it('แยกสถานะโดยไม่นับคนมาใหม่ซ้ำ (รวมแล้วเท่ายอดทั้งหมด)', () => {
    expect([r.complete, r.reserve, r.worshiper, r.other]).toEqual([2, 1, 1, 0])
    expect(r.complete + r.reserve + r.worshiper + r.other + r.newcomers.length).toBe(r.total)
  })
  it('คนมาใหม่ = สถานะคนใหม่ หรือเริ่มมาวันนั้น พร้อมชื่อ', () => {
    expect(r.newcomers).toEqual(['ดารา เผ่าดี', 'มาใหม่วันนี้'])
  })
  it('ข้อความส่งต่อมีตัวเลขครบ', () => {
    const t = reportText(r)
    expect(t).toContain('ผู้เข้าร่วมทั้งหมด 6 คน')
    expect(t).toContain('ชาย 2 · หญิง 3 · ไม่ระบุเพศ 1')
    expect(t).toContain('คนมาใหม่ 2 คน: ดารา เผ่าดี, มาใหม่วันนี้')
  })
  it('วันที่ไม่มีใครมา', () => {
    expect(reportText(serviceReport([], members, day))).toContain('ผู้เข้าร่วมทั้งหมด 0 คน')
  })
})
