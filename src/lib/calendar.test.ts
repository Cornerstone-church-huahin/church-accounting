import { describe, expect, it } from 'vitest'
import { canTouchEvent, dateRange, describeDates, describeRepeat, kindOf, occurrences, presetRepeat } from './calendar'
import type { Repeat } from './types'

const occ = (date: string, repeat: Repeat | undefined, from: string, to: string, exdates?: string[]) => occurrences({ date, repeat, exdates }, from, to)
describe('สิทธิ์แก้ไข/ลบกิจกรรมปฏิทิน', () => {
  it('เฉพาะผู้บันทึกและแอดมิน', () => {
    expect(canTouchEvent({ recId: 'a' }, 'a', false)).toBe(true)
    expect(canTouchEvent({ recId: 'a' }, 'b', false)).toBe(false)
    expect(canTouchEvent({ recId: 'a' }, 'b', true)).toBe(true)
    expect(canTouchEvent({}, 'b', false)).toBe(true) // รายการเก่าไม่มีผู้บันทึก
  })
})
describe('การทำซ้ำแบบ Google', () => {
  it('ไม่ซ้ำ = วันเดียว', () => {
    expect(occ('2026-10-15', undefined, '2026-10-01', '2026-10-31')).toEqual(['2026-10-15'])
    expect(occ('2026-10-15', undefined, '2026-11-01', '2026-11-30')).toEqual([])
  })
  it('ทุกสัปดาห์ เลือกหลายวัน: อังคาร พฤหัส เสาร์', () => {
    // 2026-10-20 = อังคาร
    const r: Repeat = { freq: 'week', every: 1, days: [2, 4, 6] }
    expect(occ('2026-10-20', r, '2026-10-18', '2026-10-31')).toEqual(['2026-10-20', '2026-10-22', '2026-10-24', '2026-10-27', '2026-10-29', '2026-10-31'])
  })
  it('ทุก 2 สัปดาห์', () => {
    expect(occ('2026-10-20', { freq: 'week', every: 2, days: [2] }, '2026-10-01', '2026-11-30')).toEqual(['2026-10-20', '2026-11-03', '2026-11-17'])
  })
  it('ทุกเดือนวันที่ 1 (ต้นเดือน) และวันที่ 31 ใช้วันสุดท้ายของเดือนที่สั้นกว่า', () => {
    expect(occ('2026-09-01', { freq: 'month', every: 1, by: 'date' }, '2026-10-01', '2026-12-31')).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
    expect(occ('2026-01-31', { freq: 'month', every: 1, by: 'date' }, '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
  })
  it('ทุกเดือนวันพฤหัสสัปดาห์ที่ 3 และวันสุดท้ายของเดือน', () => {
    // 2026-10-15 = พฤหัสที่ 3 ของตุลาคม
    expect(occ('2026-10-15', { freq: 'month', every: 1, by: 'nth' }, '2026-10-01', '2026-12-31')).toEqual(['2026-10-15', '2026-11-19', '2026-12-17'])
    expect(occ('2026-10-31', { freq: 'month', every: 1, by: 'last' }, '2026-10-01', '2027-02-28')).toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'])
  })
  it('ทุกปี และทุก N วัน', () => {
    expect(occ('2024-12-25', { freq: 'year', every: 1 }, '2025-01-01', '2027-12-31')).toEqual(['2025-12-25', '2026-12-25', '2027-12-25'])
    expect(occ('2026-10-01', { freq: 'day', every: 10 }, '2026-10-01', '2026-10-31')).toEqual(['2026-10-01', '2026-10-11', '2026-10-21', '2026-10-31'])
  })
  it('สิ้นสุดตามวันที่/จำนวนครั้ง และยกเว้นบางวัน', () => {
    expect(occ('2026-10-01', { freq: 'day', every: 1, until: '2026-10-03' }, '2026-10-01', '2026-10-31')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    expect(occ('2026-10-01', { freq: 'day', every: 1, count: 3 }, '2026-10-02', '2026-10-31')).toEqual(['2026-10-02', '2026-10-03'])
    expect(occ('2026-10-01', { freq: 'day', every: 1, count: 3 }, '2026-10-01', '2026-10-31', ['2026-10-02'])).toEqual(['2026-10-01', '2026-10-03'])
  })
  it('ตัวเลือกสำเร็จรูป ↔ ชนิด และคำอธิบาย', () => {
    expect(kindOf(undefined, '2026-10-20')).toBe('none')
    expect(kindOf(presetRepeat('weekly', '2026-10-20'), '2026-10-20')).toBe('weekly')
    expect(kindOf({ freq: 'week', every: 1, days: [2, 4, 6] }, '2026-10-20')).toBe('custom')
    expect(describeRepeat({ freq: 'week', every: 1, days: [2, 4, 6], count: 5 }, '2026-10-20')).toBe('ทุกสัปดาห์ วันอังคาร, พฤหัสบดี, เสาร์ · 5 ครั้ง')
    expect(describeRepeat({ freq: 'month', every: 1, by: 'date' }, '2026-10-01')).toBe('ทุกเดือน วันที่ 1')
  })
  it('เลือกวันที่เองหลายวัน (23, 24, 25, 26) และยกเว้นบางวัน', () => {
    const ev = { date: '2026-10-23', extra: ['2026-10-24', '2026-10-25', '2026-10-26'], exdates: ['2026-10-25'] }
    expect(occurrences(ev, '2026-10-01', '2026-10-31')).toEqual(['2026-10-23', '2026-10-24', '2026-10-26'])
    expect(occurrences(ev, '2026-10-24', '2026-10-24')).toEqual(['2026-10-24'])
    expect(dateRange('2026-10-23', '2026-10-26')).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'])
    expect(describeDates('2026-10-23', ['2026-10-24', '2026-10-25', '2026-10-26'])).toBe('วันที่ 23–26 ต.ค. 69')
    expect(describeDates('2026-10-23', ['2026-10-25'])).toBe('วันที่ 23, 25 ต.ค. 69')
    expect(describeDates('2026-10-30', ['2026-11-02'])).toBe('30 ต.ค. 69, 2 พ.ย. 69')
  })
})
