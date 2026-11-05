import { describe, expect, it } from 'vitest'
import { planActMigration } from './actMigrate'
import type { ExpenseEntry, IncomeEntry, IncomeType } from './types'

const T = { id: 'ta', name: 'กองทุน-กิจกรรม', fund: true, actMode: true, active: true, order: 0, updated: 1, activities: [{ id: 'a1', name: 'x', date: '2026-03-01' }], subs: [{ id: 's1', name: 'a', active: true, order: 0, actId: 'a1' }, { id: 's0', name: 'ถาวร', active: true, order: 1 }] } as IncomeType
const inc = (id: string, subId?: string, typeId = 'ta') => ({ id, typeId, subId, amount: 100, date: '2026-03-02', method: 'cash', updated: 1 }) as IncomeEntry
const exp = (id: string, subId?: string) => ({ id, fundId: 'ta', subId, amount: 30, date: '2026-03-03', desc: 'e', channel: 'manual', status: 'paid', updated: 1 }) as unknown as ExpenseEntry

describe('planActMigration', () => {
  it('ย้ายเฉพาะรายการของหมวดกิจกรรม ส่วนกลางอยู่ที่เดิม และถอดกิจกรรมออกจากกองทุนเดิม', () => {
    const p = planActMigration([T], [inc('i1', 's1'), inc('i2'), inc('i3', 's1', 'other')], [exp('e1', 's1'), exp('e2')], 5)!
    expect(p.income.map((x) => x.id)).toEqual(['i1'])
    expect(p.expenses.map((x) => x.id)).toEqual(['e1'])
    expect(p.target.standalone).toBe(true)
    expect(p.target.activities).toHaveLength(1)
    expect(p.summary.balance).toBe(70)
    expect(p.sources[0].actMode).toBe(false)
    expect(p.sources[0].subs?.map((q) => q.id)).toEqual(['s0'])
    expect(p.sources[0].noActAuto).toBe(true)
  })
  it('ไม่มีอะไรให้ย้าย = null (รันซ้ำได้)', () => {
    expect(planActMigration([{ ...T, actMode: false, activities: [], subs: [] }], [], [], 1)).toBeNull()
  })
})
