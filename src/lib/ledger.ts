import { addDays, daysInMonth, inRange, monthOf, sheetSunday, weekStart, yearOf } from './money'
import type { AccessRole } from './access'
import type { BudgetAdj, BudgetEntry, BudgetLine, IncomeEntry, Round, Voucher, VoucherItem } from './types'

// ---------- รอบนับเงินวันอาทิตย์ ----------
/** มูลค่าธนบัตร/เหรียญที่ให้กรอกจำนวน (บาท) */
export const DENOMS = [1000, 500, 100, 50, 20, 10, 5, 2, 1]
export const roundTotal = (r: Pick<Round, 'lines'>) => Object.values(r.lines).reduce((a, b) => a + b, 0)
export const denomTotal = (d: Record<string, number>) => Object.entries(d).reduce((a, [k, n]) => a + Number(k) * 100 * (n || 0), 0)
export const roundId = (date: string) => `rd-${date}`
export const envelopeTotal = (r: Pick<Round, 'envelopes'>) => Object.values(r.envelopes ?? {}).reduce((a, b) => a + b, 0)

/** เงินโอนที่นับในใบถวายของวันอาทิตย์นั้น (โอนวันจันทร์–อาทิตย์) */
export function weekTransfers(income: IncomeEntry[], sunday: string): { entries: IncomeEntry[]; total: number } {
  const entries = income.filter((x) => !x.deleted && x.method === 'transfer' && sheetSunday(x.date) === sunday)
  return { entries, total: entries.reduce((s, x) => s + x.amount, 0) }
}

/** เมื่อยืนยันยอดนับ: สร้างรายรับเงินสดต่อประเภท (id คงที่ จึงแก้ซ้ำแล้วไม่ซ้ำซ้อน) */
export function entriesFromRound(r: Round): IncomeEntry[] {
  return Object.entries(r.lines).map(([typeId, amount]) => ({
    id: `${r.id}:${typeId}`, date: r.date, typeId, amount, method: 'cash' as const, roundId: r.id, updated: 0, deleted: amount <= 0,
  }))
}

// ---------- รายการในใบเบิก ----------
/** ใบเก่า (รายการเดียว) แปลงเป็น 1 รายการ เพื่อให้ทุกที่ใช้โค้ดชุดเดียว */
export const voucherItems = (v: Voucher): VoucherItem[] => (v.items?.length ? v.items : [{ desc: v.purpose, amount: v.amount, lineId: v.lineId, method: 'cash' }])
export const itemsTotal = (items: Pick<VoucherItem, 'amount'>[]) => items.reduce((s, i) => s + i.amount, 0)
/** ใบเบิกสรุปเป็นข้อความสั้น ๆ สำหรับแสดงในรายการ */
export const voucherTitle = (v: Voucher) => {
  const it = voucherItems(v)
  return it.length > 1 ? `${it[0].desc} และอีก ${it.length - 1} รายการ` : it[0]?.desc ?? v.purpose
}

// ---------- งบประมาณ ----------
export interface BudgetRow {
  line: BudgetLine
  base: number
  adjust: number
  current: number
  /** จ่ายจริงแล้ว */
  spent: number
  /** ยื่นแล้ว/อนุมัติแล้วแต่ยังไม่จ่าย */
  committed: number
  /** รายรับที่ได้รับของงบนี้ (ตามประเภทรายรับที่ผูกไว้) */
  income: number
  /** เงินคงเหลือจริง = ได้รับ − จ่ายแล้ว (ไม่เกี่ยวกับงบที่ตั้ง) */
  balance: number
  /** ยังใช้ได้อีกเท่าไร: ถ้าตั้งงบแล้ว = งบ − จ่าย − ค้างเบิก · ถ้ายังไม่ตั้งงบ = เงินที่มี − จ่าย − ค้างเบิก */
  remaining: number
}
export function budgetRows(lines: BudgetLine[], adjs: BudgetAdj[], vouchers: Voucher[], income: IncomeEntry[] = [], entries: BudgetEntry[] = []): BudgetRow[] {
  return [...lines].sort((a, b) => a.order - b.order).map((line) => {
    const adjust = adjs.filter((a) => a.lineId === line.id).reduce((s, a) => s + a.delta, 0)
    const mine = vouchers.filter((v) => !v.deleted).map((v) => ({ v, sum: itemsTotal(voucherItems(v).filter((i) => i.lineId === line.id)) })).filter((x) => x.sum > 0)
    const spent = mine.filter((x) => x.v.status === 'paid').reduce((s, x) => s + x.sum, 0)
    const committed = mine.filter((x) => x.v.status === 'submitted' || x.v.status === 'approved').reduce((s, x) => s + x.sum, 0)
    const current = line.base + adjust
    const types = new Set(line.incomeTypeIds ?? [])
    const mineE = entries.filter((e) => !e.deleted && e.lineId === line.id)
    const inc = income.filter((x) => !x.deleted && types.has(x.typeId)).reduce((s, x) => s + x.amount, 0) + mineE.filter((e) => e.kind === 'in').reduce((s, e) => s + e.amount, 0)
    const direct = mineE.filter((e) => e.kind === 'out').reduce((s, e) => s + e.amount, 0)
    return { line, base: line.base, adjust, current, spent: spent + direct, committed, income: inc, balance: inc - spent - direct, remaining: (current > 0 ? current : inc) - spent - direct - committed }
  })
}

