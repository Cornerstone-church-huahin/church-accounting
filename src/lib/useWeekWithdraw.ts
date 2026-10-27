import { useMemo } from 'react'
import { useExpenses, useIncome, useIncomeTypes, useExpenseCats, useLoans, usePassbook, useRounds } from './data'
import { isFundZone } from './funds'
import { sheetSunday } from './money'
import { ownLoanLines } from './weekLoans'
import { computeLedger, rangeOf } from './weekLedger'
import type { ExpenseCat, ExpenseEntry, IncomeEntry, IncomeType, Loan, PassbookLine, Round } from './types'

export interface WithdrawItem { desc: string; person: string; kind: 'bill' | 'advance' | 'manual' | 'loan'; amount: number }
export interface WithdrawFund { name: string; amount: number }
const effDate = (x: ExpenseEntry) => (x.channel === 'manual' ? x.date : (x.paidDate ?? x.date))

/**
 * ต้องเบิกประจำสัปดาห์ (ชุดเดียวกับช่อง "หมายเหตุ · ต้องเบิก" ในใบเบิก-จ่าย): เงินหมุนเวียน = บิลที่วางไว้/สำรองจ่ายที่ยังรอจ่าย + รายการที่ระบุผู้รับ + เงินที่ให้กองทุนยืม ·
 * เงินกองทุน = เงินกองทุนที่รับผ่านตู้/โอนในสัปดาห์นั้น (เก็บไว้เตรียมนำฝาก)
 */
export interface WithdrawInput { expenses: ExpenseEntry[]; income: IncomeEntry[]; rounds: Round[]; passbook: PassbookLine[]; types: IncomeType[]; cats: ExpenseCat[]; loans: Loan[] }
/** ชุดคำนวณเดียวของ "ต้องเบิก" — ใช้ทั้งช่องหมายเหตุ·ต้องเบิกในใบเบิก-จ่าย แฟ้มประจำสัปดาห์ และหน้า เตรียมเบิก ตัวเลขจึงตรงกันเสมอ */
export function computeWeekWithdraw(a: WithdrawInput, year: number, sunday: string) {
  const range = rangeOf('week', year, { sunday })
  const nm = (id?: string) => (id === 'own' ? 'เงินหมุนเวียน' : a.types.find((t) => t.id === id)?.name ?? 'กองทุน')
  const week = a.expenses.filter((x) => !x.deleted && !x.fundId && sheetSunday(effDate(x)) === sunday)
  const circ: WithdrawItem[] = [
    ...week.filter((x) => x.status === 'open' || (x.channel === 'manual' && x.biller)).map((x) => ({ desc: x.desc, person: x.biller || x.who || '', kind: x.channel as WithdrawItem['kind'], amount: x.amount })),
    ...ownLoanLines(a.loans, nm, range.from, range.to),
  ]
  const wf = computeLedger({ range, income: a.income.filter((x) => !isFundZone(x)), rounds: a.rounds, vouchers: [], lines: [], funds: [], entries: [], types: a.types, cats: a.cats, expenses: [], passbook: a.passbook, withFunds: true }).fundRows
  const fund: WithdrawFund[] = wf.map((r) => ({ name: r.label, amount: r.cash.amt + r.transfer.amt })).filter((f) => f.amount > 0)
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)
  return { circ, fund, totalC: sum(circ), totalF: sum(fund), total: sum(circ) + sum(fund) }
}

export function useWeekWithdraw(year: number, sunday: string) {
  const exp = useExpenses(year), income = useIncome(year), rounds = useRounds(year), passbook = usePassbook(year)
  const types = useIncomeTypes(), cats = useExpenseCats(), loans = useLoans()
  return useMemo(() => computeWeekWithdraw({ expenses: exp.items, income: income.items, rounds: rounds.items, passbook: passbook.items, types: types.list, cats: cats.list, loans: loans.items }, year, sunday), [exp.items, income.items, rounds.items, passbook.items, types.list, cats.list, loans.items, year, sunday])
}
