import { addDays, dow } from './money'
import type { CheckIn } from './types'

/** วันอาทิตย์ล่าสุดที่ไม่เกินวันที่ให้ */
export const lastSunday = (iso: string) => addDays(iso, -dow(iso))

/**
 * รายการวันสำหรับแถบเลือกอาทิตย์ (เรียงเก่า → ใหม่): วันที่มีบันทึกทั้งหมด + ทุกวันอาทิตย์ย้อนหลัง weeks สัปดาห์ + วันนี้
 * (ให้เลือกอาทิตย์ที่ยังไม่มีบันทึกเพื่อลงชื่อย้อนหลังได้ด้วย)
 */
export function weekDates(recorded: string[], today: string, weeks = 26): string[] {
  const set = new Set<string>(recorded)
  set.add(today)
  const end = lastSunday(today)
  for (let i = 0; i < weeks; i++) set.add(addDays(end, -7 * i))
  return [...set].sort()
}

export interface Attendee { id: string; /** ลำดับที่มา (1 = ลงชื่อก่อนใคร) */ no: number; tm?: string; rec?: string }
/**
 * คนที่มาวันนั้นเรียงตามลำดับที่ลงชื่อ (เก่า → ใหม่): ข้อมูลที่นำเข้าจากไฟล์เดิมไม่มีเวลา จึงอยู่ก่อน แล้วตามด้วยคนที่ลงชื่อในแอปเรียงตามเวลาที่ลง
 * แสดงบนหน้าจอให้คนที่ลงล่าสุดอยู่บนสุด (reverse) · เลขลำดับคงเดิม
 */
export function orderedAttendees(ids: string[], date: string, checkins: Pick<CheckIn, 'date' | 'mid' | 'tm' | 'rec' | 'updated' | 'deleted'>[]): Attendee[] {
  const timed = new Map<string, Pick<CheckIn, 'mid' | 'tm' | 'rec' | 'updated'>>()
  for (const c of checkins) if (c.date === date && !c.deleted) timed.set(c.mid, c)
  const legacy = ids.filter((id) => !timed.has(id))
  const live = ids.filter((id) => timed.has(id)).sort((a, b) => (timed.get(a)!.updated || 0) - (timed.get(b)!.updated || 0) || (timed.get(a)!.tm ?? '').localeCompare(timed.get(b)!.tm ?? ''))
  return [...legacy, ...live].map((id, i) => ({ id, no: i + 1, tm: timed.get(id)?.tm, rec: timed.get(id)?.rec }))
}
