import type { SharedItem } from './sync'

/** ทุกจำนวนเงินเป็นสตางค์ (จำนวนเต็ม) · ทุกวันที่เป็น YYYY-MM-DD (ค.ศ.) */

/** หมวดย่อยภายในกองทุน (เช่น พืชผัก โต๊ะจีน) — รายรับ/รายจ่ายของกองทุนระบุหมวดได้ แยกยอด/รายงานตามหมวด */
export interface FundSub { id: string; name: string; active: boolean; order: number; /** กิจกรรมของกองทุนที่หมวดนี้อยู่ (กองทุนโหมดกิจกรรม) */ actId?: string }
/** กิจกรรมในกองทุน (เช่น วันขอบคุณพระเจ้า คริสต์มาส): วันที่ = วันเริ่มกิจกรรม · ปิดกิจกรรมแล้วบันทึกเพิ่มไม่ได้ และมีคะแนนประเมิน 0-10 พร้อมเหตุผล */
/** อนุกรรมการจัดงาน (ทีมที่คณะกรรมการแต่งตั้ง): ใครทำหน้าที่อะไร */
export interface ActMember { id: string; name: string; duty?: string }
export interface ActGoal { id: string; text: string; done: boolean; doneDate?: string }
/** ประเมินผลกิจกรรม: ความพึงพอใจ 0–100 (แสดงเป็นขีดปรอทที่การ์ด) + ข้อดี/ข้อเสีย/สรุป */
export interface ActEval { score: number; pros?: string; cons?: string; summary?: string; /** คณะกรรมการประเมินเมื่อวันที่ */ evaluatedDate?: string; /** ความเห็นของคณะกรรมการต่อผลงานของอนุกรรมการ */ comment?: string }
/** มติที่ประชุมคณะกรรมการที่ตั้งอนุกรรมการจัดงาน */
export interface ActResolution { meeting?: string; date?: string; text?: string }
export interface FundActivity { id: string; name: string; /** วันเริ่มกิจกรรม */ date: string; /** วันสิ้นสุด (ไม่ใส่ = วันเดียวกับวันเริ่ม) */ endDate?: string; /** อนุกรรมการจัดงาน (ชื่อ + หน้าที่) — ทุกคนที่เปิดกิจกรรมเห็น แอดมินแก้ได้ */ team?: ActMember[]; /** มติคณะกรรมการที่ตั้งอนุกรรมการ (ประชุมครั้งที่/วันที่/มติ) */ resolution?: ActResolution; purpose?: string; /** (เลิกใช้) โน้ตอนุกรรมการแบบข้อความ — ใช้รายชื่อ team แทน */ committee?: string; note?: string; /** เป้าหมาย/ขั้นตอนของงาน: ทำแล้ว/ยังไม่ทำ */ goals?: ActGoal[]; eval?: ActEval; closed?: { date: string } }
export interface IncomeType extends SharedItem { name: string; order: number; active: boolean
  /** หมวดย่อยของกองทุนนี้ (ไม่มี = กองทุนไม่แบ่งหมวด) */
  subs?: FundSub[]
  /** โหมดกิจกรรม: กองทุนแบ่งเป็นกิจกรรม แต่ละกิจกรรมมีหมวดของตัวเอง */
  actMode?: boolean
  activities?: FundActivity[]
  /** เป็นกองทุนวัตถุประสงค์ (ไม่ตั้ง = เดาจากชื่อ เช่น "กองทุน…" "สร้างอาคาร") */
  fund?: boolean }
export interface BankAccount extends SharedItem { name: string; bank: string; last4: string
  /** operating = บัญชีหมุนเวียน · restricted = บัญชีเงินวัตถุประสงค์ */
  role?: 'operating' | 'restricted' }
