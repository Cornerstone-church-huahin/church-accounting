import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_RULES, frequency, monthsBetween, proposeStatusMoves, statusRuleWarnings } from './statusRules'
import type { Attendance, ChurchMember } from './types'

const T = '2026-10-31'
const m = (o: Partial<ChurchMember>) => ({ id: 'x', updated: 1, name: 'ก', ...o }) as ChurchMember
const att = (date: string, ...ids: string[]): Attendance => ({ id: date, updated: 1, date, ids })
/** วันอาทิตย์ย้อนหลัง n สัปดาห์ (นับจาก 25 ต.ค. 2026) */
const sun = (n: number) => { const d = new Date(Date.UTC(2026, 9, 25)); d.setUTCDate(d.getUTCDate() - 7 * n); return d.toISOString().slice(0, 10) }
/** บันทึกลงชื่อของทุกวันอาทิตย์ย้อนหลัง weeks สัปดาห์ (คนที่อยู่ใน ids เฉพาะวันที่ที่ระบุ) */
const services = (weeks: number, who: Record<string, number[]>): Attendance[] =>
  Array.from({ length: weeks }, (_, n) => att(sun(n), ...Object.entries(who).filter(([, ns]) => ns.includes(n)).map(([id]) => id), 'other'))

describe('statusRules', () => {
  it('เดือนเต็ม + ความถี่', () => {
    expect(monthsBetween('2026-07-31', T)).toBe(3)
    expect(monthsBetween('2026-08-01', T)).toBe(2)
    const f = frequency([sun(0), sun(1), sun(5), sun(40)], T, 3)
    expect(f.visits).toBe(3)
    expect(f.monthsPresent).toBe(2)
    expect(f.lastDays).toBe(6)
  })
  it('คนใหม่ → ผู้ร่วมนมัสการ: ต้องมาถี่พอ (ไม่ใช่แค่ผ่านไป 3 เดือน)', () => {
    const wk = Array.from({ length: 14 }, (_, i) => i)   // มาทุกสัปดาห์ 14 สัปดาห์
    const r = proposeStatusMoves(
      [m({ id: 'a', status: 'คนใหม่' }), m({ id: 'b', status: '5.คนใหม่' }), m({ id: 'c', status: 'คนใหม่' })],
      services(16, { a: wk, b: [0, 13], c: [0, 1, 2, 3, 4, 5, 6] }), T)   // b = มาแค่ 2 ครั้งห่างกัน · c = มาถี่แต่ไม่ถึง 3 เดือนเต็ม (เดือนแรกไม่มา)
    expect(r.map((x) => [x.m.id, x.to])).toEqual([['a', 'ผู้ร่วมนมัสการ']])
    expect(r[0].why).toMatch(/มา \d+ ครั้ง ใน 3 เดือน \(จาก 3\) · ครั้งล่าสุด 6 วันที่แล้ว/)
  })
  it('ครั้งล่าสุดเกิน 30 วัน ไม่ผ่าน', () => {
    const wk = Array.from({ length: 10 }, (_, i) => i + 7)   // มาถี่ก่อนหน้า แต่หายไป 7 สัปดาห์แล้ว
    expect(proposeStatusMoves([m({ id: 'a', status: 'คนใหม่' })], services(18, { a: wk }), T)).toEqual([])
  })
  it('ข้อมูลลงชื่อไม่ครอบคลุมช่วงที่วัด → ยังไม่ตัดสิน (กันคนมาจริงแต่ไม่มีบันทึกย้อนหลัง)', () => {
    expect(proposeStatusMoves([m({ id: 'a', status: 'คนใหม่' })], services(6, { a: [0, 1, 2, 3, 4, 5] }), T)).toEqual([])   // ระบบเริ่มบันทึก 6 สัปดาห์ก่อน
  })
  it('ผู้ร่วมนมัสการ → สมาชิกสำรอง: ต้องต่อเนื่องเกิน 12 เดือนและมา ≥ 18 ครั้ง ≥ 9 เดือน', () => {
    const every2 = Array.from({ length: 40 }, (_, i) => i * 2)    // มาทุกสองสัปดาห์ นาน ~78 สัปดาห์ (≈ 18 เดือน)
    const sparse = [0, 70]                                         // มา 2 ครั้งห่างกัน (ครั้งแรกนานแล้ว)
    const r = proposeStatusMoves(
      [m({ id: 'a', status: 'ผู้ร่วมนมัสการ' }), m({ id: 'b', status: 'ผู้ร่วมนมัสการ' }), m({ id: 'c', status: 'ผู้ร่วมนมัสการ', statusAt: '2026-06-01' })],
      services(90, { a: every2, b: sparse, c: every2 }), T)
    expect(r.map((x) => [x.m.id, x.to])).toEqual([['a', 'สมาชิกสำรอง']])   // b มาน้อย · c เพิ่งเปลี่ยนสถานะ
  })
  it('ปรับเกณฑ์ได้: ลดจำนวนครั้ง/เดือน', () => {
    const wk = [0, 4, 8, 14]   // มาครั้งแรกเมื่อ 14 สัปดาห์ก่อน (ครบ 3 เดือน) แต่มาห่างๆ: 3 ครั้งใน 3 เดือนล่าสุด
    const base = services(16, { a: wk })
    expect(proposeStatusMoves([m({ id: 'a', status: 'คนใหม่' })], base, T)).toEqual([])
    expect(proposeStatusMoves([m({ id: 'a', status: 'คนใหม่' })], base, T, { ...DEFAULT_STATUS_RULES, newVisits: 3 }).map((x) => x.to)).toEqual(['ผู้ร่วมนมัสการ'])
  })
  it('เตือนเกณฑ์ที่ไม่สมเหตุสมผล', () => {
    expect(statusRuleWarnings(DEFAULT_STATUS_RULES)).toEqual([])
    expect(statusRuleWarnings({ ...DEFAULT_STATUS_RULES, newMonthsPresent: 5 }).join()).toContain('ไม่มีใครผ่านได้')
  })
})
