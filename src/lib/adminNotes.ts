import type { AdminNote, GainStatus } from './types'

export const STATUS_LABEL: Record<GainStatus, string> = { todo: 'ยังไม่', part: 'บางส่วน', done: 'แบ่งเบาแล้ว' }
export const STATUS_ORDER: GainStatus[] = ['todo', 'part', 'done']
/** สัดส่วนที่นับของแต่ละสถานะ: ยังไม่ 0 · บางส่วน ครึ่งหนึ่ง · แบ่งเบาแล้ว เต็ม */
const FACTOR: Record<GainStatus, number> = { todo: 0, part: 0.5, done: 1 }
export const DEFAULT_WEIGHT = 5

export const gainsOf = (notes: AdminNote[], work: number) => notes.filter((x) => !x.deleted && x.work === work && x.kind === 'gain')

export interface Relief { pct: number; done: number; total: number; hoursSaved: number; hoursAll: number }
/** เปอร์เซ็นต์ที่แบ่งเบาให้ผู้อื่นแล้ว = Σ(น้ำหนัก × สัดส่วนสถานะ) ÷ Σ น้ำหนักทั้งหมด · ชั่วโมงที่ประหยัดได้ นับเต็มเมื่อแบ่งเบาแล้ว ครึ่งเมื่อบางส่วน */
export function relief(gains: Pick<AdminNote, 'weight' | 'status' | 'hours'>[]): Relief {
  let got = 0, all = 0, hs = 0, ha = 0, done = 0
  for (const g of gains) {
    const w = g.weight && g.weight > 0 ? g.weight : DEFAULT_WEIGHT, f = FACTOR[g.status ?? 'todo'], h = Math.max(0, g.hours ?? 0)
    all += w; got += w * f; ha += h; hs += h * f
    if (g.status === 'done') done++
  }
  return { pct: all ? Math.round((got / all) * 100) : 0, done, total: gains.length, hoursSaved: Math.round(hs * 10) / 10, hoursAll: Math.round(ha * 10) / 10 }
}
/** เปลี่ยนสถานะวนรอบ: ยังไม่ → บางส่วน → แบ่งเบาแล้ว → ยังไม่ */
export const nextStatus = (s: GainStatus | undefined): GainStatus => STATUS_ORDER[(STATUS_ORDER.indexOf(s ?? 'todo') + 1) % 3]
