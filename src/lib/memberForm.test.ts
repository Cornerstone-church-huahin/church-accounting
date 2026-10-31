import { describe, expect, it } from 'vitest'
import { decodeFormLink, decodeGroupLink, encodeFormLink, groupUrl, makeFormLink, parseReply, replyText } from './memberForm'
import type { ChurchMember } from './types'

const m = { id: 'm1', updated: 1, name: 'ดารา ผลจันทร์', nick: 'ดารา', code: '1329', tel: '0818896490', gender: 'หญิง', birth: '2008-09-09' } as ChurchMember

describe('memberForm', () => {
  it('ลิงก์ถอดกลับได้ครบ และหมดอายุตามกำหนด', () => {
    const p = makeFormLink(m, 1000)
    const d = decodeFormLink(encodeFormLink(p))
    expect(d?.name).toBe('ดารา ผลจันทร์')
    expect(d?.mid).toBe('m1')
    expect(Math.abs(d!.exp - (1000 + 14 * 86_400_000))).toBeLessThan(60_000)
  })
  it('ลิงก์เสีย/ว่าง = null', () => {
    expect(decodeFormLink(null)).toBeNull()
    expect(decodeFormLink('###')).toBeNull()
  })
  it('ข้อความตอบกลับอ่านง่ายและแอปอ่านกลับได้', () => {
    const t = replyText({ mid: 'm1', name: 'ดารา ผลจันทร์', tel: '081', lineId: 'dara_l', facebook: 'ดารา ผลจันทร์', first: '2012-05-01', skills: 'พยาบาล', serve: ['ดนตรี (เครื่องดนตรี)', 'อื่นๆ: ตัดผม'], serveDays: ['วันเสาร์'], note: 'ย้ายบ้าน' })
    expect(t).toContain('ชื่อ-สกุล: ดารา ผลจันทร์')
    expect(t).toContain('หมายเหตุ: ย้ายบ้าน')
    expect(t).toContain('LINE ID: dara_l')
    expect(t).toContain('อาชีพ/ความสามารถ: พยาบาล')
    expect(t).toContain('งานรับใช้ที่เต็มใจ: ดนตรี (เครื่องดนตรี), อื่นๆ: ตัดผม')
    expect(t).toContain('วันที่สะดวกรับใช้: วันเสาร์')
    expect(t).not.toContain('พิกัดบ้าน')
    const back = parseReply(`ข้อความจากไลน์\n${t}\nขอบคุณ`)
    expect(back).toMatchObject({ mid: 'm1', name: 'ดารา ผลจันทร์', tel: '081', lineId: 'dara_l', first: '2012-05-01', note: 'ย้ายบ้าน' })
    expect(parseReply('ไม่มีรหัส')).toBeNull()
  })
  it('ลิงก์กลุ่มมีเฉพาะ รหัส/ชื่อ/ชื่อเล่น และถอดกลับได้ · ลิงก์รายคนไม่ใช่ลิงก์กลุ่ม', () => {
    const url = groupUrl([m, { id: 'm2', name: 'สมชาย ใจดี' }], 'https://x/app/')
    const d = new URL(url.replace('#/', '')).hash
    const token = url.split('d=')[1]
    const g = decodeGroupLink(token)
    expect(g?.list).toEqual([{ id: 'm1', name: 'ดารา ผลจันทร์', nick: 'ดารา' }, { id: 'm2', name: 'สมชาย ใจดี' }])
    expect(JSON.stringify(g)).not.toContain('0818896490')
    expect(decodeFormLink(token)).toBeNull()
    expect(decodeGroupLink(encodeFormLink(makeFormLink(m)))).toBeNull()
    expect(d).toBeDefined()
  })
})

import { personalInvite, groupInvite } from './memberForm'
describe('ลิงก์กะทัดรัด + ข้อความมาตรฐาน', () => {
  const full = { id: 'cm-mv9nzmoox', updated: 1, name: 'หนึ่งฤทัย ทองมี', nick: 'หนึ่ง', code: '1361', tel: '0971178583', gender: 'หญิง', birth: '1994-07-20', since: '2001-12-11', lineId: 'nueng_l', facebook: 'หนึ่ง ทองมี', skills: 'พยาบาล, ทำอาหาร', serve: ['ดนตรี (เครื่องดนตรี)', 'ครัว / อาหาร / เครื่องดื่ม', 'อื่นๆ: ตัดผม'], serveDays: ['วันเสาร์', 'ยืดหยุ่น / ตามนัด'] } as ChurchMember
  it('v2 ถอดกลับได้ครบทุกช่อง และสั้นกว่า v1 มาก', () => {
    const p = makeFormLink(full, 1_800_000_000_000)
    const tok = encodeFormLink(p)
    expect(tok.startsWith('2.')).toBe(true)
    const d = decodeFormLink(tok)!
    expect(d).toMatchObject({ mid: 'cm-mv9nzmoox', code: '1361', name: 'หนึ่งฤทัย ทองมี', nick: 'หนึ่ง', tel: '0971178583', gender: 'หญิง', birth: '1994-07-20', first: '2001-12-11', lineId: 'nueng_l', facebook: 'หนึ่ง ทองมี', skills: 'พยาบาล, ทำอาหาร' })
    expect(d.serve).toEqual(full.serve)
    expect(d.serveDays).toEqual(full.serveDays)
    expect(Math.abs(d.exp - p.exp)).toBeLessThan(60_000)
    const v1 = btoa(unescape(encodeURIComponent(JSON.stringify(p)))).length
    expect(tok.length).toBeLessThan(v1 / 1.8)
  })
  it('ข้อมูลน้อย (ทะเบียนมีแค่ชื่อ) ลิงก์สั้นมาก · ลิงก์ v1 เก่ายังเปิดได้', () => {
    const tok = encodeFormLink(makeFormLink({ id: 'cm-a', updated: 1, name: 'ดารา ผลจันทร์' } as ChurchMember))
    expect(tok.length).toBeLessThan(60)
    expect(decodeFormLink(tok)?.name).toBe('ดารา ผลจันทร์')
    const old = btoa(unescape(encodeURIComponent(JSON.stringify(makeFormLink(full))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeFormLink(old)?.name).toBe('หนึ่งฤทัย ทองมี')
  })
  it('ข้อความมาตรฐานมีชื่อผู้รับและลิงก์', () => {
    const t = personalInvite({ name: 'ดารา ผลจันทร์', nick: 'ดารา' }, 'https://x/#/form?d=2.abc')
    expect(t).toContain('เรียน ดารา ผลจันทร์ (ดารา)')
    expect(t).toContain('ลิงก์เฉพาะของ “ดารา ผลจันทร์”')
    expect(t).toContain('https://x/#/form?d=2.abc')
    expect(groupInvite('https://x/#/form')).toContain('เรียน พี่น้องสมาชิกคริสตจักรศิลาเอก')
  })
})