// ---------- ใบเบิกจ่าย ----------
export type Stage = 'review' | 'pay' | 'receipt' | 'check' | 'done' | 'rejected' | 'void'
export const STAGE_LABEL: Record<Stage, string> = {
  review: 'รออนุมัติ', pay: 'อนุมัติแล้ว รอจ่ายเงิน', receipt: 'จ่ายแล้ว รอใบเสร็จ', check: 'รอผู้ตรวจสอบรับรองใบเสร็จ', done: 'เรียบร้อย', rejected: 'ไม่อนุมัติ', void: 'ยกเลิก',
}
export const hasReceipt = (v: Voucher) => v.attachments.some((a) => a.kind === 'receipt')
export function stageOf(v: Voucher): Stage {
  if (v.status === 'rejected') return 'rejected'
  if (v.status === 'void') return 'void'
  if (v.status === 'submitted') return 'review'
  if (v.status === 'approved') return 'pay'
  if (!hasReceipt(v)) return 'receipt'
  return v.receiptOk ? 'done' : 'check'
}

/** ต้องอนุมัติกี่ขั้น: ไม่เกินเกณฑ์ = 1 · เกินเกณฑ์ = 2 (ต้องมีแอดมินอย่างน้อย 1 คน และเป็นคนละคน) */
export const stepsNeeded = (amount: number, twoStepOver: number) => (amount > twoStepOver ? 2 : 1)

export interface Actor { id: string; name: string; role: AccessRole }
/** อนุมัติได้หรือไม่ · คืนเหตุผลที่ทำไม่ได้ ('' = ทำได้) */
export function approveBlock(v: Voucher, who: Actor, twoStepOver: number, solo = false): string {
  if (v.status !== 'submitted') return 'ใบเบิกนี้ไม่ได้อยู่ในขั้นรออนุมัติ'
  if (who.role !== 'admin' && who.role !== 'auditor') return 'เฉพาะแอดมินหรือผู้ตรวจสอบอนุมัติได้'
  if (!solo && v.requester.id === who.id) return 'ผู้ขอเบิกอนุมัติใบเบิกของตัวเองไม่ได้'
  if (!solo && v.approvals.some((a) => a.id === who.id)) return 'ท่านอนุมัติใบนี้ไปแล้ว ต้องเป็นอีกคนหนึ่ง'
  const need = stepsNeeded(v.amount, twoStepOver)
  if (need === 2 && v.approvals.length === 1 && v.approvals[0].role !== 'admin' && who.role !== 'admin') return 'ใบเบิกนี้เกินเกณฑ์: ต้องมีแอดมินอนุมัติอย่างน้อย 1 คน'
  return ''
}
export const isFullyApproved = (v: Voucher, twoStepOver: number) =>
  v.approvals.length >= stepsNeeded(v.amount, twoStepOver) && (stepsNeeded(v.amount, twoStepOver) === 1 || v.approvals.some((a) => a.role === 'admin'))

export interface Task { voucher: Voucher; text: string }
/** งานที่ "ท่าน" ต้องทำตามสิทธิ์ */
export function tasksFor(role: AccessRole, meId: string, vouchers: Voucher[], twoStepOver: number, solo = false): Task[] {
  const out: Task[] = []
  for (const v of vouchers) {
    const st = stageOf(v)
    if (st === 'review' && (role === 'admin' || role === 'auditor') && !approveBlock(v, { id: meId, name: '', role }, twoStepOver, solo)) out.push({ voucher: v, text: 'ตรวจและอนุมัติ' })
    if (st === 'pay' && (role === 'admin' || role === 'bookkeeper')) out.push({ voucher: v, text: 'จ่ายเงินและบันทึกการจ่าย' })
    if (st === 'receipt' && (role === 'admin' || role === 'bookkeeper')) out.push({ voucher: v, text: 'แนบรูปใบเสร็จ' })
    if (st === 'check' && (role === 'admin' || role === 'auditor')) out.push({ voucher: v, text: 'ตรวจใบเสร็จและรับรอง' })
  }
  return out
}

