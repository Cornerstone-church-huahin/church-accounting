import type { ChurchMember } from './types'

/** ทำให้คำค้นทนต่อการสะกดผิด: ตัดวรรณยุกต์/ไม้ไต่คู้/การันต์ · ศ ษ→ส · ณ→น · ธ ฑ ฒ→ท · ภ→พ · ใ→ไ */
export const normThai = (s: string): string =>
  s.toLowerCase().replace(/[็-์]/g, '').replace(/[ศษ]/g, 'ส').replace(/ณ/g, 'น').replace(/ฌ/g, 'ช').replace(/[ธฑฒ]/g, 'ท').replace(/ภ/g, 'พ').replace(/ใ/g, 'ไ').replace(/\s+/g, ' ').trim()

const surname = (n: string) => { const w = n.trim().split(/\s+/); return w.length >= 2 ? w[w.length - 1] : '' }

/**
 * ค้นสมาชิกจากทะเบียน: ชื่อจริง นามสกุล ชื่อเล่น รหัส เบอร์ หมายเหตุ (พิมพ์หลายคำได้ สลับลำดับได้ ไม่ต้องสะกดตรงเป๊ะ)
 * + คนที่เกี่ยวข้อง (นามสกุลเดียวกัน · ที่อยู่เดียวกัน · หมายเหตุอ้างถึงกัน)
 */
export function searchMembers(all: ChurchMember[], q: string, limit = 40): { direct: ChurchMember[]; related: ChurchMember[] } {
  const toks = normThai(q).split(' ').filter(Boolean)
  if (!toks.length) return { direct: [], related: [] }
  const live = all.filter((m) => !m.deleted)
  const hay = (m: ChurchMember) => normThai(`${m.name ?? ''} ${m.nick ?? ''} ${m.code ?? ''} ${m.tel ?? ''} ${m.note ?? ''}`)
  const direct = live.filter((m) => { const h = hay(m); return toks.every((t) => h.includes(t)) })
  if (normThai(q).replace(/ /g, '').length < 3) return { direct: direct.slice(0, limit), related: [] }
  const ids = new Set(direct.map((m) => m.id))
  const related = live.filter((p) => !ids.has(p.id) && direct.some((d) => {
    const sd = normThai(surname(d.name ?? '')), sp = normThai(surname(p.name ?? ''))
    const ad = d.address?.trim(), pn = p.note ?? '', dn = d.note ?? ''
    return (sd.length >= 2 && sd === sp)
      || (!!ad && ad.length > 6 && p.address?.trim() === ad)
      || (pn.length > 0 && ((!!d.name && pn.includes(d.name)) || (!!d.nick?.trim() && d.nick.trim().length >= 2 && pn.includes(d.nick.trim()))))
      || (dn.length > 0 && !!p.name && dn.includes(p.name))
  }))
  return { direct: direct.slice(0, limit), related: related.slice(0, Math.max(0, limit - direct.length)) }
}
