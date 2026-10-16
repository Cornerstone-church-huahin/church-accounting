import type { ChurchMember } from './types'

/**
 * จัดชื่อที่มีวงเล็บต่อท้าย เช่น "ดารา ผลจันทร์ (ดารา)" → ชื่อ "ดารา ผลจันทร์" + ชื่อเล่น "ดารา"
 * - วงเล็บที่เป็นชื่อเล่น → ไปช่องชื่อเล่น (ถ้ามีชื่อเล่นเดิมที่ตรงกันอยู่แล้ว แค่ตัดวงเล็บออก)
 * - วงเล็บที่เป็นคำอธิบาย (ลูก… เพื่อน… ภรรยา… หรือยาว) → ไปช่องหมายเหตุ
 * - วงเล็บกลางชื่อ ซ้อนกัน ไม่ครบคู่ หรือชื่อเล่นเดิมไม่ตรงกับวงเล็บ → ไม่ทำเอง ให้คนตรวจ
 */
export type NameFix =
  | { kind: 'none' }
  | { kind: 'fix'; how: 'nick' | 'strip' | 'note'; name: string; nick?: string; note?: string }
  | { kind: 'review'; why: string }

// คำบอกความสัมพันธ์ที่ชัดเจน (ต้องมีคำต่อท้าย) · คำสั้น/กำกวมที่เป็นชื่อเล่นได้ (อาเธอร์ ตาล น้อง ป้าลินดา) ต้องตามด้วยช่องว่างหรือ "คุณ"
const STRONG = /^(ลูก|เพื่อน|ภรรยา|สามี|หลาน|ญาติ|เจ้านาย|แฟน|มาจาก|มากับ|คน)./
const WEAK = /^(พี่|น้อง|แม่|พ่อ|ป้า|ลุง|น้า|อา|ย่า|ยาย|ตา)(\s|คุณ|ของ)/
const clean = (s: string) => s.replace(/[​‌‍]/g, '').replace(/\s+/g, ' ').trim()
export const looksLikeDescription = (c: string) => STRONG.test(c) || WEAK.test(c) || c.length > 12

export function cleanName(m: { name: string; nick?: string; note?: string }): NameFix {
  const name = clean(m.name)
  if (!/[()（）]/.test(name)) return { kind: 'none' }
  const open = (name.match(/[(（]/g) ?? []).length, close = (name.match(/[)）]/g) ?? []).length
  if (open !== 1 || close !== 1) return { kind: 'review', why: 'วงเล็บซ้อนกันหรือไม่ครบคู่' }
  const hit = /^(.*?)\s*[(（]([^()（）]*)[)）]\s*$/.exec(name)
  if (!hit) return { kind: 'review', why: 'วงเล็บอยู่กลางชื่อ' }
  const base = clean(hit[1]), c = clean(hit[2])
  if (!base) return { kind: 'review', why: 'ไม่มีชื่อนอกวงเล็บ' }
  if (!c) return { kind: 'fix', how: 'strip', name: base }
  const nick = clean(m.nick ?? ''), note = clean(m.note ?? '')
  if (looksLikeDescription(c)) {
    const merged = note ? (note.includes(c) ? note : `${note} · ${c}`) : c
    return { kind: 'fix', how: 'note', name: base, note: merged }
  }
  if (!nick) {
    // ชื่อเล่นว่าง: ย้ายอัตโนมัติเฉพาะคำไทยสั้นๆ ที่ชื่อจริงเป็นภาษาไทย · อย่างอื่น (ประเทศ ชื่อฝรั่ง ชื่อเพื่อน) อาจเป็นคำอธิบาย ให้คนตัดสิน
    if (/^[ก-๙]{1,6}$/.test(c) && /[ก-๙]/.test(base)) return { kind: 'fix', how: 'nick', name: base, nick: c }
    return { kind: 'review', why: `ไม่แน่ใจว่า “${c}” เป็นชื่อเล่นหรือคำอธิบาย` }
  }
  if (nick === c || nick.includes(c) || c.includes(nick)) return { kind: 'fix', how: 'strip', name: base }
  return { kind: 'review', why: `ชื่อเล่นเดิม “${nick}” ไม่ตรงกับในวงเล็บ “${c}”` }
}

/** ใส่ผลที่จัดแล้วลงสมาชิก · เก็บชื่อเดิมไว้ที่ nameOrig (ครั้งแรกเท่านั้น) เผื่อกู้คืน */
export function applyNameFix(m: ChurchMember, f: Extract<NameFix, { kind: 'fix' }>): ChurchMember {
  return { ...m, name: f.name, ...(f.nick !== undefined ? { nick: f.nick } : {}), ...(f.note !== undefined ? { note: f.note } : {}), nameOrig: m.nameOrig ?? m.name, updated: 0 }
}

export interface NameCleanPlan {
  fixes: { member: ChurchMember; fix: Extract<NameFix, { kind: 'fix' }> }[]
  review: { member: ChurchMember; why: string }[]
  byHow: { nick: number; strip: number; note: number }
}
export function planNameClean(members: ChurchMember[]): NameCleanPlan {
  const plan: NameCleanPlan = { fixes: [], review: [], byHow: { nick: 0, strip: 0, note: 0 } }
  for (const m of members) {
    const f = cleanName(m)
    if (f.kind === 'fix') { plan.fixes.push({ member: m, fix: f }); plan.byHow[f.how]++ }
    else if (f.kind === 'review') plan.review.push({ member: m, why: f.why })
  }
  return plan
}
