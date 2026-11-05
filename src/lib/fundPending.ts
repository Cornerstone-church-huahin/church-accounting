import type { FundAccount } from './fundAccounts'
import { sheetSunday } from './money'
import type { FundDeposit } from './types'

/**
 * แถวใน "เตรียมนำฝาก" — เงินกองทุน 2 ทาง:
 *  • auto   = มากับรายรับสัปดาห์ (นับเงิน/รายรับหมุนเวียน/โอนเข้าสมุด) → ถูกเบิกพร้อมเงินหมุนเวียนแล้วโดยอัตโนมัติ = “ถอนแล้ว” เป็นเงินสดรอนำฝาก
 *  • direct = บันทึกตรงในหน้ากองทุน (เช่น ค่าโต๊ะจีน) → “ยังไม่ถอน” จนกว่าจะกด “ถอนแล้ว” + วันที่ถอน (ตอนนั้นเข้าใบเบิก-จ่ายของสัปดาห์ที่ถอน และกลายเป็นรอนำฝาก)
 */
export type PendingKind = 'auto' | 'direct-wait' | 'direct-unwithdrawn'
export interface PendingRow {
  /** id ของรายการที่นำฝาก: `สัปดาห์:กองทุน` (auto) · `สัปดาห์:กองทุน:d` (ถอนเองแล้ว) · `…:d:u` (ยังไม่ถอน ใช้เป็นกุญแจแถวเท่านั้น) */
  key: string
  week: string
  fundId: string
  name: string
  kind: PendingKind
  /** ยอดของแถวนี้ (auto = ที่ได้รับ · direct = ที่ถอนแล้ว หรือที่ยังไม่ถอน) */
  recorded: number
  /** ที่นำฝากแล้ว */
  deposited: number
  depositedOn?: string
  /** วันที่ถอนจริง (เฉพาะ direct ที่ถอนแล้ว) */
  withdrawnOn?: string
  /** ถอนแล้วแต่ยังไม่ได้นำฝาก (auto/direct-wait) = ได้รับ − ฝากแล้ว · แถวยังไม่ถอน = 0 */
  pending: number
}
export interface PendingSummary {
  rows: PendingRow[]
  /** ถอนแล้ว รอนำฝาก (เงินสดในมือ) */
  waiting: PendingRow[]
  waitingTotal: number
  /** ยังไม่ถอน */
  unwithdrawn: PendingRow[]
  unwithdrawnTotal: number
}

const isAuto = (m: { key: string; direct?: boolean }) => /^(rd|pb):/.test(m.key) || (/^in:/.test(m.key) && !m.direct)
const isDirect = (m: { key: string; direct?: boolean }) => /^in:/.test(m.key) && !!m.direct
/** id ของรายการ “ถอนแล้ว” (เก็บในที่เดียวกับรายการนำฝาก แยกด้วย prefix) */
export const wdId = (key: string, on: string) => `wd:${key}@${on}`
/** กุญแจฐานของรายการถอน (ตัดวันที่ท้ายออก) */
export const wdBase = (id: string) => id.slice(3).split('@')[0]
export const isWithdrawRec = (d: { id: string }) => d.id.startsWith('wd:')

/**
 * "เตรียมนำฝาก": เรียงเก่า→ใหม่ต่อเนื่อง · กด "ฝากแล้ว" บันทึกว่านำเงินเข้าบัญชีกองทุนแล้ว · ยอดสัปดาห์เดิมที่เพิ่มขึ้นทีหลังจะกลับมารอใหม่เฉพาะส่วนเพิ่ม
 */
