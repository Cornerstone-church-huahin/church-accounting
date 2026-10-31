import { ageYears, isLive } from './pastoral'
import type { AgeRule, ChurchMember } from './types'

const strip = (g: string) => g.replace(/^\s*\d+\s*[.)\-]?\s*/, '')
/** “ยังไม่มีกลุ่ม”: ว่าง หรือกลุ่มที่ชื่อบอกว่าไม่มีกลุ่ม (เช่น “7.ไม่มีกลุ่ม”) — จัดให้ตามอายุได้ ไม่ถือเป็นกลุ่มพิเศษ */
export const isUnassigned = (g?: string) => !g?.trim() || /^(ไม่มีกลุ่ม|ไม่ระบุ(กลุ่ม)?|ไม่สังกัด(กลุ่ม)?|ยังไม่มีกลุ่ม|-)$/.test(strip(g).trim())
/** กลุ่มมาตรฐานของคริสตจักร: ชื่อ · ช่วงอายุ · เพศ · คำที่ใช้หากลุ่มเดิมในทะเบียน (เช่น “4.สตรี”, “บรุษ”) */
const STANDARD: { name: string; from: number; to: number; gender?: 'ชาย' | 'หญิง'; re: RegExp }[] = [
  { name: 'เด็กรวี', from: 2, to: 12, re: /เด็ก|รวี|โรงเรียนอาทิตย์/ },
  { name: 'อนุชน', from: 13, to: 24, re: /เยาวชน|อนุชน/ },
  { name: 'วัยทำงาน', from: 25, to: 39, re: /วัยทำงาน/ },
  { name: 'บุรุษ', from: 40, to: 59, gender: 'ชาย', re: /บุรุษ|บรุษ/ },
  { name: 'สตรี', from: 40, to: 59, gender: 'หญิง', re: /สตรี/ },
  { name: 'ผู้สูงวัย', from: 60, to: 200, re: /ผู้สูงอายุ|สูงวัย/ },
]
/**
 * กติกามาตรฐาน: เด็กรวี 2–12 · อนุชน 13–24 · วัยทำงาน 25–39 · บุรุษ/สตรี 40–59 (แยกเพศ) · ผู้สูงวัย 60+
 * ถ้าในทะเบียนมีกลุ่มที่ชื่อตรงกัน (เช่น “4.สตรี”) ใช้ชื่อเดิมนั้น · ยังไม่มี = ใช้ชื่อมาตรฐานตามนี้ (กลุ่มจะเกิดเมื่อย้ายคนเข้า)
 */
export function defaultRules(groups: string[]): AgeRule[] {
  return STANDARD.map((s) => ({ group: groups.find((g) => s.re.test(strip(g))) ?? s.name, from: s.from, to: s.to, ...(s.gender ? { gender: s.gender } : {}), on: true }))
}
/** รวมกติกาที่บันทึกไว้กับกลุ่มที่มีในทะเบียน (กลุ่มใหม่ที่ยังไม่มีกติกา → ใช้ค่าตั้งต้นเดา) */
export function effectiveRules(saved: AgeRule[] | undefined, groups: string[]): AgeRule[] {
  if (!saved) return defaultRules(groups)
  const have = new Set(saved.map((r) => r.group))
  return [...saved, ...defaultRules(groups.filter((g) => !have.has(g)))]
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
