import type { DocAccess, DocItem } from './types'

export const DOC_KINDS = ['หนังสือเชิญ', 'เชิญประชุม', 'รายงานการประชุม', 'ประกาศ', 'บันทึกข้อความ', 'อื่น ๆ'] as const
export const ACCESS_LEVELS: DocAccess[] = ['ทั่วไป', 'ภายใน', 'ลับ']

/** เลขที่เอกสารถัดไปของปี (พ.ศ.) เช่น 003/2569 — นับต่อจากเลขสูงสุดของปีนั้น */
export function nextDocNo(docs: Pick<DocItem, 'no'>[], beYear: number): string {
  let max = 0
  for (const d of docs) { const m = /^(\d+)\s*\/\s*(\d{4})$/.exec(d.no.trim()); if (m && Number(m[2]) === beYear) max = Math.max(max, Number(m[1])) }
  return `${String(max + 1).padStart(3, '0')}/${beYear}`
}

/** เรียงจากเก่าไปใหม่: วันที่ → เลขที่ (เลขตามตัวเลข) → ชื่อ */
export function sortDocs<T extends Pick<DocItem, 'date' | 'no' | 'title'>>(docs: T[]): T[] {
  const num = (no: string) => { const m = /^(\d+)/.exec(no.trim()); return m ? Number(m[1]) : Infinity }
  return [...docs].sort((a, b) => a.date.localeCompare(b.date) || num(a.no) - num(b.no) || a.title.localeCompare(b.title, 'th'))
}

/** ข้อความทั้งหมดของเอกสารที่ค้นหาได้: ชื่อ เลขที่ หมวด ประเภท + เนื้อหาร่าง + เนื้อหาเอกสารจริงทุกฉบับ */
const bodyOf = (d: DocItem) => [d.draft, ...(d.finals ?? []).map((f) => f.body)].join('\n')
const headOf = (d: DocItem) => `${d.title} ${d.no} ${d.category} ${d.kind}`
/** ค้นหาจากชื่อ เลขที่ หมวด ประเภท และ "เนื้อหา" (พิมพ์หลายคำ = ต้องมีครบทุกคำ ไม่จำเป็นต้องอยู่ที่เดียวกัน) + กรองหมวด */
export function filterDocs(docs: DocItem[], q: string, category: string): DocItem[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return docs.filter((d) => {
    if (category && (d.category || 'ไม่ระบุหมวด') !== category) return false
    const all = `${headOf(d)}\n${bodyOf(d)}`.toLowerCase()
    return words.every((w) => all.includes(w))
  })
}
/** ข้อความสั้น ๆ รอบคำที่เจอในเนื้อหา (เฉพาะเมื่อคำนั้นไม่อยู่ในชื่อ/เลขที่/หมวด) ไว้แสดงใต้ชื่อในผลค้นหา */
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
export function categoriesOf(docs: Pick<DocItem, 'category'>[]): { name: string; n: number }[] {
  const m = new Map<string, number>()
  for (const d of docs) m.set(d.category || 'ไม่ระบุหมวด', (m.get(d.category || 'ไม่ระบุหมวด') ?? 0) + 1)
  return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

/** ใครเห็นเอกสารได้: ทั่วไป = ทุกคน · ภายใน = แอดมินและผู้ทำงานเลขา · ลับ = แอดมินเท่านั้น */
export const canSeeDoc = (access: DocAccess, who: { admin: boolean; editor: boolean }) => access === 'ทั่วไป' || (access === 'ภายใน' && (who.admin || who.editor)) || who.admin

/** แบ่งเนื้อหาเป็นหน้า A4 โดยประมาณ (หน้าแรกมีหัวเรื่อง จึงจุได้น้อยกว่า) */
export function splitPages(body: string, firstLines = 24, otherLines = 32, perLine = 62): string[] {
  const paras = body.replace(/\r/g, '').split('\n')
  const pages: string[][] = [[]]
  let used = 0, cap = firstLines
  for (const p of paras) {
    const need = Math.max(1, Math.ceil(p.length / perLine))
    if (used + need > cap && pages[pages.length - 1].length > 0) { pages.push([]); used = 0; cap = otherLines }
    pages[pages.length - 1].push(p); used += need
  }
  return pages.map((x) => x.join('\n'))
}

export const TEMPLATES: Record<string, string> = {
  'หนังสือเชิญ': 'เรียน ……………………………………\n\nด้วยคริสตจักรศิลาเอกจะจัด ……………………………………\nในวันที่ ……………… เวลา ……………… ณ ………………………………\n\nจึงขอเรียนเชิญท่านเข้าร่วม ตามวัน เวลา และสถานที่ดังกล่าว\n\nขอแสดงความนับถือ\n\n(……………………………………)\nตำแหน่ง ……………………………',
  'เชิญประชุม': 'เรียน กรรมการและผู้เกี่ยวข้องทุกท่าน\n\nคริสตจักรศิลาเอกขอเชิญประชุม ………………………………… ครั้งที่ ……/……\nวันที่ ……………… เวลา ……………… ณ ………………………………\n\nวาระการประชุม\n1. เรื่องแจ้งเพื่อทราบ\n2. รับรองรายงานการประชุมครั้งก่อน\n3. เรื่องเสนอเพื่อพิจารณา\n4. เรื่องอื่น ๆ\n\nจึงเรียนมาเพื่อโปรดเข้าร่วมประชุมตามวัน เวลา ดังกล่าว',
  'รายงานการประชุม': 'รายงานการประชุม ………………………………… ครั้งที่ ……/……\nวันที่ ……………… เวลา ……………… ณ ………………………………\n\nผู้เข้าประชุม\n1. ……………………………\n\nเริ่มประชุมเวลา ……………\n\nวาระที่ 1 เรื่องแจ้งเพื่อทราบ\nมติ/ข้อสรุป ……………………………\n\nวาระที่ 2 รับรองรายงานการประชุมครั้งก่อน\nมติ ……………………………\n\nเลิกประชุมเวลา ……………\n\nผู้บันทึกรายงาน ……………………………',
  'ประกาศ': 'ประกาศคริสตจักรศิลาเอก\nเรื่อง ……………………………………\n\nด้วย ………………………………………………………\n\nจึงประกาศมาเพื่อทราบโดยทั่วกัน\n\nประกาศ ณ วันที่ ………………',
  'บันทึกข้อความ': 'เรื่อง ……………………………………\nเรียน ……………………………………\n\n……………………………………………………………………\n\n(……………………………………)',
}
