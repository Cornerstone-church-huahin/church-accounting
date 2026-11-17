import { useMemo } from 'react'
import { useFundDeposits, useExpenses, useIncome, useIncomeTypes, useExpenseCats, useLoans, usePassbook, useRounds } from './data'
import { isFundZone } from './funds'
import { sheetSunday } from './money'
import { withdrawnInWeek } from './fundPending'
import { ownLoanLines } from './weekLoans'
import { computeLedger, rangeOf } from './weekLedger'
import { useFuelExpenses } from './useFuelExpenses'
import type { FundDeposit, ExpenseCat, ExpenseEntry, IncomeEntry, IncomeType, Loan, PassbookLine, Round } from './types'

export interface WithdrawItem { desc: string; person: string; kind: 'bill' | 'advance' | 'manual' | 'loan'; amount: number; /** ค่าน้ำมันรถส่วนตัวที่ระบบคำนวณ */ fuel?: boolean; /** รหัสรายการรายจ่าย (ใช้กด จ่ายแล้ว/ยกเลิก) · ให้ยืม = ไม่มี */ id?: string; /** จ่ายแล้ว (ติ๊กถูก) */ done?: boolean; /** วันที่จ่าย */ paidDate?: string }
export interface WithdrawFund { name: string; amount: number }
/** วันที่ของรายการในใบ: บันทึกมือ = วันที่จ่าย · บิล/สำรองจ่าย = วันที่จ่ายจริง · ค่าน้ำมันอัตโนมัติ = วันที่เดินทาง เสมอ (ไม่ย้ายตามวันที่จ่ายคืน) */
const effDate = (x: ExpenseEntry) => (x.channel === 'manual' || x.derived === 'fuel' ? x.date : (x.paidDate ?? x.date))

/**
 * ต้องเบิกประจำสัปดาห์ (ชุดเดียวกับช่อง "หมายเหตุ · ต้องเบิก" ในใบเบิก-จ่าย): เงินหมุนเวียน = บิลที่วางไว้/สำรองจ่ายที่ยังรอจ่าย + รายการที่ระบุผู้รับ + เงินที่ให้กองทุนยืม ·
 * เงินกองทุน = เงินกองทุนที่รับผ่านตู้/โอนในสัปดาห์นั้น (เก็บไว้เตรียมนำฝาก)
 */
export interface WithdrawInput { expenses: ExpenseEntry[]; income: IncomeEntry[]; rounds: Round[]; passbook: PassbookLine[]; types: IncomeType[]; cats: ExpenseCat[]; loans: Loan[]; /** รายการ “ถอนแล้ว” ของเงินที่บันทึกตรงในหน้ากองทุน (ตามวันที่ถอน) */ fundWd?: FundDeposit[] }
/** ชุดคำนวณเดียวของ "ต้องเบิก" — ใช้ทั้งช่องหมายเหตุ·ต้องเบิกในใบเบิก-จ่าย แฟ้มประจำสัปดาห์ และหน้า เตรียมเบิก ตัวเลขจึงตรงกันเสมอ */
export function computeWeekWithdraw(a: WithdrawInput, year: number, sunday: string) {
  const range = rangeOf('week', year, { sunday })
  const nm = (id?: string) => (id === 'own' ? 'เงินหมุนเวียน' : a.types.find((t) => t.id === id)?.name ?? 'กองทุน')
  const week = a.expenses.filter((x) => !x.deleted && !x.fundId && sheetSunday(effDate(x)) === sunday)
  const item = (x: ExpenseEntry, done: boolean): WithdrawItem => ({ id: x.id, desc: x.desc, person: x.biller || x.who || '', kind: x.channel as WithdrawItem['kind'], amount: x.amount, ...(x.derived === 'fuel' ? { fuel: true } : {}), ...(done ? { done: true, paidDate: x.channel === 'manual' ? x.reimbursed : x.paidDate } : {}) })
  const isManualDue = (x: ExpenseEntry) => x.channel === 'manual' && !!x.biller
  const circ: WithdrawItem[] = [
    ...week.filter((x) => (x.status === 'open' || isManualDue(x)) && !(isManualDue(x) && x.reimbursed)).map((x) => item(x, false)),
    ...ownLoanLines(a.loans, nm, range.from, range.to),
  ]
  /** จ่ายแล้วของสัปดาห์นี้: บิล/สำรองจ่ายที่จ่ายในสัปดาห์นี้ + รายการบันทึกมือที่จ่ายคืนผู้วางบิลแล้ว (แสดงติ๊กถูก ไม่นับในยอดต้องเบิก) */
  const paid: WithdrawItem[] = week.filter((x) => (x.channel !== 'manual' && x.status === 'paid') || (isManualDue(x) && !!x.reimbursed)).map((x) => item(x, true))
  const wf = computeLedger({ range, income: a.income.filter((x) => !isFundZone(x)), rounds: a.rounds, vouchers: [], lines: [], funds: [], entries: [], types: a.types, cats: a.cats, expenses: [], passbook: a.passbook, withFunds: true }).fundRows
  const fund: WithdrawFund[] = [
    ...wf.map((r) => ({ name: r.label, amount: r.cash.amt + r.transfer.amt })).filter((f) => f.amount > 0),
    ...withdrawnInWeek(a.fundWd ?? [], sunday, (id) => a.types.find((t) => t.id === id)?.name ?? 'กองทุน'),
  ]
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)
  return { circ, paid, fund, totalC: sum(circ), totalPaid: sum(paid), totalF: sum(fund), total: sum(circ) + sum(fund) }
}

export function useWeekWithdraw(year: number, sunday: string) {
  const exp = useExpenses(year), fuel = useFuelExpenses(year), income = useIncome(year), rounds = useRounds(year), passbook = usePassbook(year)
  const types = useIncomeTypes(), cats = useExpenseCats(), loans = useLoans(), fwd = useFundDeposits()
  return useMemo(() => computeWeekWithdraw({ expenses: [...exp.items, ...fuel], income: income.items, rounds: rounds.items, passbook: passbook.items, types: types.list, cats: cats.list, loans: loans.items, fundWd: fwd.items }, year, sunday), [fwd.items, exp.items, fuel, income.items, rounds.items, passbook.items, types.list, cats.list, loans.items, year, sunday])
}
