import type { FundAccount } from './fundAccounts'

export interface FundLine { key: string; date: string; label: string; amount: number; /** ยอดรวมสะสมของใบนี้ ณ แถวนี้ */ cum: number }
export interface FundSheets { opening: number; inn: FundLine[]; out: FundLine[]; totalIn: number; totalOut: number; balance: number }

/**
 * ใบกองทุน = A4 2 ชุด: ใบรับ (เงินเข้าทุกบรรทัด) และใบจ่าย (เงินออกทุกบรรทัด) — เรียงตามวันที่ต่อเนื่องไปเรื่อย ๆ ไม่แยกรายสัปดาห์
 * คงเหลือ = ยอดตั้งต้น + รับทั้งหมด − จ่ายทั้งหมด (ตรงกับยอดคงเหลือของกองทุนในหน้านี้)
 */
export function fundSheets(f: FundAccount): FundSheets {
  const sorted = [...f.moves].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
  let ci = 0, co = 0
  const inn: FundLine[] = [], out: FundLine[] = []
  for (const m of sorted) {
    if (m.amount > 0) inn.push({ key: m.key, date: m.date, label: m.label, amount: m.amount, cum: (ci += m.amount) })
    else if (m.amount < 0) out.push({ key: m.key, date: m.date, label: m.label, amount: -m.amount, cum: (co += -m.amount) })
  }
  return { opening: f.opening, inn, out, totalIn: ci, totalOut: co, balance: f.opening + ci - co }
}
