import { ageYears, isLive } from './pastoral'
import type { AgeRule, ChurchMember } from './types'

const strip = (g: string) => g.replace(/^\s*\d+\s*[.)\-]?\s*/, '')
/** “ยังไม่มีกลุ่ม”: ว่าง หรือกลุ่มที่ชื่อบอกว่าไม่มีกลุ่ม (เช่น “7.ไม่มีกลุ่ม”) — จัดให้ตามอายุได้ ไม่ถือเป็นกลุ่มพิเศษ */
export const isUnassigned = (g?: string) => !g?.trim() || /^(ไม่มีกลุ่ม|ไม่ระบุ(กลุ่ม)?|ไม่สังกัด(กลุ่ม)?|ยังไม่มีกลุ่ม|-)$/.test(strip(g).trim())
/** กลุ่มมาตรฐานของคริสตจักร: ชื่อ · ช่วงอายุ · เพศ · คำที่ใช้หากลุ่มเดิมในทะเบียน (เช่น “4.สตรี”, “บรุษ”) */
const STANDARD: { name: string; from: number; to: number; gender?: 'ชาย' | 'หญิง'; re: RegExp }[] = [
  { name: '1.เด็กรวี', from: 3, to: 11, re: /เด็ก|รวี|โรงเรียนอาทิตย์/ },
  { name: '2.อนุชน', from: 12, to: 30, re: /เยาวชน|อนุชน/ },
  { name: '3.วัยทำงาน', from: 31, to: 45, re: /วัยทำงาน/ },
  { name: '5.บุรุษ', from: 46, to: 65, gender: 'ชาย', re: /บุรุษ|บรุษ/ },
  { name: '4.สตรี', from: 46, to: 65, gender: 'หญิง', re: /สตรี/ },
  { name: '6.ผู้สูงวัย', from: 66, to: 200, re: /ผู้สูงอายุ|สูงวัย/ },
]
/**
 * กติกามาตรฐาน: เด็กรวี 2–12 · อนุชน 13–24 · วัยทำงาน 25–39 · บุรุษ/สตรี 40–59 (แยกเพศ) · ผู้สูงวัย 60+
 * ถ้าในทะเบียนมีกลุ่มที่ชื่อตรงกัน (เช่น “4.สตรี”) ใช้ชื่อเดิมนั้น · ยังไม่มี = ใช้ชื่อมาตรฐานตามนี้ (กลุ่มจะเกิดเมื่อย้ายคนเข้า)
 */
const ruleFor = (s: (typeof STANDARD)[number], groups: string[]): AgeRule => ({ group: groups.find((g) => s.re.test(strip(g))) ?? s.name, from: s.from, to: s.to, ...(s.gender ? { gender: s.gender } : {}), on: true })
export function defaultRules(groups: string[]): AgeRule[] {
  return STANDARD.map((s) => ruleFor(s, groups))
}
/** รวมกติกาที่บันทึกไว้กับกลุ่มมาตรฐานที่ยังไม่มีกติกา (กติกาที่บันทึกแล้วใช้ตามที่บันทึก ไม่เพิ่มกติกาซ้ำให้กลุ่มเดียวกัน) */
export function effectiveRules(saved: AgeRule[] | undefined, groups: string[]): AgeRule[] {
  if (!saved || saved.length === 0) return defaultRules(groups)
  return dedupeRules(saved, groups)
}
/** ชุดเดียว: ถ้ามีกติกาซ้ำของกลุ่มเดียวกัน (เช่น “1.เด็กรวี” กับ “เด็กรวี”) เก็บอันที่ชื่อตรงกับกลุ่มจริงในทะเบียน ไม่มีเลย = เก็บอันแรก */
export function dedupeRules(rules: AgeRule[], groups: string[]): AgeRule[] {
  const key = (r: AgeRule) => { const i = STANDARD.findIndex((s) => s.re.test(strip(r.group))); return i < 0 ? '' : `${i}|${r.gender ?? ''}` }
  const keep = new Map<string, AgeRule>()
  for (const r of rules) {
    const k = key(r)
    if (!k) continue
    const cur = keep.get(k)
    if (!cur || (!groups.includes(cur.group) && groups.includes(r.group))) keep.set(k, r)
  }
  return rules.filter((r) => { const k = key(r); return !k || keep.get(k) === r })
}
export interface Target { group: string; age: number; rule: AgeRule }
/**
 * กลุ่มที่ควรอยู่ตามอายุ+เพศ · null = ไม่เสนอ: ไม่มีวันเกิด · ล็อกกลุ่ม · อยู่กลุ่มพิเศษที่ไม่มีกติกา (ไม่แตะ) · ไม่มีกติกาที่เข้าเงื่อนไข (เช่น ไม่ทราบเพศ)
 */
