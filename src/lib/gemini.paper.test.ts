import { describe, expect, it } from 'vitest'
import { parseIncomePaperJson, parseVoucherPaperJson } from './gemini'

describe('สแกนใบกระดาษ', () => {
  it('ใบบันทึกการถวาย: เงินสด+โอนในแถวเดียว, ตัดแถวไม่มีเงิน', () => {
    const r = parseIncomePaperJson(JSON.stringify({ rows: [
      { date: '2026-10-19', label: 'สิบลด', cashCount: 6, cashAmount: 1900, transferCount: 2, transferAmount: 600 },
      { label: 'ว่าง' },
      { label: 'ขอบพระคุณ', cashAmount: '1,000' },
    ] }))
    expect(r).toEqual([
      { label: 'สิบลด', date: '2026-10-19', cash: 190000, cashCount: 6, transfer: 60000, transferCount: 2 },
      { label: 'ขอบพระคุณ', cash: 100000 },
    ])
  })
  it('ใบเบิก-จ่าย', () => {
    const r = parseVoucherPaperJson('```json\n' + JSON.stringify({ rows: [{ date: 'x', desc: 'ค่าน้ำ', amount: 250.5, note: 'มน.', who: 'การประปา' }, { desc: 'ไม่มียอด' }] }) + '\n```')
    expect(r).toEqual([{ desc: 'ค่าน้ำ', amount: 25050, note: 'มน.', who: 'การประปา' }])
  })
})
