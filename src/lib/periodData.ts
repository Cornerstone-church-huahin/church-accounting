import { circulatingOnly, computeBalances } from './balances'
import { isCompensation } from './maskPay'
import { be, daysInMonth, monthName, todayISO } from './money'
import { summarizeLoans } from './loans'
import { fundsOf, fundTable, monthRange, monthWeeks, periodReport, yearMonths, type FundRow, type PeriodReport, type Range, type ReportInput } from './report'
import type { Loan } from './types'

export type PeriodKind = 'week' | 'month' | 'year'
export interface PeriodBarPair { label: string; inn: number; out: number }
export interface PeriodData {
  kind: 'month' | 'year'
  label: string
  rangeText: string
  range: Range
  /** วันอ้างอิงยอดคงเหลือ: สิ้นช่วง แต่ไม่เกินวันนี้ */
  ref: string
  r: PeriodReport
  /** ข้อมูลที่บันทึกแล้วกี่สัปดาห์/เดือน จากทั้งหมดกี่ช่วง */
  complete: { have: number; total: number; unit: 'สัปดาห์' | 'เดือน' }
  incRows: { label: string; amount: number; pct: number }[]
  catRows: { label: string; amount: number; pct: number }[]
  /** ค่าตอบแทน/สวัสดิการ (เงินเดือน ฯลฯ) รวมรายบุคคล — ฉบับที่ประชุมเท่านั้นที่แสดงรายคน */
  comp: { name: string; amount: number }[]
  compTotal: number
  funds: FundRow[]
  pairs: PeriodBarPair[]
  /** เงินหมุนเวียนคงเหลือ ณ สิ้นแต่ละเดือนของปี (ถึงเดือนปัจจุบัน) */
  trend: { label: string; balance: number }[]
  tiles: { own: number; fund: number; total: number; inDebt: number; outDebt: number }
}

const pct = (x: number, of: number) => (of > 0 ? Math.round((x / of) * 1000) / 10 : 0)
const MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** ข้อมูลใบสรุป/กราฟรายเดือน-รายปี — ชุดเดียวกับหน้ารายเดือน/ภาพรวมปี (ยอดตรงกันทุกช่วง) */
export function buildPeriod(kind: 'month' | 'year', year: number, month: number, a: ReportInput, loans: Loan[], today = todayISO()): PeriodData {
  const range = kind === 'month' ? monthRange(year, month) : { from: `${year}-01-01`, to: `${year}-12-31` }
  const r = periodReport(range, a)
  const ref = range.to < today ? range.to : range.from > today ? range.from : today
  const lines = r.outLines.filter((x) => x.status !== 'advance')
  const comp = new Map<string, number>()
  for (const x of lines) if (isCompensation(x)) { const k = (x.by || x.desc).trim(); comp.set(k, (comp.get(k) ?? 0) + x.amount) }
  const funds = fundTable(fundsOf(a), range, a.opening)
  const curM = year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) : year < Number(today.slice(0, 4)) ? 12 : 0
  const trend = Array.from({ length: curM }, (_, i) => {
    const end = `${year}-${String(i + 1).padStart(2, '0')}-${String(daysInMonth(year, i + 1)).padStart(2, '0')}`
    const t = end < today ? end : today
    return { label: MS[i], balance: circulatingOnly(computeBalances({ ...a, opening: a.opening, today: t, loans }), loans) }
  })
  let pairs: PeriodBarPair[], complete: PeriodData['complete']
  if (kind === 'month') {
    const ws = monthWeeks(year, month, a)
    pairs = ws.map((w, i) => ({ label: `สัปดาห์ ${i + 1}`, inn: w.report.inTotal, out: w.report.outTotal }))
    complete = { have: ws.filter((w) => !w.report.empty).length, total: ws.length, unit: 'สัปดาห์' }
  } else {
    const ms = yearMonths(year, a)
    pairs = ms.map((m) => ({ label: MS[m.month - 1], inn: m.report.inTotal, out: m.report.outTotal }))
    complete = { have: ms.filter((m) => !m.report.empty).length, total: ms.length, unit: 'เดือน' }
  }
  const b = computeBalances({ ...a, opening: a.opening, today: ref, loans })
  const ls = summarizeLoans(loans, ref)
  return {
    kind, range, ref, r, complete, pairs, trend, funds,
    label: kind === 'month' ? `${monthName(month)} ${be(year)}` : `ปี ${be(year)}`,
    rangeText: `${range.from} – ${range.to}`,
    incRows: r.incBars.map((x) => ({ label: x.label, amount: x.amount, pct: pct(x.amount, r.inTotal) })),
    catRows: [...r.catBars, ...(r.advance > 0 ? [{ key: 'adv', label: 'เงินสำรองจ่ายรอคืน', amount: r.advance }] : [])].map((x) => ({ label: x.label, amount: x.amount, pct: pct(x.amount, r.inTotal) })),
    comp: [...comp.entries()].map(([name, amount]) => ({ name, amount })).sort((p, q) => q.amount - p.amount),
    compTotal: [...comp.values()].reduce((s, v) => s + v, 0),
    tiles: { own: circulatingOnly(b, loans), fund: b.fundTotal, total: b.total, inDebt: ls.fromFunds, outDebt: ls.external },
  }
}
