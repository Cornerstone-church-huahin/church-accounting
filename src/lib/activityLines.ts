/** แยกข้อความกิจกรรมเป็นรายการ (ทีละบรรทัด · ตัดเลขนำหน้า เช่น “1.” “2)” ออก) */
export const activityLines = (text: string | undefined): string[] =>
  (text ?? '').split(/\r?\n/).map((l) => l.replace(/^\s*\d+\s*[.)\-:]\s*/, '').trim()).filter(Boolean)

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }
/** รหัสรายการกิจกรรมที่คงที่ (วัน + ช่วง + ข้อความ) ใช้ติ๊ก “ทำแล้ว” */
export const activityId = (date: string, slot: string, line: string) => `act-${date}-${slot}-${hash(line)}`
