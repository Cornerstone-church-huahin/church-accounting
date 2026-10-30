import type { VisitPlan } from './types'

export interface PlanItem { id: string; name: string; g: number }
export interface PlanDoc { items: PlanItem[]; groups: number; names: Record<string, string>; prep?: VisitPlan['prep'] }
export interface PlanGroup { g: number; name: string; items: PlanItem[] }

/** แผนเยี่ยม 1 วัน: รายชื่อ (เรียงลำดับ) แบ่งเป็นกลุ่มที่ 1, 2, 3 … (เช่น ชุดที่ไปสถานที่เดียวกัน/โซนเดียวกัน) · กลุ่มมีชื่อสถานที่ตั้งได้ */
export function planDoc(p?: Pick<VisitPlan, 'items' | 'groups' | 'names' | 'v' | 'prep'>): PlanDoc {
  const items = (p?.items ?? []).map((x) => ({ id: x.id, name: x.name, g: p?.v === 2 ? Math.max(0, Math.round(x.g ?? 0)) : 0 }))
  const groups = Math.max(1, p?.groups ?? 1, ...items.map((x) => x.g))
  return { items, groups, names: { ...(p?.names ?? {}) }, ...(p?.prep ? { prep: p.prep } : {}) }
}
/** จัดเรียงตามกลุ่ม (ลำดับในกลุ่มคงเดิม) */
const tidy = (d: PlanDoc): PlanDoc => ({ ...d, items: [...d.items].sort((a, b) => a.g - b.g) })
export const groupsOf = (d: PlanDoc): PlanGroup[] => Array.from({ length: d.groups }, (_, i) => ({ g: i + 1, name: d.names[String(i + 1)] ?? '', items: d.items.filter((x) => x.g === i + 1) }))

/** ใส่ตะกร้า: g = 0 = ยังไม่กำหนดจุดเยี่ยม (อยู่บนสุด) · จุดเดียวกันจัดอยู่ติดกันอัตโนมัติ ตามลำดับที่เลือก */
export const addItem = (d: PlanDoc, m: { id: string; name: string }, g = 0): PlanDoc => {
  if (d.items.some((x) => x.id === m.id)) return d
  return tidy({ ...d, groups: Math.max(d.groups, g), items: [...d.items, { id: m.id, name: m.name, g }] })
}
/** กำหนดจุดเยี่ยมที่ g ให้คนนี้ (0 = ยกเลิกจุด) · ไปต่อท้ายลำดับของจุดนั้น = ตามลำดับที่เลือก */
export function setStop(d: PlanDoc, id: string, g: number): PlanDoc {
  const it = d.items.find((x) => x.id === id); if (!it) return d
  const stop = Math.max(0, Math.min(99, Math.round(g)))
  return tidy({ ...d, groups: Math.max(d.groups, stop), items: [...d.items.filter((x) => x.id !== id), { ...it, g: stop }] })
}
/** จุดที่มีคนอยู่ เรียงเลขจุด (ลำดับในจุด = ลำดับที่เลือก) */
export const stopsOf = (d: PlanDoc): PlanGroup[] => groupsOf(d).filter((x) => x.items.length > 0)
export const removeItem = (d: PlanDoc, id: string): PlanDoc => ({ ...d, items: d.items.filter((x) => x.id !== id) })
/** เลื่อนขึ้น/ลงภายในกลุ่มเดียวกัน */
export function moveWithin(d: PlanDoc, id: string, dir: -1 | 1): PlanDoc {
  const it = d.items.find((x) => x.id === id); if (!it) return d
  const peers = d.items.filter((x) => x.g === it.g), i = peers.findIndex((x) => x.id === id), j = i + dir
  if (j < 0 || j >= peers.length) return d
  const a = d.items.indexOf(peers[i]), b = d.items.indexOf(peers[j])
  const items = [...d.items]; [items[a], items[b]] = [items[b], items[a]]
  return { ...d, items }
}
/** ย้ายไปกลุ่มอื่น (ไปต่อท้ายกลุ่มนั้น) · g = groups+1 = สร้างกลุ่มใหม่ */
export function moveToGroup(d: PlanDoc, id: string, g: number): PlanDoc {
  const it = d.items.find((x) => x.id === id); if (!it || it.g === g) return d
  return tidy({ ...d, groups: Math.max(d.groups, g), items: [...d.items.filter((x) => x.id !== id), { ...it, g }] })
}
export const addGroup = (d: PlanDoc): PlanDoc => ({ ...d, groups: d.groups + 1 })
/** ลบกลุ่มที่ว่าง (เลขกลุ่มถัดไปเลื่อนขึ้น) · มีคนอยู่ = ไม่ลบ · เหลือกลุ่มเดียว = ไม่ลบ */
export function removeGroup(d: PlanDoc, g: number): PlanDoc {
  if (d.groups <= 1 || d.items.some((x) => x.g === g)) return d
  const names: Record<string, string> = {}
  for (const [k, v] of Object.entries(d.names)) { const n = Number(k); if (n < g) names[k] = v; else if (n > g) names[String(n - 1)] = v }
  return { groups: d.groups - 1, names, items: d.items.map((x) => (x.g > g ? { ...x, g: x.g - 1 } : x)) }
}
export const renameGroup = (d: PlanDoc, g: number, name: string): PlanDoc => { const names = { ...d.names }; if (name.trim()) names[String(g)] = name.slice(0, 40); else delete names[String(g)]; return { ...d, names } }

