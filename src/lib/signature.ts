/** ทำรูปลายเซ็นให้พื้นโปร่งใส: ส่วนที่เป็นกระดาษขาวหายไป เหลือแต่เส้นหมึก (ใช้วางบนหนังสือได้เลย) */
export const MAX_SIGN_W = 520

/** ความทึบของพิกเซล: สว่างมาก (กระดาษ) = โปร่งใส · เข้ม (หมึก) = ทึบ · ไล่ระดับนุ่มตรงขอบเส้น */
export function inkAlpha(r: number, g: number, b: number): number {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return Math.max(0, Math.min(255, Math.round(((232 - lum) / (232 - 140)) * 255)))
}

/** อ่านรูปที่ผู้ใช้เลือก → PNG โปร่งใสที่ตัดขอบพอดีลายเซ็น (data URL ขนาดเล็ก) */
export async function cleanSignature(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIGN_W / bmp.width)
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale))
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const cx = cv.getContext('2d', { willReadFrequently: true })!
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(bmp, 0, 0, w, h)
  const img = cx.getImageData(0, 0, w, h), d = img.data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = inkAlpha(d[i], d[i + 1], d[i + 2])
    // หมึก: ทำให้เข้มสม่ำเสมอ (น้ำเงินเข้ม-ดำ) ไม่ว่าถ่ายมาสว่างแค่ไหน
    d[i] = Math.round(d[i] * 0.25); d[i + 1] = Math.round(d[i + 1] * 0.25); d[i + 2] = Math.round(d[i + 2] * 0.25 + 18); d[i + 3] = a
    if (a > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (x1 < 0) throw new Error('ไม่พบลายเซ็นในรูป — ใช้รูปที่เซ็นด้วยปากกาเข้มบนกระดาษขาว')
  cx.putImageData(img, 0, 0)
  const pad = 4, sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad), sw = Math.min(w, x1 + pad) - sx, sh = Math.min(h, y1 + pad) - sy
  const out = document.createElement('canvas'); out.width = sw; out.height = sh
  out.getContext('2d')!.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh)
  return out.toDataURL('image/png')
}
