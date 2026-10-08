import { describe, expect, it } from 'vitest'
import { parseBillJson, parseSheetJson } from './gemini'

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
  it('อ่านบิลรายจ่าย: ยอดเป็นสตางค์ หมวดเป็นรหัส วันที่ ISO', () => {
    const r = parseBillJson('{"kind":"invoice","vendor":"การประปาส่วนภูมิภาค","date":"2026-10-08","due":"2026-10-20","total":"2,000","summary":"ค่าน้ำประปา ก.ย. 69","category":"3.3","ref":"INV123"}')
    expect(r).toMatchObject({ kind: 'invoice', vendor: 'การประปาส่วนภูมิภาค', date: '2026-10-08', due: '2026-10-20', total: 200000, category: '3.3', ref: 'INV123' })
    expect(parseBillJson('{"kind":"transfer_slip","total":600}')).toMatchObject({ kind: 'transfer_slip', method: 'transfer', total: 60000 })
    expect(parseBillJson('{"kind":"x","date":"8/10/69","category":"ไม่ทราบ"}')).toEqual({})
  })
})
