import type { DocAccess, DocItem } from './types'

export const ACCESS_LEVELS: DocAccess[] = ['ทั่วไป', 'ภายใน', 'ลับ']
export const NO_CATEGORY = 'ไม่ระบุหมวด'
export const MAX_DOC_BYTES = 15 * 1024 * 1024

/** เลขที่เอกสารถัดไปของปี (พ.ศ.) เช่น 003/2569 — นับต่อจากเลขสูงสุดของปีนั้น */
export function nextDocNo(docs: Pick<DocItem, 'no'>[], beYear: number): string {
  let max = 0
  for (const d of docs) { const m = /^(\d+)\s*\/\s*(\d{4})$/.exec(d.no.trim()); if (m && Number(m[2]) === beYear) max = Math.max(max, Number(m[1])) }
  return `${String(max + 1).padStart(3, '0')}/${beYear}`
}

const num = (no: string) => { const m = /^(\d+)/.exec(no.trim()); return m ? Number(m[1]) : Infinity }
/** เรียงจากเก่าไปใหม่: วันที่ → เลขที่ (ตามตัวเลข) → ชื่อ */
export function sortDocs<T extends Pick<DocItem, 'date' | 'no' | 'title'>>(docs: T[]): T[] {
  return [...docs].sort((a, b) => a.date.localeCompare(b.date) || num(a.no) - num(b.no) || a.title.localeCompare(b.title, 'th'))
}
/** ใหม่สุดอยู่บน เก่าสุดอยู่ล่าง (แสดงในคลัง) */
export const sortNewestFirst = <T extends Pick<DocItem, 'date' | 'no' | 'title'>>(docs: T[]): T[] => sortDocs(docs).reverse()

const bodyOf = (d: DocItem) => [d.note ?? '', d.draft ?? '', ...(d.finals ?? []).map((f) => f.body), d.file?.name ?? ''].join('\n')
const headOf = (d: DocItem) => `${d.title} ${d.no} ${d.category} ${d.kind ?? ''}`
/** ค้นหาจากชื่อ เลขที่ หมวด หมายเหตุ ชื่อไฟล์ (พิมพ์หลายคำ = ต้องมีครบทุกคำ) + กรองหมวด */
export function filterDocs(docs: DocItem[], q: string, category: string): DocItem[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return docs.filter((d) => {
    if (category && (d.category || NO_CATEGORY) !== category) return false
    const all = `${headOf(d)}\n${bodyOf(d)}`.toLowerCase()
    return words.every((w) => all.includes(w))
  })
}
/** ข้อความสั้น ๆ รอบคำที่เจอนอกชื่อ/เลขที่/หมวด (เช่น ในหมายเหตุ) ไว้แสดงใต้ชื่อในผลค้นหา */
export function snippetOf(d: DocItem, q: string, radius = 28): string {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const head = headOf(d).toLowerCase()
  const text = bodyOf(d).replace(/\s+/g, ' ')
  const low = text.toLowerCase()
  for (const w of words) {
    if (head.includes(w)) continue
    const i = low.indexOf(w)
    if (i >= 0) return `${i > radius ? '…' : ''}${text.slice(Math.max(0, i - radius), i + w.length + radius)}${i + w.length + radius < text.length ? '…' : ''}`
  }
  return ''
}

/** รายชื่อหมวดทั้งหมด: หมวดที่ตั้งไว้ + หมวดที่มีเอกสารใช้อยู่ (กันหมวดเก่าหาย) พร้อมจำนวนเอกสาร */
export function categoriesOf(docs: Pick<DocItem, 'category'>[], managed: string[] = []): { name: string; n: number }[] {
  const m = new Map<string, number>()
  for (const c of managed) m.set(c, 0)
  for (const d of docs) { const k = d.category || NO_CATEGORY; m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => (a.name === NO_CATEGORY ? 1 : b.name === NO_CATEGORY ? -1 : a.name.localeCompare(b.name, 'th')))
}

/** ใครเห็นเอกสารได้: ทั่วไป = ทุกคน · ภายใน = แอดมินและผู้ทำงานเลขา · ลับ = แอดมินเท่านั้น */
export const canSeeDoc = (access: DocAccess, who: { admin: boolean; editor: boolean }) => access === 'ทั่วไป' || (access === 'ภายใน' && (who.admin || who.editor)) || who.admin

export const fileExt = (name: string) => (name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
export const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
export const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
