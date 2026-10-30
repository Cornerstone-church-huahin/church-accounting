import { describe, expect, it } from 'vitest'
import { ageBands, ageYears, followUp, genderSplit, groupCounts, groupOf, headline, inGroup, joinYears, genderByStatus, orderByFrequency, attendanceInWindow, REG_PERIODS, orderByTenure, statusBreakdown, tenureDays, tenureText, orderMembers, recentServices, statusRank, visitStats, absence, STATUS_GROUPS } from './pastoral'
import { OFFICIAL_STATUSES, statusLabel, type Evaluated } from './registry'

describe('ข้อมูลสมาชิกสำหรับงานอภิบาล', () => {
  it('จัดกลุ่มสถานะตามเลขนำหน้าในทะเบียน (ช่องว่างในวงเล็บไม่มีผล)', () => {
    expect(groupOf('1.สมบูรณ์  ( 1 )')).toBe('complete')
    expect(groupOf('2.สมบูรณ์ ( 2 )')).toBe('complete')
    expect(groupOf('3.สมาชิกสำรอง')).toBe('reserve')
    // ลำดับใหม่: 4 = คนใหม่ · 5 = ผู้ร่วมนมัสการ — ข้อมูลเดิม (4.ผู้ร่วมนมัสการ / 5.คนใหม่) แปลงให้ตอนอ่าน
    expect(groupOf('4.คนใหม่')).toBe('newcomer'); expect(groupOf('5.ผู้ร่วมนมัสการ')).toBe('worship')
    expect(groupOf('4.ผู้ร่วมนมัสการ')).toBe('worship'); expect(groupOf('5.คนใหม่')).toBe('newcomer')
    expect(statusLabel('5.  คนใหม่')).toBe('4.คนใหม่'); expect(statusLabel('4.ผู้ร่วมนมัสการ')).toBe('5.ผู้ร่วมนมัสการ'); expect(statusRank('5.คนใหม่')).toBeLessThan(statusRank('4.ผู้ร่วมนมัสการ'))
    expect(OFFICIAL_STATUSES.slice(3, 5)).toEqual(['4.คนใหม่', '5.ผู้ร่วมนมัสการ']); expect(STATUS_GROUPS.map((g) => g.key).slice(3, 5)).toEqual(['newcomer', 'worship'])
    expect(groupOf('7.เสียชีวิต')).toBe('deceased')
    expect(groupOf('6.สิ้นสภาพสมาชิก')).toBe('resigned')
    expect(groupOf(undefined)).toBeUndefined()
    expect(inGroup({ status: '3.สมาชิกสำรอง' }, 'all')).toBe(true)
    expect(inGroup({ status: '3.สมาชิกสำรอง' }, 'complete')).toBe(false)
  })
  it('ตัวเลขสำคัญ', () => {
    const h = headline([{ status: '1.สมบูรณ์ ( 1 )' }, { status: '2.สมบูรณ์ ( 2 )' }, { status: '3.สมาชิกสำรอง' }, { status: '5.คนใหม่' }, { status: '5.คนใหม่' }, { status: '7.เสียชีวิต' }, {}])
    expect(h).toEqual({ total: 7, complete: 2, reserve: 1, worship: 0, newcomer: 2, resigned: 0, deceased: 1 })
  })
  it('ช่วงวัย: นับเฉพาะที่ทราบวันเกิด และบอกจำนวนที่ไม่ทราบ', () => {
    expect(ageYears('2000-10-22', '2026-10-21')).toBe(25)
    expect(ageYears('2000-10-21', '2026-10-21')).toBe(26)
    expect(ageYears('2030-01-01', '2026-10-21')).toBeUndefined()
    const r = ageBands([{ birth: '2020-01-01' }, { birth: '2010-05-05' }, { birth: '1990-01-01' }, { birth: '1970-01-01' }, { birth: '1940-01-01' }, {}, { birth: 'x' }], '2026-10-21')
    expect(r.bands.map((b) => b.count)).toEqual([1, 1, 1, 1, 1])
    expect(r).toMatchObject({ known: 5, unknown: 2 })
  })
  it('เพศ กลุ่ม ปีที่เข้าเป็นสมาชิก', () => {
    expect(genderSplit([{ gender: 'ชาย' }, { gender: 'หญิง' }, { gender: 'หญิง' }, {}])).toEqual({ ชาย: 1, หญิง: 2, ไม่ระบุ: 1 })
    expect(groupCounts([{ group: '4.สตรี' }, { group: '4.สตรี' }, { group: '5.บรุษ' }, { group: '7.ไม่มีกลุ่ม' }, {}])).toEqual([['สตรี', 2], ['บุรุษ', 1], ['ไม่มีกลุ่ม', 2]])
    expect(joinYears([{ since: '2024-03-01' }, { since: '2022-01-01' }, { since: '2024-12-01' }, {}])).toEqual([{ year: 2022, count: 1 }, { year: 2024, count: 2 }])
  })
  it('แนวโน้มยอดผู้มา: n ครั้งล่าสุด เรียงเก่า→ใหม่', () => {
    expect(recentServices([{ date: '2026-10-18', count: 9 }, { date: '2026-10-11', count: 8 }, { date: '2026-10-04', count: 7 }], 2)).toEqual([{ date: '2026-10-11', count: 8 }, { date: '2026-10-18', count: 9 }])
  })
  it('คนที่ควรติดตาม: เฉพาะสมาชิกสมบูรณ์ (1+2) ที่ขาดเกินกำหนด · ขาดนานสุดก่อน · ไม่นับสถานะอื่นหรือคนที่ไม่เคยมีบันทึก', () => {
    const row = (id: string, status: string, idleDays: number | null, noRecord = false): Evaluated => ({ member: { id, name: id, status, updated: 1 }, idleDays, noRecord, last: '2026-01-01' } as unknown as Evaluated)
    const rows = [row('a', '1.สมบูรณ์ ( 1 )', 40), row('b', '3.สมาชิกสำรอง', 100), row('c', '7.เสียชีวิต', 200), row('d', '5.คนใหม่', 10), row('e', '4.ผู้ร่วมนมัสการ', 300), row('f', '1.สมบูรณ์ ( 1 )', 20), row('g', '2.สมบูรณ์  ( 2 )', 90), row('h', '2.สมบูรณ์ ( 2 )', null, true)]
    expect(followUp(rows, 4).map((x) => x.id)).toEqual(['g', 'a'])
    expect(followUp(rows, 8).map((x) => x.id)).toEqual(['g'])
    expect(followUp(rows, 26)).toEqual([])
  })
})

