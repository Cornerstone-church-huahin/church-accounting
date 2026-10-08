import { mergeSlipReads, parseSlipText, type SlipRead } from './slipParse'

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
  const bmp = await createImageBitmap(file)
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

export interface SlipResult extends SlipRead { texts: string[] }

/** อ่านสลิป 1 ใบ — โยน error ถ้าตัวอ่านโหลดไม่ได้ (เช่น ไฟล์ OCR ไม่อยู่ในแอป) */
export async function readSlip(file: File, onProgress?: (p: number) => void): Promise<SlipResult> {
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
