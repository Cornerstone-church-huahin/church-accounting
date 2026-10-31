import { fmtDate } from './money'
import type { ChurchMember } from './types'

/**
 * ลิงก์ให้สมาชิกกรอกข้อมูลเอง (ไม่ต้องเข้าแอป ไม่มีรหัสเขียนข้อมูลในลิงก์):
 * ลิงก์พก “สมาชิกคนไหน + ข้อมูลเดิม” → สมาชิกกรอก → ส่งข้อความกลับทางไลน์ → ฝ่ายทะเบียนวางตรวจและนำเข้า
 */
export interface FormLink {
  v: 1
  /** รหัสภายในของสมาชิก (ไว้จับคู่ตอนนำเข้า) */
  mid: string
  code?: string
  name: string
  nick?: string
  tel?: string
  lineId?: string
  facebook?: string
  skills?: string
  /** งานรับใช้ที่เต็มใจ (ข้อ “อื่นๆ” ขึ้นเป็น อื่นๆ: …) */
  serve?: string[]
  serveDays?: string[]
  gender?: string
  birth?: string
  /** วันที่มานมัสการครั้งแรก (โดยประมาณ) YYYY-MM-DD */
  first?: string
  /** หมดอายุ (ms) */
  exp: number
}
/** ข้อมูลที่สมาชิกกรอกกลับ */
export interface FormAnswer {
  mid: string
  code?: string
  name: string
  nick?: string
  tel?: string
  lineId?: string
  facebook?: string
  skills?: string
  /** งานรับใช้ที่เต็มใจ (ข้อ “อื่นๆ” ขึ้นเป็น อื่นๆ: …) */
  serve?: string[]
  serveDays?: string[]
  gender?: string
  birth?: string
  /** วันที่มานมัสการครั้งแรก (โดยประมาณ) YYYY-MM-DD */
  first?: string
  note?: string
}
export const FORM_DAYS = 14
/** ลิงก์กลุ่ม: ส่งทีเดียวในห้องแชตที่มีหลายคน — ทุกคนกดลิงก์เดียวกัน แล้ว “เลือกชื่อของตัวเอง” จากรายชื่อ (มีเฉพาะ รหัส/ชื่อ/ชื่อเล่น ไม่มีข้อมูลส่วนตัวอื่น) */
export interface GroupLink { v: 2; list: { id: string; name: string; nick?: string }[]; exp: number }
export const GROUP_MAX = 80
export const NEW_MID = 'new'
/** ลิงก์ทั่วไป (สั้น) สำหรับส่งทั้งกลุ่ม: ไม่มีรายชื่อในลิงก์ — สมาชิกพิมพ์ชื่อเอง ฝ่ายทะเบียนจับคู่จากชื่อตอนวางข้อความ */
export const BY_NAME = 'by-name'
export const generalFormUrl = (base = `${location.origin}${location.pathname}`) => `${base}#/form`
/** งานรับใช้ในคริสตจักร (ติ๊กได้หลายข้อ · มี “อื่นๆ” ให้พิมพ์เอง) */
export const SERVE_OPTIONS = [
  'นำนมัสการ / ร้องเพลง / คณะนักร้อง', 'ดนตรี (เครื่องดนตรี)', 'เครื่องเสียง', 'โปรเจกเตอร์ / สไลด์ / ถ่ายทอดสด',
  'ถ่ายภาพ / วิดีโอ', 'ต้อนรับ / ลงชื่อ / ประสานงาน', 'ครัว / อาหาร / เครื่องดื่ม', 'จัดสถานที่ / ดอกไม้ / ตกแต่ง',
  'ทำความสะอาด / ซ่อมบำรุง / ช่าง', 'โรงเรียนอาทิตย์ / ดูแลเด็ก', 'อนุชน / เยาวชน', 'เยี่ยมเยียน / อภิบาล / ติดตามผู้ใหม่',
  'อธิษฐานเผื่อ', 'ขับรถ / รับส่ง', 'บัญชี / การเงิน / เอกสาร', 'ออกแบบ / สื่อ / โซเชียล / ประชาสัมพันธ์', 'แปลภาษา',
]
export const OTHER_SERVE = 'อื่นๆ'
export const DAY_OPTIONS = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'ยืดหยุ่น / ตามนัด']

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function makeGroupLink(ms: { id: string; name: string; nick?: string }[], now = Date.now()): GroupLink {
  return { v: 2, list: ms.map((m) => ({ id: m.id, name: m.name, ...(m.nick ? { nick: m.nick } : {}) })), exp: now + FORM_DAYS * 86_400_000 }
}
export function decodeGroupLink(d: string | null): GroupLink | null {
  if (!d) return null
  try {
    const g = JSON.parse(unb64(d)) as GroupLink
    return g && g.v === 2 && Array.isArray(g.list) && typeof g.exp === 'number' ? g : null
  } catch { return null }
}
export const groupUrl = (ms: { id: string; name: string; nick?: string }[], base = `${location.origin}${location.pathname}`) => `${base}#/form?d=${b64(JSON.stringify(makeGroupLink(ms)))}`
export function makeFormLink(m: ChurchMember, now = Date.now()): FormLink {
  return { v: 1, mid: m.id, code: m.code, name: m.name, nick: m.nick, tel: m.tel, lineId: m.lineId, facebook: m.facebook, skills: m.skills, serve: m.serve, serveDays: m.serveDays, gender: m.gender, birth: m.birth, first: m.since, exp: now + FORM_DAYS * 86_400_000 }
}
export const encodeFormLink = (p: FormLink) => b64(JSON.stringify(p))
export function decodeFormLink(d: string | null): FormLink | null {
  if (!d) return null
  try {
    const p = JSON.parse(unb64(d)) as FormLink
    return p && p.v === 1 && typeof p.mid === 'string' && typeof p.name === 'string' && typeof p.exp === 'number' ? p : null
  } catch { return null }
}
/** ลิงก์เต็มของแบบฟอร์ม (หน้า #/form) บนที่อยู่แอปปัจจุบัน */
export const formUrl = (m: ChurchMember, base = `${location.origin}${location.pathname}`) => `${base}#/form?d=${encodeFormLink(makeFormLink(m))}`

