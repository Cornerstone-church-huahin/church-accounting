import { describe, expect, it } from 'vitest'
import { guessKind, isMonthlyGiver, missingMonths, missingWeeks, parseGiftLines } from './donorGifts'

// ข้อมูลทดสอบเป็นค่าสมมติทั้งหมด (ห้ามใส่ข้อมูลสลิป/ผู้ถวายจริงในรีโปสาธารณะ)
describe('donorGifts', () => {
  it('parse: วางหลายบรรทัด', () => {
    const r = parseGiftLines('2030-01-06 10:05 300 weekly REF0000000001\n2030-01-13 9:30 5,000 อาคาร REF0000000002 หมายเหตุทดสอบ\n2030-01-20 เสีย', '0000')
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ code: '0000', date: '2030-01-06', time: '10:05', amount: 30000, kind: 'weekly', ref: 'REF0000000001' })
    expect(r.rows[1]).toMatchObject({ time: '09:30', amount: 500000, kind: 'building', note: 'หมายเหตุทดสอบ' })
    expect(r.errors).toHaveLength(1)
  })
  it('parse: เลขที่รายการตกลงบรรทัดใหม่ตอนคัดลอก ต่อกลับให้', () => {
    const r = parseGiftLines('2030-01-06 10:05 300 weekly\nREF0000000001\n2030-01-13 11:00 500 tithe\nREF0000000002', '0000')
    expect(r.errors).toEqual([])
    expect(r.rows.map((x) => x.ref)).toEqual(['REF0000000001', 'REF0000000002'])
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
  it('ผู้ถวายรายเดือน: ตรวจเป็นเดือน', () => {
    const g = ['2030-01-31', '2030-02-28', '2030-04-30'].map((date) => ({ date, kind: 'tithe' as const }))
    expect(isMonthlyGiver(g)).toBe(true)
    expect(missingMonths(g, '2030-05-10')).toEqual(['2030-03'])
    const w = ['2030-01-06', '2030-01-13', '2030-01-20', '2030-01-27'].map((date) => ({ date, kind: 'weekly' as const }))
    expect(isMonthlyGiver(w)).toBe(false)
  })
  it('ผู้ถวายขอบพระคุณทุกสัปดาห์: ใช้ขอบพระคุณตรวจสัปดาห์ที่ขาด', () => {
    const g = [{ date: '2030-01-06', kind: 'thanks' as const }, { date: '2030-01-20', kind: 'thanks' as const }]
    expect(missingWeeks(g, '2030-01-21')).toEqual(['2030-01-13'])
  })
})
