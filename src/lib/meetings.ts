import { newId } from './money'
import type { Meeting, MtAgenda, MtPerson } from './types'

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
/** วันที่แบบหนังสือของคริสตจักร: “17 ตุลาคม 2026” (ค.ศ. ตามจดหมายตัวอย่าง) */
export function letterDate(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
/** เลขที่หนังสือ: “ศอ 3/2026” */
export const refNo = (m: Pick<Meeting, 'no' | 'year'>) => `ศอ ${m.no}/${m.year}`

export const blankMeeting = (year: number, no: number): Meeting => ({
  id: newId('mt'), updated: 0, name: '', no, year, type: 'ปกติ', date: '', time: '', place: '', chair: '', secretary: '', people: [], agenda: [],
})
export const blankPerson = (kind: MtPerson['kind'] = 'กรรมการ'): MtPerson => ({ id: newId('p'), name: '', kind })
export const blankAgenda = (): MtAgenda => ({ id: newId('ag'), title: '', group: 'เรื่องเสนอพิจารณา', purpose: 'ขอมติ' })

export const AGENDA_GROUPS: MtAgenda['group'][] = ['แจ้งเพื่อทราบ', 'รับรองรายงาน', 'ติดตามงาน', 'เรื่องเสนอพิจารณา']
export const PURPOSES: MtAgenda['purpose'][] = ['ทราบ', 'หารือ', 'ขอมติ']
export const KINDS: MtPerson['kind'][] = ['กรรมการ', 'ผู้มีสิทธิ์ลงคะแนน', 'ผู้เข้าร่วมอื่น']
export const CHANNELS = ['กลุ่ม LINE', 'อีเมล', 'เอกสารกระดาษ', 'โทรศัพท์']

/** การประชุมครั้งถัดไปของเลขครั้ง/ปีนี้ (เสนอเลขให้ตอนสร้างใหม่) */
export function nextNo(list: Pick<Meeting, 'no' | 'year'>[], year: number): number {
  return Math.max(0, ...list.filter((m) => m.year === year).map((m) => m.no)) + 1
}

export type StepState = 'done' | 'partial' | 'todo'
export interface StepStatus { state: StepState; /** ข้อความบอกสิ่งที่ยังขาด/สถานะสั้น ๆ */ hint: string }
const has = (s?: string) => !!s && s.trim().length > 0

/** เรื่องค้างจากครั้งก่อน: วาระในการประชุมก่อนหน้าที่ที่ประชุมเลื่อนพิจารณา มีเงื่อนไข หรืองานที่มอบหมายยังไม่เสร็จ */
export function carryOver(list: Meeting[], current: Meeting): MtAgenda[] {
  const prev = list.filter((m) => !m.deleted && m.id !== current.id && m.date && m.date < (current.date || '9999-12-31')).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!prev) return []
  return prev.agenda.filter((a) => a.minute && (a.minute.result === 'เลื่อนพิจารณา' || a.minute.result === 'มีเงื่อนไข' || (a.minute.assignee && !a.minute.done)))
}

/** สถานะของแต่ละขั้น (ใช้แสดงเครื่องหมายถูกด้านล่าง) — คำนวณจากข้อมูลที่กรอกจริงเท่านั้น */
/** การประชุมครั้งก่อนที่มีรายงาน (มีบันทึกสาระ/มติอย่างน้อย 1 วาระ) */
export function previousMeeting(list: Meeting[], m: Meeting): Meeting | undefined {
  return list.filter((x) => !x.deleted && x.id !== m.id && x.date && x.date < (m.date || '9999-12-31') && x.agenda.some((a) => a.minute && (a.minute.summary || a.minute.result))).sort((a, b) => b.date.localeCompare(a.date))[0]
}
export const hasVoteItems = (m: Meeting) => m.agenda.some((a) => a.title.trim() && a.purpose === 'ขอมติ')
/** รายการเตรียมเอกสารที่ต้องติ๊กครบก่อนถือว่าพร้อมประชุม (ขั้น 4) */
export function prepKeys(m: Meeting, list: Meeting[]): string[] {
  return ['sign', 'agenda', ...(previousMeeting(list, m) ? ['prev'] : []), 'form', ...(hasVoteItems(m) ? ['ballot'] : []), 'c_cnt', 'c_names', 'c_date', 'c_attach']
}

/** วาระนี้บันทึกครบแล้วหรือยัง: วาระที่ขอมติต้องมีมติ · วาระอื่นต้องมีสาระสำคัญหรือมติ */
export const minuteComplete = (a: MtAgenda) => (a.purpose === 'ขอมติ' ? !!a.minute?.result : !!(a.minute?.summary?.trim() || a.minute?.result))