export interface Settings extends SharedItem {
  churchName: string
  /** ใบเบิกที่เกินจำนวนนี้ต้องอนุมัติ 2 ขั้น (ผู้ตรวจสอบ + แอดมิน) · ต่ำกว่าอนุมัติ 1 ขั้น */
  twoStepOver: number
  /** จำนวนวันที่ยอมให้วันที่ในสเตตเมนต์ต่างจากวันที่ในระบบเมื่อแนะนำการจับคู่ */
  matchDays: number
  /** จำไว้ว่าไฟล์สเตตเมนต์ของแต่ละบัญชีใช้คอลัมน์ไหน */
  csvMaps: Record<string, CsvMap>
  /** เกณฑ์ตรวจสมาชิก: เป็นสมาชิกครบกี่ปีถึงเป็นสมาชิกสมบูรณ์ · ไม่มานมัสการเกินกี่เดือนถือว่าขาด */
  memberMinYears?: number
  memberAbsentMonths?: number
  /** ข้อความสรุปสถานการณ์การเงินถึงผู้นำงาน (แอดมินเขียน แสดงบนหน้า ภาพรวม) */
  leaderNote?: { text: string; at: number }
}
export interface CsvMap { date: number; desc: number; credit: number; debit: number; amount: number; balance: number }

export type Method = 'cash' | 'transfer'
/**
 * ชื่อเรียกเงินโอนที่ไม่ทราบวัตถุประสงค์ — ใช้คำเดียวกันทั้งระบบ (รายการ รายงาน ใบสรุป แบบฟอร์ม)
 * แก้ข้อความที่นี่ที่เดียว · ประเภท "Unkonw" ที่ตั้งเองในตั้งค่า ใช้ชื่อเดียวกันนี้
 */
export const UNKNOWN_INCOME_LABEL = 'โอน (ไม่แจ้งวัตถุประสงค์) Unkonw'
/** typeId ว่าง = โอนที่ยังไม่แยกวัตถุประสงค์ (UNKNOWN_INCOME_LABEL) — ใบถวายจริงลงเฉพาะยอดโอนรวม ไม่แยกตามประเภท */
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
  /** เงินเข้าบัญชีที่ไม่มีสลิป/ไม่รู้ที่มา — นับเป็นรายรับไว้ก่อน แล้วให้ผู้บันทึกบัญชีระบุที่มาทีหลัง */
  unknown?: boolean
  /** เลขสมาชิกผู้ถวาย (ไม่ใช้ชื่อ) — ไม่แสดงในรายงาน */
  memberNo?: string
  /** รูปสลิปโอน (ในโฟลเดอร์ attachments ของ repo ข้อมูล) */
  slip?: { path: string; name: string }
  /** หมวดย่อยของกองทุน (ว่าง = ส่วนกลาง ยังไม่ระบุหมวด) */
  subId?: string
  /** บันทึกจากหน้ากองทุน: เป็นของโซนกองทุนล้วน ไม่ผ่านบัญชีหมุนเวียน → ไม่ขึ้นในใบ/สรุป/แฟ้มรายสัปดาห์ของบัญชีหมุนเวียน */
  fz?: boolean
  /** รูปหลักฐานหลายรูป (บิล/สลิป/รูปงาน) แนบในใบบันทึกการถวาย */
  photos?: { path: string; name: string }[]
  /** มาจากรอบนับวันอาทิตย์: แก้ที่หน้ารอบนับเท่านั้น */
  roundId?: string
  /** บันทึกจากช่องไหนในหน้าแรก: manual = บันทึกด้วยมือ · slip = สลิป */
  source?: 'manual' | 'slip'
  /** เวลาที่โอนตามสลิป (HH:mm) */
  time?: string
  /** เงินสด: จำนวนซอง · เงินโอน: จำนวนครั้งที่โอน (ไม่ใส่ = 1) */
  count?: number
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
  /** สร้าง/อัปเดตจากไฟล์ใบบันทึกการถวายนี้ */
  sheetFileId?: string
}

/** incomeTypeIds = ประเภทรายรับที่เป็นเงินของงบนี้ (เช่น งบอาหาร ← กองทุนเพื่ออาหาร) ใช้แสดงแท่งรายรับสีเขียว */
export interface BudgetLine extends SharedItem { year: number; name: string; base: number; order: number; reserve?: boolean; incomeTypeIds?: string[]
  /** ยอดตั้งต้นที่แก้ได้อิสระ: เงินที่มีอยู่แล้ว (แท่งเขียว) และที่ใช้ไปแล้วก่อนเริ่มใช้ระบบ (แท่งแดง) */
  openingIn?: number; openingOut?: number
  /** กองทุน: เก็บแยกจากงบรายปี (ไฟล์ funds.json, year = 0) สะสมข้ามปี · base = เป้าหมาย · ownTypeId = ประเภทถวายที่สร้างให้ชื่อเดียวกับกองทุน */
  kind?: 'budget' | 'fund'; ownTypeId?: string }
