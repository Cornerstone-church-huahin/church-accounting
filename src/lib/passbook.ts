import { addDays, sheetSunday } from './money'
import type { IncomeEntry, PassbookLine, PbKind } from './types'

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

const sig = (l: { date: string; amount: number; balance?: number; kind: string }) => `${l.date}|${l.kind}|${l.amount}|${l.balance ?? ''}`
/** ตัดบรรทัดที่ซ้ำกับที่มีอยู่แล้ว (ถ่ายหน้าสมุดทับกัน) */
export function dedupeLines<T extends { date: string; amount: number; balance?: number; kind: string }>(existing: T[], fresh: T[]): T[] {
  const have = new Set(existing.map(sig))
  const out: T[] = []
  for (const f of fresh) { const s = sig(f); if (!have.has(s)) { have.add(s); out.push(f) } }
  return out
}

export const lineWeek = (l: Pick<PassbookLine, 'date' | 'week'>) => l.week ?? sheetSunday(l.date)

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
  const mine = all.filter((l) => lineWeek(l) === sunday).sort((a, b) => a.date.localeCompare(b.date))
  const deposits = mine.filter((l) => l.kind === 'deposit')
  const transfersIn = mine.filter((l) => l.kind === 'in')
  const withdraws = mine.filter((l) => l.kind === 'withdraw')
  const others = mine.filter((l) => l.kind === 'out' || l.kind === 'other')
  const slips = income.filter((x) => !x.deleted && x.method === 'transfer' && x.date > addDays(sunday, -10) && x.date <= addDays(sunday, 3))
  const used = new Set<string>()
  const matchedIn: Reconcile['matchedIn'] = []
  const unmatchedIn: PassbookLine[] = []
  for (const l of transfersIn) {
    if (l.link?.kind === 'income' && l.link.id) { const inc = income.find((x) => x.id === l.link?.id); if (inc) { used.add(inc.id); matchedIn.push({ line: l, income: inc }); continue } }
    const hit = slips.find((x) => !used.has(x.id) && x.amount === l.amount && Math.abs((Date.parse(x.date) - Date.parse(l.date)) / 864e5) <= 3)
    if (hit) { used.add(hit.id); matchedIn.push({ line: l, income: hit }) } else unmatchedIn.push(l)
  }
  const upto = all.filter((l) => lineWeek(l) <= sunday && l.balance !== undefined).sort((a, b) => a.date.localeCompare(b.date))
  return {
    deposits, transfersIn, withdraws, others,
    depositSum: deposits.reduce((s, l) => s + l.amount, 0), withdrawSum: withdraws.reduce((s, l) => s + l.amount, 0),
    matchedIn, unmatchedIn, unmatchedSlips: slips.filter((x) => !used.has(x.id) && x.date <= sunday && x.date > addDays(sunday, -7)),
    closing: upto.length ? upto[upto.length - 1].balance : undefined,
  }
}
