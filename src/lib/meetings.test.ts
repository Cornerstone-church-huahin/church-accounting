import { describe, expect, it } from 'vitest'
import { assignedTasks, chairReviewed, CHAIR_ROLE, attendance, blankAgenda, blankMeeting, blankPerson, carryOver, hasVoteItems, letterDate, minuteComplete, moveAgenda, nextNo, prepKeys, previousMeeting, quorumNeeded, refNo, stepStatuses } from './meetings'
import { defaultNoticeBody, orderedAgenda, timeTh } from '../components/meeting/docs'
import { checkMinutes, minutesPlain } from '../components/meeting/minutes'
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
    expect(b).toContain('ครั้งที่ 3/2026')
    expect(b).toContain('15 พฤศจิกายน 2026')
    expect(b).toContain('18.30 น.')
  })
  it('เรื่องค้างจากครั้งก่อน: เลื่อนพิจารณา/มีเงื่อนไข/งานที่ยังไม่เสร็จ', () => {
    const prev: Meeting = { ...full(), id: 'p', date: '2026-10-01', agenda: [
      { ...blankAgenda(), id: 'a1', title: 'เลื่อน', minute: { result: 'เลื่อนพิจารณา' } }, { ...blankAgenda(), id: 'a2', title: 'เสร็จ', minute: { result: 'เห็นชอบ' } },
      { ...blankAgenda(), id: 'a3', title: 'งานค้าง', minute: { result: 'เห็นชอบ', assignee: 'ง', due: '2026-10-30' } }, { ...blankAgenda(), id: 'a4', title: 'งานเสร็จ', minute: { result: 'เห็นชอบ', assignee: 'ง', done: true } }] }
    const cur: Meeting = { ...full(), id: 'c', date: '2026-11-15' }
    expect(carryOver([prev, cur], cur).map((a) => a.title)).toEqual(['เลื่อน', 'งานค้าง'])
    expect(carryOver([cur], cur)).toEqual([])
  })
  it('ขั้น 4: รายการเตรียมเอกสารขึ้นกับวาระขอมติและรายงานครั้งก่อน', () => {
    const m = full()
    expect(prepKeys(m, [])).toEqual(['sign', 'agenda', 'form', 'c_cnt', 'c_names', 'c_date', 'c_attach'])
    const withVote = { ...m, agenda: [{ ...blankAgenda(), title: 'ขอมติ' }] }
    expect(hasVoteItems(withVote)).toBe(true)
    expect(prepKeys(withVote, [])).toContain('ballot')
    const prev: Meeting = { ...full(), id: 'p', date: '2026-10-01', agenda: [{ ...blankAgenda(), title: 'ก', minute: { summary: 'สรุป' } }] }
    expect(previousMeeting([prev, withVote], withVote)?.id).toBe('p')
    expect(prepKeys(withVote, [prev])).toContain('prev')
    const all = Object.fromEntries(prepKeys(m, []).map((k) => [k, true]))
    expect(stepStatuses({ ...m, prep: all })[4].state).toBe('done')
    expect(stepStatuses({ ...m, prep: { sign: true } })[4].state).toBe('partial')
  })
  it('ขั้น 5: องค์ประชุมนับเฉพาะกรรมการ/ผู้มีสิทธิ์ที่มา ไม่นับผู้เข้าร่วมเพิ่มเติม', () => {
    const ps = [{ ...blankPerson('กรรมการ'), name: 'ก', att: 'มา' as const }, { ...blankPerson('ผู้มีสิทธิ์ลงคะแนน'), name: 'ข', att: 'ลา' as const }, { ...blankPerson('กรรมการ'), name: 'ค' }, { ...blankPerson('ผู้เข้าร่วมอื่น'), name: 'ง', att: 'มา' as const }]
    const m: Meeting = { ...full(), people: ps }
    const a = attendance(m)
    expect([a.present.length, a.leave.length, a.unmarked.length, a.guests.length, a.voters.length]).toEqual([1, 1, 1, 1, 3])
    expect(quorumNeeded(m)).toBe(2)
    expect(quorumNeeded({ ...m, quorumMin: 3 })).toBe(3)
    expect(stepStatuses(m)[5].state).toBe('partial')
    expect(stepStatuses({ ...m, opened: { chair: 'ก', time: '18:30', agendaConfirmed: true, at: 1 } })[5].state).toBe('done')
  })
  it('ขั้น 6: วาระขอมติต้องมีมติ วาระอื่นต้องมีสาระ · ต้องมีเวลาเลิกประชุม', () => {
    expect(minuteComplete({ ...blankAgenda(), purpose: 'ขอมติ' })).toBe(false)
    expect(minuteComplete({ ...blankAgenda(), purpose: 'ขอมติ', minute: { result: 'เห็นชอบ' } })).toBe(true)
    expect(minuteComplete({ ...blankAgenda(), purpose: 'ทราบ', minute: { summary: ' ' } })).toBe(false)
    expect(minuteComplete({ ...blankAgenda(), purpose: 'ทราบ', minute: { summary: 'สรุป' } })).toBe(true)
    const ag = [{ ...blankAgenda(), title: 'ก', purpose: 'ทราบ' as const, minute: { summary: 'x' } }]
    expect(stepStatuses({ ...full(), agenda: ag })[6].state).toBe('partial')
    expect(stepStatuses({ ...full(), agenda: ag, closed: { time: '20:00' } })[6].state).toBe('done')
  })
  it('เลื่อนวาระภายในกลุ่มเดียวกันเท่านั้น', () => {
    const a = (id: string, g: 'แจ้งเพื่อทราบ' | 'เรื่องเสนอพิจารณา') => ({ ...blankAgenda(), id, title: id, group: g })
    const list = [a('1', 'แจ้งเพื่อทราบ'), a('2', 'เรื่องเสนอพิจารณา'), a('3', 'แจ้งเพื่อทราบ')]
    expect(moveAgenda(list, '3', -1).map((x) => x.id)).toEqual(['3', '2', '1'])
    expect(moveAgenda(list, '2', -1).map((x) => x.id)).toEqual(['1', '2', '3'])
  })
})

