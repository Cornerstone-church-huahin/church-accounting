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

/** แถวกิจกรรมในตัวช่วยแบ่งกองทุนเป็นกิจกรรม: selfSub = แปลงมาจากหมวดที่เป็นตัวกิจกรรมเอง (เช่น หมวด "วันคริสต์มาส") */
export interface WizRow { key: string; name: string; date: string; endDate?: string; selfSub?: string }
/** หมวดที่ชื่อเหมือนตัวกิจกรรม (เช่น วันขอบคุณพระเจ้า งานคริสต์มาส) — เดาให้แปลงเป็นกิจกรรมเอง */
export const looksLikeActivity = (name: string) => /^(วัน|งาน|กิจกรรม|เทศกาล)/.test(name.trim())

/**
 * เปิดโหมดกิจกรรมจากหมวดที่มีอยู่: แต่ละแถวเป็น 1 กิจกรรม · หมวดที่ selfSub ผูกกับแถวนั้นกลายเป็นหมวด "รายการทั่วไป" ของกิจกรรมนั้น
 * หมวดอื่นย้ายเข้ากิจกรรมตาม map (id หมวด → key แถว) · รายการรับ-จ่ายเดิมไม่หาย (ยังติด id หมวดเดิม)
 */
export function applyWizard(t: IncomeType, rows: WizRow[], map: Record<string, string>): Partial<IncomeType> | { error: string } {
  if (rows.length === 0) return { error: 'ต้องมีอย่างน้อย 1 กิจกรรม' }
  const ids: Record<string, string> = {}
  for (const r of rows) {
    if (!r.name.trim()) return { error: 'พิมพ์ชื่อกิจกรรมให้ครบทุกแถว' }
    if (!ISO.test(r.date)) return { error: `เลือกวันเริ่มของ “${r.name.trim()}”` }
    if (r.endDate && r.endDate < r.date) return { error: `วันสิ้นสุดของ “${r.name.trim()}” ต้องไม่ก่อนวันเริ่ม` }
    ids[r.key] = newId('ac')
  }
  const activities: FundActivity[] = rows.map((r) => ({ id: ids[r.key], name: r.name.trim(), date: r.date, ...(r.endDate && r.endDate !== r.date ? { endDate: r.endDate } : {}) }))
  const self = new Map(rows.filter((r) => r.selfSub).map((r) => [r.selfSub as string, ids[r.key]]))
  const subs = (t.subs ?? []).map((s) => {
    const own = self.get(s.id)
    if (own) return { ...s, name: 'รายการทั่วไป', actId: own }
    const key = map[s.id] && ids[map[s.id]] ? ids[map[s.id]] : ids[rows[0].key]
    return { ...s, actId: s.actId ?? key }
  })
  return { actMode: true, activities, subs }
}

/**
 * เปิดโหมดกิจกรรมอัตโนมัติ (ไม่ต้องตอบคำถาม): หมวดที่ชื่อเหมือนกิจกรรมกลายเป็นกิจกรรมของตัวเอง · หมวดอื่นอยู่ในกิจกรรมที่เริ่มเร็วสุด
 * ไม่มีหมวดเลย = เริ่มด้วยโหมดกิจกรรมที่ยังไม่มีการ์ด (เพิ่มกิจกรรมได้ที่หน้ากองทุน) · dateOf = วันที่รายการแรกของหมวด (ไม่มี = วันนี้)
 */
export function autoActivities(t: IncomeType, dateOf: (subId: string) => string | undefined, today: string): Partial<IncomeType> {
  const subs = (t.subs ?? []).filter((s) => s.active)
  if (subs.length === 0) return { actMode: true, activities: t.activities ?? [] }
  const own: WizRow[] = subs.filter((s) => looksLikeActivity(s.name)).map((s) => ({ key: `s-${s.id}`, name: s.name, date: dateOf(s.id) ?? today, selfSub: s.id }))
  const rows: WizRow[] = own.length ? own : [{ key: 'r0', name: 'กิจกรรมแรก', date: subs.map((s) => dateOf(s.id)).filter((d): d is string => !!d).sort()[0] ?? today }]
  const r = applyWizard(t, rows, {})
  return 'error' in r ? { actMode: true, activities: t.activities ?? [] } : r
}
