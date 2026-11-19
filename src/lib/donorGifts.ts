import { addDays, parseBaht, sheetSunday, todayISO } from './money'
import type { DonorGift, GiftKind } from './types'

export const GIFT_KINDS: { k: GiftKind; label: string; short: string; color: string; soft: string }[] = [
  { k: 'weekly', label: 'ถวายประจำสัปดาห์', short: 'ประจำสัปดาห์', color: '#23814a', soft: '#e3f4ea' },
  { k: 'tithe', label: 'ถวายสิบลด', short: 'สิบลด', color: '#0f7f8f', soft: '#dff2f4' },
  { k: 'thanks', label: 'ถวายขอบพระคุณ', short: 'ขอบพระคุณ', color: '#d9660a', soft: '#fdecd8' },
  { k: 'building', label: 'ถวายสร้างอาคาร', short: 'สร้างอาคาร', color: '#2557b8', soft: '#e6eefc' },
  { k: 'welfare', label: 'ถวายเพื่อสวัสดิการผู้รับใช้', short: 'สวัสดิการผู้รับใช้', color: '#b0366b', soft: '#fbe6f0' },
  { k: 'project', label: 'ถวายโครงการ/งานพิเศษ', short: 'โครงการ', color: '#8a6a00', soft: '#fbf1cf' },
  { k: 'loan', label: 'ให้คริสตจักรยืม', short: 'ให้ยืม', color: '#7a3fb0', soft: '#efe6f9' },
  { k: 'other', label: 'อื่น ๆ', short: 'อื่น ๆ', color: '#5b6577', soft: '#eceff4' },
]
export const kindInfo = (k: GiftKind) => GIFT_KINDS.find((x) => x.k === k) ?? GIFT_KINDS[GIFT_KINDS.length - 1]

/** ยอด 300 = ประจำสัปดาห์ · ยอดอื่นที่ไม่ได้ระบุ = ขอบพระคุณ (ค่าเริ่มต้นตอนเพิ่มเอง) */
export const guessKind = (satang: number): GiftKind => (satang === 30000 ? 'weekly' : 'thanks')

const WORDS: [RegExp, GiftKind][] = [[/tithe|สิบลด/i, 'tithe'], [/weekly|ประจำ/i, 'weekly'], [/thanks|ขอบพระคุณ/i, 'thanks'], [/building|อาคาร/i, 'building'], [/welfare|สวัสดิการ|เงินเดือน/i, 'welfare'], [/project|โครงการ/i, 'project'], [/loan|ยืม/i, 'loan'], [/other|อื่น/i, 'other']]
const kindOfWord = (w: string): GiftKind | null => { for (const [re, k] of WORDS) if (re.test(w)) return k; return null }

