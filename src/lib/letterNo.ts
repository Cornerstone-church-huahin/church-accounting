/**
 * เลขที่หนังสือแจ้งประชุม = ลำดับของชิ้นงาน (แถวการประชุม) ในกลุ่มนั้น: ชิ้นที่ 1 → 001, ชิ้นที่ 2 → 002 …
 * ลบชิ้นกลาง ชิ้นหลังเลื่อนขึ้นเอง · ฉบับที่ผู้ใช้แก้เลขเอง (noPin) คงเลขที่แก้ · สามัญ/วิสามัญนับแยกกลุ่ม
 */
export interface NoLetter { id: string; no: string; category?: string; noPin?: boolean; deleted?: boolean }
/** แถวชิ้นงานเรียงตามลำดับ (เก่า → ใหม่) · group = สามัญ/วิสามัญ · letter = หนังสือที่ผูกกับชิ้นนั้น (ถ้ามี) */
export interface NoRow { group: string; letter?: NoLetter }
const PARSE = /^(.*?)[.\s-]*(\d+)$/
export const padNo = (pre: string, n: number) => `${pre}.${String(n).padStart(3, '0')}`
export function rankChanges(rows: NoRow[]): { id: string; no: string }[] {
  const rank = new Map<string, number>()
  const out: { id: string; no: string }[] = []
  for (const r of rows) {
    const k = (rank.get(r.group) ?? 0) + 1
    rank.set(r.group, k)
    const l = r.letter
    if (!l || l.deleted || l.noPin) continue
    const m = PARSE.exec(l.no.trim())
    if (!m || !m[1]) continue
    const want = padNo(m[1], k)
    if (want !== l.no.trim()) out.push({ id: l.id, no: want })
  }
  return out
}
