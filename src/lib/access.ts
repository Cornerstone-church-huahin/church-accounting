import { getSync, type SharedItem } from './sync'

/**
 * ผู้ใช้ร่วมและระดับสิทธิ์ 4 ระดับ (กันที่ระดับแอป — ไม่ใช่การล็อกระดับ GitHub)
 * - แอดมิน: ทำได้ทุกอย่าง จัดการผู้ใช้ ประเภทถวาย งบประมาณ และอนุมัติขั้นสุดท้าย
 * - ผู้บันทึกบัญชี: บันทึกรายรับ นับเงิน นำฝาก อัปโหลดสเตตเมนต์ ทำใบเบิก แนบใบเสร็จ จ่ายเงิน
 * - ผู้ตรวจสอบ: ดูได้ทุกอย่าง ยืนยันยอดนับ (คนที่ 2) รับรองใบเบิก รับรองการจับคู่ธนาคาร แก้ข้อมูลไม่ได้
 * - ดูอย่างเดียว: ดูรายงาน งบประมาณ และภาพรวม (ไม่เห็นรายการรายตัว เลขอ้างอิง ใบเสร็จ)
 * ตัวตน = ชื่อที่ใช้ครั้งแรกบนเครื่องนั้น
 */
export type Role = 'admin' | 'bookkeeper' | 'worship' | 'auditor' | 'fundkeeper' | 'viewer'
/** pending = รออนุมัติ · paused = แอดมินพักสิทธิ์ไว้ชั่วคราว */
export type AccessRole = Role | 'pending' | 'paused'
export const ROLES: Role[] = ['admin', 'bookkeeper', 'worship', 'auditor', 'fundkeeper', 'viewer']
export const ROLE_LABEL: Record<Role, string> = { admin: 'แอดมิน', bookkeeper: 'ผู้บันทึกบัญชี', worship: 'ผู้บันทึกการนมัสการ', fundkeeper: 'ผู้ดูแลกองทุน', auditor: 'ผู้ตรวจสอบ', viewer: 'ดูอย่างเดียว' }
export const ROLE_HELP: Record<Role, string> = {
  admin: 'ทำได้ทุกอย่าง · จัดการผู้ใช้ ประเภทถวาย งบประมาณ · อนุมัติใบเบิกขั้นสุดท้าย',
  bookkeeper: 'บันทึกรายรับ นับเงิน นำฝาก อัปโหลดสเตตเมนต์ ทำใบเบิก แนบใบเสร็จ บันทึกการจ่าย',
  worship: 'เห็นเฉพาะเมนูสมาชิก: ลงชื่อนมัสการ ดูรายงานผู้มา เพิ่มคนใหม่ แก้ชื่อ รูป เพศ · ไม่เห็นบัญชี เบอร์โทร วันเกิด และเปลี่ยนสถานะทะเบียนไม่ได้',
  auditor: 'ดูได้ทุกอย่าง · ยืนยันยอดนับ (คนที่ 2) · รับรองใบเบิก · รับรองการจับคู่ธนาคาร · แก้ข้อมูลไม่ได้',
  fundkeeper: 'เห็นเฉพาะกองทุน (และหมวด) ที่แอดมินกำหนดให้ บันทึกรับ-จ่ายของกองทุนนั้นได้ · ไม่เห็นกองทุนอื่น หน้าแรก ยอดหมุนเวียน เงินยืม หรือเมนูอื่น · เลือกข้อนี้จะยกเลิกสิทธิ์อื่นของคนนั้น',
  viewer: 'ดูรายงาน งบประมาณ และภาพรวมเท่านั้น (ไม่เห็นรายการรายตัวและใบเสร็จ)',
}

