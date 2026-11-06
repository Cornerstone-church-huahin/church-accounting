import { describe, expect, it } from 'vitest'
import { noDigits, padNo } from './letterNo'

describe('letterNo', () => {
  it('padNo / noDigits', () => {
    expect(padNo('ศอ/ปด', 4)).toBe('ศอ/ปด.004')
    expect(noDigits('ศอ/ปด.007')).toBe(7)
    expect(noDigits('')).toBe(0)
  })
})
