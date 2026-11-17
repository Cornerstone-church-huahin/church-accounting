/** แปลงข้อความที่ OCR อ่านจากสลิปโอนเงิน เป็นวันที่/เวลา/ยอด/เลขอ้างอิง/บันทึกช่วยจำ (ทำงานในเครื่อง ไม่ส่งรูปออกไปไหน) */
export interface SlipRead {
  date?: string
  time?: string
  /** สตางค์ */
  amount?: number
  ref?: string
  memo?: string
}

const MONTHS: Record<string, number> = {
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
  'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6, 'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
const key = (s: string) => s.replace(/[\s.]/g, '').toLowerCase()
const MONTH_BY_KEY = new Map(Object.entries(MONTHS).map(([k, v]) => [key(k), v]))
/** ตัดสระ/วรรณยุกต์ที่ OCR เติมเกินมา (เช่น ก.ุย. → ก.ย.) */
const stripMarks = (s: string) => s.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
const editDist1 = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d <= 1 }
const SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
/** เดือนจากข้อความที่ OCR อ่านเพี้ยน: ตรงเป๊ะ → ตัดวรรณยุกต์ → ผิด 1 ตัวอักษรและมีตัวเดียวที่ตรงกับ “รหัสอ้างอิงที่ขึ้นต้นด้วยปีเดือนวัน” (เช่น SCB 20260927…) */
function monthOf(tok: string, y: number, d: number, text: string): number | undefined {
  const k = key(tok)
  const exact = MONTH_BY_KEY.get(k) ?? MONTH_BY_KEY.get(key(stripMarks(tok)))
  if (exact) return exact
  const s = key(stripMarks(tok))
  const cands = SHORT_MONTHS.map((m, i) => [key(m), i + 1] as const).filter(([m]) => editDist1(m, s)).map(([, i]) => i)
  const ref = cands.filter((m) => text.includes(`${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`))
  return ref.length === 1 ? ref[0] : cands.length === 1 ? cands[0] : undefined
}
/** ปีที่ OCR อ่านเกินมา 1 หลัก (25609 → 2569): เลือกปี พ.ศ. ที่ใกล้ปัจจุบันที่สุด */
function fixYear(tok: string, today: Date): number {
  const n = Number(tok)
  if (tok.length !== 5) return n
  const be = today.getFullYear() + 543
  const cands = [...tok].map((_, i) => Number(tok.slice(0, i) + tok.slice(i + 1))).filter((v) => v <= be + 1 && v >= be - 3)
  return cands.length ? cands.sort((a, b) => Math.abs(a - be) - Math.abs(b - be))[0] : n
}
const norm = (s: string) => s.normalize('NFC').replace(/ํา/g, 'ำ').replace(/[\u200b\u200c]/g, '')