/** บันทึกตรงในงบ: in = เงินเข้างบ (แท่งเขียว) · out = ใช้จ่าย (แท่งแดง) โดยไม่ผ่านใบเบิก */
export interface BudgetEntry extends SharedItem { year: number; lineId: string; kind: 'in' | 'out'; amount: number; date: string; note: string }
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
export interface VoucherItem { desc: string; amount: number; lineId: string; method: PayMethod; ref?: string; /** รายการในหมวดรายจ่าย (ExpenseCat.id) */ catId?: string }
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

/** ไฟล์ใบบันทึกการถวายที่ถ่ายรูป/แนบมา (ให้ระบบอ่านภายหลัง) */
export interface SheetRowRead { label: string; typeId: string; envelopes?: number; amount: number }
export interface SheetFile extends SharedItem {
  date: string
  /** path ว่าง = โหมดทดลอง (ยังไม่เชื่อมออนไลน์ ไม่ได้เก็บรูป) */
  file: { path: string; name: string }
  note?: string
  /** ค่าที่ระบบอ่านจากใบ (ผู้ใช้ตรวจ/แก้แล้ว) — เงินสดเท่านั้น (สตางค์) */
  read?: { rows: SheetRowRead[]; writtenCash?: number }
}

/** หมวดรายจ่าย: kind group = หมวดหลัก (เช่น 3. ค่าสาธารณูปโภค) · item = รายการในหมวด (เช่น 3.1 ค่าไฟฟ้า) */
export interface ExpenseCat extends SharedItem {
  kind: 'group' | 'item'
  /** id ของหมวดหลัก (ของ group คือตัวเอง) */
  group: string
  code: string
  name: string
  order: number
  active: boolean
}

/** รายจ่ายนอกใบเบิก 3 ช่องทาง: manual = บันทึกด้วยมือ (จ่ายแล้ว) · bill = วางบิล (ค้างจ่ายจนกว่าจะจ่าย) · advance = สำรองจ่าย (ผู้สำรองจ่ายรอรับเงินคืน) */
/** รายชื่อผู้วางบิล/ผู้สำรองจ่าย ที่เรียกใช้ซ้ำได้ (เพิ่ม/แก้/ลบได้) */
export interface Person extends SharedItem { name: string }

export interface ExpenseEntry extends SharedItem {
  /** หมวดย่อยของกองทุน (เฉพาะรายจ่ายที่จ่ายจากกองทุน) */
  subId?: string
  /** ผู้วางบิล / ผู้สำรองจ่าย (ชื่อจากรายชื่อที่ตั้งไว้) — แสดงเป็นคอลัมน์หลังหมายเหตุในใบเบิก-จ่าย */
  biller?: string
  channel: 'manual' | 'bill' | 'advance'
  /** manual: วันที่จ่าย · bill: วันที่ในบิล · advance: วันที่สำรองจ่าย */
  date: string
  amount: number
  desc: string
  catId?: string
  /** จ่ายจากกองทุน (id ประเภทถวายที่เป็นกองทุน) — ไม่ใส่ = จ่ายจากเงินหมุนเวียนตามปกติ */
  fundId?: string
  /** bill: ผู้ออกบิล/ร้าน · advance: ผู้สำรองจ่าย · manual: ผู้รับเงิน */
  who?: string
  /** bill: วันครบกำหนด */
  due?: string
  /** จ่ายแล้ว (manual = จ่ายแล้วเสมอ) · bill/advance: open = ค้างจ่าย/รอคืนเงิน */
  status: 'open' | 'paid'
  paidDate?: string
  method?: 'cash' | 'transfer'
  ref?: string
  note?: string
  /** รูปบิล/ใบเสร็จ (path ว่าง = โหมดทดลอง ไม่ได้เก็บรูป) */
  file?: { path: string; name: string }
  /** หมายเหตุที่พิมพ์ในแถวใบเบิก-จ่ายเงินสด (พิมพ์อะไรก็ได้ เช่น ชื่อผู้สำรองจ่าย) — เดิมคือ "ผู้เบิกเงิน" */
  requester?: string
}

