import { addDays, dow, daysInMonth, fmtDate, monthName, weekStart } from './money'
import type { CalEvent, Repeat } from './types'

/** แก้ไข/ลบกิจกรรมในปฏิทินได้เฉพาะผู้บันทึก (และแอดมิน) — รายการเก่าที่ไม่มีผู้บันทึกแก้ได้ทุกคน */
export const canTouchEvent = (e: Pick<CalEvent, 'recId'>, meId: string, isAdmin: boolean) => !e.recId || e.recId === meId || isAdmin

export const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
export const DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const nthOf = (day: number) => Math.ceil(day / 7)

/** วันที่ของเดือน (y, m) ตามกติกาการทำซ้ำรายเดือน — วันที่ไม่มีในเดือนนั้น (เช่น 31) ใช้วันสุดท้ายของเดือน */
function monthDate(y: number, m: number, anchor: string, by: Repeat['by']): string {
  const dim = daysInMonth(y, m)
  const ad = Number(anchor.slice(8))
  if (by === 'last') return iso(y, m, dim)
  if (by === 'nth') {
    const want = dow(anchor), n = nthOf(ad)
    let d = 1 + ((want - dow(iso(y, m, 1)) + 7) % 7) + 7 * (n - 1)
    if (d > dim) d -= 7 // “สัปดาห์ที่ 5” ที่ไม่มี → ครั้งสุดท้ายของเดือน
    return iso(y, m, d)
  }
  return iso(y, m, Math.min(ad, dim))
}

/** วันที่ทั้งหมดของชุดที่ทำซ้ำ เรียงจากน้อยไปมาก เริ่มที่ anchor ไม่เกิน end (ยังไม่ตัด until/count) */
function* generate(anchor: string, r: Repeat, end: string): Generator<string> {
  const every = Math.max(1, Math.floor(r.every) || 1)
  let guard = 0
  if (r.freq === 'day') {
    for (let d = anchor; d <= end && guard++ < 40000; d = addDays(d, every)) yield d
  } else if (r.freq === 'week') {
    const days = [...new Set(r.days?.length ? r.days : [dow(anchor)])].sort((a, b) => a - b)
    for (let w = weekStart(anchor); w <= end && guard++ < 6000; w = addDays(w, 7 * every)) {
      for (const k of days) { const d = addDays(w, k); if (d >= anchor && d <= end) yield d }
    }
  } else if (r.freq === 'month') {
    const y0 = Number(anchor.slice(0, 4)), m0 = Number(anchor.slice(5, 7))
    for (let k = 0; guard++ < 3000; k += every) {
      const t = y0 * 12 + (m0 - 1) + k, y = Math.floor(t / 12), m = (t % 12) + 1
      if (iso(y, m, 1) > end) break
      const d = monthDate(y, m, anchor, r.by)
      if (d >= anchor && d <= end) yield d
    }
  } else {
    const y0 = Number(anchor.slice(0, 4)), m = Number(anchor.slice(5, 7)), ad = Number(anchor.slice(8))
    for (let k = 0; guard++ < 500; k += every) {
      const y = y0 + k
      if (iso(y, m, 1) > end) break
      const d = iso(y, m, Math.min(ad, daysInMonth(y, m)))
      if (d >= anchor && d <= end) yield d
    }
  }
}

/** วันที่ในช่วง [from, to] ที่กิจกรรมนี้เกิดขึ้น (รวมการทำซ้ำ · ตัดวันที่ยกเว้นออก) */
export function occurrences(ev: Pick<CalEvent, 'date' | 'repeat' | 'exdates'>, from: string, to: string): string[] {
  const ex = new Set(ev.exdates ?? [])
  const out: string[] = []
  const r = ev.repeat
  if (!r) return ev.date >= from && ev.date <= to && !ex.has(ev.date) ? [ev.date] : []
  const end = r.until && r.until < to ? r.until : to
  let n = 0
  for (const d of generate(ev.date, r, end)) {
    if (r.count && ++n > r.count) break
    if (d >= from && !ex.has(d)) out.push(d)
  }
  return out
}

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly-date' | 'monthly-nth' | 'monthly-last' | 'yearly' | 'custom'

