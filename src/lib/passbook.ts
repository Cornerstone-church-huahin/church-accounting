import { addDays, sheetSunday } from './money'
import type { IncomeEntry, IncomeType, PassbookLine, PbKind } from './types'

export interface RawPbRow { date?: string; code?: string; desc?: string; deposit?: number; withdraw?: number; balance?: number }

const IN_WORDS = /โอน|transfer|promptpay|พร้อมเพย์|k\s?plus|mobile|app|อิเล็ก|ibanking|atm/i

/**
 * จัดชนิดบรรทัด — ดูรหัสรายการของสมุดก่อน (ธนาคารกรุงเทพ: DEP/NBD = ฝากเงินสด · TRD = โอนเข้า · W/D = ถอนเงินสด · TRW/TRC = โอนออก · INT/TAX/FEE = ดอกเบี้ย/ภาษี/ค่าธรรมเนียม)
 * ถ้าไม่มีรหัสค่อยดูคำอธิบาย แล้วดูว่าเป็นฝากหรือถอน
 */
export function classify(r: RawPbRow): PbKind {
  const code = (r.code ?? '').trim().toUpperCase().replace(/\s+/g, '')
  const d = r.desc ?? ''
  const dep = (r.deposit ?? 0) > 0
  if (/^(INT|TAX|FEE|CHG|SVC)/.test(code) || /ดอกเบี้ย|ภาษี|ค่าธรรมเนียม|fee|interest/i.test(d)) return 'other'
  if (/^(DEP|NBD|CDM|CSH|CASHDEP)/.test(code)) return 'deposit'
  if (/^(TRD|TRI|PMI|ITR)/.test(code)) return 'in'
  if (/^(W\/?D|WDL|WTD|CSW)/.test(code)) return 'withdraw'
  if (/^(TRW|TRC|TRO|PMO)/.test(code)) return 'out'
  if (dep) return IN_WORDS.test(d) && !/เงินสด|cash|cdm/i.test(d) ? 'in' : 'deposit'
  return IN_WORDS.test(d) && !/เงินสด|cash/i.test(d) ? 'out' : 'withdraw'
}

/**
 * ใช้ยอดคงเหลือเป็นตัวชี้ขาดว่าบรรทัดเป็นฝากหรือถอน (ผู้อ่านรูปมักใส่ผิดช่องเพราะตัวเลขนำหน้าด้วย ****)
 * — บรรทัดที่ยอดต่างจากบรรทัดก่อน = จำนวนเงินพอดี ให้ใช้ทิศตามส่วนต่าง · ไม่มีจำนวนเงินแต่มียอดคงเหลือ ให้คำนวณจากส่วนต่าง
 */
export function normalizeRows<T extends { deposit?: number; withdraw?: number; balance?: number }>(rows: T[]): T[] {
  return rows.map((r, i) => {
    const prev = i > 0 ? rows[i - 1].balance : undefined
    if (prev === undefined || r.balance === undefined) return r
    const delta = r.balance - prev
    const amt = (r.deposit ?? 0) > 0 ? (r.deposit as number) : (r.withdraw ?? 0) > 0 ? (r.withdraw as number) : 0
    if (delta !== 0 && (amt === 0 || Math.abs(delta) === amt)) {
      const { deposit: _d, withdraw: _w, ...rest } = r
      return { ...rest, ...(delta > 0 ? { deposit: Math.abs(delta) } : { withdraw: Math.abs(delta) }) } as T
    }
    return r
  })
}

/** ส่วนต่างที่หายไปก่อนบรรทัด i (ยอดคงเหลือจริง − ยอดที่คำนวณจากบรรทัดก่อน) — ไม่เท่า 0 แปลว่าอาจมีบรรทัดตกหล่นหรืออ่านเลขผิด */
export function chainGap(rows: { deposit?: number; withdraw?: number; balance?: number }[], i: number): number {
  const p = rows[i - 1]?.balance, c = rows[i]
  if (i < 1 || p === undefined || c?.balance === undefined) return 0
  return c.balance - (p + (c.deposit ?? 0) - (c.withdraw ?? 0))
}

/** ตรวจลูกโซ่ยอดคงเหลือ: ยอดก่อนหน้า + ฝาก − ถอน ต้องเท่ายอดคงเหลือของบรรทัด คืนดัชนีบรรทัดที่ไม่ลงตัว (บรรทัดแรกใช้เป็นฐาน) */
export function checkChain(rows: { deposit?: number; withdraw?: number; balance?: number }[]): number[] {
  const bad: number[] = []
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i - 1].balance, c = rows[i]
    if (p === undefined || c.balance === undefined) continue
    if (p + (c.deposit ?? 0) - (c.withdraw ?? 0) !== c.balance) bad.push(i)
  }
  return bad
}

