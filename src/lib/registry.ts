import { diffDays, isISO, newId } from './money'
import type { Attendance, CheckIn, ChurchMember, MemberOverride } from './types'

/**
 * ตรวจคุณสมบัติสมาชิก (ย้ายมาจากหน้า "ตรวจสอบคุณสมบัติสมาชิกและการเข้าร่วมนมัสการ")
 * 0 สมบูรณ์ 1 (เป็นสมาชิกครบเกณฑ์ และยังมานมัสการ) · 5 สมบูรณ์ 2 (ครบเกณฑ์แต่ขาดนมัสการนานกว่ากำหนด)
 */
export type Tier = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const TIER_LABEL: Record<Tier, string> = { 0: 'สมาชิกสมบูรณ์ 1', 1: 'คุณสมบัติไม่ครบ', 2: 'ลาออก', 3: 'เสียชีวิต', 4: 'ปรับออก', 5: 'สมาชิกสมบูรณ์ 2', 6: 'ยังไม่ครบเกณฑ์' }
export const OVERRIDE_TIER: Record<MemberOverride, Tier> = { incomplete: 1, resigned: 2, deceased: 3, removed: 4 }

export interface Criteria { minYears: number; absentMonths: number }
export const DEFAULT_CRITERIA: Criteria = { minYears: 1, absentMonths: 6 }

/** ระดับสมาชิกสมบูรณ์ตามทะเบียน: "…( 1 )" = 1 · "…( 2 )" = 2 · อื่น ๆ ไม่มี */
export const regLevel = (st?: string): 1 | 2 | undefined => (/สมบูรณ์\s*\(\s*2\s*\)/.test(st ?? '') ? 2 : /สมบูรณ์\s*\(\s*1\s*\)/.test(st ?? '') ? 1 : undefined)
/** คำแนะนำจากการลงชื่อ: to2 = ทะเบียนว่า สมบูรณ์ 1 แต่ขาดนมัสการเกินเกณฑ์ · to1 = ทะเบียนว่า สมบูรณ์ 2 แต่กลับมานมัสการแล้ว */
export type Suggest = 'to2' | 'to1'

export interface Evaluated {
  suggest?: Suggest
  member: ChurchMember
  tier: Tier
  baseTier: Tier
  visits: number
  /** ครั้งที่มาในช่วง 12 เดือนล่าสุด */
  recent: number
  /** จำนวนครั้งนมัสการที่ "ควรมาได้" นับจากวันเป็นสมาชิก */
  possible: number
  /** 0–1 */
  cont: number
  tenureY: number
  firstAtt: string
  last: string
  /** วันที่ขาดต่อเนื่อง (นับจากมาล่าสุด · ไม่เคยมาในข้อมูล = นับจากวันเป็นสมาชิกหรือวันแรกที่มีข้อมูล) */
  idleDays: number | null
  /** ไม่มีบันทึกลงชื่อเลยในข้อมูลที่มี */
  noRecord: boolean
}

const YEAR = 365

/** ระดับของสมาชิกสมบูรณ์ 2 ตามระยะที่ขาด: 0 = เกินเกณฑ์ · 1 = เกิน 1 ปี … 5 = 5 ปีขึ้นไป */
export const bandOf = (e: Pick<Evaluated, 'idleDays'>): number => (e.idleDays == null ? 5 : Math.min(5, Math.floor(e.idleDays / YEAR)))
export const bandLabel = (b: number, months: number): string =>
  b === 0 ? `ขาดการนมัสการเกิน ${months} เดือน` : b >= 5 ? 'ขาดการนมัสการเกิน 5 ปีขึ้นไป' : `ขาดการนมัสการเกิน ${b} ปี`
export const cutoffOf = (today: string, months: number): string => {
  const [y, m, d] = today.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 - months, d))
  // วันที่ 31 ถอยไปเดือนที่สั้นกว่า: ให้เลื่อนไปวันสุดท้ายของเดือนนั้นแทนการล้นไปเดือนถัดไป
  if (t.getUTCDate() !== d) t.setUTCDate(0)
  return t.toISOString().slice(0, 10)
}

