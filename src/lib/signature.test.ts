import { describe, expect, it } from 'vitest'
import { inkAlpha } from './signature'

describe('inkAlpha', () => {
  it('กระดาษขาว = โปร่งใส', () => { expect(inkAlpha(255, 255, 255)).toBe(0); expect(inkAlpha(240, 240, 235)).toBe(0) })
  it('หมึกดำ/น้ำเงินเข้ม = ทึบเต็ม', () => { expect(inkAlpha(0, 0, 0)).toBe(255); expect(inkAlpha(20, 20, 60)).toBe(255) })
  it('สีกลางไล่ระดับ (ขอบเส้นนุ่ม)', () => { const a = inkAlpha(190, 190, 190); expect(a).toBeGreaterThan(0); expect(a).toBeLessThan(255) })
})
