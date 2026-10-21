import { describe, expect, it } from 'vitest'
import { blankAgenda, blankMeeting, blankPerson, carryOver, letterDate, nextNo, refNo, stepStatuses } from './meetings'
import { defaultNoticeBody, orderedAgenda, timeTh } from '../components/meeting/docs'
import type { Meeting } from './types'

const full = (): Meeting => ({ ...blankMeeting(2026, 3), name: 'การประชุมคณะธรรมกิจ', date: '2026-11-15', time: '18:30', place: 'ห้องประชุม', chair: 'ก', secretary: 'ข', people: [{ ...blankPerson(), name: 'ค' }] })
describe('ศูนย์จัดการประชุม', () => {
  it('วันที่แบบหนังสือ · เลขที่หนังสือ · เวลา', () => {
    expect(letterDate('2026-10-17')).toBe('17 ตุลาคม 2026')
    expect(letterDate('x')).toBe('')
    expect(refNo({ no: 3, year: 2026 })).toBe('ศอ 3/2026')
    expect(timeTh('09:05')).toBe('09.05 น.')
  })
  it('เลขครั้งถัดไปของปีนั้น', () => {
    expect(nextNo([{ no: 2, year: 2026 }, { no: 5, year: 2025 }], 2026)).toBe(3)
    expect(nextNo([], 2026)).toBe(1)
  })
  it('ขั้น 1: ครบเมื่อกรอกข้อมูลพื้นฐานและมีรายชื่อ', () => {
    expect(stepStatuses(blankMeeting(2026, 1))[1].state).toBe('todo')
    const m = full()
    expect(stepStatuses(m)[1].state).toBe('done')
    expect(stepStatuses({ ...m, people: [] })[1].state).toBe('partial')
    expect(stepStatuses({ ...m, chair: '' })[1].state).toBe('partial')
  })
  it('ขั้น 2–3: ต้องมีวาระ + ประธานเห็นชอบ + แจ้งประชุมแล้ว', () => {
    const m = { ...full(), agenda: [{ ...blankAgenda(), title: 'เรื่อง ก' }] }
    expect(stepStatuses(m)[2].state).toBe('partial')
    const ok = { ...m, agendaOk: { by: 'ก', at: 1 } }
    expect(stepStatuses(ok)[2].state).toBe('done')
    expect(stepStatuses(ok)[3].state).toBe('todo')
    expect(stepStatuses({ ...ok, notice: { channels: ['อีเมล'] } })[3].state).toBe('partial')
    expect(stepStatuses({ ...ok, notice: { channels: ['อีเมล'], sentAt: 5 } })[3].state).toBe('done')
  })
  it('วาระเรียงตามกลุ่มและมีเลขข้อ · ข้อความหนังสือเชิญมาจากข้อมูลการประชุม', () => {
    const m = { ...full(), agenda: [{ ...blankAgenda(), title: 'เสนอ', group: 'เรื่องเสนอพิจารณา' as const }, { ...blankAgenda(), title: 'ทราบ', group: 'แจ้งเพื่อทราบ' as const, purpose: 'ทราบ' as const }, { ...blankAgenda(), title: '' }] }
    expect(orderedAgenda(m).map((x) => [x.n, x.item.title])).toEqual([[1, 'ทราบ'], [2, 'เสนอ']])
    const b = defaultNoticeBody(m)
    expect(b).toContain('ครั้งที่ 3/2026') && expect(b).toContain('15 พฤศจิกายน 2026') && expect(b).toContain('18.30 น.')
  })
  it('เรื่องค้างจากครั้งก่อน: เลื่อนพิจารณา/มีเงื่อนไข/งานที่ยังไม่เสร็จ', () => {
    const prev: Meeting = { ...full(), id: 'p', date: '2026-10-01', agenda: [
      { ...blankAgenda(), id: 'a1', title: 'เลื่อน', minute: { result: 'เลื่อนพิจารณา' } }, { ...blankAgenda(), id: 'a2', title: 'เสร็จ', minute: { result: 'เห็นชอบ' } },
      { ...blankAgenda(), id: 'a3', title: 'งานค้าง', minute: { result: 'เห็นชอบ', assignee: 'ง', due: '2026-10-30' } }, { ...blankAgenda(), id: 'a4', title: 'งานเสร็จ', minute: { result: 'เห็นชอบ', assignee: 'ง', done: true } }] }
    const cur: Meeting = { ...full(), id: 'c', date: '2026-11-15' }
    expect(carryOver([prev, cur], cur).map((a) => a.title)).toEqual(['เลื่อน', 'งานค้าง'])
    expect(carryOver([cur], cur)).toEqual([])
  })
})
