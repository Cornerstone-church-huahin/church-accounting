import type { CalEvent } from './types'

/** แก้ไข/ลบกิจกรรมในปฏิทินได้เฉพาะผู้บันทึก (และแอดมิน) — รายการเก่าที่ไม่มีผู้บันทึกแก้ได้ทุกคน */
export const canTouchEvent = (e: Pick<CalEvent, 'recId'>, meId: string, isAdmin: boolean) => !e.recId || e.recId === meId || isAdmin
