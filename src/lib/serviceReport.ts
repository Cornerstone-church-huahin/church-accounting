import { fmtDateLong } from './money'
import { regLevel, statusLabel } from './registry'
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
}

const isNewcomer = (m: ChurchMember, date: string) => /คนใหม่/.test(m.status ?? '') || m.since === date

export function serviceReport(checkins: CheckIn[], members: ChurchMember[], date: string): ServiceReport {
  const byId = new Map(members.map((m) => [m.id, m]))
  const ids = new Set(checkins.filter((c) => c.date === date && !c.deleted).map((c) => c.mid))
  const r: ServiceReport = { date, total: 0, male: 0, female: 0, noGender: 0, complete: 0, reserve: 0, worshiper: 0, other: 0, newcomers: [] }
  for (const id of ids) {
    const m = byId.get(id)
    if (!m) continue
    r.total++
    if (m.gender === 'ชาย') r.male++
    else if (m.gender === 'หญิง') r.female++
    else r.noGender++
    if (isNewcomer(m, date)) { r.newcomers.push(m.name); continue }
    const st = statusLabel(m.status)
    if (regLevel(m.status)) r.complete++
    else if (/สำรอง/.test(st)) r.reserve++
    else if (/ผู้ร่วมนมัสการ/.test(st)) r.worshiper++
    else r.other++
  }
  r.newcomers.sort((a, b) => a.localeCompare(b, 'th'))
  return r
}

export function reportText(r: ServiceReport): string {
  const lines = [`📋 สรุปนมัสการ ${fmtDateLong(r.date)}`, `ผู้เข้าร่วมทั้งหมด ${r.total} คน`, `• ชาย ${r.male} · หญิง ${r.female}${r.noGender ? ` · ไม่ระบุเพศ ${r.noGender}` : ''}`, `• สมาชิกสมบูรณ์ ${r.complete} คน`]
  if (r.reserve) lines.push(`• สมาชิกสำรอง ${r.reserve} คน`)
  lines.push(`• ผู้ร่วมนมัสการ ${r.worshiper} คน`)
  if (r.other) lines.push(`• อื่น ๆ ${r.other} คน`)
  lines.push(r.newcomers.length ? `• คนมาใหม่ ${r.newcomers.length} คน: ${r.newcomers.join(', ')}` : '• คนมาใหม่ 0 คน')
  return lines.join('\n')
}
