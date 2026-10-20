import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPENSE_CATS, isLegacyCatId } from './expenseCats'

describe('รายการจ่ายตั้งต้น (ตามใบเบิก-จ่ายเงินสด)', () => {
  it('11 รายการตามใบ เรียงตามลำดับในใบ', () => {
    expect(DEFAULT_EXPENSE_CATS.map((c) => c.name)).toEqual(['ค่าน้ำมันออกเยี่ยมสมาชิก อ.กฤต', 'ค่าน้ำมันออกเยี่ยมสมาชิก อ.พิชิต', 'เงินเดือน อ.กฤต', 'เงินเดือน อ.พิชิต', 'เงินเดือน อ.สายฝน', 'ค่าอาหารวันอาทิตย์', 'ค่าอาหารคนงาน', 'อุปกรณ์สำนักงาน', 'ค่าอินเตอร์เน็ต', 'ค่าไฟ', 'ค่าน้ำ'])
    expect(DEFAULT_EXPENSE_CATS.every((c) => c.kind === 'group' && c.active)).toBe(true)
  })
  it('id ไม่ซ้ำ และไม่ชนกับ id ของแคตตาล็อกเก่า', () => {
    const ids = DEFAULT_EXPENSE_CATS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some(isLegacyCatId)).toBe(false)
    expect(isLegacyCatId('ei-3-1') && isLegacyCatId('eg-12')).toBe(true)
    expect(isLegacyCatId('eg-k3x9')).toBe(false)
  })
})