// ---------- สมุดบัญชี (ขั้น "ปรับ") ----------
export type PbKind = 'deposit' | 'withdraw' | 'in' | 'out' | 'other'
/** 1 บรรทัดในสมุดบัญชีที่อ่านจากรูป (จำนวนเงินเป็นสตางค์ บวกเสมอ — ฝาก/ถอนดูที่ kind) */
export interface PassbookLine extends SharedItem {
  date: string
  kind: PbKind
  amount: number
  /** ยอดคงเหลือหลังรายการนี้ ตามที่พิมพ์ในสมุด */
  balance?: number
  desc?: string
  /** ย้ายไปนับในสัปดาห์ (วันอาทิตย์) อื่น เช่น ธนาคารลงวันที่ฝากเป็นวันจันทร์ */
  week?: string
  /** ทิศทางเงิน (เข้า/ออก) — ใช้กับ kind 'other' เช่น ดอกเบี้ย (เข้า) ค่าธรรมเนียม/ภาษี (ออก) */
  dir?: 'in' | 'out'
  /** ผูกกับรายการในแอปแล้ว (income = ลงเป็นรายรับจากสมุด) หรือพักไว้ */
  link?: { kind: 'income' | 'park' | 'move' | 'loan'; id?: string }
  /** บรรทัดนี้อยู่ในสมุดบัญชีเล่มไหน */
  accountId?: string
}
/** รูปหน้าสมุดบัญชีที่สแกนในหน้า ปรับ (เก็บใน attachments/passbook/) */
export interface PassbookScan extends SharedItem {
  /** วันอาทิตย์ของสัปดาห์ที่สแกน */
  week: string
  path: string
  name: string
  by?: string
}
/** เงินกองทุนของสัปดาห์หนึ่งที่นำฝากเข้าบัญชีกองทุนแล้ว (id = `สัปดาห์:กองทุน`) · amount = ยอดที่ฝาก ณ ตอนกดยืนยัน */
export interface FundDeposit extends SharedItem {
  /** วันอาทิตย์ของสัปดาห์ */
  week: string
  fundId: string
  amount: number
  /** วันที่นำฝากจริง */
  on: string
}
/** ปิดยอดสัปดาห์ (id = วันอาทิตย์ของสัปดาห์) หลังตรวจกับสมุดบัญชีแล้ว */
export interface WeekClose extends SharedItem {
  sunday: string
  bankBalance?: number
  note?: string
}

/** ย้ายเงินเข้ากองทุนวัตถุประสงค์ (เช่น ถอนเงินสดจากบัญชีหมุนเวียนแล้วฝากเข้าบัญชีวัตถุประสงค์) — ไม่ใช่รายรับ/รายจ่าย */
export interface FundMove extends SharedItem {
  date: string
  amount: number
  /** แบ่งเข้ากองทุนละเท่าไร (id ประเภทถวาย → สตางค์) */
  alloc: Record<string, number>
  fromLineId?: string
  toLineId?: string
  note?: string
}
/** ยอดยกมา ณ วันตัดยอด (id = 'opening') */
export interface Opening extends SharedItem {
  date: string
  /** ยอดเงินในแต่ละบัญชีธนาคาร (id บัญชี → สตางค์) */
  accounts: Record<string, number>
  cash: number
  /** เงินวัตถุประสงค์ที่ยังอยู่ในบัญชีหมุนเวียน ณ ตั้งต้น (id ประเภทถวาย → สตางค์) */
  unmoved: Record<string, number>
  /** ยอดตั้งต้นของแต่ละกองทุน (id ประเภทถวายที่เป็นกองทุน → สตางค์) */
  funds?: Record<string, number>
  /** เงินของคริสตจักรที่ไม่เกี่ยวกับกองทุน (สตางค์) */
  own?: number
}

/** เงินยืม (หนี้): ยืมจากบุคคลภายนอก หรือยืมระหว่างกองทุน — ไม่ใช่รายรับ และการคืนไม่ใช่รายจ่าย */
export interface LoanRepayment { id: string; date: string; amount: number; note?: string }
export interface Loan extends SharedItem {
  /** ผู้ให้ยืม: own = เงินหมุนเวียนของคริสตจักร · person = บุคคลภายนอก (ใส่ชื่อ) · fund = กองทุนในคริสตจักร (id ประเภทถวายที่เป็นกองทุน) */
  lender: { kind: 'person' | 'fund' | 'own'; name?: string; fundId?: string }
  /** ใช้ทำอะไร เช่น ทำสุสาน สร้างห้องพัก */
  purpose: string
  /** ผู้ยืม = เงินนี้ไปอยู่ที่ไหน: 'own' = เงินหมุนเวียนของคริสตจักร · id ประเภทถวาย (เช่น กองทุนสุสาน) · ไม่ใส่ = ไม่ระบุ */
  borrower?: string
  /** รหัสชุดรายการที่สร้างพร้อมกัน (จ่ายสวัสดิการผ่านเงินยืม: เงินยืม + การคืน + รายจ่าย) — ไว้ยกเลิกทั้งชุด */
  group?: string
  date: string
  /** เงินต้น (สตางค์) */
  principal: number
  repayments: LoanRepayment[]
  note?: string
}

