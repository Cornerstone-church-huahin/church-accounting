import { readWithRotations } from './image'
import { mergeSlipReads, parseSlipText, type SlipRead } from './slipParse'
import { parseMemberCode, type Box, type OcrLine } from './slipMask'
import { findCardBox, findQrBox } from './qrFind'

/**
 * อ่านสลิปโอนเงินในเครื่อง (Tesseract OCR ที่ฝังมากับแอป ไม่ส่งรูปออกไปที่ใด)
 * ปรับภาพ 2 แบบ (ขยาย+เพิ่มคอนทราสต์ / ขาว-ดำ) แล้วรวมผล เพื่อให้วันที่และยอดแม่นขึ้น
 */
type Worker = import('tesseract.js').Worker
let workerP: Promise<Worker> | null = null

const base = () => new URL('ocr/', document.baseURI).href

function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  workerP ??= import('tesseract.js').then(({ createWorker }) =>
    createWorker('tha', 1, {
      workerPath: `${base()}worker.min.js`,
      corePath: base().replace(/\/$/, ''),
      langPath: base().replace(/\/$/, ''),
      gzip: true,
      logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress) },
    }),
  ).catch((e) => { workerP = null; throw e })
  return workerP
}

async function variants(file: File): Promise<HTMLCanvasElement[]> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const long = Math.max(bmp.width, bmp.height)
  const scale = bmp.width < 1600 ? 1800 / bmp.width : long > 2600 ? 2600 / long : 1
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const a = mk(), ctx = a.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('ปรับภาพไม่ได้บนเครื่องนี้')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const img = ctx.getImageData(0, 0, w, h)
  const g = new Uint8ClampedArray(w * h)
  const hist = new Uint32Array(256)
  for (let i = 0; i < g.length; i++) { const v = Math.round(0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2]); g[i] = v; hist[v]++ }
  // ยืดคอนทราสต์ (ตัดสุดขอบ 2%)
  const cut = g.length * 0.02
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > cut) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > cut) { hi = v; break } }
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, ((g[i] - lo) * 255) / span))
  const put = (arr: Uint8ClampedArray, c: HTMLCanvasElement) => {
    const out = new ImageData(w, h)
    for (let i = 0; i < arr.length; i++) { out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = arr[i]; out.data[i * 4 + 3] = 255 }
    c.getContext('2d')?.putImageData(out, 0, 0)
    return c
  }
  const A = put(g, mk())
  // ขาว-ดำ: ธรณีประตูอ่านจากฮิสโตแกรมของภาพที่ยืดแล้ว (Otsu)
  const h2 = new Uint32Array(256)
  for (let i = 0; i < g.length; i++) h2[g[i]]++
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * h2[t]
  let sB = 0, wB = 0, best = 0, thr = 150
  for (let t = 0; t < 256; t++) {
    wB += h2[t]; if (!wB) continue
    const wF = g.length - wB; if (!wF) break
    sB += t * h2[t]
    const mB = sB / wB, mF = (sum - sB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) { best = between; thr = t }
  }
  const bin = new Uint8ClampedArray(g.length)
  for (let i = 0; i < g.length; i++) bin[i] = g[i] > Math.min(thr + 25, 200) ? 255 : 0
  return [A, put(bin, mk())]
}

export interface SlipResult extends SlipRead { texts: string[]; /** รหัสสมาชิกที่อ่านจากหัวแชต (ถ้ามี) */ code?: string }

/** อ่านสลิป 1 ใบ — โยน error ถ้าตัวอ่านโหลดไม่ได้ (เช่น ไฟล์ OCR ไม่อยู่ในแอป) */
export async function readSlip(file: File, onProgress?: (p: number) => void): Promise<SlipResult> {
  // รูปมาตะแคง/แนวนอน/กลับหัว: ถ้าอ่านวันที่และยอดไม่ได้เลย ลองหมุนแล้วอ่านใหม่
  const r = await readWithRotations(file, (f) => readSlipOnce(f, onProgress), (r) => !r.amount && !r.date)
  let code = parseMemberCode(r.texts.join('\n'))
  if (!code) { try { code = await readHeaderCode(file) } catch { /* อ่านหัวแชตไม่ได้ = ผู้บันทึกกรอกเลขเอง */ } }
  return code ? { ...r, code } : r
}

