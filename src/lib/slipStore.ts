import { compressImage } from './image'
import { getSync, putBinary } from './sync'

/** อัปโหลดรูปสลิปที่ปิดชื่อแล้วเข้าที่เก็บข้อมูล (attachments/ปี) — ต้องออนไลน์ */
export async function storeMaskedSlip(blob: Blob, year: number): Promise<{ path: string; name: string }> {
  const cfg = getSync()
  if (!cfg) throw new Error('ต้องเชื่อมต่อออนไลน์ก่อนจึงเก็บรูปสลิปที่ปิดชื่อได้')
  const { data, ext } = await compressImage(new File([blob], 'slip-masked.png', { type: blob.type || 'image/png' }))
  const path = `attachments/${year}/slip-masked-${Date.now().toString(36)}.${ext}`
  await putBinary(cfg, path, data, 'สลิปปิดชื่อ')
  return { path, name: `slip-masked.${ext}` }
}
