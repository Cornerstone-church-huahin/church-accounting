import { fmtDate } from './money'
import type { FormAnswer } from './memberForm'
import type { ChurchMember } from './types'

/** ตัดคำนำหน้า ช่องว่าง จุด วงเล็บ และวรรณยุกต์/ทัณฑฆาต เพื่อเทียบชื่อที่สะกดต่างกันเล็กน้อย */
export const normName = (s: string) => s.trim().replace(/^(นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|คุณ|มน\.|คศ\.|อ\.)\s*/, '').replace(/[\s.\-()]/g, '').replace(/[\u0E48-\u0E4C]/g, '')

function lev(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i
    for (let j = 1; j <= b.length; j++) { const t = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t }
  }
  return dp[b.length]
}
/** ความคล้ายของชื่อ 0–1 (หลังตัดคำนำหน้า/วรรณยุกต์) */
export function nameSimilarity(a: string, b: string): number {
  const x = normName(a), y = normName(b)
  if (!x && !y) return 1
  if (!x || !y) return 0
  return 1 - lev(x, y) / Math.max(x.length, y.length)
}
/** same = เหมือนกัน (ต่างแค่คำนำหน้า/วรรณยุกต์/ช่องว่าง) · minor = ต่างเล็กน้อย ควรตรวจสะกด · major = ต่างมาก ควรตรวจว่าเป็นคนเดียวกัน */
export function nameVerdict(oldName: string, newName: string): { level: 'same' | 'minor' | 'major'; sim: number } {
  const sim = nameSimilarity(oldName, newName)
  return { level: normName(oldName) === normName(newName) ? 'same' : sim >= 0.75 ? 'minor' : 'major', sim }
}

export type FieldKey = 'name' | 'nick' | 'tel' | 'lineId' | 'facebook' | 'gender' | 'birth' | 'firstWorship' | 'since' | 'skills' | 'serve' | 'serveDays'
export interface Diff { key: FieldKey; label: string; old: string; next: string; changed: boolean; /** ที่มาของค่า เช่น อ่านจากหมายเหตุ */ source?: string }

const txt = (v?: string) => (v ?? '').trim()
/** เทียบข้อมูลที่สมาชิกส่งกลับกับทะเบียน · ช่องที่สมาชิกเว้นว่างไม่ถือว่าเปลี่ยน (ไม่ลบข้อมูลเดิม) */
export function diffAnswer(m: ChurchMember, a: FormAnswer): Diff[] {
  const row = (key: FieldKey, label: string, old: string, next: string): Diff => ({ key, label, old, next, changed: next !== '' && next !== old })
  return [
    row('name', 'ชื่อ-สกุล', txt(m.name), txt(a.name)),
    row('nick', 'ชื่อเล่น', txt(m.nick), txt(a.nick)),
    row('tel', 'โทรศัพท์', txt(m.tel), txt(a.tel)),
    row('lineId', 'LINE ID', txt(m.lineId), txt(a.lineId)),
    row('facebook', 'Facebook', txt(m.facebook), txt(a.facebook)),
    row('gender', 'เพศ', txt(m.gender), txt(a.gender)),
    { ...row('birth', 'วันเกิด', m.birth ?? '', a.birth ?? ''), old: m.birth ? fmtDate(m.birth) : '', next: a.birth ? fmtDate(a.birth) : '' , changed: !!a.birth && a.birth !== m.birth },
    { ...row('firstWorship', 'มานมัสการครั้งแรก (ประมาณ)', m.firstWorship ?? '', a.first ?? ''), old: m.firstWorship ? fmtDate(m.firstWorship) : '', next: a.first ? fmtDate(a.first) : '', changed: !!a.first && a.first !== m.firstWorship },
    { ...row('since', 'คริสตจักรรับเป็นสมาชิก', m.since ?? '', a.since ?? ''), old: m.since ? fmtDate(m.since) : '', next: a.since ? fmtDate(a.since) : '', changed: !!a.since && a.since !== m.since },
    row('skills', 'อาชีพ / ความสามารถ', txt(m.skills), txt(a.skills)),
    row('serve', 'งานรับใช้ที่เต็มใจ', (m.serve ?? []).join(', '), (a.serve ?? []).join(', ')),
    row('serveDays', 'วันที่สะดวกรับใช้', (m.serveDays ?? []).join(', '), (a.serveDays ?? []).join(', ')),
  ]
}
/** นำช่องที่เลือกลงทะเบียน (ชื่อเดิมเก็บไว้ที่ nameOrig ถ้ายังไม่มี) · บันทึกเวลานำเข้า */
export function applyAnswer(m: ChurchMember, a: FormAnswer, keys: Set<FieldKey>): ChurchMember {
  const n: ChurchMember = { ...m, formAt: Date.now() }
  if (keys.has('name') && txt(a.name)) { if (!n.nameOrig && txt(m.name) !== txt(a.name)) n.nameOrig = m.name; n.name = txt(a.name) }
  if (keys.has('nick') && txt(a.nick)) n.nick = txt(a.nick)
  if (keys.has('tel') && txt(a.tel)) n.tel = txt(a.tel)
  if (keys.has('lineId') && txt(a.lineId)) n.lineId = txt(a.lineId)
  if (keys.has('facebook') && txt(a.facebook)) n.facebook = txt(a.facebook)
  if (keys.has('gender') && (a.gender === 'ชาย' || a.gender === 'หญิง')) { n.gender = a.gender; n.genderGuess = undefined }
  if (keys.has('birth') && a.birth) n.birth = a.birth
  if (keys.has('firstWorship') && a.first) n.firstWorship = a.first
  if (keys.has('since') && a.since) n.since = a.since
  if (keys.has('skills') && txt(a.skills)) n.skills = txt(a.skills)
  if (keys.has('serve') && a.serve?.length) n.serve = a.serve
  if (keys.has('serveDays') && a.serveDays?.length) n.serveDays = a.serveDays
  return n
}

