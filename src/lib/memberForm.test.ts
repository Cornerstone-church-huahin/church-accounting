import { describe, expect, it } from 'vitest'
import { decodeFormLink, encodeFormLink, makeFormLink, parseReply, replyText } from './memberForm'
import type { ChurchMember } from './types'

const m = { id: 'm1', updated: 1, name: 'ดารา ผลจันทร์', nick: 'ดารา', code: '1329', tel: '0818896490', gender: 'หญิง', birth: '2008-09-09' } as ChurchMember

describe('memberForm', () => {
  it('ลิงก์ถอดกลับได้ครบ และหมดอายุตามกำหนด', () => {
    const p = makeFormLink(m, 1000)
    const d = decodeFormLink(encodeFormLink(p))
    expect(d?.name).toBe('ดารา ผลจันทร์')
    expect(d?.mid).toBe('m1')
    expect(d!.exp).toBe(1000 + 14 * 86_400_000)
  })
  it('ลิงก์เสีย/ว่าง = null', () => {
    expect(decodeFormLink(null)).toBeNull()
    expect(decodeFormLink('###')).toBeNull()
  })
  it('ข้อความตอบกลับอ่านง่ายและแอปอ่านกลับได้', () => {
    const t = replyText({ mid: 'm1', name: 'ดารา ผลจันทร์', tel: '081', lat: 12.5, lng: 99.9, note: 'ย้ายบ้าน' })
    expect(t).toContain('ชื่อ-สกุล: ดารา ผลจันทร์')
    expect(t).toContain('หมายเหตุ: ย้ายบ้าน')
    const back = parseReply(`ข้อความจากไลน์\n${t}\nขอบคุณ`)
    expect(back).toMatchObject({ mid: 'm1', name: 'ดารา ผลจันทร์', tel: '081', lat: 12.5, note: 'ย้ายบ้าน' })
    expect(parseReply('ไม่มีรหัส')).toBeNull()
  })
})
