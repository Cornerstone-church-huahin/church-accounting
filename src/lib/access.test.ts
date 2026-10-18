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

import { normalizeRoles, primaryRole, rolesOf, rolesLabel } from './access'
describe('หลายสิทธิ์ต่อคน', () => {
  it('rolesOf: รองรับข้อมูลเก่าที่มีแค่ role และข้อมูลใหม่ที่มี roles', () => {
    expect(rolesOf({ role: 'bookkeeper' })).toEqual(['bookkeeper'])
    expect(rolesOf({ role: 'bookkeeper', roles: ['bookkeeper', 'worship'] })).toEqual(['bookkeeper', 'worship'])
  })
  it('primaryRole เลือกสิทธิ์สูงสุด', () => {
    expect(primaryRole(['worship', 'auditor'])).toBe('auditor')
    expect(primaryRole(['worship', 'bookkeeper'])).toBe('bookkeeper')
    expect(primaryRole(['worship'])).toBe('worship')
  })
  it('normalizeRoles: แอดมินเดี่ยว · ดูอย่างเดียวไม่ร่วมกับอื่น · ไม่ซ้ำ · ไม่ว่าง', () => {
    expect(normalizeRoles(['admin', 'worship'])).toEqual(['admin'])
    expect(normalizeRoles(['viewer', 'worship'])).toEqual(['worship'])
    expect(normalizeRoles(['worship', 'bookkeeper', 'worship'])).toEqual(['bookkeeper', 'worship'])
    expect(normalizeRoles([])).toEqual(['viewer'])
  })
  it('rolesLabel เรียงอ่านง่าย', () => {
    expect(rolesLabel(['bookkeeper', 'worship'])).toBe('ผู้บันทึกบัญชี + ผู้บันทึกการนมัสการ')
  })
})
