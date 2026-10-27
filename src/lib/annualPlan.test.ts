import { describe, expect, it } from 'vitest'
import { planRows, planTotal, planTotalOf, quarterMonths } from './annualPlan'
import type { CalEvent } from './types'

const ev = (id: string, date: string, title: string, o: Partial<CalEvent> = {}): CalEvent => ({ id, updated: 1, date, title, tab: 1, plan: true, ...o })
const events: CalEvent[] = [
  ev('a', '2026-11-22', 'อธิษฐานฟังเสียงพระเจ้า', { lead: 'อ. คำสิงห์', budget: 200000 }),
  ev('b', '2026-12-05', 'จัดค่ายคริสตจักร', { extra: ['2026-12-06', '2026-12-07'], lead: 'อ. คำสิงห์' }),
  ev('c', '2026-12-20', 'ประกาศวันคริสต์มาส', { lead: 'ผป. ยุดาวดี', budget: 700000 }),
  ev('d', '2026-10-25', 'ประชุมคณะธรรมกิจ', { repeat: { freq: 'month', every: 1, by: 'date' } }),
  ev('x', '2026-11-01', 'ไม่แสดงในแผน', { plan: false }),
  ev('y', '2026-09-30', 'นอกไตรมาส'),
]
describe('แผนงานประจำปี: แถวของไตรมาส', () => {
  const rows = planRows(events, 2026, 4, '2026-11-10')
  it('เฉพาะกิจกรรมที่ติ๊กแผนงาน ในไตรมาสนั้น เรียงตามวันที่ (ทำซ้ำรายเดือนขยายเป็นแถวละเดือน)', () => {
    expect(rows.map((r) => `${r.dateLabel}|${r.title}`)).toEqual(['25|ประชุมคณะธรรมกิจ', '22|อธิษฐานฟังเสียงพระเจ้า', '25|ประชุมคณะธรรมกิจ', '05 - 07|จัดค่ายคริสตจักร', '20|ประกาศวันคริสต์มาส', '25|ประชุมคณะธรรมกิจ'])
    expect(rows.some((r) => /ไม่แสดงในแผน|นอกไตรมาส/.test(r.title))).toBe(false)
    expect(rows.filter((r) => r.title === 'ประชุมคณะธรรมกิจ').map((r) => r.month)).toEqual([10, 11, 12])
  })
  it('หลายวันติดกัน = ช่วงเดียว พร้อมชื่อวัน เสาร์ - จันทร์', () => {
    const r = rows.find((x) => x.title === 'จัดค่ายคริสตจักร')!
    expect(r.dateLabel).toBe('05 - 07')
    expect(r.dayLabel).toBe('เสาร์ - จันทร์')
    expect(rows.find((x) => x.title === 'ประกาศวันคริสต์มาส')!.dayLabel).toBe('อาทิตย์')
  })
  it('ขีดฆ่าวันที่ที่ผ่านไปแล้ว หรือทำเสร็จแล้ว · งบรวมรายเดือนและไตรมาส', () => {
    expect(rows.find((r) => r.title === 'ประชุมคณะธรรมกิจ' && r.month === 10)!.struck).toBe(true)
    expect(rows.find((r) => r.title === 'อธิษฐานฟังเสียงพระเจ้า')!.struck).toBe(false)
    const done = planRows([ev('z', '2026-12-25', 'งานเสร็จแล้ว', { done: true })], 2026, 4, '2026-11-10')[0]
    expect(done.struck).toBe(true)
    expect(planTotal(rows)).toBe(900000)
    expect(planTotalOf(rows, 11)).toBe(200000)
    expect(quarterMonths(4)).toEqual([10, 11, 12])
  })
})
