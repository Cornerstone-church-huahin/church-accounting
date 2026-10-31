import { describe, expect, it } from 'vitest'
import { applyAnswer, diffAnswer, findCandidates, nameVerdict, normName } from './memberImport'
import type { ChurchMember } from './types'

const m = { id: 'm1', updated: 1, name: 'วีรชัย ใจดี', nick: 'ชัย', tel: '081', birth: '1990-01-01' } as ChurchMember

describe('memberImport', () => {
  it('ตัดคำนำหน้า/วรรณยุกต์/ช่องว่างก่อนเทียบชื่อ', () => {
    expect(normName('นาย  วีรชัย ใจดี')).toBe(normName('วีรชัย ใจดี'))
    expect(nameVerdict('วีรชัย ใจดี', 'นาย วีรชัย ใจดี').level).toBe('same')
  })
  it('ชื่อสะกดต่างเล็กน้อย = minor · ต่างมาก = major', () => {
    expect(nameVerdict('วีรชัย ใจดี', 'วีระชัย ใจดี').level).toBe('minor')
    expect(nameVerdict('วีรชัย ใจดี', 'สมชาย แสนสุข').level).toBe('major')
  })
  it('ช่องที่ว่างจากสมาชิกไม่ถือว่าเปลี่ยน · ช่องใหม่ถูกนำเข้าเมื่อเลือก', () => {
    const a = { mid: 'm1', name: 'วีระชัย ใจดี', tel: '', lineId: 'wee', serve: ['ครัว / อาหาร / เครื่องดื่ม'] }
    const d = diffAnswer(m, a)
    expect(d.find((x) => x.key === 'name')?.changed).toBe(true)
    expect(d.find((x) => x.key === 'tel')?.changed).toBe(false)
    expect(d.find((x) => x.key === 'nick')?.changed).toBe(false)
    const out = applyAnswer(m, a, new Set(['name', 'lineId', 'serve', 'tel']))
    expect(out.name).toBe('วีระชัย ใจดี')
    expect(out.nameOrig).toBe('วีรชัย ใจดี')
    expect(out.tel).toBe('081')
    expect(out.lineId).toBe('wee')
    expect(out.serve).toEqual(['ครัว / อาหาร / เครื่องดื่ม'])
    expect(out.formAt).toBeTypeOf('number')
  })
  it('ไม่เลือกช่องไหน ช่องนั้นไม่เปลี่ยน', () => {
    expect(applyAnswer(m, { mid: 'm1', name: 'คนอื่น' }, new Set()).name).toBe('วีรชัย ใจดี')
  })
  it('จับคู่ชื่อจากลิงก์ทั่วไป: ชื่อใกล้เคียง + เบอร์/วันเกิดช่วยให้คะแนนสูงขึ้น', () => {
    const ms = [m, { id: 'm2', updated: 1, name: 'สมชาย แสนสุข', tel: '0899999999' } as ChurchMember, { id: 'm3', updated: 1, name: 'มาลี ดีใจ' } as ChurchMember]
    const c = findCandidates({ mid: 'by-name', name: 'วีระชัย ใจดี', tel: '081' }, ms)
    expect(c[0].m.id).toBe('m1')
    expect(c.some((x) => x.m.id === 'm3')).toBe(false)
    const byTel = findCandidates({ mid: 'by-name', name: 'สมชาย แสนสข', tel: '089-999-9999' }, ms)
    expect(byTel[0].m.id).toBe('m2')
    expect(byTel[0].reasons.join()).toContain('เบอร์โทรตรงกัน')
  })
})
