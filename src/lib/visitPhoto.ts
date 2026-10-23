import { compressImage } from './image'
import { cacheImage } from './imageCache'
import { getSync, putBinary } from './sync'

export const MAX_VISIT_PHOTOS = 2

/** อัปโหลดรูปการเยี่ยม: ย่อเหลือ ~800px แล้วเก็บใน attachments/visits/ (โหมดทดลอง = เก็บสำเนาในเครื่องเท่านั้น) · คืนที่อยู่ไฟล์ */
export async function uploadVisitPhoto(file: File): Promise<string> {
  const { data, ext } = await compressImage(file, 800, 0.8)
  const path = `attachments/visits/vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  const cfg = getSync()
  if (cfg) await putBinary(cfg, path, data, 'รูปการเยี่ยม')
  await cacheImage(path, data)
  return path
}
