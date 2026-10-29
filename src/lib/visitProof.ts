import { distanceM, type Coord } from './geo'

/** ถ่ายรูปได้ไกลจากจุดเช็คอินไม่เกินกี่เมตร (ยืนยันว่าอยู่ที่บ้านเดียวกันตอนถ่าย) */
export const MAX_SHOT_FROM_CHECKIN_M = 300
/** รูปจากกล้องของเครื่อง (ไม่ใช่กล้องในแอป) ต้องถ่ายภายในกี่วินาทีก่อนแนบ — กันรูปเก่าจากคลังภาพ */
export const MAX_FILE_AGE_S = 120

export interface ShotProof { path: string; /** เวลาที่ถ่าย (ms) */ at: number; lat: number; lng: number; acc?: number; /** live = กล้องในแอป · camera-file = กล้องของเครื่อง (ตรวจจากเวลาไฟล์) */ src: 'live' | 'camera-file' }

/** ถ่ายใกล้จุดเช็คอินพอไหม: ok + ระยะ (เมตร) */
export function nearCheckin(shot: Coord, checkin: Coord): { ok: boolean; meters: number } {
  const meters = distanceM(shot, checkin)
  return { ok: meters <= MAX_SHOT_FROM_CHECKIN_M, meters }
}
/** ไฟล์จากกล้องของเครื่อง: เวลาไฟล์ต้องสดใหม่ (ไม่เก่ากว่า MAX_FILE_AGE_S และไม่ล้ำอนาคต) */
export function freshFile(lastModified: number, now: number): boolean {
  const age = (now - lastModified) / 1000
  return age >= -30 && age <= MAX_FILE_AGE_S
}
/** ข้อความประทับบนรูป: วันที่-เวลาไทย · พิกัด (±ความคลาดเคลื่อน) · ชื่อสมาชิก */
export function stampText(at: number, c: Coord, acc?: number, who?: string): string {
  const t = new Date(at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${t} น. · ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}${acc ? ` (±${Math.round(acc)} ม.)` : ''}${who ? ` · ${who}` : ''}`
}
export const timeText = (at: number) => new Date(at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
