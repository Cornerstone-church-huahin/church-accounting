import { normThai } from './memberSearch'
import type { ChurchMember } from './types'

/** ข้อมูลที่อ่านได้จากภาพสลิป/แชตสำหรับจับคู่ผู้ถวายกับทะเบียนสมาชิก */
export interface DonorHint { /** รหัสสมาชิกหน้าชื่อผู้ติดต่อในแชต เช่น 1333 */ code?: string; /** ชื่อผู้ติดต่อในแชตหลังรหัส เช่น “ฝัน ดาวเลื่อนบัว” */ contactName?: string; /** ชื่อผู้โอนบนสลิป เช่น “น.ส.ดาวเลื่อน บ***” */ senderName?: string }
export interface DonorMatch { /** จับคู่ได้ชัดเจนตัวเดียว (ตั้งเป็นผู้ถวายให้เลย) */ member?: ChurchMember; reason?: 'code' | 'name'; /** ตัวเลือกใกล้เคียง เรียงจากตรงที่สุด (ให้ผู้บันทึกเลือกเอง) */ candidates: ChurchMember[] }

const TITLE = /^(นางสาว|น\.ส\.?|นส\.?|นาง|นาย|ด\.ช\.?|ด\.ญ\.?|เด็กชาย|เด็กหญิง|คุณ|mr\.?|mrs\.?|miss|ms\.?)\s*/i
const clean = (s: string) => s.replace(/^place:/, '').replace(TITLE, '').replace(/[*＊]+/g, ' ').replace(/[|_,]+/g, ' ').replace(/\s+/g, ' ').trim()

/** ชื่อบนสลิปมีแค่ชื่อต้น + ตัวอักษรแรกของนามสกุล (เช่น “น.ส.ดาวเลื่อน บ***”) */
export function senderParts(raw: string): { first: string; initial: string } {
  const t = clean(raw).replace(/\./g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!t.length) return { first: '', initial: '' }
  const first = t[0]
  const last = t.length >= 2 ? t[t.length - 1] : ''
  return { first, initial: last ? [...last][0] : '' }
}

/** ชื่อผู้ติดต่อจากหัวแชต: “1348 ฝัน ดาวเลื่อนบัว” → { code: 1348, name: ฝัน ดาวเลื่อนบัว } (ตัดอีโมจิ/สัญลักษณ์ท้ายบรรทัดที่ OCR อ่านปน) */
export function parseContact(headerText: string): { code?: string; name: string } {
  const line = headerText.normalize('NFC').split('\n').map((l) => l.trim()).find((l) => /^[^0-9ก-๙A-Za-z]{0,3}\d{3,6}(?=\s*(?:[-–._]\s*\d?)?[ก-๙A-Za-z])/.test(l) && !/\d{1,2}[:.]\d{2}/.test(l))
  if (!line) return { name: '' }
  const m = /^[^0-9ก-๙A-Za-z]{0,3}(\d{3,6})\s*[-–._]?\s*(.*)$/.exec(line)
  if (!m) return { name: '' }
  let name = m[2].replace(/[><|@#%$^&*()[\]{}"'`~]+/g, ' ').replace(/\s+/g, ' ').trim()
  while (/\s\S$/.test(name) || /^\S$/.test(name)) name = name.replace(/\s?\S$/, '').trim() // เศษ OCR ท้ายบรรทัด (ตัวเดียว)
  return { code: m[1], name }
}

/** โครงพยัญชนะ (ตัดสระ/วรรณยุกต์/จุด/เครื่องหมาย): OCR มักทำสระและวรรณยุกต์ตก แต่พยัญชนะยังอยู่ */
const skel = (s: string) => normThai(s).replace(/[^ก-ฮ]/g, '').replace(/[ะาำิีึืุูเแโใไัๅ]/g, '')
const lcs = (a: string, b: string) => { const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]); return dp[a.length][b.length] }
const first = (m: ChurchMember) => clean(m.name).split(' ')[0] ?? ''
const surnameOf = (m: ChurchMember) => { const t = clean(m.name).split(' ').filter(Boolean); return t.length >= 2 ? t[t.length - 1] : '' }

/**
 * จับคู่ผู้ถวายกับทะเบียน: รหัสสมาชิกตรง (มีคนเดียว) → ตรงเป๊ะ · ไม่ก็ให้คะแนนจากชื่อต้นบนสลิป + อักษรแรกนามสกุล + ชื่อ/ชื่อเล่น/นามสกุลในชื่อผู้ติดต่อแชต
 * ตั้งผู้ถวายให้เองเฉพาะกรณีคะแนนสูงและห่างจากอันดับสองชัดเจน ไม่งั้นส่งตัวเลือกใกล้เคียงให้ผู้บันทึกเลือก
 */
export function matchDonor(members: ChurchMember[], h: DonorHint): DonorMatch {
  const live = members.filter((m) => !m.deleted && !m.name.startsWith('place:'))
  if (h.code) {
    const byCode = live.filter((m) => (m.code ?? '').trim() === h.code)
    if (byCode.length === 1) return { member: byCode[0], reason: 'code', candidates: byCode }
  }
  const sp = senderParts(h.senderName ?? '')
  const sf = normThai(sp.first), si = normThai(sp.initial)
  const contact = normThai((h.contactName ?? '').replace(/\s+/g, ''))
  const gk = skel(h.senderName ?? '')
  const scored = live.map((m) => {
    const f = normThai(first(m)), n = normThai((m.nick ?? '').replace(/\s+/g, '')), s = normThai(surnameOf(m))
    let sc = 0
    if (sf.length >= 2 && f === sf) { sc += 5; if (si && s.startsWith(si)) sc += 3 }
    else if (sf.length >= 3 && f.length >= 3 && (f.includes(sf) || sf.includes(f))) sc += 2
    else if (gk.length >= 4) { // ชื่อบนสลิปที่ OCR อ่านเพี้ยน: โครงพยัญชนะชื่อต้นของสมาชิกต้องปรากฏครบตามลำดับ
      const mk = skel(first(m))
      if (mk.length >= 4 && lcs(mk, gk) === mk.length) { sc += 5; const sk = skel(s); if (sk && gk.replace(/\*+$/, '').endsWith(sk[0]) && !mk.endsWith(sk[0])) sc += 3 }
    }
    if (contact) {
      if (f.length >= 3 && contact.includes(f)) sc += 4
      if (n.length >= 2 && contact.includes(n)) sc += 3
      if (s.length >= 3 && contact.includes(s)) sc += 3
      else if (s.length >= 4 && contact.includes(s.slice(0, 3))) sc += 2
    }
    if (h.code && (m.code ?? '').trim() === h.code) sc += 100
    return { m, sc }
  }).filter((x) => x.sc >= 4).sort((a, b) => b.sc - a.sc)
  const top = scored[0], second = scored[1]
  const candidates = scored.slice(0, 8).map((x) => x.m)
  if (top && top.sc >= 8 && (!second || top.sc - second.sc >= 3)) return { member: top.m, reason: 'name', candidates }
  return { candidates }
}
