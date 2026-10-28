import { describe, expect, it } from 'vitest'
import { canSeeDoc, categoriesOf, cleanPrefix, renumberWithPrefix, filterDocs, fileExt, fmtSize, nextDocNo, snippetOf, sortDocs, sortNewestFirst, titleFromFile } from './docLibrary'
import type { DocItem } from './types'

const d = (id: string, title: string, category: string, no: string, date: string, extra: Partial<DocItem> = {}): DocItem => ({ id, updated: 1, title, category, no, date, access: 'ภายใน', ...extra })
const docs = [d('a', 'เชิญประชุมกรรมการ', 'ประชุมกรรมการ', '002/2569', '2026-03-01'), d('b', 'รายงานประชุมกรรมการ', 'ประชุมกรรมการ', '010/2569', '2026-03-01'), d('c', 'เชิญประชุมสามัญ', 'ประชุมสามัญประจำปี', '001/2569', '2026-01-15')]

describe('คลังเอกสารงานเลขา (ไฟล์สำเร็จรูป)', () => {
  it('เลขที่ถัดไปนับต่อจากสูงสุดของปีนั้น', () => {
    expect(nextDocNo(docs, 2569)).toBe('011/2569')
    expect(nextDocNo(docs, 2570)).toBe('001/2570')
  })
  it('เลขที่ตามตัวย่อของหมวด: ปศอ.001 นับต่อ · แต่ละตัวย่อแยกกัน · ตัวย่อมีจุดท้ายก็ได้', () => {
    const w = [d('1', 'ก', 'ประชุมธรรมกิจ', 'ปศอ.001', '2026-01-01'), d('2', 'ข', 'ประชุมธรรมกิจ', 'ปศอ.002', '2026-01-02'), d('3', 'ค', 'หนังสือเชิญ', 'ชศอ.001', '2026-01-03'), d('4', 'ง', 'x', '5/2569', '2026-01-04')]
    expect(nextDocNo(w, 'ปศอ')).toBe('ปศอ.003')
    expect(nextDocNo(w, 'ปศอ.')).toBe('ปศอ.003')
    expect(nextDocNo(w, 'ชศอ')).toBe('ชศอ.002')
    expect(nextDocNo(w, 'ภศอ')).toBe('ภศอ.001')
    expect(nextDocNo(w, '')).toBe('001/0')
    expect(cleanPrefix(' ปศอ. ')).toBe('ปศอ')
  })
  it('ลบฉบับล่าสุดแล้วสร้างใหม่ ได้เลขเดิมซ้ำ (เลข 3 ถูกลบ → ฉบับใหม่เป็น 3)', () => {
    const w = [d('1', 'ก', 'c', 'ปศอ.001', '2026-01-01'), d('2', 'ข', 'c', 'ปศอ.002', '2026-01-02'), d('3', 'ค', 'c', 'ปศอ.003', '2026-01-03')]
    expect(nextDocNo(w, 'ปศอ')).toBe('ปศอ.004')
    expect(nextDocNo(w.slice(0, 2), 'ปศอ')).toBe('ปศอ.003')
  })
  it('เปลี่ยนตัวย่อ: เลขลำดับคงเดิม · เลขอื่นไม่แตะ', () => {
    expect(renumberWithPrefix('ปศอ.002', 'ปศอ', 'นอสออ')).toBe('นอสออ.002')
    expect(renumberWithPrefix('ชศอ.002', 'ปศอ', 'นอสออ')).toBe('ชศอ.002')
    expect(renumberWithPrefix('001/2569', 'ปศอ', 'นอสออ')).toBe('001/2569')
    expect(renumberWithPrefix('ปศอ.002', 'ปศอ', '')).toBe('ปศอ.002')
  })
  it('เรียงเก่า→ใหม่ และใหม่สุดอยู่บน (010 ใหม่กว่า 002)', () => {
    expect(sortDocs(docs).map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(sortNewestFirst(docs).map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })
  it('ค้นหาหลายคำต้องมีครบ ครอบคลุมหมายเหตุและชื่อไฟล์ + กรองหมวด', () => {
    const w = [d('x', 'หนังสือเชิญ', 'จดหมายเชิญ', '003/2569', '2026-02-01', { note: 'เชิญวิทยากรจากต่างจังหวัด', file: { path: 'p', name: 'invite-ajarn.pdf', type: 'application/pdf', size: 10 } })]
    expect(filterDocs(w, 'วิทยากร', '').length).toBe(1)
    expect(filterDocs(w, 'ajarn', '').length).toBe(1)
    expect(filterDocs(w, 'วิทยากร จดหมายเชิญ', 'จดหมายเชิญ').length).toBe(1)
    expect(filterDocs(w, 'วิทยากร', 'ประชุม').length).toBe(0)
    expect(snippetOf(w[0], 'วิทยากร')).toContain('วิทยากร')
  })
  it('หมวด: รวมที่ตั้งไว้ (แม้ยังไม่มีเอกสาร) + ที่มีเอกสาร · ไม่ระบุหมวดอยู่ท้าย', () => {
    expect(categoriesOf([...docs, d('z', 'ไร้หมวด', '', '1', '2026-01-01')], ['จดหมายเชิญ'])).toEqual([{ name: 'จดหมายเชิญ', n: 0 }, { name: 'ประชุมกรรมการ', n: 2 }, { name: 'ประชุมสามัญประจำปี', n: 1 }, { name: 'ไม่ระบุหมวด', n: 1 }])
  })
  it('ระดับเอกสาร: ทั่วไปทุกคน · ภายในแอดมิน/ผู้ทำงานเลขา · ลับเฉพาะแอดมิน', () => {
    const user = { admin: false, editor: false }, ed = { admin: false, editor: true }, ad = { admin: true, editor: true }
    expect([canSeeDoc('ทั่วไป', user), canSeeDoc('ภายใน', user), canSeeDoc('ภายใน', ed), canSeeDoc('ลับ', ed), canSeeDoc('ลับ', ad)]).toEqual([true, false, true, false, true])
  })
  it('ชื่อไฟล์ → ชื่อเอกสาร · นามสกุล · ขนาด', () => {
    expect(titleFromFile('เชิญประชุม_ครั้งที่_2.pdf')).toBe('เชิญประชุม ครั้งที่ 2')
    expect(fileExt('A.B.PDF')).toBe('pdf')
    expect(fmtSize(500)).toBe('1 KB')
    expect(fmtSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})
