import { describe, expect, it } from 'vitest'
import { canSeeDoc, categoriesOf, filterDocs, nextDocNo, sortDocs, splitPages } from './docLibrary'
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
