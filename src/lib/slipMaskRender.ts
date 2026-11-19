import type { Box } from './slipMask'

export interface MaskBoxes { crop: Box; name: Box | null; qr: Box | null }

/**
 * วาดรูปสลิปใหม่: ตัดตามกรอบ แล้วเขียนทับพิกเซลของชื่อ (ป้ายสีม่วง) และคิวอาร์ (กรอบเทา) — ได้ไฟล์ใหม่ที่ไม่มีชื่อ/คิวอาร์อยู่ในรูปจริง
 * (ไม่ใช่แค่วางป้ายทับบนหน้าจอ) · รูปต้นฉบับไม่ถูกแก้
 */
export async function renderMaskedSlip(blob: Blob, b: MaskBoxes, label: string): Promise<Blob> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  // กรอบตัดที่ผิดปกติ (เล็ก/แคบ/ยาวมาก) ใช้ทั้งรูปแทน กันได้รูปตัดเศษ
  const bad = b.crop.w < bmp.width * 0.3 || b.crop.h < bmp.height * 0.12 || b.crop.h / Math.max(1, b.crop.w) > 3
  if (bad) b = { crop: { x: 0, y: 0, w: bmp.width, h: bmp.height }, name: b.name, qr: b.qr }
  const cx = Math.max(0, Math.round(b.crop.x)), cy = Math.max(0, Math.round(b.crop.y))
  const cw = Math.max(1, Math.min(bmp.width - cx, Math.round(b.crop.w))), ch = Math.max(1, Math.min(bmp.height - cy, Math.round(b.crop.h)))
  const c = document.createElement('canvas'); c.width = cw; c.height = ch
  const ctx = c.getContext('2d')
  if (!ctx) { bmp.close(); throw new Error('สร้างรูปบนเครื่องนี้ไม่ได้') }
  ctx.drawImage(bmp, cx, cy, cw, ch, 0, 0, cw, ch); bmp.close()
  const rel = (x: Box): Box => ({ x: x.x - cx, y: x.y - cy, w: x.w, h: x.h })
  if (b.qr) {
    const q = rel(b.qr)
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(q.x, q.y, q.w, q.h)
    ctx.fillStyle = '#6b7280'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.max(14, Math.round(Math.min(q.w, q.h) * 0.09))}px sans-serif`
    ctx.fillText('ปิดคิวอาร์', q.x + q.w / 2, q.y + q.h / 2)
  }
  if (b.name) {
    const n = rel(b.name)
    const fs = Math.max(16, Math.round(n.h * 0.62))
    ctx.font = `700 ${fs}px sans-serif`
    const pad = Math.round(fs * 0.5)
    const tw = Math.ceil(ctx.measureText(label).width) + pad * 2
    // ป้ายต้องไม่ล้นขอบรูป (ชื่อชิดขวา เช่น ไทยพาณิชย์ ป้ายยาวกว่าชื่อ) และต้องครอบพื้นที่ชื่อเดิมทั้งหมด
    const x = Math.max(0, Math.min(n.x, cw - 6 - Math.max(n.w, tw)))
    const w = Math.max(n.w + (n.x - x), tw), h = Math.max(n.h, Math.round(fs * 1.5))
    ctx.fillStyle = '#c026d3'
    const r = Math.min(14, h / 3)
    ctx.beginPath(); ctx.moveTo(x + r, n.y); ctx.arcTo(x + w, n.y, x + w, n.y + h, r); ctx.arcTo(x + w, n.y + h, x, n.y + h, r); ctx.arcTo(x, n.y + h, x, n.y, r); ctx.arcTo(x, n.y, x + w, n.y, r); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(label, x + pad, n.y + h / 2)
  }
  return new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png'))
}
