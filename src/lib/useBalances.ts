import { useMemo } from 'react'
import { useLoans, useBudgetEntries, useBudgetLines, useExpenseCats, useExpenses, useFunds, useIncome, useIncomeTypes, useOpening, usePassbook, useRounds, useVouchers } from './data'
import { computeBalances } from './balances'
import { todayISO } from './money'

/** ข้อมูลจาก 3 ปีล่าสุด (จำนวน hook คงที่) → ยอดเงินหมุนเวียน/กองทุน/รวม ณ วันนี้ */
export function useBalances(year: number, asOf?: string) {
  const ys = [year - 2, year - 1, year]
  const income = ys.map((y) => useIncome(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const rounds = ys.map((y) => useRounds(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const vouchers = ys.map((y) => useVouchers(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const lines = ys.map((y) => useBudgetLines(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const entries = ys.map((y) => useBudgetEntries(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const expenses = ys.map((y) => useExpenses(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const passbook = ys.map((y) => usePassbook(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const funds = useFunds()
  const types = useIncomeTypes()
  const cats = useExpenseCats()
  const opening = useOpening()
  const loans = useLoans()
  const input = useMemo(() => ({
    income: income.flatMap((s) => s.items), rounds: rounds.flatMap((s) => s.items), vouchers: vouchers.flatMap((s) => s.items), lines: lines.flatMap((s) => s.items),
    funds: funds.items, entries: entries.flatMap((s) => s.items), types: types.list, cats: cats.list, expenses: expenses.flatMap((s) => s.items), passbook: passbook.flatMap((s) => s.items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [...income.map((s) => s.items), ...rounds.map((s) => s.items), ...vouchers.map((s) => s.items), ...lines.map((s) => s.items), funds.items, ...entries.map((s) => s.items), types.list, cats.list, ...expenses.map((s) => s.items), ...passbook.map((s) => s.items)])
  const balances = useMemo(() => computeBalances({ ...input, opening: opening.opening, today: asOf ?? todayISO(), loans: loans.items }), [input, opening.opening, loans.items, asOf])
  return { balances, input, opening: opening.opening }
}
