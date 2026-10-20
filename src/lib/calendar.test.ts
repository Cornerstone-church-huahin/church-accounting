import { describe, expect, it } from 'vitest'
import { canTouchEvent } from './calendar'

describe('สิทธิ์แก้ไข/ลบกิจกรรมปฏิทิน', () => {
  it('เฉพาะผู้บันทึกและแอดมิน', () => {
    expect(canTouchEvent({ recId: 'a' }, 'a', false)).toBe(true)
    expect(canTouchEvent({ recId: 'a' }, 'b', false)).toBe(false)
    expect(canTouchEvent({ recId: 'a' }, 'b', true)).toBe(true)
    expect(canTouchEvent({}, 'b', false)).toBe(true) // รายการเก่าไม่มีผู้บันทึก
  })
})
