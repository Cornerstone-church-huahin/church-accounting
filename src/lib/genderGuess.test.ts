import { describe, expect, it } from 'vitest'
import { guessGender } from './genderGuess'

describe('guessGender', () => {
  it('uses titles first (high)', () => {
    expect(guessGender({ name: 'นายสมชาย ใจดี' })).toMatchObject({ gender: 'ชาย', confidence: 'high' })
    expect(guessGender({ name: 'นางสาวสมศรี ดี' })).toMatchObject({ gender: 'หญิง', confidence: 'high' })
    expect(guessGender({ name: 'นางสมหญิง ดี' })).toMatchObject({ gender: 'หญิง', confidence: 'high' })
    expect(guessGender({ name: 'Mrs. Anna Lee' })).toMatchObject({ gender: 'หญิง', confidence: 'high' })
  })
  it('reads kin words in the note and name (the owner of the record, not the relative)', () => {
    expect(guessGender({ name: 'สมใจ ดี', note: 'แม่ไซม่อน' })).toMatchObject({ gender: 'หญิง', confidence: 'high' })
    expect(guessGender({ name: 'สมใจ ดี', note: 'พี่สาวมะนาว' })).toMatchObject({ gender: 'หญิง', confidence: 'high' })
    expect(guessGender({ name: 'สมใจ ดี', note: 'สามีครูเบียร์' })).toMatchObject({ gender: 'ชาย', confidence: 'high' })
    expect(guessGender({ name: 'แม่หน่อย' })).toMatchObject({ gender: 'หญิง', confidence: 'high' })
    // หมายเหตุที่มีทั้งสองคำ = คลุมเครือ ไม่ใช้
    expect(guessGender({ name: 'ทดสอบ ดี', note: 'แม่และพ่อ' })?.why).not.toBe('หมายเหตุบอกความสัมพันธ์')
  })
  it('uses the group name, then first names / nicknames in Thai and English (mid)', () => {
    expect(guessGender({ name: 'ทดสอบ ดี', group: '4.สตรี' })).toMatchObject({ gender: 'หญิง', confidence: 'high' })
    expect(guessGender({ name: 'ทดสอบ ดี', group: '5.บรุษ' })).toMatchObject({ gender: 'ชาย', confidence: 'high' })
    expect(guessGender({ name: 'สมชาย ใจดี' })).toMatchObject({ gender: 'ชาย', confidence: 'mid' })
    expect(guessGender({ name: 'วิลาสินี สนิทไทย(มะนาว)' })).toMatchObject({ gender: 'หญิง', confidence: 'mid' })
    expect(guessGender({ name: 'Samuel Bauman' })).toMatchObject({ gender: 'ชาย', confidence: 'mid' })
    expect(guessGender({ name: 'Carola Gull' })).toMatchObject({ gender: 'หญิง', confidence: 'mid' })
    expect(guessGender({ name: 'ชื่อแปลก ดี', nick: 'แจ็ค' })).toMatchObject({ gender: 'ชาย', confidence: 'mid' })
  })
  it('falls back to name endings (low) and gives up when there is no clue', () => {
    expect(guessGender({ name: 'ธนวัฒน์ ลองดู' })).toMatchObject({ gender: 'ชาย' })
    expect(guessGender({ name: 'Xqzv Ytrw' })).toBeUndefined()
    expect(guessGender({ name: 'น้อย ดี' })).toBeUndefined() // ใช้ได้ทั้งสองเพศ
  })
})
