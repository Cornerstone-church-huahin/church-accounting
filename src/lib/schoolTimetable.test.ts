import { describe, expect, it } from 'vitest'
import { copyPlan, schoolWeekDays, sortedItems, weekSummary } from './schoolTimetable'
import type { SchoolDay } from './types'

const day = (items: SchoolDay['items']): SchoolDay => ({ id: 'sch-2026-11-10', date: '2026-11-10', items, logs: [], updated: 0 })
describe('schoolTimetable', () => {
  it('อังคารถึงอาทิตย์ 6 วัน', () => {
    expect(schoolWeekDays('2026-11-08')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
  })
  it('เรียงตามเวลา ไม่มีเวลาไว้ท้าย', () => {
    const r = sortedItems([{ id: 'a', time: '', title: 'ก', teachers: [] }, { id: 'b', time: '10:00', title: 'ข', teachers: [] }, { id: 'c', time: '09:00', title: 'ค', teachers: [] }])
    expect(r.map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })
  it('คัดลอกแผนโดยไม่เอาสถานะทำแล้ว', () => {
    let n = 0
    const r = copyPlan(day([{ id: 'a', time: '09:00', title: 'ชั้นเด็กเล็ก', teachers: ['ครูหนึ่ง'], done: { at: 1, by: 'x' }, note: 'n' }]), () => `new${++n}`)
    expect(r).toEqual([{ id: 'new1', time: '09:00', title: 'ชั้นเด็กเล็ก', teachers: ['ครูหนึ่ง'] }])
  })
  it('สรุปสัปดาห์', () => {
    const s = weekSummary([day([{ id: 'a', time: '', title: 'ก', teachers: ['ก', 'ข'], done: { at: 1, by: 'x' } }, { id: 'b', time: '', title: 'ข', teachers: ['ข'] }])])
    expect(s).toEqual({ items: 2, done: 1, teachers: ['ก', 'ข'] })
  })
})
