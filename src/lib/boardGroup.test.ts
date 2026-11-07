import { describe, expect, it } from 'vitest'
import { BOARD_OTHER, groupBoard } from './boardGroup'
import type { IncomeType } from './types'

const T = (id: string, name: string, boardCat?: string) => ({ id, name, order: 0, active: true, updated: 1, ...(boardCat ? { boardCat } : {}) }) as IncomeType
const r = (key: string, label: string, amount: number) => ({ key, label, amount })
const merge = (a: { amount: number }, b: { amount: number }) => ({ ...a, amount: a.amount + b.amount })

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
})
