import { EXPENSE_CAT_TEXT } from './expenseCatsData'
import type { ExpenseCat } from './types'

/** แปลงข้อความ "1. หมวด / 1.1 รายการ" เป็นรายการตั้งต้น (id คงที่: eg-<หมวด> / ei-<หมวด>-<ลำดับ>) */
export function parseExpenseCats(text: string): ExpenseCat[] {
  const out: ExpenseCat[] = []
  let order = 0
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const item = /^(\d+)\.(\d+)\s+(.+)$/.exec(line)
    const group = /^(\d+)\.\s+(.+)$/.exec(line)
    if (item) out.push({ id: `ei-${item[1]}-${item[2]}`, kind: 'item', group: `eg-${item[1]}`, code: `${item[1]}.${item[2]}`, name: item[3].trim(), order: order++, active: true, updated: 0 })
    else if (group) out.push({ id: `eg-${group[1]}`, kind: 'group', group: `eg-${group[1]}`, code: group[1], name: group[2].trim(), order: order++, active: true, updated: 0 })
  }
  return out
}

export const DEFAULT_EXPENSE_CATS: ExpenseCat[] = parseExpenseCats(EXPENSE_CAT_TEXT)