/** ลายนิ้วมือของบรรทัด: วันที่ + จำนวนเงิน + ยอดคงเหลือ (ยอดคงเหลือไม่ซ้ำกันในสมุดเดียว จึงแยกบรรทัดฝาก/ถอนจำนวนเท่ากันวันเดียวกันได้) — ไม่ใช้ชนิดรายการ เพราะอ่านรอบหลังอาจจัดชนิดต่างจากรอบแรก */
const sig = (l: { date: string; amount: number; balance?: number }) => `${l.date}|${l.amount}|${l.balance ?? ''}`

/** ดัชนีของบรรทัดใหม่ที่ซ้ำกับที่มีอยู่แล้ว (ถ่ายหน้าทับกัน) หรือซ้ำกันเองในรูปเดียว · ไม่มียอดคงเหลือ: นับจำนวนครั้งที่เจอ ไม่ตัดบรรทัดจริงที่จำนวนเท่ากัน */
export function dupIndexes(existing: { date: string; amount: number; balance?: number }[], fresh: { date: string; amount: number; balance?: number }[]): Set<number> {
  const have = new Map<string, number>()
  for (const e of existing) have.set(sig(e), (have.get(sig(e)) ?? 0) + 1)
  const dup = new Set<number>()
  const seen = new Map<string, number>()
  fresh.forEach((f, i) => {
    const k = sig(f)
    const n = (seen.get(k) ?? 0) + 1
    seen.set(k, n)
    // มียอดคงเหลือ = 1 บรรทัดต่อลายนิ้วมือ · ไม่มียอดคงเหลือ = ถือว่าซ้ำเมื่อของเดิมมีจำนวนครบแล้ว
    const limit = f.balance === undefined ? have.get(k) ?? 0 : (have.get(k) ?? 0) > 0 ? 0 : 1
    if (n > limit) dup.add(i)
  })
  return dup
}
/** ตัดบรรทัดที่ซ้ำกับที่มีอยู่แล้ว */
export function dedupeLines<T extends { date: string; amount: number; balance?: number }>(existing: { date: string; amount: number; balance?: number }[], fresh: T[]): T[] {
  const d = dupIndexes(existing, fresh)
  return fresh.filter((_, i) => !d.has(i))
}

export const lineWeek = (l: Pick<PassbookLine, 'date' | 'week'>) => l.week ?? sheetSunday(l.date)

export const BANK_UNKNOWN = '__bank_unknown'
export const BANK_UNKNOWN_LABEL = 'ไม่ทราบที่มา (Unknown)'
export const BANK_UNKNOWN_OUT = '__bank_unknown_out'
export const BANK_UNKNOWN_OUT_LABEL = 'ไม่ทราบรายจ่าย (Unknown)'

/** วันที่ที่ใช้นับบรรทัดสมุดเข้าสัปดาห์/ช่วง: ถ้าผู้ใช้ย้ายสัปดาห์ ใช้วันอาทิตย์ของสัปดาห์นั้น */
export const lineDate = (l: Pick<PassbookLine, 'date' | 'week'>) => l.week ?? l.date

/** จับคู่บรรทัด "โอนเข้า" ในสมุดกับสลิป/รายรับโอนตามยอดเท่ากัน (± 3 วัน) หรือที่ผู้ใช้ผูกไว้ → แผนที่ id บรรทัด → id รายรับ */
export function matchBankIn(all: PassbookLine[], income: IncomeEntry[]): Map<string, string> {
  const live = income.filter((x) => !x.deleted)
  const out = new Map<string, string>()
  const used = new Set<string>()
  const ins = all.filter((l) => !l.deleted && l.kind === 'in').sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  for (const l of ins) if (l.link?.kind === 'income' && l.link.id && live.some((x) => x.id === l.link?.id)) { out.set(l.id, l.link.id); used.add(l.link.id) }
  for (const l of ins) {
    if (out.has(l.id) || l.link) continue
    const hit = live.find((x) => x.method === 'transfer' && !used.has(x.id) && x.amount === l.amount && Math.abs((Date.parse(x.date) - Date.parse(l.date)) / 864e5) <= 3)
    if (hit) { out.set(l.id, hit.id); used.add(hit.id) }
  }
  return out
}

const isIn = (l: PassbookLine) => l.kind === 'in' || (l.kind === 'other' && l.dir === 'in')
const isOut = (l: PassbookLine) => l.kind === 'out' || (l.kind === 'other' && l.dir === 'out')

/** เงินเข้าสมุด (โอนเข้า/ดอกเบี้ย) ที่ไม่มีสลิปและยังไม่ได้ลงเป็นรายรับหรือพักไว้ → นับในใบสรุปเป็นรายรับ "ไม่ทราบที่มา (Unknown)" */
export function unknownBankIn(all: PassbookLine[], income: IncomeEntry[]): PassbookLine[] {
  const m = matchBankIn(all, income)
  return all.filter((l) => !l.deleted && isIn(l) && !l.link && !m.has(l.id))
}