/** ตัวเลือกสำเร็จรูปของ “ทำซ้ำ” (อิงวันที่ของกิจกรรม) */
export function presetRepeat(kind: Exclude<RepeatKind, 'none' | 'custom'>, anchor: string): Repeat {
  switch (kind) {
    case 'daily': return { freq: 'day', every: 1 }
    case 'weekly': return { freq: 'week', every: 1, days: [dow(anchor)] }
    case 'weekdays': return { freq: 'week', every: 1, days: [1, 2, 3, 4, 5] }
    case 'monthly-date': return { freq: 'month', every: 1, by: 'date' }
    case 'monthly-nth': return { freq: 'month', every: 1, by: 'nth' }
    case 'monthly-last': return { freq: 'month', every: 1, by: 'last' }
    case 'yearly': return { freq: 'year', every: 1 }
  }
}
const same = (a: Repeat, b: Repeat) => a.freq === b.freq && a.every === b.every && a.by === b.by && [...(a.days ?? [])].sort().join() === [...(b.days ?? [])].sort().join()
export function kindOf(r: Repeat | undefined, anchor: string): RepeatKind {
  if (!r) return 'none'
  const ks: Exclude<RepeatKind, 'none' | 'custom'>[] = ['daily', 'weekly', 'weekdays', 'monthly-date', 'monthly-nth', 'monthly-last', 'yearly']
  return ks.find((k) => same({ ...r, days: r.freq === 'week' ? r.days ?? [dow(anchor)] : undefined }, presetRepeat(k, anchor))) ?? 'custom'
}
/** ข้อความอธิบายตัวเลือกสำเร็จรูป เช่น “ทุกสัปดาห์ (วันพฤหัสบดี)” */
export function kindLabel(k: RepeatKind, anchor: string): string {
  const d = Number(anchor.slice(8)), m = Number(anchor.slice(5, 7)), w = DAY_NAMES[dow(anchor)]
  switch (k) {
    case 'none': return 'ไม่ซ้ำ'
    case 'daily': return 'ทุกวัน'
    case 'weekly': return `ทุกสัปดาห์ (วัน${w})`
    case 'weekdays': return 'ทุกวันธรรมดา (จันทร์–ศุกร์)'
    case 'monthly-date': return `ทุกเดือน (วันที่ ${d})`
    case 'monthly-nth': return `ทุกเดือน (วัน${w}ที่ ${nthOf(d)})`
    case 'monthly-last': return 'ทุกเดือน (วันสุดท้ายของเดือน)'
    case 'yearly': return `ทุกปี (${d} ${monthName(m)})`
    case 'custom': return 'กำหนดเอง…'
  }
}

/** สรุปการทำซ้ำเป็นข้อความสั้น (แสดงในรายการ) */
export function describeRepeat(r: Repeat | undefined, anchor: string): string {
  if (!r) return ''
  const n = r.every > 1 ? `ทุก ${r.every} ` : 'ทุก'
  const d = Number(anchor.slice(8))
  let t: string
  if (r.freq === 'day') t = r.every > 1 ? `ทุก ${r.every} วัน` : 'ทุกวัน'
  else if (r.freq === 'week') {
    const ds = [...new Set(r.days?.length ? r.days : [dow(anchor)])].sort((a, b) => a - b)
    t = ds.join() === '1,2,3,4,5' && r.every === 1 ? 'ทุกวันธรรมดา' : `${n}สัปดาห์ วัน${ds.map((x) => DAY_NAMES[x]).join(', ')}`
  } else if (r.freq === 'month') t = `${n}เดือน ${r.by === 'last' ? 'วันสุดท้ายของเดือน' : r.by === 'nth' ? `วัน${DAY_NAMES[dow(anchor)]}ที่ ${nthOf(d)}` : `วันที่ ${d}`}`
  else t = `${n}ปี (${d} ${monthName(Number(anchor.slice(5, 7)))})`
  return t + (r.until ? ` · ถึง ${fmtDate(r.until)}` : r.count ? ` · ${r.count} ครั้ง` : '')
}
