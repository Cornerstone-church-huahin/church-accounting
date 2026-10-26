import type { FundAccount } from './fundAccounts'
import type { FundSub, IncomeType } from './types'
import { newId } from './money'

export const activeSubs = (t?: IncomeType): FundSub[] => (t?.subs ?? []).filter((s) => s.active).sort((a, b) => a.order - b.order)

/** ตัวเลือกหมวดที่กำลังดู/บันทึก: all = ทุกหมวด · '' = ส่วนกลาง (ยังไม่ระบุหมวด) · อื่น ๆ = id หมวด */
export type SubPick = 'all' | string

/** บัญชีเฉพาะหมวด: ส่วนกลางรวมยอดตั้งต้น เงินนับถวาย เงินยืม และรายการที่ยังไม่ระบุหมวด · หมวดย่อยไม่มียอดตั้งต้น */
export function subAccount(f: FundAccount, sub: SubPick): FundAccount {
  if (sub === 'all') return f
  const moves = f.moves.filter((m) => (m.subId ?? '') === sub)
  const opening = sub === '' ? f.opening : 0
  const moneyIn = moves.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0)
  const moneyOut = moves.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0)
  return { ...f, opening, moves, moneyIn, moneyOut, balance: opening + moneyIn - moneyOut }
}

/** ยอดของแต่ละหมวด (รวมหมวดที่ถูกเก็บถาวรที่ยังมีรายการ) + ส่วนกลาง */
export function subSummary(f: FundAccount, t?: IncomeType) {
  const subs = t?.subs ?? []
  const known = new Set(subs.map((s) => s.id))
  const rows = subs.filter((s) => s.active || f.moves.some((m) => m.subId === s.id)).sort((a, b) => a.order - b.order).map((s) => ({ id: s.id, name: s.name, active: s.active, acc: subAccount(f, s.id) }))
  const central = subAccount({ ...f, moves: f.moves.map((m) => (m.subId && !known.has(m.subId) ? { ...m, subId: undefined } : m)) }, '')
  return { rows, central }
}

export function addSub(t: IncomeType, name: string, actId?: string): { subs: FundSub[] } | { error: string } {
  const n = name.trim()
  if (!n) return { error: 'พิมพ์ชื่อหมวด' }
  const subs = t.subs ?? []
  if (subs.some((s) => s.name === n && s.active && s.actId === actId)) return { error: 'มีหมวดชื่อนี้แล้ว' }
  return { subs: [...subs, { id: newId('sb'), name: n, active: true, order: subs.length ? Math.max(...subs.map((s) => s.order)) + 1 : 1, ...(actId ? { actId } : {}) }] }
}
/** ลบหมวด: ไม่มีรายการ = ลบจริง · มีรายการแล้ว = เก็บถาวร (ซ่อนจากตัวเลือก แต่รายงานยังเห็น) */
export function removeSub(t: IncomeType, id: string, hasMoves: boolean): FundSub[] {
  const subs = t.subs ?? []
  return hasMoves ? subs.map((s) => (s.id === id ? { ...s, active: false } : s)) : subs.filter((s) => s.id !== id)
}
