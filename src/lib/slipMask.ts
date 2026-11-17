/** ปิดชื่อ/คิวอาร์ในรูปสลิปก่อนแชร์: อ่านรหัสสมาชิกจากหัวแชต + หาตำแหน่งกรอบชื่อ/คิวอาร์/ขอบสลิปจากข้อความที่ OCR อ่านได้ */
export interface Box { x: number; y: number; w: number; h: number }
export interface OcrLine { text: string; x0: number; y0: number; x1: number; y1: number; words?: OcrWord[] }
export interface MaskLayout { crop: Box; name: Box | null; qr: Box | null; found: boolean }

const THAI_MONTH = /^\s*(?:ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค|ม\.|ก\.|พ\.)/

/** รหัสสมาชิกจากหัวแชต เช่น “1333ปิ่ม รัชนี” → 1333 (ตัวเลข 3–6 หลักที่ขึ้นต้นบรรทัด ตามด้วยชื่อ · ไม่เอาวันที่/เวลา/สถานะมือถือ) */
export function parseMemberCode(text: string): string | undefined {
  const lines = text.normalize('NFC').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10)
  for (const l of lines) {
    if (/\d{1,2}[:.]\d{2}/.test(l)) continue // เวลา/สถานะ
    const m = /^[^0-9ก-๙A-Za-z]{0,3}(\d{3,6})(?=\s*[ก-๙A-Za-z])(?!\s*(?:บาท|น\.))/.exec(l)
    if (!m) continue
    if (THAI_MONTH.test(l.slice(m[1].length))) continue
    return m[1]
  }
  return undefined
}

export interface OcrWord { t: string; x0: number; y0: number; x1: number; y1: number }
const nrm = (t: string) => t.normalize('NFC').replace(/\s+/g, '')
const ACCT_DASH = (t: string) => /\d{4}/.test(t) && (t.match(/[-–]/g) ?? []).length >= 2
const BANK = /ธ\.|ธนาคาร|bank/i
const unionBox = (bs: { x0: number; y0: number; x1: number; y1: number }[]): Box => { const x0 = Math.min(...bs.map((l) => l.x0)), y0 = Math.min(...bs.map((l) => l.y0)), x1 = Math.max(...bs.map((l) => l.x1)), y1 = Math.max(...bs.map((l) => l.y1)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } }
const grow = (b: Box, px: number, py: number, W: number, H: number): Box => { const x = Math.max(0, b.x - px), y = Math.max(0, b.y - py); return { x, y, w: Math.min(W, b.x + b.w + px) - x, h: Math.min(H, b.y + b.h + py) - y } }
const wordsOf = (l: OcrLine): OcrWord[] => (l.words?.length ? l.words : [{ t: l.text, x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 }])

/** กรอบของ “เฉพาะตัวอักษรที่ตรงกับรูปแบบ” ในบรรทัด (บรรทัดจาก OCR มักรวมโลโก้/สัญลักษณ์ปนมา ทำให้กรอบบรรทัดกว้าง/สูงเกินจริง จึงใช้กรอบของคำ) */
function spanBox(l: OcrLine, re: RegExp, toEnd = false): Box | null {
  const ws = wordsOf(l)
  let j = ''
  const idx: number[] = []
  ws.forEach((w, i) => { const t = nrm(w.t); for (let k = 0; k < t.length; k++) idx.push(i); j += t })
  const m = re.exec(j)
  if (!m) return null
  const a = idx[m.index], z = toEnd ? ws.length - 1 : idx[m.index + m[0].length - 1]
  return unionBox(ws.slice(a, z + 1))
}

/**
 * จัดวางกรอบอัตโนมัติ (ผู้ใช้ลากปรับได้เสมอ): สลิป K+ มีหัว “โอนเงินสำเร็จ” → ชื่อผู้โอนอยู่บรรทัดใต้หัว (ไม่ใช่บรรทัดวันที่/ธนาคาร/เลขบัญชี) →
 * คิวอาร์อยู่เหนือคำว่า “สแกนตรวจสอบสลิป” · ถ้าหาหัวสลิปไม่เจอ = ตัดทั้งรูป และไม่มีกรอบชื่อ/คิวอาร์ (ให้ผู้ใช้เพิ่มเอง)
 */
