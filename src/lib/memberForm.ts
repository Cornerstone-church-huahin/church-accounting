import { APP_CREDIT } from './credit'
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
  /** วันที่คริสตจักรรับเป็นสมาชิก (ไม่บังคับ) YYYY-MM-DD */
  since?: string
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
  /** วันที่คริสตจักรรับเป็นสมาชิก (ไม่บังคับ) YYYY-MM-DD */
  since?: string
  note?: string
  /** เวลาที่สมาชิกกดส่ง (ms) — ไว้เทียบเมื่อส่งซ้ำหลายครั้ง */
  at?: number
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
  return { v: 1, mid: m.id, code: m.code, name: m.name, nick: m.nick, tel: m.tel, lineId: m.lineId, facebook: m.facebook, skills: m.skills, serve: m.serve, serveDays: m.serveDays, gender: m.gender, birth: m.birth, first: m.firstWorship, since: m.since, exp: now + FORM_DAYS * 86_400_000 }
}
/**
 * รหัสในลิงก์รุ่นกะทัดรัด (v2 · ขึ้นต้น “2.”): ช่องคั่นด้วย | · ตัวอักษรไทยเก็บเป็น 1 ไบต์ (TIS-620) แทน 3 ไบต์ของ UTF-8
 * · งานรับใช้/วันเก็บเป็นลำดับข้อ · วันที่เป็น YYYYMMDD → ลิงก์สั้นลงราว 2 เท่า (รุ่น v1 แบบ JSON ยังเปิดได้)
 */
