import { addDays, diffDays } from './money'
import { OFFICIAL_STATUSES, regLevel, statusLabel, type Evaluated } from './registry'
import type { ChurchMember } from './types'

/** สถานะที่ใช้กรองดูข้อมูลในหน้าสมาชิกของงานอภิบาล */
export type StatusGroup = 'all' | 'full1' | 'full2' | 'complete' | 'reserve' | 'worship' | 'newcomer' | 'resigned' | 'deceased'
/** กลุ่มสถานะตามเลขนำหน้าในทะเบียน (สมบูรณ์ 1+2 รวมกัน) */
export type BaseGroup = Exclude<StatusGroup, 'all' | 'full1' | 'full2'>
export const STATUS_GROUPS: { key: StatusGroup; label: string }[] = [
  { key: 'all', label: 'ทุกสถานะ' }, { key: 'complete', label: 'สมาชิกสมบูรณ์' }, { key: 'reserve', label: 'สมาชิกสำรอง' },
  { key: 'newcomer', label: 'คนใหม่' }, { key: 'worship', label: 'ผู้ร่วมนมัสการ' }, { key: 'resigned', label: 'สิ้นสภาพสมาชิก' }, { key: 'deceased', label: 'เสียชีวิต' },
]
/** สถานะตามทะเบียน → กลุ่มที่ใช้กรอง (ดูเลขนำหน้า 1–7 · ไม่รู้จัก = นับในทุกสถานะเท่านั้น) */
export function groupOf(status?: string): BaseGroup | undefined {
  const n = statusLabel(status)
  return /สมบูรณ์/.test(n) ? 'complete' : /สำรอง/.test(n) ? 'reserve' : /คนใหม่/.test(n) ? 'newcomer' : /ผู้ร่วมนมัสการ/.test(n) ? 'worship' : /สิ้นสภาพ|ลาออก/.test(n) ? 'resigned' : /เสียชีวิต/.test(n) ? 'deceased' : undefined
}
/** ตัวเลือกสถานะในป๊อปอัพกรอง (ทุกสถานะ เป็นแถวแรกของตัวเลือกเอง) เรียงจากสถานะที่ผูกพันกับคริสตจักรมากสุด: สมบูรณ์ 1 → 2 → สำรอง → คนใหม่ → ผู้ร่วมนมัสการ → สิ้นสภาพ → เสียชีวิต */
export const PICK_STATUS_GROUPS: { key: Exclude<StatusGroup, 'all' | 'complete'>; label: string }[] = [
  { key: 'full1', label: 'สมบูรณ์ 1' }, { key: 'full2', label: 'สมบูรณ์ 2' }, { key: 'reserve', label: 'สมาชิกสำรอง' },
  { key: 'newcomer', label: 'คนใหม่' }, { key: 'worship', label: 'ผู้ร่วมนมัสการ' }, { key: 'resigned', label: 'สิ้นสภาพสมาชิก' }, { key: 'deceased', label: 'เสียชีวิต' },
]
export const statusGroupLabel = (k: StatusGroup) => [...PICK_STATUS_GROUPS, { key: 'complete', label: 'สมาชิกสมบูรณ์' }, { key: 'all', label: 'ทุกสถานะ' }].find((x) => x.key === k)?.label ?? k
export const inGroup = (m: { status?: string }, g: StatusGroup) => {
  if (g === 'all') return true
  if (g === 'full1' || g === 'full2') return regLevel(m.status) === (g === 'full1' ? 1 : 2)
  return groupOf(m.status) === g
}
/** ยังอยู่ในทะเบียน (ไม่นับสิ้นสภาพ/เสียชีวิต) */
export const isLive = (m: { status?: string }) => { const g = groupOf(m.status); return g !== 'resigned' && g !== 'deceased' }

