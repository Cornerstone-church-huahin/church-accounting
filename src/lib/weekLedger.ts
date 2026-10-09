import { addDays, daysInMonth } from './money'
import { directOut, paidItems, type Period } from './ledger'
import { fmtDate, inRange } from './money'
import { BANK_UNKNOWN_LABEL, BANK_UNKNOWN_OUT_LABEL, lineDate, typeFromNote, unknownBankIn, unknownBankOut } from './passbook'
import { UNSORTED, type PassbookLine, type BudgetEntry, type ExpenseCat, type ExpenseEntry, type BudgetLine, type IncomeEntry, type IncomeType, type Round, type Voucher } from './types'

export interface LSrc { n: number; amt: number }
export interface LRow { key: string; label: string; cash: LSrc; transfer: LSrc; /** ค้างจ่าย: วางบิลที่ยังไม่จ่าย / สำรองจ่ายที่ยังไม่คืนเงิน (นับเป็นรายจ่ายแล้ว แต่เงินยังไม่ออก) */ pending?: LSrc }
export type SumKind = 'week' | 'month' | 'quarter' | 'year'
/** ช่วงวันที่ของใบสรุป: สัปดาห์ = จันทร์–อาทิตย์ของใบวันอาทิตย์ · เดือน · ไตรมาส (1–4) · ปี */
export function rangeOf(kind: SumKind, year: number, o: { sunday?: string; month?: number; quarter?: number } = {}): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (kind === 'week') { const s = o.sunday ?? `${year}-01-01`; return { from: addDays(s, -6), to: s } }
  if (kind === 'month') { const m = o.month ?? 1; return { from: `${year}-${pad(m)}-01`, to: `${year}-${pad(m)}-${pad(daysInMonth(year, m))}` } }
  if (kind === 'quarter') { const q = o.quarter ?? 1, m1 = q * 3 - 2, m3 = q * 3; return { from: `${year}-${pad(m1)}-01`, to: `${year}-${pad(m3)}-${pad(daysInMonth(year, m3))}` } }
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

export const sumRows = (rs: LRow[]) => ({ cash: rs.reduce((a, r) => a + r.cash.amt, 0), transfer: rs.reduce((a, r) => a + r.transfer.amt, 0), pending: rs.reduce((a, r) => a + (r.pending?.amt ?? 0), 0) })

const NO_BUDGET = '__none' // ต้องตรงกับ Vouchers.tsx

/**
 * ตารางรับ-จ่ายของสัปดาห์ (จันทร์–อาทิตย์ ของใบวันอาทิตย์ที่เลือก) หรือทั้งปี
 * รายรับ: ช่องแรก = ตู้ถวาย/เงินสด (ใบถวาย + เงินสดมือ) · ช่องที่สอง = โอน · 5 แถวแรกเป็นประเภทที่พิมพ์ในใบ
 * รายจ่าย: ใบเบิกที่ "จ่ายแล้ว" + บันทึกตรงในงบ แยกตามหมวดงบ/กองทุน
 */
