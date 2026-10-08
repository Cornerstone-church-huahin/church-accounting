import { getSync, type SharedItem } from './sync'

/**
 * ผู้ใช้ร่วมและระดับสิทธิ์ 4 ระดับ (กันที่ระดับแอป — ไม่ใช่การล็อกระดับ GitHub)
 * - แอดมิน: ทำได้ทุกอย่าง จัดการผู้ใช้ ประเภทถวาย งบประมาณ และอนุมัติขั้นสุดท้าย
 * - ผู้บันทึกบัญชี: บันทึกรายรับ นับเงิน นำฝาก อัปโหลดสเตตเมนต์ ทำใบเบิก แนบใบเสร็จ จ่ายเงิน
 * - ผู้ตรวจสอบ: ดูได้ทุกอย่าง ยืนยันยอดนับ (คนที่ 2) รับรองใบเบิก รับรองการจับคู่ธนาคาร แก้ข้อมูลไม่ได้
 * - ดูอย่างเดียว: ดูรายงาน งบประมาณ และภาพรวม (ไม่เห็นรายการรายตัว เลขอ้างอิง ใบเสร็จ)
 * ตัวตน = ชื่อที่ใช้ครั้งแรกบนเครื่องนั้น
 */
export type Role = 'admin' | 'bookkeeper' | 'auditor' | 'viewer'
export type AccessRole = Role | 'pending'
export const ROLES: Role[] = ['admin', 'bookkeeper', 'auditor', 'viewer']
export const ROLE_LABEL: Record<Role, string> = { admin: 'แอดมิน', bookkeeper: 'ผู้บันทึกบัญชี', auditor: 'ผู้ตรวจสอบ', viewer: 'ดูอย่างเดียว' }
export const ROLE_HELP: Record<Role, string> = {
  admin: 'ทำได้ทุกอย่าง · จัดการผู้ใช้ ประเภทถวาย งบประมาณ · อนุมัติใบเบิกขั้นสุดท้าย',
  bookkeeper: 'บันทึกรายรับ นับเงิน นำฝาก อัปโหลดสเตตเมนต์ ทำใบเบิก แนบใบเสร็จ บันทึกการจ่าย',
  auditor: 'ดูได้ทุกอย่าง · ยืนยันยอดนับ (คนที่ 2) · รับรองใบเบิก · รับรองการจับคู่ธนาคาร · แก้ข้อมูลไม่ได้',
  viewer: 'ดูรายงาน งบประมาณ และภาพรวมเท่านั้น (ไม่เห็นรายการรายตัวและใบเสร็จ)',
}

/** pending = ขอร่วมใช้ รออนุมัติ · ไม่มีสถานะ = ใช้งานได้ */
export interface Member extends SharedItem { name: string; role: Role; joined: number; status?: 'active' | 'pending'; invitedFor?: string }

export type Perm =
  | 'members' | 'settings' | 'budget'
  | 'income' | 'count' | 'verifyCount' | 'deposit' | 'statement' | 'signoffRecon'
  | 'voucherCreate' | 'voucherReview' | 'voucherApprove' | 'voucherPay' | 'attach'
  | 'detail'

const PERMS: Record<Role, Perm[]> = {
  admin: ['members', 'settings', 'budget', 'income', 'count', 'verifyCount', 'deposit', 'statement', 'signoffRecon', 'voucherCreate', 'voucherReview', 'voucherApprove', 'voucherPay', 'attach', 'detail'],
  bookkeeper: ['income', 'count', 'verifyCount', 'deposit', 'statement', 'voucherCreate', 'voucherPay', 'attach', 'detail'],
  auditor: ['verifyCount', 'signoffRecon', 'voucherReview', 'detail'],
  viewer: [],
}
export const can = (role: AccessRole, p: Perm) => role !== 'pending' && PERMS[role].includes(p)

export const ME_KEY = 'acct.me.v1'
export const MEMBERS_KEY = 'acct.members.v1'
export const INVITE_ROLE_KEY = 'acct.inviteRole'
export const INVITE_FOR_KEY = 'acct.inviteFor'
export const READONLY_EVENT = 'acct-readonly'
export const ROLE_EVENT = 'acct-role'
export const STORE_EVENT = 'acct-store'

/** รหัสสั้นคงที่จากชื่อ (ไม่ใช่ความลับ) ใช้แยกคน */
export function personIdOf(name: string): string {
  const s = name.trim().toLowerCase().normalize('NFC')
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `p${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`
}

/** ตัวตนของเครื่องนี้ · ยังไม่เชื่อมออนไลน์ = ผู้ใช้ทดลองคนเดียว */
export function getMe(): { id: string; name: string } | null {
  const cfg = getSync()
  let saved: { id: string } | null = null
  try { saved = JSON.parse(localStorage.getItem(ME_KEY) ?? 'null') } catch { /* ignore */ }
  if (saved?.id) return { id: saved.id, name: cfg?.name.trim() || '' }
  if (!cfg || !cfg.name.trim()) return null
  const id = personIdOf(cfg.name)
  try { localStorage.setItem(ME_KEY, JSON.stringify({ id })) } catch { /* ignore */ }
  return { id, name: cfg.name.trim() }
}
/** โหมดทดลองคนเดียว (ยังไม่เชื่อมออนไลน์): ข้ามกฎ "ต้องเป็นคนละคน" เพื่อให้ลองใช้ได้ครบทุกขั้นตอน */
export const isSolo = () => !getSync()
/** ใช้บันทึกว่าใครทำรายการ — ถ้ายังไม่เชื่อมออนไลน์ใช้ "ผู้ใช้ทดลอง" */
export const whoAmI = () => getMe() ?? { id: 'local', name: 'ผู้ใช้ทดลอง' }

export function readAllMembers(): Member[] {
  try {
    const v = JSON.parse(localStorage.getItem(MEMBERS_KEY) ?? 'null')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

const noMembers = () => readAllMembers().filter((m) => !m.deleted).length === 0

/** สิทธิ์ของเครื่องนี้ · ยังไม่เชื่อมออนไลน์ = ใช้คนเดียว (ทำได้ทุกอย่าง) · ยังไม่มีแอดมิน = ดูอย่างเดียวชั่วคราว */
export function myRole(): AccessRole {
  if (!getSync()) return 'admin'
  const me = getMe()
  const mine = me && readAllMembers().find((m) => m.id === me.id)
  if (mine) return mine.deleted ? 'pending' : mine.status === 'pending' ? 'pending' : mine.role
  return noMembers() ? 'viewer' : 'pending'
}

/** ใช้ก่อนเขียนข้อมูล: true = ถูกกัน (สิทธิ์ไม่พอ) พร้อมแจ้งผู้ใช้ */
export function blocked(p: Perm): boolean {
  if (can(myRole(), p)) return false
  window.dispatchEvent(new Event(READONLY_EVENT))
  return true
}
