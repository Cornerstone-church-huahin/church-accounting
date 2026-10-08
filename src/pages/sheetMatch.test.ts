import { describe, expect, it } from 'vitest'
import { DEFAULT_INCOME_TYPES } from '../lib/data'
import { matchType } from './SheetFlow'

describe('จับคู่ชื่อแถวใบถวายกับประเภท', () => {
  it('แถวพิมพ์ทั้ง 5 ตรงประเภทของตัวเอง ไม่สลับกองทุน', () => {
    const t = DEFAULT_INCOME_TYPES
    expect(matchType('สิบลด', t)).toBe('tt1')
    expect(matchType('ประจำสัปดาห์', t)).toBe('tt2')
    expect(matchType('ขอบพระคุณ', t)).toBe('tt3')
    expect(matchType('กองทุนเพื่อที่ดินคริสตจักร', t)).toBe('tt4')
    expect(matchType('กองทุนเพื่ออาหาร', t)).toBe('tt5')
  })
  it('ชื่อที่ย่อ/เพี้ยนเล็กน้อยยังจับคู่ได้ ส่วนแถวเขียนมือใหม่ไป "รายได้อื่น"', () => {
    const t = DEFAULT_INCOME_TYPES
    expect(matchType('กองทุนที่ดิน', t)).toBe('tt4')
    expect(matchType('ค่าเช่า', t)).toBe('tt6')
    expect(matchType('ถวายพิเศษเงินสด', t)).toBe('tt6')
  })
})
