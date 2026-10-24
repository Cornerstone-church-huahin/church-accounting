import { describe, expect, it } from 'vitest'
import { maskExpenses, maskPending, COMP_LABEL } from './maskPay'
import type { ExpenseEntry } from './types'

const e = (id: string, desc: string, amount: number): ExpenseEntry => ({ id, updated: 1, channel: 'manual', date: '2026-01-04', amount, desc, status: 'paid', method: 'cash' })

describe('maskPay', () => {
  it('รวมเงินเดือน/สวัสดิการเป็นแถวเดียว ไม่เห็นชื่อรายคน', () => {
    const out = maskExpenses([e('1', 'เงินเดือน อ.กฤต', 20000), e('2', 'สวัสดิการ พี่ก', 5000), e('3', 'ค่าน้ำ', 300)])
    expect(out).toHaveLength(2)
    expect(out.find((x) => x.desc === COMP_LABEL)?.amount).toBe(25000)
    expect(out.some((x) => /กฤต|พี่ก/.test(x.desc))).toBe(false)
  })
  it('ไม่มีค่าตอบแทนก็ไม่เปลี่ยน', () => {
    const l = [e('3', 'ค่าน้ำ', 300)]
    expect(maskExpenses(l)).toBe(l)
  })
  it('รายการต้องเบิกถูกรวมและตัดชื่อ', () => {
    const out = maskPending([{ desc: 'เงินเดือน อ.กฤต', person: 'กฤต', kind: 'a', amount: 10 }, { desc: 'เงินเดือน อ.พิชิต', person: 'พิชิต', kind: 'a', amount: 20 }])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ desc: COMP_LABEL, person: '', amount: 30 })
  })
})

describe('maskNoticeOut', () => {
  it('รวมเงินเดือนในใบสรุปเป็นแถวเดียวและตัดชื่อผู้เบิก', async () => {
    const { maskNoticeOut } = await import('./maskPay')
    const o = maskNoticeOut([{ key: 'a', date: '2026-01-02', desc: 'เงินเดือน อ.กฤต', amount: 10, by: 'อ.กฤต' }, { key: 'b', date: '2026-01-03', desc: 'ค่าน้ำ', amount: 5 }, { key: 'c', date: '2026-01-04', desc: 'เงินเดือน อ.พิชิต', amount: 20 }])
    expect(o.map((x) => x.desc)).toEqual(['สวัสดิการผู้รับใช้ (ยอดรวม)', 'ค่าน้ำ'])
    expect(o[0]).toMatchObject({ amount: 30 }); expect(o[0].by).toBeUndefined()
  })
})