/** ลากวาง: ย้ายคนไปกลุ่ม g ที่ตำแหน่ง index (นับในกลุ่มนั้นหลังเอาตัวเองออกแล้ว) · g = จำนวนกลุ่ม+1 = สร้างกลุ่มใหม่ */
export function moveTo(d: PlanDoc, id: string, g: number, index: number): PlanDoc {
  const it = d.items.find((x) => x.id === id); if (!it) return d
  const rest = d.items.filter((x) => x.id !== id)
  const groups = Math.max(d.groups, g)
  const out: PlanItem[] = []
  for (let k = 1; k <= groups; k++) {
    const list = rest.filter((x) => x.g === k)
    if (k === g) list.splice(Math.max(0, Math.min(index, list.length)), 0, { ...it, g })
    out.push(...list)
  }
  return { ...d, groups, items: out }
}

/** ลากเรียงลำดับในตะกร้า: ย้ายคนไปตำแหน่ง index (นับหลังเอาตัวเองออกแล้ว) · ลำดับในแต่ละจุดเรียงตามลำดับนี้ */
export function moveItem(d: PlanDoc, id: string, index: number): PlanDoc {
  const it = d.items.find((x) => x.id === id); if (!it) return d
  const rest = d.items.filter((x) => x.id !== id)
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, it)
  return tidy({ ...d, items: rest })
}

/** สีประจำจุดเยี่ยม (พื้นแถว · สีเข้มของวงกลมเลข) */
export const STOP_COLORS: { tint: string; dark: string }[] = [
  { tint: '#e3f3e6', dark: '#2e7d4f' }, { tint: '#e6eefb', dark: '#2f5fa8' }, { tint: '#fdf1d8', dark: '#a8741a' }, { tint: '#f6e3f1', dark: '#9b3b86' }, { tint: '#e0f4f4', dark: '#1f7f84' },
  { tint: '#fbe6e2', dark: '#b4442f' }, { tint: '#ece8f8', dark: '#5a47a6' }, { tint: '#eef3d9', dark: '#6b7d1c' }, { tint: '#f3e9e0', dark: '#7a5236' }, { tint: '#e9ecef', dark: '#4a5560' },
]
export const stopColor = (g: number) => STOP_COLORS[(Math.max(1, g) - 1) % STOP_COLORS.length]

/** ส่งข้อมูลเตรียมเยี่ยมไปหน้า “บันทึกการเยี่ยม”: ต้องกำหนดจุดครบทุกคน · เก็บสำเนาเรียงตามจุด 1, 2, 3 … */
export function sendPrep(d: PlanDoc, at: number): PlanDoc | null {
  if (d.items.length === 0 || d.items.some((x) => x.g < 1)) return null
  return { ...d, prep: { at, items: tidy(d).items.map((x) => ({ id: x.id, name: x.name, g: x.g })) } }
}
