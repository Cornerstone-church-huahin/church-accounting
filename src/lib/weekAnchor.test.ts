import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadWeekAnchor, saveWeekAnchor, weekKeyOf } from './weekAnchor'

const store = new Map<string, string>()
beforeEach(() => { store.clear(); vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }) })

describe('weekAnchor', () => {
  it('สัปดาห์จันทร์–อาทิตย์ใช้คีย์เดียวกัน', () => {
    expect(weekKeyOf('2026-11-16')).toBe(weekKeyOf('2026-11-22')) // จันทร์ถึงอาทิตย์
    expect(weekKeyOf('2026-11-15')).not.toBe(weekKeyOf('2026-11-16')) // อาทิตย์ → จันทร์ถัดไป = สัปดาห์ใหม่
  })
  it('จำสัปดาห์ที่ดูภายในสัปดาห์เดียวกัน', () => {
    saveWeekAnchor('2026-11-09', '2026-11-18')
    expect(loadWeekAnchor('2026-11-19')).toBe('2026-11-09')
  })
  it('ขึ้นสัปดาห์ใหม่ → เปิดวันนี้อัตโนมัติ', () => {
    saveWeekAnchor('2026-11-12', '2026-11-13')
    expect(loadWeekAnchor('2026-11-16')).toBe('2026-11-16')
  })
  it('ค่าเก่า/เสีย → วันนี้', () => {
    store.set('acct.visittable.week', '2026-11-12')
    expect(loadWeekAnchor('2026-11-16')).toBe('2026-11-16')
  })
})
