import { describe, expect, it } from 'vitest'
import { BOARD_OTHER, groupBoard, splitByChannel } from './boardGroup'
import type { IncomeType } from './types'

const T = (id: string, name: string, boardCat?: string) => ({ id, name, order: 0, active: true, updated: 1, ...(boardCat ? { boardCat } : {}) }) as IncomeType
const r = (key: string, label: string, amount: number) => ({ key, label, amount })
type R = { key: string; label: string; amount: number }
const merge = (a: R, b: R): R => ({ ...a, amount: a.amount + b.amount })

describe('ใบติดบอร์ด: รายรับเป็นหมวด ไม่แจ้งชื่อบุคคล', () => {
  const types = [T('tt1', 'สิบลด'), T('tt2', 'ประจำสัปดาห์'), T('t9', 'อ.อรสา'), T('t10', 'ดาวลอย'), T('t11', 'เงินสด')]
  it('ประเภทที่เพิ่มเอง (ชื่อคน) รวมเป็น “ถวายอื่น ๆ” ไว้ท้ายสุด', () => {
    const out = groupBoard([r('tt1', 'สิบลด', 100), r('t9', 'อ.อรสา', 2000), r('tt2', 'ประจำสัปดาห์', 50), r('t10', 'ดาวลอย', 485), r('t11', 'เงินสด', 1002)], types, merge)
    expect(out.map((x) => [x.label, x.amount])).toEqual([['สิบลด', 100], ['ประจำสัปดาห์', 50], [BOARD_OTHER, 3487]])
  })
  it('กำหนดหมวดบอร์ดเป็น สิบลด → รวมเข้ากับสิบลด', () => {
    const ty = [T('tt1', 'สิบลด'), T('t9', 'อ.อรสา', 'สิบลด')]
    const out = groupBoard([r('tt1', 'สิบลด', 100), r('t9', 'อ.อรสา', 2000)], ty, merge)
    expect(out.map((x) => [x.label, x.amount])).toEqual([['สิบลด', 2100]])
  })
  it('รายการที่เพิ่มเองแต่ชื่อตรงหมวดมาตรฐาน (แก้ชื่อเป็น สิบลด) อยู่หมวดสิบลด', () => {
    const ty = [T('tt1', 'สิบลด'), T('t9', 'สิบลด ')]
    expect(groupBoard([r('tt1', 'สิบลด', 100), r('t9', 'สิบลด ', 2000)], ty, merge).map((x) => [x.label, x.amount])).toEqual([['สิบลด', 2100]])
  })
  it('หมวดที่มีทั้งตู้และโอน แยกเป็น 2 แถว และทุกแถวระบุช่องทาง', () => {
    const line = { key: 'board:สิบลด', label: 'สิบลด', cashN: 7, cash: 4550, trN: 2, tr: 2485, amt: 7035 }
    const out = splitByChannel([line, { key: 'tt2', label: 'ประจำสัปดาห์', cashN: 8, cash: 1060, trN: 0, tr: 0, amt: 1060 }])
    expect(out.map((x) => [x.label, x.cash, x.tr, x.amt])).toEqual([['สิบลด (ตู้ถวาย)', 4550, 0, 4550], ['สิบลด (โอน)', 0, 2485, 2485], ['ประจำสัปดาห์ (ตู้ถวาย)', 1060, 0, 1060]])
  })
})
