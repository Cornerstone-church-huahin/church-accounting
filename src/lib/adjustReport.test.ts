import { describe, expect, it } from 'vitest'
import { adjOk, adjReportText, type AdjReport } from './adjustReport'

const base: AdjReport = { title: 'อาทิตย์ที่ 3 ของเดือนตุลาคม 2569', range: '12–18 ต.ค. 69', matched: [{ date: '2026-10-15', amount: 30000, label: 'ประจำสัปดาห์' }, { date: '2026-10-15', amount: 30000 }], unknown: [], missing: [], cash: 0, out: 0 }
describe('adjReportText', () => {
  it('ครบถ้วน', () => {
    const t = adjReportText(base)
    expect(adjOk(base)).toBe(true)
    expect(t).toContain('✅ ผลตรวจ: ตรงกันครบถ้วน')
    expect(t).toContain('ตรงกับที่บันทึกไว้ 2 รายการ (600.00)')
  })
  it('มีไม่ทราบที่มา', () => {
    const r = { ...base, unknown: [{ date: '2026-10-17', amount: 123400 }], closing: 283400 }
    const t = adjReportText(r)
    expect(adjOk(r)).toBe(false)
    expect(t).toContain('โอน (ไม่แจ้งวัตถุประสงค์) Unkonw 1 รายการ (1,234.00)')
    expect(t).toContain('ยอดคงเหลือท้ายสัปดาห์ 2,834.00')
  })
})
