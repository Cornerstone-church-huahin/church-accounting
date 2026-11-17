import type { Box } from './slipMask'

/**
 * หาคิวอาร์จากพิกเซล (ไม่พึ่ง OCR): คิวอาร์คือบล็อกสี่เหลี่ยมจัตุรัสที่ดำ/ขาวสลับถี่ ๆ หนาแน่น ต่างจากข้อความ (เป็นเส้นบาง ๆ ยาวเป็นแถว)
 * gray = ภาพขาวดำ (0–255) ขนาด w×h · คืนกรอบเป็นพิกเซลของภาพที่ส่งเข้ามา
 */
export interface QrOpts { cellDiv?: number; dark?: number; fmin?: number; fmax?: number; tmin?: number; fill?: number; gap?: number }
export function findQrBox(gray: Uint8ClampedArray, w: number, h: number, o: QrOpts = {}): Box | null {
  const { cellDiv = 90, dark: DK = 120, fmin = 0.2, fmax = 0.85, tmin = 0.06, fill: FILL = 0.35, gap = 2 } = o
  const cell = Math.max(3, Math.round(Math.min(w, h) / cellDiv))
  const cw = Math.floor(w / cell), ch = Math.floor(h / cell)
  if (cw < 8 || ch < 8) return null
  const on = new Uint8Array(cw * ch)
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    let dark = 0, tr = 0, n = 0
    for (let y = cy * cell; y < (cy + 1) * cell; y++) {
      let prev = gray[y * w + cx * cell] < DK
      for (let x = cx * cell; x < (cx + 1) * cell; x++) {
        const d = gray[y * w + x] < DK
        if (d) dark++
        if (d !== prev) tr++
        prev = d; n++
      }
    }
    const f = dark / n, t = tr / n
    on[cy * cw + cx] = f > fmin && f < fmax && t > tmin ? 1 : 0
  }
  // เชื่อมช่องที่อยู่ติดกัน (ยอมให้เว้น 1 ช่อง) แล้วหาก้อนที่เป็นสี่เหลี่ยมจัตุรัสหนาแน่นที่สุด
  const seen = new Uint8Array(cw * ch)
  let best: { box: Box; score: number } | null = null
  for (let s = 0; s < on.length; s++) {
    if (!on[s] || seen[s]) continue
    const st = [s]; seen[s] = 1
    let x0 = cw, y0 = ch, x1 = 0, y1 = 0, cnt = 0
    while (st.length) {
      const p = st.pop() as number, px = p % cw, py = (p / cw) | 0
      cnt++; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py
      for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) {
        const nx = px + dx, ny = py + dy
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue
        const q = ny * cw + nx
        if (on[q] && !seen[q]) { seen[q] = 1; st.push(q) }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1
    const aspect = bw / bh, fill = cnt / (bw * bh)
    if (bw * cell < Math.min(w, h) * 0.11 || aspect < 0.72 || aspect > 1.4 || fill < FILL) continue
    const score = cnt * fill
    if (!best || score > best.score) best = { box: { x: x0 * cell, y: y0 * cell, w: bw * cell, h: bh * cell }, score }
  }
  return best ? best.box : null
}

/**
 * หาขอบ “การ์ดสลิป” ในภาพแคปหน้าจอที่ LINE เปิดดูรูป (การ์ดสว่างหรือมีสีบนพื้นเทาเข้ม): ดูว่าแถว/คอลัมน์ไหนต่างจากสีพื้นข้างขอบจอมากพอ
 * (ข้ามแถบหัวชื่อแชตด้านบนและช่องพิมพ์ข้อความด้านล่าง) · คืนกรอบเป็นพิกเซลของภาพที่ส่งเข้ามา
 */
export function findCardBox(gray: Uint8ClampedArray, w: number, h: number): Box | null {
  const y0 = Math.round(h * 0.09), y1 = Math.round(h * 0.87)
  const xs = Math.max(1, Math.round(w * 0.02))
  const samples: number[] = []
  for (let y = Math.round(h * 0.25); y < Math.round(h * 0.75); y += 3) for (let x = 0; x < xs; x++) samples.push(gray[y * w + x])
  if (samples.length === 0) return null
  samples.sort((a, b) => a - b)
  const bg = samples[samples.length >> 1]
  const diff = (i: number) => Math.abs(gray[i] - bg) > 28
  const rowFrac = (y: number) => { let c = 0; for (let x = 0; x < w; x++) if (diff(y * w + x)) c++; return c / w }
  let best: [number, number] | null = null, cur = -1
  for (let y = y0; y <= y1; y++) {
    const on = rowFrac(y) > 0.4
    if (on && cur < 0) cur = y
    if ((!on || y === y1) && cur >= 0) { const end = on ? y : y - 1; if (!best || end - cur > best[1] - best[0]) best = [cur, end]; cur = -1 }
  }
  if (!best || best[1] - best[0] < h * 0.15) return null
  const colFrac = (x: number) => { let c = 0; for (let y = best![0]; y <= best![1]; y++) if (diff(y * w + x)) c++; return c / (best![1] - best![0] + 1) }
  let xa = 0, xb = w - 1
  while (xa < w && colFrac(xa) < 0.5) xa++
  while (xb > xa && colFrac(xb) < 0.5) xb--
  if (xb - xa < w * 0.3) return null
  return { x: xa, y: best[0], w: xb - xa + 1, h: best[1] - best[0] + 1 }
}
