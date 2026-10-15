import { compressImage } from './image'
import { cacheImage } from './imageCache'
import { deleteFile, getSync, listDir, putBinary } from './sync'

/**
 * อัปโหลดรูปสมาชิก: ย่อเหลือ ~640px แล้วเก็บใน repo ข้อมูล (attachments/members/) · คืนที่อยู่ไฟล์
 * โหมดทดลอง (ยังไม่เชื่อมออนไลน์): เก็บสำเนาในเครื่องเท่านั้น (เห็นเฉพาะเครื่องนี้)
 */
export async function uploadMemberPhoto(memberId: string, file: File): Promise<string> {
  const { data, ext } = await compressImage(file, 640, 0.8)
  const path = `attachments/members/${memberId}-${Date.now().toString(36)}.${ext}`
  const cfg = getSync()
  if (cfg) await putBinary(cfg, path, data, 'รูปสมาชิก')
  await cacheImage(path, data)
  return path
}

/** ลบไฟล์รูปออกจาก repo ข้อมูล (ทำเท่าที่ทำได้: ออฟไลน์/ไม่พบไฟล์ = ข้ามเงียบ ๆ) · ประวัติ commit เดิมของ GitHub ยังเก็บไว้ */
export async function removeMemberPhotoFile(path: string): Promise<void> {
  const cfg = getSync()
  if (!cfg || !path) return
  try {
    const dir = path.slice(0, path.lastIndexOf('/'))
    const hit = (await listDir(cfg, dir)).find((f) => f.path === path)
    if (hit) await deleteFile(cfg, path, hit.sha, 'รูปสมาชิก')
  } catch { /* ignore */ }
}
