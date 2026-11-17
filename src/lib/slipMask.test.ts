import { describe, expect, it } from 'vitest'
import { maskLabel, parseMemberCode, slipLayout, type OcrLine, type OcrWord } from './slipMask'
import { REAL_SLIPS } from './slipMask.fixtures'

describe('parseMemberCode', () => {
  it('อ่านรหัสจากหัวแชต', () => {
    expect(parseMemberCode('12:34 น.\n1333ปิ่ม รัชนี\n15 พ.ย. 2026 11:25 น.')).toBe('1333')
    expect(parseMemberCode('1357 สมชาย ใจดี')).toBe('1357')
  })
  it('ไม่เอาวันที่/เวลา/ตัวเลขอื่น', () => {
    expect(parseMemberCode('15 พ.ย. 2026 11:25 น.\nโอนเงินสำเร็จ')).toBeUndefined()
    expect(parseMemberCode('300.00 บาท')).toBeUndefined()
    expect(parseMemberCode('2026 พ.ย.')).toBeUndefined()
  })
})

const ln = (text: string, x0: number, y0: number, x1: number, y1: number): OcrLine => ({ text, x0, y0, x1, y1 })
describe('slipLayout (สลิป K+ ในหน้าจอ 932×2000)', () => {
  const lines = [
    ln('1333ปิ่ม รัชนี', 310, 160, 620, 210),
    ln('โอนเงินสำเร็จ', 105, 440, 360, 490),
    ln('15 พ.ย. 69 11:24 น.', 105, 515, 420, 550),
    ln('น.ส. รัชนี ช', 280, 625, 480, 665),
    ln('ธ.กสิกรไทย', 280, 725, 440, 760),
    ln('xxx-x-x8686-x', 280, 780, 540, 815),
    ln('คริสตจักร ศิลาเอก', 280, 960, 570, 1005),
    ln('ธ.กรุงเทพ', 280, 1020, 420, 1055),
    ln('xxx-x-x5914-x', 280, 1080, 540, 1115),
    ln('เลขที่รายการ:', 80, 1220, 270, 1255),
    ln('จำนวน:', 80, 1340, 180, 1375),
    ln('300.00 บาท', 295, 1395, 505, 1430),
    ln('ค่าธรรมเนียม:', 80, 1455, 285, 1490),
    ln('0.00 บาท', 340, 1520, 505, 1555),
    ln('สแกนตรวจสอบสลิป', 585, 1520, 850, 1560),
  ]
  const r = slipLayout(lines, 932, 2000)
  it('หาชื่อ คิวอาร์ และขอบสลิปได้', () => {
    expect(r.found).toBe(true)
    expect(r.name).not.toBeNull(); expect(r.qr).not.toBeNull()
    // ชื่อ = บรรทัด "น.ส. รัชนี ช" (ไม่ใช่ธนาคาร/เลขบัญชี)
    expect(r.name!.y).toBeLessThanOrEqual(625); expect(r.name!.y + r.name!.h).toBeGreaterThanOrEqual(665); expect(r.name!.y + r.name!.h).toBeLessThan(725)
    // คิวอาร์อยู่เหนือคำอธิบาย
    expect(r.qr!.y).toBeLessThan(1520); expect(r.qr!.x).toBeLessThanOrEqual(585)
    // ขอบสลิปครอบตั้งแต่หัวถึงท้าย ไม่รวมหัวแชต
    expect(r.crop.y).toBeGreaterThan(300); expect(r.crop.y).toBeLessThan(440); expect(r.crop.y + r.crop.h).toBeGreaterThan(1555)
  })
  it('หาหัวสลิปไม่เจอ = ทั้งรูปและไม่มีกรอบ', () => {
    const f = slipLayout([ln('สวัสดี', 0, 0, 10, 10)], 500, 800)
    expect(f.found).toBe(false); expect(f.name).toBeNull(); expect(f.crop).toEqual({ x: 0, y: 0, w: 500, h: 800 })
  })
})

describe('maskLabel', () => {
  it('ป้ายตามประเภท', () => {
    expect(maskLabel('1333', 'ประจำสัปดาห์')).toBe('สมาชิก 1333 ถวายประจำสัปดาห์')
    expect(maskLabel('1333', 'ถวายสิบลด')).toBe('สมาชิก 1333 ถวายสิบลด')
    expect(maskLabel('1333', '')).toBe('สมาชิก 1333 ถวายออนไลน์')
  })
})

