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
export function stepStatuses(m: Meeting): Record<number, StepStatus> {
  const required = [m.name, m.date, m.time, m.place, m.chair, m.secretary]
  const filled = required.filter(has).length + (m.no > 0 ? 1 : 0) + (m.year > 0 ? 1 : 0)
  const people = m.people.filter((p) => has(p.name))
  const s: Record<number, StepStatus> = {}
  s[1] = filled === 8 && people.length > 0 ? { state: 'done', hint: 'ข้อมูลพื้นฐานครบ' } : filled > 2 || people.length > 0 ? { state: 'partial', hint: `ยังขาด ${8 - filled + (people.length ? 0 : 1)} รายการ` } : { state: 'todo', hint: 'ยังไม่ได้กรอก' }
  const ag = m.agenda.filter((a) => has(a.title))
  s[2] = ag.length > 0 && m.agendaOk ? { state: 'done', hint: 'ประธานเห็นชอบวาระแล้ว' } : ag.length > 0 ? { state: 'partial', hint: 'รอประธานเห็นชอบวาระ' } : { state: 'todo', hint: 'ยังไม่มีวาระ' }
  const n = m.notice
  s[3] = n?.sentAt ? { state: 'done', hint: 'แจ้งประชุมแล้ว' } : n && (n.channels.length > 0 || has(n.body)) ? { state: 'partial', hint: 'ยังไม่ได้บันทึกว่าแจ้งแล้ว' } : { state: 'todo', hint: 'ยังไม่ได้แจ้ง' }
  s[4] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[5] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[6] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[7] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[8] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[9] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  s[10] = { state: 'todo', hint: 'ยังไม่เปิดใช้' }
  return s
}
