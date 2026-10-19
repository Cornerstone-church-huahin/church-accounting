import type { FundAccount } from './fundAccounts'
import { sheetSunday, weekRange } from './money'

export interface FundSheetRow {
  key: string
  /** วันที่ของแถว (เงินถวายรายสัปดาห์ = วันอาทิตย์ของสัปดาห์นั้น) */
  date: string
  label: string
  inn: number
  out: number
  /** ยอดคงเหลือหลังแถวนี้ */
  balance: number
  kind: 'open' | 'week' | 'move'
}

/** เงินที่เข้ามาจากการถวาย (นับเงิน/รายรับ/โอนเข้าสมุด) → รวมเป็น 1 แถวต่อสัปดาห์ · ที่เหลือ (จ่าย/เงินยืม) แยกแถวตามรายการ */
const isOffering = (key: string) => /^(rd|in|pb):/.test(key)

/**
 * ใบกองทุน (กระดาษแผ่นเดียวต่อเนื่อง): เรียงตามวันที่เก่า→ใหม่ ไม่ตัดเป็นรายสัปดาห์
 * แถวแรก = ยอดตั้งต้น · เงินถวายของแต่ละสัปดาห์ต่อท้ายเป็นแถวถัดไปเรื่อย ๆ พร้อมยอดคงเหลือสะสม
 */
export function fundSheetRows(f: FundAccount): FundSheetRow[] {
  const rows: Omit<FundSheetRow, 'balance'>[] = []
  const weeks = new Map<string, number>()
  for (const m of f.moves) {
    if (m.amount > 0 && isOffering(m.key)) { const w = sheetSunday(m.date); weeks.set(w, (weeks.get(w) ?? 0) + m.amount) } else rows.push({ key: m.key, date: m.date, label: m.label, inn: Math.max(0, m.amount), out: Math.max(0, -m.amount), kind: 'move' })
  }
  for (const [w, v] of weeks) rows.push({ key: `wk:${w}`, date: w, label: `เงินถวายเข้ากองทุน · สัปดาห์ ${weekRange(w)}`, inn: v, out: 0, kind: 'week' })
  // เงินถวายรายสัปดาห์ถือเป็นเงินเข้าของทั้งสัปดาห์ (วันอาทิตย์) — รายการอื่นเรียงตามวันที่จริง
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'week' ? -1 : 0) - (b.kind === 'week' ? -1 : 0) || a.key.localeCompare(b.key))
  let bal = f.opening
  return [{ key: 'open', date: '', label: 'ยอดตั้งต้น (ยกมา)', inn: 0, out: 0, balance: bal, kind: 'open' }, ...rows.map((r) => ({ ...r, balance: (bal += r.inn - r.out) }))]
}
