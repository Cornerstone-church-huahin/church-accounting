import { addDays } from './money'
import type { SchoolDay, SchoolItem } from './types'

/** วันของตารางงานรวี: อังคาร–อาทิตย์ (6 วัน) ของสัปดาห์ที่เริ่มวันอาทิตย์ sunday */
export const schoolWeekDays = (sunday: string): string[] => Array.from({ length: 6 }, (_, i) => addDays(sunday, i + 2))

/** รายการสอน/งานเรียงตามเวลา (ไม่มีเวลาไว้ท้าย) */
export const sortedItems = (items: SchoolItem[]): SchoolItem[] => [...items].sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.title.localeCompare(b.title))

/** คัดลอกรายการของวันก่อนหน้า (เว้น ทำแล้ว/หมายเหตุ/บันทึก) ไปเป็นแผนของวันใหม่ */
export const copyPlan = (from: SchoolDay, newId: () => string): SchoolItem[] => from.items.map((x) => ({ id: newId(), time: x.time, title: x.title, teachers: [...x.teachers] }))

/** สรุปสัปดาห์: จำนวนรายการ · ทำแล้ว · จำนวนครูที่รับผิดชอบ */
export function weekSummary(days: SchoolDay[]): { items: number; done: number; teachers: string[] } {
  const items = days.flatMap((d) => d.items)
  return { items: items.length, done: items.filter((x) => x.done).length, teachers: [...new Set(items.flatMap((x) => x.teachers))] }
}
