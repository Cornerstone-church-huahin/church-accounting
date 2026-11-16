/** แยกข้อความกิจกรรมเป็นรายการ (ทีละบรรทัด · ตัดเลขนำหน้า เช่น “1.” “2)” ออก) */
export const activityLines = (text: string | undefined): string[] =>
  (text ?? '').split(/\r?\n/).map((l) => l.replace(/^\s*\d+\s*[.)\-:]\s*/, '').trim()).filter(Boolean)

/** กิจกรรมที่บันทึกแล้วนี้ ยังอยู่ในแผนของวัน/ช่วงนั้นหรือไม่ (ลบรายการออกจากแผนแล้ว = ไม่นับในรายงาน เส้นทาง ค่าน้ำมัน สถิติ) */
export const isActPlanned = (a: { slot: string; text: string }, doc: { slotNotes?: Partial<Record<string, string>>; dayText?: string }): boolean =>
  activityLines(a.slot === 'day' ? doc.dayText : doc.slotNotes?.[a.slot]).includes(a.text)

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }
/** รหัสรายการกิจกรรมที่คงที่ (วัน + ช่วง + ข้อความ) ใช้ติ๊ก “ทำแล้ว” */
export const activityId = (date: string, slot: string, line: string) => `act-${date}-${slot}-${hash(line)}`
