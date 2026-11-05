import { describe, expect, it } from 'vitest'
import { activityMoney, activitySubIds } from './fundActs'
import type { FundAccount } from './fundAccounts'
import type { IncomeType } from './types'

const t = { id: 'tt9', name: 'กองทุน-กิจกรรม', actMode: true, active: true, order: 0, updated: 0, fund: true, subs: [{ id: 's1', name: 'โต๊ะจีน', active: true, actId: 'a1' }, { id: 's2', name: 'ผักผลไม้', active: true, actId: 'a1' }], activities: [{ id: 'a1', name: 'วันขอบคุณพระเจ้า', date: '2026-11-29' }] } as unknown as IncomeType
const f = (moves: FundAccount['moves']): FundAccount => ({ id: 'tt9', name: 'กองทุน-กิจกรรม', opening: 0, moves, moneyIn: 0, moneyOut: 0, balance: 0 })
describe('เงินกิจกรรม', () => {
  it('นับเฉพาะหมวดที่สังกัดกิจกรรม ส่วนกลางไม่นับ (เป็นกองทุนถาวร)', () => {
    const acc = f([{ key: 'in:a', date: '2026-11-01', label: '', amount: 3500, subId: 's1' }, { key: 'ex:b', date: '2026-11-02', label: '', amount: -500, subId: 's2' }, { key: 'in:c', date: '2026-11-03', label: '', amount: 1000 }])
    expect(activityMoney([acc], [t]).total).toBe(3000)
  })
  it('กองทุนที่ไม่ใช่โหมดกิจกรรมไม่มีเงินกิจกรรม', () => {
    const plain = { ...t, actMode: false } as IncomeType
    expect(activitySubIds([plain]).size).toBe(0)
    expect(activityMoney([f([{ key: 'in:a', date: '2026-11-01', label: '', amount: 100, subId: 's1' }])], [plain]).total).toBe(0)
  })
})
