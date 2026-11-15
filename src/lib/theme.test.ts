import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getTheme, nextTheme, setTheme } from './theme'

const store = new Map<string, string>()
const attrs = new Map<string, string>()
beforeEach(() => {
  store.clear(); attrs.clear()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.stubGlobal('document', { documentElement: { setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k) } })
})

describe('theme', () => {
  it('วนสลับ ตามเครื่อง → สว่าง → มืด → ตามเครื่อง', () => {
    expect(nextTheme('auto')).toBe('light'); expect(nextTheme('light')).toBe('dark'); expect(nextTheme('dark')).toBe('auto')
  })
  it('จำค่าและตั้ง data-theme', () => {
    expect(getTheme()).toBe('auto')
    setTheme('dark'); expect(getTheme()).toBe('dark'); expect(attrs.get('data-theme')).toBe('dark')
    setTheme('auto'); expect(getTheme()).toBe('auto'); expect(attrs.has('data-theme')).toBe(false)
    applyTheme('light'); expect(attrs.get('data-theme')).toBe('light')
  })
})
