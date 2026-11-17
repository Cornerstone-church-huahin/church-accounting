/** ปิดชื่อ/คิวอาร์ในรูปสลิปก่อนแชร์: อ่านรหัสสมาชิกจากหัวแชต + หาตำแหน่งกรอบชื่อ/คิวอาร์/ขอบสลิปจากข้อความที่ OCR อ่านได้ */
export interface Box { x: number; y: number; w: number; h: number }
export interface OcrLine { text: string; x0: number; y0: number; x1: number; y1: number; words?: OcrWord[] }
export interface MaskLayout { crop: Box; name: Box | null; qr: Box | null; found: boolean; /** ข้อความชื่อผู้โอนที่อ่านได้ (ใช้จับคู่กับทะเบียนสมาชิก · ภาษาอังกฤษ OCR ไทยอ่านไม่ได้จะว่าง/เพี้ยน) */ nameText?: string }

const THAI_MONTH = /^\s*(?:ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค|ม\.|ก\.|พ\.)/

/** รหัสสมาชิกจากหัวแชต เช่น “1333ปิ่ม รัชนี” → 1333 (ตัวเลข 3–6 หลักที่ขึ้นต้นบรรทัด ตามด้วยชื่อ · ไม่เอาวันที่/เวลา/สถานะมือถือ) */
export function parseMemberCode(text: string): string | undefined {
  const lines = text.normalize('NFC').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10)
  for (const l of lines) {
    if (/\d{1,2}[:.]\d{2}/.test(l)) continue // เวลา/สถานะ
    const m = /^[^0-9ก-๙A-Za-z]{0,3}(\d{3,6})(?=\s*(?:[-–._]\s*\d?)?[ก-๙A-Za-z])(?!\s*(?:บาท|น\.))/.exec(l)
    if (!m) continue
    if (THAI_MONTH.test(l.slice(m[1].length))) continue
    return m[1]
  }
  return undefined
}

