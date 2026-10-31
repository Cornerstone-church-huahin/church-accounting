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

export type FieldKey = 'name' | 'nick' | 'tel' | 'lineId' | 'facebook' | 'gender' | 'birth' | 'since' | 'skills' | 'serve' | 'serveDays'
export interface Diff { key: FieldKey; label: string; old: string; next: string; changed: boolean }

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
    { ...row('since', 'มานมัสการครั้งแรก (ประมาณ)', m.since ?? '', a.first ?? ''), old: m.since ? fmtDate(m.since) : '', next: a.first ? fmtDate(a.first) : '', changed: !!a.first && a.first !== m.since },
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
  if (keys.has('since') && a.first) n.since = a.first
  if (keys.has('skills') && txt(a.skills)) n.skills = txt(a.skills)
  if (keys.has('serve') && a.serve?.length) n.serve = a.serve
  if (keys.has('serveDays') && a.serveDays?.length) n.serveDays = a.serveDays
  return n
}
