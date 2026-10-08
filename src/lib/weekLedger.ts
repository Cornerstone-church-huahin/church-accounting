import { addDays, sheetSunday } from './money'
import { directOut, paidItems, type Period } from './ledger'
import { inRange } from './money'
import { UNSORTED, type BudgetEntry, type ExpenseCat, type ExpenseEntry, type BudgetLine, type IncomeEntry, type IncomeType, type Round, type Voucher } from './types'

export interface LSrc { n: number; amt: number }
export interface LRow { key: string; label: string; cash: LSrc; transfer: LSrc }
export const sumRows = (rs: LRow[]) => ({ cash: rs.reduce((a, r) => a + r.cash.amt, 0), transfer: rs.reduce((a, r) => a + r.transfer.amt, 0) })

const NO_BUDGET = '__none' // ต้องตรงกับ Vouchers.tsx

/**
 * ตารางรับ-จ่ายของสัปดาห์ (จันทร์–อาทิตย์ ของใบวันอาทิตย์ที่เลือก) หรือทั้งปี
 * รายรับ: ช่องแรก = ตู้ถวาย/เงินสด (ใบถวาย + เงินสดมือ) · ช่องที่สอง = โอน · 5 แถวแรกเป็นประเภทที่พิมพ์ในใบ
 * รายจ่าย: ใบเบิกที่ "จ่ายแล้ว" + บันทึกตรงในงบ แยกตามหมวดงบ/กองทุน
 */
export function computeLedger(a: {
  year: number; sunday: string; scope: 'week' | 'year'
  income: IncomeEntry[]; rounds: Round[]; vouchers: Voucher[]; lines: BudgetLine[]; funds: BudgetLine[]; entries: BudgetEntry[]; types: IncomeType[]
  /** หมวดรายจ่าย (ถ้าใส่ ตารางรายจ่ายแยกตามหมวดหลัก 15 หมวด · ไม่ใส่ = แยกตามหมวดงบ) */
  cats?: ExpenseCat[]
  /** รายจ่ายนอกใบเบิก (นับเมื่อจ่ายแล้ว ตามวันที่จ่าย) */
  expenses?: ExpenseEntry[]
}) {
  const typeName = (id: string) => (id === UNSORTED ? 'โอน (ยังไม่แยกประเภท)' : a.types.find((t) => t.id === id)?.name ?? '(ประเภทที่ถูกลบ)')
  const ent = a.income.filter((x) => !x.roundId && (a.scope === 'year' || sheetSunday(x.date) === a.sunday))
  const rds = a.scope === 'year' ? a.rounds : a.rounds.filter((r) => r.date === a.sunday)

  const m = new Map<string, { cash: LSrc; transfer: LSrc }>()
  const at = (id: string) => { const c = m.get(id) ?? { cash: { n: 0, amt: 0 }, transfer: { n: 0, amt: 0 } }; m.set(id, c); return c }
  const order = new Map(a.types.map((t, i) => [t.id, t.order ?? i]))
  for (const t of [...a.types].filter((x) => x.active).sort((x, y) => x.order - y.order).slice(0, 5)) at(t.id)
  for (const r of rds) for (const [id, v] of Object.entries(r.lines)) if (v > 0) { const c = at(id).cash; c.amt += v; c.n += r.envelopes?.[id] ?? 1 }
  for (const x of ent) { const c = at(x.unknown ? UNSORTED : x.typeId); const t = x.method === 'transfer' ? c.transfer : c.cash; t.amt += x.amount; t.n += 1 }
  const incRows: LRow[] = [...m.entries()].sort((x, y) => (order.get(x[0]) ?? 999) - (order.get(y[0]) ?? 999)).map(([id, v]) => ({ key: id, label: typeName(id), ...v }))

  const p: Period = a.scope === 'year' ? { kind: 'year', from: `${a.year}-01-01`, to: `${a.year}-12-31` } : { kind: 'week', from: addDays(a.sunday, -6), to: a.sunday }
  const lineName = (id: string) => (id === NO_BUDGET || !id ? 'ไม่ผูกงบ' : [...a.lines, ...a.funds].find((l) => l.id === id)?.name ?? '(หมวดที่ถูกลบ)')
  const cats = a.cats ?? []
  const groups = cats.filter((c) => c.kind === 'group' && c.active).sort((x, y) => x.order - y.order)
  const o = new Map<string, LRow>()
  const oat = (id: string, label: string) => { const r = o.get(id) ?? { key: id, label, cash: { n: 0, amt: 0 }, transfer: { n: 0, amt: 0 } }; o.set(id, r); return r }
  const UNCAT = '__uncat'
  // รายจ่ายแต่ละรายการ → แถวของหมวดหลัก (ถ้ามีหมวดรายจ่าย) หรือหมวดงบ (แบบเดิม)
  const rowFor = (catId: string | undefined, lineId: string) => {
    if (groups.length > 0) {
      const g = catId ? cats.find((c) => c.id === catId)?.group : undefined
      const grp = g ? groups.find((x) => x.id === g) : undefined
      return grp ? oat(grp.id, grp.name) : oat(UNCAT, 'ยังไม่ระบุหมวด')
    }
    return oat(lineId, lineName(lineId))
  }
  for (const { item } of paidItems(a.vouchers, p)) { const r = rowFor(item.catId, item.lineId); const t = item.method === 'transfer' ? r.transfer : r.cash; t.n += 1; t.amt += item.amount }
  // รายจ่ายบันทึกด้วยมือ/วางบิล/สำรองจ่าย: นับเมื่อจ่ายแล้ว ตามวันที่จ่าย
  for (const x of a.expenses ?? []) {
    if (x.deleted || x.status !== 'paid') continue
    const d = x.channel === 'manual' ? x.date : (x.paidDate ?? x.date)
    if (!inRange(d, p.from, p.to)) continue
    const r = rowFor(x.catId, '__none'); const t = x.method === 'transfer' ? r.transfer : r.cash; t.n += 1; t.amt += x.amount
  }
  for (const e of directOut(a.entries, p)) { const t = rowFor(undefined, e.lineId).cash; t.n += 1; t.amt += e.amount }
  const outAll = [...o.values()]
  const hasAmt = (r: LRow) => r.cash.amt > 0 || r.transfer.amt > 0
  // รายจ่ายแสดงเฉพาะหมวดที่เกิดรายการจริง เรียงตามลำดับหมวดหลัก (ยังไม่ระบุหมวดไว้ท้าย)
  const outRows = groups.length > 0
    ? [...groups.map((g) => o.get(g.id)).filter((r): r is LRow => !!r && hasAmt(r)), ...(o.get(UNCAT) && hasAmt(o.get(UNCAT)!) ? [o.get(UNCAT)!] : [])]
    : outAll.sort((x, y) => y.cash.amt + y.transfer.amt - x.cash.amt - x.transfer.amt)

  return { incRows, outRows, inSum: sumRows(incRows), outSum: sumRows(outRows) }
}