/** ตัวเลขสำคัญของทะเบียน */
export function headline(members: { status?: string }[]) {
  const c = { total: members.length, complete: 0, reserve: 0, worship: 0, newcomer: 0, resigned: 0, deceased: 0 }
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
    const raw = (m.group ?? '').trim() // ชื่อกลุ่มตามทะเบียน (มีเลขนำหน้าเหมือนที่เก็บไว้) — ต้องตรงกับการกรองรายบุคคล
    const k = !raw || /ไม่มีกลุ่ม/.test(raw) ? 'ไม่มีกลุ่ม' : raw
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  const num = (g: string) => { const n = /^\s*(\d+)/.exec(g); return n ? Number(n[1]) : Infinity }
  // เรียงตามเลขนำหน้าชื่อกลุ่ม น้อย → มาก · ไม่มีเลขตามหลังเรียงตามจำนวนคน · “ไม่มีกลุ่ม” ท้ายสุด
  return [...map.entries()].sort((a, b) => (a[0] === 'ไม่มีกลุ่ม' ? 1 : b[0] === 'ไม่มีกลุ่ม' ? -1 : num(a[0]) - num(b[0]) || b[1] - a[1]))
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

export interface VisitStat { /** มาในช่วง 1 ปีล่าสุด (วันที่ไม่ซ้ำ) */ recent: number; /** ทั้งหมดในข้อมูล */ total: number; /** วันที่มาล่าสุด */ last: string }
/** สถิติการมานมัสการของแต่ละคน: ครั้งใน 1 ปีล่าสุด · ทั้งหมด · วันล่าสุด (ไม่นับรายการที่ยกเลิก) */
export function visitStats(attendance: { date: string; ids: string[]; deleted?: boolean }[], today: string): Map<string, VisitStat> {
  const days = new Map<string, Set<string>>()
  for (const a of attendance) if (!a.deleted) for (const id of a.ids) (days.get(id) ?? days.set(id, new Set()).get(id)!).add(a.date)
  const from = addDays(today, -365)
  return new Map([...days].map(([id, d]) => { const ds = [...d]; return [id, { recent: ds.filter((x) => x > from && x <= today).length, total: ds.length, last: ds.reduce((m, x) => (x > m ? x : m), '') }] }))
}
/** ลำดับสถานะตามลำดับทะเบียน 1–7 (ไม่รู้จัก = ท้ายสุด) */
export const statusRank = (status?: string) => { const i = OFFICIAL_STATUSES.indexOf(statusLabel(status)); return i >= 0 ? i + 1 : 9 }
/** ระดับการขาด: 0 = ไม่ขาด (มาภายใน 3 เดือน) · 1 = ขาดเกิน 3 เดือน · 2 = 6 เดือน · 3 = 1 ปี · 4 = ปีครึ่ง · 5 = 2 ปีขึ้นไป · 6 = ไม่เคยมีบันทึก */
export const ABSENCE_LABELS = ['', 'ขาดเกิน 3 เดือน', 'ขาดเกิน 6 เดือน', 'ขาดเกิน 1 ปี', 'ขาดเกิน 1 ปีครึ่ง', 'ขาดเกิน 2 ปี', 'ไม่เคยมีบันทึกการมา']
export function absence(last: string | undefined, today: string): { tier: number; days: number | null; label: string } {
  if (!last) return { tier: 6, days: null, label: ABSENCE_LABELS[6] }
  const d = diffDays(today, last)
  const tier = d >= 730 ? 5 : d >= 548 ? 4 : d >= 365 ? 3 : d >= 180 ? 2 : d >= 90 ? 1 : 0
  return { tier, days: d, label: ABSENCE_LABELS[tier] }
}
export type MemberOrder = 'default' | 'asc' | 'status' | 'name'
/**
 * เรียงรายชื่อ — ค่าเริ่มต้น: คนที่ไม่ขาด (มาภายใน 3 เดือน) มาบ่อยที่สุดใน 1 ปีก่อน → แล้วคนที่ขาดเรียงจากขาดน้อยไปมาก (เกิน 3 เดือน → 6 เดือน → 1 ปี → ปีครึ่ง → 2 ปี → ไม่เคยมา)
 * สมาชิกที่สิ้นสภาพ/เสียชีวิตอยู่ท้ายสุด ไม่ติดป้ายขาด · asc = กลับลำดับ · status = สถานะ 1→7 · name = ก→ฮ
 */
export function orderMembers<T extends { id: string; name: string; status?: string }>(list: T[], order: MemberOrder, stats: Map<string, VisitStat>, today: string): T[] {
  const ended = (m: T) => !isLive(m)
  const ab = (m: T) => (ended(m) ? { tier: 7, days: -1 } : absence(stats.get(m.id)?.last, today))
  const rc = (m: T) => stats.get(m.id)?.recent ?? 0
  const nm = (x: T, y: T) => x.name.localeCompare(y.name, 'th')
  const main = (x: T, y: T) => {
    const a = ab(x), b = ab(y)
    return a.tier - b.tier || (a.tier === 0 ? rc(y) - rc(x) || statusRank(x.status) - statusRank(y.status) : (a.days ?? 1e9) - (b.days ?? 1e9)) || nm(x, y)
  }
  const cmp: Record<MemberOrder, (x: T, y: T) => number> = {
    default: main, asc: (x, y) => main(y, x),
    status: (x, y) => statusRank(x.status) - statusRank(y.status) || rc(y) - rc(x) || nm(x, y), name: nm,
  }
  return [...list].sort(cmp[order])
}

/** อายุการเป็นสมาชิก (วัน): นับจากวันที่เข้าเป็นสมาชิกในทะเบียน ไม่มี = วันที่มาครั้งแรกในบันทึกลงชื่อ ไม่มีทั้งคู่ = null */
export function tenureDays(since: string | undefined, firstAtt: string | undefined, today: string): number | null {
  const base = since || firstAtt
  return base ? Math.max(0, diffDays(today, base)) : null
}
export function tenureText(days: number | null): string {
  if (days === null) return 'ไม่ทราบวันที่เข้า'
  const y = Math.floor(days / 365), mo = Math.floor((days % 365) / 30)
  return y > 0 ? `${y} ปี${mo ? ` ${mo} เดือน` : ''}` : mo > 0 ? `${mo} เดือน` : `${days} วัน`
}
/** เรียงตามอายุการเป็นสมาชิก: oldest = เก่าแก่ก่อน (ไม่ทราบอยู่ท้ายเสมอ) */
export function orderByTenure<T extends { id: string; name: string }>(list: T[], days: (id: string) => number | null, oldest = true): T[] {
  return [...list].sort((x, y) => {
    const a = days(x.id), b = days(y.id)
    if (a === null || b === null) return a === b ? x.name.localeCompare(y.name, 'th') : a === null ? 1 : -1
    return (oldest ? b - a : a - b) || x.name.localeCompare(y.name, 'th')
  })
}
/** ช่วงเวลาที่ใช้วัดความสม่ำเสมอ (บนสุด = ยาวสุด) */
export const REG_PERIODS = [
  { k: '3y', days: 1095, t: 'สม่ำเสมอภายในสามปี', short: 'สามปีล่าสุด' },
  { k: '2y', days: 730, t: 'สม่ำเสมอภายในสองปี', short: 'สองปีล่าสุด' },
  { k: '1y', days: 365, t: 'สม่ำเสมอภายในหนึ่งปี', short: 'หนึ่งปีล่าสุด' },
  { k: '6m', days: 183, t: 'สม่ำเสมอภายในหกเดือน', short: 'หกเดือนล่าสุด' },
  { k: '3m', days: 91, t: 'สม่ำเสมอภายในสามเดือน', short: 'สามเดือนล่าสุด' },
  { k: '2m', days: 61, t: 'สม่ำเสมอภายในสองเดือน', short: 'สองเดือนล่าสุด' },
  { k: '1m', days: 30, t: 'สม่ำเสมอภายในหนึ่งเดือน', short: 'หนึ่งเดือนล่าสุด' },
] as const
export type RegPeriod = (typeof REG_PERIODS)[number]['k']
/**
 * ความสม่ำเสมอในช่วง days วันล่าสุด: จำนวนครั้งนมัสการที่มีบันทึกในช่วงนั้น (services = ตัวหาร) และจำนวนครั้งที่แต่ละคนมา (times)
 * เปอร์เซ็นต์ = times ÷ services · ยิ่งมาบ่อยในช่วงนั้นยิ่งสม่ำเสมอ
 */
export function attendanceInWindow(att: { date: string; ids: string[]; deleted?: boolean }[], today: string, days: number): { services: number; times: Map<string, number> } {
  const live = att.filter((a) => !a.deleted && a.ids.length > 0 && diffDays(today, a.date) >= 0 && diffDays(today, a.date) <= days)
  const dates = new Set(live.map((a) => a.date))
  const seen = new Set<string>()
  const times = new Map<string, number>()
  for (const a of live) for (const id of new Set(a.ids)) { const key = `${a.date}|${id}`; if (seen.has(key)) continue; seen.add(key); times.set(id, (times.get(id) ?? 0) + 1) }
  return { services: dates.size, times }
}
/**
 * เรียงตามความสม่ำเสมอ = จำนวนครั้งที่มานมัสการใน 1 ปีล่าสุด (ยิ่งมาบ่อยในรอบปี ยิ่งสม่ำเสมอ · มาน้อย = สม่ำเสมอน้อย)
 * high = มากสุดก่อน · จำนวนเท่ากันเรียงตามชื่อ
 */
export function orderByFrequency<T extends { id: string; name: string }>(list: T[], timesOf: (id: string) => number, high = true): T[] {
  return [...list].sort((x, y) => (high ? timesOf(y.id) - timesOf(x.id) : timesOf(x.id) - timesOf(y.id)) || x.name.localeCompare(y.name, 'th'))
}
/** จำนวนสมาชิกแยกตามสถานะจริง (1.สมบูรณ์ 1 → 7.เสียชีวิต · สถานะอื่น/ไม่ระบุอยู่ท้าย) */
export function statusBreakdown(members: { status?: string }[]): { label: string; rank: number; count: number }[] {
  const m = new Map<string, number>()
  for (const x of members) { const l = statusLabel(x.status); m.set(l, (m.get(l) ?? 0) + 1) }
  return [...m].map(([label, count]) => ({ label, rank: statusRank(label), count })).sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'th'))
}
/** เพศแยกตามสถานะ */
export function genderByStatus(members: { status?: string; gender?: string }[]): { label: string; rank: number; ชาย: number; หญิง: number; ไม่ระบุ: number }[] {
  const m = new Map<string, { ชาย: number; หญิง: number; ไม่ระบุ: number }>()
  for (const x of members) { const l = statusLabel(x.status), c = m.get(l) ?? { ชาย: 0, หญิง: 0, ไม่ระบุ: 0 }; c[x.gender === 'ชาย' ? 'ชาย' : x.gender === 'หญิง' ? 'หญิง' : 'ไม่ระบุ']++; m.set(l, c) }
  return [...m].map(([label, c]) => ({ label, rank: statusRank(label), ...c })).sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'th'))
}

