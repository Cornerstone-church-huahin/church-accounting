/** เงินเก็บเป็น "สตางค์" (จำนวนเต็ม) เพื่อไม่ให้ทศนิยมคลาดเคลื่อน · วันที่เก็บเป็นข้อความ YYYY-MM-DD */

/** พิมพ์ "1,234.5" → 123450 · ว่าง/ผิดรูปแบบ → NaN */
export function parseBaht(s: string): number {
  const t = s.replace(/[,\s฿บาท]/g, '')
  if (!/^-?\d*\.?\d{0,2}$/.test(t) || t === '' || t === '-' || t === '.') return NaN
  return Math.round(parseFloat(t) * 100)
}

export function fmtBaht(satang: number, opts: { dec?: boolean; sign?: boolean } = {}): string {
  const neg = satang < 0
  const abs = Math.abs(satang)
  const whole = Math.floor(abs / 100).toLocaleString('en-US')
  const cents = String(abs % 100).padStart(2, '0')
  const dec = opts.dec ?? true
  const body = dec || abs % 100 !== 0 ? `${whole}.${cents}` : whole
  return `${neg ? '−' : opts.sign && satang > 0 ? '+' : ''}${body}`
}

/** ตัวเลขบนแกนกราฟ: 12.5k, 1.2M */
export function fmtShort(satang: number): string {
  const b = satang / 100
  const a = Math.abs(b)
  if (a >= 1_000_000) return `${+(b / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `${+(b / 1_000).toFixed(1)}k`
  return String(Math.round(b))
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// ---------- วันที่ (ใช้ UTC ภายในเพื่อไม่ให้เขตเวลาทำให้วันเพี้ยน) ----------
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
export const monthName = (m: number) => MONTHS[m - 1] ?? ''
export const monthShort = (m: number) => MONTHS_SHORT[m - 1] ?? ''

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const fromUTC = (t: number) => {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
export const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUTC(toUTC(s)) === s

export function todayISO(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
export const addDays = (iso: string, n: number) => fromUTC(toUTC(iso) + n * 86_400_000)
export const diffDays = (a: string, b: string) => Math.round((toUTC(a) - toUTC(b)) / 86_400_000)
export const dow = (iso: string) => new Date(toUTC(iso)).getUTCDay()
/** วันอาทิตย์ของสัปดาห์นั้น (สัปดาห์ของคริสตจักรเริ่มวันอาทิตย์ จบวันเสาร์) */
export const weekStart = (iso: string) => addDays(iso, -dow(iso))
export const yearOf = (iso: string) => Number(iso.slice(0, 4))
export const monthOf = (iso: string) => Number(iso.slice(5, 7))
export const be = (y: number) => y + 543
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** 4 ต.ค. 69 */
export function fmtDate(iso: string): string {
  if (!isISO(iso)) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]} ${String(be(y)).slice(2)}`
}
/** วันอาทิตย์ที่ 4 ตุลาคม 2569 */
export function fmtDateLong(iso: string): string {
  if (!isISO(iso)) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `วัน${DAYS[dow(iso)]}ที่ ${d} ${MONTHS[m - 1]} ${be(y)}`
}
/** ทุกวันอาทิตย์ของปีนั้น */
export function sundaysOf(year: number): string[] {
  let d = `${year}-01-01`
  d = addDays(d, (7 - dow(d)) % 7)
  const out: string[] = []
  while (yearOf(d) === year) { out.push(d); d = addDays(d, 7) }
  return out
}
export const inRange = (d: string, from: string, to: string) => d >= from && d <= to
