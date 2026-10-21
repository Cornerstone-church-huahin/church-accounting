import { describe, expect, it } from 'vitest'
import { isLandFund, landSummary } from './land'
import type { FundAccount } from './fundAccounts'

const acc = (id: string, name: string, opening: number, moves: FundAccount['moves']): FundAccount => {
  const moneyIn = moves.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0)
  const moneyOut = moves.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0)
  return { id, name, opening, moves, moneyIn, moneyOut, balance: opening + moneyIn - moneyOut }
}
describe('ภาระที่ดิน ← กองทุนที่ดิน', () => {
  it('เลือกเฉพาะกองทุนที่ชื่อมี “ที่ดิน”', () => {
    expect(isLandFund({ name: 'กองทุนเพื่อที่ดินคริสตจักร' })).toBe(true)
    expect(isLandFund({ name: 'กองทุนซื้อที่ดิน (ส่วนที่ 2)' })).toBe(true)
    expect(isLandFund({ name: 'กองทุนเพื่ออาหาร' })).toBe(false)
  })
  it('รวมยอดสุทธิและเงินถวายเพิ่มเติม (ไม่นับเงินยืม) จากหลายกองทุนที่ดิน', () => {
    const a = acc('tt4', 'กองทุนเพื่อที่ดินคริสตจักร', 2901300, [
      { key: 'rd:1', date: '2026-10-04', label: 'นับเงินถวาย', amount: 12000 },
      { key: 'in:2', date: '2026-10-11', label: 'โอน', amount: 5000 },
      { key: 'ln:3', date: '2026-10-12', label: 'ให้ยืม', amount: -100000 },
      { key: 'lr:4', date: '2026-10-18', label: 'รับคืน', amount: 30000 },
    ])
    const b = acc('x9', 'กองทุนที่ดิน 2', 0, [{ key: 'pb:5', date: '2026-10-19', label: 'โอนเข้าบัญชี (สมุด)', amount: 7000 }])
    const other = acc('tt5', 'กองทุนเพื่ออาหาร', 5000, [{ key: 'rd:9', date: '2026-10-04', label: 'นับเงินถวาย', amount: 1000 }])
    const s = landSummary([a, b, other])
    expect(s.funds.map((f) => f.id)).toEqual(['tt4', 'x9'])
    expect(s.offered).toBe(12000 + 5000 + 7000)
    expect(s.balance).toBe(a.balance + b.balance)
    expect(s.funds[0]).toMatchObject({ opening: 2901300, offered: 17000, out: 100000 })
    expect(s.recent.map((m) => m.key)).toEqual(['pb:5', 'lr:4', 'ln:3', 'in:2', 'rd:1'])
  })
  it('ไม่มีกองทุนที่ดิน = ศูนย์', () => {
    expect(landSummary([acc('tt5', 'กองทุนเพื่ออาหาร', 5, [])])).toMatchObject({ funds: [], balance: 0, offered: 0, recent: [] })
  })
})
