import { describe, expect, it } from 'vitest'
import { applyAnswer, diffAnswer, findCandidates, guessDateFromNote, nameVerdict, normName, spanText, withNoteGuess } from './memberImport'
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
  it('อ่านวันที่จากหมายเหตุหลายรูปแบบ (พ.ศ./ค.ศ. เดาจากตัวเลข)', () => {
    const t = '2026-10-31'
    expect(guessDateFromNote('เป็นสมาชิกวันที่1ตค2014', t)).toMatchObject({ iso: '2014-10-01', yearOnly: false })
    expect(guessDateFromNote('มาครั้งแรก 1 ต.ค. 57', t)?.iso).toBe('2014-10-01')
    expect(guessDateFromNote('มาตั้งแต่ 15 มกราคม 2540', t)?.iso).toBe('1997-01-15')
    expect(guessDateFromNote('วันที่ 3/9/2557', t)?.iso).toBe('2014-09-03')
    expect(guessDateFromNote('Oct 5 2010', t)).toBeNull()   // รูปแบบเดือนนำหน้าไม่รองรับ → ไม่เดา
    expect(guessDateFromNote('5 Oct 2010', t)?.iso).toBe('2010-10-05')
    expect(guessDateFromNote('ตั้งแต่ปี 2557', t)).toMatchObject({ iso: '2014-01-01', yearOnly: true })
    expect(guessDateFromNote('ย้ายมาเดือนหน้า', t)).toBeNull()
    expect(guessDateFromNote('1 ต.ค. 2570', t)).toBeNull()   // อนาคตไม่เอา
    expect(guessDateFromNote('', t)).toBeNull()
  })
  it('หมายเหตุช่วยเติม “มาครั้งแรก” เท่านั้น ไม่แตะวันรับเป็นสมาชิก · ที่สมาชิกกรอกเองมาก่อน', () => {
    const mm = { ...m, since: '2022-12-11' } as ChurchMember
    const g = withNoteGuess(mm, { mid: 'm1', name: 'x', note: 'เป็นสมาชิกวันที่1ตค2014' })
    expect(g.a.first).toBe('2014-10-01')
    expect(g.guess?.yearOnly).toBe(false)
    const d = diffAnswer(mm, g.a)
    expect(d.find((x) => x.key === 'firstWorship')?.changed).toBe(true)
    expect(d.find((x) => x.key === 'since')?.changed).toBe(false)
    const out = applyAnswer(mm, g.a, new Set(['firstWorship']))
    expect(out.firstWorship).toBe('2014-10-01')
    expect(out.since).toBe('2022-12-11')
    // สมาชิกกรอกวันมาครั้งแรกเอง → ไม่เอาจากหมายเหตุ
    expect(withNoteGuess(mm, { mid: 'm1', name: 'x', first: '2010-05-01', note: '1 ต.ค. 2014' }).a.first).toBe('2010-05-01')
  })
  it('ระยะเวลาเป็นปีกับเดือน (ไม่ใช่ทศนิยม)', () => {
    expect(spanText('2022-12-11', '2026-10-31')).toBe('3 ปี 10 เดือน')
    expect(spanText('2014-10-01', '2026-10-31')).toBe('12 ปี')
    expect(spanText('2026-10-20', '2026-10-31')).toBe('ไม่ถึง 1 เดือน')
    expect(spanText('2025-10-31', '2026-10-30')).toBe('11 เดือน')
  })
})
