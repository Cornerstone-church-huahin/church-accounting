import { diffDays } from './money'
import { statusLabel } from './registry'
import type { Attendance, ChurchMember, StatusRuleCfg } from './types'

/**
 * เกณฑ์ตั้งต้น (ปรับได้ในหน้า “เกณฑ์สถานะ”):
 * คนใหม่ → ผู้ร่วมนมัสการ : ผ่านมา ≥ 3 เดือนนับจากครั้งแรก · มา ≥ 4 ครั้งใน 3 เดือนล่าสุด · มาครบทั้ง 3 เดือน · ครั้งล่าสุดไม่เกิน 30 วัน
 * ผู้ร่วมนมัสการ → สมาชิกสำรอง : เป็นผู้ร่วมต่อเนื่องเกิน 12 เดือน · มา ≥ 18 ครั้งใน 12 เดือนล่าสุด · มา ≥ 9 จาก 12 เดือน · ครั้งล่าสุดไม่เกิน 30 วัน
 */
export const DEFAULT_STATUS_RULES: StatusRuleCfg = { newMonths: 3, newVisits: 4, newMonthsPresent: 3, newLastDays: 30, workMonths: 12, workVisits: 18, workMonthsPresent: 9, workLastDays: 30 }
export const effectiveStatusRules = (saved?: Partial<StatusRuleCfg>): StatusRuleCfg => ({ ...DEFAULT_STATUS_RULES, ...(saved ?? {}) })

/** เดือนเต็มจากวันที่หนึ่งถึงอีกวัน (นับเมื่อวันที่ถึงเลขวันเดียวกัน) */
export function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number), [ty, tm, td] = toIso.split('-').map(Number)
  return Math.max(0, (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0))
}
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, d))
  if (t.getUTCDate() !== d) t.setUTCDate(0)
  return t.toISOString().slice(0, 10)
}
export interface Freq { visits: number; monthsPresent: number; lastDays: number }
/** ความถี่ในช่วง months เดือนล่าสุด: จำนวนครั้ง · จำนวนเดือนที่มาอย่างน้อย 1 ครั้ง · ครั้งล่าสุดห่างกี่วัน */
export function frequency(dates: string[], today: string, months: number): Freq {
  const inWin = dates.filter((d) => d <= today && monthsBetween(d, today) < months)
  const last = dates.filter((d) => d <= today).sort().pop()
  return { visits: inWin.length, monthsPresent: new Set(inWin.map((d) => monthsBetween(d, today))).size, lastDays: last ? diffDays(today, last) : 9999 }
}
export interface StatusMove { m: ChurchMember; from: string; to: string; why: string }
/**
 * เสนอเปลี่ยนสถานะอัตโนมัติตามเกณฑ์ความถี่ (เฉพาะ 2 กรณี สถานะอื่นไม่แตะ) · วัดเฉพาะคนที่ระบบมีข้อมูลลงชื่อครอบคลุมช่วงที่ต้องวัด
 * (ถ้าระบบเริ่มบันทึกหลังจุดเริ่มของช่วง จะยังไม่ตัดสิน เพื่อไม่ให้คนที่มาจริงแต่ไม่มีบันทึกย้อนหลังดูเหมือนมาน้อย)
 */
export function proposeStatusMoves(members: ChurchMember[], attendance: Attendance[], today: string, cfg: StatusRuleCfg = DEFAULT_STATUS_RULES): StatusMove[] {
  const days = new Map<string, Set<string>>()
  let firstService = ''
  for (const a of attendance) {
    if (a.deleted || a.ids.length === 0) continue
    if (!firstService || a.date < firstService) firstService = a.date
    for (const id of a.ids) (days.get(id) ?? days.set(id, new Set()).get(id)!).add(a.date)
  }
  const out: StatusMove[] = []
  const covers = (months: number) => !!firstService && firstService <= addMonths(today, -months)
  for (const m of members) {
    if (m.deleted || m.statusLock) continue   // กำหนดสถานะเองแล้ว ระบบไม่เปลี่ยนให้
    const st = statusLabel(m.status)
    if (st !== 'คนใหม่' && st !== 'ผู้ร่วมนมัสการ') continue
    const ds = [...(days.get(m.id) ?? [])].sort()
    const start = [ds[0], m.firstWorship].filter(Boolean).sort()[0]
    if (!start) continue
    if (st === 'คนใหม่') {
      if (monthsBetween(start, today) < cfg.newMonths || !covers(cfg.newMonths)) continue
      const f = frequency(ds, today, cfg.newMonths)
      if (f.visits >= cfg.newVisits && f.monthsPresent >= cfg.newMonthsPresent && f.lastDays <= cfg.newLastDays)
        out.push({ m, from: st, to: 'ผู้ร่วมนมัสการ', why: `มา ${f.visits} ครั้ง ใน ${f.monthsPresent} เดือน (จาก ${cfg.newMonths}) · ครั้งล่าสุด ${f.lastDays} วันที่แล้ว` })
    } else {
      const since = m.statusAt ?? addMonths(start, cfg.newMonths)
      if (monthsBetween(since, today) <= cfg.workMonths || !covers(cfg.workMonths)) continue
      const f = frequency(ds, today, cfg.workMonths)
      if (f.visits >= cfg.workVisits && f.monthsPresent >= cfg.workMonthsPresent && f.lastDays <= cfg.workLastDays)
        out.push({ m, from: st, to: 'สมาชิกสำรอง', why: `ผู้ร่วมต่อเนื่อง ${monthsBetween(since, today)} เดือน · มา ${f.visits} ครั้ง ใน ${f.monthsPresent} เดือน (จาก ${cfg.workMonths}) · ครั้งล่าสุด ${f.lastDays} วันที่แล้ว` })
    }
  }
  return out
}
/** ใส่ผลการเปลี่ยนสถานะลงสมาชิก (บันทึกวันที่เปลี่ยน + จากอะไร เพราะอะไร) */
export const applyStatusMoves = (moves: StatusMove[], today: string, now: number): ChurchMember[] =>
  moves.map((v) => ({ ...v.m, status: v.to, statusAt: today, statusMoved: { from: v.from, at: now, why: v.why }, updated: now }))
