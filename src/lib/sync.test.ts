import { describe, expect, it } from 'vitest'
import { remoteWins } from './sync'

describe('remoteWins (epoch after permanent delete / reset)', () => {
  it('online file wins only when it was reset after this device last synced', () => {
    expect(remoteWins(0, undefined)).toBe(false)
    expect(remoteWins(100, 100)).toBe(false)
    expect(remoteWins(100, 200)).toBe(true)
    expect(remoteWins(300, 200)).toBe(false)
  })
})

import { describeFailure } from './sync'
describe('describeFailure: สาเหตุที่ GitHub ปฏิเสธ', () => {
  it('โควตาเต็ม (403 + remaining 0) บอกเวลาใช้ได้อีก', () => {
    const t = String(Math.floor(new Date(2026, 9, 18, 23, 5).getTime() / 1000))
    expect(describeFailure(403, 'API rate limit exceeded', '0', t)).toMatch(/โควตา.*23:05/)
    expect(describeFailure(403, 'You have exceeded a secondary rate limit', null, null)).toMatch(/โควตา/)
  })
  it('รหัสไม่ได้รับสิทธิ์ใช้ repo (ต้องเลือก repo/องค์กรอนุมัติ)', () => {
    expect(describeFailure(403, 'Resource not accessible by personal access token', '4000', null)).toMatch(/เลือก repo นี้/)
  })
  it('สาเหตุอื่น: ข้อความมาตรฐาน + ข้อความจาก GitHub', () => {
    expect(describeFailure(401, 'Bad credentials')).toContain('ไม่ถูกต้องหรือหมดอายุ')
    expect(describeFailure(401, 'Bad credentials')).toContain('Bad credentials')
    expect(describeFailure(500)).toContain('500')
  })
})

import { afterEach, vi } from 'vitest'
import { clearEtagCache, pullFile } from './sync'
describe('pullFile: ถามแบบมีเงื่อนไข (ETag) ประหยัดโควตา GitHub', () => {
  afterEach(() => { vi.unstubAllGlobals(); clearEtagCache() })
  const cfg = { repo: 'o/r', token: 't', name: 'x' }
  const body = { sha: 's1', encoding: 'base64', content: btoa(JSON.stringify({ items: [{ id: 'a', updated: 1 }] })) }
  it('ครั้งที่สองส่ง If-None-Match และใช้ผลเดิมเมื่อได้ 304', async () => {
    const calls: Record<string, string>[] = []
    const fetchMock = vi.fn(async (_u: string, init: RequestInit) => {
      calls.push((init.headers ?? {}) as Record<string, string>)
      return calls.length === 1 ? new Response(JSON.stringify(body), { status: 200, headers: { etag: '"e1"' } }) : new Response(null, { status: 304 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const a = await pullFile(cfg, 'f.json')
    const b = await pullFile(cfg, 'f.json')
    expect(calls[0]['if-none-match']).toBeUndefined()
    expect(calls[1]['if-none-match']).toBe('"e1"')
    expect(b.items).toEqual(a.items)
    expect(b.items).not.toBe(a.items) // คืนสำเนา ผู้เรียกแก้ไขแล้วไม่กระทบแคช
    expect(b.sha).toBe('s1')
  })
  it('ไฟล์เปลี่ยน (ได้ 200 ใหม่) ใช้ข้อมูลใหม่', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => { n++; const c = { ...body, content: btoa(JSON.stringify({ items: [{ id: n === 1 ? 'a' : 'b', updated: 1 }] })) }; return new Response(JSON.stringify(c), { status: 200, headers: { etag: `"e${n}"` } }) }))
    expect((await pullFile(cfg, 'f.json')).items[0].id).toBe('a')
    expect((await pullFile(cfg, 'f.json')).items[0].id).toBe('b')
  })
})

describe('pullFile: ถ้าส่งหัวแบบมีเงื่อนไขไม่ได้ ถอยกลับไปถามแบบเดิม', () => {
  afterEach(() => { vi.unstubAllGlobals(); clearEtagCache() })
  it('ล้มครั้งที่สองด้วย network error → ลองใหม่ไม่ใส่ If-None-Match และได้ข้อมูล', async () => {
    const cfg = { repo: 'o/r', token: 't', name: 'x' }
    const body = { sha: 's1', encoding: 'base64', content: btoa(JSON.stringify({ items: [{ id: 'a', updated: 1 }] })) }
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      n++
      const h = (init.headers ?? {}) as Record<string, string>
      if (n === 1) return new Response(JSON.stringify(body), { status: 200, headers: { etag: '"e1"' } })
      if (h['if-none-match']) throw new TypeError('Failed to fetch') // จำลอง CORS ไม่รับหัวนี้
      return new Response(JSON.stringify(body), { status: 200 })
    }))
    await pullFile(cfg, 'f.json')
    const again = await pullFile(cfg, 'f.json')
    expect(again.items[0].id).toBe('a')
  })
})
