import { describe, expect, it } from 'vitest'
import { guessKind, missingWeeks, parseGiftLines } from './donorGifts'

// ข้อมูลทดสอบเป็นค่าสมมติทั้งหมด (ห้ามใส่ข้อมูลสลิป/ผู้ถวายจริงในรีโปสาธารณะ)
describe('donorGifts', () => {
  it('parse: วางหลายบรรทัด', () => {
    const r = parseGiftLines('2030-01-06 10:05 300 weekly REF0000000001\n2030-01-13 9:30 5,000 อาคาร REF0000000002 หมายเหตุทดสอบ\nเสีย', '0000')
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ code: '0000', date: '2030-01-06', time: '10:05', amount: 30000, kind: 'weekly', ref: 'REF0000000001' })
    expect(r.rows[1]).toMatchObject({ time: '09:30', amount: 500000, kind: 'building', note: 'หมายเหตุทดสอบ' })
    expect(r.errors).toHaveLength(1)
  })
  it('สิบลดนับเป็นถวายประจำ', () => {
    expect(parseGiftLines('2030-01-06 10:00 1,000 สิบลด', '0000').rows[0].kind).toBe('tithe')
    expect(missingWeeks([{ date: '2030-01-06', kind: 'weekly' as const }, { date: '2030-01-13', kind: 'tithe' as const }], '2030-01-14')).toEqual([])
  })
  it('guessKind', () => { expect(guessKind(30000)).toBe('weekly'); expect(guessKind(50000)).toBe('thanks') })
  it('missingWeeks: อาทิตย์ที่ไม่มีประจำสัปดาห์', () => {
    const g = [{ date: '2030-01-06', kind: 'weekly' as const }, { date: '2030-01-20', kind: 'weekly' as const }, { date: '2030-01-27', kind: 'thanks' as const }]
    expect(missingWeeks(g, '2030-01-28')).toEqual(['2030-01-13', '2030-01-27'])
  })
})
