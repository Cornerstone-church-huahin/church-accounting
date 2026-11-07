import { DEFAULT_INCOME_TYPES } from './data'
import type { IncomeType } from './types'

/** ใบติดบอร์ด: รายรับไม่แจ้งชื่อบุคคล — รายการที่ผู้ใช้เพิ่มเอง (ชื่อคน/ชื่อเฉพาะ) รวมเป็น “ถวายอื่น ๆ” หรือหมวดที่กำหนดไว้ (boardCat) */
export const BOARD_OTHER = 'ถวายอื่น ๆ'
const STANDARD = new Set(DEFAULT_INCOME_TYPES.filter((t) => !t.fund).map((t) => t.id))
/** ชื่อหมวดมาตรฐานที่เลือกได้บนบอร์ด */
export const STANDARD_BOARD = DEFAULT_INCOME_TYPES.filter((t) => !t.fund).map((t) => t.name)
const STANDARD_NAMES = new Set(DEFAULT_INCOME_TYPES.filter((t) => !t.fund).map((t) => t.name))

/** ชื่อหมวดของแถวรายรับหนึ่งแถวบนใบติดบอร์ด (key = id ประเภท) */
export function boardLabel(key: string, label: string, types: IncomeType[]): string {
  if (key.startsWith('__')) return label
  const t = types.find((x) => x.id === key)
  const cat = t?.boardCat?.trim()
  if (cat) return cat
  if (STANDARD.has(key)) return t?.name ?? label
  // รายการที่เพิ่มเองแต่ตั้งชื่อตรงกับหมวดมาตรฐาน (เช่นแก้ชื่อเป็น “สิบลด”) = อยู่หมวดนั้น
  const nm = (t?.name ?? label).trim()
  return STANDARD_NAMES.has(nm) ? nm : BOARD_OTHER
}

/** รวมแถวที่หมวดเดียวกันเป็นแถวเดียว (คงลำดับตามที่เจอก่อน · “ถวายอื่น ๆ” ไว้ท้ายสุด) */
export function groupBoard<T extends { key: string; label: string }>(rows: T[], types: IncomeType[], merge: (a: T, b: T) => T): T[] {
  const out = new Map<string, T>()
  for (const r of rows) {
    const g = boardLabel(r.key, r.label, types)
    const cur = out.get(g)
    out.set(g, cur ? merge(cur, r) : { ...r, key: `board:${g}`, label: g })
  }
  const all = [...out.values()]
  return [...all.filter((x) => x.label !== BOARD_OTHER), ...all.filter((x) => x.label === BOARD_OTHER)]
}

/** ทุกแถวรายรับบนบอร์ดระบุช่องทางให้ชัด: “สิบลด (ตู้ถวาย)” กับ “สิบลด (โอน)” — แถวที่มีทั้งสองช่องทางแยกเป็น 2 แถวตามความจริง */
export function splitByChannel<T extends { key: string; label: string; cashN: number; cash: number; trN: number; tr: number; amt: number }>(rows: T[]): T[] {
  const out: T[] = []
  for (const r of rows) {
    if (r.cash > 0) out.push({ ...r, key: `${r.key}:cash`, label: `${r.label} (ตู้ถวาย)`, trN: 0, tr: 0, amt: r.cash })
    if (r.tr > 0) out.push({ ...r, key: `${r.key}:tr`, label: `${r.label} (โอน)`, cashN: 0, cash: 0, amt: r.tr })
    if (!(r.cash > 0) && !(r.tr > 0)) out.push(r)
  }
  return out
}