export function slipLayout(lines: OcrLine[], W: number, H: number): MaskLayout {
  const L = lines.filter((l) => l.text.trim() && l.x1 > l.x0 && l.y1 > l.y0)
  const whole: Box = { x: 0, y: 0, w: W, h: H }
  let title: Box | null = null
  for (const l of L) { title = spanBox(l, /โอนเงิน.{0,4}ส.{1,3}เร.{0,2}จ/); if (title) break }
  if (!title) { // สำรอง: บรรทัดวันที่-เวลาใต้หัวสลิป → หัวสลิปอยู่เหนือขึ้นไป ~1.7 บรรทัด
    const d = L.find((l) => l.y0 > H * 0.04 && /\d{1,2}.{0,12}\d{1,2}[:.]\d{2}.{0,6}น/.test(l.text.replace(/\s+/g, '')) && /ค\.|ม\.|พ\.|ย\.|ก\.|ส\./.test(l.text))
    if (d) { const b = spanBox(d, /\d{1,2}.{0,12}\d{1,2}[:.]\d{2}/) ?? { x: d.x0, y: d.y0, w: d.x1 - d.x0, h: d.y1 - d.y0 }; title = { x: b.x, y: Math.max(0, b.y - b.h * 1.9), w: b.w, h: b.h } }
  }
  if (!title) return { crop: whole, name: null, qr: null, found: false }
  const t = title
  let cap: Box | null = null
  for (const l of [...L].reverse()) { const c = spanBox(l, /สแกน/, true); if (c) { cap = c; break } }

  const left = Math.max(0, t.x - Math.round(W * 0.075))
  const top = Math.max(0, t.y - Math.round(H * 0.022))
  const lastY = cap ? cap.y + cap.h : t.y + t.h + H * 0.45
  const bottom = Math.min(H, lastY + Math.round(H * 0.035))
  const right = Math.min(W, cap ? cap.x + cap.w + Math.round(W * 0.057) : W)
  const crop: Box = { x: left, y: top, w: Math.max(40, right - left), h: Math.max(40, bottom - top) }

  // ชื่อผู้โอน: บรรทัดใต้หัว ก่อนเลขบัญชีแรก · ไม่เอาบรรทัดวันที่(มีตัวเลข)/ธนาคาร/เลขบัญชี/เศษสัญลักษณ์
  const titleBottom = t.y + t.h
  const acct = L.filter((l) => l.y0 > titleBottom && ACCT_DASH(l.text)).sort((a, b) => a.y0 - b.y0)[0]
  const limit = acct ? acct.y0 : titleBottom + H * 0.14
  const names = L.filter((l) => l.y0 >= titleBottom - 4 && l.y1 <= limit + 6 && l.x0 > left + (right - left) * 0.1 && !BANK.test(l.text) && !ACCT_DASH(l.text) && !/[0-9๐-๙:%]/.test(l.text) && /[ก-๙A-Za-z]{2,}/.test(l.text))
  let name: Box | null = null
  if (names.length) {
    const ws = names.slice(0, 2).flatMap((l) => wordsOf(l).filter((w) => /[ก-๙A-Za-z.]/.test(w.t)))
    if (ws.length) name = grow(unionBox(ws), Math.round(W * 0.012), Math.round(H * 0.004), W, H)
  }

  // คิวอาร์ + คำอธิบายใต้คิวอาร์ (คิวอาร์กว้างกว่าคำอธิบายเล็กน้อย และอยู่เหนือคำอธิบายพอดี)
  let qr: Box | null = null
  if (cap) {
    const side = cap.w * 1.08
    qr = grow({ x: cap.x - (side - cap.w) / 2, y: cap.y - side, w: side, h: side + cap.h }, Math.round(W * 0.012), Math.round(H * 0.004), W, H)
  }
  return { crop, name, qr, found: true }
}

/** ข้อความบนป้ายที่วางทับชื่อ เช่น “สมาชิก 1333 ถวายประจำสัปดาห์” */
export const maskLabel = (code: string, typeName: string): string => `สมาชิก ${code.trim() || '—'} ${typeName.trim() ? `ถวาย${typeName.trim().replace(/^ถวาย/, '')}` : 'ถวายออนไลน์'}`
