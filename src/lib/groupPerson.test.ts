import { describe, expect, it } from 'vitest'
import { groupByPerson } from './groupPerson'

describe('groupByPerson', () => {
  const xs = [
    { person: 'อ.ดารา', amount: 587 }, { person: 'มน.สมเจต', amount: 1500 }, { person: 'อ.สายฝน', amount: 453 },
    { person: 'อ.ดารา', amount: 496 }, { person: '', amount: 100 }, { person: 'อ.สายฝน', amount: 1383 },
  ]
  it('คนเดียวกันอยู่ติดกัน ตามลำดับที่ปรากฏครั้งแรก พร้อมยอดรวมและ rowSpan', () => {
    const r = groupByPerson(xs)
    expect(r.map((x) => `${x.item.person}:${x.item.amount}`)).toEqual(['อ.ดารา:587', 'อ.ดารา:496', 'มน.สมเจต:1500', 'อ.สายฝน:453', 'อ.สายฝน:1383', ':100'])
    expect(r[0].span).toBe(2); expect(r[1].span).toBe(0); expect(r[0].total).toBe(1083); expect(r[0].multi).toBe(true)
    expect(r[2].multi).toBe(false); expect(r[3].total).toBe(1836)
    expect(r[5].g).toBe(-1)
  })
  it('จำนวนรวมไม่เปลี่ยน', () => {
    expect(groupByPerson(xs).reduce((s, x) => s + x.item.amount, 0)).toBe(xs.reduce((s, x) => s + x.amount, 0))
  })
})