/** ขาดนมัสการกี่เดือน (30 วัน = 1 เดือน) · ไม่เคยมีบันทึก = null */
export const absentMonths = (last: string | undefined, today: string): number | null => (last ? Math.floor(diffDays(today, last) / 30) : null)
/**
 * รายชื่อให้เลือกในตารางเยี่ยม: กรองสถานะได้หลายสถานะ (ว่าง = ทุกสถานะ) · ไม่พิมพ์ค้นหา → เฉพาะคนที่ขาดตั้งแต่ 1 เดือนขึ้นไป (รวมคนที่ไม่เคยมีบันทึก อยู่ท้าย)
 * เรียงจากขาดน้อย → มาก (1 เดือน, 2 เดือน, 3 เดือน …) · พิมพ์ค้นหา → ค้นทุกคนที่ตรงชื่อ/ชื่อเล่น (ไม่จำกัดว่าขาดหรือไม่)
 */
export function visitCandidates<T extends { id: string; name: string; nick?: string; status?: string }>(members: T[], opt: { status: string[]; q: string }, stats: Map<string, VisitStat>, today: string): T[] {
  const needle = opt.q.trim().toLowerCase()
  const mo = (m: T) => absentMonths(stats.get(m.id)?.last, today)
  return members
    .filter((m) => isLive(m) && (opt.status.length === 0 || opt.status.includes(statusLabel(m.status))) && (needle ? `${m.name} ${m.nick ?? ''}`.toLowerCase().includes(needle) : (mo(m) ?? 99) >= 1))
    .sort((a, b) => (mo(a) ?? 1e9) - (mo(b) ?? 1e9) || a.name.localeCompare(b.name, 'th'))
}

/** ความยาวแถบสีแดงของคนที่ขาด: 1 เดือนสั้น → ยาวขึ้นตามเดือนที่ขาด เต็มแถบที่ 12 เดือนขึ้นไป (ไม่เคยมีบันทึก = เต็ม) */
export const absenceBar = (months: number | null): number => (months === null ? 1 : Math.min(1, Math.max(0, months) / 12))