export function stepStatuses(m: Meeting, list: Meeting[] = []): Record<number, StepStatus> {
  const required = [m.name, m.date, m.time, m.place, m.chair, m.secretary]
  const filled = required.filter(has).length + (m.no > 0 ? 1 : 0) + (m.year > 0 ? 1 : 0)
  const people = m.people.filter((p) => has(p.name))
  const s: Record<number, StepStatus> = {}
  s[1] = filled === 8 && people.length > 0 ? { state: 'done', hint: 'ข้อมูลพื้นฐานครบ' } : filled > 2 || people.length > 0 ? { state: 'partial', hint: `ยังขาด ${8 - filled + (people.length ? 0 : 1)} รายการ` } : { state: 'todo', hint: 'ยังไม่ได้กรอก' }
  const ag = m.agenda.filter((a) => has(a.title))
  s[2] = ag.length > 0 && m.agendaOk ? { state: 'done', hint: 'ประธานเห็นชอบวาระแล้ว' } : ag.length > 0 ? { state: 'partial', hint: 'รอประธานเห็นชอบวาระ' } : { state: 'todo', hint: 'ยังไม่มีวาระ' }
  const n = m.notice
  s[3] = n?.sentAt ? { state: 'done', hint: 'แจ้งประชุมแล้ว' } : n && (n.channels.length > 0 || has(n.body)) ? { state: 'partial', hint: 'ยังไม่ได้บันทึกว่าแจ้งแล้ว' } : { state: 'todo', hint: 'ยังไม่ได้แจ้ง' }
  const keys = prepKeys(m, list), ticked = keys.filter((k) => m.prep?.[k]).length
  s[4] = ticked === keys.length ? { state: 'done', hint: 'เอกสารพร้อมประชุม' } : ticked > 0 ? { state: 'partial', hint: `เตรียมแล้ว ${ticked}/${keys.length} รายการ` } : { state: 'todo', hint: 'ยังไม่ได้เตรียมเอกสาร' }
  const att = attendance(m), marked = att.voters.length - att.unmarked.length
  s[5] = m.opened?.agendaConfirmed ? { state: 'done', hint: `เปิดประชุมแล้ว (มา ${att.present.length} คน)` } : m.opened || marked > 0 ? { state: 'partial', hint: m.opened ? 'ยังไม่ยืนยันวาระ' : att.present.length >= quorumNeeded(m) ? 'ครบองค์ประชุม รอเปิดประชุม' : 'ยังไม่ครบองค์ประชุม' } : { state: 'todo', hint: 'ยังไม่ได้ลงชื่อผู้มาประชุม' }
  const items = m.agenda.filter((a) => a.title.trim()), doneItems = items.filter(minuteComplete).length
  s[6] = items.length > 0 && doneItems === items.length && m.closed?.time ? { state: 'done', hint: 'บันทึกครบทุกวาระ' } : doneItems > 0 || m.closed?.time ? { state: 'partial', hint: `บันทึกแล้ว ${doneItems}/${items.length} วาระ${m.closed?.time ? '' : ' · ยังไม่มีเวลาเลิกประชุม'}` } : { state: 'todo', hint: 'ยังไม่ได้บันทึกประชุม' }
  s[7] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[8] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[9] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[10] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  return s
}

/** เลื่อนวาระขึ้น/ลงภายในกลุ่มเดียวกัน (คืนลำดับใหม่ · ไม่มีที่ให้เลื่อน = ลำดับเดิม) */
export function moveAgenda(agenda: MtAgenda[], id: string, d: number): MtAgenda[] {
  const i = agenda.findIndex((a) => a.id === id)
  if (i < 0) return agenda
  const g = agenda[i].group
  let j = i + d
  while (j >= 0 && j < agenda.length && agenda[j].group !== g) j += d
  if (j < 0 || j >= agenda.length) return agenda
  const c = [...agenda]; [c[i], c[j]] = [c[j], c[i]]
  return c
}

/** ผู้ประชุมแยกตามการมา (ขั้น 5) */
export function attendance(m: Meeting) {
  const live = m.people.filter((p) => p.name.trim())
  const voters = live.filter((p) => p.kind !== 'ผู้เข้าร่วมอื่น')
  return {
    present: voters.filter((p) => p.att === 'มา'), leave: voters.filter((p) => p.att === 'ลา'),
    absent: voters.filter((p) => p.att === 'ไม่มา'), unmarked: voters.filter((p) => !p.att),
    guests: live.filter((p) => p.kind === 'ผู้เข้าร่วมอื่น' && p.att === 'มา'), voters,
  }
}
/** จำนวนองค์ประชุมขั้นต่ำ: ตั้งเอง หรือมากกว่าครึ่งหนึ่งของกรรมการ+ผู้มีสิทธิ์ลงคะแนน */
export const quorumNeeded = (m: Meeting) => m.quorumMin && m.quorumMin > 0 ? m.quorumMin : Math.floor(attendance(m).voters.length / 2) + 1

