import type { ChurchMember } from './types'

const FIELDS = ['lat', 'lng', 'workLat', 'workLng', 'placeLat', 'placeLng', 'placeName'] as const
export interface CoordBackupRow { id: string; name: string; lat?: number; lng?: number; workLat?: number; workLng?: number; placeLat?: number; placeLng?: number; placeName?: string }
export interface CoordBackup { kind: 'member-coords'; at: number; rows: CoordBackupRow[] }

/** สำรองพิกัดบ้าน/ที่ทำงาน/สถานที่นัดพบของสมาชิกที่มีพิกัด (เฉพาะพิกัด ไม่รวมข้อมูลส่วนตัวอื่น) */
export function buildBackup(members: ChurchMember[], at = Date.now()): CoordBackup {
  const rows: CoordBackupRow[] = []
  for (const m of members) {
    if (m.deleted) continue
    const has = FIELDS.some((f) => (m as unknown as Record<string, unknown>)[f] != null && (m as unknown as Record<string, unknown>)[f] !== '')
    if (!has) continue
    const r: CoordBackupRow = { id: m.id, name: m.name }
    for (const f of FIELDS) { const v = (m as unknown as Record<string, unknown>)[f]; if (v != null && v !== '') (r as unknown as Record<string, unknown>)[f] = v }
    rows.push(r)
  }
  return { kind: 'member-coords', at, rows }
}

export const parseBackup = (text: string): CoordBackup | null => {
  try { const o = JSON.parse(text) as CoordBackup; return o && o.kind === 'member-coords' && Array.isArray(o.rows) ? o : null } catch { return null }
}

/**
 * กู้พิกัดจากไฟล์สำรองเข้าทะเบียนปัจจุบัน: จับคู่ด้วยรหัส (ไม่เจอใช้ชื่อตรงกันเป๊ะและมีคนเดียว)
 * เติมเฉพาะพิกัดที่สมาชิกคนนั้น “ยังไม่มี” — ไม่ทับพิกัดที่มีอยู่แล้ว
 */
export function applyBackup(members: ChurchMember[], b: CoordBackup): { updates: ChurchMember[]; matched: number; filled: number; unmatched: string[] } {
  const live = members.filter((m) => !m.deleted)
  const byId = new Map(live.map((m) => [m.id, m]))
  const byName = new Map<string, ChurchMember[]>()
  for (const m of live) byName.set(m.name, [...(byName.get(m.name) ?? []), m])
  const out = new Map<string, ChurchMember>()
  let matched = 0, filled = 0
  const unmatched: string[] = []
  for (const r of b.rows) {
    const cand = byId.get(r.id) ?? (byName.get(r.name)?.length === 1 ? byName.get(r.name)![0] : undefined)
    if (!cand) { unmatched.push(r.name); continue }
    matched++
    const cur = out.get(cand.id) ?? { ...cand }
    let changed = false
    const homeEmpty = cur.lat == null || cur.lng == null
    const workEmpty = cur.workLat == null || cur.workLng == null
    const placeEmpty = cur.placeLat == null || cur.placeLng == null
    if (homeEmpty && r.lat != null && r.lng != null) { cur.lat = r.lat; cur.lng = r.lng; changed = true; filled++ }
    if (workEmpty && r.workLat != null && r.workLng != null) { cur.workLat = r.workLat; cur.workLng = r.workLng; changed = true; filled++ }
    if (placeEmpty && r.placeLat != null && r.placeLng != null) { cur.placeLat = r.placeLat; cur.placeLng = r.placeLng; if (r.placeName && !cur.placeName) cur.placeName = r.placeName; changed = true; filled++ }
    if (changed) out.set(cand.id, cur)
  }
  return { updates: [...out.values()], matched, filled, unmatched }
}
