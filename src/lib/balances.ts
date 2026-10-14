import { addDays } from './money'
import { fundAccounts, type FundAccount } from './fundAccounts'
import { loanBalance } from './loans'
import { isFundType } from './funds'
import type { IncomeEntry, IncomeType, Loan, Opening, Round } from './types'
import { computeLedger, type LRow } from './weekLedger'

type LedgerArgs = Parameters<typeof computeLedger>[0]

export interface Balances {
  /** เงินหมุนเวียนของคริสตจักร (ไม่รวมกองทุน ไม่รวมเงินยืม): ตั้งต้น + รายรับปกติ − รายจ่ายปกติที่จ่ายแล้ว − ค้างจ่าย (วางบิล/สำรองจ่ายที่บันทึกไว้แล้ว นับเป็นรายจ่ายทันทีเหมือนใบสรุป) */
  own: { opening: number; moneyIn: number; moneyOut: number; pending: number; /** เงินที่เงินหมุนเวียนยืมมา (จากกองทุนหรือบุคคลภายนอก ที่ยังไม่คืน) นับเป็นเงินสดที่มีจริง */ borrowed: number; balance: number }
  funds: FundAccount[]
  fundTotal: number
  total: number
}

/** ยอดเงินหมุนเวียน กองทุน และรวม ณ วันที่ today — นับต่อจากยอดตั้งต้น (ตั้งในตั้งค่า › ยอดยกมา) */
export function computeBalances(a: Omit<LedgerArgs, 'range' | 'withFunds'> & { opening?: Parameters<typeof fundAccounts>[0]['opening']; today: string; loans?: Loan[] }): Balances {
  const from = a.opening?.date ? addDays(a.opening.date, 1) : '0000-01-01'
  const L = computeLedger({ ...a, range: { from, to: a.today } })
  const moneyIn = L.inSum.cash + L.inSum.transfer
  const moneyOut = L.outSum.cash + L.outSum.transfer
  const opening = a.opening?.own ?? 0
  const funds = fundAccounts({ types: a.types.filter((t) => t.active), opening: a.opening, income: a.income, rounds: a.rounds, expenses: a.expenses ?? [], passbook: a.passbook, loans: a.loans })
  const fundTotal = funds.reduce((s, f) => s + f.balance, 0)
  const borrowed = (a.loans ?? []).filter((l) => !l.deleted && l.borrower === 'own').reduce((s, l) => s + loanBalance(l), 0)
  const own = { opening, moneyIn, moneyOut, pending: L.outSum.pending, borrowed, balance: opening + moneyIn - moneyOut - L.outSum.pending + borrowed }
  return { own, funds, fundTotal, total: own.balance + fundTotal }
}

export type { LRow }

/** ยอดเงินหมุนเวียนล้วน ๆ: ตัดเงินที่ยืมมาจากกองทุนออก (นับเป็นเงินของกองทุน ไม่เกี่ยวกับบัญชีหมุนเวียน) — ยืมจากบุคคลภายนอกยังนับ */
export function circulatingOnly(b: Balances, loans: Loan[]): number {
  const fromFunds = loans.filter((l) => !l.deleted && l.borrower === 'own' && l.lender.kind === 'fund').reduce((s, l) => s + loanBalance(l), 0)
  return b.own.balance - fromFunds
}

/**
 * รายรับเงินหมุนเวียนที่ลงวันที่ "ก่อนวันตัดยอดยกมา" — ระบบไม่นับ (ถือว่าอยู่ในยอดยกมาแล้ว) แต่ถ้ายอดยกมาเงินหมุนเวียนยังเป็น 0
 * ผู้ใช้มักบันทึกเงินตั้งต้นเป็นรายรับแทน จึงต้องเตือนและเสนอให้เอาไปเป็นยอดยกมา
 */
export function incomeBeforeCutoff(a: { income: IncomeEntry[]; rounds: Round[]; types: IncomeType[] }, opening?: Opening): { count: number; total: number } {
  if (!opening?.date) return { count: 0, total: 0 }
  const from = addDays(opening.date, 1)
  const fund = new Set(a.types.filter((t) => isFundType(t)).map((t) => t.id))
  let count = 0, total = 0
  for (const x of a.income) if (!x.deleted && !x.roundId && x.date < from && !fund.has(x.typeId)) { count += 1; total += x.amount }
  for (const r of a.rounds) if (!r.deleted && r.date < from) for (const [id, v] of Object.entries(r.lines)) if (v > 0 && !fund.has(id)) { count += 1; total += v }
  return { count, total }
}