/** pending = ขอร่วมใช้ รออนุมัติ · ไม่มีสถานะ = ใช้งานได้ */
/** role = สิทธิ์หลัก (สูงสุดในรายการ) · roles = สิทธิ์ทั้งหมดถ้ามีมากกว่า 1 (เครื่องรุ่นเก่าอ่านแค่ role ได้ จึงไม่พัง) */
export interface FundAssign { id: string; /** จำกัดเฉพาะหมวดเหล่านี้ (ว่าง = ทุกหมวดของกองทุน) */ subs?: string[] }
export interface Member extends SharedItem { /** อุปกรณ์ที่ใช้ส่งคำขอ เช่น “Android · แอปที่ติดตั้ง” (ให้แอดมินดูตอนอนุมัติ) */ device?: string; /** ตำแหน่งที่แอดมินตั้งใจให้ตามลิงก์เชิญ (ใช้ตอนอนุมัติ) */ invitedWork?: { n: number; level: WorkLevel }; /** ตำแหน่งในแต่ละห้องงาน (เลขห้อง → ระดับ) · ไม่ระบุแต่อยู่ใน works = ผู้ดูแลหลัก (ข้อมูลเดิม) */ workRoles?: Record<string, WorkLevel>; /** ผู้ดูแลกองทุน: กองทุน (และหมวด) ที่ดูแล — ตั้งโดยแอดมิน */ funds?: FundAssign[]; name: string; role: Role; roles?: Role[]; joined: number; status?: 'active' | 'pending'; invitedFor?: string; paused?: boolean; /** งานที่รับผิดชอบในห้องทำงาน (เลขแท็บ 1–12) — ตั้งโดยแอดมิน · ไม่ใช่สิทธิ์ แค่กำหนดหน้าหลักของคนนั้น */ works?: number[] }

export type Perm =
  | 'members' | 'settings' | 'budget'
  | 'income' | 'count' | 'verifyCount' | 'deposit' | 'statement' | 'signoffRecon'
  | 'voucherCreate' | 'voucherReview' | 'voucherApprove' | 'voucherPay' | 'attach'
  | 'detail' | 'registry' | 'worship'

const PERMS: Record<Role, Perm[]> = {
  admin: ['members', 'settings', 'budget', 'income', 'count', 'verifyCount', 'deposit', 'statement', 'signoffRecon', 'voucherCreate', 'voucherReview', 'voucherApprove', 'voucherPay', 'attach', 'detail', 'registry', 'worship'],
  bookkeeper: ['income', 'count', 'verifyCount', 'deposit', 'statement', 'voucherCreate', 'voucherPay', 'attach', 'detail', 'registry', 'worship'],
  worship: ['worship'],
  fundkeeper: ['income', 'voucherPay', 'attach'],
  auditor: ['verifyCount', 'signoffRecon', 'voucherReview', 'detail'],
  viewer: [],
}
/** งานเหรัญญิก = งานที่ 3: ตำแหน่งในงานนี้ให้สิทธิ์งานบัญชี (แก้ตารางเดียว) · ผู้ดูแลหลัก = ทำงานบัญชีครบ · ผู้ช่วย/ที่ปรึกษา = ดูรายละเอียดอย่างเดียว · ยืนยันยอด/รับรองใบเบิก = แอดมิน (เพิ่ม "ผู้ตรวจ" เฉพาะจุดภายหลัง) */
export const FINANCE_WORK = 3
const FINANCE_LEAD: Perm[] = ['income', 'count', 'verifyCount', 'deposit', 'statement', 'voucherCreate', 'voucherPay', 'attach', 'detail', 'registry', 'worship']
/** แอดมิน/ผู้ช่วยแอดมินของห้องเหรัญญิก = สิทธิ์เท่าผู้ดูแล (ไม่ขยายสิทธิ์การเงินเกินกว่านี้) */
export const FINANCE_PERMS: Record<WorkLevel, Perm[]> = { owner: FINANCE_LEAD, deputy: FINANCE_LEAD, lead: FINANCE_LEAD, helper: ['detail'], advisor: ['detail'] }
const financeLevel = (): WorkLevel | null => {
  if (!getSync()) return null
  const me = getMe()
  const mine = me && readAllMembers().find((m) => m.id === me.id)
  return mine && !mine.deleted && !mine.paused && mine.status !== 'pending' ? workLevelOf(mine, FINANCE_WORK) : null
}

