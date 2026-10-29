import { describe, expect, it } from 'vitest'
import { freshFile, MAX_SHOT_FROM_CHECKIN_M, nearCheckin, stampText } from './visitProof'

describe('หลักฐานรูปเยี่ยมบ้าน', () => {
  it('ถ่ายใกล้จุดเช็คอิน ≤ 300 ม. ผ่าน · ไกลกว่านั้นไม่ผ่าน', () => {
    const c = { lat: 12.5684, lng: 99.9577 }
    expect(nearCheckin({ lat: 12.5686, lng: 99.9577 }, c).ok).toBe(true)
    expect(nearCheckin({ lat: 12.58, lng: 99.9577 }, c)).toMatchObject({ ok: false })
    expect(MAX_SHOT_FROM_CHECKIN_M).toBe(300)
  })
  it('ไฟล์จากกล้องเครื่องต้องสดใหม่ (ไม่เกิน 2 นาที)', () => {
    const now = 1_000_000_000_000
    expect(freshFile(now - 5_000, now)).toBe(true)
    expect(freshFile(now - 10 * 60_000, now)).toBe(false)
    expect(freshFile(now + 10 * 60_000, now)).toBe(false)
  })
  it('ข้อความประทับมีเวลา พิกัด และชื่อ', () => {
    const t = stampText(Date.UTC(2026, 9, 29, 8, 51, 5), { lat: 12.477531, lng: 99.905403 }, 14.2, 'สมชาย')
    expect(t).toContain('12.47753, 99.90540'); expect(t).toContain('±14 ม.'); expect(t).toContain('สมชาย'); expect(t).toMatch(/15:51:05/)
  })
})
