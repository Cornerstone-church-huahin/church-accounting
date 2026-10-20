import { paidItems } from './ledger'
import { inRange } from './money'
import type { BudgetEntry, ExpenseEntry, Voucher } from './types'
import type { LRow } from './weekLedger'

/** แถวรายรับในใบ (เหมือนใบบันทึกการถวาย): ซอง/เงินสด · ครั้ง/โอน · รวม */
export interface NoticeLine { key: string; label: string; cashN: number; cash: number; trN: number; tr: number; amt: number }
/** แถวรายจ่ายจริงทีละรายการ */
export interface NoticeExpense { key: string; date: string; desc: string; amount: number }
export interface Notice { inc: NoticeLine[]; fund: NoticeLine[]; out: NoticeExpense[]; totalInc: number; totalFund: number; totalOut: number; /** รับ (ไม่รวมกองทุน) − จ่าย */ net: number }

/** แถวที่เป็น "เงินเข้า/ออกสมุดที่ไม่ทราบที่มา" เป็นเรื่องภายในการกระทบยอด ไม่นำขึ้นใบประกาศ */
const shown = (r: LRow) => !r.key.startsWith('__bank')
const line = (r: LRow): NoticeLine => ({ key: r.key, label: r.label, cashN: r.cash.n, cash: r.cash.amt, trN: r.transfer.n, tr: r.transfer.amt, amt: r.cash.amt + r.transfer.amt })

/**
 * รายจ่ายจริงของช่วงวันที่ ทีละรายการ (ไม่รวมเป็นหมวด): ใบเบิกที่จ่ายแล้ว · รายจ่ายที่บันทึก (รวมวางบิล/สำรองจ่ายที่ยังไม่จ่าย ซึ่งนับเป็นรายจ่ายแล้ว) · บันทึกตรงในงบ
 * ไม่รวมรายจ่ายที่จ่ายจากกองทุน (อยู่ในใบกองทุน)
 */
export function expenseLines(range: { from: string; to: string }, a: { vouchers: Voucher[]; expenses: ExpenseEntry[]; entries: BudgetEntry[] }): NoticeExpense[] {
  const out: NoticeExpense[] = []
  for (const { v, item } of paidItems(a.vouchers, { kind: 'week', ...range })) out.push({ key: `v:${v.id}:${out.length}`, date: v.paid?.date ?? v.date, desc: item.desc || v.purpose || 'รายจ่าย', amount: item.amount })
  for (const x of a.expenses) if (!x.deleted && !x.fundId && inRange(x.date, range.from, range.to)) out.push({ key: `e:${x.id}`, date: x.date, desc: x.desc, amount: x.amount })
  for (const e of a.entries) if (!e.deleted && e.kind === 'out' && inRange(e.date, range.from, range.to)) out.push({ key: `b:${e.id}`, date: e.date, desc: e.note || 'รายจ่ายตามงบ', amount: e.amount })
  return out.filter((x) => x.amount > 0).sort((x, y) => x.date.localeCompare(y.date) || x.desc.localeCompare(y.desc, 'th'))
}

/**
 * ใบสรุปรับ-จ่ายสำหรับติดประกาศ: รายรับตามรายการ (แยกเงินสด/โอน) · เงินถวายกองทุนแยกต่างหาก · รายจ่ายทุกรายการ
 * ไม่มีรายละเอียดภายใน (ผู้วางบิล สำรองจ่าย ยอดไม่ทราบที่มา ฯลฯ)
 */
export function weekNotice(L: { incRows: LRow[]; fundRows: LRow[] }, outLines: NoticeExpense[]): Notice {
  const inc = L.incRows.filter(shown).map(line).filter((x) => x.amt > 0)
  const fund = L.fundRows.map(line).filter((x) => x.amt > 0)
  const sum = (xs: { amt: number }[]) => xs.reduce((s, x) => s + x.amt, 0)
  const totalInc = sum(inc), totalOut = outLines.reduce((s, x) => s + x.amount, 0)
  return { inc, fund, out: outLines, totalInc, totalFund: sum(fund), totalOut, net: totalInc - totalOut }
}
