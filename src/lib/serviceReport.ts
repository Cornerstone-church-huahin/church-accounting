import { withDocCredit } from './credit'
import { fmtDateLong } from './money'
import { groupCounts } from './pastoral'
import { isFirstTimer, regLevel, statusLabel } from './registry'
import type { CheckIn, ChurchMember } from './types'

/** สรุปการมานมัสการของวันหนึ่ง ไว้ส่งให้ผู้ประกาศ */
export interface ServiceReport {
  date: string
  total: number
  male: number
  female: number
  noGender: number
  /** แยกตามสถานะ (ไม่นับคนมาใหม่ซ้ำ) */
  complete: number
  reserve: number
  worshiper: number
  other: number
  newcomers: string[]
  /** จำนวนผู้มาแยกตามกลุ่ม (ชื่อกลุ่มตามทะเบียน เรียงตามเลขนำหน้า) */
  byGroup: [string, number][]
}

/** สรุปจากรายชื่อผู้มา (id + เป็นคนมาใหม่หรือไม่): ใช้ได้ทั้งข้อมูลลงชื่อในแอปและข้อมูลที่นำเข้าเดิม */
export function reportFromPeople(date: string, people: { id: string; isNew: boolean }[], members: ChurchMember[]): ServiceReport {
  const byId = new Map(members.map((m) => [m.id, m]))
  const r: ServiceReport = { date, total: 0, male: 0, female: 0, noGender: 0, complete: 0, reserve: 0, worshiper: 0, other: 0, newcomers: [], byGroup: [] }
  const here: ChurchMember[] = []
  for (const p of people) {
    const m = byId.get(p.id)
    if (!m) continue
    here.push(m)
    r.total++
    if (m.gender === 'ชาย') r.male++
    else if (m.gender === 'หญิง') r.female++
    else r.noGender++
    if (p.isNew) { r.newcomers.push(m.name); continue }
    const st = statusLabel(m.status)
    if (regLevel(m.status)) r.complete++
    else if (/สำรอง/.test(st)) r.reserve++
    else if (/ผู้ร่วมนมัสการ|คนใหม่/.test(st)) r.worshiper++ // สถานะ คนใหม่ ที่เคยมาแล้ว = มาต่อเนื่อง นับเป็นผู้ร่วมนมัสการ
    else r.other++
  }
  r.byGroup = groupCounts(here)
  r.newcomers.sort((a, b) => a.localeCompare(b, 'th'))
  return r
}

export function serviceReport(checkins: CheckIn[], members: ChurchMember[], date: string): ServiceReport {
  const byId = new Map(members.map((m) => [m.id, m]))
  const ids = new Set(checkins.filter((c) => c.date === date && !c.deleted).map((c) => c.mid))
  const first = new Map<string, string>() // วันที่ลงชื่อครั้งแรกของแต่ละคน
  for (const c of checkins) if (!c.deleted && c.mid && (first.get(c.mid) ?? '9999') > c.date) first.set(c.mid, c.date)
  return reportFromPeople(date, [...ids].filter((id) => byId.has(id)).map((id) => ({ id, isNew: isFirstTimer(byId.get(id)!, date, first.get(id)) })), members)
}

export function reportText(r: ServiceReport): string {
  const lines = [`📋 สรุปนมัสการ ${fmtDateLong(r.date)}`, `ผู้เข้าร่วมทั้งหมด ${r.total} คน`, `• ชาย ${r.male} · หญิง ${r.female}${r.noGender ? ` · ไม่ระบุเพศ ${r.noGender}` : ''}`, `• สมาชิกสมบูรณ์ ${r.complete} คน`]
  if (r.byGroup?.length) lines.splice(3, 0, `• แยกกลุ่ม: ${r.byGroup.map(([g, n]) => `${g} ${n}`).join(' · ')}`)
  if (r.reserve) lines.push(`• สมาชิกสำรอง ${r.reserve} คน`)
  lines.push(`• ผู้ร่วมนมัสการ ${r.worshiper} คน`)
  if (r.other) lines.push(`• อื่น ๆ ${r.other} คน`)
  lines.push(r.newcomers.length ? `• คนมาใหม่ ${r.newcomers.length} คน: ${r.newcomers.join(', ')}` : '• คนมาใหม่ 0 คน')
  return withDocCredit(lines.join('\n'))
}

/** แชร์ข้อความผ่านเมนูแชร์ของเครื่อง (LINE / Messenger / Facebook) · ไม่มีเมนูแชร์ = คัดลอกไว้ให้วางในแชต */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') { await navigator.share({ title, text }); return 'shared' }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
  }
  try { await navigator.clipboard.writeText(text); return 'copied' } catch { return 'failed' }
}