describe('ศูนย์จัดการประชุม ขั้น 7–10', () => {
  const base = (): Meeting => ({ ...blankMeeting(2026, 1), name: 'ประชุมกรรมการ', chair: 'ประธาน', secretary: 'เลขา' } as Meeting)
  it('ประธานตรวจใช้ได้เฉพาะฉบับร่างล่าสุด', () => {
    const m = { ...base(), drafts: [{ at: 1, by: 'x', note: '', text: 'a' }], chairOk: { by: 'ประธาน', at: 5, draftAt: 1 } }
    expect(chairReviewed(m)).toBe(true)
    expect(chairReviewed({ ...m, drafts: [...m.drafts, { at: 2, by: 'x', note: '', text: 'b' }] })).toBe(false)
  })
  it('สถานะขั้น 7–10 เดินตามลำดับ', () => {
    let m: Meeting = { ...base(), drafts: [{ at: 1, by: 'x', note: '', text: 'a' }] }
    expect(stepStatuses(m)[7].state).toBe('partial')
    m = { ...m, toChair: { at: 2 }, chairOk: { by: 'ประธาน', at: 3, draftAt: 1 }, signs: [{ role: CHAIR_ROLE, name: 'ประธาน', img: 'data:image/png;base64,AA' }] }
    expect(stepStatuses(m)[7].state).toBe('done')
    expect(stepStatuses(m)[8].state).toBe('todo')
    m = { ...m, distributed: { at: 4, channel: 'อีเมล' }, queuedNext: true, approval: { result: 'รับรองโดยไม่แก้ไข', date: '2026-12-13', atNo: '2/2026' } }
    expect([stepStatuses(m)[8].state, stepStatuses(m)[9].state, stepStatuses(m)[10].state]).toEqual(['done', 'done', 'partial'])
    expect(stepStatuses({ ...m, archived: { at: 9 } })[10].state).toBe('done')
    expect(stepStatuses({ ...m, approval: { ...m.approval!, result: 'ยังไม่รับรอง' } })[9].state).toBe('partial')
  })
  it('ตรวจรายงานและงานที่มอบหมาย', () => {
    const m = { ...base(), agenda: [{ ...blankAgenda(), title: 'งบ', purpose: 'ขอมติ' as const, minute: { assignee: 'นาย ก' } }] }
    expect(checkMinutes(m).errors).toBeGreaterThan(0)
    expect(assignedTasks(m)).toHaveLength(1)
    expect(minutesPlain(m)).toContain('ผู้รับผิดชอบ: นาย ก')
  })
})
