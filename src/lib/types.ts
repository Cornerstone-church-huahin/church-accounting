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
/** typeId ว่าง = "โอน (ยังไม่แยกประเภท)" — ใบถวายจริงลงเฉพาะยอดโอนรวม ไม่แยกตามประเภท */
export const UNSORTED = ''
export interface IncomeEntry extends SharedItem {
  date: string
  typeId: string
  amount: number
  method: Method
  /** เลขอ้างอิงการโอน (ถ้าเป็นเงินโอน) */
  ref?: string
  accountId?: string
  note?: string
  /** เลขสมาชิกผู้ถวาย (ไม่ใช้ชื่อ) — ไม่แสดงในรายงาน */
  memberNo?: string
  /** รูปสลิปโอน (ในโฟลเดอร์ attachments ของ repo ข้อมูล) */
  slip?: { path: string; name: string }
  /** มาจากรอบนับวันอาทิตย์: แก้ที่หน้ารอบนับเท่านั้น */
  roundId?: string
}

export type RoundStatus = 'counting' | 'verified'
export interface Round extends SharedItem {
  date: string
  /** ยอดเงินสดที่นับได้แยกตามประเภทถวาย (typeId → สตางค์) */
  lines: Record<string, number>
  /** จำนวนซองในตู้ถวายแต่ละประเภท (typeId → จำนวนซอง) */
  envelopes?: Record<string, number>
  /** จำนวนธนบัตร/เหรียญแต่ละชนิด (มูลค่าบาท → จำนวน) — ไม่บังคับ ใช้ตรวจยอดเพิ่มเติม */
  denoms: Record<string, number>
  status: RoundStatus
  counter: { id: string; name: string }
  verifier?: { id: string; name: string; at: number }
  deposit?: { date: string; amount: number; accountId: string; slip?: string }
  note?: string
}

/** incomeTypeIds = ประเภทรายรับที่เป็นเงินของงบนี้ (เช่น งบอาหาร ← กองทุนเพื่ออาหาร) ใช้แสดงแท่งรายรับสีเขียว */
export interface BudgetLine extends SharedItem { year: number; name: string; base: number; order: number; reserve?: boolean; incomeTypeIds?: string[] }
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
/** 1 ใบเบิกมีได้หลายรายการ (ตามใบเบิก-จ่ายเงินสดจริง) แต่ละรายการลงหมวดงบของตัวเอง */
/** cash = เงินสด · transfer = โอนจากบัญชีคริสตจักร (ไปจับคู่กับสเตตเมนต์) · advance = สำรองจ่ายโดยบุคคลแล้วเบิกคืน */
export type PayMethod = 'cash' | 'transfer' | 'advance'
export interface VoucherItem { desc: string; amount: number; lineId: string; method: PayMethod; ref?: string }
export interface Voucher extends SharedItem {
  no: string
  date: string
  requester: { id: string; name: string }
  /** ผู้รับเงิน/ร้านค้า (ถ้าทั้งใบจ่ายให้คนเดียว) */
  payee: string
  /** สรุปเรื่อง (ไม่บังคับ) */
  purpose: string
  /** รวมทุกรายการ (สตางค์) */
  amount: number
  /** ใบเก่า (รายการเดียว) ใช้ฟิลด์นี้ · ใบใหม่ใช้ items */
  lineId: string
  items?: VoucherItem[]
  status: VoucherStatus
  approvals: Approval[]
  rejected?: { name: string; reason: string; at: number }
  paid?: { date: string; method?: 'cash' | 'transfer' | 'cheque'; ref?: string; accountId?: string; by: string }
  attachments: Attachment[]
  /** ผู้ตรวจสอบยืนยันว่าใบเสร็จครบถ้วนถูกต้อง */
  receiptOk?: { name: string; at: number }
}

export interface StatementBatch extends SharedItem { accountId: string; filename: string; from: string; to: string; count: number; added: number; path?: string }
/** week = จับคู่หลายรายการธนาคารกับยอดโอนรวมของใบถวายวันอาทิตย์นั้น (refId = วันอาทิตย์) · voucher refId = id หรือ id#ลำดับรายการ */
export type MatchKind = 'deposit' | 'income' | 'voucher' | 'week' | 'other'
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
