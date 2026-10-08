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