/** ทะเบียนสมาชิกคริสตจักร (ไม่ใช่ผู้ใช้แอป) · ไฟล์เดียว ข้ามปี */
export type Gender = 'ชาย' | 'หญิง'
export type MemberOverride = 'incomplete' | 'resigned' | 'deceased' | 'removed'
export interface ChurchMember extends SharedItem {
  name: string
  nick?: string
  code?: string
  tel?: string
  group?: string
  note?: string
  /** ชื่อเดิมก่อนแอปจัดวงเล็บออกจากชื่อ (ไว้กู้คืน) */
  nameOrig?: string
  /** สถานะตามทะเบียน เช่น สมาชิกสมบูรณ์ · เสียชีวิต · สิ้นสภาพ */
  status?: string
  /** วันที่เข้าเป็นสมาชิก YYYY-MM-DD */
  since?: string
  /** วันเกิด YYYY-MM-DD (ค.ศ.) */
  birth?: string
  /** เพศ: ชาย / หญิง (ว่าง = ไม่ระบุ) */
  gender?: Gender
  /** เพศนี้มาจากการเดาของแอป (ยังไม่มีใครยืนยัน) · ค่า = ความมั่นใจ · ลบออกเมื่อผู้ใช้ยืนยัน/แก้เอง */
  genderGuess?: 'high' | 'mid' | 'low'
  /** สมัครสมาชิกแล้ว (คอลัมน์ “สมัคร” ในทะเบียนเดิม) */
  applied?: boolean
  /** ชื่อไฟล์รูปในทะเบียนเดิม (ยังไม่ได้อัปโหลดรูปเข้าแอป) */
  photo?: string
  /** ที่อยู่รูปที่อัปโหลดแล้ว (ใน repo ข้อมูล) */
  photoPath?: string
  /** พิกัดบ้าน (ละติจูด/ลองจิจูด · องศาทศนิยม) — แอดมิน/ผู้บันทึกทะเบียนเป็นคนบันทึก แสดงบนแผนที่ของงานอภิบาล */
  lat?: number
  lng?: number
  /** ผู้ดูแลกำหนดผลตรวจเอง (ว่าง = ตามการคำนวณ) */
  override?: MemberOverride
}
/** บันทึกลงชื่อนมัสการ 1 วัน (id = วันที่) · ไฟล์รายปี */
export interface Attendance extends SharedItem { date: string; ids: string[] }

/** ลงชื่อนมัสการ 1 คน × 1 วัน (id = วัน_รหัสสมาชิก → คนเดียวกันวันเดียวกันซ้ำไม่ได้ และหลายเครื่องไม่ทับกัน) · ไฟล์รายปี */
export interface CheckIn extends SharedItem {
  date: string
  /** รหัสภายในของสมาชิก */
  mid: string
  /** เวลาที่ลงชื่อ HH:MM */
  tm?: string
  /** ชื่อผู้บันทึก (จากรายชื่อผู้บันทึกที่แอดมินตั้งไว้) */
  rec?: string
  /** ชื่อผู้ที่ยกเลิกรายการนี้ (ใช้ตอน deleted) */
  delBy?: string
}
/** ผู้บันทึกลงชื่อ (ผู้ช่วยงาน) — แอดมินเพิ่ม/แก้/ลบได้ ไม่ต้องมีบัญชีในแอป */
export interface Recorder extends SharedItem { name: string }

