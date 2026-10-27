/** มาตรฐานรูปแนบ (สลิป บิล สมุด ใบถวาย): ด้านยาวไม่เกิน 1600px · JPEG · ไฟล์ไม่เกิน ~350KB — ภาพยังคมพอให้อ่านตัวเลข แต่โหลดเร็วบนมือถือทุกเครื่อง */
export const TARGET_BYTES = 350_000
/** ลำดับที่ลองเมื่อไฟล์ยังใหญ่เกินเป้า: ลดคุณภาพก่อน แล้วค่อยลดพิกเซลลงทีละน้อย (ไม่ต่ำกว่า 1200px / q0.5) */
export function compressSteps(maxSide: number, quality: number): { side: number; q: number }[] {
  return [
    { side: maxSide, q: quality },
    { side: maxSide, q: Math.max(0.5, quality - 0.1) },
    { side: maxSide, q: 0.5 },
    { side: Math.min(maxSide, 1400), q: 0.55 },
    { side: Math.min(maxSide, 1200), q: 0.5 },
  ]
}
/** target = 0 ปิดการบีบให้เล็กลงตามเป้า (ใช้ตอนส่งรูปให้ Gemini อ่าน) */
export async function compressImage(file: File, maxSide = 1600, quality = 0.72, target = TARGET_BYTES): Promise<{ data: ArrayBuffer; ext: string }> {
  if (!file.type.startsWith('image/')) return { data: await file.arrayBuffer(), ext: (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') }
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    let blob: Blob | null = null
    for (const st of target > 0 ? compressSteps(maxSide, quality) : compressSteps(maxSide, quality).slice(0, 1)) {
      const scale = Math.min(1, st.side / Math.max(bmp.width, bmp.height))
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('ย่อรูปไม่ได้บนเครื่องนี้')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
      ctx.drawImage(bmp, 0, 0, w, h)
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', st.q))
      if (!blob) throw new Error('ย่อรูปไม่ได้')
      if (target <= 0 || blob.size <= target) break
    }
    return { data: await (blob as Blob).arrayBuffer(), ext: 'jpg' }
  } finally { bmp.close() }
}

/** หมุนรูปตามเข็ม (90/180/270 องศา) แล้วคืนเป็นไฟล์ JPEG ใหม่ — ใช้ลองอ่านซ้ำเมื่อรูปมาตะแคง/กลับหัว */
export async function rotateImage(file: Blob, deg: 90 | 180 | 270): Promise<File> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const swap = deg !== 180
  const canvas = document.createElement('canvas')
  canvas.width = swap ? bmp.height : bmp.width
  canvas.height = swap ? bmp.width : bmp.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('หมุนรูปไม่ได้บนเครื่องนี้')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
  if (!blob) throw new Error('หมุนรูปไม่ได้')
  return new File([blob], 'rotated.jpg', { type: 'image/jpeg' })
}

/** ลองอ่านรูปตามเดิมก่อน ถ้าไม่ได้ผล (isEmpty) ลองหมุน 90° → 270° → 180° ทีละแบบ แล้วคืนผลแรกที่อ่านได้ (รูปมาแนวนอน/ตะแคง/กลับหัวก็อ่านได้) */
export async function readWithRotations<T>(file: File, read: (f: File) => Promise<T>, isEmpty: (r: T) => boolean): Promise<T> {
  const first = await read(file)
  if (!isEmpty(first)) return first
  for (const deg of [90, 270, 180] as const) {
    try {
      const r = await read(await rotateImage(file, deg))
      if (!isEmpty(r)) return r
    } catch { /* ลองมุมถัดไป */ }
  }
  return first
}
