import { addDays, daysInMonth, monthOf, monthShort, sheetSunday } from './money'
import { computeLedger, type LRow, type SumKind } from './weekLedger'

export type LedgerInput = Parameters<typeof computeLedger>[0]
export interface Bucket {
  label: string; from: string; to: string
  inCash: number; inTransfer: number; inTotal: number
  outCash: number; outTransfer: number; pending: number; outTotal: number
  /** รับ − จ่าย (รวมค้างจ่าย) ของช่วงนี้ และสะสมถึงช่วงนี้ */
  balance: number; cum: number
}

/** แบ่งช่วงของใบสรุปเป็นช่วงย่อย: เดือน → รายสัปดาห์ (ตัดตามวันอาทิตย์ ไม่ข้ามเดือน) · ไตรมาส/ปี → รายเดือน */
export function splitRange(kind: SumKind, range: { from: string; to: string }): { label: string; from: string; to: string }[] {
  const out: { label: string; from: string; to: string }[] = []
  if (kind === 'month') {
    let start = range.from
    while (start <= range.to) {
      const sun = sheetSunday(start)
      const end = sun < range.to ? sun : range.to
      const a = +start.slice(8), b = +end.slice(8)
      out.push({ label: a === b ? String(a) : `${a}–${b}`, from: start, to: end })
      start = addDays(end, 1)
    }
  } else if (kind === 'quarter' || kind === 'year') {
    const y = +range.from.slice(0, 4)
    for (let m = monthOf(range.from); m <= monthOf(range.to); m++) {
      const p = String(m).padStart(2, '0')
      out.push({ label: monthShort(m), from: `${y}-${p}-01`, to: `${y}-${p}-${String(daysInMonth(y, m)).padStart(2, '0')}` })
    }
  } else {
    const dn = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']
    for (let i = 0, d = range.from; d <= range.to && i < 7; i++, d = addDays(d, 1)) out.push({ label: dn[i], from: d, to: d })
  }
  return out
}

export function computeSeries(input: LedgerInput, kind: SumKind): Bucket[] {
  let cum = 0
  return splitRange(kind, input.range).map((b) => {
    const L = computeLedger({ ...input, range: { from: b.from, to: b.to } })
    const inTotal = L.inSum.cash + L.inSum.transfer
    const outTotal = L.outSum.cash + L.outSum.transfer + L.outSum.pending
    const balance = inTotal - outTotal
    cum += balance
    return { ...b, inCash: L.inSum.cash, inTransfer: L.inSum.transfer, inTotal, outCash: L.outSum.cash, outTransfer: L.outSum.transfer, pending: L.outSum.pending, outTotal, balance, cum }
  })
}

/** แถวสำหรับกราฟแท่งแนวนอน: เรียงมากไปน้อย แสดง n อันดับแรก ที่เหลือรวมเป็น "อื่น ๆ" */
export function topRows(rows: LRow[], n = 8): { label: string; value: number }[] {
  const v = rows.map((r) => ({ label: r.label, value: r.cash.amt + r.transfer.amt + (r.pending?.amt ?? 0) })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value)
  if (v.length <= n) return v
  return [...v.slice(0, n - 1), { label: 'อื่น ๆ', value: v.slice(n - 1).reduce((s, r) => s + r.value, 0) }]
}
