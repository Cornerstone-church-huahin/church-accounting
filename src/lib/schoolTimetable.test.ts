import { describe, expect, it } from 'vitest'
import { dutyFor, itemsFromTpl, normCfg, schoolWeekDays, sortedItems, weekSummary, withDuty } from './schoolTimetable'
import type { SchoolDay } from './types'

const day = (items: SchoolDay['items']): SchoolDay => ({ id: 'sch-2026-11-15', date: '2026-11-15', items, logs: [], updated: 0 })
describe('schoolTimetable', () => {
  it('อังคาร–เสาร์ก่อนหน้า แล้วตามด้วยวันอาทิตย์', () => {
    expect(schoolWeekDays('2026-11-15')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
  })
  it('เรียงตามเวลา ไม่มีเวลาไว้ท้าย', () => {
    const r = sortedItems([{ id: 'a', time: '', title: 'ก', teachers: [] }, { id: 'b', time: '10:00', title: 'ข', teachers: [] }, { id: 'c', time: '09:00', title: 'ค', teachers: [] }])
    expect(r.map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })
  it('สรุปสัปดาห์', () => {
    const s = weekSummary([day([{ id: 'a', time: '', title: 'ก', teachers: ['ก', 'ข'], done: { at: 1, by: 'x' } }, { id: 'b', time: '', title: 'ข', teachers: ['ข'] }])])
    expect(s).toEqual({ items: 2, done: 1, teachers: ['ก', 'ข'] })
  })
})
describe('หมุนเวียนครู', () => {
  const pool = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']
  const cfg = { pool, perWeek: 2, anchor: '2026-11-15' }
  it('6 คน ลงสอนสัปดาห์ละ 2 → หมุน 3 สัปดาห์', () => {
    expect(dutyFor(cfg, '2026-11-15').duty).toEqual(['ก', 'ข'])
    expect(dutyFor(cfg, '2026-11-22').duty).toEqual(['ค', 'ง'])
    expect(dutyFor(cfg, '2026-11-29').duty).toEqual(['จ', 'ฉ'])
    expect(dutyFor(cfg, '2026-12-06').duty).toEqual(['ก', 'ข'])
    expect(dutyFor(cfg, '2026-11-15').rest).toEqual(['ค', 'ง', 'จ', 'ฉ'])
  })
  it('ย้อนก่อนวันเริ่มก็หมุนถูก และไม่เกินจำนวนครู', () => {
    expect(dutyFor(cfg, '2026-11-08').duty).toEqual(['จ', 'ฉ'])
    expect(dutyFor({ pool: ['ก', 'ข'], perWeek: 5, anchor: '' }, '2026-11-15').duty).toEqual(['ก', 'ข'])
    expect(dutyFor({ pool: [], perWeek: 2, anchor: '' }, '2026-11-15')).toEqual({ duty: [], rest: [] })
  })
  it('สร้างรายการจากแม่แบบ และเปลี่ยนครูที่ลงสอนแล้วรายการหน้าที่หมุนเวียนตาม', () => {
    const c = normCfg({ id: 'cfg', updated: 0, lead: ['อ.หนึ่ง'], helpers: ['พี่เลี้ยง'], pool, perWeek: 2, anchor: '2026-11-15', tpl: [] })
    const items = itemsFromTpl(normCfg({ ...c, tpl: undefined } as never), ['ก', 'ข'])
    expect(items.find((x) => x.title.includes('เรื่องเล่า'))?.teachers).toEqual(['อ.หนึ่ง'])
    expect(items.find((x) => x.title.includes('ต้อนรับ'))?.teachers).toEqual(['พี่เลี้ยง'])
    const d = withDuty(day(items), ['ค', 'ง'])
    expect(d.items.find((x) => x.title.includes('นมัสการเด็ก'))?.teachers).toEqual(['ค', 'ง'])
    expect(d.items.find((x) => x.title.includes('เรื่องเล่า'))?.teachers).toEqual(['อ.หนึ่ง'])
  })
})
