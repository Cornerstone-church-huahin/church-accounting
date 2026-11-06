import { describe, expect, it } from 'vitest'
import { rankChanges } from './letterNo'

const L = (id: string, no: string, extra = {}) => ({ id, no, ...extra })
describe('rankChanges', () => {
  it('เลขตามลำดับแถว: ลบชิ้นกลาง ชิ้นหลังเลื่อนขึ้น', () => {
    expect(rankChanges([{ group: 's', letter: L('a', 'ศอ/ปด.001') }, { group: 's', letter: L('c', 'ศอ/ปด.003') }])).toEqual([{ id: 'c', no: 'ศอ/ปด.002' }])
  })
  it('ชิ้นแรกที่ได้เลข 002 กลับเป็น 001', () => {
    expect(rankChanges([{ group: 's', letter: L('x', 'ศอ/จป.002') }])).toEqual([{ id: 'x', no: 'ศอ/จป.001' }])
  })
  it('แถวที่ยังไม่มีหนังสือก็นับลำดับ', () => {
    expect(rankChanges([{ group: 's' }, { group: 's', letter: L('b', 'ศอ/ปด.001') }])).toEqual([{ id: 'b', no: 'ศอ/ปด.002' }])
  })
  it('แก้เลขเอง (noPin) คงเดิม', () => {
    expect(rankChanges([{ group: 's', letter: L('a', 'ศอ/ปด.009', { noPin: true }) }])).toEqual([])
  })
  it('สามัญ/วิสามัญแยกกลุ่ม', () => {
    expect(rankChanges([{ group: 's', letter: L('a', 'ศอ/ปด.001') }, { group: 'v', letter: L('v', 'ศอ/วส.004') }])).toEqual([{ id: 'v', no: 'ศอ/วส.001' }])
  })
})

import { reorderNos } from './letterNo'
describe('reorderNos', () => {
  it('ชิ้นสุดท้ายแก้เป็นเลข 2 → แทรกลำดับ 2 ชิ้นอื่นเลื่อนลง', () => {
    expect([...reorderNos(['a', 'b', 'c', 'd'], 'd', 2)]).toEqual([['a', 1], ['d', 2], ['b', 3], ['c', 4]])
  })
  it('เลขเกินจำนวน → อยู่ท้ายสุด', () => {
    expect([...reorderNos(['a', 'b'], 'a', 9)]).toEqual([['b', 1], ['a', 2]])
  })
  it('เลข 0 หรือติดลบ → อยู่แรกสุด', () => {
    expect([...reorderNos(['a', 'b'], 'b', 0)]).toEqual([['b', 1], ['a', 2]])
  })
})
