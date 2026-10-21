import { fundAccounts, type FundAccount } from './fundAccounts'
import { paidItems } from './ledger'
import { isFundType } from './funds'
import { addDays, daysInMonth, fmtBaht, inRange, sheetSunday } from './money'
import { lineDate, typeFromNote, unknownBankIn, unknownBankOut } from './passbook'
import { computeLedger } from './weekLedger'
import type { BudgetEntry, BudgetLine, ExpenseCat, ExpenseEntry, IncomeEntry, IncomeType, Loan, Opening, PassbookLine, Round, Voucher } from './types'
import { UNSORTED } from './types'

/** ข้อมูลต้นทางของรายงาน (ชุดเดียวกับที่ใช้คำนวณยอดเงินหน้าแรก) */
export interface ReportInput {
  income: IncomeEntry[]; rounds: Round[]; vouchers: Voucher[]; lines: BudgetLine[]; funds: BudgetLine[]; entries: BudgetEntry[]
  types: IncomeType[]; cats: ExpenseCat[]; expenses: ExpenseEntry[]; passbook: PassbookLine[]; opening?: Opening; loans?: Loan[]
}
export interface Range { from: string; to: string }
export const UNCAT_KEY = '__uncat'
export const ADVANCE_KEY = '__advance'

export interface IncLine { key: string; typeId: string; date: string; label: string; amount: number; method: 'cash' | 'transfer' }
export interface OutLine {
  key: string; date: string; desc: string; amount: number; by?: string; catKey: string; catLabel: string
  /** paid = จ่ายแล้ว · bill = วางบิลค้างจ่าย · advance = สำรองจ่ายรอคืนเงิน */
  status: 'paid' | 'bill' | 'advance'; evidence: boolean | null
}
export interface Bar { key: string; label: string; amount: number }
export interface FollowUp { key: string; text: string }

export interface PeriodReport {
  range: Range
  /** ไม่มีรายการใดในช่วงนี้เลย (ไม่ใช่ 0 ที่ยืนยันแล้ว) */
  empty: boolean
  inTotal: number; fundTotal: number; outTotal: number; net: number
  incBars: Bar[]; fundBars: Bar[]; incLines: IncLine[]
  /** ค่าใช้จ่ายแยกหมวด (ไม่รวมเงินสำรองจ่ายรอคืน) */
  catBars: Bar[]; advance: number; expenseTotal: number
  outLines: OutLine[]
  follow: FollowUp[]
}

const isoInRange = (d: string, r: Range) => inRange(d, r.from, r.to)
const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)
const baht = (x: number) => `${fmtBaht(x, { dec: x % 100 !== 0 })} บาท`

/** จัดกลุ่มหมวดรายจ่ายเป็นหมวดหลัก (ตามหน้าใบสรุป) */
function catResolver(cats: ExpenseCat[]) {
  const groups = cats.filter((c) => c.kind === 'group' && c.active)
  return (catId?: string): { key: string; label: string } => {
    if (groups.length === 0) return { key: UNCAT_KEY, label: 'ยังไม่ระบุหมวด' }
    const g = catId ? cats.find((c) => c.id === catId)?.group : undefined
    const grp = g ? groups.find((x) => x.id === g) : undefined
    return grp ? { key: grp.id, label: grp.name } : { key: UNCAT_KEY, label: 'ยังไม่ระบุหมวด' }
  }
}

/** รายจ่ายจริงทีละรายการของช่วง (ชุดเดียวกับใบประกาศ) พร้อมหมวด/สถานะ/หลักฐาน */
export function outLinesOf(r: Range, a: ReportInput): OutLine[] {
  const res = catResolver(a.cats)
  const out: OutLine[] = []
  for (const { v, item } of paidItems(a.vouchers, { kind: 'week', ...r })) {
    const c = res(item.catId)
    out.push({ key: `v:${v.id}:${out.length}`, date: v.paid?.date ?? v.date, desc: item.desc || v.purpose || 'รายจ่าย', amount: item.amount, ...(v.requester?.name ? { by: v.requester.name } : {}), catKey: c.key, catLabel: c.label, status: 'paid', evidence: v.attachments.some((x) => x.kind === 'receipt') })
  }
  for (const x of a.expenses) {
    if (x.deleted || x.fundId || !isoInRange(x.date, r)) continue
    const c = res(x.catId), by = (x.biller || (x.channel === 'advance' ? x.who : '') || '').trim()
    out.push({ key: `e:${x.id}`, date: x.date, desc: x.desc, amount: x.amount, ...(by ? { by } : {}), catKey: c.key, catLabel: c.label, status: x.status === 'paid' ? 'paid' : x.channel === 'advance' ? 'advance' : 'bill', evidence: x.file ? true : null })
  }
  for (const e of a.entries) {
    if (e.deleted || e.kind !== 'out' || !isoInRange(e.date, r)) continue
    const c = res(undefined)
    out.push({ key: `b:${e.id}`, date: e.date, desc: e.note || 'รายจ่ายตามงบ', amount: e.amount, catKey: c.key, catLabel: c.label, status: 'paid', evidence: null })
  }
  return out.filter((x) => x.amount > 0).sort((x, y) => x.date.localeCompare(y.date) || x.desc.localeCompare(y.desc, 'th'))
}

