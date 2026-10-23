import type { Announcement } from './types'

export const ALL_WORKS = 0
const key = (n: number) => `acct.ann.read.${n}`

/** ข่าวที่ส่งถึงงาน n (รวมข่าวถึงทุกงาน) ใหม่สุดอยู่บน */
export const forWork = (items: Announcement[], n: number) => items.filter((x) => !x.deleted && (x.works.includes(ALL_WORKS) || x.works.includes(n))).sort((a, b) => b.at - a.at)

/** รหัสข่าวที่เครื่องนี้อ่านแล้ว (แยกตามงาน) */
export function readIds(n: number): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key(n)) ?? '[]') as string[]) } catch { return new Set() }
}
export function markRead(n: number, ids: string[]) {
  try { localStorage.setItem(key(n), JSON.stringify([...new Set([...readIds(n), ...ids])])) } catch { /* ignore */ }
}
export const unreadOf = (list: Announcement[], read: Set<string>) => list.filter((x) => !read.has(x.id))
