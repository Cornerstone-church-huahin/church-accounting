import { describe, expect, it } from 'vitest'
import { addSub, removeSub, subAccount, subSummary } from './fundSubs'
import type { FundAccount } from './fundAccounts'
import type { IncomeType } from './types'

const f: FundAccount = { id: 'f', name: 'กองทุนกิจกรรม', opening: 1000, moves: [
  { key: 'a', date: '2026-01-01', label: 'รับ', amount: 5000, subId: 'v' },
  { key: 'b', date: '2026-01-02', label: 'จ่าย', amount: -2000, subId: 'v' },
  { key: 'c', date: '2026-01-03', label: 'รับ', amount: 3000, subId: 't' },
  { key: 'd', date: '2026-01-04', label: 'นับเงินถวาย', amount: 700 },
], moneyIn: 8700, moneyOut: 2000, balance: 7700 }
const t = { id: 'f', name: 'กองทุนกิจกรรม', order: 1, active: true, updated: 1, subs: [{ id: 'v', name: 'พืชผัก', active: true, order: 1 }, { id: 't', name: 'โต๊ะจีน', active: true, order: 2 }] } as IncomeType

describe('fundSubs', () => {
  it('แยกยอดตามหมวด ส่วนกลางถือยอดตั้งต้นและรายการที่ไม่ระบุหมวด', () => {
    expect(subAccount(f, 'v').balance).toBe(3000)
    expect(subAccount(f, 't').balance).toBe(3000)
    expect(subAccount(f, '').balance).toBe(1700)
    expect(subAccount(f, 'all')).toBe(f)
    const s = subSummary(f, t)
    expect(s.rows.map((r) => r.acc.balance)).toEqual([3000, 3000])
    expect(s.rows.reduce((a, r) => a + r.acc.balance, 0) + s.central.balance).toBe(f.balance)
  })
  it('เพิ่มหมวด/กันชื่อซ้ำ/ลบจริงเมื่อไม่มีรายการ เก็บถาวรเมื่อมีรายการ', () => {
    const a = addSub(t, 'ของที่ระลึก')
    expect('subs' in a && a.subs).toHaveLength(3)
    expect(addSub(t, 'พืชผัก')).toEqual({ error: 'มีหมวดชื่อนี้แล้ว' })
    expect(removeSub(t, 'v', false)).toHaveLength(1)
    expect(removeSub(t, 'v', true).find((s) => s.id === 'v')?.active).toBe(false)
  })
  it('หมวดที่ถูกเก็บถาวรยังมีในรายงานถ้ามีรายการ', () => {
    const t2 = { ...t, subs: removeSub(t, 'v', true) } as IncomeType
    expect(subSummary(f, t2).rows.map((r) => r.id)).toEqual(['v', 't'])
  })
})
