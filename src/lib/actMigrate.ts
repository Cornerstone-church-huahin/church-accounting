import type { ExpenseEntry, IncomeEntry, IncomeType } from './types'

/** “เงินกิจกรรม”: ประเภทเดียวที่เก็บกิจกรรมทั้งหมด แยกถาวรจากกองทุน */
export const ACT_TYPE_ID = 'tt-activity'
export const isStandalone = (t: Pick<IncomeType, 'standalone'>) => !!t.standalone

export interface ActMigration {
  /** ประเภท “เงินกิจกรรม” (สร้าง/รวมกิจกรรมเข้าไป) */
  target: IncomeType
  /** กองทุนเดิมที่ถูกถอดกิจกรรมออก */
  sources: IncomeType[]
  income: IncomeEntry[]
  expenses: ExpenseEntry[]
  summary: { activities: number; subs: number; income: number; expenses: number; slips: number; balance: number; from: string[] }
}

/** กองทุนที่ยังมีกิจกรรมอยู่ข้างใน (ต้องย้ายเข้าเงินกิจกรรม) */
export const migratable = (types: IncomeType[]) => types.filter((t) => !t.standalone && t.actMode && ((t.activities?.length ?? 0) > 0 || (t.subs ?? []).some((s) => s.actId)))

/**
 * แผนย้ายกิจกรรมจากกองทุนเข้า “เงินกิจกรรม” (ฟังก์ชันล้วน ไม่เขียนข้อมูล):
 * - กิจกรรม + หมวดของกิจกรรม ย้ายทั้งชุด (id เดิมทั้งหมด)
 * - รายรับ/รายจ่ายที่ระบุหมวดของกิจกรรม เปลี่ยนเจ้าของเป็นเงินกิจกรรม (id รายการ สลิป รูปแนบ คงเดิม)
 * - กองทุนเดิมเหลือเฉพาะส่วนกลาง และถูกกันไม่ให้เปิดโหมดกิจกรรมเอง
 * รันซ้ำได้ (ไม่เหลืออะไรให้ย้าย = ไม่มีการเปลี่ยนแปลง)
 */
export function planActMigration(types: IncomeType[], income: IncomeEntry[], expenses: ExpenseEntry[], now: number): ActMigration | null {
  const sources = migratable(types)
  if (sources.length === 0) return null
  const ex = types.find((t) => t.standalone)
  const target: IncomeType = ex ?? { id: ACT_TYPE_ID, name: 'เงินกิจกรรม', order: 900, active: true, fund: true, actMode: true, standalone: true, noActAuto: true, activities: [], subs: [], updated: now }
  const acts = [...(target.activities ?? [])], subs = [...(target.subs ?? [])]
  const subOwner = new Map<string, string>() // id หมวดกิจกรรม → id กองทุนเดิม
  let na = 0
  for (const s of sources) {
    for (const a of s.activities ?? []) if (!acts.some((x) => x.id === a.id)) { acts.push(a); na++ }
    for (const q of s.subs ?? []) if (q.actId) { subOwner.set(q.id, s.id); if (!subs.some((x) => x.id === q.id)) { subs.push(q) } }
  }
  const moved = (typeId: string | undefined, subId: string | undefined) => !!subId && !!typeId && subOwner.get(subId) === typeId
  const inc = income.filter((x) => moved(x.typeId, x.subId)).map((x) => ({ ...x, typeId: target.id, updated: now }))
  const exp = expenses.filter((x) => moved(x.fundId, x.subId)).map((x) => ({ ...x, fundId: target.id, updated: now }))
  const live = <T extends { deleted?: boolean }>(l: T[]) => l.filter((x) => !x.deleted)
  const balance = live(inc).reduce((s, x) => s + x.amount, 0) - live(exp).reduce((s, x) => s + x.amount, 0)
  const slips = [...live(inc), ...live(exp)].reduce((n, x) => { const y = x as { slip?: unknown; photos?: unknown[]; receipts?: unknown[] }; return n + (y.slip ? 1 : 0) + (y.photos?.length ?? 0) + (y.receipts?.length ?? 0) }, 0)
  const strippedSources = sources.map((s) => ({ ...s, actMode: false, noActAuto: true, activities: [], subs: (s.subs ?? []).filter((q) => !q.actId), updated: now }))
  return {
    target: { ...target, activities: acts, subs, updated: now },
    sources: strippedSources,
    income: inc, expenses: exp,
    summary: { activities: acts.length, subs: subs.length, income: live(inc).length, expenses: live(exp).length, slips, balance, from: sources.map((s) => s.name) },
  }
}