const toTis = (t: string): number[] => Array.from(t).map((ch) => {
  const c = ch.charCodeAt(0)
  if (c < 0x80) return c
  if (c >= 0x0e01 && c <= 0x0e3a) return c - 0x0e01 + 0xa1
  if (c >= 0x0e3f && c <= 0x0e5b) return c - 0x0e3f + 0xdf
  return 0x3f
})
const fromTis = (bytes: number[]): string => bytes.map((c) => (c < 0x80 ? String.fromCharCode(c) : c >= 0xa1 && c <= 0xda ? String.fromCharCode(c - 0xa1 + 0x0e01) : c >= 0xdf && c <= 0xfb ? String.fromCharCode(c - 0xdf + 0x0e3f) : '?')).join('')
const bytesToB64 = (b: number[]) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64ToBytes = (s: string): number[] => Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/'))).map((c) => c.charCodeAt(0))
const clean = (x?: string) => (x ?? '').replace(/\|/g, '/')
const d8 = (iso?: string) => (iso ?? '').replace(/-/g, '')
const iso8 = (x: string) => (/^\d{8}$/.test(x) ? `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6)}` : undefined)
const G = ['', 'ชาย', 'หญิง']
export function encodeFormLink(p: FormLink): string {
  const serve = p.serve ?? []
  const idx = serve.map((x) => SERVE_OPTIONS.indexOf(x)).filter((i) => i >= 0)
  const otherItem = serve.find((x) => x === OTHER_SERVE || x.startsWith(`${OTHER_SERVE}: `))
  const other = otherItem ? (otherItem === OTHER_SERVE ? '*' : otherItem.slice(OTHER_SERVE.length + 2)) : ''
  const days = (p.serveDays ?? []).map((x) => DAY_OPTIONS.indexOf(x)).filter((i) => i >= 0)
  const f = [p.mid, p.code ?? '', p.name, p.nick ?? '', p.tel ?? '', String(Math.max(0, G.indexOf(p.gender ?? ''))), d8(p.birth), d8(p.first), Math.round(p.exp / 60000).toString(36), p.lineId ?? '', p.facebook ?? '', p.skills ?? '', idx.join(','), other, days.join(','), d8(p.since)].map(clean)
  while (f.length > 9 && f[f.length - 1] === '') f.pop()   // ตัดช่องท้ายที่ว่าง
  return '2.' + bytesToB64(toTis(f.join('|')))
}
function decodeV2(d: string): FormLink | null {
  const f = fromTis(b64ToBytes(d.slice(2))).split('|')
  if (f.length < 9) return null
  const [mid, code, name, nick, tel, g, birth, first, exp36, lineId, facebook, skills, idx = '', other = '', days = '', since = ''] = f
  const serve = [...idx.split(',').filter(Boolean).map((i) => SERVE_OPTIONS[Number(i)]).filter(Boolean), ...(other ? [other === '*' ? OTHER_SERVE : `${OTHER_SERVE}: ${other}`] : [])]
  const serveDays = days.split(',').filter(Boolean).map((i) => DAY_OPTIONS[Number(i)]).filter(Boolean)
  const exp = parseInt(exp36, 36) * 60000
  if (!mid || !name || !Number.isFinite(exp)) return null
  return { v: 1, mid, code: code || undefined, name, nick: nick || undefined, tel: tel || undefined, gender: G[Number(g)] || undefined, birth: iso8(birth), first: iso8(first), since: iso8(since), lineId: lineId || undefined, facebook: facebook || undefined, skills: skills || undefined, serve: serve.length ? serve : undefined, serveDays: serveDays.length ? serveDays : undefined, exp }
}
export function decodeFormLink(d: string | null): FormLink | null {
  if (!d) return null
  try {
    if (d.startsWith('2.')) return decodeV2(d)
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
    `คริสตจักรรับเป็นสมาชิกเมื่อ: ${a.since ? fmtDate(a.since) : ''}`,
    ...(a.note?.trim() ? [`หมายเหตุ: ${a.note.trim()}`] : []),
    ...(a.at ? [`ส่งเมื่อ: ${new Date(a.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`] : []),
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

/** ข้อความมาตรฐานที่ส่งพร้อมลิงก์รายบุคคล (ใช้ชื่อของคนที่ส่งให้ — ลิงก์เป็นของเขาคนเดียว) */
export function personalInvite(m: { name: string; nick?: string }, url: string): string {
  const who = m.nick ? `${m.name} (${m.nick})` : m.name
  return [
    `เรียน ${who}`,
    '',
    'ฝ่ายทะเบียน คริสตจักรศิลาเอก ขอความกรุณาตรวจและกรอกข้อมูลสมาชิกของท่านให้เป็นปัจจุบัน เพื่อใช้ในการดูแลและติดต่อสื่อสารภายในคริสตจักร',
    '',
    `📝 ลิงก์นี้เป็นลิงก์เฉพาะของ “${m.name}” เท่านั้น (กรุณาไม่ส่งต่อ)`,
    'กดลิงก์เพื่อตรวจและกรอกข้อมูล:',
    url,
    '',
    'ในแบบฟอร์ม',
    '• ข้อมูลที่เรามีอยู่แล้วจะขึ้นให้ ตรวจดูให้ถูกต้อง แก้ไขได้ทุกจุด',
    '• ช่องไหนยังว่าง กรุณากรอกให้ครบ',
    '• เสร็จแล้วกด “ส่งกลับทางไลน์” แล้วกดส่งข้อความถึงฝ่ายทะเบียนอีกครั้งหนึ่ง (ใช้เวลาประมาณ 3 นาที)',
    '',
    `⏳ ลิงก์นี้ใช้ได้ ${FORM_DAYS} วัน — ในช่วงนี้ท่านเปิดลิงก์ซ้ำเพื่อแก้ไขหรือเพิ่มเติมข้อมูลได้ (สิ่งที่ท่านกรอกไว้ครั้งก่อนจะยังอยู่ในเครื่องของท่าน)`,
    'ถ้าหาข้อมูลได้เพิ่มภายหลัง ให้กรอกเพิ่มแล้วกด “ส่งกลับทางไลน์” อีกครั้ง ฝ่ายทะเบียนจะใช้ข้อมูลล่าสุดที่ท่านส่ง',
    '',
    'ขอบพระคุณมาก 🙏',
    '',
    `— ${APP_CREDIT}`,
  ].join('\n')
}
/** ข้อความมาตรฐานสำหรับลิงก์ส่งทั้งกลุ่ม */
export function groupInvite(url: string): string {
  return [
    'เรียน พี่น้องสมาชิกคริสตจักรศิลาเอก',
    '',
    'ฝ่ายทะเบียน ขอความกรุณาท่านกรอกข้อมูลสมาชิกให้เป็นปัจจุบัน เพื่อใช้ในการดูแลและติดต่อสื่อสารภายในคริสตจักร',
    '',
    'กดลิงก์เพื่อกรอกข้อมูล:',
    url,
    '',
    'ในแบบฟอร์ม',
    '• พิมพ์ชื่อ-นามสกุลจริงให้ตรงกับที่ลงทะเบียนไว้',
    '• กรอกข้อมูลให้ครบ',
    '• เสร็จแล้วกด “ส่งกลับทางไลน์” แล้วกดส่งข้อความถึงฝ่ายทะเบียนอีกครั้งหนึ่ง (ใช้เวลาประมาณ 3 นาที)',
    '',
    'ท่านเปิดลิงก์ซ้ำเพื่อแก้ไขหรือเพิ่มเติมข้อมูลได้ (สิ่งที่กรอกไว้ครั้งก่อนจะยังอยู่ในเครื่องของท่าน) ถ้าหาข้อมูลได้เพิ่มภายหลัง ให้กรอกเพิ่มแล้วกด “ส่งกลับทางไลน์” อีกครั้ง',
    '',
    'ขอบพระคุณมาก 🙏',
    '',
    `— ${APP_CREDIT}`,
  ].join('\n')
}
