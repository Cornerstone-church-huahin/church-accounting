import type { FundAccount, FundMove } from './fundAccounts'

/** กองทุนที่ถือเป็น “กองทุนที่ดิน” = ชื่อมีคำว่า “ที่ดิน” (ตั้งชื่อกองทุนใหม่ในตั้งค่าแล้วเข้าข่ายอัตโนมัติ) */
export const isLandFund = (f: Pick<FundAccount, 'name'>) => f.name.includes('ที่ดิน')

/** เงินถวายที่เข้ากองทุน (นับรอบถวาย · บันทึกรับ · โอนเข้าสมุดบัญชี) — ไม่รวมเงินยืม/คืน */
const isOffering = (m: FundMove) => m.amount > 0 && /^(rd|in|pb):/.test(m.key)

export interface LandFund { id: string; name: string; opening: number; offered: number; out: number; balance: number }
export interface LandSummary {
  funds: LandFund[]
  /** ยอดสุทธิรวมทุกกองทุนที่ดิน */
  balance: number
  /** เงินถวายเพิ่มเติมรวม (หลังยอดตั้งต้น) */
  offered: number
  /** รายการเคลื่อนไหวล่าสุดของกองทุนที่ดิน (ใหม่ → เก่า) */
  recent: (FundMove & { fund: string })[]
}

export function landSummary(accounts: FundAccount[], recentLimit = 10): LandSummary {
  const lands = accounts.filter(isLandFund)
  const funds = lands.map((f) => ({
    id: f.id, name: f.name, opening: f.opening, balance: f.balance, out: f.moneyOut,
    offered: f.moves.filter(isOffering).reduce((s, m) => s + m.amount, 0),
  }))
  const recent = lands.flatMap((f) => f.moves.map((m) => ({ ...m, fund: f.name })))
    .sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key)).slice(0, recentLimit)
  return { funds, balance: funds.reduce((s, f) => s + f.balance, 0), offered: funds.reduce((s, f) => s + f.offered, 0), recent }
}
