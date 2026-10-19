import type { FundAccount } from './fundAccounts'
import { sheetSunday } from './money'
import type { FundDeposit } from './types'

export interface PendingRow {
  /** `สัปดาห์:กองทุน` — เป็น id ของรายการที่นำฝากด้วย */
  key: string
  week: string
  fundId: string
  name: string
  /** เงินกองทุนที่ได้รับในสัปดาห์นั้น (ยอดล่าสุดตามรายรับ) */
  recorded: number
  /** ที่นำฝากแล้ว */
  deposited: number
  depositedOn?: string
  /** ยังไม่ได้นำฝาก = ได้รับ − ฝากแล้ว (ไม่ติดลบ) */
  pending: number
}
export interface PendingSummary { rows: PendingRow[]; waiting: PendingRow[]; waitingTotal: number }

/** เงินที่เข้ากองทุนจากการถวาย (นับเงิน/รายรับ/โอนเข้าสมุด) — ไม่รวมเงินยืมและรายจ่าย */
const isOffering = (key: string) => /^(rd|in|pb):/.test(key)

/**
 * "เตรียมนำฝาก": เงินกองทุนที่ได้มาในแต่ละสัปดาห์ แต่ยังถืออยู่ ยังไม่ได้นำเข้าบัญชีกองทุน
 * เรียงเก่า→ใหม่ต่อเนื่อง (สัปดาห์ละ 1 แถวต่อกองทุน) · กด "ฝากแล้ว" ครั้งหนึ่งแล้วถ้าสัปดาห์เดิมมีเงินเข้าเพิ่ม ส่วนเพิ่มจะกลับมารอนำฝากใหม่
 */
export function fundPending(funds: FundAccount[], deposits: FundDeposit[]): PendingSummary {
  const dep = new Map(deposits.filter((d) => !d.deleted).map((d) => [d.id, d]))
  const rows: PendingRow[] = []
  for (const f of funds) {
    const weeks = new Map<string, number>()
    for (const m of f.moves) if (m.amount > 0 && isOffering(m.key)) { const w = sheetSunday(m.date); weeks.set(w, (weeks.get(w) ?? 0) + m.amount) }
    for (const [week, recorded] of weeks) {
      const key = `${week}:${f.id}`
      const d = dep.get(key)
      rows.push({ key, week, fundId: f.id, name: f.name, recorded, deposited: d?.amount ?? 0, ...(d ? { depositedOn: d.on } : {}), pending: Math.max(0, recorded - (d?.amount ?? 0)) })
    }
  }
  rows.sort((a, b) => a.week.localeCompare(b.week) || a.name.localeCompare(b.name, 'th'))
  const waiting = rows.filter((r) => r.pending > 0)
  return { rows, waiting, waitingTotal: waiting.reduce((s, r) => s + r.pending, 0) }
}