/** รายรับทีละรายการของช่วง (ใบนับเงิน · รายการบันทึก · เงินเข้าสมุดที่ระบุประเภทไว้) */
function incLinesOf(r: Range, a: ReportInput): IncLine[] {
  const out: IncLine[] = []
  const name = (id: string) => a.types.find((t) => t.id === id)?.name ?? '(รายการที่ถูกลบ)'
  for (const rd of a.rounds) {
    if (rd.deleted || !isoInRange(rd.date, r)) continue
    for (const [id, v] of Object.entries(rd.lines)) if (v > 0) out.push({ key: `rd:${rd.id}:${id}`, typeId: id, date: rd.date, label: `${name(id)} · นับเงินถวาย`, amount: v, method: 'cash' })
  }
  for (const x of a.income) if (!x.deleted && !x.roundId && isoInRange(x.date, r)) out.push({ key: `in:${x.id}`, typeId: x.unknown ? UNSORTED : x.typeId, date: x.date, label: `${x.unknown ? 'ไม่ทราบที่มา' : name(x.typeId)} · ${x.method === 'transfer' ? 'โอน' : 'เงินสด'}`, amount: x.amount, method: x.method === 'transfer' ? 'transfer' : 'cash' })
  for (const l of unknownBankIn(a.passbook, a.income)) {
    const id = typeFromNote(l.desc, a.types)
    if (id && isoInRange(lineDate(l), r)) out.push({ key: `pb:${l.id}`, typeId: id, date: lineDate(l), label: `${name(id)} · โอนเข้าสมุดบัญชี`, amount: l.amount, method: 'transfer' })
  }
  return out.sort((x, y) => x.date.localeCompare(y.date))
}

/** รายงานของช่วงวันที่หนึ่ง — ใช้ร่วมกันทั้งรายสัปดาห์/เดือน/ปี (ยอดตรงกับใบสรุปเดิม) */
export function periodReport(r: Range, a: ReportInput): PeriodReport {
  const L = computeLedger({ range: r, income: a.income, rounds: a.rounds, vouchers: a.vouchers, lines: a.lines, funds: a.funds, entries: a.entries, types: a.types, cats: a.cats, expenses: a.expenses, passbook: a.passbook, withFunds: false })
  const shown = (k: string) => !k.startsWith('__bank')
  const incBars = L.incRows.filter((x) => shown(x.key)).map((x) => ({ key: x.key, label: x.label, amount: x.cash.amt + x.transfer.amt })).filter((x) => x.amount > 0).sort((p, q) => q.amount - p.amount)
  const fundBars = L.fundRows.map((x) => ({ key: x.key, label: x.label, amount: x.cash.amt + x.transfer.amt })).filter((x) => x.amount > 0).sort((p, q) => q.amount - p.amount)
  const fundIds = new Set(a.types.filter((t) => isFundType(t)).map((t) => t.id))
  const incLines = incLinesOf(r, a).filter((x) => !fundIds.has(x.typeId))
  const outLines = outLinesOf(r, a)
  const adv = outLines.filter((x) => x.status === 'advance')
  const byCat = new Map<string, Bar>()
  for (const x of outLines.filter((y) => y.status !== 'advance')) { const b = byCat.get(x.catKey) ?? { key: x.catKey, label: x.catLabel, amount: 0 }; b.amount += x.amount; byCat.set(x.catKey, b) }
  const catBars = [...byCat.values()].sort((p, q) => q.amount - p.amount)
  const inTotal = sum(incBars), fundTotal = sum(fundBars), outTotal = sum(outLines)
  const follow: FollowUp[] = []
  const unc = outLines.filter((x) => x.catKey === UNCAT_KEY)
  if (unc.length) follow.push({ key: 'uncat', text: `รายจ่ายที่ยังไม่ระบุหมวด ${unc.length} รายการ รวม ${baht(sum(unc))}` })
  const bills = outLines.filter((x) => x.status === 'bill')
  if (bills.length) follow.push({ key: 'bill', text: `วางบิลที่ยังค้างจ่าย ${bills.length} รายการ รวม ${baht(sum(bills))}` })
  if (adv.length) follow.push({ key: 'adv', text: `เงินสำรองจ่ายที่รอคืนเงิน ${adv.length} รายการ รวม ${baht(sum(adv))}` })
  const ubi = unknownBankIn(a.passbook, a.income).filter((l) => !typeFromNote(l.desc, a.types) && isoInRange(lineDate(l), r))
  if (ubi.length) follow.push({ key: 'ubi', text: `เงินเข้าสมุดบัญชีที่ยังไม่ทราบที่มา ${ubi.length} รายการ รวม ${baht(sum(ubi))} (ไม่รวมในยอดรายรับ)` })
  const ubo = unknownBankOut(a.passbook, a.expenses).filter((l) => isoInRange(lineDate(l), r))
  if (ubo.length) follow.push({ key: 'ubo', text: `เงินออกสมุดบัญชีที่ยังไม่ทราบรายจ่าย ${ubo.length} รายการ รวม ${baht(sum(ubo))} (ไม่รวมในยอดจ่ายออก)` })
  const empty = incLines.length === 0 && outLines.length === 0 && fundBars.length === 0
  return { range: r, empty, inTotal, fundTotal, outTotal, net: inTotal - outTotal, incBars, fundBars, incLines, catBars, advance: sum(adv), expenseTotal: outTotal - sum(adv), outLines, follow }
}

