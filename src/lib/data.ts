import { useSharedStore } from './sharedStore'
import { mergeItems } from './sync'
import type { BankAccount, BudgetAdj, BudgetEntry, BudgetLine, IncomeEntry, IncomeType, Round, Settings, StatementBatch, StatementLine, Voucher } from './types'

const k = (n: string) => `acct.${n}.v1`

/** ประเภทตามใบบันทึกการถวายของคริสตจักร */
export const DEFAULT_INCOME_TYPES: IncomeType[] = ['สิบลด', 'ประจำสัปดาห์', 'ขอบพระคุณ', 'กองทุนเพื่อที่ดินคริสตจักร', 'กองทุนเพื่ออาหาร', 'รายได้อื่น (เช่น ค่าสถานที่สอน)'].map((name, i) => ({ id: `tt${i + 1}`, name, order: i, active: true, updated: 0 }))
/** ค่าตั้งต้นรุ่นแรกที่ยังไม่มีใครแก้ (updated = 0) ซ่อนไว้ เพื่อไม่ให้ปนกับประเภทจริง */
const LEGACY_SEED_IDS = new Set(['t1', 't2', 't3', 't4', 't5', 't6'])
const isLegacySeed = (t: IncomeType) => LEGACY_SEED_IDS.has(t.id) && t.updated === 0
export const DEFAULT_SETTINGS: Settings = { id: 'settings', churchName: 'คริสตจักรศิลาเอก หัวหิน', twoStepOver: 200000, matchDays: 7, csvMaps: {}, updated: 0 }

/** ค่าตั้งต้นและตัวเลือกที่แอดมินแก้ได้ (ไม่แบ่งปี) */
export function useIncomeTypes() {
  const s = useSharedStore<IncomeType>({ localKey: k('types'), file: 'income-types.json', label: 'ประเภทถวาย', write: 'settings' })
  // ค่าตั้งต้นรวมกับที่แอดมินแก้เองเสมอ (รายการที่แก้/ปิด/ลบแล้วมี updated ใหม่กว่าจึงชนะ)
  const merged = mergeItems(DEFAULT_INCOME_TYPES, s.all).filter((t) => !isLegacySeed(t))
  return { ...s, list: merged.filter((t) => !t.deleted).sort((a, b) => a.order - b.order), byId: (id: string) => merged.find((t) => t.id === id) }
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
export const useBudgetEntries = (year: number) => useSharedStore<BudgetEntry>({ localKey: k(`budgetentries.${year}`), file: `budget-entries-${year}.json`, label: `บันทึกตรงในงบ ${year}`, write: 'income' })
/** กองทุน: ไม่แบ่งปี (สะสมข้ามปี) */
export const useFunds = () => useSharedStore<BudgetLine>({ localKey: k('funds'), file: 'funds.json', label: 'กองทุน', write: 'budget' })
export const useBudgetAdjs = (year: number) => useSharedStore<BudgetAdj>({ localKey: k(`budgetlog.${year}`), file: `budget-log-${year}.json`, label: `ประวัติปรับงบ ${year}`, write: 'budget' })
export const useStatementLines = (year: number) => useSharedStore<StatementLine>({ localKey: k(`stmt.${year}`), file: `statement-lines-${year}.json`, label: `รายการสเตตเมนต์ ${year}`, write: 'statement' })
export const useStatementBatches = () => useSharedStore<StatementBatch>({ localKey: k('stmt-batches'), file: 'statement-batches.json', label: 'ไฟล์สเตตเมนต์', write: 'statement' })
