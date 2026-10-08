import { describe, expect, it } from 'vitest'
import { parseSheetJson } from './gemini'

describe('อ่านผลใบถวายจาก Gemini', () => {
  it('แปลงเป็นสตางค์ และข้ามแถวว่าง', () => {
    const r = parseSheetJson('```json\n{"date":"2026-10-04","cashTotal":5260,"rows":[{"label":"สิบลด","envelopes":6,"amount":1150},{"label":"ประจำสัปดาห์","envelopes":7,"amount":"2,040"},{"label":"ขอบพระคุณ","envelopes":10,"amount":1970},{"label":"กองทุนเพื่อที่ดิน","amount":0},{"label":"กองทุนเพื่ออาหาร","envelopes":1,"amount":100},{"label":"ค่าเช่า","amount":10000}]}\n```')
    expect(r.date).toBe('2026-10-04')
    expect(r.writtenCash).toBe(526000)
    expect(r.rows.map((x) => x.amount)).toEqual([115000, 204000, 197000, 10000, 1000000])
    expect(r.rows[0]).toEqual({ label: 'สิบลด', amount: 115000, envelopes: 6 })
    expect(r.rows.some((x) => x.label.includes('ที่ดิน'))).toBe(false)
  })
  it('ข้อมูลเพี้ยนไม่ทำให้ระบบพัง', () => {
    expect(parseSheetJson('{"rows":"x","date":"4/10/69"}')).toEqual({ rows: [] })
  })
})