// ---------- ปฏิทินงาน (ห้องทำงาน) ----------
/** กิจกรรมในปฏิทินงาน · tab = เลขแท็บของห้องทำงาน (1–12) ที่เป็นเจ้าของ · 0 = ทั่วไป */
export interface CalEvent extends SharedItem { date: string; title: string; tab: number; time?: string; note?: string; /** ผู้บันทึก (id/ชื่อ) — แก้ไข/ลบได้เฉพาะผู้บันทึกและแอดมิน */ recId?: string; rec?: string
  /** เวลาสิ้นสุด (HH:MM) — time คือเวลาเริ่ม · ไม่มี time = ตลอดวัน */
  end?: string
  /** ทำซ้ำ (เริ่มนับจาก date) */
  repeat?: Repeat
  /** วันที่อื่นที่เกิดกิจกรรมเดียวกัน (เลือกเองหลายวัน เช่น 23, 24, 25, 26) นอกจาก date */
  extra?: string[]
  /** วันที่ที่ยกเว้นออกจากชุดที่ทำซ้ำ (ลบเฉพาะวันนั้น) */
  exdates?: string[]
  /** แผนงานประจำปี: แสดงในใบแผนงาน · ผู้รับผิดชอบ (ข้อความ) · งบประมาณต่อครั้ง (สตางค์) · ทำเสร็จแล้ว (ขีดฆ่าวันที่) */
  plan?: boolean; lead?: string; budget?: number; done?: boolean }

/** คลังเอกสารงานเลขา: เก็บไฟล์สำเร็จรูป (PDF/รูป/เอกสาร) ที่เลขาทำมาแล้ว แยกตามหมวด · เปิดดู ดาวน์โหลด แชร์ได้ — ไม่ร่างเอกสารในแอป */
export type DocAccess = 'ทั่วไป' | 'ภายใน' | 'ลับ'
export interface DocFinal { v: number; at: number; by: string; no: string; date: string; title: string; body: string }
export interface DocFile { path: string; name: string; type: string; size: number }
export interface DocItem extends SharedItem {
  title: string; category: string; no: string; date: string; access: DocAccess
  /** ไฟล์สำเร็จรูป */ file?: DocFile
  /** หมายเหตุ/คำค้น (ไม่บังคับ) */ note?: string
  /** (เวอร์ชันเก่า) ประเภท · ร่าง · เอกสารที่ออกในแอป — คงไว้ให้ค้นหาได้ ไม่แสดงให้แก้แล้ว */ kind?: string; draft?: string; finals?: DocFinal[]
}
/** แชทห้องงาน ↔ แอดมิน: n = เลขห้องงาน · fromAdmin = แอดมินเป็นผู้เขียน (ไม่ใช่คนในห้อง) · byId/by = ผู้เขียน */
export interface ChatMsg extends SharedItem { n: number; text: string; at: number; fromAdmin: boolean; byId: string; by: string }
/** หมวดเอกสาร (รายชื่อที่แก้ไข/ลบได้) */
/** prefix = ตัวย่อเลขที่ของหมวด เช่น ปศอ → เลขที่ ปศอ.001, ปศอ.002 … (นับต่อเรื่อย ๆ ตามตัวย่อ) */
export interface DocCategory extends SharedItem { name: string; prefix?: string }

/** ตั้งค่าใบแผนงานประจำปี (รายการเดียว id = plan-settings): คำขวัญประจำปี */
export interface PlanSettings extends SharedItem { motto: string }
/** ทำซ้ำแบบ Google: ทุก every วัน/สัปดาห์/เดือน/ปี · สัปดาห์เลือกวันได้หลายวัน (0=อาทิตย์) · เดือนเลือก วันที่เดิม / วันที่ n ของเดือน (เช่น พฤหัสที่ 3) / วันสุดท้าย · สิ้นสุดด้วยวันที่หรือจำนวนครั้ง */
export interface Repeat { freq: 'day' | 'week' | 'month' | 'year'; every: number; days?: number[]; by?: 'date' | 'nth' | 'last'; until?: string; count?: number }

// ---------- บันทึกโน้ต (ห้องทำงาน) ----------
/** เสียงที่อัดไว้ในโน้ต (ไฟล์อยู่ใน repo ข้อมูลที่ path นี้) */
export interface NoteClip { path: string; type: string; secs: number }
export interface Note extends SharedItem { title: string; body: string; clips?: NoteClip[]; date: string; recId?: string; rec?: string }

// ---------- ผู้รับผิดชอบแต่ละงาน (ห้องทำงาน) ----------
/** รายชื่อผู้รับผิดชอบของงานหนึ่ง เรียงตามลำดับที่แอดมินจัด (เช่น เลขา · รองเลขา · ครูศาสนกิจ) */
export interface TeamMember { role: string; name: string }
export interface WorkTeam extends SharedItem { n: number; people: TeamMember[] }

