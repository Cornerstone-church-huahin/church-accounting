import { useSharedStore } from './sharedStore'
import type { BankAccount, BudgetAdj, BudgetLine, IncomeEntry, IncomeType, Round, Settings, StatementBatch, StatementLine, Voucher } from './types'

const k = (n: string) => `acct.${n}.v1`

export const DEFAULT_INCOME_TYPES: IncomeType[] = ['ทศางค์', 'ถวายทั่วไป', 'ถวายพิเศษ', 'ถวายมิชชั่น', 'ถวายอาคาร/ก่อสร้าง', 'ถวายอื่น ๆ'].map((name, i) => ({ id: `t${i + 1}`, name, order: i, active: true, updated: 0 }))
export const DEFAULT_SETTINGS: Settings = { id: 'settings', churchName: 'คริสตจักรศิลาเอก หัวหิน', twoStepOver: 200000, matchDays: 7, csvMaps: {}, updated: 0 }

/** ค่าตั้งต้นและตัวเลือกที่แอดมินแก้ได้ (ไม่แบ่งปี) */
export function useIncomeTypes() {
  const s = useSharedStore<IncomeType>({ localKey: k('types'), file: 'income-types.json', label: 'ประเภทถวาย', seed: () => DEFAULT_INCOME_TYPES, write: 'settings' })
  return { ...s, list: [...s.items].sort((a, b) => a.order - b.order), byId: (id: string) => s.all.find((t) => t.id === id) }
}
export function useAccounts() {
  const s = useSharedStore<BankAccount>({ localKey: k('accounts'), file: 'accounts.json', label: 'บัญชีธนาคาร', write: 'settings' })
  return { ...s, list: s.items }
}
export function useSettings() {
  const s = useSharedStore<Settings>({ localKey: k('settings'), file: 'settings.json', label: 'ตั้งค่า', seed: () => [DEFAULT_SETTINGS] })
  const cur = s.items.find((x) => x.id === 'settings') ?? DEFAULT_SETTINGS
  return { ...s, settings: { ...DEFAULT_SETTINGS, ...cur }, save: (patch: Partial<Settings>) => s.put([{ ...DEFAULT_SETTINGS, ...cur, ...patch }]) }
}

// ---------- ข้อมูลรายปี: ไฟล์แยกปี ----------
export const useIncome = (year: number) => useSharedStore<IncomeEntry>({ localKey: k(`income.${year}`), file: `income-${year}.json`, label: `รายรับ ${year}`, write: 'income' })
export const useRounds = (year: number) => useSharedStore<Round>({ localKey: k(`rounds.${year}`), file: `rounds-${year}.json`, label: `รอบนับเงิน ${year}`, write: 'count' })
export const useVouchers = (year: number) => useSharedStore<Voucher>({ localKey: k(`vouchers.${year}`), file: `vouchers-${year}.json`, label: `ใบเบิกจ่าย ${year}` })
export const useBudgetLines = (year: number) => useSharedStore<BudgetLine>({ localKey: k(`budget.${year}`), file: `budget-${year}.json`, label: `งบประมาณ ${year}`, write: 'budget' })
export const useBudgetAdjs = (year: number) => useSharedStore<BudgetAdj>({ localKey: k(`budgetlog.${year}`), file: `budget-log-${year}.json`, label: `ประวัติปรับงบ ${year}`, write: 'budget' })
export const useStatementLines = (year: number) => useSharedStore<StatementLine>({ localKey: k(`stmt.${year}`), file: `statement-lines-${year}.json`, label: `รายการสเตตเมนต์ ${year}`, write: 'statement' })
export const useStatementBatches = () => useSharedStore<StatementBatch>({ localKey: k('stmt-batches'), file: 'statement-batches.json', label: 'ไฟล์สเตตเมนต์', write: 'statement' })