describe('เรียงสมาชิกตามการมานมัสการ (1 ปี) และการขาด', () => {
  const T = '2026-10-23'
  const att = [
    { date: '2026-10-18', ids: ['a', 'b'] }, { date: '2026-10-11', ids: ['b', 'a', 'a'] }, { date: '2026-10-04', ids: ['b'] },
    { date: '2026-06-01', ids: ['c'] }, { date: '2026-02-01', ids: ['d'] }, { date: '2025-01-05', ids: ['e', 'x'] }, { date: '2023-01-01', ids: ['f'] },
    { date: '2026-10-18', ids: ['b'], deleted: true },
  ]
  const ms = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => ({ id, name: id, status: '1.สมบูรณ์ ( 1 )' })).concat([{ id: 'x', name: 'x', status: '7.เสียชีวิต' }])
  it('นับครั้งใน 1 ปีและวันล่าสุด ไม่นับรายการที่ยกเลิก', () => {
    const st = visitStats(att, T)
    expect(st.get('b')).toEqual({ recent: 3, total: 3, last: '2026-10-18' })
    expect(st.get('a')?.recent).toBe(2)
    expect(st.get('e')?.recent).toBe(0)
  })
  it('ระดับการขาดตามช่วงเวลา', () => {
    expect(absence('2026-10-18', T).tier).toBe(0)
    expect(absence('2026-06-01', T)).toMatchObject({ tier: 1, label: 'ขาดเกิน 3 เดือน' })
    expect(absence('2026-02-01', T).label).toBe('ขาดเกิน 6 เดือน')
    expect(absence('2025-08-01', T).label).toBe('ขาดเกิน 1 ปี')
    expect(absence('2025-03-01', T).label).toBe('ขาดเกิน 1 ปีครึ่ง')
    expect(absence('2024-10-01', T).label).toBe('ขาดเกิน 2 ปี')
    expect(absence('2023-01-01', T).label).toBe('ขาดเกิน 2 ปี')
    expect(absence(undefined, T).label).toBe('ไม่เคยมีบันทึกการมา')
  })
  it('ค่าเริ่มต้น: มาบ่อยก่อน แล้วขาดน้อย→มาก ไม่เคยมา/สิ้นสภาพอยู่ท้าย', () => {
    const st = visitStats(att, T)
    expect(orderMembers(ms, 'default', st, T).map((m) => m.id)).toEqual(['b', 'a', 'c', 'd', 'e', 'f', 'g', 'h', 'x'])
    expect(orderMembers(ms, 'asc', st, T).map((m) => m.id)[0]).toBe('x')
    expect(orderMembers(ms, 'status', st, T).map((m) => m.id).at(-1)).toBe('x')
    expect(statusRank(undefined)).toBe(9)
  })
})

