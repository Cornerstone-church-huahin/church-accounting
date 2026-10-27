import { describe, expect, it } from 'vitest'
import { healthOf, TARGET_WEEKS } from './churchHealth'

const W = 100000 // 1,000 บาท/สัปดาห์
describe('สถานะการเงินคริสตจักร', () => {
  it('เกณฑ์: ≥4 สัปดาห์ เขียว · 2–4 เหลือง · <2 แดง', () => {
    expect(healthOf(5 * W, 8 * W, 0, 0).level).toBe('good')
    expect(healthOf(3 * W, 8 * W, 0, 0).level).toBe('watch')
    expect(healthOf(1 * W, 8 * W, 0, 0).level).toBe('low')
  })
  it('เงินหมุนเวียนศูนย์หรือติดลบ = แดง · ไม่มีรายจ่ายให้เทียบ = เขียว', () => {
    expect(healthOf(0, 8 * W, 0, 0).level).toBe('low')
    expect(healthOf(-5 * W, 8 * W, 0, 0).level).toBe('low')
    expect(healthOf(10 * W, 0, 0, 0)).toMatchObject({ level: 'good', weeks: null, progress: 1 })
  })
  it('ความคืบหน้าสู่เป้า 8 สัปดาห์ (สูงสุด 100%)', () => {
    expect(healthOf(4 * W, 8 * W, 0, 0).progress).toBeCloseTo(4 / TARGET_WEEKS)
    expect(healthOf(20 * W, 8 * W, 0, 0).progress).toBe(1)
  })
  it('แนวโน้มเทียบ 4 สัปดาห์ก่อน', () => {
    expect(healthOf(5 * W, 8 * W, 3 * W, 0).trend).toBe('up')
    expect(healthOf(5 * W, 8 * W, -2 * W, 0).trend).toBe('down')
    expect(healthOf(5 * W, 8 * W, 500, 0).trend).toBe('flat')
  })
})