/** ข้อความที่สมาชิกส่งกลับ: บรรทัดอ่านง่าย + บรรทัดรหัสตรวจท้ายสุดให้แอปอ่านตอนนำเข้า */
export function replyText(a: FormAnswer): string {
  const lines = [
    '📝 ข้อมูลสมาชิก (ส่งกลับให้ฝ่ายทะเบียน คริสตจักรศิลาเอก)',
    `ชื่อ-สกุล: ${a.name}`,
    `ชื่อเล่น: ${a.nick ?? ''}`,
    `โทรศัพท์: ${a.tel ?? ''}`,
    `LINE ID: ${a.lineId ?? ''}`,
    `Facebook: ${a.facebook ?? ''}`,
    `เพศ: ${a.gender ?? ''}`,
    `วันเกิด: ${a.birth ? fmtDate(a.birth) : ''}`,
    `อาชีพ/ความสามารถ: ${a.skills ?? ''}`,
    `งานรับใช้ที่เต็มใจ: ${a.serve?.join(', ') ?? ''}`,
    `วันที่สะดวกรับใช้: ${a.serveDays?.join(', ') ?? ''}`,
    `มานมัสการครั้งแรก (ประมาณ): ${a.first ? fmtDate(a.first) : ''}`,
    ...(a.note?.trim() ? [`หมายเหตุ: ${a.note.trim()}`] : []),
    `— รหัสตรวจ: ${b64(JSON.stringify(a))}`,
  ]
  return lines.join('\n')
}
/** อ่านข้อความที่ส่งกลับ (ฝั่งฝ่ายทะเบียน) — ไม่พบ/เสียหาย = null */
export function parseReply(text: string): FormAnswer | null {
  const m = /รหัสตรวจ:\s*([A-Za-z0-9_-]+)/.exec(text)
  if (!m) return null
  try {
    const a = JSON.parse(unb64(m[1])) as FormAnswer
    return a && typeof a.mid === 'string' && typeof a.name === 'string' ? a : null
  } catch { return null }
}