/** ลำดับความสูงของสิทธิ์ ใช้เลือกสิทธิ์หลักเมื่อมีหลายสิทธิ์ */
const RANK: Role[] = ['admin', 'bookkeeper', 'auditor', 'worship', 'fundkeeper', 'viewer']
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
  // ผู้ดูแลกองทุนเป็นสิทธิ์เฉพาะทาง: อยู่เดี่ยว ๆ · ถ้ามีผู้บันทึกบัญชี/ผู้ตรวจสอบอยู่แล้วเห็นทุกกองทุนอยู่แล้ว ไม่ต้องมีซ้ำ
  if (u.includes('fundkeeper')) return u.includes('bookkeeper') || u.includes('auditor') ? RANK.filter((r) => u.includes(r) && r !== 'fundkeeper') : ['fundkeeper']
  const others: Role[] = u.filter((r) => r !== 'viewer')
  return others.length ? RANK.filter((r) => others.includes(r)) : ['viewer']
}
export const rolesLabel = (rs: Role[]) => rs.map((r) => ROLE_LABEL[r]).join(' + ')
/** สิทธิ์ของเครื่องนี้ (หลายสิทธิ์ได้) — can() รวมสิทธิ์ทุกอันของเครื่องนี้ */
let MY_ROLES: Role[] = []
/** ผู้ใช้ที่มีสิทธิ์หลายอย่าง: can() ของสิทธิ์หลักรวมสิทธิ์ที่เหลือด้วย (can ใช้กับเครื่องนี้เสมอ) */
/** สิทธิ์ตามบทบาทเท่านั้น (ไม่รวมตำแหน่งในงานเหรัญญิก) — ใช้กับห้องงานอื่นที่ "ดูรายละเอียด" ไม่ได้แปลว่าแก้ได้ */
export const canRole = (role: AccessRole, p: Perm) => {
  if (role === 'pending' || role === 'paused') return false
  if (PERMS[role].includes(p)) return true
  return MY_ROLES.length > 1 && primaryRole(MY_ROLES) === role && MY_ROLES.some((r) => PERMS[r].includes(p))
}
export const can = (role: AccessRole, p: Perm) => {
  if (canRole(role, p)) return true
  if (role === 'pending' || role === 'paused') return false
  if (MY_ROLES.length > 0 && primaryRole(MY_ROLES) === role) {
    // ตำแหน่งในงานเหรัญญิก (งาน 3) ให้สิทธิ์งานบัญชีตามระดับ — มาตรฐานเดียวกับทุกงาน
    const fl = financeLevel()
    if (fl && FINANCE_PERMS[fl].includes(p)) return true
    // แอดมิน/ผู้ช่วยแอดมินของงานทะเบียน (งาน 2) = จัดการทะเบียนเต็ม
    const rl = registryRoomLevel()
    if ((rl === 'owner' || rl === 'deputy') && (p === 'detail' || p === 'registry' || p === 'worship')) return true
  }
  return false
}

export const ME_KEY = 'acct.me.v1'
export const MEMBERS_KEY = 'acct.members.v1'
export const INVITE_ROLE_KEY = 'acct.inviteRole'
export const INVITE_FOR_KEY = 'acct.inviteFor'
/** ลิงก์เชิญต่องาน: เก็บ {n: งาน, level: ตำแหน่ง} ที่ตั้งใจให้ไว้ในเครื่องผู้รับจนกว่าจะส่งคำขอ */
export const INVITE_WORK_KEY = 'acct.inviteWork'
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
/**
 * “ดูรายละเอียด” ที่ได้จากตำแหน่งผู้ช่วยงาน/ที่ปรึกษาของห้องเหรัญญิก (เพื่อดูรายงานการเงิน) ใช้แก้ข้อมูลห้องอื่นไม่ได้
 * — สิทธิ์แก้ข้อมูลของห้องอื่นที่อิงสิทธิ์ detail ต้องมาจากบทบาทบัญชี (แอดมิน/ผู้บันทึกบัญชี/ผู้ตรวจ) หรือเป็นผู้ดูแลขึ้นไปของห้องเหรัญญิก
 */
const financeViewOnly = (role: AccessRole): boolean => { const l = financeLevel(); return (l === 'helper' || l === 'advisor') && !canRole(role, 'detail') }
export const canEditDetail = (role: AccessRole): boolean => can(role, 'detail') && !financeViewOnly(role)
/** เช็คสิทธิ์เขียน (เหมือน blocked แต่ detail = สิทธิ์แก้ ไม่รวมสิทธิ์ดูอย่างเดียวของห้องเหรัญญิก) */
export function blockedEdit(p: Perm): boolean {
  if (p !== 'detail') return blocked(p)
  if (canEditDetail(myRole())) return false
  window.dispatchEvent(new Event(READONLY_EVENT))
  return true
}
export function blocked(p: Perm): boolean {
  if (can(myRole(), p)) return false
  window.dispatchEvent(new Event(READONLY_EVENT))
  return true
}

