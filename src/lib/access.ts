import { getSync, type SharedItem } from './sync'

/**
 * ผู้ใช้ร่วมและระดับสิทธิ์ 4 ระดับ (กันที่ระดับแอป — ไม่ใช่การล็อกระดับ GitHub)
 * - แอดมิน: ทำได้ทุกอย่าง จัดการผู้ใช้ ประเภทถวาย งบประมาณ และอนุมัติขั้นสุดท้าย
 * - ผู้บันทึกบัญชี: บันทึกรายรับ นับเงิน นำฝาก อัปโหลดสเตตเมนต์ ทำใบเบิก แนบใบเสร็จ จ่ายเงิน
 * - ผู้ตรวจสอบ: ดูได้ทุกอย่าง ยืนยันยอดนับ (คนที่ 2) รับรองใบเบิก รับรองการจับคู่ธนาคาร แก้ข้อมูลไม่ได้
 * - ดูอย่างเดียว: ดูรายงาน งบประมาณ และภาพรวม (ไม่เห็นรายการรายตัว เลขอ้างอิง ใบเสร็จ)
 * ตัวตน = ชื่อที่ใช้ครั้งแรกบนเครื่องนั้น
 */
export type Role = 'admin' | 'bookkeeper' | 'worship' | 'auditor' | 'viewer'
/** pending = รออนุมัติ · paused = แอดมินพักสิทธิ์ไว้ชั่วคราว */
export type AccessRole = Role | 'pending' | 'paused'
export const ROLES: Role[] = ['admin', 'bookkeeper', 'worship', 'auditor', 'viewer']
export const ROLE_LABEL: Record<Role, string> = { admin: 'แอดมิน', bookkeeper: 'ผู้บันทึกบัญชี', worship: 'ผู้บันทึกการนมัสการ', auditor: 'ผู้ตรวจสอบ', viewer: 'ดูอย่างเดียว' }
export const ROLE_HELP: Record<Role, string> = {
  admin: 'ทำได้ทุกอย่าง · จัดการผู้ใช้ ประเภทถวาย งบประมาณ · อนุมัติใบเบิกขั้นสุดท้าย',
  bookkeeper: 'บันทึกรายรับ นับเงิน นำฝาก อัปโหลดสเตตเมนต์ ทำใบเบิก แนบใบเสร็จ บันทึกการจ่าย',
  worship: 'เห็นเฉพาะเมนูสมาชิก: ลงชื่อนมัสการ ดูยอดผู้มา เพิ่มคนใหม่ แก้ชื่อ รูป เพศ · ไม่เห็นบัญชี เบอร์โทร วันเกิด และเปลี่ยนสถานะทะเบียนไม่ได้',
  auditor: 'ดูได้ทุกอย่าง · ยืนยันยอดนับ (คนที่ 2) · รับรองใบเบิก · รับรองการจับคู่ธนาคาร · แก้ข้อมูลไม่ได้',
  viewer: 'ดูรายงาน งบประมาณ และภาพรวมเท่านั้น (ไม่เห็นรายการรายตัวและใบเสร็จ)',
}

/** pending = ขอร่วมใช้ รออนุมัติ · ไม่มีสถานะ = ใช้งานได้ */
/** role = สิทธิ์หลัก (สูงสุดในรายการ) · roles = สิทธิ์ทั้งหมดถ้ามีมากกว่า 1 (เครื่องรุ่นเก่าอ่านแค่ role ได้ จึงไม่พัง) */
export interface Member extends SharedItem { name: string; role: Role; roles?: Role[]; joined: number; status?: 'active' | 'pending'; invitedFor?: string; paused?: boolean; /** งานที่รับผิดชอบในห้องทำงาน (เลขแท็บ 1–12) — ตั้งโดยแอดมิน · ไม่ใช่สิทธิ์ แค่กำหนดหน้าหลักของคนนั้น */ works?: number[] }

export type Perm =
  | 'members' | 'settings' | 'budget'
  | 'income' | 'count' | 'verifyCount' | 'deposit' | 'statement' | 'signoffRecon'
  | 'voucherCreate' | 'voucherReview' | 'voucherApprove' | 'voucherPay' | 'attach'
  | 'detail' | 'registry' | 'worship'

