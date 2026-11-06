import { describe, expect, it } from 'vitest'
import { compactNumbers } from './letterNo'

const L = (id: string, no: string, extra = {}) => ({ id, no, ...extra })
describe('compactNumbers', () => {
  it('ลบชิ้นกลาง ชิ้นหลังเลื่อนขึ้น', () => {
    expect(compactNumbers([L('a', 'ศอ/ปด.001'), L('c', 'ศอ/ปด.003')])).toEqual([{ id: 'c', no: 'ศอ/ปด.002' }])
  })
  it('เลข 007 เดี่ยว ๆ กลับเป็น 001', () => {
    expect(compactNumbers([L('x', 'ศอ/ปด.007')])).toEqual([{ id: 'x', no: 'ศอ/ปด.001' }])
  })
  it('ฉบับที่แก้เลขเอง (noPin) คงเลข · ฉบับอื่นเว้นเลขนั้น', () => {
    const r = compactNumbers([L('a', 'ศอ/ปด.001'), L('b', 'ศอ/ปด.002', { noPin: true }), L('c', 'ศอ/ปด.005')])
    expect(r).toEqual([{ id: 'c', no: 'ศอ/ปด.003' }])
  })
  it('สามัญและวิสามัญแยกกลุ่ม ไม่ปนกัน', () => {
    expect(compactNumbers([L('a', 'ศอ/ปด.001'), L('v', 'ศอ/วส.003', { category: 'วิสามัญ' })])).toEqual([{ id: 'v', no: 'ศอ/วส.001' }])
  })
  it('ที่ลบแล้วไม่นับ', () => {
    expect(compactNumbers([L('a', 'ศอ/ปด.001'), L('d', 'ศอ/ปด.002', { deleted: true }), L('c', 'ศอ/ปด.003')])).toEqual([{ id: 'c', no: 'ศอ/ปด.002' }])
  })
})
