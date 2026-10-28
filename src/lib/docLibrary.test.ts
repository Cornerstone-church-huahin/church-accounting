import { describe, expect, it } from 'vitest'
import { canSeeDoc, categoriesOf, filterDocs, nextDocNo, snippetOf, sortDocs, splitPages } from './docLibrary'
import type { DocItem } from './types'

const d = (id: string, title: string, category: string, no: string, date: string, extra: Partial<DocItem> = {}): DocItem => ({ id, updated: 1, title, category, kind: 'เชิญประชุม', no, date, access: 'ภายใน', draft: '', ...extra })
const docs = [d('a', 'เชิญประชุมกรรมการ', 'ประชุมกรรมการ', '002/2569', '2026-03-01'), d('b', 'รายงานประชุมกรรมการ', 'ประชุมกรรมการ', '010/2569', '2026-03-01', { kind: 'รายงานการประชุม' }), d('c', 'เชิญประชุมสามัญ', 'ประชุมสามัญประจำปี', '001/2569', '2026-01-15')]

describe('คลังเอกสารงานเลขา', () => {
  it('เลขที่ถัดไปนับต่อจากสูงสุดของปีนั้น (ปีอื่นไม่ปน)', () => {
    expect(nextDocNo(docs, 2569)).toBe('011/2569')
    expect(nextDocNo(docs, 2570)).toBe('001/2570')
    expect(nextDocNo([{ no: 'ไม่มีเลข' }], 2569)).toBe('001/2569')
  })
  it('เรียงจากเก่าไปใหม่: วันที่ แล้วเลขที่ตามตัวเลข (010 มาหลัง 002)', () => {
    expect(sortDocs(docs).map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })
  it('ค้นหาหลายคำต้องมีครบ + กรองหมวด + นับหมวด', () => {
    expect(filterDocs(docs, 'เชิญ กรรมการ', '').map((x) => x.id)).toEqual(['a'])
    expect(filterDocs(docs, '010', '').map((x) => x.id)).toEqual(['b'])
    expect(filterDocs(docs, '', 'ประชุมสามัญประจำปี').map((x) => x.id)).toEqual(['c'])
    expect(categoriesOf(docs)).toEqual([{ name: 'ประชุมกรรมการ', n: 2 }, { name: 'ประชุมสามัญประจำปี', n: 1 }])
  })
  it('ค้นหาจากเนื้อหา (ร่างและเอกสารจริงทุกฉบับ) + แสดงข้อความรอบคำที่เจอ', () => {
    const withBody = [d('x', 'หนังสือเชิญ', 'งานเลี้ยง', '003/2569', '2026-02-01', { draft: 'ขอเรียนเชิญร่วมงานเลี้ยงขอบคุณที่ห้องประชุมใหญ่ชั้นสอง' }), d('y', 'ประกาศ', 'ทั่วไป', '004/2569', '2026-02-02', { draft: 'x', finals: [{ v: 1, at: 1, by: 'a', no: '004/2569', date: '2026-02-02', title: 'ประกาศ', body: 'งดใช้ห้องมะเขือเทศชั่วคราว' }] })]
    expect(filterDocs(withBody, 'ห้องประชุมใหญ่', '').map((x) => x.id)).toEqual(['x'])
    expect(filterDocs(withBody, 'มะเขือเทศ', '').map((x) => x.id)).toEqual(['y'])
    expect(filterDocs(withBody, 'เชิญ ชั้นสอง', '').map((x) => x.id)).toEqual(['x'])
    expect(snippetOf(withBody[0], 'ชั้นสอง')).toContain('ชั้นสอง')
    expect(snippetOf(withBody[0], 'เชิญ')).toBe('')
  })
  it('ระดับเอกสาร: ทั่วไปทุกคน · ภายในแอดมิน/ผู้ทำงานเลขา · ลับเฉพาะแอดมิน', () => {
    const user = { admin: false, editor: false }, ed = { admin: false, editor: true }, ad = { admin: true, editor: true }
    expect([canSeeDoc('ทั่วไป', user), canSeeDoc('ภายใน', user), canSeeDoc('ภายใน', ed), canSeeDoc('ลับ', ed), canSeeDoc('ลับ', ad)]).toEqual([true, false, true, false, true])
  })
  it('แบ่งหน้า: ข้อความสั้น = 1 หน้า · ยาว = หลายหน้า ไม่ตัดกลางย่อหน้า', () => {
    expect(splitPages('สั้น ๆ').length).toBe(1)
    const long = Array.from({ length: 80 }, (_, i) => `บรรทัดที่ ${i + 1}`).join('\n')
    const pg = splitPages(long)
    expect(pg.length).toBeGreaterThan(2)
    expect(pg.join('\n')).toBe(long)
  })
})