// ---------- ตารางเยี่ยม (งานอภิบาล) ----------
/** บันทึกการเยี่ยม 1 ครั้ง: วันที่ · สมาชิกที่เยี่ยม · เหตุผล/หมายเหตุ · ผู้เยี่ยม (ลงชื่อ) */
export interface Visit extends SharedItem { date: string; memberId: string; memberName: string; reason: string; detail?: string; visitor: string; /** รูปการเยี่ยม 1–2 รูป (ที่อยู่ในที่เก็บข้อมูล) */ photos?: string[] }

// ---------- งานโรงครัว › ตารางถวายอาหาร ----------
/** ผู้ถวายอาหารของวันอาทิตย์หนึ่ง: date = วันอาทิตย์ (ISO) · id = food-{date} (วันละหนึ่งรายการ) */
export interface FoodSlot extends SharedItem { date: string; donor: string; occasion: string }

/** บัญชีธนาคารรับถวายอาหาร (แสดงท้ายตารางถวายอาหาร) — รายการเดียว id = food-pay */
export interface FoodPay extends SharedItem { bank: string; accName: string; accNo: string; note: string }

// ---------- ข่าวจากแอดมินถึงแต่ละงาน (กระดิ่ง) ----------
/** ข่าวที่แอดมินส่งถึงงาน: works = เลขงานที่รับ (0 = ทุกงาน) · at = เวลาที่ส่ง */
export interface Announcement extends SharedItem { text: string; works: number[]; at: number }

// ---------- ศูนย์จัดการประชุม (งานเลขา) ----------
export type MtKind = 'กรรมการ' | 'ผู้มีสิทธิ์ลงคะแนน' | 'ผู้เข้าร่วมอื่น'
export type MtRsvp = 'ตอบรับ' | 'ลา' | 'ยังไม่ตอบ'
export type MtAttend = 'มา' | 'ลา' | 'ไม่มา'
export interface MtPerson { id: string; name: string; kind: MtKind; /** ตอบรับ/ลา หลังแจ้งประชุม */ rsvp?: MtRsvp; /** มาจริงในวันประชุม */ att?: MtAttend }
export type MtResult = 'เห็นชอบ' | 'ไม่เห็นชอบ' | 'เลื่อนพิจารณา' | 'มีเงื่อนไข'
export interface MtMinute { summary?: string; proposal?: string; result?: MtResult; condition?: string; yes?: number; no?: number; abstain?: number; assignee?: string; due?: string; /** ผู้รับผิดชอบทำเสร็จแล้ว */ done?: boolean }
export type MtGroup = 'แจ้งเพื่อทราบ' | 'รับรองรายงาน' | 'ติดตามงาน' | 'เรื่องเสนอพิจารณา'
export type MtPurpose = 'ทราบ' | 'หารือ' | 'ขอมติ'
export interface MtAgenda { id: string; title: string; group: MtGroup; purpose: MtPurpose; docs?: string; /** ยกมาจากการประชุมครั้งก่อน */ carried?: boolean; minute?: MtMinute }
export interface MtDraft { at: number; by: string; note: string; /** สำเนารายงาน ณ ตอนบันทึกฉบับ */ text: string }
export type MtApproval = 'รับรองโดยไม่แก้ไข' | 'รับรองโดยมีการแก้ไข' | 'ยังไม่รับรอง'
/** ข้อมูลการประชุม 1 ครั้ง — ใช้ร่วมทุกขั้นตั้งแต่สร้างจนเก็บเอกสาร */
export interface Meeting extends SharedItem {
  name: string; no: number; year: number; type: 'ปกติ' | 'พิเศษ'
  date: string; time: string; place: string; chair: string; secretary: string
  /** วันปิดรับเรื่องเสนอ */ deadline?: string
  people: MtPerson[]; agenda: MtAgenda[]
  agendaOk?: { by: string; at: number }
  notice?: { channels: string[]; body?: string; sentAt?: number; ref?: string }
  prep?: Record<string, boolean>
  /** จำนวนผู้มีสิทธิ์ขั้นต่ำเพื่อครบองค์ประชุม (ไม่ระบุ = มากกว่าครึ่งหนึ่งของกรรมการ+ผู้มีสิทธิ์ลงคะแนน) */
  quorumMin?: number
  opened?: { chair: string; time: string; agendaConfirmed: boolean; at: number }
  closed?: { time: string; next?: string }
  drafts?: MtDraft[]
  toChair?: { at: number }
  chairOk?: { by: string; at: number; /** ฉบับร่างที่ประธานตรวจ (เวลาบันทึก) — มีฉบับใหม่กว่าต้องตรวจใหม่ */ draftAt?: number }
  distributed?: { at: number; channel: string }
  objections?: string[]
  queuedNext?: boolean
  approval?: { result: MtApproval; date: string; atNo: string; edits?: string }
  signs?: { role: string; name: string; img?: string }[]
  /** ลงนามบนกระดาษแล้ว (ไม่ใช้ลายเซ็นในระบบ) */ paperSigned?: boolean
  /** ระดับเอกสาร: ทั่วไป · ภายใน (กรรมการ) · ลับ (แอดมินเท่านั้น) */ access?: 'ทั่วไป' | 'ภายใน' | 'ลับ'
  archived?: { at: number }
  /** เช็คลิสต์ลำดับงานบนหน้าศูนย์ (ติ๊กเอง บอกว่าทำถึงขั้นไหน · ไม่ใช่ข้อมูลของขั้น) */
  flow?: number[]
}
/** หัวจดหมาย/ท้ายจดหมายของคริสตจักร (รูปที่ผู้ดูแลอัปโหลด เก็บใน repo ข้อมูลส่วนตัว) */
export interface Letterhead extends SharedItem { header?: { path: string }; footer?: { path: string } }

