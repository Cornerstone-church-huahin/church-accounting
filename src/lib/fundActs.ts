import type { FundAccount } from './fundAccounts'
import type { ActGoal, FundActivity, IncomeType } from './types'
import { newId } from './money'

/** กิจกรรมใหม่อยู่บนสุด (เรียงตามวันเริ่มกิจกรรม ใหม่→เก่า) */
export const sortedActs = (t?: IncomeType): FundActivity[] => [...(t?.activities ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
export const actSubIds = (t: IncomeType | undefined, actId: string): string[] => (t?.subs ?? []).filter((s) => s.actId === actId).map((s) => s.id)
/** หมวดของกิจกรรมที่ปิดแล้ว = บันทึกเพิ่ม/แก้ไม่ได้ */
export const lockedSubIds = (t?: IncomeType): string[] => (t?.activities ?? []).filter((a) => a.closed).flatMap((a) => actSubIds(t, a.id))

/** ยอดของกิจกรรม = รวมทุกหมวดของกิจกรรมนั้น (ไม่มียอดตั้งต้น) */
export function actAccount(f: FundAccount, ids: string[]) {
  const moves = f.moves.filter((m) => m.subId && ids.includes(m.subId))
  const moneyIn = moves.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0)
  const moneyOut = moves.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0)
  return { moves, moneyIn, moneyOut, balance: moneyIn - moneyOut }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }
/** จำนวนวันของกิจกรรม (นับวันเริ่มและวันสิ้นสุด) */
export const actDays = (a: Pick<FundActivity, 'date' | 'endDate'>) => Math.max(1, Math.round((utc(a.endDate ?? a.date) - utc(a.date)) / 86_400_000) + 1)
/** สิ้นสุดแล้ว = ปิดกิจกรรมแล้ว หรือผ่านวันสิ้นสุดไปแล้ว (การ์ดเป็นสีเทา) */
export const actEnded = (a: FundActivity, today: string) => !!a.closed || (a.endDate ?? a.date) < today
export function addActivity(t: IncomeType, name: string, date: string, endDate?: string): { activities: FundActivity[]; id: string } | { error: string } {
  const n = name.trim()
  if (!n) return { error: 'พิมพ์ชื่อกิจกรรม' }
  if (!ISO.test(date)) return { error: 'เลือกวันที่เริ่มกิจกรรม' }
  if (endDate && (!ISO.test(endDate) || endDate < date)) return { error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มกิจกรรม' }
  const acts = t.activities ?? []
  if (acts.some((a) => a.name === n && a.date === date)) return { error: 'มีกิจกรรมชื่อและวันที่นี้แล้ว' }
  const id = newId('ac')
  return { activities: [...acts, { id, name: n, date, ...(endDate && endDate !== date ? { endDate } : {}) }], id }
}
/** เปิดโหมดกิจกรรม: หมวดที่มีอยู่ทั้งหมดย้ายเข้ากิจกรรมแรก (ถ้ามีหมวด) · รายการเดิมไม่หาย */
export function enableActivities(t: IncomeType, firstName: string, firstDate: string): Partial<IncomeType> | { error: string } {
  const subs = t.subs ?? []
  if (subs.length === 0) return { actMode: true, activities: t.activities ?? [] }
  const r = addActivity({ ...t, activities: [] }, firstName, firstDate)
  if ('error' in r) return r
  return { actMode: true, activities: r.activities, subs: subs.map((s) => (s.actId ? s : { ...s, actId: r.id })) }
}
export const validScore = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100
/** ความคืบหน้าของเป้าหมาย: ทำแล้ว/ทั้งหมด และเปอร์เซ็นต์ */
export function goalProgress(a: FundActivity) {
  const goals = a.goals ?? []
  const done = goals.filter((g) => g.done).length
  return { done, total: goals.length, pct: goals.length ? Math.round((done / goals.length) * 100) : 0 }
}
export function addGoal(a: FundActivity, text: string): ActGoal[] | { error: string } {
  const t = text.trim()
  if (!t) return { error: 'พิมพ์เป้าหมายหรือขั้นตอนของงาน' }
  return [...(a.goals ?? []), { id: newId('gl'), text: t, done: false }]
}
export const toggleGoal = (a: FundActivity, id: string, today: string): ActGoal[] => (a.goals ?? []).map((g) => (g.id === id ? (g.done ? { id: g.id, text: g.text, done: false } : { ...g, done: true, doneDate: today }) : g))