describe('แท็บเก่าแก่ · สม่ำเสมอ · สถานะ · เพศ', () => {
  const T = '2026-10-23'
  it('อายุการเป็นสมาชิก: ใช้วันที่เข้า ไม่มีก็ใช้วันมาครั้งแรก', () => {
    expect(tenureDays('2016-10-23', undefined, T)).toBe(3652)
    expect(tenureDays(undefined, '2026-01-01', T)).toBe(295)
    expect(tenureDays(undefined, undefined, T)).toBeNull()
    expect(tenureText(3652)).toBe('10 ปี')
    expect(tenureText(400)).toBe('1 ปี 1 เดือน')
    expect(tenureText(75)).toBe('2 เดือน')
    expect(tenureText(null)).toBe('ไม่ทราบวันที่เข้า')
  })
  it('เรียงเก่าแก่ก่อน (ไม่ทราบอยู่ท้าย) และเรียงตามเปอร์เซ็นต์การมา', () => {
    const ms = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id }))
    const d: Record<string, number | null> = { a: 100, b: 5000, c: null, d: 2000 }
    expect(orderByTenure(ms, (id) => d[id], true).map((m) => m.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(orderByTenure(ms, (id) => d[id], false).map((m) => m.id)).toEqual(['a', 'd', 'b', 'c'])
    // ความสม่ำเสมอ = จำนวนครั้งที่มาใน 1 ปี: ยิ่งมากยิ่งสม่ำเสมอ (มา 2/2 ครั้ง ไม่ชนะคนที่มา 45 ครั้ง)
    const t: Record<string, number> = { a: 2, b: 45, c: 48, d: 2 }
    expect(orderByFrequency(ms, (id) => t[id]).map((m) => m.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(orderByFrequency(ms, (id) => t[id], false).map((m) => m.id)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('นับตามสถานะเรียงจากดีที่สุด และเพศแยกตามสถานะ', () => {
    const ms = [{ status: '2.สมบูรณ์ ( 2 )', gender: 'หญิง' }, { status: '1.สมบูรณ์ ( 1 )', gender: 'ชาย' }, { status: '1.สมบูรณ์ ( 1 )', gender: 'หญิง' }, { status: '7.เสียชีวิต' }, { gender: 'ชาย' }]
    expect(statusBreakdown(ms).map((r) => [r.label, r.count])).toEqual([['1.สมบูรณ์ ( 1 )', 2], ['2.สมบูรณ์ ( 2 )', 1], ['7.เสียชีวิต', 1], ['(ไม่ระบุสถานะ)', 1]])
    expect(genderByStatus(ms)[0]).toMatchObject({ ชาย: 1, หญิง: 1, ไม่ระบุ: 0 })
  })
})

import { absenceBar, absentMonths, visitCandidates } from './pastoral'
describe('ตารางเยี่ยม: รายชื่อที่ขาด + แถบ % 1/2/3 เดือน', () => {
  const T = '2026-10-28'
  const att = [
    { date: '2026-10-25', ids: ['a'] }, { date: '2026-10-18', ids: ['a'] }, { date: '2026-10-11', ids: ['a'] }, { date: '2026-10-04', ids: ['a'] },
    { date: '2026-09-27', ids: ['a'] }, { date: '2026-09-20', ids: ['b'] }, { date: '2026-09-13', ids: ['b'] }, { date: '2026-08-30', ids: ['b'] },
  ].map((x) => ({ ...x, updated: 0, id: x.date }))
  const stats = visitStats(att, T)
  const ms = [
    { id: 'a', name: 'เอ', status: '1.สมบูรณ์ ( 1 )' }, { id: 'b', name: 'บี', status: '1.สมบูรณ์ ( 1 )' },
    { id: 'c', name: 'ซี', status: '3.สมาชิกสำรอง' }, { id: 'd', name: 'ดี', status: '6.ลาออก' },
  ]
  it('ไม่ค้นหา: เฉพาะคนที่ขาด ≥ 1 เดือน เรียงขาดน้อย→มาก ไม่เคยมีบันทึกอยู่ท้าย ไม่นับคนที่ลาออก', () => {
    expect(visitCandidates(ms, { status: [], q: '' }, stats, T).map((m) => m.id)).toEqual(['b', 'c'])
    expect(visitCandidates(ms, { status: ['3.สมาชิกสำรอง'], q: '' }, stats, T).map((m) => m.id)).toEqual(['c'])
    expect(visitCandidates(ms, { status: ['3.สมาชิกสำรอง', '1.สมบูรณ์ ( 1 )'], q: '' }, stats, T).map((m) => m.id)).toEqual(['b', 'c'])
  })
  it('พิมพ์ค้นหา: เห็นทุกคนที่ตรงชื่อ แม้ไม่ได้ขาด', () => {
    expect(visitCandidates(ms, { status: [], q: 'เอ' }, stats, T).map((m) => m.id)).toEqual(['a'])
  })
  it('เดือนที่ขาด', () => { expect(absentMonths('2026-08-30', T)).toBe(1); expect(absentMonths('2026-10-18', T)).toBe(0); expect(absentMonths(undefined, T)).toBeNull() })
  it('แถบสีแดงยาวขึ้นตามเดือนที่ขาด', () => { expect(absenceBar(1)).toBeCloseTo(1 / 12); expect(absenceBar(6)).toBe(0.5); expect(absenceBar(30)).toBe(1); expect(absenceBar(null)).toBe(1) })
  it('ความสม่ำเสมอตามช่วงเวลา: นับครั้งที่มาในช่วง และตัวหาร = ครั้งนมัสการที่มีบันทึกในช่วงนั้น', () => {
    const T = '2026-10-30'
    const att = [
      { date: '2026-10-25', ids: ['a', 'b'] }, { date: '2026-10-18', ids: ['a'] }, { date: '2026-08-02', ids: ['a', 'b'] },
      { date: '2025-12-01', ids: ['a'] }, { date: '2024-06-02', ids: ['a', 'b'] }, { date: '2020-01-05', ids: ['a'] },
    ]
    const w = (d: number) => attendanceInWindow(att, T, d)
    expect(REG_PERIODS.map((p) => p.k)).toEqual(['3y', '2y', '1y', '6m', '3m', '2m', '1m'])
    expect(REG_PERIODS.map((p) => p.days)).toEqual([1095, 730, 365, 183, 91, 61, 30])
    expect(w(91).services).toBe(3); expect(w(91).times.get('a')).toBe(3); expect(w(91).times.get('b')).toBe(2)
    expect(w(365).services).toBe(4); expect(w(365).times.get('a')).toBe(4)
    expect(w(1095).services).toBe(5); expect(w(1095).times.get('b')).toBe(3) // 2020 อยู่นอกช่วง 3 ปี
  })
})