/** แปลงข้อความวางหลายบรรทัด: "2026-05-24 16:55 300 weekly 0123456789ABC หมายเหตุ" (วันที่ เวลา จำนวน ประเภท [เลขที่รายการ] [หมายเหตุ]) */
export function parseGiftLines(text: string, code: string): { rows: Omit<DonorGift, 'id' | 'updated'>[]; errors: string[] } {
  const rows: Omit<DonorGift, 'id' | 'updated'>[] = [], errors: string[] = []
  // บรรทัดที่ไม่ได้ขึ้นต้นด้วยวันที่ = ส่วนที่ถูกตัดขึ้นบรรทัดใหม่ตอนคัดลอก (เช่น เลขที่รายการตกลงมาบรรทัดถัดไป) ให้ต่อกับบรรทัดก่อนหน้า
  const lines: string[] = []
  for (const l of text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
    if (/^\d{4}-\d{2}-\d{2}\b/.test(l) || lines.length === 0) lines.push(l)
    else lines[lines.length - 1] += ` ${l}`
  }
  lines.forEach((line, i) => {
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(?:(\d{1,2}:\d{2})\s+)?([\d,]+(?:\.\d{1,2})?)\s+(\S+)(?:\s+([0-9A-Za-z]{10,}))?(?:\s+(.*))?$/)
    if (!m) { errors.push(`บรรทัด ${i + 1}: รูปแบบไม่ถูกต้อง`); return }
    const amount = parseBaht(m[3]), kind = kindOfWord(m[4])
    if (Number.isNaN(amount) || amount <= 0) { errors.push(`บรรทัด ${i + 1}: จำนวนเงินไม่ถูกต้อง`); return }
    if (!kind) { errors.push(`บรรทัด ${i + 1}: ไม่รู้จักประเภท “${m[4]}” (weekly/tithe/thanks/building/welfare/project/loan/other)`); return }
    // #ชื่อโครงการ ในหมายเหตุ = ชื่อโครงการ (ใช้กับประเภท project)
    const tag = (m[6] ?? '').match(/#(\S+)/)
    const note = (m[6] ?? '').replace(/#\S+/, '').trim()
    rows.push({ code, date: m[1], ...(m[2] ? { time: m[2].padStart(5, '0') } : {}), amount, kind, ...(m[5] ? { ref: m[5] } : {}), ...(note ? { note } : {}), ...(tag ? { project: tag[1] } : {}) })
  })
  return { rows, errors }
}

/** อาทิตย์ที่ไม่มีการถวายประจำ (ประจำสัปดาห์หรือสิบลด) ตั้งแต่สัปดาห์แรกที่มีข้อมูลถึงสัปดาห์ล่าสุดที่จบแล้ว (นับตามอาทิตย์ปลายสัปดาห์ของใบบันทึก) */
export function missingWeeks(gifts: Pick<DonorGift, 'date' | 'kind' | 'deleted'>[], today = todayISO()): string[] {
  const live = gifts.filter((g) => !g.deleted)
  if (!live.length) return []
  const first = sheetSunday(live.map((g) => g.date).sort()[0])
  const thisSun = sheetSunday(today)
  const last = thisSun > today ? addDays(thisSun, -7) : thisSun
  const have = new Set(regularOf(live).map((g) => sheetSunday(g.date)))
  const out: string[] = []
  for (let d = first; d <= last; d = addDays(d, 7)) if (!have.has(d)) out.push(d)
  return out
}

export const giftId = (code: string, g: { ref?: string; date: string; time?: string; amount: number }) => `dg:${code}:${g.ref ?? `${g.date}${g.time ?? ''}-${g.amount}`}`

const isRegular = (g: Pick<DonorGift, 'kind' | 'deleted'>) => !g.deleted && (g.kind === 'weekly' || g.kind === 'tithe')
/** การถวายที่ใช้ตรวจความสม่ำเสมอ: ประจำสัปดาห์/สิบลด · ถ้าผู้ถวายคนนั้นไม่มีสองประเภทนี้เลย (เช่น ถวายขอบพระคุณทุกสัปดาห์) ใช้ขอบพระคุณแทน */
function regularOf<T extends Pick<DonorGift, 'kind' | 'deleted'>>(gifts: T[]): T[] {
  const r = gifts.filter(isRegular)
  return r.length ? r : gifts.filter((g) => !g.deleted && g.kind === 'thanks')
}
/** ผู้ถวายแบบรายเดือน: การถวายประจำ (ประจำสัปดาห์/สิบลด) มีไม่เกิน ~1 ครั้งต่อเดือนที่มีข้อมูล → ตรวจเป็นเดือน ไม่ใช่เป็นสัปดาห์ */
export function isMonthlyGiver(gifts: Pick<DonorGift, 'date' | 'kind' | 'deleted'>[]): boolean {
  const reg = regularOf(gifts)
  if (reg.length < 3) return false
  const months = new Set(reg.map((g) => g.date.slice(0, 7)))
  return reg.length <= months.size * 1.3
}
/** เดือนที่จบแล้ว (YYYY-MM) ตั้งแต่เดือนแรกที่มีการถวายประจำ ที่ไม่พบการถวายประจำ — ไม่นับเดือนปัจจุบันที่ยังไม่จบ */
export function missingMonths(gifts: Pick<DonorGift, 'date' | 'kind' | 'deleted'>[], today = todayISO()): string[] {
  const reg = regularOf(gifts)
  if (!reg.length) return []
  const have = new Set(reg.map((g) => g.date.slice(0, 7)))
  const first = reg.map((g) => g.date.slice(0, 7)).sort()[0], cur = today.slice(0, 7)
  const out: string[] = []
  let y = Number(first.slice(0, 4)), m = Number(first.slice(5, 7))
  for (;;) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    if (ym >= cur) break
    if (!have.has(ym)) out.push(ym)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

/** สรุปยอดตามโครงการ (ประเภท project) เรียงยอดมากไปน้อย */
export function projectTotals(gifts: Pick<DonorGift, 'kind' | 'project' | 'amount' | 'deleted'>[]): { project: string; n: number; total: number }[] {
  const m = new Map<string, { project: string; n: number; total: number }>()
  for (const g of gifts) if (!g.deleted && g.kind === 'project') { const k = g.project || '(ไม่ระบุโครงการ)'; const e = m.get(k) ?? { project: k, n: 0, total: 0 }; e.n++; e.total += g.amount; m.set(k, e) }
  return [...m.values()].sort((a, b) => b.total - a.total)
}
export interface GiftImport { gifts: DonorGift[]; exts: { id: string; code: string; name: string; group?: boolean; updated: number }[] }
/** ตรวจไฟล์นำเข้า (JSON) ก่อนลงข้อมูล */
export function checkImport(j: unknown): { ok: true; data: GiftImport } | { ok: false; error: string } {
  const o = j as Partial<GiftImport> | null
  if (!o || !Array.isArray(o.gifts)) return { ok: false, error: 'ไฟล์ไม่ใช่รูปแบบประวัติการถวาย' }
  for (const g of o.gifts) if (!g || typeof g.id !== 'string' || typeof g.code !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(g.date) || !(g.amount > 0) || !GIFT_KINDS.some((k) => k.k === g.kind)) return { ok: false, error: `รายการผิดรูปแบบ: ${JSON.stringify(g).slice(0, 80)}` }
  return { ok: true, data: { gifts: o.gifts, exts: Array.isArray(o.exts) ? o.exts : [] } }
}

/** ข้อความนำเข้าแบบวางทีละบรรทัด: "รหัส|วันที่|บาท|ประเภท|โครงการ|หมายเหตุ" · บรรทัดผู้ถวายภายนอก: "EXT|รหัส|ชื่อ|group(ถ้าเป็นกลุ่ม)" · หรือวาง JSON ทั้งไฟล์ก็ได้ */
export function parseImportText(text: string): { ok: true; data: GiftImport } | { ok: false; error: string } {
  const t = text.trim()
  if (t.startsWith('{')) { try { return checkImport(JSON.parse(t)) } catch { return { ok: false, error: 'JSON ไม่ถูกต้อง (ข้อความอาจถูกตัด)' } } }
  const gifts: DonorGift[] = [], exts: GiftImport['exts'] = [], seen = new Map<string, number>()
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i].split('|').map((x) => x.trim())
    if (c[0] === 'EXT') { if (!/^X\d+$/.test(c[1] ?? '') || !c[2]) return { ok: false, error: `บรรทัด ${i + 1}: ผู้ถวายภายนอกผิดรูปแบบ` }; exts.push({ id: `dx:${c[1]}`, code: c[1], name: c[2], ...(c[3] === 'group' ? { group: true } : {}), updated: 0 }); continue }
    const [code, date, baht, kindW, project, note] = c
    const amount = parseBaht(baht ?? ''), kind = kindW ? kindOfWord(kindW) : null
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || Number.isNaN(amount) || amount <= 0 || !kind) return { ok: false, error: `บรรทัด ${i + 1}: ผิดรูปแบบ (ขาดรหัส/วันที่/จำนวน/ประเภท) หรือข้อความถูกตัด` }
    const k = `${code}:${date}:${amount}`, n = (seen.get(k) ?? 0) + 1; seen.set(k, n)
    gifts.push({ id: `dg:${code}:x:${date}:${amount}:${n}`, updated: 0, code, date, amount, kind, src: 'xlsx', ...(project ? { project } : {}), ...(note ? { note } : {}) })
  }
  if (!gifts.length) return { ok: false, error: 'ไม่พบรายการ' }
  return { ok: true, data: { gifts, exts } }
}

