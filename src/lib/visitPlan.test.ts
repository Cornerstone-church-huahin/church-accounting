import { describe, expect, it } from 'vitest'
import { addGroup, addItem, moveTo, groupsOf, moveToGroup, moveWithin, planDoc, removeGroup, removeItem, renameGroup } from './visitPlan'

const m = (id: string) => ({ id, name: id.toUpperCase() })
const ids = (d: ReturnType<typeof planDoc>) => groupsOf(d).map((g) => g.items.map((x) => x.id).join(''))
describe('แผนเยี่ยมรายวัน แบ่งกลุ่ม', () => {
  it('เพิ่มคนเข้ากลุ่ม · ข้อมูลเดิมไม่มีกลุ่ม = กลุ่ม 1', () => {
    expect(planDoc({ items: [{ id: 'a', name: 'A' }] } as never).items[0].g).toBe(1)
    let d = planDoc()
    d = addItem(d, m('a'), 1); d = addItem(d, m('b'), 1); d = addItem(d, m('c'), 2); d = addItem(d, m('a'), 2) // ซ้ำ = ไม่เพิ่ม
    expect(ids(d)).toEqual(['ab', 'c'])
  })
  it('เลื่อนภายในกลุ่ม · ย้ายข้ามกลุ่ม (ต่อท้าย) · สร้างกลุ่มใหม่ตอนย้าย', () => {
    let d = planDoc(); for (const [x, g] of [['a', 1], ['b', 1], ['c', 1], ['d', 2]] as const) d = addItem(d, m(x), g)
    d = moveWithin(d, 'c', -1); expect(ids(d)).toEqual(['acb', 'd'])
    d = moveWithin(d, 'a', -1); expect(ids(d)).toEqual(['acb', 'd']) // บนสุดแล้ว
    d = moveToGroup(d, 'a', 2); expect(ids(d)).toEqual(['cb', 'da'])
    d = moveToGroup(d, 'b', 3); expect(d.groups).toBe(3); expect(ids(d)).toEqual(['c', 'da', 'b'])
  })
  it('ลบกลุ่มว่าง เลขกลุ่มและชื่อเลื่อนขึ้น · กลุ่มที่มีคน/กลุ่มสุดท้ายลบไม่ได้', () => {
    let d = planDoc(); d = addItem(d, m('a'), 1); d = addGroup(d); d = addItem(d, m('c'), 3); d = renameGroup(d, 3, 'บ้านปากน้ำ')
    expect(d.groups).toBe(3); expect(removeGroup(d, 1).groups).toBe(3)
    d = removeGroup(d, 2); expect(d.groups).toBe(2); expect(d.items.find((x) => x.id === 'c')!.g).toBe(2); expect(d.names['2']).toBe('บ้านปากน้ำ')
    expect(removeGroup(planDoc(), 1).groups).toBe(1)
    expect(ids(removeItem(d, 'a'))).toEqual(['', 'c'])
  })
})

describe('ลากวาง', () => {
  it('ย้ายตำแหน่งในกลุ่มเดียวกัน/ข้ามกลุ่ม/ไปกลุ่มว่าง/กลุ่มใหม่', () => {
    let d = planDoc(); for (const [x, g] of [['a', 1], ['b', 1], ['c', 1], ['d', 2]] as const) d = addItem(d, m(x), g)
    d = moveTo(d, 'c', 1, 0); expect(ids(d)).toEqual(['cab', 'd'])
    d = moveTo(d, 'a', 1, 2); expect(ids(d)).toEqual(['cba', 'd']) // ต่อท้ายกลุ่มเดิม
    d = moveTo(d, 'b', 2, 0); expect(ids(d)).toEqual(['ca', 'bd'])
    d = addGroup(d); d = moveTo(d, 'd', 3, 0); expect(ids(d)).toEqual(['ca', 'b', 'd'])
    d = moveTo(d, 'a', 4, 0); expect(d.groups).toBe(4); expect(ids(d)).toEqual(['c', 'b', 'd', 'a'])
  })
})