const PERMS: Record<Role, Perm[]> = {
  admin: ['members', 'settings', 'budget', 'income', 'count', 'verifyCount', 'deposit', 'statement', 'signoffRecon', 'voucherCreate', 'voucherReview', 'voucherApprove', 'voucherPay', 'attach', 'detail', 'registry', 'worship'],
  bookkeeper: ['income', 'count', 'verifyCount', 'deposit', 'statement', 'voucherCreate', 'voucherPay', 'attach', 'detail', 'registry', 'worship'],
  worship: ['worship'],
  auditor: ['verifyCount', 'signoffRecon', 'voucherReview', 'detail'],
  viewer: [],
}
/** ลำดับความสูงของสิทธิ์ ใช้เลือกสิทธิ์หลักเมื่อมีหลายสิทธิ์ */
const RANK: Role[] = ['admin', 'bookkeeper', 'auditor', 'worship', 'viewer']
export const rolesOf = (m: { role: Role; roles?: Role[] }): Role[] => {
  const all = [...new Set([m.role, ...(m.roles ?? [])])].filter((r) => RANK.includes(r))
  return all.length ? all : [m.role]
}
/** สิทธิ์หลัก = สูงสุดตามลำดับ (ใช้แสดง/เปรียบเทียบเดิม) */
export const primaryRole = (roles: Role[]): Role => RANK.find((r) => roles.includes(r)) ?? roles[0] ?? 'viewer'
/** จัดรายการสิทธิ์ให้ถูกต้อง: แอดมินรวมทุกอย่างอยู่แล้ว (เดี่ยว) · ดูอย่างเดียวไม่มีสิทธิ์อื่นร่วม · ไม่ซ้ำ · อย่างน้อย 1 */
export const normalizeRoles = (rs: Role[]): Role[] => {
  const u = [...new Set(rs)].filter((r) => RANK.includes(r))
  if (u.includes('admin')) return ['admin']
  const others: Role[] = u.filter((r) => r !== 'viewer')
  return others.length ? RANK.filter((r) => others.includes(r)) : ['viewer']
}
export const rolesLabel = (rs: Role[]) => rs.map((r) => ROLE_LABEL[r]).join(' + ')
/** สิทธิ์ของเครื่องนี้ (หลายสิทธิ์ได้) — can() รวมสิทธิ์ทุกอันของเครื่องนี้ */
let MY_ROLES: Role[] = []
/** ผู้ใช้ที่มีสิทธิ์หลายอย่าง: can() ของสิทธิ์หลักรวมสิทธิ์ที่เหลือด้วย (can ใช้กับเครื่องนี้เสมอ) */
export const can = (role: AccessRole, p: Perm) => {
  if (role === 'pending' || role === 'paused') return false
  if (PERMS[role].includes(p)) return true
  return MY_ROLES.length > 1 && primaryRole(MY_ROLES) === role && MY_ROLES.some((r) => PERMS[r].includes(p))
}

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
  if (!getSync()) { MY_ROLES = []; return 'admin' }
  const me = getMe()
  const mine = me && readAllMembers().find((m) => m.id === me.id)
  if (mine) {
    if (mine.deleted || mine.status === 'pending') { MY_ROLES = []; return 'pending' }
    if (mine.paused) { MY_ROLES = []; return 'paused' }
    MY_ROLES = rolesOf(mine)
    return primaryRole(MY_ROLES)
  }
  MY_ROLES = []
  return noMembers() ? 'viewer' : 'pending'
}

/** ใช้ก่อนเขียนข้อมูล: true = ถูกกัน (สิทธิ์ไม่พอ) พร้อมแจ้งผู้ใช้ */
export function blocked(p: Perm): boolean {
  if (can(myRole(), p)) return false
  window.dispatchEvent(new Event(READONLY_EVENT))
  return true
}

/** งานที่เครื่องนี้รับผิดชอบในห้องทำงาน (แอดมิน/โหมดทดลอง = ไม่จำกัด คืนว่าง) */
export function myWorks(): number[] {
  if (!getSync() || myRole() === 'admin') return []
  const me = getMe()
  const mine = me && readAllMembers().find((m) => m.id === me.id)
  return (mine && !mine.deleted && mine.works) || []
}

/** หัวหน้าทีม/ผู้นำงาน = ผู้ใช้ที่แอดมินกำหนดงานที่รับผิดชอบไว้ (ตั้งค่า › ผู้ใช้) — ตั้งได้หลายคนต่องาน */
export const isTeamLeader = () => myWorks().length > 0
/** ดูภาพรวมยอดเงิน (หมุนเวียน กองทุน หนี้ — ยอดรวมเท่านั้น ดูอย่างเดียว) ได้: ผู้มีสิทธิ์ดูรายละเอียด หรือหัวหน้าทีมของงานใดงานหนึ่ง */
export const canSeeBalances = (role: AccessRole) => can(role, 'detail') || isTeamLeader()