export interface GiftFilter { from?: string; to?: string; kinds?: GiftKind[]; project?: string; codes?: Set<string> }
/** กรองรายการถวาย (วันที่ ประเภท โครงการ รายชื่อ) */
export function filterGifts<T extends Pick<DonorGift, 'date' | 'kind' | 'project' | 'code' | 'deleted'>>(gifts: T[], f: GiftFilter): T[] {
  return gifts.filter((g) => !g.deleted && (!f.from || g.date >= f.from) && (!f.to || g.date <= f.to) && (!f.kinds || f.kinds.includes(g.kind)) && (!f.project || g.project === f.project) && (!f.codes || f.codes.has(g.code)))
}
export type RankKey = 'total' | 'count' | 'name' | 'last'
export interface RankRow { code: string; name: string; n: number; total: number; last: string; first: string; byKind: Partial<Record<GiftKind, number>> }
/** จัดอันดับผู้ถวาย: รวมต่อคน แล้วเรียงตามยอด/จำนวนครั้ง/ชื่อ/ล่าสุด */
export function rankDonors(gifts: Pick<DonorGift, 'code' | 'amount' | 'date' | 'kind'>[], nameOf: (c: string) => string, key: RankKey, desc = true): RankRow[] {
  const m = new Map<string, RankRow>()
  for (const g of gifts) { const r = m.get(g.code) ?? { code: g.code, name: nameOf(g.code), n: 0, total: 0, last: '', first: '9999', byKind: {} }; r.n++; r.total += g.amount; if (g.date > r.last) r.last = g.date; if (g.date < r.first) r.first = g.date; r.byKind[g.kind] = (r.byKind[g.kind] ?? 0) + g.amount; m.set(g.code, r) }
  const cmp = (a: RankRow, b: RankRow) => key === 'name' ? a.name.localeCompare(b.name, 'th') : key === 'count' ? a.n - b.n || a.total - b.total : key === 'last' ? a.last.localeCompare(b.last) : a.total - b.total
  const out = [...m.values()].sort(cmp)
  return desc ? out.reverse() : out
}
