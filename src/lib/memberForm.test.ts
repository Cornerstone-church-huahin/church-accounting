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
})
