import { describe, expect, it } from 'vitest'
import { can, ROLES, ROLE_LABEL, type Perm } from './access'

const ACCOUNTING: Perm[] = ['income', 'count', 'verifyCount', 'deposit', 'statement', 'signoffRecon', 'voucherCreate', 'voucherReview', 'voucherApprove', 'voucherPay', 'attach', 'detail', 'budget', 'settings', 'members']

describe('สิทธิ์ผู้บันทึกการนมัสการ', () => {
  it('ทำได้เฉพาะลงชื่อ/แก้ข้อมูลพื้นฐานของสมาชิก ไม่แตะบัญชีและทะเบียนขั้นสูง', () => {
    expect(can('worship', 'worship')).toBe(true)
    for (const p of ACCOUNTING) expect(can('worship', p), p).toBe(false)
    expect(can('worship', 'registry')).toBe(false) // นำเข้า/เปลี่ยนสถานะ/ลบ
  })
  it('แอดมินและผู้บันทึกบัญชียังลงชื่อได้ ผู้ตรวจสอบและดูอย่างเดียวไม่ได้', () => {
    expect(can('admin', 'worship')).toBe(true)
    expect(can('bookkeeper', 'worship')).toBe(true)
    expect(can('auditor', 'worship')).toBe(false)
    expect(can('viewer', 'worship')).toBe(false)
  })
  it('ผู้ที่ถูกพักสิทธิ์หรือรออนุมัติทำอะไรไม่ได้เลย', () => {
    for (const r of ['paused', 'pending'] as const) for (const p of [...ACCOUNTING, 'worship', 'registry'] as Perm[]) expect(can(r, p), `${r}:${p}`).toBe(false)
  })
  it('มีชื่อเรียกครบทุกระดับ', () => {
    expect(ROLES).toContain('worship')
    for (const r of ROLES) expect(ROLE_LABEL[r]).toBeTruthy()
    expect(ROLE_LABEL.worship).toBe('ผู้บันทึกการนมัสการ')
  })
})