/** skip: รายการที่ไม่ต้องนำฝาก เช่น เงินกิจกรรม (หมวดสังกัดกิจกรรม) — เงินผ่านที่ยังอยู่ในบัญชีหลัก ไม่ใช่เงินที่ต้องนำเข้าบัญชีกองทุน */
export function fundPending(funds: FundAccount[], deposits: FundDeposit[], skip?: (fundId: string, subId?: string) => boolean): PendingSummary {
  const live = deposits.filter((d) => !d.deleted)
  const dep = new Map(live.filter((d) => !isWithdrawRec(d)).map((d) => [d.id, d]))
  const wd = new Map<string, FundDeposit[]>()
  for (const d of live.filter(isWithdrawRec)) wd.set(wdBase(d.id), [...(wd.get(wdBase(d.id)) ?? []), d])
  const rows: PendingRow[] = []
  for (const f of funds) {
    const auto = new Map<string, number>(), direct = new Map<string, number>()
    for (const m of f.moves) {
      if (m.amount <= 0) continue
      if (skip?.(f.id, m.subId)) continue
      const w = sheetSunday(m.date)
      if (isAuto(m)) auto.set(w, (auto.get(w) ?? 0) + m.amount)
      else if (isDirect(m)) direct.set(w, (direct.get(w) ?? 0) + m.amount)
    }
    for (const [week, recorded] of auto) {
      const key = `${week}:${f.id}`
      const d = dep.get(key)
      rows.push({ key, week, fundId: f.id, name: f.name, kind: 'auto', recorded, deposited: d?.amount ?? 0, ...(d ? { depositedOn: d.on } : {}), pending: Math.max(0, recorded - (d?.amount ?? 0)) })
    }
    for (const [week, total] of direct) {
      const key = `${week}:${f.id}:d`
      const ws = wd.get(key) ?? []
      const out = Math.min(total, ws.reduce((t, x) => t + x.amount, 0))       // ถอนแล้ว (ถ้ารายการถูกลบจนน้อยลง นับเท่าที่มี)
      if (out > 0) {
        const d = dep.get(key)
        rows.push({ key, week, fundId: f.id, name: f.name, kind: 'direct-wait', recorded: out, deposited: d?.amount ?? 0, ...(d ? { depositedOn: d.on } : {}), ...(ws.length ? { withdrawnOn: ws.map((x) => x.on).sort().pop() } : {}), pending: Math.max(0, out - (d?.amount ?? 0)) })
      }
      if (total - out > 0) rows.push({ key: `${key}:u`, week, fundId: f.id, name: f.name, kind: 'direct-unwithdrawn', recorded: total - out, deposited: 0, pending: 0 })
    }
  }
  rows.sort((a, b) => a.week.localeCompare(b.week) || a.name.localeCompare(b.name, 'th') || a.kind.localeCompare(b.kind))
  const waiting = rows.filter((r) => r.kind !== 'direct-unwithdrawn' && r.pending > 0)
  const unwithdrawn = rows.filter((r) => r.kind === 'direct-unwithdrawn')
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
  return { rows, waiting, waitingTotal: sum(waiting.map((r) => r.pending)), unwithdrawn, unwithdrawnTotal: sum(unwithdrawn.map((r) => r.recorded)) }
}

/** เงินกองทุนที่ถอนเองแล้ว (บันทึกตรงในหน้ากองทุน) ที่ตกในสัปดาห์นั้น → ไปอยู่ในช่อง “ต้องเบิก” ของใบเบิก-จ่ายสัปดาห์ที่ถอน */
export function withdrawnInWeek(deposits: FundDeposit[], sunday: string, nameOf: (fundId: string) => string): { name: string; amount: number }[] {
  return deposits.filter((d) => !d.deleted && isWithdrawRec(d) && d.amount > 0 && sheetSunday(d.on) === sunday).map((d) => ({ name: `${nameOf(d.fundId)} (ถอนเงินที่บันทึกในหน้ากองทุน)`, amount: d.amount }))
}

/**
 * แตกยอดคงเหลือกองทุนเป็น 3 ที่: ในบัญชีกองทุน · ถอนแล้วรอนำฝาก (เงินสด) · ยังไม่ถอน — ผลรวม 3 ที่ = ยอดคงเหลือเสมอ (ไม่นับซ้ำ)
 */
export function fundSplit(funds: FundAccount[], sum: PendingSummary, actPer: Map<string, number> = new Map()) {
  const waitBy = new Map<string, number>(), unBy = new Map<string, number>()
  for (const r of sum.waiting) waitBy.set(r.fundId, (waitBy.get(r.fundId) ?? 0) + r.pending)
  for (const r of sum.unwithdrawn) unBy.set(r.fundId, (unBy.get(r.fundId) ?? 0) + r.recorded)
  const per = new Map<string, { w: number; u: number; act: number; acct: number }>()
  let W = 0, U = 0, A = 0, T = 0
  for (const f of funds) {
    const act = Math.min(actPer.get(f.id) ?? 0, Math.max(0, f.balance))
    const w = Math.min(waitBy.get(f.id) ?? 0, Math.max(0, f.balance - act))
    const u = Math.min(unBy.get(f.id) ?? 0, Math.max(0, f.balance - act - w))
    per.set(f.id, { w, u, act, acct: f.balance - act - w - u })
    W += w; U += u; A += act; T += f.balance
  }
  return { per, wait: W, unw: U, act: A, acct: T - W - U - A, total: T }
}