export function targetGroup(m: Pick<ChurchMember, 'birth' | 'gender' | 'group' | 'groupLock'>, rules: AgeRule[], today: string): Target | null {
  if (m.groupLock) return null
  const age = ageYears(m.birth, today)
  if (age == null) return null
  const on = rules.filter((r) => r.on)
  if (!isUnassigned(m.group) && !on.some((r) => r.group === m.group)) return null
  const fit = on.filter((r) => age >= r.from && age <= r.to && (!r.gender || m.gender === r.gender))
  if (!fit.length) return null
  fit.sort((a, b) => Number(!!b.gender) - Number(!!a.gender) || (a.to - a.from) - (b.to - b.from))
  return { group: fit[0].group, age, rule: fit[0] }
}
export interface Proposal { m: ChurchMember; from: string; to: string; age: number }
/** สมาชิกที่กลุ่มในทะเบียนไม่ตรงกับอายุ (เฉพาะสมาชิกที่ยังอยู่ ไม่ใช่ลาออก/เสียชีวิต) */
export function proposeRegroup(members: ChurchMember[], rules: AgeRule[], today: string): Proposal[] {
  const out: Proposal[] = []
  for (const m of members) {
    if (m.deleted || !isLive(m)) continue
    const t = targetGroup(m, rules, today)
    if (t && t.group !== (m.group ?? '')) out.push({ m, from: m.group ?? '', to: t.group, age: t.age })
  }
  return out
}

/** วัยที่ต้องแยกบุรุษ/สตรี (หรือกลุ่มที่ระบุเพศ) แต่ยังไม่ทราบเพศ → จัดกลุ่มให้ไม่ได้จนกว่าจะรู้เพศ */
export function needsGender(m: Pick<ChurchMember, 'birth' | 'gender' | 'group' | 'groupLock'>, rules: AgeRule[], today: string): boolean {
  if (m.groupLock || m.gender) return false
  const age = ageYears(m.birth, today)
  if (age == null) return false
  const on = rules.filter((r) => r.on && age >= r.from && age <= r.to)
  return on.length > 0 && on.every((r) => !!r.gender)
}

/** ตรวจกติกาที่เปิดใช้: ช่วงอายุซ้อนกัน (เพศชนกัน) หรือมีช่องว่างที่ไม่มีกลุ่มรับ (ตั้งแต่อายุเริ่มต้นต่ำสุดถึง 100 ปี แยกตามเพศ) */
export function ruleWarnings(rules: AgeRule[]): string[] {
  const on = rules.filter((r) => r.on)
  const out: string[] = []
  for (let i = 0; i < on.length; i++) {
    for (let j = i + 1; j < on.length; j++) {
      const a = on[i], b = on[j]
      const genderClash = !a.gender || !b.gender || a.gender === b.gender
      if (genderClash && a.from <= b.to && b.from <= a.to) out.push(`“${a.group}” (${a.from}–${a.to}) ซ้อนกับ “${b.group}” (${b.from}–${b.to})${a.gender && a.gender === b.gender ? ` ในเพศ${a.gender}` : ''}`)
    }
  }
  if (on.length === 0) return out
  const start = Math.min(...on.map((r) => r.from))
  for (const g of ['ชาย', 'หญิง'] as const) {
    let gapFrom = -1
    for (let age = start; age <= 100; age++) {
      const covered = on.some((r) => age >= r.from && age <= r.to && (!r.gender || r.gender === g))
      if (!covered && gapFrom < 0) gapFrom = age
      if ((covered || age === 100) && gapFrom >= 0) { const to = covered ? age - 1 : age; out.push(`เพศ${g}: อายุ ${gapFrom}${to > gapFrom ? `–${to}` : ''} ปี ไม่มีกลุ่มรับ`); gapFrom = -1 }
    }
  }
  return [...new Set(out)]
}

/**
 * รวมชื่อกลุ่มซ้ำ: กลุ่มที่ไม่มีเลขนำหน้า (เช่น “อนุชน”) แต่ทะเบียนมีกลุ่มเดียวกันที่มีเลข (“2.อนุชน”) → ใช้ชื่อมีเลข
 * (เกิดจากกติกาชื่อไม่มีเลขรุ่นก่อนที่เคยย้ายคนไปกลุ่มชื่อซ้ำ) · คืน id → ชื่อกลุ่มที่ถูกต้อง
 */
export function mergeGroupNames(members: Pick<ChurchMember, 'id' | 'group' | 'deleted'>[]): Map<string, string> {
  const live = members.filter((m) => !m.deleted && m.group?.trim())
  const key = (g: string) => { const t = strip(g.trim()); const i = STANDARD.findIndex((x) => x.re.test(t)); return i < 0 ? `t:${t}` : `s:${i}` }
  const count = new Map<string, number>()
  for (const m of live) count.set(m.group!.trim(), (count.get(m.group!.trim()) ?? 0) + 1)
  const canon = new Map<string, string>()   // key → ชื่อมีเลขที่มีสมาชิกมากสุด
  for (const [g, n] of count) {
    if (!/^\s*\d/.test(g) || isUnassigned(g)) continue
    const k = key(g), cur = canon.get(k)
    if (!cur || n > (count.get(cur) ?? 0)) canon.set(k, g)
  }
  const out = new Map<string, string>()
  for (const m of live) {
    const g = m.group!.trim()
    if (/^\s*\d/.test(g) || isUnassigned(g)) continue
    const to = canon.get(key(g))
    if (to && to !== g) out.set(m.id, to)
  }
  return out
}