export interface Candidate { m: ChurchMember; score: number; reasons: string[] }
const digits = (s?: string) => (s ?? '').replace(/\D/g, '')
/** หาสมาชิกที่น่าจะเป็นคนเดียวกับข้อความที่ได้รับ (จับคู่จากชื่อ + หลักฐานเสริม: ชื่อเล่น เบอร์โทร วันเกิด) · เรียงคะแนนมากไปน้อย */
export function findCandidates(a: FormAnswer, members: ChurchMember[], limit = 5): Candidate[] {
  return members
    .filter((m) => !m.deleted)
    .map((m) => {
      const sim = nameSimilarity(a.name, m.name)
      const reasons = [`ชื่อใกล้เคียง ${Math.round(sim * 100)}%`]
      let score = sim
      if (a.nick && m.nick && normName(a.nick) === normName(m.nick)) { score += 0.1; reasons.push('ชื่อเล่นตรงกัน') }
      if (digits(a.tel).length >= 9 && digits(a.tel) === digits(m.tel)) { score += 0.3; reasons.push('เบอร์โทรตรงกัน') }
      if (a.birth && m.birth && a.birth === m.birth) { score += 0.3; reasons.push('วันเกิดตรงกัน') }
      return { m, score, reasons }
    })
    .filter((c) => c.score >= 0.5)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}