export function computeLedger(a: {
  /** ช่วงวันที่ของใบสรุป (ดู rangeOf) */
  range: { from: string; to: string }
  income: IncomeEntry[]; rounds: Round[]; vouchers: Voucher[]; lines: BudgetLine[]; funds: BudgetLine[]; entries: BudgetEntry[]; types: IncomeType[]
  /** หมวดรายจ่าย (ถ้าใส่ ตารางรายจ่ายแยกตามหมวดหลัก 15 หมวด · ไม่ใส่ = แยกตามหมวดงบ) */
  cats?: ExpenseCat[]
  /** รายจ่ายนอกใบเบิก (นับเมื่อจ่ายแล้ว ตามวันที่จ่าย) */
  expenses?: ExpenseEntry[]
  /** บรรทัดสมุดบัญชี: เงินโอนเข้าที่ไม่มีสลิปนับเป็นรายรับ "ไม่ทราบที่มา (Unknown)" */
  passbook?: PassbookLine[]
}) {
  const typeName = (id: string) => (id === UNSORTED ? 'โอน (ยังไม่แยกประเภท)' : a.types.find((t) => t.id === id)?.name ?? '(ประเภทที่ถูกลบ)')
  const inR = (d: string) => inRange(d, a.range.from, a.range.to)
  const ent = a.income.filter((x) => !x.roundId && inR(x.date))
  const rds = a.rounds.filter((r) => inR(r.date))

  const m = new Map<string, { cash: LSrc; transfer: LSrc }>()
  const at = (id: string) => { const c = m.get(id) ?? { cash: { n: 0, amt: 0 }, transfer: { n: 0, amt: 0 } }; m.set(id, c); return c }
  const order = new Map(a.types.map((t, i) => [t.id, t.order ?? i]))
  for (const r of rds) for (const [id, v] of Object.entries(r.lines)) if (v > 0) { const c = at(id).cash; c.amt += v; c.n += r.envelopes?.[id] ?? 1 }
  for (const x of ent) { const c = at(x.unknown ? UNSORTED : x.typeId); const t = x.method === 'transfer' ? c.transfer : c.cash; t.amt += x.amount; t.n += 1 }
  // เงินเข้าสมุดที่ไม่มีสลิป: ถ้ามีลายมือ/หมายเหตุระบุประเภทไว้ (เช่น "สิบลด") ให้ลงประเภทนั้น · ไม่ได้ระบุเลย = ไม่ทราบที่มา
  const bankIn = unknownBankIn(a.passbook ?? [], a.income).filter((l) => inR(lineDate(l)))
  const bankUnknown: PassbookLine[] = []
  for (const l of bankIn) { const id = typeFromNote(l.desc, a.types); if (id) { const t = at(id).transfer; t.amt += l.amount; t.n += 1 } else bankUnknown.push(l) }
  const incRows0: LRow[] = [...m.entries()].sort((x, y) => (order.get(x[0]) ?? 999) - (order.get(y[0]) ?? 999)).filter(([, v]) => v.cash.amt > 0 || v.transfer.amt > 0).map(([id, v]) => ({ key: id, label: typeName(id), ...v }))

  const p: Period = { kind: 'week', from: a.range.from, to: a.range.to }
  const lineName = (id: string) => (id === NO_BUDGET || !id ? 'ไม่ผูกงบ' : [...a.lines, ...a.funds].find((l) => l.id === id)?.name ?? '(หมวดที่ถูกลบ)')
  const cats = a.cats ?? []
  const groups = cats.filter((c) => c.kind === 'group' && c.active).sort((x, y) => x.order - y.order)
  const o = new Map<string, LRow>()
  const oat = (id: string, label: string) => { const r = o.get(id) ?? { key: id, label, cash: { n: 0, amt: 0 }, transfer: { n: 0, amt: 0 }, pending: { n: 0, amt: 0 } }; o.set(id, r); return r }
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
  // รายจ่ายบันทึกด้วยมือ/วางบิล/สำรองจ่าย: นับเป็นรายจ่ายทันทีตามวันที่เกิดรายการ — จ่ายแล้วเข้าเงินสด/โอน ยังไม่จ่าย (ค้างจ่าย/รอคืนเงิน) เข้าช่อง "ค้างจ่าย"
  for (const x of a.expenses ?? []) {
    if (x.deleted || !inRange(x.date, p.from, p.to)) continue
    const r = rowFor(x.catId, '__none')
    const t = x.status !== 'paid' ? r.pending! : x.method === 'transfer' ? r.transfer : r.cash
    t.n += 1; t.amt += x.amount
  }
  for (const e of directOut(a.entries, p)) { const t = rowFor(undefined, e.lineId).cash; t.n += 1; t.amt += e.amount }
  const outAll = [...o.values()]
  const hasAmt = (r: LRow) => r.cash.amt > 0 || r.transfer.amt > 0 || (r.pending?.amt ?? 0) > 0
  // รายจ่ายแสดงเฉพาะหมวดที่เกิดรายการจริง เรียงตามลำดับหมวดหลัก (ยังไม่ระบุหมวดไว้ท้าย)
  const outRows0 = groups.length > 0
    ? [...groups.map((g) => o.get(g.id)).filter((r): r is LRow => !!r && hasAmt(r)), ...(o.get(UNCAT) && hasAmt(o.get(UNCAT)!) ? [o.get(UNCAT)!] : [])]
    : outAll.sort((x, y) => y.cash.amt + y.transfer.amt + (y.pending?.amt ?? 0) - x.cash.amt - x.transfer.amt - (x.pending?.amt ?? 0))


  // เงินเข้า/ออกสมุดที่ไม่มีสลิป/บิล: แยกเป็นรายการละบรรทัด (ไม่รวมเป็นยอดเดียว) เรียงตามวันที่
  const bankOut = unknownBankOut(a.passbook ?? [], a.expenses ?? []).filter((l) => inR(lineDate(l))).sort((x, y) => x.date.localeCompare(y.date))
  const bankRow = (l: PassbookLine, tag: string): LRow => ({ key: `__bank:${l.id}`, label: `${tag} · ${fmtDate(l.date)}${l.desc ? ` · ${l.desc}` : ''}`, cash: { n: 0, amt: 0 }, transfer: { n: 1, amt: l.amount }, pending: { n: 0, amt: 0 } })
  const incRows: LRow[] = [...incRows0, ...bankUnknown.sort((x, y) => x.date.localeCompare(y.date)).map((l) => bankRow(l, BANK_UNKNOWN_LABEL))]
  const outRows: LRow[] = [...outRows0, ...bankOut.map((l) => bankRow(l, BANK_UNKNOWN_OUT_LABEL))]
  return { incRows, outRows, inSum: sumRows(incRows), outSum: sumRows(outRows) }
}