export function evaluate(members: ChurchMember[], attendance: Attendance[], criteria: Criteria, today: string): { rows: Evaluated[]; services: string[]; cutoff: string; hasData: boolean } {
  const live = attendance.filter((a) => !a.deleted && a.ids.length > 0)
  const services = [...new Set(live.map((a) => a.date))].sort()
  const present = new Map<string, string[]>() // memberId → วันที่มา (เรียง)
  for (const a of [...live].sort((x, y) => (x.date < y.date ? -1 : 1))) for (const id of new Set(a.ids)) (present.get(id) ?? present.set(id, []).get(id)!).push(a.date)
  const cutoff = cutoffOf(today, criteria.absentMonths)
  // ยังไม่มีบันทึกลงชื่อเลย: ตัดสิน "ขาดนมัสการ" ไม่ได้ (ทุกคนจะดูเหมือนขาด) → ยังไม่ครบเกณฑ์จนกว่าจะมีข้อมูล
  const hasData = services.length > 0
  const rows = members.map((m): Evaluated => {
    const days = present.get(m.id) ?? []
    const visits = days.length
    const status = m.status ?? ''
    const dead = /เสียชีวิต|สิ้นสภาพ/.test(status)
    const deceased = /เสียชีวิต/.test(status)
    const startIdx = m.since ? services.findIndex((d) => d >= m.since!) : 0
    const possible = Math.max(1, startIdx < 0 ? 1 : services.length - startIdx)
    const tenureY = m.since ? Math.max(0, diffDays(today, m.since)) / YEAR : 0
    const oldEnough = tenureY >= criteria.minYears
    // ตรวจเฉพาะคนที่ทะเบียนระบุว่าเป็นสมาชิกสมบูรณ์ (หรือยังไม่ระบุสถานะ) · คนใหม่/ผู้ร่วมนมัสการ/สมาชิกสำรองไม่นับเป็นสมาชิกสมบูรณ์ แม้มานานแล้ว
    const eligible = !status.trim() || /สมบูรณ์/.test(status)
    const sinceCutoff = days.filter((d) => d >= cutoff).length
    const absent = hasData && eligible && !dead && oldEnough && sinceCutoff === 0
    const qualified = hasData && eligible && !dead && oldEnough && sinceCutoff > 0
    const baseTier: Tier = deceased ? 3 : dead ? 2 : qualified ? 0 : absent ? 5 : 6
    const last = days[visits - 1] ?? ''
    const idleFrom = last || (m.since && services[0] && m.since > services[0] ? m.since : services[0] ?? m.since ?? '')
    const lvl = regLevel(status)
    const suggest: Suggest | undefined = m.override ? undefined : lvl === 1 && baseTier === 5 ? 'to2' : lvl === 2 && baseTier === 0 ? 'to1' : undefined
    return {
      member: m, baseTier, suggest, tier: m.override ? OVERRIDE_TIER[m.override] : baseTier,
      visits, recent: days.filter((d) => diffDays(today, d) <= YEAR).length, possible, cont: Math.min(1, visits / possible), tenureY,
      firstAtt: days[0] ?? '', last, idleDays: idleFrom ? diffDays(today, idleFrom) : null, noRecord: visits === 0,
    }
  })
  // เรียง: สมบูรณ์ 1 ตามอายุสมาชิกมากสุดก่อน · สมบูรณ์ 2 ตามที่เพิ่งขาดล่าสุด · กลุ่มอื่นตามความต่อเนื่อง
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    if (a.tier === 0) return (a.member.since ?? '9') < (b.member.since ?? '9') ? -1 : (a.member.since ?? '9') > (b.member.since ?? '9') ? 1 : b.cont - a.cont
    if (a.tier === 5) return (a.idleDays ?? 1e9) - (b.idleDays ?? 1e9)
    return b.cont * b.possible - a.cont * a.possible
  })
  return { rows, services, cutoff, hasData }
}