// ---------- อ่านวันที่จากหมายเหตุของสมาชิก (ให้ความสำคัญกับ “วันที่มานมัสการครั้งแรก” เสมอ) ----------
const MONTHS: Record<string, number> = {
  มกราคม: 1, มค: 1, กุมภาพันธ์: 2, กพ: 2, มีนาคม: 3, มีค: 3, เมษายน: 4, เมย: 4, พฤษภาคม: 5, พค: 5, มิถุนายน: 6, มิย: 6, กรกฎาคม: 7, กค: 7, สิงหาคม: 8, สค: 8, กันยายน: 9, กย: 9, ตุลาคม: 10, ตค: 10, พฤศจิกายน: 11, พย: 11, ธันวาคม: 12, ธค: 12,
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
}
export interface DateGuess { iso: string; /** true = มีแต่ปี (ใส่เป็น 1 ม.ค.) */ yearOnly: boolean; text: string }
/** ปีที่เขียนในข้อความ → ค.ศ. · 4 หลัก: เกิน 2400 = พ.ศ. · 2 หลัก: 40–99 = พ.ศ. 25xx (ต่ำกว่า 40 กำกวม ไม่เดา) */
function toCE(y: number, digits: number): number | null {
  if (digits === 4) return y > 2400 ? y - 543 : y
  if (digits === 2) return y >= 40 ? 2500 + y - 543 : null
  return null
}
const pad = (n: number) => String(n).padStart(2, '0')
/** หาวันที่ในข้อความหมายเหตุ: “1 ต.ค. 2014” “1ตค57” “1/10/2557” → วันที่เต็ม · “ตั้งแต่ปี 2557” → ปีเดียว · ไม่ใช่วันที่ในอนาคต */
export function guessDateFromNote(note: string | undefined, today = new Date().toISOString().slice(0, 10)): DateGuess | null {
  const t = (note ?? '').trim()
  if (!t) return null
  const ok = (y: number, m: number, d: number) => y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31 && `${y}-${pad(m)}-${pad(d)}` <= today
  let r = /(\d{1,2})\s*([ก-๙A-Za-z.]{2,12})\s*(?:พ\.?\s?ศ\.?|ค\.?\s?ศ\.?)?\s*(\d{4}|\d{2})(?!\d)/g, x: RegExpExecArray | null
  while ((x = r.exec(t))) {
    const m = MONTHS[x[2].replace(/\./g, '').toLowerCase()]
    const y = toCE(Number(x[3]), x[3].length)
    if (m && y && ok(y, m, Number(x[1]))) return { iso: `${y}-${pad(m)}-${pad(Number(x[1]))}`, yearOnly: false, text: x[0] }
  }
  r = /(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})(?!\d)/g
  while ((x = r.exec(t))) {
    const y = toCE(Number(x[3]), x[3].length)
    if (y && ok(y, Number(x[2]), Number(x[1]))) return { iso: `${y}-${pad(Number(x[2]))}-${pad(Number(x[1]))}`, yearOnly: false, text: x[0] }
  }
  const yo = /(?:ปี|พ\.?\s?ศ\.?|ค\.?\s?ศ\.?|since|ตั้งแต่)\s*(\d{4})(?!\d)/i.exec(t)
  if (yo) { const y = toCE(Number(yo[1]), 4); if (y && ok(y, 1, 1)) return { iso: `${y}-01-01`, yearOnly: true, text: yo[0] } }
  return null
}
/**
 * ใช้หมายเหตุช่วยเติม “วันที่มานมัสการครั้งแรก”: ถ้าสมาชิกไม่ได้กรอกช่องนี้เอง (ว่าง หรือเท่าค่าเดิมในทะเบียน)
 * และหมายเหตุมีวันที่ที่ต่างจากทะเบียน → เสนอวันที่นั้นเป็นวันที่มาครั้งแรก (ไม่เดาเป็นวันที่รับเป็นสมาชิก)
 */
export function withNoteGuess(m: ChurchMember, a: FormAnswer): { a: FormAnswer; guess?: DateGuess } {
  if (a.first && a.first !== m.firstWorship) return { a }
  const g = guessDateFromNote(a.note)
  if (!g || g.iso === m.firstWorship) return { a }
  return { a: { ...a, first: g.iso }, guess: g }
}

/** ระยะเวลาจากวันที่หนึ่งถึงวันนี้ เป็น “3 ปี 10 เดือน” (ไม่ใช่ทศนิยม) */
export function spanText(fromIso: string, todayIso: string): string {
  const [fy, fm, fd] = fromIso.split('-').map(Number), [ty, tm, td] = todayIso.split('-').map(Number)
  let months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0)
  if (months < 0) months = 0
  const y = Math.floor(months / 12), mo = months % 12
  if (y === 0 && mo === 0) return 'ไม่ถึง 1 เดือน'
  return [y ? `${y} ปี` : '', mo ? `${mo} เดือน` : ''].filter(Boolean).join(' ')
}

/**
 * วันที่ “มานมัสการครั้งแรก” ที่สมาชิกเขียนแบบประมาณ → จับกับวันนมัสการที่มีบันทึกในระบบที่ใกล้ที่สุด (ภายใน ±3 วัน = วันอาทิตย์ของสัปดาห์นั้น)
 * ไม่มีบันทึกใกล้เคียง = null (ใช้ตามที่สมาชิกเขียน) · วันที่เท่ากันอยู่แล้ว/ใกล้เท่ากัน เลือกวันที่ก่อน
 */
export function snapToWorshipDay(iso: string, days: string[], windowDays = 3): string | null {
  const t = Date.parse(`${iso}T00:00:00Z`)
  if (!Number.isFinite(t)) return null
  let best: { d: string; diff: number } | null = null
  for (const d of days) {
    const diff = Math.abs(Date.parse(`${d}T00:00:00Z`) - t) / 86_400_000
    if (diff <= windowDays && (!best || diff < best.diff || (diff === best.diff && d < best.d))) best = { d, diff }
  }
  return best ? best.d : null
}
