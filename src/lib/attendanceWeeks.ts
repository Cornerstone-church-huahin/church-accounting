import { addDays, dow } from './money'

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