export interface Summary { total: number; byTier: Record<Tier, number>; complete: number; bands: number[]; records: number }
export function summarize(rows: Evaluated[]): Summary {
  const byTier = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<Tier, number>
  const bands = [0, 0, 0, 0, 0, 0]
  for (const r of rows) { byTier[r.tier]++; if (r.tier === 5) bands[bandOf(r)]++ }
  return { total: rows.length, byTier, complete: byTier[0] + byTier[5], bands, records: rows.reduce((a, r) => a + r.visits, 0) }
}

// ---------- นำเข้า CSV ----------
export const nameKey = (s: string) => s.replace(/\s+/g, '').toLowerCase()
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
/** แปลงวันที่จากไฟล์: YYYY-MM-DD, D/M/YYYY (รองรับ พ.ศ. ถ้าปี > 2400) · ไม่ใช่วันที่ = '' */
export function parseDateCell(raw: string): string {
  const s = raw.trim()
  let y: number, m: number, d: number
  const a = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(s)
  const b = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (a) [y, m, d] = [+a[1], +a[2], +a[3]]
  else if (b) [d, m, y] = [+b[1], +b[2], +b[3]]
  else return ''
  if (y > 2400) y -= 543
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isISO(iso) ? iso : ''
}
const HEAD: Record<string, string[]> = {
  name: ['ชื่อ-สกุล', 'ชื่อ–สกุล', 'ชื่อสกุล', 'ชื่อ', 'name'],
  nick: ['ชื่อเล่น', 'nickname', 'nick'],
  code: ['รหัส', 'เลขสมาชิก', 'code'],
  tel: ['โทร', 'เบอร์โทร', 'โทรศัพท์', 'tel', 'phone'],
  group: ['กลุ่ม', 'group'],
  note: ['หมายเหตุ', 'หมายเหต*', 'note'],
  birth: ['วันเกิด', 'birth'],
  applied: ['สมัคร', 'applied'],
  rec: ['ผู้บันทึก', 'recorder'],
  photo: ['image', 'รูป', 'รูปภาพ', 'photo'],
  status: ['สถานะ', 'status'],
  since: ['เข้าเป็นสมาชิก', 'วันเป็นสมาชิก', 'วันที่เป็นสมาชิก', 'since'],
}
export interface MemberImport { members: Omit<ChurchMember, 'id' | 'updated'>[]; skipped: number }
/** แถวแรกเป็นหัวคอลัมน์ (ต้องมี "ชื่อ") */
export function parseMemberRows(rows: string[][]): MemberImport | null {
  const head = rows[0]?.map(norm) ?? []
  // “ว/ด/ป-เข้าร่วมส…” (หัวคอลัมน์ในทะเบียนเดิมถูกตัด) = วันเข้าเป็นสมาชิก
  const col = (k: string) => head.findIndex((h) => HEAD[k].some((x) => norm(x) === h) || (k === 'since' && h.startsWith('ว/ด/ป')))
  const idx = Object.fromEntries(Object.keys(HEAD).map((k) => [k, col(k)])) as Record<string, number>
  if (idx.name < 0) return null
  const out: MemberImport['members'] = []
  let skipped = 0
  for (const r of rows.slice(1)) {
    const name = (r[idx.name] ?? '').trim()
    if (!name) { if (r.some((c) => c.trim())) skipped++; continue }
    const get = (k: string) => (idx[k] >= 0 ? (r[idx[k]] ?? '').trim() : '')
    const since = get('since') ? parseDateCell(get('since')) : ''
    const birth = get('birth') ? parseDateCell(get('birth')) : ''
    const m: Omit<ChurchMember, 'id' | 'updated'> = { name: name.replace(/[\u200b\u200c\u200d]/g, '').replace(/\s+/g, ' ') }
    for (const k of ['nick', 'code', 'tel', 'group', 'note', 'status'] as const) if (get(k)) m[k] = get(k).replace(/[\u200b\u200c\u200d]/g, '')
    if (since) m.since = since
    if (birth) m.birth = birth
    if (/^(yes|y|ใช่|true|1)$/i.test(get('applied'))) m.applied = true
    if (get('photo')) m.photo = get('photo')
    out.push(m)
  }
  return { members: out, skipped }
}
/** ไฟล์ลงชื่อ: คอลัมน์ "วันที่" (มีเวลาต่อท้ายได้) + "ชื่อ-สกุล" ต่อแถว (1 แถว = 1 คนที่มา) · ชื่อเล่น/สถานะ/กลุ่ม (ถ้ามี) ใช้ตอนเพิ่มคนที่ยังไม่อยู่ในทะเบียน */
export interface PersonInfo { name: string; nick?: string; status?: string; group?: string }
export interface RegisterRow { date: string; name: string; tm?: string; rec?: string }
export function parseAttendanceRows(rows: string[][]): { byDate: Map<string, string[]>; rows: RegisterRow[]; bad: number; info: Map<string, PersonInfo> } | null {
  const head = rows[0]?.map(norm) ?? []
  const di = head.findIndex((h) => ['วันที่', 'วัน', 'date'].includes(h))
  const ni = head.findIndex((h) => HEAD.name.some((x) => norm(x) === h))
  if (di < 0 || ni < 0) return null
  const col = (k: string) => head.findIndex((h) => HEAD[k].some((x) => norm(x) === h))
  const [ki, si, gi, ri] = [col('nick'), col('status'), col('group'), col('rec')]
  const clean = (v: string | undefined) => (v ?? '').replace(/[\u200b\u200c\u200d]/g, '').trim()
  const byDate = new Map<string, string[]>()
  const info = new Map<string, PersonInfo>()
  const out: RegisterRow[] = []
  let bad = 0
  for (const r of rows.slice(1)) {
    const name = clean(r[ni])
    if (!name && !(r[di] ?? '').trim()) continue
    const date = parseDateCell(r[di] ?? '')
    if (!date || !name) { bad++; continue }
    ;(byDate.get(date) ?? byDate.set(date, []).get(date)!).push(name)
    const tmm = /(\d{1,2}):(\d{2})/.exec(r[di] ?? '')
    out.push({ date, name, ...(tmm ? { tm: `${tmm[1].padStart(2, '0')}:${tmm[2]}` } : {}), ...(clean(r[ri]) ? { rec: clean(r[ri]).replace(/\s+/g, ' ') } : {}) })
    if (!info.has(norm(name))) info.set(norm(name), { name: name.replace(/\s+/g, ' '), ...(clean(r[ki]) ? { nick: clean(r[ki]) } : {}), ...(clean(r[si]) ? { status: clean(r[si]) } : {}), ...(clean(r[gi]) ? { group: clean(r[gi]) } : {}) })
  }
  return { byDate, rows: out, bad, info }
}
const clean0 = (s: string) => s.replace(/[\u200b\u200c\u200d]/g, '')
/** ตัดชื่อเล่นในวงเล็บท้ายชื่อ (ไฟล์ลงชื่อบางที่ตัดวงเล็บไม่ครบ) */
const stripNick = (s: string) => norm(clean0(s).replace(/[(（].*$/, ''))
/** จับชื่อในไฟล์กับทะเบียน: ชื่อ–สกุลตรงกันเป๊ะ → ไม่ตรงลองตัดชื่อเล่นในวงเล็บ · มีหลายคนชื่อเดียวกันถือว่าคลุมเครือ ไม่เดา */
export function matchNames(names: string[], members: ChurchMember[]): { ids: string[]; unknown: string[]; ambiguous: string[] } {
  const group = (f: (s: string) => string) => {
    const by = new Map<string, ChurchMember[]>()
    for (const m of members) (by.get(f(m.name)) ?? by.set(f(m.name), []).get(f(m.name))!).push(m)
    return by
  }
  const exact = group((s) => norm(clean0(s))), loose = group(stripNick)
  const ids = new Set<string>(), unknown: string[] = [], ambiguous: string[] = []
  for (const n of names) {
    const hit = exact.get(norm(clean0(n))) ?? loose.get(stripNick(n))
    if (!hit) unknown.push(n)
    else if (hit.length > 1) ambiguous.push(n)
    else ids.add(hit[0].id)
  }
  return { ids: [...ids], unknown, ambiguous }
}

// ---------- ยอดผู้เข้าร่วมรายครั้ง ----------
export interface ServiceStat { date: string; count: number; byStatus: Record<string, number>; names: string[] }
/** ชื่อสถานะตามทะเบียน (ยุบช่องว่างซ้ำ เพื่อให้ "1.สมบูรณ์  ( 1 )" กับ "1.สมบูรณ์ ( 1 )" นับเป็นอันเดียวกัน) */
export const statusLabel = (st?: string) => (st ?? '').replace(/\s+/g, ' ').trim() || '(ไม่ระบุสถานะ)'
/** สถานะจริงตามทะเบียนของคริสตจักร — เลือกได้เสมอ แม้ตอนนี้ยังไม่มีใครอยู่ในสถานะนั้น (คณะธรรมกิจ/กรรมการกำหนดเกณฑ์เลื่อนขั้น แอปไม่เลื่อนให้เอง) */
export const OFFICIAL_STATUSES = ['1.สมบูรณ์ ( 1 )', '2.สมบูรณ์ ( 2 )', '3.สมาชิกสำรอง', '4.ผู้ร่วมนมัสการ', '5.คนใหม่', '6.สิ้นสภาพสมาชิก', '7.เสียชีวิต']
export const NEW_PERSON_STATUS = '5.คนใหม่'
/** ตัวเลือกสถานะ = สถานะจริงทั้ง 7 + สถานะอื่นที่มีในข้อมูล (เผื่อมีการตั้งเพิ่ม) */
export const statusOptions = (members: { status?: string }[]) => [...new Set([...OFFICIAL_STATUSES, ...members.map((m) => statusLabel(m.status)).filter((x) => x !== statusLabel(undefined))])].sort((a, b) => a.localeCompare(b, 'th'))
/** ยอดผู้มานมัสการแต่ละครั้ง (นับเฉพาะคนที่ยังอยู่ในทะเบียน) พร้อมแยกตามสถานะ · เรียงใหม่ → เก่า */
export function serviceStats(attendance: Attendance[], members: ChurchMember[]): ServiceStat[] {
  const byId = new Map(members.map((m) => [m.id, m]))
  const merged = new Map<string, Set<string>>()
  for (const a of attendance) if (!a.deleted) for (const id of a.ids) if (byId.has(id)) (merged.get(a.date) ?? merged.set(a.date, new Set()).get(a.date)!).add(id)
  return [...merged.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1)).map(([date, ids]) => {
    const byStatus: Record<string, number> = {}
    const names: string[] = []
    for (const id of ids) { const m = byId.get(id)!; byStatus[statusLabel(m.status)] = (byStatus[statusLabel(m.status)] ?? 0) + 1; names.push(m.name) }
    return { date, count: ids.size, byStatus, names: names.sort((p, q) => p.localeCompare(q, 'th')) }
  })
}

