import { addDays } from './money'
import { fundAccounts, type FundAccount } from './fundAccounts'
import { computeLedger, type LRow } from './weekLedger'

type LedgerArgs = Parameters<typeof computeLedger>[0]

export interface Balances {
  /** เงินหมุนเวียนของคริสตจักร (ไม่รวมกองทุน ไม่รวมเงินยืม): ตั้งต้น + รายรับปกติ − รายจ่ายปกติที่จ่ายแล้ว */
  own: { opening: number; moneyIn: number; moneyOut: number; pending: number; balance: number }
  funds: FundAccount[]
  fundTotal: number
  total: number
}

/** ยอดเงินหมุนเวียน กองทุน และรวม ณ วันที่ today — นับต่อจากยอดตั้งต้น (ตั้งในตั้งค่า › ยอดยกมา) */
export function computeBalances(a: Omit<LedgerArgs, 'range' | 'withFunds'> & { opening?: Parameters<typeof fundAccounts>[0]['opening']; today: string }): Balances {
  const from = a.opening?.date ? addDays(a.opening.date, 1) : '0000-01-01'
  const L = computeLedger({ ...a, range: { from, to: a.today } })
  const moneyIn = L.inSum.cash + L.inSum.transfer
  const moneyOut = L.outSum.cash + L.outSum.transfer
  const opening = a.opening?.own ?? 0
  const funds = fundAccounts({ types: a.types.filter((t) => t.active), opening: a.opening, income: a.income, rounds: a.rounds, expenses: a.expenses ?? [], passbook: a.passbook })
  const fundTotal = funds.reduce((s, f) => s + f.balance, 0)
  const own = { opening, moneyIn, moneyOut, pending: L.outSum.pending, balance: opening + moneyIn - moneyOut }
  return { own, funds, fundTotal, total: own.balance + fundTotal }
}

export type { LRow }
