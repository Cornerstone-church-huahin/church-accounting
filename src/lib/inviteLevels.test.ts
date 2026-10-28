import { describe, expect, it } from 'vitest'
import { can } from './access'
import { INVITE_LEVELS, levelOf } from './inviteLevels'

describe('ระดับการใช้งาน 3 ระดับในลิงก์เชิญ', () => {
  it('มี 3 ระดับ เรียง ผู้ดู → ผู้บันทึก → ผู้ตรวจสอบ และแต่ละระดับมีคำอธิบายทำได้/ไม่ได้', () => {
    expect(INVITE_LEVELS.map((l) => l.role)).toEqual(['viewer', 'bookkeeper', 'auditor'])
    for (const l of INVITE_LEVELS) { expect(l.can.length).toBeGreaterThan(0); expect(l.cannot.length).toBeGreaterThan(0) }
  })
  it('คำอธิบายตรงกับสิทธิ์จริงของแอป', () => {
    expect(can('viewer', 'income') || can('viewer', 'detail')).toBe(false)
    expect(can('bookkeeper', 'income') && can('bookkeeper', 'voucherCreate') && can('bookkeeper', 'statement')).toBe(true)
    expect(can('bookkeeper', 'members') || can('bookkeeper', 'settings') || can('bookkeeper', 'voucherApprove')).toBe(false)
    expect(can('auditor', 'verifyCount') && can('auditor', 'voucherReview') && can('auditor', 'signoffRecon') && can('auditor', 'detail')).toBe(true)
    expect(can('auditor', 'income') || can('auditor', 'voucherPay') || can('auditor', 'settings')).toBe(false)
  })
  it('levelOf: ไม่รู้จัก = ผู้ดู', () => { expect(levelOf('worship').role).toBe('viewer'); expect(levelOf('auditor').n).toBe(3) })
})