export interface OcrWord { t: string; x0: number; y0: number; x1: number; y1: number }
const nrm = (t: string) => t.normalize('NFC').replace(/\s+/g, '')
const BANK = /ธ\.|ธนาคาร|bank|กสิกร|กรุงไทย|กรุงเทพ|กรุงศรี|ไทยพาณิชย์|ทหารไทย|ออมสิน|ธกส|ยูโอบี|ซีไอเอ็มบี|ธนชาต|เกียรตินาคิน|ทีทีบี|ttb/i
/** เลขบัญชีที่ปิดบางส่วน เช่น xxx-x-x8686-x / XXX-1-23141-X / 710-0-xxx499 / xxx-xxx765-1 — ไม่มีตัวหนังสือไทย มีขีดและตัวเลขอย่างน้อย 3 ตัว (OCR มักอ่าน x เป็น % หรือเลขไทย) */
const isAcct = (t: string) => { const tok = t.trim().split(/\s+/).pop() ?? ''; const s = tok.length >= 6 ? tok : t.replace(/\s+/g, ''); return s.length >= 6 && s.length <= 24 && !/[ก-ฮ]/.test(s) && /[-–]/.test(s) && (s.match(/[0-9๐-๙]/g) ?? []).length >= 3 && !/[:.,]\d{2}/.test(s) }
const digitsIn = (t: string) => (t.match(/[0-9]/g) ?? []).length
const isRefLine = (t: string) => /รหัส|อ้าง|อิง|เลขที่|หมายเลข|ref/i.test(t) || (t.match(/[0-9A-Za-z]/g) ?? []).length >= 14
const isDateLine = (t: string) => /\d{1,2}.{0,14}\d{1,2}[:.]\d{2}/.test(t.replace(/\s+/g, '')) || /(?:ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค)/.test(t)
const unionBox = (bs: { x0: number; y0: number; x1: number; y1: number }[]): Box => { const x0 = Math.min(...bs.map((l) => l.x0)), y0 = Math.min(...bs.map((l) => l.y0)), x1 = Math.max(...bs.map((l) => l.x1)), y1 = Math.max(...bs.map((l) => l.y1)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } }
const grow = (b: Box, px: number, py: number, W: number, H: number): Box => { const x = Math.max(0, b.x - px), y = Math.max(0, b.y - py); return { x, y, w: Math.min(W, b.x + b.w + px) - x, h: Math.min(H, b.y + b.h + py) - y } }
const wordsOf = (l: OcrLine): OcrWord[] => (l.words?.length ? l.words : [{ t: l.text, x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 }])
/** เศษสัญลักษณ์/โลโก้ที่ OCR อ่านเป็นตัวอักษรเดี่ยว (@ | % ฯลฯ) ไม่นับเป็นคำของชื่อ */
/** ต่อคำที่ OCR แตกเป็นพยางค์ให้เป็นข้อความ: เว้นวรรคเมื่อช่องว่างระหว่างคำกว้างกว่าครึ่งความสูงตัวอักษร */
function joinWords(ws: OcrWord[]): string {
  const s = [...ws].sort((a, b) => a.x0 - b.x0)
  const h = Math.max(1, ...s.map((w) => w.y1 - w.y0)) * 0.5
  return s.reduce((acc, w, i) => acc + (i > 0 && w.x0 - s[i - 1].x1 > h ? ' ' : '') + w.t, '').replace(/\s+/g, ' ').trim()
}
const isJunkWord = (w: OcrWord) => { const t = w.t.replace(/\s+/g, ''); return t.length === 0 || (t.length <= 1 && !/[ก-ฮA-Za-z]/.test(t)) }

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
 * จัดวางกรอบอัตโนมัติ (ผู้ใช้ลากปรับได้เสมอ) รองรับสลิป K+ / กรุงไทย / ไทยพาณิชย์ / กรุงศรี / กรุงเทพ:
 *  - ชื่อผู้โอน: ถ้ามีป้าย “จาก” (กรุงไทย ไทยพาณิชย์ กรุงเทพ) = ข้อความที่อยู่ทางขวา/ใต้ป้าย · ไม่มี (K+ กรุงศรี) = บรรทัดแรกใต้หัว/วันที่ก่อนธนาคาร-เลขบัญชี
 *    (ใช้ตำแหน่งเป็นหลัก เพราะ OCR อ่านชื่อภาษาอังกฤษไม่ได้) · ถ้าเลขบัญชีผู้โอนเห็นตัวเลข ≥ 5 ตัว (กรุงเทพ/กรุงศรี) ปิดบรรทัดเลขบัญชีด้วย
 *  - ขอบสลิป: ตัดเฉพาะรูปแคปหน้าจอแชต (มีหัวแชต/เวลามือถือเหนือสลิป) · สลิปที่เซฟมาเป็นภาพสลิปแล้ว = ทั้งรูป
 *  - คิวอาร์: ตรวจจากพิกเซลโดยแยก (findQrBox) · ถ้าไม่ได้ส่งมา ใช้คำอธิบายใต้คิวอาร์ (สแกนตรวจสอบสลิป) ช่วยประมาณ
 */
