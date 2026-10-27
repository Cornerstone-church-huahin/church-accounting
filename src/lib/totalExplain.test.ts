import { describe, expect, it } from 'vitest'
import { explainTotal } from './totalExplain'
import type { Balances } from './balances'

const fmt = (n: number) => (n / 100).toLocaleString('en-US')
const b = { own: { opening: 0, moneyIn: 2000000, moneyOut: 1000000, pending: 0, borrowed: 0, lent: 0, balance: 1326570 }, funds: [{}, {}], fundTotal: 8920420, total: 10246990 } as unknown as Balances
describe('คำอธิบายรวมเงินสด', () => {
  it('สรุปหมุนเวียน + กองทุน = รวม ด้วยตัวเลขจริง', () => {
    const s = explainTotal(b, 0, fmt)
    expect(s[0].text).toContain('13,265.7 + เงินกองทุนทุกกอง 89,204.2 = 102,469.9')
    expect(s[1].text).toContain('ตั้งต้น 0')
    expect(s[2].text).toContain('2 กองทุน')
  })
  it('แสดงเฉพาะรายการเงินหมุนเวียนที่มี · เงินยืมภายนอกมีขั้นอธิบายเฉพาะเมื่อมียอด', () => {
    expect(explainTotal(b, 0, fmt)[1].text).not.toMatch(/ค้างจ่าย|ที่ยืมมา|ให้กองทุนยืม/)
    expect(explainTotal(b, 0, fmt).some((x) => /ภายนอก/.test(x.title))).toBe(false)
    const withLoan = { ...b, own: { ...b.own, pending: 100, borrowed: 15000000, lent: 50 } } as Balances
    const t = explainTotal(withLoan, 15000000, fmt)
    expect(t[1].text).toMatch(/ค้างจ่าย 1.*ที่ยืมมา 150,000.*ให้กองทุนยืมไป 0.5/)
    expect(t.some((x) => /ภายนอก/.test(x.title))).toBe(true)
  })
})
