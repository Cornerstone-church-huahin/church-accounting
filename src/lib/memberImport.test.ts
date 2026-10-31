import { describe, expect, it } from 'vitest'
import { applyAnswer, diffAnswer, sinceFromFirst, findCandidates, guessDateFromNote, nameVerdict, normName, snapToWorshipDay, spanText, withNoteGuess } from './memberImport'
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
  it('หมายเหตุช่วยเติม “มาครั้งแรก” เท่านั้น (ตารางเทียบไม่เสนอเปลี่ยนวันรับเป็นสมาชิก) · ที่สมาชิกกรอกเองมาก่อน', () => {
    const mm = { ...m, since: '2022-12-11' } as ChurchMember
    const g = withNoteGuess(mm, { mid: 'm1', name: 'x', note: 'เป็นสมาชิกวันที่1ตค2014' })
    expect(g.a.first).toBe('2014-10-01')
    expect(g.guess?.yearOnly).toBe(false)
    const d = diffAnswer(mm, g.a)
    expect(d.find((x) => x.key === 'firstWorship')?.changed).toBe(true)
    expect(d.find((x) => x.key === 'since')?.changed).toBe(false)
    const out = applyAnswer(mm, g.a, new Set(['firstWorship']))
    expect(out.firstWorship).toBe('2014-10-01')
    expect(out.since).toBe('2014-10-01')   // วันตั้งต้น 11/12/2565 เปลี่ยนตามวันมาครั้งแรกที่นำเข้า
    // สมาชิกกรอกวันมาครั้งแรกเอง → ไม่เอาจากหมายเหตุ
    expect(withNoteGuess(mm, { mid: 'm1', name: 'x', first: '2010-05-01', note: '1 ต.ค. 2014' }).a.first).toBe('2010-05-01')
  })
  it('ระยะเวลาเป็นปีกับเดือน (ไม่ใช่ทศนิยม)', () => {
    expect(spanText('2022-12-11', '2026-10-31')).toBe('3 ปี 10 เดือน')
    expect(spanText('2014-10-01', '2026-10-31')).toBe('12 ปี')
    expect(spanText('2026-10-20', '2026-10-31')).toBe('ไม่ถึง 1 เดือน')
    expect(spanText('2025-10-31', '2026-10-30')).toBe('11 เดือน')
  })
  it('จับวันที่ประมาณกับวันนมัสการที่มีบันทึกใกล้ที่สุด (±3 วัน) ไม่มี = null', () => {
    const days = ['2024-07-07', '2024-07-14', '2024-07-21']
    expect(snapToWorshipDay('2024-07-09', days)).toBe('2024-07-07')   // พุธ → อาทิตย์ก่อนหน้า
    expect(snapToWorshipDay('2024-07-12', days)).toBe('2024-07-14')
    expect(snapToWorshipDay('2024-07-14', days)).toBe('2024-07-14')
    expect(snapToWorshipDay('2024-07-17', days)).toBe('2024-07-14')   // ห่าง 3 วัน
    expect(snapToWorshipDay('2024-07-10', ['2024-07-07', '2024-07-13'])).toBe('2024-07-07')   // ห่างเท่ากันคนละข้าง → เลือกวันที่ก่อน
    expect(snapToWorshipDay('1981-07-17', days)).toBeNull()   // ก่อนที่ระบบจะบันทึก
    expect(snapToWorshipDay('2024-08-10', days)).toBeNull()
  })
  it('ที่อยู่ปัจจุบันและพิกัดบ้านที่สมาชิกกรอก: เทียบและนำเข้าได้', () => {
    const a = { mid: 'm1', name: 'วีรชัย ใจดี', address: '1 ถ.เพชรเกษม หัวหิน', lat: 12.5712, lng: 99.9577 }
    const d = diffAnswer(m, a)
    expect(d.find((x) => x.key === 'address')?.changed).toBe(true)
    expect(d.find((x) => x.key === 'geo')?.changed).toBe(true)
    const n = applyAnswer(m, a, new Set(['address', 'geo'] as const))
    expect(n.address).toBe('1 ถ.เพชรเกษม หัวหิน')
    expect([n.lat, n.lng]).toEqual([12.5712, 99.9577])
  })
  it('วันรับเป็นสมาชิกตั้งต้น 11/12/2565 เปลี่ยนตามวันมานมัสการครั้งแรก · วันอื่นไม่แตะ', () => {
    expect(sinceFromFirst({ firstWorship: '2014-10-01', since: '2022-12-11' })).toBe('2014-10-01')
    expect(sinceFromFirst({ firstWorship: '2014-10-01' })).toBeUndefined()   // ช่องว่างไม่แตะ (เปลี่ยนเฉพาะค่าตั้งต้น)
    expect(sinceFromFirst({ firstWorship: '2014-10-01', since: '2016-05-01' })).toBeUndefined()
    expect(sinceFromFirst({ since: '2022-12-11' })).toBeUndefined()
    const base = { ...m, since: '2022-12-11' } as ChurchMember
    const a = { mid: 'm1', name: 'วีรชัย ใจดี', first: '2014-10-01' }
    const n = applyAnswer(base, a, new Set(['firstWorship'] as const))
    expect([n.firstWorship, n.since]).toEqual(['2014-10-01', '2014-10-01'])
    expect(applyAnswer({ ...base, since: '2016-05-01' } as ChurchMember, a, new Set(['firstWorship'] as const)).since).toBe('2016-05-01')
  })
})
