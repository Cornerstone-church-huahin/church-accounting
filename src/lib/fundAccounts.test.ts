import { describe, expect, it } from 'vitest'
import { fundAccounts, withRunning } from './fundAccounts'
import type { ExpenseEntry, IncomeEntry, IncomeType, Round } from './types'

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
})
