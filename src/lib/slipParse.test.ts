import { describe, expect, it } from 'vitest'
import { mergeSlipReads, parseSlipAmount, parseSlipDate, parseSlipText } from './slipParse'

const today = new Date(2026, 9, 8)
// ข้อความจริงที่ OCR อ่านจากสลิป K PLUS (ก่อน/หลังปรับภาพ)
const KBANK = `โอนเงินสําเร็จ
๑   6 ต.ค. 69 15:31 น.                 |<4+
   นาย สมเจตเ
ธ.กสิกรไทย
จํานวน:
2,.831.00 บาท        :
ค่าธรรมเนียม:                   -           ร มเจ
.00 บาท           ชะ
เลขทีรายการ:                                 สแกน
016279153124B0R02473 ตรวจสอบสลิป
บันทึกช่วยจํา: สิบลด มิย,กค,สค,กย. 2569`

describe('อ่านสลิป', () => {
  it('วันที่และเวลา', () => {
    expect(parseSlipDate('6 ต.ค. 69 15:31 น.', today)).toEqual({ date: '2026-10-06', time: '15:31' })
    expect(parseSlipDate('06 ต.ค. 2569 - 09:05', today).date).toBe('2026-10-06')
    expect(parseSlipDate('6 ตุลาคม 2569 15:31', today).date).toBe('2026-10-06')
    expect(parseSlipDate('06 Oct 2026 15:31', today).date).toBe('2026-10-06')
    expect(parseSlipDate('06/10/2569', today).date).toBe('2026-10-06')
  })
  it('ยอดเงินที่ OCR อ่านมีจุด/จุลภาคเกิน', () => {
    expect(parseSlipAmount('จำนวน:\n2,.831.00 บาท\nค่าธรรมเนียม:\n0.00 บาท')).toBe(283100)
    expect(parseSlipAmount('จำนวน:\n2,831.00 บาท')).toBe(283100)
    expect(parseSlipAmount('จำนวนเงิน 500.00 บาท')).toBe(50000)
  })
  it('อ่านทั้งใบ', () => {
    const r = parseSlipText(KBANK, today)
    expect(r.date).toBe('2026-10-06')
    expect(r.time).toBe('15:31')
    expect(r.amount).toBe(283100)
    expect(r.memo).toContain('สิบลด')
    expect(r.ref).toMatch(/^016279153124/)
  })
  it('รวมหลายรอบ: ยอดที่ตรงกันมากสุดชนะ', () => {
    expect(mergeSlipReads([{ amount: 283100, date: '2026-10-06' }, { amount: 283100 }, { amount: 83100 }])).toMatchObject({ amount: 283100, date: '2026-10-06' })
  })
})
