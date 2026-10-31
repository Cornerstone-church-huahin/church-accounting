import { addDays } from './money'
import { statusLabel } from './registry'
import type { Attendance, ChurchMember } from './types'

export const NEW_MONTHS = 3        // คนใหม่ที่มานมัสการครบกี่เดือน → ผู้ร่วมนมัสการ
export const WORSHIP_MONTHS = 12   // ผู้ร่วมนมัสการต่อเนื่องกี่เดือน → สมาชิกสำรอง
export const ACTIVE_DAYS = 90      // “ต่อเนื่อง” = ยังมานมัสการภายในกี่วันล่าสุด

/** เดือนเต็มจากวันที่หนึ่งถึงอีกวัน (นับเมื่อวันที่ถึงเลขวันเดียวกัน) */
export function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number), [ty, tm, td] = toIso.split('-').map(Number)
  return Math.max(0, (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0))
}
export interface StatusMove { m: ChurchMember; from: string; to: string; why: string }
/**
 * เสนอเปลี่ยนสถานะอัตโนมัติ (เฉพาะ 2 กรณี):
 * · คนใหม่ → ผู้ร่วมนมัสการ : มานมัสการมาแล้ว ≥ 3 เดือน (นับจากครั้งแรกที่มี: บันทึกในระบบ หรือวันมาครั้งแรกที่ระบุ) และยังมาภายใน 90 วันล่าสุด
 * · ผู้ร่วมนมัสการ → สมาชิกสำรอง : เป็นผู้ร่วมนมัสการต่อเนื่อง > 1 ปี (นับจากวันที่เปลี่ยนเป็นสถานะนี้ ถ้าไม่ทราบ นับจากครั้งแรก + 3 เดือน) และยังมาภายใน 90 วันล่าสุด
 * ไม่มีข้อมูลการมาเลย = ไม่เปลี่ยน · สถานะอื่นไม่แตะ
 */
export function proposeStatusMoves(members: ChurchMember[], attendance: Attendance[], today: string): StatusMove[] {
  const first = new Map<string, string>(), last = new Map<string, string>()
  for (const a of attendance) {
    if (a.deleted) continue
    for (const id of a.ids) {
      if (!first.has(id) || a.date < first.get(id)!) first.set(id, a.date)
      if (!last.has(id) || a.date > last.get(id)!) last.set(id, a.date)
    }
  }
  const out: StatusMove[] = []
  const activeFrom = addDays(today, -ACTIVE_DAYS)
  for (const m of members) {
    if (m.deleted) continue
    const st = statusLabel(m.status)
    const rec = first.get(m.id)
    const start = [rec, m.firstWorship].filter(Boolean).sort()[0]
    const l = last.get(m.id)
    if (!start || !l || l < activeFrom) continue
    if (st === 'คนใหม่') {
      const mo = monthsBetween(start, today)
      if (mo >= NEW_MONTHS) out.push({ m, from: st, to: 'ผู้ร่วมนมัสการ', why: `มานมัสการมา ${mo} เดือน (ตั้งแต่ ${start})` })
    } else if (st === 'ผู้ร่วมนมัสการ') {
      const since = m.statusAt ?? addMonths(start, NEW_MONTHS)
      const mo = monthsBetween(since, today)
      if (mo > WORSHIP_MONTHS) out.push({ m, from: st, to: 'สมาชิกสำรอง', why: `เป็นผู้ร่วมนมัสการต่อเนื่อง ${mo} เดือน` })
    }
  }
  return out
}
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, d))
  if (t.getUTCDate() !== d) t.setUTCDate(0)
  return t.toISOString().slice(0, 10)
}
