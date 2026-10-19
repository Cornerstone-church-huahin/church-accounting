import { fmtBaht, fmtDate } from './money'

export interface AdjItem { date: string; amount: number; label?: string }
export interface AdjReport {
  title: string
  range: string
  matched: AdjItem[]
  unknown: AdjItem[]
  missing: AdjItem[]
  cash: number
  out: number
  closing?: number
}

/** ผลตรวจ: ไม่มีทั้ง "ไม่ทราบที่มา" และ "ไม่เจอในสมุด" = ครบถ้วน */
export const adjOk = (r: AdjReport) => r.unknown.length === 0 && r.missing.length === 0
const sum = (xs: AdjItem[]) => xs.reduce((s, x) => s + x.amount, 0)
const line = (x: AdjItem) => `  • ${fmtDate(x.date)}${x.label ? ` ${x.label}` : ''} — ${fmtBaht(x.amount)}`

/** รายงานตรวจสมุดบัญชีประจำสัปดาห์ เป็นข้อความอ่านง่าย (แชร์ LINE ได้) */
export function adjReportText(r: AdjReport): string {
  const sec = (head: string, xs: AdjItem[], empty: string) => [head, ...(xs.length ? xs.map(line) : [`  ${empty}`])]
  return [
    `🏦 รายงานตรวจสมุดบัญชี`,
    r.title,
    `ระหว่างวันที่ ${r.range}`,
    adjOk(r) ? '✅ ผลตรวจ: ตรงกันครบถ้วน' : '⚠️ ผลตรวจ: มีรายการที่ต้องตรวจ',
    '',
    ...sec(`✓ ตรงกับที่บันทึกไว้ ${r.matched.length} รายการ (${fmtBaht(sum(r.matched))})`, r.matched, 'ไม่มี'),
    '',
    ...sec(`❓ เงินเข้าที่ไม่ทราบที่มา ${r.unknown.length} รายการ (${fmtBaht(sum(r.unknown))})`, r.unknown, 'ไม่มี'),
    '',
    ...sec(`⚠ บันทึกว่าโอนแต่ไม่เจอในสมุด ${r.missing.length} รายการ (${fmtBaht(sum(r.missing))})`, r.missing, 'ไม่มี'),
    '',
    `ฝากเงินสด ${fmtBaht(r.cash)} · เงินออก ${fmtBaht(r.out)}`,
    ...(r.closing !== undefined ? [`ยอดคงเหลือท้ายสัปดาห์ ${fmtBaht(r.closing)}`] : []),
  ].join('\n')
}
