import { addDays } from './money'

export interface YM { y: number; m: number }
const p2 = (n: number) => String(n).padStart(2, '0')

/** วันอาทิตย์ทั้งหมดของเดือน (ISO) — 4 หรือ 5 วัน */
export function sundaysOfMonth(y: number, m: number): string[] {
  const first = `${y}-${p2(m)}-01`
  const dow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const out: string[] = []
  for (let d = addDays(first, (7 - dow) % 7); Number(d.slice(5, 7)) === m; d = addDays(d, 7)) out.push(d)
  return out
}
export const shiftMonth = ({ y, m }: YM, n: number): YM => { const i = y * 12 + (m - 1) + n; return { y: Math.floor(i / 12), m: (i % 12) + 1 } }
/** แผ่นละ 2 เดือนต่อเนื่อง: count เดือนเริ่มจาก start → [[เดือน1, เดือน2], …] (เดือนสุดท้ายอาจเหลือเดือนเดียว) */
export function monthPages(start: YM, count: number): YM[][] {
  const months = Array.from({ length: Math.max(1, count) }, (_, i) => shiftMonth(start, i))
  const pages: YM[][] = []
  for (let i = 0; i < months.length; i += 2) pages.push(months.slice(i, i + 2))
  return pages
}
/** "4/10/69" — วัน/เดือน/ปี พ.ศ. 2 หลัก ตามที่เขียนในใบประกาศกระดาษ */
export const shortThaiDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}/${m}/${(y + 543) % 100}` }