export function slipLayout(lines: OcrLine[], W: number, H: number, qrFound?: Box | null, cardFound?: Box | null): MaskLayout {
  const L = lines.filter((l) => l.text.trim() && l.x1 > l.x0 && l.y1 > l.y0)
  const whole: Box = { x: 0, y: 0, w: W, h: H }
  let title: Box | null = null
  for (const l of L) { title = spanBox(l, /(?:โอนเงิน|รายการ|ทำรายการ).{0,4}ส.{1,3}เร/); if (title) break }
  if (!title) { // สำรอง: บรรทัดวันที่-เวลาใต้หัวสลิป → หัวสลิปอยู่เหนือขึ้นไป ~1.7 บรรทัด
    const d = L.find((l) => l.y0 > H * 0.04 && isDateLine(l.text) && /น/.test(l.text))
    if (d) { const b = spanBox(d, /\d{1,2}.{0,14}\d{1,2}[:.]\d{2}/) ?? { x: d.x0, y: d.y0, w: d.x1 - d.x0, h: d.y1 - d.y0 }; title = { x: b.x, y: Math.max(0, b.y - b.h * 1.9), w: b.w, h: b.h } }
  }
  const t: Box | null = title

  // ---- ชื่อผู้โอน ----
  const fromLine = L.find((l) => /^(จาก|from)/i.test(nrm(l.text)) && (!t || l.y0 > t.y - 5))
  let nameWords: OcrWord[] = []
  let nameLine: OcrLine | null = null
  // ขอบขวาของป้าย “จาก” (OCR อาจแตกเป็นหลายคำ จ/า/ก) — เอาคำแรก ๆ จนครบ 3 ตัวอักษร
  let labelRight = fromLine ? fromLine.x0 : 0
  if (fromLine) { let acc = ''; for (const w of wordsOf(fromLine)) { acc += nrm(w.t); labelRight = w.x1; if (acc.length >= (/^from/i.test(acc) ? 4 : 3) || acc.length > 6) break } }
  if (fromLine) {
    const ws = wordsOf(fromLine).filter((w) => w.x0 > labelRight + W * 0.03 && !isJunkWord(w))
    if (ws.length) { nameWords = ws; nameLine = fromLine }
  }
  if (!nameWords.length && fromLine) { // ป้าย “จาก” อยู่บรรทัดเดียว (กรุงไทย): ชื่ออยู่บรรทัดถัดลงไป
    const lim = fromLine.y1 + H * 0.07
    const below = L.filter((l) => l !== fromLine && l.y0 >= fromLine.y1 - 6 && l.y0 < lim && l.x0 >= fromLine.x0 - 12 && !BANK.test(l.text) && !isAcct(l.text) && !isDateLine(l.text) && !isRefLine(l.text) && !/^(จาก|ไปยัง|ไปที่)$/.test(nrm(l.text)) && /[ก-๙A-Za-z]{2,}/.test(l.text)).sort((a, b) => a.y0 - b.y0)[0]
    if (below) { nameLine = below; nameWords = wordsOf(below).filter((w) => !isJunkWord(w)) }
  }
  if (!nameWords.length) {
    // ไล่ขึ้นจากเลขบัญชีผู้โอนบรรทัดแรก ข้ามบรรทัดธนาคาร → บรรทัดชื่อ (K+ กรุงไทย กรุงศรี: ชื่อ → [ธนาคาร] → เลขบัญชี) · ไม่พึ่งการอ่านหัวสลิป/ตัวหนังสือชื่อ
    const ac1 = L.filter((l) => isAcct(l.text) && l.y0 > H * 0.1).sort((a, b) => a.y0 - b.y0)[0]
    if (ac1) {
      const ups = L.filter((l) => l.y0 < ac1.y0 - 4 && l.y0 > ac1.y0 - H * 0.14).sort((a, b) => b.y0 - a.y0)
      const up = ups.find((l) => !BANK.test(l.text) && !isRefLine(l.text) && !isDateLine(l.text) && !/^(จาก|ไปยัง|ไปที่|from|to)$/i.test(nrm(l.text)) && !/สำเร็จ|สําเร็จ/.test(l.text) && /[ก-๙A-Za-z]{2,}/.test(l.text) && wordsOf(l).some((w) => !isJunkWord(w)))
      if (up) { nameLine = up; nameWords = wordsOf(up).filter((w) => !isJunkWord(w)) }
    }
  }
  if (!nameWords.length && t) {
    // ใต้หัว/วันที่ ก่อนธนาคาร-เลขบัญชีบรรทัดแรก · ข้ามบรรทัดวันที่ รหัสอ้างอิง และเศษ OCR
    const tb = t.y + t.h
    const firstBank = L.filter((l) => l.y0 > tb && (BANK.test(l.text) || isAcct(l.text))).sort((a, b) => a.y0 - b.y0)[0]
    const limit = firstBank ? firstBank.y0 : tb + H * 0.14
    const cand = L.filter((l) => l.y0 >= tb - 6 && l.y0 < limit - 4 && l.x1 > t.x && !BANK.test(l.text) && !isAcct(l.text) && !isDateLine(l.text) && !isRefLine(l.text) && !/^(จาก|ไปยัง|ไปที่)$/.test(nrm(l.text)) && !/สำเร็จ|สําเร็จ/.test(l.text) && /[ก-๙A-Za-z]{2,}/.test(l.text) && wordsOf(l).some((w) => w.x0 >= t.x - 6 && !isJunkWord(w)))
    if (cand.length) { nameLine = cand[0]; nameWords = wordsOf(cand[0]).filter((w) => w.x0 >= t.x - 6 && !isJunkWord(w)) }
  }
  let name: Box | null = null
  let nameText = ''
  if (nameWords.length && nameLine) {
    nameText = joinWords(nameWords)
    let nb = unionBox(nameWords)
    // ขวาสุด: ใช้ขอบบรรทัดถ้าไม่ไกลเกินจริง (OCR อาจทิ้งตัวอักษรท้ายชื่อเป็นเศษ แต่ขอบบรรทัดครอบถึงแล้ว)
    if (nameLine !== fromLine && nameLine.x1 > nb.x + nb.w && nameLine.x1 - (nb.x + nb.w) < W * 0.08) nb = { ...nb, w: nameLine.x1 - nb.x }
    // ซ้ายสุดใช้ขอบบรรทัด (OCR มักทิ้งคำแรกของชื่อเป็นเศษ) เมื่อบรรทัดนั้นเริ่มในคอลัมน์ชื่อ ไม่ใช่ป้าย “จาก”
    if (!fromLine || nameLine !== fromLine) { if (t && nameLine.x0 >= t.x - 6 && nameLine.x0 < nb.x) { nb = { ...nb, w: nb.w + (nb.x - nameLine.x0), x: nameLine.x0 } } }
    const ac = L.filter((l) => isAcct(l.text) && l.y0 > nb.y + nb.h * 0.3).sort((a, b) => a.y0 - b.y0)[0]
    // เส้นโอเวอร์เลย์ของ OCR มักสูงเกินจริง จำกัดความสูงไม่ให้ล้ำเลขบัญชีบรรทัดถัดไป
    if (ac && ac.y0 > nb.y && nb.y + nb.h > ac.y0 - 2) nb = { ...nb, h: Math.max(8, ac.y0 - 2 - nb.y) }
    if (ac && ac.y0 - (nb.y + nb.h) < nb.h * 3 && digitsIn(ac.text) >= 6) { const ab = unionBox(wordsOf(ac).filter((w) => !isJunkWord(w))); nb = unionBox([{ x0: nb.x, y0: nb.y, x1: nb.x + nb.w, y1: nb.y + nb.h }, { x0: ab.x, y0: ab.y, x1: ab.x + ab.w, y1: ab.y + ab.h }]) }
    name = grow(nb, Math.round(W * 0.018), Math.round(H * 0.004), W, H)
  }

  // ---- คิวอาร์ ----
  let cap: Box | null = null
  for (const l of [...L].reverse()) { const c = spanBox(l, /สแกน(?!คิวอาร์)|ตรวจสอบสลิป/, true); if (c && !/ผู้รับเงิน|คิวอาร์โค้ด/.test(nrm(l.text))) { cap = c; break } }
  let qr: Box | null = null
  if (qrFound) {
    qr = grow(qrFound, Math.round(W * 0.01), Math.round(W * 0.01), W, H)
    // คำอธิบายใต้คิวอาร์ (K+ กรุงศรี) อยู่ติดใต้คิวอาร์ → ปิดไปด้วย
    if (cap && cap.y >= qr.y + qr.h * 0.6 && cap.y <= qr.y + qr.h + H * 0.04) { const bot = Math.max(qr.y + qr.h, cap.y + cap.h + Math.round(H * 0.004)); qr = { ...qr, h: Math.min(H, bot) - qr.y } }
  } else if (cap) {
    const side = cap.w * 1.08
    qr = grow({ x: cap.x - (side - cap.w) / 2, y: cap.y - side, w: side, h: side + cap.h }, Math.round(W * 0.012), Math.round(H * 0.004), W, H)
  }

  if (!t && !name && !qr) return { crop: whole, name: null, qr: null, found: false }

  // ---- ขอบสลิป: ตัดเฉพาะรูปแคปหน้าจอแชต (มีเวลาสถานะมือถือ/หัวแชตเหนือสลิป) ----
  const chat = !!t && L.some((l) => l.y1 < t.y - 10 && (/\d{1,2}[:.]\d{2}\s*น/.test(l.text) || parseMemberCode(l.text) !== undefined))
  let crop = whole
  if (chat && cardFound) crop = cardFound
  else if (chat && t) {
    const left = Math.max(0, t.x - Math.round(W * 0.075))
    const top = Math.max(0, t.y - Math.round(H * 0.022))
    const lastY = cap ? cap.y + cap.h : t.y + t.h + H * 0.45
    const bottom = Math.min(H, lastY + Math.round(H * 0.035))
    const right = Math.min(W, cap ? cap.x + cap.w + Math.round(W * 0.057) : W)
    crop = { x: left, y: top, w: Math.max(40, right - left), h: Math.max(40, bottom - top) }
  }
  return { crop, name, qr, found: !!(t || name || qr), nameText }
}

/** ข้อความบนป้ายที่วางทับชื่อ เช่น “สมาชิก 1333 ถวายประจำสัปดาห์” */
export const maskLabel = (code: string, typeName: string): string => `สมาชิก ${code.trim() || '—'} ${typeName.trim() ? `ถวาย${typeName.trim().replace(/^ถวาย/, '')}` : 'ถวายออนไลน์'}`
