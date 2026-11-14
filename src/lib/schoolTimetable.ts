import { addDays } from './money'
import type { SchoolCfg, SchoolDay, SchoolItem, SchoolTpl } from './types'

/** แม่แบบวันอาทิตย์เริ่มต้น (เริ่ม 11:00 น. จบประมาณ 12:30 น. — ปรับได้ในตั้งค่า) */
export const DEFAULT_TPL: SchoolTpl[] = [
  { id: 't1', time: '11:00', title: 'ต้อนรับ / เช็คชื่อเด็ก', role: 'helpers' },
  { id: 't2', time: '11:15', title: 'ร้องเพลง / นมัสการเด็ก', role: 'duty' },
  { id: 't3', time: '11:30', title: 'เรื่องเล่า / บทเรียน', role: 'lead' },
  { id: 't4', time: '11:50', title: 'กิจกรรม เต้น ฝึกการอยู่ร่วมกัน', role: 'helpers' },
  { id: 't5', time: '12:20', title: 'ขนม และอธิษฐานปิดท้าย', role: 'duty' },
]
/** ค่าตั้งต้น (ยังไม่เคยตั้งค่า) */
export const normCfg = (c: Partial<SchoolCfg> | undefined): SchoolCfg => ({ ...(c ?? {}), id: 'cfg', updated: c?.updated ?? 0, overseers: c?.overseers ?? [], lead: c?.lead ?? [], helpers: c?.helpers ?? [], pool: c?.pool ?? [], perWeek: c?.perWeek ?? 2, anchor: c?.anchor ?? '', tpl: c?.tpl?.length ? c.tpl : DEFAULT_TPL })

/** ระยะเป็นสัปดาห์ระหว่างวันอาทิตย์สองวัน */
const weeksBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / (7 * 86_400_000))

/**
 * ครูหมุนเวียนที่ “ลงสอน” ในวันอาทิตย์ sunday (ที่เหลือได้ไปนมัสการ): หมุนทีละ perWeek คนตามลำดับใน pool
 * เช่น 6 คน ลงสอนสัปดาห์ละ 2 → รอบละ 3 สัปดาห์ · ยังไม่ตั้งวันเริ่มหมุน = เริ่มจากกลุ่มแรก
 */
export function dutyFor(cfg: Pick<SchoolCfg, 'pool' | 'perWeek' | 'anchor'>, sunday: string): { duty: string[]; rest: string[] } {
  const n = cfg.pool.length
  if (!n) return { duty: [], rest: [] }
  const k = Math.max(1, Math.min(n, Math.round(cfg.perWeek) || 1))
  const w = cfg.anchor ? weeksBetween(cfg.anchor, sunday) : 0
  const start = (((w * k) % n) + n) % n
  const duty = Array.from({ length: k }, (_, i) => cfg.pool[(start + i) % n])
  return { duty, rest: cfg.pool.filter((x) => !duty.includes(x)) }
}

/** ครูของแต่ละรายการตามหน้าที่ในแม่แบบ */
export const teachersFor = (role: SchoolTpl['role'] | SchoolItem['role'], cfg: Pick<SchoolCfg, 'lead' | 'helpers'>, duty: string[]): string[] =>
  role === 'lead' ? cfg.lead : role === 'helpers' ? cfg.helpers : role === 'duty' ? duty : []

/** สร้างรายการวันอาทิตย์จากแม่แบบ (รหัสคงที่ ทำซ้ำพร้อมกันหลายเครื่องได้โดยไม่ซ้ำ) */
export const itemsFromTpl = (cfg: SchoolCfg, duty: string[]): SchoolItem[] =>
  cfg.tpl.map((t) => ({ id: `tpl-${t.id}`, time: t.time, title: t.title, teachers: teachersFor(t.role, cfg, duty), ...(t.role !== 'none' ? { role: t.role } : {}) }))

/** เปลี่ยนครูหมุนเวียนที่ลงสอน: รายการที่เป็นหน้าที่ “ครูหมุนเวียน” อัปเดตตาม */
export const withDuty = (d: SchoolDay, duty: string[]): SchoolDay => ({ ...d, duty, items: d.items.map((x) => (x.role === 'duty' ? { ...x, teachers: duty } : x)) })

/** วันของตารางงานรวีสำหรับวันอาทิตย์ sunday: อังคาร–เสาร์ก่อนหน้า (เตรียมงาน) แล้วตามด้วยวันอาทิตย์ */
export const schoolWeekDays = (sunday: string): string[] => [...Array.from({ length: 5 }, (_, i) => addDays(sunday, i - 5)), sunday]

/** รายการสอน/งานเรียงตามเวลา (ไม่มีเวลาไว้ท้าย) */
export const sortedItems = (items: SchoolItem[]): SchoolItem[] => [...items].sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.title.localeCompare(b.title))

/** สรุป: จำนวนรายการ · ทำแล้ว · จำนวนครูที่รับผิดชอบ */
export function weekSummary(days: SchoolDay[]): { items: number; done: number; teachers: string[] } {
  const items = days.flatMap((d) => d.items)
  return { items: items.length, done: items.filter((x) => x.done).length, teachers: [...new Set(items.flatMap((x) => x.teachers))] }
}
