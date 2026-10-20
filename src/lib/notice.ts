import type { LRow } from './weekLedger'

export interface NoticeLine { key: string; label: string; amt: number }
export interface Notice { inc: NoticeLine[]; fund: NoticeLine[]; out: NoticeLine[]; totalInc: number; totalFund: number; totalOut: number; /** รับ (ไม่รวมกองทุน) − จ่าย */ net: number }

/** แถวที่เป็น "เงินเข้า/ออกสมุดที่ไม่ทราบที่มา" เป็นเรื่องภายในการกระทบยอด ไม่นำขึ้นใบประกาศ */
const shown = (r: LRow) => !r.key.startsWith('__bank')
const line = (r: LRow, withPending: boolean): NoticeLine => ({ key: r.key, label: r.label, amt: r.cash.amt + r.transfer.amt + (withPending ? r.pending?.amt ?? 0 : 0) })

/**
 * ใบสรุปรับ-จ่ายสำหรับติดประกาศ: รายรับตามรายการ (เงินสด+โอนรวมกัน) · เงินถวายกองทุนแยกต่างหาก · รายจ่ายตามหมวด
 * ไม่มีรายละเอียดภายใน (ผู้วางบิล สำรองจ่าย ยอดไม่ทราบที่มา ฯลฯ)
 */
export function weekNotice(L: { incRows: LRow[]; outRows: LRow[]; fundRows: LRow[] }): Notice {
  const inc = L.incRows.filter(shown).map((r) => line(r, false)).filter((x) => x.amt > 0)
  const fund = L.fundRows.map((r) => line(r, false)).filter((x) => x.amt > 0)
  const out = L.outRows.filter(shown).map((r) => line(r, true)).filter((x) => x.amt > 0)
  const sum = (xs: NoticeLine[]) => xs.reduce((s, x) => s + x.amt, 0)
  const totalInc = sum(inc), totalOut = sum(out)
  return { inc, fund, out, totalInc, totalFund: sum(fund), totalOut, net: totalInc - totalOut }
}
