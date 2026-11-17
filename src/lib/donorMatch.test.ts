import { describe, expect, it } from 'vitest'
import { matchDonor, parseContact, senderParts } from './donorMatch'
import type { ChurchMember } from './types'

const M = (id: string, name: string, nick?: string, code?: string): ChurchMember => ({ id, name, nick, code, updated: 1, status: 'active', group: '' } as unknown as ChurchMember)
const members = [
  M('1', 'สมหญิง จันดี', 'ฝัน', '1348'), M('2', 'สมหญิง สุขศรี', 'น้ำ'), M('3', 'มาลี ทองดี', 'ส้ม'), M('4', 'วิชัย พงษ์', 'วะ'),
  M('5', 'สมศรี ชัย', 'ปิ่ม'), M('6', 'สมศรี มาลี'), M('7', 'สุดาวดี สมบัติ', 'เอย'),
]

describe('senderParts / parseContact', () => {
  it('ตัดคำนำหน้า เครื่องหมาย และเอาอักษรแรกนามสกุล', () => {
    expect(senderParts('น.ส.สมหญิง จ***')).toEqual({ first: 'สมหญิง', initial: 'จ' })
    expect(senderParts('นางสาว มาลี ท.')).toEqual({ first: 'มาลี', initial: 'ท' })
    expect(senderParts('นาย วิชัย พ.')).toEqual({ first: 'วิชัย', initial: 'พ' })
    expect(senderParts('ปวีณา')).toEqual({ first: 'ปวีณา', initial: '' })
  })
  it('ชื่อผู้ติดต่อจากหัวแชต', () => {
    expect(parseContact('1348 ฝัน สมหญิงใจ      ><\n8 พ.ย. 2026 11.08 น.')).toEqual({ code: '1348', name: 'ฝัน สมหญิงใจ' })
    expect(parseContact('1363-Mali Thongdee  9')).toEqual({ code: '1363', name: 'Mali Thongdee' })
    expect(parseContact('15 พ.ย. 2026 11.25 น.').name).toBe('')
  })
})

describe('matchDonor', () => {
  it('ชื่อที่ OCR อ่านเพี้ยน (ตกสระ/วรรณยุกต์ ชื่อปนคำนำหน้า) ยังจับคู่ได้จากโครงพยัญชนะ', () => {
    expect(matchDonor(members, { senderName: 'บน.สสมหญงจ”***' }).member?.id).toBe('1')
  })
  it('รหัสสมาชิกตรงในทะเบียน (มีคนเดียว) = ตรงเป๊ะ', () => {
    const r = matchDonor(members, { code: '1348' })
    expect(r.member?.id).toBe('1'); expect(r.reason).toBe('code')
  })
  it('ชื่อบนสลิป + อักษรแรกนามสกุล แยกคนชื่อเดียวกันได้', () => {
    const r = matchDonor(members, { senderName: 'น.ส.สมหญิง จ***' })
    expect(r.member?.id).toBe('1'); expect(r.reason).toBe('name')
    const r2 = matchDonor(members, { senderName: 'น.ส.สมหญิง ส' })
    expect(r2.member?.id).toBe('2')
  })
  it('ชื่อต้นซ้ำและไม่มีตัวแยก = ไม่เลือกให้ ส่งตัวเลือกให้เลือกเอง', () => {
    const r = matchDonor(members, { senderName: 'น.ส.สมศรี' })
    expect(r.member).toBeUndefined(); expect(r.candidates.map((m) => m.id).sort()).toEqual(['5', '6'])
  })
  it('ใช้ชื่อผู้ติดต่อในแชตช่วย (ชื่อเล่น + ชื่อ)', () => {
    const r = matchDonor(members, { contactName: 'ฝัน สมหญิงใจ' })
    expect(r.candidates[0].id).toBe('1') // ชื่อเล่น+ชื่อ+นามสกุลบางส่วนตรง = อันดับแรก (ใกล้เคียงกับอีกคน จึงให้ผู้บันทึกยืนยัน)
    expect(matchDonor(members, { contactName: 'ฝัน สมหญิงใจ', senderName: 'น.ส.สมหญิง จ***' }).member?.id).toBe('1')
  })
  it('ไม่พบเลย = ไม่มีตัวเลือก', () => {
    const r = matchDonor(members, { senderName: 'Somchai', contactName: 'Somchai' })
    expect(r.member).toBeUndefined(); expect(r.candidates).toHaveLength(0)
  })
  it('ชื่อ OCR วรรณยุกต์ต่างกันยังตรง', () => {
    expect(matchDonor(members, { senderName: 'นางสาว มาลี ท' }).member?.id).toBe('3')
  })
})