function toCE(y: number): number {
  if (y < 100) y += 2500 // 69 → 2569
  return y >= 2400 ? y - 543 : y
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export function parseSlipDate(raw: string, today = new Date()): { date?: string; time?: string } {
  const text = norm(raw)
  let date: string | undefined
  let at = -1 // ตำแหน่งที่พบวันที่ — เวลาต้องอยู่ถัดจากวันที่เดียวกัน (ไม่ใช่เวลาสถานะมือถือที่อยู่บนสุดของภาพ)
  // ปีสลิปเป็น พ.ศ. (2569 / 69) · เวลาข้อความในแชต LINE เป็น ค.ศ. (2026) จึงลองแบบ พ.ศ. ก่อน
  for (const beOnly of [true, false]) {
    for (const m of text.matchAll(/(\d{1,2})\s*([ก-๙A-Za-z][ก-๙A-Za-z.]{1,10}\.?)\s*(\d{2,5})/g)) {
      const yr = fixYear(m[3], today)
      if (beOnly && !(yr >= 2400 || yr < 100)) continue
      const d = Number(m[1]), y = toCE(yr)
      const mo = monthOf(m[2], y, d, text)
      if (!mo) continue
      const t = new Date(y, mo - 1, d)
      const ok = t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d
      const diff = (t.getTime() - today.getTime()) / 86400000
      if (ok && diff < 3 && diff > -800) { date = iso(y, mo, d); at = m.index ?? -1; break }
    }
    if (date) break
  }
  if (!date) {
    const n = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(text)
    if (n) {
      const d = Number(n[1]), mo = Number(n[2]), y = toCE(Number(n[3]))
      const t = new Date(y, mo - 1, d)
      if (mo >= 1 && mo <= 12 && t.getDate() === d) date = iso(y, mo, d)
    }
  }
  const near = at >= 0 ? text.slice(at, at + 70) : ''
  const tm = /(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*(?:น\.?|น)/.exec(near) ?? /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(near) ?? /(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*(?:น\.?|น)/.exec(text) ?? /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text)
  const time = tm ? `${String(Number(tm[1])).padStart(2, '0')}:${tm[2]}` : undefined
  return { date, time }
}

/** ตัวเลขที่ OCR อ่านเพี้ยน เช่น "2,.831.00" → 283100 สตางค์ (ยอดโอนมีทศนิยม 2 ตำแหน่งเสมอ) */
export function parseSlipAmount(raw: string): number | undefined {
  const text = norm(raw)
  const lines = text.split('\n')
  const cand: number[] = []
  const grab = (s: string) => {
    for (const m of s.matchAll(/(\d[\d,.\s]{0,12}\d)\s*[.,]\s*(\d{2})(?!\d)/g)) {
      const whole = m[1].replace(/\D/g, '')
      if (!whole) continue
      cand.push(Number(whole) * 100 + Number(m[2]))
    }
  }
  const i = lines.findIndex((l) => /จำนวน|amount/i.test(l))
  if (i >= 0) {
    // ยอดมักอยู่บรรทัดเดียวกับ "จำนวน" หรือบรรทัดถัดไป (ไม่เอาค่าธรรมเนียม)
    for (const l of lines.slice(i, i + 3)) { if (/ธรรมเนียม|fee/i.test(l)) break; grab(l); if (cand.length) break }
    if (cand.length) return cand[0]
  }
  for (const l of lines) { if (/ธรรมเนียม|fee|ยอดคงเหลือ|balance/i.test(l)) continue; if (/บาท|baht|thb/i.test(l)) grab(l) }
  // ไม่เจอคำว่า จำนวน/บาท (OCR อ่านเพี้ยน เช่น “THB” → “โห8”): ใช้ตัวเลขทศนิยม 2 ตำแหน่งที่มากที่สุดในข้อความ ไม่รวมค่าธรรมเนียม รหัสอ้างอิง และเวลา (11.08 น.)
  if (!cand.length) for (const l of lines) { if (/ธรรม|เนียม|fee|คงเหลือ|balance|รหัส|อ้างอิง|เลขที่/i.test(l) || /\d{1,2}[.:]\d{2}\s*น/.test(l)) continue; grab(l) }
  return cand.length ? Math.max(...cand) : undefined
}

export function parseSlipText(raw: string, today = new Date()): SlipRead {
  const text = norm(raw)
  const out: SlipRead = {}
  // วันที่/เวลา: เอาจากในการ์ดสลิป (ใต้หัว “โอนเงินสำเร็จ”) เป็นหลัก — รูปแคปหน้าจอมีเวลาสถานะมือถือและเวลาข้อความในแชตอยู่เหนือสลิป ซึ่งไม่ใช่เวลาโอน
  const anchor = text.search(/(?:โอนเงิน|รายการ|ทำรายการ).{0,4}ส.{1,3}เร|โอนเงินแล้ว/)
  const inCard = anchor >= 0 ? parseSlipDate(text.slice(anchor), today) : {}
  const dt = inCard.date ? inCard : parseSlipDate(text, today)
  if (dt.date) out.date = dt.date
  if (inCard.date ? inCard.time : dt.time) out.time = (inCard.date ? inCard.time : dt.time) as string
  const amt = parseSlipAmount(text)
  if (amt && amt > 0) out.amount = amt
  const lab = /(?:เลขที.{0,2}รายการ|รหัสอ้างอิง|หมายเลขอ้างอิง|เลขอ้างอิง|ref(?:erence)?\b)/i.exec(text)
  const ref = lab ? /[A-Za-z0-9]{12,30}/.exec(text.slice(lab.index + lab[0].length, lab.index + lab[0].length + 160)) : null
  if (ref) out.ref = ref[0].toUpperCase()
  const memo = /(?:บันทึกช่วยจำ|บันทึก|หมายเหตุ|memo|note)\s*[:：]\s*(.+)/i.exec(text)
  if (memo) out.memo = memo[1].trim().slice(0, 120)
  return out
}

/** รวมผลจากหลายรอบการอ่าน: วันที่/เวลาเอารอบแรกที่อ่านได้ ยอดเอาค่าที่ซ้ำกันมากที่สุด */
export function mergeSlipReads(reads: SlipRead[]): SlipRead {
  const out: SlipRead = {}
  for (const r of reads) {
    out.date ??= r.date
    out.time ??= r.time
    out.ref ??= r.ref
    out.memo ??= r.memo
  }
  const votes = new Map<number, number>()
  for (const r of reads) if (r.amount) votes.set(r.amount, (votes.get(r.amount) ?? 0) + 1)
  const best = [...votes.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
  if (best) out.amount = best[0]
  return out
}
