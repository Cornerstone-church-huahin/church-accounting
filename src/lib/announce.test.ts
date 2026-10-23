import { beforeEach, describe, expect, it } from 'vitest'
import { forWork, markRead, readIds, unreadOf } from './announce'
import type { Announcement } from './types'

const a = (id: string, works: number[], at: number, deleted = false): Announcement => ({ id, text: id, works, at, updated: 1, ...(deleted ? { deleted: true } : {}) })
describe('ข่าวจากแอดมิน (กระดิ่ง)', () => {
  beforeEach(() => { const s = new Map<string, string>(); Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v) }, configurable: true }) })
  it('งานนั้นเห็นข่าวถึงงานนั้นและถึงทุกงาน ใหม่สุดก่อน ไม่เห็นข่าวที่ลบ', () => {
    const xs = [a('1', [5], 10), a('2', [0], 30), a('3', [6], 20), a('4', [5], 40, true)]
    expect(forWork(xs, 5).map((x) => x.id)).toEqual(['2', '1'])
    expect(forWork(xs, 6).map((x) => x.id)).toEqual(['2', '3'])
  })
  it('อ่านแล้วเก็บแยกตามงาน และข่าวใหม่ขึ้นเป็นยังไม่อ่าน', () => {
    const xs = [a('1', [5], 10), a('2', [5], 20)]
    markRead(5, ['1'])
    expect(unreadOf(xs, readIds(5)).map((x) => x.id)).toEqual(['2'])
    expect(unreadOf(xs, readIds(6)).length).toBe(2)
    markRead(5, ['2'])
    expect(unreadOf(xs, readIds(5))).toEqual([])
  })
})
