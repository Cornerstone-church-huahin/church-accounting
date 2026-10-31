import { ageYears, isLive } from './pastoral'
import type { AgeRule, ChurchMember } from './types'

const strip = (g: string) => g.replace(/^\s*\d+\s*[.)\-]?\s*/, '')
/**
 * กติกาตั้งต้นตามช่วงวัยของคริสตจักร (เดาจากชื่อกลุ่มที่มีในทะเบียน · แก้ได้):
 * รวี/เด็ก 2–12 · อนุชน/เยาวชน 13–24 · วัยทำงาน 25–39 · บุรุษ/สตรี 40–59 (แยกตามเพศ) · ผู้สูงวัย 60+
 */
export function defaultRules(groups: string[]): AgeRule[] {
  const rules: AgeRule[] = []
  for (const g of groups) {
    const n = strip(g)
    if (/ผู้สูงอายุ|สูงวัย/.test(n)) rules.push({ group: g, from: 60, to: 200, on: true })
    else if (/วัยทำงาน/.test(n)) rules.push({ group: g, from: 25, to: 39, on: true })
    else if (/เด็ก|รวี|โรงเรียนอาทิตย์/.test(n)) rules.push({ group: g, from: 2, to: 12, on: true })
    else if (/เยาวชน|อนุชน/.test(n)) rules.push({ group: g, from: 13, to: 24, on: true })
    else if (/บุรุษ|บรุษ/.test(n)) rules.push({ group: g, from: 40, to: 59, gender: 'ชาย', on: true })
    else if (/สตรี/.test(n)) rules.push({ group: g, from: 40, to: 59, gender: 'หญิง', on: true })
  }
  return rules
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
  if (m.group && !on.some((r) => r.group === m.group)) return null
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