export interface WeekSummary {
  from: string
  to: string
  /** ใบเบิกที่ยื่นในสัปดาห์นี้ (ไม่รวมที่ยกเลิก) */
  filed: { count: number; total: number }
  /** สถานะปัจจุบันของใบที่ยื่นในสัปดาห์นี้ */
  byStage: Record<Stage, { count: number; total: number }>
  /** ค้างอยู่ทั้งหมด (ทุกสัปดาห์) ที่ยังต้องมีคนทำอะไรต่อ */
  open: { stage: Stage; count: number; total: number }[]
}
export function weekSummary(vouchers: Voucher[], anyDateInWeek: string): WeekSummary {
  const from = weekStart(anyDateInWeek)
  const to = addDays(from, 6)
  const live = vouchers.filter((v) => !v.deleted && v.status !== 'void')
  const mine = live.filter((v) => inRange(v.date, from, to))
  const blank = () => ({ count: 0, total: 0 })
  const stages: Stage[] = ['review', 'pay', 'receipt', 'check', 'done', 'rejected', 'void']
  const byStage = Object.fromEntries(stages.map((s) => [s, blank()])) as WeekSummary['byStage']
  for (const v of mine) { const b = byStage[stageOf(v)]; b.count++; b.total += v.amount }
  const open = (['review', 'pay', 'receipt', 'check'] as Stage[]).map((stage) => {
    const xs = live.filter((v) => stageOf(v) === stage)
    return { stage, count: xs.length, total: xs.reduce((s, v) => s + v.amount, 0) }
  })
  return { from, to, filed: { count: mine.length, total: mine.reduce((s, v) => s + v.amount, 0) }, byStage, open }
}

// ---------- รายงาน ----------
export type PeriodKind = 'week' | 'month' | 'year'
export interface Period { kind: PeriodKind; from: string; to: string }
export function periodOf(kind: PeriodKind, anchor: string): Period {
  if (kind === 'week') { const from = weekStart(anchor); return { kind, from, to: addDays(from, 6) } }
  if (kind === 'month') { const y = yearOf(anchor), m = monthOf(anchor); return { kind, from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${daysInMonth(y, m)}` } }
  const y = yearOf(anchor)
  return { kind, from: `${y}-01-01`, to: `${y}-12-31` }
}
export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  if (p.kind === 'week') return periodOf('week', addDays(p.from, 7 * dir))
  if (p.kind === 'month') { const y = yearOf(p.from), m = monthOf(p.from) + dir; return periodOf('month', `${y + Math.floor((m - 1) / 12)}-${String(((m - 1 + 12) % 12) + 1).padStart(2, '0')}-01`) }
  return periodOf('year', `${yearOf(p.from) + dir}-01-01`)
}

export const liveIncome = (xs: IncomeEntry[], p: Period) => xs.filter((x) => !x.deleted && inRange(x.date, p.from, p.to))
/** รายจ่ายนับเมื่อ "จ่ายแล้ว" ตามวันที่จ่าย */
export const paidIn = (vs: Voucher[], p: Period) => vs.filter((v) => !v.deleted && v.status === 'paid' && v.paid && inRange(v.paid.date, p.from, p.to))

/** รายจ่ายที่จ่ายแล้วในช่วงเวลา แยกเป็นรายการ (1 ใบเบิกมีหลายรายการ ลงคนละหมวดได้) */
export const paidItems = (vs: Voucher[], p: Period) => paidIn(vs, p).flatMap((v) => voucherItems(v).map((item) => ({ v, item })))

/** รายจ่ายที่บันทึกตรงในงบ (ไม่ผ่านใบเบิก) ในช่วงเวลา — นับเป็นรายจ่ายในรายงานด้วย */
export const directOut = (es: BudgetEntry[], p: Period) => es.filter((e) => !e.deleted && e.kind === 'out' && inRange(e.date, p.from, p.to))

export function sumBy<T>(xs: T[], key: (x: T) => string, amount: (x: T) => number): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + amount(x))
  return m
}

/** แบ่งช่วงเวลาเป็นกลุ่มย่อยสำหรับกราฟรายรับ-รายจ่าย: รายปี → 12 เดือน · รายเดือน → รายสัปดาห์ · รายสัปดาห์ → รายวัน */
export function buckets(p: Period): { label: string; from: string; to: string }[] {
  if (p.kind === 'year') {
    const y = yearOf(p.from)
    return Array.from({ length: 12 }, (_, i) => periodOf('month', `${y}-${String(i + 1).padStart(2, '0')}-01`)).map((m, i) => ({ label: String(i + 1), from: m.from, to: m.to }))
  }
  if (p.kind === 'month') {
    const out: { label: string; from: string; to: string }[] = []
    let s = weekStart(p.from)
    while (s <= p.to) {
      const e = addDays(s, 6)
      out.push({ label: s.slice(8) , from: s < p.from ? p.from : s, to: e > p.to ? p.to : e })
      s = addDays(s, 7)
    }
    return out
  }
  return Array.from({ length: 7 }, (_, i) => { const d = addDays(p.from, i); return { label: d.slice(8), from: d, to: d } })
}