/**
 * ตำแหน่งในห้องงาน (ต่อห้อง): ผู้ดูแลหลัก = แก้ไขได้ทุกอย่างของงานนั้น · ผู้ช่วย = ลงปฏิทินได้ + แชท ที่เหลือดูอย่างเดียว · ที่ปรึกษา = แชท ที่เหลือดูอย่างเดียว
 * แอดมินอยู่เหนือทุกงาน · แก้ตารางนี้ที่เดียว สิทธิ์เปลี่ยนทุกห้องพร้อมกัน
 */
/** ตำแหน่งในห้อง 5 แบบ (สูง → ต่ำ): แอดมิน (owner) · ผู้ช่วยแอดมิน (deputy) · ผู้ดูแล (lead) · ผู้ช่วยงาน (helper) · ที่ปรึกษา (advisor) */
export type WorkLevel = 'owner' | 'deputy' | 'lead' | 'helper' | 'advisor'
export type WorkPerm = 'view' | 'edit' | 'calendar' | 'chat'
export const WORK_LEVELS: WorkLevel[] = ['owner', 'deputy', 'lead', 'helper', 'advisor']
export const WORK_LEVEL_LABEL: Record<WorkLevel, string> = { owner: 'แอดมิน', deputy: 'ผู้ช่วยแอดมิน', lead: 'ผู้ดูแล', helper: 'ผู้ช่วยงาน', advisor: 'ที่ปรึกษา' }
export const WORK_LEVEL_HELP: Record<WorkLevel, string> = {
  owner: 'ทำได้ทุกอย่างในงานนี้ (เหมือนผู้ช่วยแอดมิน) · ไม่รวมสิทธิ์ระดับระบบ เช่น จัดการผู้ใช้',
  deputy: 'ทำได้ทุกอย่างในงานนี้ (เหมือนแอดมินของงาน) · ไม่รวมสิทธิ์ระดับระบบ เช่น จัดการผู้ใช้',
  lead: 'ทำงานในระบบของงานนี้ได้ รวมปฏิทินและแชท · แก้ข้อมูลสมาชิกโดยตรงไม่ได้ เห็น/แก้ได้บางส่วน',
  helper: 'ลงปฏิทินงานและแชทกับแอดมินได้ · ข้อมูลอื่นของงานดูอย่างเดียว',
  advisor: 'แชทกับแอดมินได้ · ที่เหลือดูอย่างเดียว (ลงปฏิทินเองไม่ได้)',
}
/** คำอธิบายตำแหน่ง (ห้องงานทะเบียนมีสิทธิ์ของผู้ช่วยต่างจากห้องอื่น) */
export const workLevelHelp = (l: WorkLevel, n?: number | null): string =>
  n === 2 && (l === 'helper' || l === 'lead') ? 'ลงชื่อนมัสการ ลบรายการลงชื่อที่ลงผิด เพิ่มชื่อผู้มาครั้งแรก เพิ่ม/เปลี่ยนรูปได้ · ดูชื่อ กลุ่ม หมายเหตุ สถานะ วันเกิด (ดูอย่างเดียว) · ไม่เห็นเบอร์โทร ที่อยู่ พิกัด · แก้/ลบสมาชิกไม่ได้'
  : n === 2 && l === 'advisor' ? 'ดูอย่างเดียวทุกไอคอน (รวมสมาชิก รายงาน วันเกิด เพศ) · ลงชื่อ/แก้ไขไม่ได้ · ไม่เห็นเบอร์โทร ที่อยู่ พิกัด'
  : n === 2 ? 'จัดการทะเบียนสมาชิกได้เต็ม (เพิ่ม แก้ ลบ นำเข้า ลิงก์ให้สมาชิกกรอกเอง ฯลฯ)' : WORK_LEVEL_HELP[l]
