import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { can, canRole, FINANCE_PERMS, myRole } from './access'

const store = new Map<string, string>()
const as = (members: object[], me: string) => {
  store.set('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 't', name: me }))
  store.set('acct.me.v1', JSON.stringify({ id: me }))
  store.set('acct.members.v1', JSON.stringify(members))
  return myRole()
}
beforeEach(() => { store.clear(); vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }) })
afterEach(() => { vi.unstubAllGlobals() })
const m = (id: string, extra: object = {}) => ({ id, name: id, role: 'viewer', status: 'active', joined: 1, updated: 1, ...extra })

describe('ตำแหน่งในงานเหรัญญิก (งาน 3) = มาตรฐานเดียวกับทุกงาน', () => {
  it('ผู้ดูแลหลักงาน 3 ทำงานบัญชีได้ครบ · ผู้ช่วย/ที่ปรึกษาดูรายละเอียดอย่างเดียว · ไม่มีตำแหน่ง = ไม่ได้', () => {
    let r = as([m('a', { works: [3] })], 'a') // ไม่ระบุตำแหน่ง = ผู้ดูแลหลัก
    expect(can(r, 'income') && can(r, 'voucherPay') && can(r, 'deposit') && can(r, 'statement') && can(r, 'detail')).toBe(true)
    expect(can(r, 'settings') || can(r, 'voucherApprove') || can(r, 'members')).toBe(false)
    r = as([m('b', { works: [3], workRoles: { 3: 'helper' } })], 'b')
    expect(can(r, 'detail')).toBe(true)
    expect(can(r, 'income') || can(r, 'voucherPay') || can(r, 'statement')).toBe(false)
    r = as([m('c', { works: [3], workRoles: { 3: 'advisor' } })], 'c')
    expect(can(r, 'detail') && !can(r, 'income')).toBe(true)
    r = as([m('d', { works: [5] })], 'd')
    expect(can(r, 'detail') || can(r, 'income')).toBe(false)
  })
  it('ตำแหน่งงานเหรัญญิกไม่ทำให้แก้ห้องงานอื่นได้ (canRole ไม่นับตำแหน่ง) · ยืนยันยอด/รับรองใบเบิกยังไม่ให้ใคร นอกจากแอดมิน', () => {
    const r = as([m('b', { works: [3], workRoles: { 3: 'helper' } })], 'b')
    expect(can(r, 'detail')).toBe(true)
    expect(canRole(r, 'detail')).toBe(false)
    expect(FINANCE_PERMS.lead).not.toContain('voucherReview')
    expect(FINANCE_PERMS.lead).not.toContain('signoffRecon')
    expect(FINANCE_PERMS.helper).toEqual(['detail'])
  })
})
