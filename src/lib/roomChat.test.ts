import { describe, expect, it } from 'vitest'
import { canChatIn, roomMsgs, roomSummaries, unreadChat } from './roomChat'
import type { ChatMsg } from './types'

const m = (id: string, n: number, at: number, fromAdmin: boolean, text = id): ChatMsg => ({ id, updated: at, n, text, at, fromAdmin, byId: fromAdmin ? 'a' : 'u', by: fromAdmin ? 'แอดมิน' : 'ผู้ช่วย' })
const list = [m('1', 4, 100, false), m('2', 4, 200, true), m('3', 4, 300, false), m('4', 1, 150, false), { ...m('5', 4, 400, false), deleted: true }]
describe('แชทห้องงาน ↔ แอดมิน', () => {
  it('ข้อความของห้องเรียงเก่า→ใหม่ ไม่นับที่ลบ ไม่ปนห้องอื่น', () => { expect(roomMsgs(list, 4).map((x) => x.id)).toEqual(['1', '2', '3']) })
  it('ยังไม่อ่าน: ฝั่งแอดมินนับของคนในห้อง · ฝั่งห้องนับของแอดมิน · หลังเวลาที่อ่านล่าสุด', () => {
    expect(unreadChat(list, 4, 'admin', 0).map((x) => x.id)).toEqual(['1', '3'])
    expect(unreadChat(list, 4, 'admin', 100).map((x) => x.id)).toEqual(['3'])
    expect(unreadChat(list, 4, 'room', 0).map((x) => x.id)).toEqual(['2'])
    expect(unreadChat(list, 4, 'room', 200)).toEqual([])
  })
  it('สรุปห้องสำหรับแอดมิน: ห้องที่มีข้อความ ใหม่สุดอยู่บน พร้อมจำนวนยังไม่อ่าน', () => {
    const s = roomSummaries(list, () => 0)
    expect(s.map((x) => [x.n, x.unread, x.total])).toEqual([[4, 2, 3], [1, 1, 1]])
    expect(roomSummaries(list, (n) => (n === 4 ? 300 : 0)).find((x) => x.n === 4)?.unread).toBe(0)
  })
  it('สิทธิ์เขียน: แอดมินทุกห้อง · สมาชิกเฉพาะห้องที่ได้รับกำหนด', () => {
    expect(canChatIn(9, { admin: true, works: [] })).toBe(true)
    expect(canChatIn(4, { admin: false, works: [4] })).toBe(true)
    expect(canChatIn(5, { admin: false, works: [4] })).toBe(false)
  })
})
