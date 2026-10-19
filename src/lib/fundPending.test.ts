import { describe, expect, it } from 'vitest'
import { fundPending } from './fundPending'
import type { FundAccount } from './fundAccounts'
import type { FundDeposit } from './types'

const f = (id: string, name: string, moves: FundAccount['moves']): FundAccount => ({ id, name, opening: 0, moves, moneyIn: 0, moneyOut: 0, balance: 0 })
describe('fundPending', () => {
  const funds = [
    f('tt4', 'กองทุน-ที่ดิน', [{ key: 'in:a', date: '2026-10-18', label: '', amount: 12000 }, { key: 'ex:x', date: '2026-10-19', label: '', amount: -500 }]),
    f('tt8', 'กองทุน-อาหาร', [{ key: 'rd:r', date: '2026-10-18', label: '', amount: 5000 }, { key: 'in:b', date: '2026-10-25', label: '', amount: 3000 }, { key: 'ln:l', date: '2026-10-20', label: '', amount: 99999 }]),
  ]
  it('เรียงสัปดาห์ต่อเนื่อง ไม่นับเงินยืม/รายจ่าย', () => {
    const r = fundPending(funds, [])
    expect(r.rows.map((x) => [x.week, x.name, x.pending])).toEqual([['2026-10-18', 'กองทุน-ที่ดิน', 12000], ['2026-10-18', 'กองทุน-อาหาร', 5000], ['2026-10-25', 'กองทุน-อาหาร', 3000]])
    expect(r.waitingTotal).toBe(20000)
  })
  it('ฝากแล้ว = ไม่รอ · มีเงินเข้าเพิ่มในสัปดาห์เดิม = ส่วนเพิ่มกลับมารอ', () => {
    const dep: FundDeposit = { id: '2026-10-18:tt4', updated: 1, week: '2026-10-18', fundId: 'tt4', amount: 12000, on: '2026-10-20' }
    expect(fundPending(funds, [dep]).waiting.map((x) => x.key)).toEqual(['2026-10-18:tt8', '2026-10-25:tt8'])
    const more = [f('tt4', 'กองทุน-ที่ดิน', [{ key: 'in:a', date: '2026-10-18', label: '', amount: 12500 }])]
    const r = fundPending(more, [dep])
    expect(r.rows[0].pending).toBe(500)
  })
})
