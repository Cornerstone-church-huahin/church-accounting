import type { SharedItem } from './sync'

/** ทุกจำนวนเงินเป็นสตางค์ (จำนวนเต็ม) · ทุกวันที่เป็น YYYY-MM-DD (ค.ศ.) */

export interface IncomeType extends SharedItem { name: string; order: number; active: boolean }
export interface BankAccount extends SharedItem { name: string; bank: string; last4: string }
export interface Settings extends SharedItem {
  churchName: string
  /** ใบเบิกที่เกินจำนวนนี้ต้องอนุมัติ 2 ขั้น (ผู้ตรวจสอบ + แอดมิน) · ต่ำกว่าอนุมัติ 1 ขั้น */
  twoStepOver: number
  /** จำนวนวันที่ยอมให้วันที่ในสเตตเมนต์ต่างจากวันที่ในระบบเมื่อแนะนำการจับคู่ */
  matchDays: number
  /** จำไว้ว่าไฟล์สเตตเมนต์ของแต่ละบัญชีใช้คอลัมน์ไหน */
  csvMaps: Record<string, CsvMap>
}
export interface CsvMap { date: number; desc: number; credit: number; debit: number; amount: number; balance: number }

export type Method = 'cash' | 'transfer'
export interface IncomeEntry extends SharedItem {
  date: string
  typeId: string
  amount: number
  method: Method
  /** เลขอ้างอิงการโอน (ถ้าเป็นเงินโอน) */
  ref?: string
  accountId?: string
  note?: string
  /** มาจากรอบนับวันอาทิตย์: แก้ที่หน้ารอบนับเท่านั้น */
  roundId?: string
}

export type RoundStatus = 'counting' | 'verified'
export interface Round extends SharedItem {
  date: string
  /** ยอดเงินสดที่นับได้แยกตามประเภทถวาย (typeId → สตางค์) */
  lines: Record<string, number>
  /** จำนวนธนบัตร/เหรียญแต่ละชนิด (มูลค่าบาท → จำนวนฉบับ/เหรียญ) */
  denoms: Record<string, number>
  status: RoundStatus
  counter: { id: string; name: string }
  verifier?: { id: string; name: string; at: number }
  deposit?: { date: string; amount: number; accountId: string; slip?: string }
  note?: string
}

export interface BudgetLine extends SharedItem { year: number; name: string; base: number; order: number; reserve?: boolean }
export type AdjKind = 'adjust' | 'emergency' | 'transfer'
export interface BudgetAdj extends SharedItem {
  year: number
  lineId: string
  /** บวก = เพิ่มงบ · ลบ = ลดงบ */
  delta: number
  kind: AdjKind
  reason: string
  date: string
  /** การโอนงบระหว่างหมวดมี 2 รายการที่ group เดียวกัน */
  group?: string
}

export type VoucherStatus = 'submitted' | 'approved' | 'paid' | 'rejected' | 'void'
export interface Attachment { path: string; name: string; kind: 'receipt' | 'quote' | 'other'; at: number; by: string }
export interface Approval { id: string; name: string; role: Role2; at: number; note?: string }
type Role2 = 'admin' | 'auditor' | 'bookkeeper' | 'viewer'
export interface Voucher extends SharedItem {
  no: string
  date: string
  requester: { id: string; name: string }
  payee: string
  purpose: string
  amount: number
  lineId: string
  status: VoucherStatus
  approvals: Approval[]
  rejected?: { name: string; reason: string; at: number }
  paid?: { date: string; method: 'cash' | 'transfer' | 'cheque'; ref?: string; accountId?: string; by: string }
  attachments: Attachment[]
  /** ผู้ตรวจสอบยืนยันว่าใบเสร็จครบถ้วนถูกต้อง */
  receiptOk?: { name: string; at: number }
}

export interface StatementBatch extends SharedItem { accountId: string; filename: string; from: string; to: string; count: number; added: number; path?: string }
export type MatchKind = 'deposit' | 'income' | 'voucher' | 'other'
export interface StatementLine extends SharedItem {
  batchId: string
  accountId: string
  date: string
  desc: string
  credit: number
  debit: number
  balance?: number
  match?: { kind: MatchKind; refId: string; note?: string; by: string; at: number }
}
