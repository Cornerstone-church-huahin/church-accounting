import { newId } from './money'
import type { ExpenseCat, IncomeType } from './types'

/** สร้างรายการใหม่แบบเดียวกันทั้งหน้าบันทึกและหน้าตั้งค่า (ใช้ข้อมูลชุดเดียวกัน จึงขึ้นตรงกันทั้งสองที่) — คืนข้อความผิดพลาดเมื่อสร้างไม่ได้ */
export function makeIncomeType(existing: IncomeType[], name: string, fund = false): IncomeType | string {
  const n = name.trim()
  if (!n) return 'พิมพ์ชื่อก่อน'
  if (existing.some((x) => x.name === n)) return `มี “${n}” อยู่แล้ว`
  return { id: newId('t'), name: n, order: existing.length, active: true, ...(fund ? { fund: true } : {}), updated: 0 }
}

export function makeExpenseGroup(all: ExpenseCat[], name: string): ExpenseCat | string {
  const n = name.trim()
  const groups = all.filter((c) => c.kind === 'group')
  if (!n) return 'พิมพ์ชื่อก่อน'
  if (groups.some((g) => g.name === n)) return `มี “${n}” อยู่แล้ว`
  const id = newId('xg')
  const maxOrder = all.reduce((m, x) => Math.max(m, x.order), 0)
  return { id, kind: 'group', group: id, code: String(groups.reduce((m, x) => Math.max(m, Number(x.code) || 0), 0) + 1), name: n, order: maxOrder + 1, active: true, updated: 0 }
}