// รูปแคปหน้าจอ LINE จริง 1080×2316 (ข้อความถูกแทนด้วยตัวอย่าง แต่ตำแหน่ง/ลักษณะเศษ OCR เหมือนของจริง: คำแตกเป็นพยางค์ มีสัญลักษณ์ปน บรรทัดวันที่/ยอดรวมกับคำอธิบายคิวอาร์)
const w = (t: string, x0: number, y0: number, x1: number, y1: number): OcrWord => ({ t, x0, y0, x1, y1 })
const real: OcrLine[] = [
  { text: '1333ปิม ตัวอย่าง', x0: 363, y0: 156, x1: 1016, y1: 246 },
  { text: 'โอนเงินสําเร็จ     1<', x0: 121, y0: 504, x1: 931, y1: 620, words: [w('โอ', 121, 508, 169, 559), w('น', 175, 528, 193, 559), w('เง', 192, 504, 225, 571), w('ิ', 234, 513, 249, 559), w('น', 256, 528, 277, 559), w('ส', 276, 504, 298, 571), w('ํ', 297, 513, 318, 559), w('า', 323, 528, 339, 559), w('เร', 338, 504, 377, 571), w('็', 376, 504, 394, 571), w('จ', 393, 528, 417, 559), w('1<', 857, 546, 931, 620)] },
  { text: '15 พ.ย. 69 11:24 น.        ซ', x0: 123, y0: 573, x1: 988, y1: 634 },
  { text: 'น.ส. ตัวอย่าง ท', x0: 325, y0: 754, x1: 526, y1: 794, words: [w('น.ส.', 325, 767, 397, 794), w('ตัวอย่าง', 410, 750, 487, 805), w('ท', 505, 768, 526, 794)] },
  { text: 'ธ.กสิกรไทย', x0: 327, y0: 823, x1: 531, y1: 864 },
  { text: '%%7%-%-%8686-%', x0: 327, y0: 903, x1: 627, y1: 935 },
  { text: '@๑9  กรุงเทพ -', x0: 97, y0: 1106, x1: 251, y1: 1247 },
  { text: '%%%-%-%5914-%', x0: 327, y0: 1261, x1: 616, y1: 1293 },
  { text: 'เลขที่รายการ:', x0: 95, y0: 1400, x1: 316, y1: 1446 },
  { text: '300.00บาท', x0: 344, y0: 1619, x1: 966, y1: 1681 },
  { text: 'ค่าธรรมเนียม:', x0: 94, y0: 1680, x1: 956, y1: 1742 },
  { text: '0.00 บาท      สแกนตรวจสอบสลิป', x0: 400, y0: 1761, x1: 971, y1: 1798, words: [w('0.00', 400, 1761, 493, 1793), w('บ', 513, 1768, 533, 1793), w('า', 538, 1767, 553, 1793), w('ท', 558, 1768, 582, 1793), w('ส', 681, 1777, 699, 1798), w('แก', 704, 1778, 740, 1798), w('น', 744, 1778, 763, 1798), w('ต', 769, 1778, 785, 1798), w('ร', 790, 1778, 803, 1798), w('ว', 808, 1778, 821, 1798), w('จ', 826, 1778, 842, 1798), w('ส', 847, 1777, 860, 1798), w('อ', 868, 1778, 881, 1798), w('บ', 888, 1778, 899, 1798), w('ส', 899, 1759, 920, 1807), w('ล', 920, 1777, 930, 1798), w('ิ', 935, 1768, 948, 1798), w('ป', 953, 1771, 971, 1798)] },
]
describe('slipLayout กับผล OCR ของจริง (แคปหน้าจอ LINE)', () => {
  const r = slipLayout(real, 1080, 2316)
  it('รหัสสมาชิกจากหัวแชต', () => { expect(parseMemberCode(real.map((l) => l.text).join('\n'))).toBe('1333') })
  it('กรอบชื่ออยู่ทับชื่อเท่านั้น (ไม่ทับวันที่ ธนาคาร เลขบัญชี)', () => {
    expect(r.found).toBe(true)
    expect(r.name!.y).toBeLessThanOrEqual(754); expect(r.name!.y + r.name!.h).toBeGreaterThanOrEqual(794)
    expect(r.name!.y).toBeGreaterThan(640); expect(r.name!.y + r.name!.h).toBeLessThan(823)
    expect(r.name!.x).toBeLessThanOrEqual(325); expect(r.name!.x + r.name!.w).toBeGreaterThanOrEqual(526)
  })
  it('กรอบคิวอาร์ครอบทั้งคิวอาร์และคำอธิบาย', () => {
    expect(r.qr!.x).toBeLessThanOrEqual(681); expect(r.qr!.x + r.qr!.w).toBeGreaterThanOrEqual(971)
    expect(r.qr!.y).toBeLessThan(1450); expect(r.qr!.y + r.qr!.h).toBeGreaterThanOrEqual(1798)
  })
  it('ตัดขอบสลิปไม่รวมหัวแชตด้านบน', () => {
    expect(r.crop.y).toBeGreaterThan(300); expect(r.crop.y).toBeLessThan(504); expect(r.crop.y + r.crop.h).toBeGreaterThan(1807)
  })
})

// สลิปจริงที่ผู้บันทึกส่งมา 6 ใบ (แคปจากหน้าดูรูป LINE): กรุงไทย · ไทยพาณิชย์ ×3 · กรุงศรี · กรุงเทพ — ตรวจรหัสสมาชิกจากหัวแชตและกรอบชื่อ
const CODES: Record<string, string> = { r1: '1348', r2: '1363', r3: '1323', r4: '1380', r5: '1383', r6: '1392' }
describe('สลิปจริงจากแชต LINE (ธนาคารต่าง ๆ)', () => {
  for (const [k, v] of Object.entries(REAL_SLIPS)) {
    it(`${k}: รหัสสมาชิก ${CODES[k]} และกรอบชื่อตรงตำแหน่ง`, () => {
      expect(parseMemberCode(v.lines.map((l: OcrLine) => l.text).join('\n'))).toBe(CODES[k])
      const qrIn = v.expect.qr ? { x: v.expect.qr[0], y: v.expect.qr[1], w: v.expect.qr[2], h: v.expect.qr[3] } : null
      const lay = slipLayout(v.lines as OcrLine[], v.W, v.H, qrIn)
      expect(lay.found).toBe(true)
      const e = v.expect.name as number[]
      expect(lay.name).not.toBeNull()
      for (const [a, i] of [['x', 0], ['y', 1], ['w', 2], ['h', 3]] as const) expect(Math.abs((lay.name as unknown as Record<string, number>)[a] - e[i])).toBeLessThanOrEqual(12)
      if (qrIn) expect(lay.qr!.x).toBeLessThanOrEqual(qrIn.x); else expect(lay.qr).toBeNull()
    })
  }
})
