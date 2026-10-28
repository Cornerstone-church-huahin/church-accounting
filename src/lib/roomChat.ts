import type { ChatMsg } from './types'

export const CHAT_MAX = 600
const seenKey = (side: 'admin' | 'room', n: number) => `acct.chat.seen.${side}.${n}`

/** ข้อความของห้อง n เรียงเก่า → ใหม่ */
export const roomMsgs = (list: ChatMsg[], n: number) => list.filter((m) => !m.deleted && m.n === n).sort((a, b) => a.at - b.at || a.updated - b.updated)

/** ข้อความที่ผู้ดูยังไม่ได้อ่าน: ฝั่งแอดมินนับข้อความของคนในห้อง · ฝั่งห้องนับข้อความของแอดมิน (หลังเวลาที่เปิดอ่านล่าสุด) */
export const unreadChat = (list: ChatMsg[], n: number, side: 'admin' | 'room', seenAt: number) => roomMsgs(list, n).filter((m) => (side === 'admin' ? !m.fromAdmin : m.fromAdmin) && m.at > seenAt)

export const getSeen = (side: 'admin' | 'room', n: number): number => { try { return Number(localStorage.getItem(seenKey(side, n)) ?? 0) || 0 } catch { return 0 } }
export const setSeen = (side: 'admin' | 'room', n: number, at: number) => { try { localStorage.setItem(seenKey(side, n), String(at)) } catch { /* ignore */ } }

/** ฝั่งแอดมิน: สรุปแต่ละห้องที่มีข้อความ (ใหม่สุดอยู่บน) พร้อมจำนวนที่ยังไม่อ่าน */
export function roomSummaries(list: ChatMsg[], seen: (n: number) => number): { n: number; last: ChatMsg; unread: number; total: number }[] {
  const rooms = [...new Set(list.filter((m) => !m.deleted).map((m) => m.n))]
  return rooms.map((n) => { const ms = roomMsgs(list, n); return { n, last: ms[ms.length - 1], unread: unreadChat(list, n, 'admin', seen(n)).length, total: ms.length } }).sort((a, b) => b.last.at - a.last.at)
}

/** ใครเขียนในห้อง n ได้: แอดมินทุกห้อง · สมาชิกที่แอดมินกำหนดงาน n ให้ (ผู้ดูแล/ผู้ช่วย/ที่ปรึกษา) */
export const canChatIn = (n: number, who: { admin: boolean; works: number[] }) => who.admin || who.works.includes(n)
