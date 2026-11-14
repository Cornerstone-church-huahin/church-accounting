import { useMemo } from 'react'
import type { PickOption } from '../components/MultiPick'
import { searchMembers } from './memberSearch'
import type { ChurchMember } from './types'

/** ตัวช่วยเลือกคนจากทะเบียนสมาชิก (รูป + ค้นชื่อจริง/นามสกุล/ชื่อเล่น/ญาติ) */
export function usePeople(members: ChurchMember[]) {
  const byName = useMemo(() => new Map(members.map((m) => [m.name.replace(/^place:/, ''), m])), [members])
  const opt = (m: ChurchMember, sub?: string): PickOption => { const nm = m.name.replace(/^place:/, ''); return { value: nm, label: m.nick ? `${nm} (${m.nick})` : nm, avatar: { path: m.photoPath, member: m }, ...(sub ? { sub } : {}) } }
  const find = (q: string): PickOption[] => { const r = searchMembers(members, q); return [...r.direct.map((m) => opt(m)), ...r.related.map((m) => opt(m, 'เกี่ยวข้อง (นามสกุล/ที่อยู่/หมายเหตุเดียวกัน)'))] }
  const optOf = (n: string): PickOption => { const m = byName.get(n); return m ? opt(m) : { value: n, label: n } }
  return { byName, find, optOf }
}
export type People = ReturnType<typeof usePeople>

