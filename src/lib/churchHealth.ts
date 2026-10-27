/** สถานะการเงินคริสตจักรสำหรับผู้นำทุกงาน: เงินหมุนเวียนพอใช้กี่สัปดาห์ (ที่ระดับใช้จ่ายเฉลี่ย 8 สัปดาห์ล่าสุด) → สีสถานะ + ข้อความ + ทางช่วยกัน */
export type HealthLevel = 'good' | 'watch' | 'low'
export const TARGET_WEEKS = 8 // เป้าเงินสำรองหมุนเวียน
export const WATCH_WEEKS = 4 // ต่ำกว่านี้ = เหลือง
export const LOW_WEEKS = 2 // ต่ำกว่านี้ = แดง

export interface Health {
  level: HealthLevel
  /** จำนวนสัปดาห์ที่เงินหมุนเวียนพอใช้ (null = ไม่มีรายจ่ายให้เทียบ) */
  weeks: number | null
  /** 0–1 ความคืบหน้าสู่เป้าสำรอง */
  progress: number
  weeklyOut: number
  trend: 'up' | 'flat' | 'down'
}

/** own = เงินหมุนเวียน (สตางค์) · out8 = รายจ่าย 8 สัปดาห์ล่าสุด · net4/netPrev4 = รายรับ−รายจ่าย 4 สัปดาห์ล่าสุด / 4 สัปดาห์ก่อนหน้า */
export function healthOf(own: number, out8: number, net4: number, netPrev4: number): Health {
  const weeklyOut = out8 > 0 ? out8 / 8 : 0
  const weeks = weeklyOut > 0 ? Math.max(0, own) / weeklyOut : null
  const level: HealthLevel = own <= 0 ? 'low' : weeks === null ? 'good' : weeks >= WATCH_WEEKS ? 'good' : weeks >= LOW_WEEKS ? 'watch' : 'low'
  const progress = own <= 0 ? 0 : weeks === null ? 1 : Math.min(1, weeks / TARGET_WEEKS)
  const d = net4 - netPrev4
  const trend = Math.abs(d) < Math.max(1000, Math.abs(netPrev4) * 0.05) ? 'flat' : d > 0 ? 'up' : 'down'
  return { level, weeks, progress, weeklyOut, trend }
}

export const LEVEL_UI: Record<HealthLevel, { icon: string; title: string; message: string; tips: string[] }> = {
  good: { icon: '🟢', title: 'การเงินมั่นคง', message: 'เงินหมุนเวียนเพียงพอ ขอบพระคุณพระเจ้าและทุกท่านที่ร่วมถวายและใช้จ่ายอย่างรับผิดชอบ', tips: ['รักษาวินัยการใช้จ่ายตามงบของงานตนเอง', 'ช่วยชวนพี่น้องถวายสม่ำเสมอ เพื่อสะสมเงินสำรองให้ถึงเป้า 8 สัปดาห์', 'วางแผนกิจกรรมล่วงหน้าในแผนงานประจำปี จะได้เตรียมงบทัน'] },
  watch: { icon: '🟡', title: 'เริ่มตึง ช่วยกันดูแล', message: 'เงินหมุนเวียนเริ่มลดลง ถ้าช่วยกันประหยัดและเลื่อนรายจ่ายที่ยังไม่จำเป็น จะกลับสู่ระดับปลอดภัยได้', tips: ['ทบทวนกิจกรรมของงานที่ยังไม่เร่งด่วน เลื่อนหรือลดขนาดได้ไหม', 'ขอใบเสร็จและเบิกให้ตรงงวด เพื่อให้ตัวเลขเป็นจริงที่สุด', 'ชวนสมาชิกในงานอธิษฐานและร่วมถวายสิบลดอย่างสม่ำเสมอ'] },
  low: { icon: '🔴', title: 'ต้องช่วยกันเร่งด่วน', message: 'เงินหมุนเวียนต่ำมาก อาจไม่พอจ่ายค่าใช้จ่ายประจำ ขอให้ผู้นำทุกงานชะลอรายจ่ายที่ไม่จำเป็นและช่วยกันหาทางออก', tips: ['งดรายจ่ายที่ไม่จำเป็นของงานตนเองชั่วคราว', 'ปรึกษาเหรัญญิกก่อนเบิกจ่ายก้อนใหญ่', 'ประชุมผู้นำเพื่อวางแผนฟื้นฟู เช่น ประกาศความต้องการถึงที่ประชุมใหญ่'] },
}
export const TREND_UI = { up: '📈 ดีขึ้นกว่า 4 สัปดาห์ก่อน', flat: '➖ ทรงตัว', down: '📉 แย่ลงกว่า 4 สัปดาห์ก่อน' } as const
