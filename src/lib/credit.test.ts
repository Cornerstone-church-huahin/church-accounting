import { describe, expect, it } from 'vitest'
import { adjReportText } from './adjustReport'
import { APP_CREDIT, DOC_CREDIT, withDocCredit } from './credit'
import { reportText } from './serviceReport'

describe('เครดิตผู้พัฒนาระบบ (ค่ากลาง)', () => {
  it('ข้อความตรงตามกำหนด', () => {
    expect(APP_CREDIT).toBe('ออกแบบและพัฒนาระบบโดย มน.สมเจต เสมาทอง')
    expect(DOC_CREDIT).toBe('จัดพิมพ์ผ่านระบบที่ออกแบบและพัฒนาโดย มน.สมเจต เสมาทอง')
  })
  it('ต่อท้ายข้อความรายงานครั้งเดียว ไม่ซ้ำ', () => {
    const t = withDocCredit('บรรทัดหนึ่ง\n')
    expect(t).toBe(`บรรทัดหนึ่ง\n\n${DOC_CREDIT}`)
    const r = reportText({ date: '2026-10-18', total: 1, male: 1, female: 0, noGender: 0, complete: 1, reserve: 0, worshiper: 0, other: 0, newcomers: [] } as never)
    expect(r.split(DOC_CREDIT).length - 1).toBe(1)
    expect(r.endsWith(DOC_CREDIT)).toBe(true)
    const a = adjReportText({ title: 'ต', range: 'ช', matched: [], unknown: [], missing: [], cash: 0, out: 0 })
    expect(a.split(DOC_CREDIT).length - 1).toBe(1)
  })
})
