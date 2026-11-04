import { describe, expect, it } from 'vitest'
import { fundPending, withdrawnInWeek, wdId } from './fundPending'
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

describe('fundPending: เงินที่บันทึกตรงในหน้ากองทุน (direct)', () => {
  const funds = [
    f('tt4', 'กองทุน-ที่ดิน', [{ key: 'in:a', date: '2026-10-18', label: '', amount: 12000 }, { key: 'in:t1', date: '2026-10-19', label: '', amount: 5000, direct: true }, { key: 'in:t2', date: '2026-10-20', label: '', amount: 3000, direct: true }]),
  ]
  it('ส่วนที่บันทึกตรง = ยังไม่ถอน แยกจากส่วนที่มากับรายรับ (ถอนแล้วอัตโนมัติ)', () => {
    const r = fundPending(funds, [])
    expect(r.waitingTotal).toBe(12000)
    expect(r.unwithdrawnTotal).toBe(8000)
    expect(r.unwithdrawn.map((x) => x.kind)).toEqual(['direct-unwithdrawn'])
  })
  it('กด ถอนแล้ว → ย้ายไปรอนำฝาก · ฝากแล้ว → หายจากรอ · รายการเพิ่มทีหลังกลับมาเป็นยังไม่ถอนเฉพาะส่วนเพิ่ม', () => {
    const key = '2026-10-25:tt4:d'
    const w: FundDeposit = { id: wdId(key, '2026-10-22'), updated: 1, week: '2026-10-25', fundId: 'tt4', amount: 8000, on: '2026-10-22' }
    const r = fundPending(funds, [w])
    expect(r.unwithdrawnTotal).toBe(0)
    expect(r.waitingTotal).toBe(20000)
    expect(r.rows.find((x) => x.kind === 'direct-wait')?.withdrawnOn).toBe('2026-10-22')
    const dep: FundDeposit = { id: key, updated: 1, week: '2026-10-25', fundId: 'tt4', amount: 8000, on: '2026-10-23' }
    expect(fundPending(funds, [w, dep]).waitingTotal).toBe(12000)
    const more = [f('tt4', 'กองทุน-ที่ดิน', [...funds[0].moves, { key: 'in:t3', date: '2026-10-21', label: '', amount: 1000, direct: true }])]
    const r2 = fundPending(more, [w])
    expect(r2.unwithdrawnTotal).toBe(1000)
    expect(r2.waitingTotal).toBe(20000)
  })
  it('ลบรายการจนยอดน้อยกว่าที่ถอน → นับเท่าที่เหลือจริง ไม่ติดลบ', () => {
    const key = '2026-10-25:tt4:d'
    const w: FundDeposit = { id: wdId(key, '2026-10-22'), updated: 1, week: '2026-10-25', fundId: 'tt4', amount: 8000, on: '2026-10-22' }
    const less = [f('tt4', 'กองทุน-ที่ดิน', [{ key: 'in:t1', date: '2026-10-19', label: '', amount: 5000, direct: true }])]
    const r = fundPending(less, [w])
    expect(r.waitingTotal).toBe(5000)
    expect(r.unwithdrawnTotal).toBe(0)
  })
  it('ยอดที่ถอนเองแล้วขึ้นในช่องต้องเบิกของสัปดาห์ที่ถอน (วันที่ถอน) ไม่ใช่สัปดาห์ที่รับ', () => {
    const w: FundDeposit = { id: wdId('2026-10-25:tt4:d', '2026-10-28'), updated: 1, week: '2026-10-18', fundId: 'tt4', amount: 8000, on: '2026-10-28' }
    expect(withdrawnInWeek([w], '2026-11-01', () => 'กองทุน-ที่ดิน').map((x) => x.amount)).toEqual([8000])
    expect(withdrawnInWeek([w], '2026-10-25', () => 'กองทุน-ที่ดิน')).toEqual([])
  })
  it('ถอนหลายครั้งในแถวเดียวกัน: รวมยอดถอน · วันที่ถอนล่าสุด', () => {
    const key = '2026-10-25:tt4:d'
    const w1: FundDeposit = { id: wdId(key, '2026-10-22'), updated: 1, week: '2026-10-25', fundId: 'tt4', amount: 5000, on: '2026-10-22' }
    const w2: FundDeposit = { id: wdId(key, '2026-10-29'), updated: 1, week: '2026-10-25', fundId: 'tt4', amount: 3000, on: '2026-10-29' }
    const r = fundPending(funds, [w1, w2])
    expect(r.unwithdrawnTotal).toBe(0)
    expect(r.rows.find((x) => x.kind === 'direct-wait')).toMatchObject({ recorded: 8000, withdrawnOn: '2026-10-29' })
  })
})
