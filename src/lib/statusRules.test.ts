import { describe, expect, it } from 'vitest'
import { monthsBetween, proposeStatusMoves } from './statusRules'
import type { Attendance, ChurchMember } from './types'

const T = '2026-10-31'
const m = (o: Partial<ChurchMember>) => ({ id: 'x', updated: 1, name: 'ก', ...o }) as ChurchMember
const att = (date: string, ...ids: string[]): Attendance => ({ id: date, updated: 1, date, ids })

describe('statusRules', () => {
  it('เดือนเต็ม', () => {
    expect(monthsBetween('2026-07-31', T)).toBe(3)
    expect(monthsBetween('2026-08-01', T)).toBe(2)
    expect(monthsBetween('2025-10-31', T)).toBe(12)
  })
  it('คนใหม่ที่มา ≥ 3 เดือนและยังมาอยู่ → ผู้ร่วมนมัสการ (รับสถานะเก่าที่มีเลขนำหน้าด้วย)', () => {
    const r = proposeStatusMoves([m({ id: 'a', status: 'คนใหม่' }), m({ id: 'b', status: '5.คนใหม่' })], [att('2026-07-26', 'a', 'b'), att('2026-10-25', 'a')], T)
    expect(r.map((x) => [x.m.id, x.to])).toEqual([['a', 'ผู้ร่วมนมัสการ']])   // b ไม่มาเกิน 90 วัน
  })
  it('คนใหม่ที่มาไม่ถึง 3 เดือน ไม่เปลี่ยน · ไม่มีข้อมูลการมา ไม่เปลี่ยน', () => {
    expect(proposeStatusMoves([m({ id: 'a', status: 'คนใหม่' }), m({ id: 'z', status: 'คนใหม่' })], [att('2026-09-06', 'a'), att('2026-10-25', 'a')], T)).toEqual([])
  })
  it('นับจากวันมาครั้งแรกที่สมาชิกระบุ ถ้าเก่ากว่าบันทึกในระบบ', () => {
    const r = proposeStatusMoves([m({ id: 'a', status: 'คนใหม่', firstWorship: '2026-01-04' })], [att('2026-10-25', 'a')], T)
    expect(r.map((x) => x.to)).toEqual(['ผู้ร่วมนมัสการ'])
  })
  it('ผู้ร่วมนมัสการต่อเนื่องเกิน 1 ปี → สมาชิกสำรอง · นับจากวันที่เปลี่ยนสถานะถ้ารู้', () => {
    const a = [att('2024-07-07', 'a', 'b', 'c'), att('2026-10-25', 'a', 'b', 'c')]
    const r = proposeStatusMoves([
      m({ id: 'a', status: 'ผู้ร่วมนมัสการ' }),                        // ครั้งแรก 2024-07 + 3 เดือน → เกิน 1 ปีแล้ว
      m({ id: 'b', status: 'ผู้ร่วมนมัสการ', statusAt: '2026-06-01' }), // เพิ่งเปลี่ยนเมื่อ 5 เดือนก่อน → ยังไม่ครบ
      m({ id: 'c', status: 'สมบูรณ์ ( 1 )' }),                          // สถานะอื่นไม่แตะ
    ], a, T)
    expect(r.map((x) => [x.m.id, x.to])).toEqual([['a', 'สมาชิกสำรอง']])
  })
})