export const WORK_PERMS: Record<WorkLevel, WorkPerm[]> = { owner: ['view', 'edit', 'calendar', 'chat'], deputy: ['view', 'edit', 'calendar', 'chat'], lead: ['view', 'edit', 'calendar', 'chat'], helper: ['view', 'calendar', 'chat'], advisor: ['view', 'chat'] }
export const levelCan = (l: WorkLevel, p: WorkPerm) => WORK_PERMS[l].includes(p)
/** ตำแหน่งของคนนั้นในห้อง n (null = ไม่ได้อยู่ในห้องนี้) · อยู่ใน works แต่ไม่ได้ระบุตำแหน่ง = ผู้ดูแลหลัก */
export const workLevelOf = (m: { works?: number[]; workRoles?: Record<string, WorkLevel> }, n: number): WorkLevel | null => {
  const r = m.workRoles?.[String(n)]
  if (r && WORK_LEVELS.includes(r) && m.works?.includes(n)) return r
  return m.works?.includes(n) ? 'lead' : null
}
/** งานทะเบียน = งานที่ 2: ผู้ช่วยฝ่ายทะเบียน = ลงชื่อ/ลบรายการลงชื่อที่ลงผิดได้ · ดูชื่อ ชื่อเล่น กลุ่ม รูป หมายเหตุ สถานะ (ดูอย่างเดียว) · ไม่เห็นข้อมูลส่วนตัวอื่น · แก้/ลบสมาชิกไม่ได้ · ไม่ล็อกให้เห็นแค่หน้าเดียว (บทบาทบัญชียังเป็นเดิม) */
export const REGISTRY_WORK = 2
/** ตำแหน่งของเครื่องนี้ในห้อง n: 'admin' (แอดมิน/โหมดทดลอง) · ผู้ดูแลหลัก/ผู้ช่วย/ที่ปรึกษา · null */
export function myWorkLevel(n: number): 'admin' | WorkLevel | null {
  if (!getSync() || myRole() === 'admin') return 'admin'
  const me = getMe()
  const mine = me && readAllMembers().find((m) => m.id === me.id)
  return mine && !mine.deleted ? workLevelOf(mine, n) : null
}
/** เป็นผู้ช่วยฝ่ายทะเบียนอยู่หรือไม่ (ตำแหน่ง “ผู้ช่วย” ในงานที่ 2 และบทบาทบัญชีไม่ได้ให้สิทธิ์สมาชิกอยู่แล้ว) */
const registryRoomLevel = (): WorkLevel | null => {
  if (!getSync()) return null
  const me = getMe()
  const mine = me && readAllMembers().find((m) => m.id === me.id)
  return mine && !mine.deleted && !mine.paused && mine.status !== 'pending' ? workLevelOf(mine, REGISTRY_WORK) : null
}
export const isRegistryHelper = (): boolean => { const l = registryRoomLevel(); return (l === 'lead' || l === 'helper' || l === 'advisor') && !canRole(myRole(), 'worship') && !canRole(myRole(), 'detail') }
/** ผู้ดูแล/ผู้ช่วยงานของห้องทะเบียนลงชื่อได้ · ที่ปรึกษาดูอย่างเดียว */
export const registryCanSign = (): boolean => { const l = registryRoomLevel(); return l === 'lead' || l === 'helper' }
/** เครื่องนี้ทำ perm ในห้อง n ได้ไหม (ตามตำแหน่งในห้อง — ไม่รวมสิทธิ์ตามบทบาทบัญชี) */
export const canWork = (n: number, p: WorkPerm): boolean => { const l = myWorkLevel(n); return l === 'admin' || (!!l && levelCan(l, p)) }
/** ลงปฏิทินของงาน n ได้: บทบาทที่มีสิทธิ์ดูรายละเอียด หรือเป็นผู้ดูแลหลัก/ผู้ช่วยของงานนั้น (ทั่วไป n=0 = เฉพาะบทบาทที่มีสิทธิ์) */
export const canCalendarFor = (n: number): boolean => canRole(myRole(), 'detail') || (n > 0 && canWork(n, 'calendar'))
/** เขียนปฏิทินได้บ้างไหม (ไว้ตรวจก่อนบันทึก) */
export const calendarWritable = (): boolean => {
  if (canRole(myRole(), 'detail')) return true
  if (!myWorks().some((n) => canWork(n, 'calendar'))) { window.dispatchEvent(new Event(READONLY_EVENT)); return false }
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

/** ผู้ดูแลกองทุน: กองทุน/หมวดที่ได้รับมอบหมาย (บทบาทอื่น = ไม่จำกัด คืน null) */
export function myFunds(): FundAssign[] | null {
  if (!getSync() || myRole() !== 'fundkeeper') return null
  const me = getMe()
  const mine = me && readAllMembers().find((m) => m.id === me.id)
  return (mine && !mine.deleted && mine.funds) || []
}