/** หัวแชตด้านบนของภาพจอ (ตัวอักษรขาวบนพื้นเข้ม): ตัดส่วนบน กลับสีถ้ามืด ขยาย แล้วอ่านหารหัสสมาชิก */
async function readHeaderCode(file: Blob): Promise<string | undefined> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const hh = Math.max(120, Math.round(bmp.height * 0.2))
  const sc = Math.min(2.5, 1400 / bmp.width)
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(Math.min(hh, bmp.height) * sc)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) { bmp.close(); return undefined }
  ctx.drawImage(bmp, 0, 0, bmp.width, Math.min(hh, bmp.height), 0, 0, c.width, c.height); bmp.close()
  const img = ctx.getImageData(0, 0, c.width, c.height)
  let sum = 0; for (let i = 0; i < img.data.length; i += 4) sum += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
  if (sum / (img.data.length / 4) < 128) { for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 255 - img.data[i]; img.data[i + 1] = 255 - img.data[i + 1]; img.data[i + 2] = 255 - img.data[i + 2] } ctx.putImageData(img, 0, 0) }
  const worker = await getWorker()
  const { data } = await worker.recognize(c)
  return parseMemberCode(data.text)
}

/** หาคิวอาร์จากพิกเซล (ไม่พึ่ง OCR) · คืนกรอบเป็นพิกเซลของรูปเดิม */
export async function detectQr(blob: Blob): Promise<Box | null> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const sc = Math.min(1, 700 / bmp.width)
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) { bmp.close(); return null }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close()
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  const g = new Uint8ClampedArray(c.width * c.height)
  for (let i = 0; i < g.length; i++) g[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2])
  const q = findQrBox(g, c.width, c.height)
  return q ? { x: q.x / sc, y: q.y / sc, w: q.w / sc, h: q.h / sc } : null
}

/** ขอบการ์ดสลิปในภาพแคปหน้าจอแชต (ใช้ตัดหัวแชต/ช่องพิมพ์ออก) */
export async function detectCard(blob: Blob): Promise<Box | null> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const sc = Math.min(1, 500 / bmp.width)
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) { bmp.close(); return null }
  ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close()
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  const g = new Uint8ClampedArray(c.width * c.height)
  for (let i = 0; i < g.length; i++) g[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2])
  const b = findCardBox(g, c.width, c.height)
  return b ? { x: b.x / sc, y: b.y / sc, w: b.w / sc, h: b.h / sc } : null
}

/** อ่านข้อความทีละบรรทัดพร้อมตำแหน่ง (พิกเซลของรูปเดิม) — ใช้หาตำแหน่งชื่อ/คิวอาร์เพื่อปิดก่อนแชร์ */
export async function readSlipLines(blob: Blob): Promise<{ lines: OcrLine[]; W: number; H: number }> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const W = bmp.width, H = bmp.height
  const sc = Math.min(2.2, Math.max(1, 1500 / W), 3200 / Math.max(W, H))
  const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc)
  const ctx = c.getContext('2d')
  if (!ctx) { bmp.close(); throw new Error('ปรับภาพไม่ได้บนเครื่องนี้') }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close()
  const worker = await getWorker()
  const { data } = await worker.recognize(c, {}, { blocks: true })
  const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).map((l) => ({ text: l.text.trim(), x0: l.bbox.x0 / sc, y0: l.bbox.y0 / sc, x1: l.bbox.x1 / sc, y1: l.bbox.y1 / sc, words: l.words.map((w) => ({ t: w.text, x0: w.bbox.x0 / sc, y0: w.bbox.y0 / sc, x1: w.bbox.x1 / sc, y1: w.bbox.y1 / sc })) }))
  return { lines, W, H }
}

async function readSlipOnce(file: File, onProgress?: (p: number) => void): Promise<SlipResult> {
  const worker = await getWorker()
  const vs = await variants(file)
  const reads: SlipRead[] = []
  const texts: string[] = []
  for (let i = 0; i < vs.length; i++) {
    const { data } = await worker.recognize(vs[i])
    texts.push(data.text)
    reads.push(parseSlipText(data.text))
    onProgress?.((i + 1) / vs.length)
  }
  return { ...mergeSlipReads(reads), texts }
}