/** อายุจากวันเกิด เช่น "45 ปี 6 เดือน" */
export function ageText(birth: string | undefined, today: string): string {
  if (!birth || birth > today) return ''
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0)
  if (months < 0) months = 0
  return `${Math.floor(months / 12)} ปี ${months % 12} เดือน`
}

// ---------- จับคู่ไฟล์รูปกับสมาชิก ----------
const baseName = (s: string) => clean0(s.normalize('NFC')).split(/[\\/]/).pop() ?? ''
/** ชื่อในไฟล์รูปรูปแบบทะเบียนเดิม "ชื่อ สกุล(ชื่อเล่น).Image.123456.jpg" → "ชื่อ สกุล(ชื่อเล่น)" */
const photoSubject = (file: string) => baseName(file).replace(/\.[a-z0-9]+$/i, '').replace(/\.Image\.\d+$/i, '')
/** หาสมาชิกเจ้าของรูป: ชื่อไฟล์ตรงกับที่ทะเบียนบันทึกไว้ → ชื่อ-สกุลตรงกัน → ตรงเมื่อตัดชื่อเล่น · คลุมเครือ (หลายคน) = ไม่เดา */
export function matchPhotoFile(file: string, members: ChurchMember[]): ChurchMember | undefined {
  const only = (xs: ChurchMember[]) => (xs.length === 1 ? xs[0] : undefined)
  const b = baseName(file).toLowerCase()
  const byFile = members.filter((m) => m.photo && baseName(m.photo).toLowerCase() === b)
  if (byFile.length) return only(byFile)
  const subj = photoSubject(file)
  const exact = members.filter((m) => nameKey(clean0(m.name)) === nameKey(subj))
  if (exact.length) return only(exact)
  return only(members.filter((m) => stripNick(m.name) === stripNick(subj)))
}