export const monthRange = (year: number, month: number): Range => { const p = (n: number) => String(n).padStart(2, '0'); return { from: `${year}-${p(month)}-01`, to: `${year}-${p(month)}-${p(daysInMonth(year, month))}` } }

export interface WeekSlice { sunday: string; full: Range; clipped: Range; partial: boolean; report: PeriodReport }
/** สัปดาห์ (จันทร์–อาทิตย์) ที่อยู่ในเดือน · ตัดเฉพาะวันที่อยู่ในเดือน (partial = สัปดาห์คร่อมเดือน) */
export function monthWeeks(year: number, month: number, a: ReportInput): WeekSlice[] {
  const mr = monthRange(year, month), out: WeekSlice[] = []
  for (let s = sheetSunday(mr.from); s <= sheetSunday(mr.to); s = addDays(s, 7)) {
    const full = { from: addDays(s, -6), to: s }
    const clipped = { from: full.from < mr.from ? mr.from : full.from, to: full.to > mr.to ? mr.to : full.to }
    out.push({ sunday: s, full, clipped, partial: clipped.from !== full.from || clipped.to !== full.to, report: periodReport(clipped, a) })
  }
  return out
}

export interface MonthPoint { month: number; report: PeriodReport; /** ข้อมูลครบทุกสัปดาห์หรือไม่ (นับจากสัปดาห์ที่มีรายการ) */ partial: boolean; weeksWithData: number; weeks: number }
export function yearMonths(year: number, a: ReportInput): MonthPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const ws = monthWeeks(year, i + 1, a), withData = ws.filter((w) => !w.report.empty).length
    return { month: i + 1, report: periodReport(monthRange(year, i + 1), a), partial: withData > 0 && withData < ws.length, weeksWithData: withData, weeks: ws.length }
  })
}

const isLoanMove = (k: string) => /^l[nrbq]:/.test(k)
export interface FundRow { id: string; name: string; /** null = คำนวณไม่ได้จากข้อมูลที่มี */ start: number | null; moneyIn: number; moneyOut: number; transfer: number; end: number | null }
/** ตารางกองทุนของช่วง: ยอดต้น/รับ/จ่าย/โอน(เงินยืม)/ยอดปลาย — คำนวณจากรายการเคลื่อนไหว ไม่ใช้ยอดปัจจุบันแทน */
export function fundTable(funds: FundAccount[], r: Range, opening?: Opening): FundRow[] {
  const known = !!opening?.date && r.from > opening.date
  return funds.map((f) => {
    const before = f.moves.filter((m) => m.date < r.from).reduce((s, m) => s + m.amount, 0)
    const inR = f.moves.filter((m) => isoInRange(m.date, r))
    const moneyIn = inR.filter((m) => !isLoanMove(m.key) && m.amount > 0).reduce((s, m) => s + m.amount, 0)
    const moneyOut = inR.filter((m) => !isLoanMove(m.key) && m.amount < 0).reduce((s, m) => s - m.amount, 0)
    const transfer = inR.filter((m) => isLoanMove(m.key)).reduce((s, m) => s + m.amount, 0)
    const start = known ? f.opening + before : null
    return { id: f.id, name: f.name, start, moneyIn, moneyOut, transfer, end: start === null ? null : start + moneyIn - moneyOut + transfer }
  })
}
/** ยอดกองทุน ณ วันอ้างอิง (null = ก่อนวันตั้งต้น/ไม่มียอดตั้งต้น คำนวณไม่ได้) */
export function fundAsOf(funds: FundAccount[], asOf: string, opening?: Opening): { id: string; name: string; balance: number | null }[] {
  const ok = !!opening?.date && asOf >= opening.date
  return funds.map((f) => ({ id: f.id, name: f.name, balance: ok ? f.opening + f.moves.filter((m) => m.date <= asOf).reduce((s, m) => s + m.amount, 0) : null }))
}
export const fundsOf = (a: ReportInput) => fundAccounts({ types: a.types.filter((t) => t.active), opening: a.opening, income: a.income, rounds: a.rounds, expenses: a.expenses, passbook: a.passbook, loans: a.loans })
