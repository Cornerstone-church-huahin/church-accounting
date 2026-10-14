import { describe, expect, it } from 'vitest'
import { fundAccounts, withRunning } from './fundAccounts'
import type { ExpenseEntry, IncomeEntry, IncomeType, Loan, Round } from './types'

const types = [{ id: 'tt1', name: 'สิบลด' }, { id: 'tt4', name: 'กองทุนที่ดิน', fund: true }, { id: 'tt9', name: 'กองทุนศึกษา', fund: true }].map((t, i) => ({ ...t, order: i, active: true, updated: 0 }) as IncomeType)
const inc = (o: Partial<IncomeEntry>) => ({ id: 'i' + Math.random(), updated: 1, date: '2026-10-11', typeId: 'tt4', amount: 100000, method: 'cash', source: 'manual', ...o }) as IncomeEntry
const opening = { id: 'opening', updated: 1, date: '2026-10-04', accounts: {}, cash: 0, unmoved: {}, funds: { tt4: 500000, tt9: 20000 }, own: 100000 }

describe('fundAccounts', () => {
  it('opening + received − paid, only after the opening date', () => {
    const rounds = [{ id: 'r1', date: '2026-10-11', lines: { tt1: 9999, tt4: 30000 }, envelopes: { tt4: 2 }, denoms: {}, status: 'verified', updated: 1 }] as unknown as Round[]
    const expenses = [{ id: 'e1', updated: 1, channel: 'manual', date: '2026-10-12', amount: 15000, desc: 'ค่าหนังสือ', fundId: 'tt9', status: 'paid' }] as ExpenseEntry[]
    const rows = fundAccounts({ types, opening, rounds, expenses, income: [inc({ amount: 100000 }), inc({ date: '2026-10-03', amount: 7777 }), inc({ typeId: 'tt1', amount: 5 })] })
    expect(rows.map((r) => r.id)).toEqual(['tt4', 'tt9'])
    const land = rows[0], study = rows[1]
    expect(land).toMatchObject({ opening: 500000, moneyIn: 130000, moneyOut: 0, balance: 630000 })
    expect(study).toMatchObject({ opening: 20000, moneyIn: 0, moneyOut: 15000, balance: 5000 })
    expect(withRunning(land)[0].balance).toBe(630000)
    expect(withRunning(study)[0]).toMatchObject({ amount: -15000, balance: 5000 })
  })

  it('internal loans: lender is debited, borrower gets real cash, repayment moves it back', () => {
    const loan = { id: 'l1', updated: 1, lender: { kind: 'fund', fundId: 'tt4' }, borrower: 'tt9', purpose: 'หนังสือ', date: '2026-10-10', principal: 50000, repayments: [{ id: 'r1', date: '2026-10-12', amount: 20000 }] } as Loan
    const before = fundAccounts({ types, opening, rounds: [], expenses: [], income: [], loans: [{ ...loan, date: '2026-10-01' }] }) // เงินยืมก่อนวันตัดยอดก็นับตามวันที่ในรายการ
    expect(before.map((r) => r.balance)).toEqual([500000 - 50000 + 20000, 20000 + 50000 - 20000])
    const rows = fundAccounts({ types, opening, rounds: [], expenses: [], income: [], loans: [loan] })
    expect(rows[0]).toMatchObject({ balance: 500000 - 50000 + 20000 })
    expect(rows[1]).toMatchObject({ balance: 20000 + 50000 - 20000 })
    expect(rows[0].balance + rows[1].balance).toBe(520000) // รวมเงินสดไม่เปลี่ยน
  })

  it('outside loans add real cash to the borrowing fund too, and repayment takes it back', () => {
    const loan = { id: 'l9', updated: 1, lender: { kind: 'person', name: 'พี่ก' }, borrower: 'tt9', purpose: 'ก่อสร้าง', date: '2026-10-10', principal: 30000, repayments: [{ id: 'r9', date: '2026-10-12', amount: 10000 }] } as Loan
    const expenses = [{ id: 'e9', updated: 1, channel: 'manual', date: '2026-10-11', amount: 30000, desc: 'ค่าปูน', fundId: 'tt9', status: 'paid' }] as ExpenseEntry[]
    const rows = fundAccounts({ types, opening, rounds: [], expenses, income: [], loans: [loan] })
    expect(rows[1].balance).toBe(20000 + 30000 - 30000 - 10000)
    expect(rows[1].moves.map((m) => m.label)).toEqual(['ยืมจาก พี่ก · ก่อสร้าง', 'จ่าย · ค่าปูน', 'คืนเงินยืมให้ พี่ก'])
  })
})
