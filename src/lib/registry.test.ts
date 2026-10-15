import { describe, expect, it } from 'vitest'
import { bandOf, cutoffOf, evaluate, matchNames, parseAttendanceRows, parseDateCell, parseMemberRows, summarize, DEFAULT_CRITERIA } from './registry'
import type { Attendance, ChurchMember } from './types'

const m = (id: string, o: Partial<ChurchMember> = {}): ChurchMember => ({ id, name: id, updated: 1, since: '2015-01-04', ...o })
const att = (date: string, ...ids: string[]): Attendance => ({ id: date, date, ids, updated: 1 })
const TODAY = '2026-10-15'
// อาทิตย์ทุกสัปดาห์ ม.ค.–ต.ค. 2026 · ใครมาตามรายชื่อ
const sundays = ['2026-01-04', '2026-02-01', '2026-05-03', '2026-08-02', '2026-10-04']

describe('evaluate', () => {
  it('splits complete-1 / complete-2 / pending / dead', () => {
    const members = [m('a'), m('b'), m('c', { since: '2026-06-01' }), m('d', { status: 'เสียชีวิต' }), m('e', { status: 'สิ้นสภาพ' })]
    const a = [att(sundays[0], 'a', 'b', 'd'), att(sundays[1], 'a', 'b'), att(sundays[2], 'a'), att(sundays[3], 'a'), att(sundays[4], 'a', 'c')]
    const { rows } = evaluate(members, a, DEFAULT_CRITERIA, TODAY)
    const tier = Object.fromEntries(rows.map((r) => [r.member.id, r.tier]))
    expect(tier).toEqual({ a: 0, b: 5, c: 6, d: 3, e: 2 })
  })
  it('absence cutoff is months back from today and inclusive', () => {
    expect(cutoffOf('2026-10-15', 6)).toBe('2026-04-15')
    expect(cutoffOf('2026-08-31', 6)).toBe('2026-02-28')
    const on = evaluate([m('a')], [att('2026-04-15', 'a')], DEFAULT_CRITERIA, TODAY).rows[0]
    const before = evaluate([m('a')], [att('2026-04-14', 'a')], DEFAULT_CRITERIA, TODAY).rows[0]
    expect([on.tier, before.tier]).toEqual([0, 5])
  })
  it('override wins over computed tier', () => {
    const { rows } = evaluate([m('a', { override: 'removed' })], [att('2026-10-04', 'a')], DEFAULT_CRITERIA, TODAY)
    expect([rows[0].tier, rows[0].baseTier]).toEqual([4, 0])
  })
  it('never-seen member idles from membership date (or first record if later data starts later)', () => {
    const { rows } = evaluate([m('a', { since: '2020-01-05' })], [att('2026-01-04', 'x')], DEFAULT_CRITERIA, TODAY)
    expect(rows[0].noRecord).toBe(true)
    expect(rows[0].idleDays).toBe(284) // นับจากวันแรกที่มีข้อมูล ไม่ใช่ปี 2020 ที่ไม่มีข้อมูลให้เทียบ
    expect(bandOf(rows[0])).toBe(0)
  })
  it('ignores deleted and empty attendance, dedupes repeated ids', () => {
    const a = [{ ...att('2026-10-04', 'a'), deleted: true }, att('2026-10-11'), att('2026-09-27', 'a', 'a')]
    const r = evaluate([m('a')], a, DEFAULT_CRITERIA, TODAY)
    expect(r.rows[0].visits).toBe(1)
    expect(r.services).toEqual(['2026-09-27'])
  })
  it('summarizes counts and bands', () => {
    const { rows } = evaluate([m('a'), m('b'), m('c')], [att('2026-10-04', 'a'), att('2023-10-01', 'b')], DEFAULT_CRITERIA, TODAY)
    const s = summarize(rows)
    expect(s.byTier[0]).toBe(1)
    expect(s.complete).toBe(3)
    expect(s.bands.reduce((x, y) => x + y, 0)).toBe(2)
    expect(s.records).toBe(2)
  })
})

describe('import', () => {
  it('parses date formats incl. พ.ศ. and rejects invalid', () => {
    expect(parseDateCell('2026-10-04')).toBe('2026-10-04')
    expect(parseDateCell('4/10/2569')).toBe('2026-10-04')
    expect(parseDateCell('31/02/2026')).toBe('')
    expect(parseDateCell('abc')).toBe('')
  })
  it('reads member csv by header names, skipping blank-name rows', () => {
    const r = parseMemberRows([['ชื่อ-สกุล', 'ชื่อเล่น', 'เข้าเป็นสมาชิก', 'สถานะ'], ['สมชาย ใจดี', 'ชาย', '1/1/2550', 'สมาชิกสมบูรณ์'], ['', 'x', '', ''], ['', '', '', '']])!
    expect(r.members).toEqual([{ name: 'สมชาย ใจดี', nick: 'ชาย', since: '2007-01-01', status: 'สมาชิกสมบูรณ์' }])
    expect(r.skipped).toBe(1)
    expect(parseMemberRows([['foo']])).toBeNull()
  })
  it('groups attendance rows by date and matches names without guessing duplicates', () => {
    const r = parseAttendanceRows([['วันที่', 'ชื่อ'], ['2026-10-04', 'ก'], ['2026-10-04', 'ข'], ['bad', 'ค']])!
    expect(r.byDate.get('2026-10-04')).toEqual(['ก', 'ข']); expect(r.bad).toBe(1)
    const ms = [m('1', { name: 'ก' }), m('2', { name: 'ข ' }), m('3', { name: 'ข' })]
    expect(matchNames(['ก', 'ข', 'ซ'], ms)).toEqual({ ids: ['1'], unknown: ['ซ'], ambiguous: ['ข'] })
  })
})
