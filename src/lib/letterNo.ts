/**
 * เลขที่หนังสือแจ้งประชุม: เลขตามลำดับของชิ้นงานที่ยังอยู่ — ลบชิ้นกลาง ชิ้นหลังเลื่อนขึ้นมาเอง (ปิดช่องว่าง)
 * ฉบับที่ผู้ใช้แก้เลขเอง (noPin) ถือเลขนั้นไว้ ไม่ถูกเลื่อน · แยกกลุ่มตาม หมวด + ตัวย่อ (สามัญ ศอ/ปด · วิสามัญ ศอ/วส)
 */
export interface NoLetter { id: string; no: string; category?: string; noPin?: boolean; deleted?: boolean }
const PARSE = /^(.*?)[.\s-]*(\d+)$/
export function compactNumbers(letters: NoLetter[]): { id: string; no: string }[] {
  const groups = new Map<string, { pre: string; n: number; l: NoLetter }[]>()
  for (const l of letters) {
    if (l.deleted) continue
    const m = PARSE.exec(l.no.trim())
    if (!m || !m[1]) continue
    const key = `${l.category ?? ''}|${m[1]}`
    groups.set(key, [...(groups.get(key) ?? []), { pre: m[1], n: Number(m[2]), l }])
  }
  const out: { id: string; no: string }[] = []
  for (const rows of groups.values()) {
    const pinned = new Set(rows.filter((r) => r.l.noPin).map((r) => r.n))
    const autos = rows.filter((r) => !r.l.noPin).sort((a, b) => a.n - b.n || a.l.id.localeCompare(b.l.id))
    let k = 0
    for (const r of autos) {
      do k++; while (pinned.has(k))
      if (r.n !== k) out.push({ id: r.l.id, no: `${r.pre}.${String(k).padStart(3, '0')}` })
    }
  }
  return out
}
