import { describe, expect, it } from 'vitest'
import { createHistory } from './editHistory'
describe('ประวัติย้อนกลับ', () => {
  it('ย้อนได้ตามลำดับล่าสุดก่อน', () => {
    const h = createHistory<string>()
    h.push('a'); h.push('b'); h.push('c')
    expect(h.undo()).toBe('c'); expect(h.undo()).toBe('b'); expect(h.size).toBe(1)
    expect(h.undo()).toBe('a'); expect(h.undo()).toBeUndefined()
  })
  it('ย้อนได้อย่างน้อย 10 ขั้น และจำกัดตามขอบเขต', () => {
    const h = createHistory<number>()
    for (let i = 0; i < 12; i++) h.push(i)
    expect(h.size).toBe(12)
    for (let i = 11; i >= 2; i--) expect(h.undo()).toBe(i)
    const s = createHistory<number>(3)
    for (let i = 0; i < 5; i++) s.push(i)
    expect(s.size).toBe(3); expect(s.undo()).toBe(4)
  })
})
