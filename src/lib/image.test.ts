import { describe, expect, it } from 'vitest'
import { compressSteps, TARGET_BYTES } from './image'

describe('มาตรฐานบีบรูปแนบ', () => {
  it('เป้า ~350KB · ลองลดคุณภาพก่อน แล้วลดพิกเซล ไม่ต่ำกว่า 1200px / q0.5', () => {
    expect(TARGET_BYTES).toBe(350_000)
    const st = compressSteps(1600, 0.72)
    expect(st[0]).toEqual({ side: 1600, q: 0.72 })
    expect(st.every((x, i) => i === 0 || x.q <= st[i - 1].q + 0.05)).toBe(true)
    expect(Math.min(...st.map((x) => x.side))).toBe(1200)
    expect(Math.min(...st.map((x) => x.q))).toBe(0.5)
  })
  it('รูปที่ขอเล็กอยู่แล้ว (เช่น รูปสมาชิก 640px) ไม่ถูกขยายขึ้น', () => {
    expect(Math.max(...compressSteps(640, 0.8).map((x) => x.side))).toBe(640)
  })
})
