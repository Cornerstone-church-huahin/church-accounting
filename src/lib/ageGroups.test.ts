import { describe, expect, it } from 'vitest'
import { defaultRules, effectiveRules, proposeRegroup, targetGroup } from './ageGroups'
import type { ChurchMember } from './types'

const groups = ['1.เด็ก', '2.เยาวชน', '3.บุรุษ', '4.สตรี', '5.ผู้สูงอายุ', '6.คณะกรรมการ']
const rules = defaultRules(groups)
const m = (o: Partial<ChurchMember>) => ({ id: 'x', updated: 1, name: 'ก', status: '1.สมบูรณ์ ( 1 )', ...o }) as ChurchMember

describe('ageGroups', () => {
  it('เดากติกาตั้งต้นจากชื่อกลุ่ม · ผู้สูงอายุปิดไว้ · กลุ่มพิเศษไม่มีกติกา', () => {
    expect(rules.map((r) => [r.group, r.from, r.to, r.gender ?? '', r.on])).toEqual([
      ['1.เด็ก', 0, 12, '', true], ['2.เยาวชน', 13, 24, '', true], ['3.บุรุษ', 25, 200, 'ชาย', true], ['4.สตรี', 25, 200, 'หญิง', true], ['5.ผู้สูงอายุ', 60, 200, '', false],
    ])
  })
  it('จัดตามอายุ+เพศ · เกิดปี 2008 อายุ 18 → เยาวชน · ชายอายุ 40 → บุรุษ', () => {
    expect(targetGroup(m({ birth: '2008-09-09', group: '4.สตรี', gender: 'หญิง' }), rules, '2026-10-31')?.group).toBe('2.เยาวชน')
    expect(targetGroup(m({ birth: '1986-01-01', group: '2.เยาวชน', gender: 'ชาย' }), rules, '2026-10-31')?.group).toBe('3.บุรุษ')
    expect(targetGroup(m({ birth: '2020-01-01', group: '4.สตรี' }), rules, '2026-10-31')?.group).toBe('1.เด็ก')
  })
  it('ไม่แตะ: ไม่มีวันเกิด · ล็อกกลุ่ม · กลุ่มพิเศษ · ไม่ทราบเพศของวัยผู้ใหญ่', () => {
    expect(targetGroup(m({ group: '4.สตรี' }), rules, '2026-10-31')).toBeNull()
    expect(targetGroup(m({ birth: '1990-01-01', group: '2.เยาวชน', gender: 'ชาย', groupLock: true }), rules, '2026-10-31')).toBeNull()
    expect(targetGroup(m({ birth: '1990-01-01', group: '6.คณะกรรมการ', gender: 'ชาย' }), rules, '2026-10-31')).toBeNull()
    expect(targetGroup(m({ birth: '1990-01-01', group: '3.บุรุษ' }), rules, '2026-10-31')).toBeNull()
  })
  it('คนที่ยังไม่มีกลุ่มก็จัดให้ · อายุข้ามช่วงตามวันที่จริง (วันเกิดครบ 25 ปีวันนี้)', () => {
    expect(targetGroup(m({ birth: '2001-10-31', gender: 'ชาย' }), rules, '2026-10-31')?.group).toBe('3.บุรุษ')
    expect(targetGroup(m({ birth: '2001-11-01', gender: 'ชาย' }), rules, '2026-10-31')?.group).toBe('2.เยาวชน')
  })
  it('เปิดกติกาผู้สูงอายุ → 60+ ไปกลุ่มนั้น (เฉพาะที่กติกาเฉพาะเพศน้อยกว่า = เฉพาะเจาะจงกว่าชนะ)', () => {
    const r = rules.map((x) => (x.group === '5.ผู้สูงอายุ' ? { ...x, on: true } : x))
    expect(targetGroup(m({ birth: '1950-01-01', group: '4.สตรี', gender: 'หญิง' }), r, '2026-10-31')?.group).toBe('4.สตรี')   // กติกามีเพศชนะ
    expect(targetGroup(m({ birth: '1950-01-01', group: '5.ผู้สูงอายุ' }), r, '2026-10-31')?.group).toBe('5.ผู้สูงอายุ')   // ไม่ทราบเพศ → ผู้สูงอายุ
  })
  it('เสนอจัดกลุ่ม: เฉพาะคนที่กลุ่มไม่ตรง และไม่รวมเสียชีวิต/ลาออก', () => {
    const list = [
      m({ id: 'a', birth: '2008-09-09', group: '4.สตรี', gender: 'หญิง' }),
      m({ id: 'b', birth: '1986-01-01', group: '3.บุรุษ', gender: 'ชาย' }),
      m({ id: 'c', birth: '2008-09-09', group: '4.สตรี', gender: 'หญิง', status: '7.เสียชีวิต' }),
    ]
    const p = proposeRegroup(list, rules, '2026-10-31')
    expect(p.map((x) => [x.m.id, x.from, x.to, x.age])).toEqual([['a', '4.สตรี', '2.เยาวชน', 18]])
  })
  it('effectiveRules: กลุ่มใหม่ที่ยังไม่มีกติกาใช้ค่าเดา · ที่บันทึกไว้แล้วใช้ตามที่บันทึก', () => {
    const saved = [{ group: '2.เยาวชน', from: 13, to: 30, on: true }]
    const e = effectiveRules(saved, groups)
    expect(e.find((r) => r.group === '2.เยาวชน')?.to).toBe(30)
    expect(e.find((r) => r.group === '1.เด็ก')?.to).toBe(12)
  })
})
