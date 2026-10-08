import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPENSE_CATS } from './expenseCats'

describe('หมวดรายจ่ายตั้งต้น', () => {
  it('15 หมวดหลัก 150 รายการ', () => {
    expect(DEFAULT_EXPENSE_CATS.filter((c) => c.kind === 'group')).toHaveLength(15)
    expect(DEFAULT_EXPENSE_CATS.filter((c) => c.kind === 'item')).toHaveLength(150)
  })
  it('จำนวนรายการต่อหมวดตรงตามที่กำหนด', () => {
    const n = (g: number) => DEFAULT_EXPENSE_CATS.filter((c) => c.kind === 'item' && c.group === `eg-${g}`).length
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n)).toEqual([7, 8, 9, 14, 17, 11, 4, 9, 13, 9, 12, 5, 15, 5, 12])
  })
  it('id ไม่ซ้ำ และชื่อไม่ว่าง', () => {
    const ids = DEFAULT_EXPENSE_CATS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(DEFAULT_EXPENSE_CATS.every((c) => c.name.length > 0)).toBe(true)
    expect(DEFAULT_EXPENSE_CATS.find((c) => c.id === 'ei-5-15')?.name).toBe('ค่า พ.ร.บ. รถ')
  })
})