/**
 * เงินออกสมุด (โอนออก/ค่าธรรมเนียม/ภาษี) ที่ไม่มีรายจ่ายแบบโอนตรงกัน (ยอดเท่ากัน ± 3 วัน) → นับเป็นรายจ่าย "ไม่ทราบรายจ่าย (Unknown)"
 * — การถอนเงินสด (W/D) ไม่นับ เพราะเป็นแค่ย้ายเงินออกมาจ่าย รายจ่ายนับตามบิลที่จ่ายจริงอยู่แล้ว
 */
export function unknownBankOut(all: PassbookLine[], expenses: { id: string; deleted?: boolean; amount: number; method?: 'cash' | 'transfer'; status: 'open' | 'paid'; date: string; paidDate?: string }[]): PassbookLine[] {
  const live = expenses.filter((x) => !x.deleted && x.status === 'paid' && x.method === 'transfer')
  const used = new Set<string>()
  const outs = all.filter((l) => !l.deleted && isOut(l)).sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const res: PassbookLine[] = []
  for (const l of outs) {
    if (l.link) continue
    const hit = live.find((x) => !used.has(x.id) && x.amount === l.amount && Math.abs((Date.parse(x.paidDate ?? x.date) - Date.parse(l.date)) / 864e5) <= 3)
    if (hit) used.add(hit.id); else res.push(l)
  }
  return res
}

export interface Reconcile {
  deposits: PassbookLine[]; transfersIn: PassbookLine[]; withdraws: PassbookLine[]; others: PassbookLine[]
  depositSum: number; withdrawSum: number
  /** สลิป/รายรับโอนในสัปดาห์ จับคู่กับบรรทัดโอนเข้าในสมุดตามยอด (± 3 วัน) */
  matchedIn: { line: PassbookLine; income: IncomeEntry }[]
  unmatchedIn: PassbookLine[]
  unmatchedSlips: IncomeEntry[]
  /** ยอดคงเหลือตามสมุด ณ สิ้นสัปดาห์ (บรรทัดสุดท้ายที่นับถึงสัปดาห์นี้) */
  closing?: number
}

export function reconcileWeek(sunday: string, all: PassbookLine[], income: IncomeEntry[]): Reconcile {
  all = all.filter((l) => !l.deleted)
  const mine = all.filter((l) => lineWeek(l) === sunday).sort((a, b) => a.date.localeCompare(b.date))
  const deposits = mine.filter((l) => l.kind === 'deposit')
  const transfersIn = mine.filter((l) => l.kind === 'in')
  const withdraws = mine.filter((l) => l.kind === 'withdraw')
  const others = mine.filter((l) => l.kind === 'out' || l.kind === 'other')
  const matched = matchBankIn(all, income)
  const slips = income.filter((x) => !x.deleted && x.method === 'transfer' && x.date > addDays(sunday, -10) && x.date <= addDays(sunday, 3))
  const matchedIn: Reconcile['matchedIn'] = []
  const unmatchedIn: PassbookLine[] = []
  for (const l of transfersIn) {
    const inc = income.find((x) => x.id === matched.get(l.id))
    if (inc) matchedIn.push({ line: l, income: inc }); else unmatchedIn.push(l)
  }
  const used = new Set(matched.values())
  const upto = all.filter((l) => lineWeek(l) <= sunday && l.balance !== undefined).sort((a, b) => a.date.localeCompare(b.date))
  return {
    deposits, transfersIn, withdraws, others,
    depositSum: deposits.reduce((s, l) => s + l.amount, 0), withdrawSum: withdraws.reduce((s, l) => s + l.amount, 0),
    matchedIn, unmatchedIn, unmatchedSlips: slips.filter((x) => !used.has(x.id) && x.date <= sunday && x.date > addDays(sunday, -7)),
    closing: upto.length ? upto[upto.length - 1].balance : undefined,
  }
}

/** คำอธิบายรหัสรายการในสมุด (ธนาคารกรุงเทพ) ไว้แสดงเป็นหมายเหตุ */
export const CODE_LEGEND = 'DEP/NBD = ฝากเงินสด · TRD = โอนเข้า · W/D = ถอนเงินสด · TRW = โอนออก · INT = ดอกเบี้ย'

/** ประเภทถวายที่ระบุไว้ในลายมือ/หมายเหตุข้างบรรทัดสมุด (เช่น "สิบลด") — ต้องมีชื่อประเภทอยู่ในข้อความจริง ไม่เดา · ไม่พบ = ไม่ทราบที่มา */
export function typeFromNote(text: string | undefined, types: IncomeType[]): string | undefined {
  const t = (text ?? '').replace(/\s+/g, '')
  if (!t) return undefined
  const names = types.filter((x) => x.active).map((x) => ({ id: x.id, n: x.name.replace(/\s+/g, '').replace(/\(.*\)/, '') })).filter((x) => x.n.length >= 3).sort((a, b) => b.n.length - a.n.length)
  return names.find((x) => t.includes(x.n))?.id
}
