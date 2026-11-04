import { cachedImage } from './imageCache'
import { getBinary, getSync } from './sync'
import { saveBlob, shareBlob } from './pdf'

/** รูปแนบที่เก็บใน repo ข้อมูล (หรือสำเนาในเครื่องถ้าไม่ได้ออนไลน์) → Blob */
export async function loadAttachment(path: string): Promise<Blob> {
  if (!path) throw new Error('ไม่ได้เก็บรูป (โหมดทดลอง)')
  const cfg = getSync()
  if (cfg) return getBinary(cfg, path)
  const b = await cachedImage(path)
  if (!b) throw new Error('ต้องเชื่อมต่อออนไลน์จึงจะเปิดดูรูปได้')
  return b
}

const toJpegDataUrl = (b: Blob) => new Promise<{ url: string; w: number; h: number }>((res, rej) => {
  const u = URL.createObjectURL(b), img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d'); if (!g) { URL.revokeObjectURL(u); rej(new Error('สร้างภาพไม่สำเร็จ')); return }
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0)
    URL.revokeObjectURL(u)
    res({ url: c.toDataURL('image/jpeg', 0.92), w: c.width, h: c.height })
  }
  img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('เปิดรูปไม่ได้')) }
  img.src = u
})

/** รวมรูปทั้งหมดเป็น PDF (รูปละหน้า A4 ย่อพอดีหน้า จัดกึ่งกลาง) */
export async function imagesToPdf(blobs: Blob[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight(), M = 10
  for (let i = 0; i < blobs.length; i++) {
    const { url, w, h } = await toJpegDataUrl(blobs[i])
    const k = Math.min((PW - 2 * M) / w, (PH - 2 * M) / h)
    const dw = w * k, dh = h * k
    if (i > 0) pdf.addPage('a4', 'portrait')
    pdf.addImage(url, 'JPEG', (PW - dw) / 2, (PH - dh) / 2, dw, dh)
  }
  return pdf.output('blob')
}

const ext = (b: Blob) => (b.type.includes('png') ? 'png' : b.type.includes('webp') ? 'webp' : 'jpg')
const names = (base: string, blobs: Blob[]) => blobs.map((b, i) => `${base}${blobs.length > 1 ? `-${i + 1}` : ''}.${ext(b)}`)

export const downloadPdf = async (blobs: Blob[], base: string) => saveBlob(await imagesToPdf(blobs), `${base}.pdf`)
export const sharePdf = async (blobs: Blob[], base: string, title: string) => shareBlob(await imagesToPdf(blobs), `${base}.pdf`, title)

/** แชร์เป็นรูป (ทุกรูปในครั้งเดียว) · แชร์ไม่ได้ → ดาวน์โหลดรูปให้แทน */
export async function shareImageFiles(blobs: Blob[], base: string, title: string): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const files = blobs.map((b, i) => new File([b], names(base, blobs)[i], { type: b.type || 'image/jpeg' }))
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try { await navigator.share({ files, title }); return 'shared' } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled' }
  }
  files.forEach((f) => saveBlob(f, f.name))
  return 'downloaded'
}

/** พิมพ์รูปทั้งหมด (รูปละหน้า) ผ่านกรอบซ่อน */
export function printImages(blobs: Blob[]) {
  const urls = blobs.map((b) => URL.createObjectURL(b))
  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  const imgs = urls.map((u, i) => `<img src="${u}" ${i === urls.length - 1 ? 'onload="window.focus();window.print()"' : ''}>`).join('')
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:10mm}body{margin:0}img{max-width:100%;max-height:277mm;display:block;margin:0 auto;page-break-after:always}</style></head><body>${imgs}</body></html>`
  document.body.appendChild(f)
  window.setTimeout(() => { f.remove(); urls.forEach((u) => URL.revokeObjectURL(u)) }, 120_000)
}
