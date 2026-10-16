import { describe, expect, it } from 'vitest'
import { daysUntilBirthday } from './BirthdayList'

describe('daysUntilBirthday', () => {
  it('counts days to the next birthday, today = 0, rolling into next year', () => {
    expect(daysUntilBirthday('1990-10-15', '2026-10-15')).toBe(0)
    expect(daysUntilBirthday('1990-10-20', '2026-10-15')).toBe(5)
    expect(daysUntilBirthday('1990-10-14', '2026-10-15')).toBe(364)
    expect(daysUntilBirthday('1990-01-02', '2026-12-30')).toBe(3)
  })
  it('treats 29 Feb as 28 Feb in non-leap years', () => {
    expect(daysUntilBirthday('2000-02-29', '2027-02-27')).toBe(1)
    expect(daysUntilBirthday('2000-02-29', '2028-02-27')).toBe(2)
  })
})
