import { describe, expect, it } from 'vitest'
import { filterGifts, rankDonors, parseImportText, checkImport, projectTotals, guessKind, isMonthlyGiver, missingMonths, missingWeeks, parseGiftLines } from './donorGifts'

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
  it('สวัสดิการผู้รับใช้', () => {
    expect(parseGiftLines('2030-01-06 10:00 10,000 welfare', '0000').rows[0].kind).toBe('welfare')
    expect(parseGiftLines('2030-01-06 10:00 10,000 สวัสดิการ', '0000').rows[0].kind).toBe('welfare')
  })
  it('โครงการ: parse #ชื่อ และสรุปยอด', () => {
    const r = parseGiftLines('2030-01-06 10:00 1,000 project #ค่าแอร์ ร่วมซื้อ', '0000').rows[0]
    expect(r).toMatchObject({ kind: 'project', project: 'ค่าแอร์', note: 'ร่วมซื้อ' })
    expect(projectTotals([{ kind: 'project', project: 'ค่าแอร์', amount: 100 }, { kind: 'project', project: 'ค่าแอร์', amount: 50 }, { kind: 'tithe', amount: 9 }])).toEqual([{ project: 'ค่าแอร์', n: 2, total: 150 }])
  })
  it('ตรวจไฟล์นำเข้า', () => {
    expect(checkImport({ gifts: [{ id: 'a', code: 'X1', date: '2030-01-06', amount: 100, kind: 'tithe' }] }).ok).toBe(true)
    expect(checkImport({ gifts: [{ id: 'a', code: 'X1', date: '2030-1-6', amount: 100, kind: 'tithe' }] }).ok).toBe(false)
    expect(checkImport({}).ok).toBe(false)
  })
  it('นำเข้าแบบวางทีละบรรทัด', () => {
    const r = parseImportText('EXT|X005|ไม่ระบุชื่อ\n0000|2030-01-06|1,000|tithe||\n0000|2030-01-06|1,000|tithe||\n0000|2030-02-06|500|project|ค่าแอร์|ร่วมซื้อ')
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.data.gifts.map((g) => g.id)).toEqual(['dg:0000:x:2030-01-06:100000:1', 'dg:0000:x:2030-01-06:100000:2', 'dg:0000:x:2030-02-06:50000:1']); expect(r.data.gifts[2]).toMatchObject({ kind: 'project', project: 'ค่าแอร์' }); expect(r.data.exts[0].code).toBe('X005') }
    expect(parseImportText('0000|2030-01-0').ok).toBe(false)
  })
  it('กรองและจัดอันดับผู้ถวาย', () => {
    const g = [
      { code: 'A', date: '2030-01-06', amount: 100, kind: 'weekly' as const }, { code: 'A', date: '2030-02-06', amount: 100, kind: 'weekly' as const },
      { code: 'B', date: '2030-01-10', amount: 900, kind: 'tithe' as const }, { code: 'C', date: '2030-03-01', amount: 50, kind: 'thanks' as const },
    ]
    const nm = (c: string) => `ชื่อ${c}`
    expect(rankDonors(g, nm, 'total').map((r) => r.code)).toEqual(['B', 'A', 'C'])
    expect(rankDonors(g, nm, 'count').map((r) => r.code)[0]).toBe('A')
    expect(rankDonors(g, nm, 'last').map((r) => r.code)).toEqual(['C', 'A', 'B'])
    expect(rankDonors(g, nm, 'total', false).map((r) => r.code)).toEqual(['C', 'A', 'B'])
    expect(filterGifts(g, { from: '2030-01-07', to: '2030-02-28' }).map((x) => x.code).sort()).toEqual(['A', 'B'])
    expect(filterGifts(g, { kinds: ['tithe'] })).toHaveLength(1)
  })
})
