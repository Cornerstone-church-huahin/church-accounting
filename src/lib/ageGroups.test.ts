import { describe, expect, it } from 'vitest'
import { defaultRules, effectiveRules, isUnassigned, needsGender, proposeRegroup, ruleWarnings, targetGroup } from './ageGroups'
import type { ChurchMember } from './types'

const groups = ['1.เด็กรวี', '2.อนุชน', '3.วัยทำงาน', '4.บุรุษ', '5.สตรี', '6.ผู้สูงวัย', '7.คณะกรรมการ']
const rules = defaultRules(groups)
const m = (o: Partial<ChurchMember>) => ({ id: 'x', updated: 1, name: 'ก', status: '1.สมบูรณ์ ( 1 )', ...o }) as ChurchMember
const T = '2026-10-31'

describe('ageGroups', () => {
  it('กติกาตั้งต้นตามช่วงวัยของคริสตจักร · กลุ่มพิเศษไม่มีกติกา', () => {
    expect(rules.map((r) => [r.group, r.from, r.to, r.gender ?? '', r.on])).toEqual([
      ['1.เด็กรวี', 2, 12, '', true], ['2.อนุชน', 13, 24, '', true], ['3.วัยทำงาน', 25, 39, '', true], ['4.บุรุษ', 40, 59, 'ชาย', true], ['5.สตรี', 40, 59, 'หญิง', true], ['6.ผู้สูงวัย', 60, 200, '', true],
    ])
  })
  it('ทะเบียนยังไม่มีกลุ่มเลย → ใช้ชื่อมาตรฐานตามที่กำหนด · มีแค่บางกลุ่ม → ใช้ชื่อเดิมของกลุ่มที่มี ที่เหลือใช้ชื่อมาตรฐาน', () => {
    expect(defaultRules([]).map((r) => r.group)).toEqual(['เด็กรวี', 'อนุชน', 'วัยทำงาน', 'บุรุษ', 'สตรี', 'ผู้สูงวัย'])
    expect(defaultRules(['4.สตรี', '3.บรุษ']).map((r) => r.group)).toEqual(['เด็กรวี', 'อนุชน', 'วัยทำงาน', '3.บรุษ', '4.สตรี', 'ผู้สูงวัย'])
    // ไม่มีกลุ่ม “ผู้สูงวัย” ในทะเบียน → เสนอย้ายคนอายุ 60+ ไปกลุ่มชื่อมาตรฐาน
    const r = defaultRules(['4.สตรี'])
    expect(targetGroup(m({ birth: '1960-01-01', group: '4.สตรี', gender: 'หญิง' }), r, T)?.group).toBe('ผู้สูงวัย')
  })
  it('จัดตามอายุ (วัยทำงานไม่แยกเพศ · บุรุษ/สตรีแยกเพศ)', () => {
    const g = (o: Partial<ChurchMember>) => targetGroup(m(o), rules, T)?.group
    expect(g({ birth: '2018-01-01', group: '3.วัยทำงาน' })).toBe('1.เด็กรวี')        // 8 ปี
    expect(g({ birth: '2008-09-09', group: '5.สตรี', gender: 'หญิง' })).toBe('2.อนุชน')   // 18 ปี
    expect(g({ birth: '1995-01-01', group: '2.อนุชน' })).toBe('3.วัยทำงาน')            // 31 ปี ไม่ต้องทราบเพศ
    expect(g({ birth: '1980-01-01', group: '3.วัยทำงาน', gender: 'ชาย' })).toBe('4.บุรุษ')   // 46
    expect(g({ birth: '1980-01-01', group: '3.วัยทำงาน', gender: 'หญิง' })).toBe('5.สตรี')
    expect(g({ birth: '1960-01-01', group: '5.สตรี', gender: 'หญิง' })).toBe('6.ผู้สูงวัย')  // 66
  })
  it('ขอบช่วงอายุตามวันจริง: ครบ 13 / 25 / 40 / 60 ปีวันนี้', () => {
    const g = (b: string, gender?: 'ชาย') => targetGroup(m({ birth: b, gender }), rules, T)?.group
    expect(g('2013-10-31')).toBe('2.อนุชน')
    expect(g('2013-11-01')).toBe('1.เด็กรวี')
    expect(g('2001-10-31')).toBe('3.วัยทำงาน')
    expect(g('1986-10-31', 'ชาย')).toBe('4.บุรุษ')
    expect(g('1986-11-01', 'ชาย')).toBe('3.วัยทำงาน')
    expect(g('1966-10-31')).toBe('6.ผู้สูงวัย')
  })
  it('ไม่แตะ: ไม่มีวันเกิด · ล็อกกลุ่ม · กลุ่มพิเศษ · ทารกต่ำกว่า 2 ปี · วัย 40–59 ที่ไม่ทราบเพศ', () => {
    expect(targetGroup(m({ group: '5.สตรี' }), rules, T)).toBeNull()
    expect(targetGroup(m({ birth: '1990-01-01', group: '2.อนุชน', groupLock: true }), rules, T)).toBeNull()
    expect(targetGroup(m({ birth: '1990-01-01', group: '7.คณะกรรมการ' }), rules, T)).toBeNull()
    expect(targetGroup(m({ birth: '2025-06-01', group: '1.เด็กรวี' }), rules, T)).toBeNull()   // 1 ปี ยังไม่เข้ารวี
    expect(targetGroup(m({ birth: '1980-01-01', group: '4.บุรุษ' }), rules, T)).toBeNull()   // 46 ปี ไม่ทราบเพศ
  })
  it('คนที่ยังไม่มีกลุ่มก็จัดให้', () => {
    expect(targetGroup(m({ birth: '2001-10-31' }), rules, T)?.group).toBe('3.วัยทำงาน')
  })
  it('เสนอจัดกลุ่ม: เฉพาะคนที่กลุ่มไม่ตรง และไม่รวมเสียชีวิต/ลาออก', () => {
    const list = [
      m({ id: 'a', birth: '2008-09-09', group: '5.สตรี', gender: 'หญิง' }),
      m({ id: 'b', birth: '1980-01-01', group: '4.บุรุษ', gender: 'ชาย' }),
      m({ id: 'c', birth: '2008-09-09', group: '5.สตรี', gender: 'หญิง', status: '7.เสียชีวิต' }),
    ]
    expect(proposeRegroup(list, rules, T).map((x) => [x.m.id, x.from, x.to, x.age])).toEqual([['a', '5.สตรี', '2.อนุชน', 18]])
  })
  it('effectiveRules: กลุ่มใหม่ที่ยังไม่มีกติกาใช้ค่าเดา · ที่บันทึกไว้แล้วใช้ตามที่บันทึก', () => {
    const saved = [{ group: '2.อนุชน', from: 13, to: 30, on: true }]
    const e = effectiveRules(saved, groups)
    expect(e.find((r) => r.group === '2.อนุชน')?.to).toBe(30)
    expect(e.find((r) => r.group === '1.เด็กรวี')?.to).toBe(12)
  })
  it('กลุ่ม “7.ไม่มีกลุ่ม” = ยังไม่มีกลุ่ม → จัดให้ตามอายุได้ (ไม่ใช่กลุ่มพิเศษ)', () => {
    expect(isUnassigned('7.ไม่มีกลุ่ม')).toBe(true)
    expect(isUnassigned('')).toBe(true)
    expect(isUnassigned('7.คณะกรรมการ')).toBe(false)
    expect(targetGroup(m({ birth: '2016-05-01', group: '7.ไม่มีกลุ่ม' }), rules, T)?.group).toBe('1.เด็กรวี')   // 10 ปี
    expect(proposeRegroup([m({ id: 'k', birth: '2014-03-03', group: '7.ไม่มีกลุ่ม' })], rules, T).map((p) => [p.from, p.to])).toEqual([['7.ไม่มีกลุ่ม', '1.เด็กรวี']])
  })
  it('วัย 40–59 ที่ไม่ทราบเพศ: จัดบุรุษ/สตรีไม่ได้ → แจ้งว่าต้องรู้เพศ', () => {
    expect(needsGender(m({ birth: '1980-01-01', group: '7.ไม่มีกลุ่ม' }), rules, T)).toBe(true)
    expect(needsGender(m({ birth: '1980-01-01', gender: 'ชาย' }), rules, T)).toBe(false)
    expect(needsGender(m({ birth: '1995-01-01' }), rules, T)).toBe(false)   // วัยทำงานไม่ต้องใช้เพศ
  })
  it('คำเตือนกติกา: ซ้อนทับ/ช่องว่าง (กติกามาตรฐานไม่มีคำเตือน)', () => {
    expect(ruleWarnings(rules)).toEqual([])
    const overlap = rules.map((r) => (r.group === '2.อนุชน' ? { ...r, to: 30 } : r))
    expect(ruleWarnings(overlap).join(' ')).toContain('ซ้อนกับ')
    const gap = rules.map((r) => (r.group === '3.วัยทำงาน' ? { ...r, from: 28 } : r))
    expect(ruleWarnings(gap).join(' ')).toContain('อายุ 25–27 ปี ไม่มีกลุ่มรับ')
    const noWomen = rules.map((r) => (r.group === '5.สตรี' ? { ...r, on: false } : r))
    expect(ruleWarnings(noWomen).join(' ')).toContain('เพศหญิง: อายุ 40–59 ปี ไม่มีกลุ่มรับ')
  })
})
