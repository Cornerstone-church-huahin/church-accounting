import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBinary } from './sync'

const cfg = { repo: 'o/r', token: 't', name: 'x' }
afterEach(() => { vi.unstubAllGlobals() })
const png = () => new Response(new Blob([new Uint8Array(10)], { type: 'image/png' }), { status: 200 })

describe('โหลดรูปจาก repo ข้อมูล (เร็ว+ทนเครือข่ายช้า)', () => {
  it('รูปเดียวกันที่ขอพร้อมกันหลายที่ ดึงครั้งเดียว', async () => {
    const f = vi.fn(async () => { await new Promise((r) => setTimeout(r, 10)); return png() })
    vi.stubGlobal('fetch', f)
    const [a, b] = await Promise.all([getBinary(cfg, 'attachments/a.png'), getBinary(cfg, 'attachments/a.png')])
    expect(f).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })
  it('ดึงพร้อมกันไม่เกิน 3 รูป', async () => {
    let cur = 0, max = 0
    vi.stubGlobal('fetch', vi.fn(async () => { cur++; max = Math.max(max, cur); await new Promise((r) => setTimeout(r, 15)); cur--; return png() }))
    await Promise.all(Array.from({ length: 9 }, (_, i) => getBinary(cfg, `attachments/p${i}.png`)))
    expect(max).toBeLessThanOrEqual(3)
    expect(max).toBeGreaterThan(1)
  })
  it('หลุดชั่วคราวลองใหม่ให้เอง · ไม่พบไฟล์ไม่ลองซ้ำ', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => { n++; if (n < 3) throw new TypeError('Failed to fetch'); return png() }))
    const t = await getBinary(cfg, 'attachments/retry.png')
    expect(t.size).toBe(10)
    expect(n).toBe(3)
    const f404 = vi.fn(async () => new Response('', { status: 404 }))
    vi.stubGlobal('fetch', f404)
    await expect(getBinary(cfg, 'attachments/missing.png')).rejects.toThrow(/ไม่พบไฟล์/)
    expect(f404).toHaveBeenCalledTimes(1)
  })
})
