import { addDays, sheetSunday } from './money'
import type { IncomeEntry, PassbookLine, PbKind } from './types'

export interface RawPbRow { date?: string; desc?: string; deposit?: number; withdraw?: number; balance?: number }

const IN_WORDS = /โอน|transfer|promptpay|พร้อมเพย์|k\s?plus|mobile|app|อิเล็ก|ibanking|atm/i

/** จัดชนิดบรรทัด: ถอน/ฝาก + คำอธิบายว่าเป็นการโอนหรือเงินสด (ฝากเงินสด/ถอนเงินสดเป็นค่าเริ่มต้น) */
export function classify(r: RawPbRow): PbKind {
  const d = r.desc ?? ''
  if (/ดอกเบี้ย|ภาษี|ค่าธรรมเนียม|fee|interest/i.test(d)) return 'other'
  if ((r.deposit ?? 0) > 0) return IN_WORDS.test(d) && !/เงินสด|cash|cdm/i.test(d) ? 'in' : 'deposit'
  return IN_WORDS.test(d) && !/เงินสด|cash/i.test(d) ? 'out' : 'withdraw'
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