// ---------- ลงชื่อ 1 คน × 1 วัน ----------
export const checkInId = (date: string, mid: string) => `${date}_${mid}`
/** แปลงรายการลงชื่อ (รายคน) → รูปแบบ "วัน → รายชื่อ" ที่ตัวตรวจ/ยอดผู้มาใช้ · รองรับไฟล์รุ่นเก่า (1 วัน = รายชื่อทั้งชุด) ด้วย */
export function toAttendance(items: (CheckIn | Attendance)[]): Attendance[] {
  const byDate = new Map<string, Set<string>>()
  const add = (d: string, id: string) => (byDate.get(d) ?? byDate.set(d, new Set()).get(d)!).add(id)
  for (const x of items) {
    if (x.deleted) continue
    if ('ids' in x) x.ids.forEach((id) => add(x.date, id))
    else if (x.mid) add(x.date, x.mid)
  }
  return [...byDate.entries()].map(([date, ids]) => ({ id: date, date, ids: [...ids], updated: 0 }))
}

// ---------- ชื่อคล้ายกัน ----------
const lev = (a: string, b: string): number => {
  const m = a.length, n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}
/** สมาชิกที่ชื่อ–สกุลตรงหรือใกล้เคียงกับชื่อที่พิมพ์ (ตัดชื่อเล่นในวงเล็บ ไม่สนช่องว่าง) · exact = ตรงกันเป๊ะ */
export function similarNames(name: string, members: ChurchMember[], limit = 5): { member: ChurchMember; exact: boolean }[] {
  const q = stripNick(name)
  if (q.length < 3) return []
  const out: { member: ChurchMember; exact: boolean; d: number }[] = []
  for (const m of members) {
    const k = stripNick(m.name)
    if (!k) continue
    const d = k === q ? 0 : lev(k, q)
    // ใกล้เคียง: ต่างกันไม่เกิน ~20% ของความยาว (อย่างน้อย 1–3 ตัวอักษร) หรือชื่อหนึ่งเป็นส่วนต้นของอีกชื่อ (ตกนามสกุล)
    const tol = Math.max(1, Math.min(3, Math.floor(Math.max(k.length, q.length) * 0.2)))
    if (d <= tol || (q.length >= 5 && k.length >= 5 && (k.startsWith(q) || q.startsWith(k)))) out.push({ member: m, exact: d === 0, d })
  }
  return out.sort((a, b) => a.d - b.d).slice(0, limit).map(({ member, exact }) => ({ member, exact }))
}

/** id ใหม่ที่ไม่ซ้ำกับที่มีอยู่ (สร้างหลายรายการในมิลลิวินาทีเดียว newId ชนกันได้) */
export const uniqueId = (taken: Set<string>, prefix = 'cm') => { let id = newId(prefix); while (taken.has(id)) id = newId(prefix); taken.add(id); return id }