/** คำเตือนเกณฑ์ที่ไม่สมเหตุสมผล เช่น จำนวนเดือนที่มาเกินกว่าช่วงที่วัด */
export function statusRuleWarnings(c: StatusRuleCfg): string[] {
  const w: string[] = []
  if (c.newMonthsPresent > c.newMonths) w.push(`คนใหม่: “มาครบกี่เดือน” (${c.newMonthsPresent}) มากกว่าช่วงที่วัด (${c.newMonths} เดือน) — ไม่มีใครผ่านได้`)
  if (c.workMonthsPresent > c.workMonths) w.push(`ผู้ร่วมนมัสการ: “มาครบกี่เดือน” (${c.workMonthsPresent}) มากกว่าช่วงที่วัด (${c.workMonths} เดือน) — ไม่มีใครผ่านได้`)
  if (c.newVisits < c.newMonthsPresent) w.push(`คนใหม่: จำนวนครั้ง (${c.newVisits}) น้อยกว่าจำนวนเดือนที่ต้องมา (${c.newMonthsPresent}) — ควรเท่ากันหรือมากกว่า`)
  if (c.workVisits < c.workMonthsPresent) w.push(`ผู้ร่วมนมัสการ: จำนวนครั้ง (${c.workVisits}) น้อยกว่าจำนวนเดือนที่ต้องมา (${c.workMonthsPresent}) — ควรเท่ากันหรือมากกว่า`)
  return w
}

export interface Review { m: ChurchMember; from: string; to: string; why: string; at: number; fits: boolean; nowWhy?: string }
/**
 * ตรวจรายการที่ระบบเปลี่ยนสถานะไปแล้ว (สถานะยังเป็นผลของการเปลี่ยนนั้นอยู่) ว่า “ตามเกณฑ์ปัจจุบัน” คนนั้นยังเข้าเกณฑ์ไหม
 * · ไม่เข้า (fits = false) = เปลี่ยนไปด้วยเกณฑ์เก่าที่หลวมกว่า → เสนอคืนสถานะเดิม
 */
export function reviewAutoMoves(members: ChurchMember[], attendance: Attendance[], today: string, cfg: StatusRuleCfg = DEFAULT_STATUS_RULES): Review[] {
  const out: Review[] = []
  for (const m of members) {
    if (m.deleted || !m.statusMoved || m.statusLock) continue
    if (statusLabel(m.status) === statusLabel(m.statusMoved.from)) continue   // กลับไปสถานะเดิมแล้ว
    const virtual = { ...m, status: m.statusMoved.from, statusAt: undefined, statusMoved: undefined } as ChurchMember
    const again = proposeStatusMoves([virtual], attendance, today, cfg).find((x) => x.to === statusLabel(m.status))
    out.push({ m, from: m.statusMoved.from, to: statusLabel(m.status), why: m.statusMoved.why, at: m.statusMoved.at, fits: !!again, nowWhy: again?.why })
  }
  return out.sort((a, b) => Number(a.fits) - Number(b.fits) || b.at - a.at)
}
/** คืนสถานะเดิมของรายการที่ระบบเปลี่ยนไป */
export const revertStatusMoves = (rs: Review[], now: number): ChurchMember[] =>
  rs.map((r) => ({ ...r.m, status: r.from, statusAt: undefined, statusMoved: undefined, updated: now }))