/** ขั้นหนึ่งของลำดับงาน · id คงที่เพื่อให้ติ๊กไม่หายเมื่อแก้ชื่อ · to = ลิงก์ไปทำต่อในแอป */
export interface FlowStep { id: string; t: string; hint?: string; to?: string; toLabel?: string; /** ช่วยพิเศษในหน้าเช็คลิสต์: number = ดึงเลขที่ถัดไปจากคลังเอกสาร · date = ตั้งวันที่เบื้องต้น */ kind?: 'number' | 'date' }
/** ลำดับงาน (การ์ดในงานเลขา › ลำดับงาน): ชื่อ ขั้นตอน และขั้นที่ติ๊กแล้ว · แอดมิน/ผู้มีสิทธิ์เพิ่ม แก้ ลบได้ */
export interface FlowTicks extends SharedItem { ticks: string[]; title?: string; icon?: string; steps?: FlowStep[]; /** ติ๊กขั้นสุดท้ายแล้วส่งต่อไปคลังเอกสาร */ toLibrary?: boolean; created?: number; /** วันที่เบื้องต้นของหนังสือ (ขั้นที่ kind = date) */ date?: string }

/** หนังสือเชิญร่วมงาน (ฉบับที่กำลังทำ): ข้อมูลทุกช่องของหน้าเดียว · id = draft */
export interface InviteLetter extends SharedItem { no: string; date: string; subject: string; to: string; /** สิ่งที่ส่งมาด้วย · แสดงบนหนังสือเมื่อ showAttach = true (ต้องพิมพ์ข้อความเอง) */ attach?: string; showAttach?: boolean; body: string; /** เลขเอกสารในคลังที่ส่งไปแล้ว (ส่งซ้ำ = ทับฉบับเดิม) */ docId?: string }
/** ค่าตั้งต้นของคริสตจักรสำหรับหนังสือเชิญ: หัวจดหมาย · ข้อความปิดท้าย/ลงนาม · ข้อมูลติดต่อท้ายกระดาษ (แก้ได้ ใช้กับทุกฉบับทันที) · id = settings */
export interface InviteSettings extends SharedItem { /** ตัวย่อเลขที่หนังสือ (เช่น ศอช → ศอช.001) */ numPrefix?: string; thName: string; enName: string; addr: string; proceed: string; bless: string; signName: string; signRole: string; contact: string }

/** สมุดส่วนตัวของแอดมินต่อหนึ่งงาน: gain = สิ่งที่แบ่งเบาได้/ประโยชน์ที่ได้ (มีน้ำหนักและสถานะ) · note = บันทึกอิสระรายวัน */
export type GainStatus = 'todo' | 'part' | 'done'
export interface AdminNote extends SharedItem { work: number; kind: 'gain' | 'note'; title: string; detail?: string; weight?: number; status?: GainStatus; hours?: number; date?: string }
