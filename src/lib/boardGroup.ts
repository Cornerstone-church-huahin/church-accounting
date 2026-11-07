import { DEFAULT_INCOME_TYPES } from './data'
import type { IncomeType } from './types'

/** ใบติดบอร์ด: รายรับไม่แจ้งชื่อบุคคล — รายการที่ผู้ใช้เพิ่มเอง (ชื่อคน/ชื่อเฉพาะ) รวมเป็น “ถวายอื่น ๆ” หรือหมวดที่กำหนดไว้ (boardCat) */
export const BOARD_OTHER = 'ถวายอื่น ๆ'
const STANDARD = new Set(DEFAULT_INCOME_TYPES.filter((t) => !t.fund).map((t) => t.id))

/** ชื่อหมวดของแถวรายรับหนึ่งแถวบนใบติดบอร์ด (key = id ประเภท) */
export function boardLabel(key: string, label: string, types: IncomeType[]): string {
  if (key.startsWith('__')) return label
  const t = types.find((x) => x.id === key)
  const cat = t?.boardCat?.trim()
  if (cat) return cat
  return STANDARD.has(key) ? (t?.name ?? label) : BOARD_OTHER
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
