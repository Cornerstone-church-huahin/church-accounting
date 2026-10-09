import { addDays } from './money'
import type { FundMove, IncomeType, Opening, PassbookLine } from './types'

/** กองทุนวัตถุประสงค์: ตั้งไว้ชัดเจนก่อน ไม่ตั้ง = เดาจากชื่อ (กองทุน… / สร้างอาคาร / ก่อสร้าง) */
export const isFundType = (t: Pick<IncomeType, 'name' | 'fund'>) => t.fund ?? /กองทุน|สร้างอาคาร|ก่อสร้าง/.test(t.name)

export interface FundRow { id: string; name: string; received: number; moved: number; unmoved: number }

/**
 * เงินวัตถุประสงค์ที่ยัง "ค้างย้าย" อยู่ในบัญชีหมุนเวียน ต่อกองทุน
 * = ยอดยกมาที่ค้างอยู่ + รายรับของกองทุนนั้น (ตั้งแต่วันตัดยอด) − ที่ย้ายเข้าบัญชีวัตถุประสงค์แล้ว
 * received: id ประเภท → สตางค์ (จาก computeLedger ช่วงวันตัดยอดถึงปัจจุบัน)
 */
export function fundLedger(types: IncomeType[], received: Record<string, number>, moves: FundMove[], opening?: Opening): FundRow[] {
  return types.filter((t) => t.active && isFundType(t)).map((t) => {
    const rec = (received[t.id] ?? 0) + (opening?.unmoved[t.id] ?? 0)
    const mv = moves.filter((m) => !m.deleted).reduce((s, m) => s + (m.alloc[t.id] ?? 0), 0)
    return { id: t.id, name: t.name, received: rec, moved: mv, unmoved: rec - mv }
  })
}

/** เสนอจับคู่การย้ายเงิน: ถอนเงินสดจากบัญชีหมุนเวียน ↔ ฝากเงินสดเข้าบัญชีวัตถุประสงค์ ยอดเท่ากัน ± 3 วัน (ยังไม่ผูกกับการย้าย) */
export function suggestMoves(lines: PassbookLine[], accounts: { id: string; role?: string }[]): { out: PassbookLine; into: PassbookLine }[] {
  const role = (id?: string) => accounts.find((a) => a.id === id)?.role
  const free = lines.filter((l) => !l.deleted && !l.link)
  const outs = free.filter((l) => l.kind === 'withdraw' && role(l.accountId) !== 'restricted')
  const deps = free.filter((l) => l.kind === 'deposit' && role(l.accountId) === 'restricted')
  const used = new Set<string>()
  const res: { out: PassbookLine; into: PassbookLine }[] = []
  for (const o of outs.sort((a, b) => a.date.localeCompare(b.date))) {
    const hit = deps.find((d) => !used.has(d.id) && d.amount === o.amount && d.date >= addDays(o.date, -1) && d.date <= addDays(o.date, 3))
    if (hit) { used.add(hit.id); res.push({ out: o, into: hit }) }
  }
  return res
}
