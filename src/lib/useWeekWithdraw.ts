import { useMemo } from 'react'
import { useExpenses, useIncome, useIncomeTypes, useExpenseCats, useLoans, usePassbook, useRounds } from './data'
import { isFundZone } from './funds'
import { sheetSunday } from './money'
import { ownLoanLines } from './weekLoans'
import { computeLedger, rangeOf } from './weekLedger'
import type { ExpenseEntry } from './types'

export interface WithdrawItem { desc: string; person: string; kind: 'bill' | 'advance' | 'manual' | 'loan'; amount: number }
export interface WithdrawFund { name: string; amount: number }
const effDate = (x: ExpenseEntry) => (x.channel === 'manual' ? x.date : (x.paidDate ?? x.date))

/**
 * ต้องเบิกประจำสัปดาห์ (ชุดเดียวกับช่อง "หมายเหตุ · ต้องเบิก" ในใบเบิก-จ่าย): เงินหมุนเวียน = บิลที่วางไว้/สำรองจ่ายที่ยังรอจ่าย + รายการที่ระบุผู้รับ + เงินที่ให้กองทุนยืม ·
 * เงินกองทุน = เงินกองทุนที่รับผ่านตู้/โอนในสัปดาห์นั้น (เก็บไว้เตรียมนำฝาก)
 */
export function useWeekWithdraw(year: number, sunday: string) {
  const exp = useExpenses(year), income = useIncome(year), rounds = useRounds(year), passbook = usePassbook(year)
  const types = useIncomeTypes(), cats = useExpenseCats(), loans = useLoans()
  return useMemo(() => {
    const range = rangeOf('week', year, { sunday })
    const nm = (id?: string) => (id === 'own' ? 'เงินหมุนเวียน' : types.byId(id ?? '')?.name ?? 'กองทุน')
    const week = exp.items.filter((x) => !x.deleted && !x.fundId && sheetSunday(effDate(x)) === sunday)
    const circ: WithdrawItem[] = [
      ...week.filter((x) => x.status === 'open' || (x.channel === 'manual' && x.biller)).map((x) => ({ desc: x.desc, person: x.biller || x.who || '', kind: x.channel as WithdrawItem['kind'], amount: x.amount })),
      ...ownLoanLines(loans.items, nm, range.from, range.to),
    ]
    const wf = computeLedger({ range, income: income.items.filter((x) => !isFundZone(x)), rounds: rounds.items, vouchers: [], lines: [], funds: [], entries: [], types: types.list, cats: cats.list, expenses: [], passbook: passbook.items, withFunds: true }).fundRows
    const fund: WithdrawFund[] = wf.map((r) => ({ name: r.label, amount: r.cash.amt + r.transfer.amt })).filter((f) => f.amount > 0)
    const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)
    return { circ, fund, totalC: sum(circ), totalF: sum(fund), total: sum(circ) + sum(fund) }
  }, [exp.items, income.items, rounds.items, passbook.items, types.list, cats.list, loans.items, year, sunday]) // eslint-disable-line react-hooks/exhaustive-deps
}
