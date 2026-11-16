import { describe, expect, it } from 'vitest'
import { applyBackup, buildBackup, parseBackup } from './coordBackup'
import type { ChurchMember } from './types'

const m = (id: string, name: string, extra: Partial<ChurchMember> = {}): ChurchMember => ({ id, name, updated: 0, ...extra } as ChurchMember)
describe('coordBackup', () => {
  it('สำรองเฉพาะคนที่มีพิกัด', () => {
    const b = buildBackup([m('1', 'ก', { lat: 12.5, lng: 99.9 }), m('2', 'ข'), m('3', 'ค', { workLat: 1, workLng: 2, tel: '081' })], 1)
    expect(b.rows.map((r) => r.id)).toEqual(['1', '3'])
    expect(JSON.stringify(b)).not.toContain('081')
    expect(parseBackup(JSON.stringify(b))?.rows).toHaveLength(2); expect(parseBackup('x')).toBeNull()
  })
  it('กู้: เติมเฉพาะที่ยังว่าง ไม่ทับพิกัดเดิม จับคู่ id หรือชื่อไม่ซ้ำ', () => {
    const b = buildBackup([m('1', 'ก', { lat: 12.5, lng: 99.9 }), m('9', 'ง', { lat: 5, lng: 6 }), m('8', 'จ', { lat: 7, lng: 8 })], 1)
    const cur = [m('1', 'ก'), m('2', 'ง'), m('3', 'จ', { lat: 70, lng: 80 }), m('4', 'จ')]
    const r = applyBackup(cur, b)
    expect(r.updates.map((x) => [x.id, x.lat])).toEqual([['1', 12.5], ['2', 5]])
    expect(r.unmatched).toEqual(['จ']) // ชื่อซ้ำ 2 คน → ไม่เดา
    expect(r.filled).toBe(2)
  })
})
