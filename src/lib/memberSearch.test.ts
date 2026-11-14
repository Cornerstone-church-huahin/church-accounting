import { describe, expect, it } from 'vitest'
import { normThai, searchMembers } from './memberSearch'
import type { ChurchMember } from './types'

const m = (id: string, name: string, nick = '', extra: Partial<ChurchMember> = {}): ChurchMember => ({ id, name, nick, updated: 0, ...extra } as ChurchMember)
const all = [m('1', 'วรรณกร อ่อนสุวรรณ', 'น้อย'), m('2', 'สมศรี อ่อนสุวรรณ', 'ศรี'), m('3', 'จินดา คอยชื่น', 'น้อย'), m('4', 'ธนา ใจดี', 'ต้อง')]
describe('memberSearch', () => {
  it('ค้นด้วยชื่อ นามสกุล ชื่อเล่น และสลับลำดับได้', () => {
    expect(searchMembers(all, 'อ่อนสุวรรณ วรรณกร').direct.map((x) => x.id)).toEqual(['1'])
    expect(searchMembers(all, 'น้อย').direct.map((x) => x.id)).toEqual(['1', '3'])
  })
  it('ทนการสะกดผิด (วรรณยุกต์ ศ/ส ธ/ท ใ/ไ)', () => {
    expect(normThai('ศรี')).toBe(normThai('สรี'))
    expect(searchMembers(all, 'อ่อนสุวรรน').direct.length).toBe(2) // ณ/น ถือว่าเหมือนกัน
    expect(searchMembers(all, 'วรรณกร').related.map((x) => x.id)).toEqual(['2']) // นามสกุลเดียวกัน
    expect(searchMembers(all, 'ทนา').direct.map((x) => x.id)).toEqual(['4'])
    expect(searchMembers(all, 'ไจดี').direct.map((x) => x.id)).toEqual(['4'])
  })
})
