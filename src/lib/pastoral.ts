import { statusLabel, type Evaluated } from './registry'
import type { ChurchMember } from './types'

/** สถานะที่ใช้กรองดูข้อมูลในหน้าสมาชิกของงานอภิบาล */
export type StatusGroup = 'all' | 'complete' | 'reserve' | 'worship' | 'newcomer' | 'ended'
export const STATUS_GROUPS: { key: StatusGroup; label: string }[] = [
  { key: 'all', label: 'ทุกสถานะ' }, { key: 'complete', label: 'สมาชิกสมบูรณ์' }, { key: 'reserve', label: 'สมาชิกสำรอง' },
  { key: 'worship', label: 'ผู้ร่วมนมัสการ' }, { key: 'newcomer', label: 'คนใหม่' }, { key: 'ended', label: 'สิ้นสภาพ/เสียชีวิต' },
]
/** สถานะตามทะเบียน → กลุ่มที่ใช้กรอง (ดูเลขนำหน้า 1–7 · ไม่รู้จัก = นับในทุกสถานะเท่านั้น) */
export function groupOf(status?: string): Exclude<StatusGroup, 'all'> | undefined {
  const n = statusLabel(status).match(/^(\d)\./)?.[1]
  return n === '1' || n === '2' ? 'complete' : n === '3' ? 'reserve' : n === '4' ? 'worship' : n === '5' ? 'newcomer' : n === '6' || n === '7' ? 'ended' : undefined
}
export const inGroup = (m: { status?: string }, g: StatusGroup) => g === 'all' || groupOf(m.status) === g
/** ยังอยู่ในทะเบียน (ไม่นับสิ้นสภาพ/เสียชีวิต) */
export const isLive = (m: { status?: string }) => groupOf(m.status) !== 'ended'

/** ตัวเลขสำคัญของทะเบียน */
export function headline(members: { status?: string }[]) {
  const c = { total: members.length, complete: 0, reserve: 0, worship: 0, newcomer: 0, ended: 0 }
  for (const m of members) { const g = groupOf(m.status); if (g) c[g]++ }
  return c
}

export const AGE_BANDS = [
  { key: 'child', label: 'เด็ก (0–12)', from: 0, to: 12 }, { key: 'youth', label: 'เยาวชน (13–24)', from: 13, to: 24 },
  { key: 'adult', label: 'วัยทำงาน (25–39)', from: 25, to: 39 }, { key: 'mid', label: 'วัยกลางคน (40–59)', from: 40, to: 59 },
  { key: 'senior', label: 'ผู้สูงวัย (60+)', from: 60, to: 200 },
] as const
/** อายุเป็นปีเต็ม ณ วันที่ today (ไม่มี/วันเกิดผิด = undefined) */
export function ageYears(birth: string | undefined, today: string): number | undefined {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth) || birth > today) return undefined
  const [by, bm, bd] = birth.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}
/** นับตามช่วงวัย + จำนวนที่ไม่ทราบวันเกิด (ทะเบียนหลายคนยังไม่มีวันเกิด จึงต้องแสดงสัดส่วนที่ทราบ) */
export function ageBands(members: { birth?: string }[], today: string) {
  const bands = AGE_BANDS.map((b) => ({ key: b.key, label: b.label, count: 0 }))
  let unknown = 0
  for (const m of members) {
    const a = ageYears(m.birth, today)
    if (a == null) { unknown++; continue }
    const i = AGE_BANDS.findIndex((b) => a >= b.from && a <= b.to)
    if (i >= 0) bands[i].count++
  }
  return { bands, known: members.length - unknown, unknown }
}

/** ชาย/หญิง/ไม่ระบุ */
export function genderSplit(members: { gender?: string }[]) {
  const g = { ชาย: 0, หญิง: 0, ไม่ระบุ: 0 }
  for (const m of members) g[m.gender === 'ชาย' ? 'ชาย' : m.gender === 'หญิง' ? 'หญิง' : 'ไม่ระบุ']++
  return g
}

/** นับตามกลุ่ม (ไม่มีกลุ่ม/ว่าง รวมเป็น “ไม่มีกลุ่ม” ไว้ท้ายสุด) */
export function groupCounts(members: { group?: string }[]) {
  const map = new Map<string, number>()
  for (const m of members) {
    const raw = (m.group ?? '').trim().replace(/^\d+\./, '').trim()
    const k = !raw || /ไม่มีกลุ่ม/.test(raw) ? 'ไม่มีกลุ่ม' : raw === 'บรุษ' ? 'บุรุษ' : raw
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => (a[0] === 'ไม่มีกลุ่ม' ? 1 : b[0] === 'ไม่มีกลุ่ม' ? -1 : b[1] - a[1]))
}

/** จำนวนคนเข้าเป็นสมาชิกตามปี (ปี ค.ศ.) — ไม่ระบุวันเข้าไม่นับ */
export function joinYears(members: { since?: string }[]) {
  const map = new Map<number, number>()
  for (const m of members) { const y = Number(m.since?.slice(0, 4)); if (y > 1900) map.set(y, (map.get(y) ?? 0) + 1) }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }))
}

/** ยอดผู้มานมัสการ n ครั้งล่าสุด เรียงเก่า → ใหม่ (รับผลจาก serviceStats ซึ่งเรียงใหม่ → เก่า) */
export const recentServices = (stats: { date: string; count: number }[], n = 12) => stats.slice(0, n).map((s) => ({ date: s.date, count: s.count })).reverse()

export interface FollowUp { id: string; name: string; status: string; last: string; idleDays: number | null }
/**
 * คนที่ควรติดตาม: เฉพาะ “สมาชิกสมบูรณ์” (1+2) ที่ไม่ได้มานมัสการเกิน weeks สัปดาห์ — ไม่นับสมาชิกสำรอง ผู้ร่วมนมัสการ คนใหม่ สิ้นสภาพ/เสียชีวิต
 * เพื่อให้ประเมินการติดตามสมาชิกได้ตรงกลุ่ม · ไม่นับคนที่ยังไม่เคยมีบันทึกลงชื่อ · ขาดนานสุดก่อน
 */
export function followUp(rows: Evaluated[], weeks: number): FollowUp[] {
  return rows
    .filter((r) => groupOf(r.member.status) === 'complete' && !r.noRecord && r.idleDays != null && r.idleDays > weeks * 7)
    .map((r) => ({ id: r.member.id, name: r.member.name, status: statusLabel(r.member.status), last: r.last, idleDays: r.idleDays }))
    .sort((a, b) => (b.idleDays ?? 0) - (a.idleDays ?? 0))
}
export type { ChurchMember }
