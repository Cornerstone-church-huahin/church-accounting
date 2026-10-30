import { blocked, can, calendarWritable, canWork, myRole, myWorkLevel, type Perm } from './access'
import { useSharedStore } from './sharedStore'

/**
 * สิทธิ์เขียนของข้อมูลที่เป็นของ “ห้องงาน” n: ผู้ดูแลหลักของห้องนั้น (ตั้งโดยแอดมิน) เพิ่ม/แก้/ลบได้เสมอ แม้บทบาทบัญชีเป็นผู้ดูอย่างเดียว
 * · คนอื่นเป็นไปตามบทบาทบัญชีเดิม (perm) · ต้องเป็นฟังก์ชันคงที่ (ไม่สร้างใหม่ทุกครั้งที่เรนเดอร์)
 */
const workWriter = (n: number, perm: Perm) => () => canWork(n, 'edit') || !blocked(perm)
const writeWork1 = workWriter(1, 'detail')   // งานเลขา: หนังสือเชิญ ลำดับงาน การประชุม โน้ต
const writeWork4 = workWriter(4, 'detail')   // งานอภิบาล: ตารางเยี่ยม / บันทึกการเยี่ยม / รายชื่อผู้ออกเยี่ยม
// แผนเยี่ยมรายวัน: แอดมิน + ผู้ดูแลหลัก + ผู้ช่วยของงานอภิบาล แก้ร่วมกันได้ (ที่ปรึกษาดูอย่างเดียว)
const canPlan4 = () => { const l = myWorkLevel(4); return l === 'admin' || l === 'lead' || l === 'helper' || can(myRole(), 'detail') } // ไม่แจ้งเตือน (ใช้ตอนเรนเดอร์)
const writePlan4 = () => canPlan4() || !blocked('detail')
const writeWork4Reg = workWriter(4, 'worship') // งานอภิบาล: ทะเบียนสมาชิก (พิกัดบ้านจากการเช็คอินเยี่ยม)
import { mergeItems } from './sync'
import { planDoc, type PlanDoc } from './visitPlan'
import { DEFAULT_EXPENSE_CATS, isLegacyCatId } from './expenseCats'
import type { AdminNote, VisitorName, VisitPlan, InviteSettings, InviteLetter, FlowTicks, ChatMsg, DocCategory, DocItem, PlanSettings, FoodPay, FoodSlot, Visit, Announcement, BankAccount, ExpenseCat, ExpenseEntry, BudgetAdj, BudgetEntry, BudgetLine, IncomeEntry, IncomeType, Round, Settings, SheetFile, StatementBatch, StatementLine, Voucher, PassbookLine, PassbookScan, CalEvent, Note, WorkTeam, Meeting, Letterhead, FundDeposit, WeekClose, FundMove, Opening, Loan, Person, ChurchMember, Attendance, CheckIn, Recorder } from './types'

const k = (n: string) => `acct.${n}.v1`

/** ประเภทตามใบบันทึกการถวายของคริสตจักร */
/** รายการประเภทถวายตามใบบันทึกการถวายฉบับล่าสุด (id เดิม tt1–tt6 คงไว้เพื่อข้อมูลเก่า) */
export const DEFAULT_INCOME_TYPES: IncomeType[] = [
  { id: 'tt1', name: 'สิบลด' }, { id: 'tt2', name: 'ประจำสัปดาห์' }, { id: 'tt3', name: 'ขอบพระคุณ' }, { id: 'tt5', name: 'อาหารวันอาทิตย์' },
  { id: 'tt4', name: 'กองทุนเพื่อที่ดินคริสตจักร', fund: true }, { id: 'tt7', name: 'กองทุนสร้างอาคารพันธกิจ', fund: true }, { id: 'tt8', name: 'กองทุนสุสาน', fund: true }, { id: 'tt9', name: 'กองทุนศึกษา', fund: true },
  { id: 'tt6', name: 'รายได้อื่น (เช่น ค่าสถานที่สอน)' },
].map((t, i) => ({ ...t, order: i, active: true, updated: 0 }) as IncomeType)
/** ค่าตั้งต้นรุ่นแรกที่ยังไม่มีใครแก้ (updated = 0) ซ่อนไว้ เพื่อไม่ให้ปนกับประเภทจริง */
const LEGACY_SEED_IDS = new Set(['t1', 't2', 't3', 't4', 't5', 't6'])
const isLegacySeed = (t: IncomeType) => LEGACY_SEED_IDS.has(t.id) && t.updated === 0
export const DEFAULT_SETTINGS: Settings = { id: 'settings', churchName: 'คริสตจักรศิลาเอก หัวหิน', twoStepOver: 200000, matchDays: 7, csvMaps: {}, updated: 0 }

/** ค่าตั้งต้นและตัวเลือกที่แอดมินแก้ได้ (ไม่แบ่งปี) */
export function useIncomeTypes() {
  const s = useSharedStore<IncomeType>({ localKey: k('types'), file: 'income-types.json', label: 'ประเภทถวาย', write: 'settings' })
  // ค่าตั้งต้นรวมกับที่แอดมินแก้เองเสมอ (รายการที่แก้/ปิด/ลบแล้วมี updated ใหม่กว่าจึงชนะ)
  const merged = mergeItems(DEFAULT_INCOME_TYPES, s.all).filter((t) => !isLegacySeed(t))
  const byId = (id: string) => merged.find((t) => t.id === id)
  // ค่าตั้งต้นที่ยังไม่เคยถูกแก้ไม่อยู่ในไฟล์ที่เก็บ — ลบต้องเริ่มจากรายการที่รวมแล้ว ไม่เช่นนั้นลบไม่ติด
  const remove = (id: string) => { const x = byId(id); return x ? s.put([{ ...x, deleted: true }]) : false }
  return { ...s, remove, list: merged.filter((t) => !t.deleted).sort((a, b) => a.order - b.order), byId }
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
export const useSheetFiles = (year: number) => useSharedStore<SheetFile>({ localKey: k(`sheetfiles.${year}`), file: `sheet-files-${year}.json`, label: `ไฟล์ใบบันทึกการถวาย ${year}`, write: 'income' })

/** รายการจ่าย: ค่าตั้งต้นตามใบเบิก-จ่ายเงินสด รวมกับที่แอดมินแก้ (ที่แก้/ซ่อน/ลบมี updated ใหม่กว่าจึงชนะ) */
export function useExpenseCats() {
  const s = useSharedStore<ExpenseCat>({ localKey: k('expense-cats'), file: 'expense-cats.json', label: 'หมวดรายจ่าย', write: 'settings' })
  const merged = mergeItems(DEFAULT_EXPENSE_CATS, s.all).filter((c) => !c.deleted && !isLegacyCatId(c.id)).sort((a, b) => a.order - b.order)
  const remove = (id: string) => { const x = merged.find((c) => c.id === id); return x ? s.put([{ ...x, deleted: true }]) : false }
  return { ...s, remove, list: merged, groups: merged.filter((c) => c.kind === 'group'), itemsOf: (g: string) => merged.filter((c) => c.kind === 'item' && c.group === g), byId: (id: string) => merged.find((c) => c.id === id) }
}

/** รายจ่ายนอกใบเบิก (บันทึกด้วยมือ / วางบิล / สำรองจ่าย) รายปี */
export const useExpenses = (year: number) => useSharedStore<ExpenseEntry>({ localKey: k(`expenses.${year}`), file: `expenses-${year}.json`, label: `รายจ่าย ${year}`, write: 'voucherPay' })

export const usePassbook = (year: number) => useSharedStore<PassbookLine>({ localKey: k(`passbook.${year}`), file: `passbook-${year}.json`, label: `สมุดบัญชี ${year}`, write: 'statement' })
export const usePassbookScans = (year: number) => useSharedStore<PassbookScan>({ localKey: k(`passbookscans.${year}`), file: `passbook-scans-${year}.json`, label: `รูปสมุดบัญชี ${year}`, write: 'statement' })
export const useFundDeposits = () => useSharedStore<FundDeposit>({ localKey: k('funddeposits'), file: 'fund-deposits.json', label: 'เงินกองทุนที่นำฝากแล้ว', write: 'statement' })
export const useWeekCloses = (year: number) => useSharedStore<WeekClose>({ localKey: k(`weekcloses.${year}`), file: `week-closes-${year}.json`, label: `ปิดยอดสัปดาห์ ${year}`, write: 'statement' })

export const useFundMoves = (year: number) => useSharedStore<FundMove>({ localKey: k(`fundmoves.${year}`), file: `fund-moves-${year}.json`, label: `ย้ายเงินเข้ากองทุน ${year}`, write: 'statement' })
/** ยอดยกมา: ไฟล์เดียว ไม่แบ่งปี */
export function useOpening() {
  const s = useSharedStore<Opening>({ localKey: k('opening'), file: 'opening.json', label: 'ยอดยกมา', write: 'settings' })
  const opening = s.items.find((x) => x.id === 'opening')
  return { ...s, opening, save: (o: Omit<Opening, 'id' | 'updated'>) => s.put([{ ...o, id: 'opening', updated: 0 }]) }
}

/** เงินยืม: ไฟล์เดียว ข้ามปี */
export const useLoans = () => useSharedStore<Loan>({ localKey: k('loans'), file: 'loans.json', label: 'เงินยืม', write: 'statement' })

/** รายชื่อผู้วางบิล/ผู้สำรองจ่าย: ไฟล์เดียว ข้ามปี */
export const usePeople = () => useSharedStore<Person>({ localKey: k('people'), file: 'people.json', label: 'รายชื่อผู้วางบิล', write: 'voucherPay' })

/** ทะเบียนสมาชิกคริสตจักร: ไฟล์เดียว ข้ามปี (มีเบอร์โทร จึงให้เฉพาะผู้ที่เห็นรายการรายตัว) */
export const useChurchMembers = () => useSharedStore<ChurchMember>({ localKey: k('church-members'), file: 'church-members.json', label: 'ทะเบียนสมาชิก', writeCheck: writeWork4Reg })
/**
 * ลงชื่อนมัสการ: รายปี (1 คน × 1 วัน = 1 รายการ) · ปีเก่าไม่ซิงก์ทุกนาที (ซิงก์ตอนเปิด/กลับมาที่แอป) เพื่อไม่กินเน็ต
 * ไฟล์เก่าที่เคยเก็บเป็น "1 วัน = รายชื่อทั้งชุด" (Attendance) ยังอ่านได้ ผ่าน toAttendance()
 */
export const useAttendance = (year: number, poll = true) => useSharedStore<CheckIn | Attendance>({ localKey: k(`attendance.${year}`), file: `attendance-${year}.json`, label: `ลงชื่อนมัสการ ${year}`, write: 'worship', poll })
/** ผู้บันทึกลงชื่อ: ไฟล์เดียว (แอดมินจัดการ) */
export const useRecorders = () => useSharedStore<Recorder>({ localKey: k('recorders'), file: 'recorders.json', label: 'ผู้บันทึกลงชื่อ', write: 'settings' })

/** ปฏิทินงานของห้องทำงาน (ไม่แบ่งปี · ทุกแท็บบันทึกลงไฟล์เดียวกัน เพื่อให้เห็นความสัมพันธ์รวมกัน) */
export function useCalendar() {
  const s = useSharedStore<CalEvent>({ localKey: k('calendar'), file: 'calendar.json', label: 'ปฏิทินงาน', writeCheck: calendarWritable })
  return { ...s, list: s.items }
}

/** บันทึกโน้ตของห้องทำงาน (ไม่แบ่งปี) */
export function useNotes() {
  const s = useSharedStore<Note>({ localKey: k('notes'), file: 'notes.json', label: 'บันทึกโน้ต', writeCheck: writeWork1 })
  return { ...s, list: [...s.items].sort((a, b) => b.updated - a.updated) }
}

/** บันทึกการเยี่ยมของงานอภิบาล (ไฟล์เดียว ไม่แบ่งปี) */
/** แผนเยี่ยมรายวัน (วันละ 1 รายการ เรียงลำดับเส้นทาง) · ซิงก์ถี่ทุก 10 วินาทีเพื่อวางแผนร่วมกันแบบสด */
export function useVisitPlans() {
  const s = useSharedStore<VisitPlan>({ localKey: k('visit-plans'), file: 'visit-plans.json', label: 'แผนเยี่ยม', writeCheck: writePlan4, pollMs: 10_000 })
  return { ...s, of: (date: string) => planDoc(s.items.find((x) => x.id === `plan-${date}`)), save: (date: string, d: PlanDoc) => s.put([{ id: `plan-${date}`, date, items: d.items, groups: d.groups, names: d.names, v: 2, updated: 0 }]), canEdit: () => canPlan4() }
}
/** รายชื่อผู้ออกเยี่ยมที่เพิ่ม/ซ่อนเอง (เพิ่มครั้งเดียวแล้วเลือกได้ทุกครั้ง) */
export function useVisitorNames() {
  return useSharedStore<VisitorName>({ localKey: k('visit-names'), file: 'visit-names.json', label: 'รายชื่อผู้ออกเยี่ยม', writeCheck: writeWork4 })
}
/** log = ข้อมูลการเยี่ยมจริง (visit-log.json) ใช้ร่วมกันทั้งแท็บ “ตารางเยี่ยม” “บันทึกการเยี่ยม” และ “รายงานการเยี่ยม” · false = ไฟล์เดิม visits.json (เลิกใช้แล้ว) */
export function useVisits(log = false) {
  const s = useSharedStore<Visit>(log
    ? { localKey: k('visit-log'), file: 'visit-log.json', label: 'บันทึกการเยี่ยม', writeCheck: writeWork4 }
    : { localKey: k('visits'), file: 'visits.json', label: 'ตารางเยี่ยม', writeCheck: writeWork4 })
  return { ...s, list: [...s.items].filter((x) => !x.deleted).sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated) }
}

/** ตารางถวายอาหารของงานโรงครัว (ไฟล์เดียว ไม่แบ่งปี · วันอาทิตย์ละหนึ่งรายการ) */
export function useFoodSlots() {
  const s = useSharedStore<FoodSlot>({ localKey: k('foodslots'), file: 'food-slots.json', label: 'ตารางถวายอาหาร' })
  const byDate = new Map(s.items.filter((x) => !x.deleted).map((x) => [x.date, x]))
  return { ...s, byDate }
}

/** บัญชีธนาคารที่แสดงท้ายตารางถวายอาหาร (รายการเดียว) */
/** ค่าตั้งต้น (เมื่อยังไม่เคยบันทึกในหน้า): บัญชีรับถวายของคริสตจักร — แก้/เอาออกได้ในหน้า ตารางถวายอาหาร */
export const DEFAULT_FOOD_PAY: FoodPay = { id: 'food-pay', updated: 0, bank: 'กรุงเทพ', accName: 'คริสตจักรศิลาเอก', accNo: '7770359144', note: 'หลังจากโอนแล้ว “แจ้งการถวายทรัพย์”' }
export function useFoodPay() {
  const s = useSharedStore<FoodPay>({ localKey: k('foodpay'), file: 'food-pay.json', label: 'บัญชีรับถวายอาหาร' })
  const saved = s.items.find((x) => x.id === 'food-pay' && !x.deleted)
  const pay = saved ?? DEFAULT_FOOD_PAY
  return { ...s, pay, save: (p: Omit<FoodPay, 'id' | 'updated'>) => s.put([{ id: 'food-pay', updated: 0, ...p }]) }
}

/** คลังเอกสารงานเลขา (ไฟล์เดียว ไม่แบ่งปี) */
export function useDocLibrary() {
  const s = useSharedStore<DocItem>({ localKey: k('doclib'), file: 'doc-library.json', label: 'คลังเอกสาร' })
  return { ...s, list: s.items.filter((x) => !x.deleted) }
}

/** แชทห้องงาน ↔ แอดมิน (ไฟล์เดียว · ทุกห้อง) */
export function useRoomChat() {
  const s = useSharedStore<ChatMsg>({ localKey: k('roomchat'), file: 'room-chat.json', label: 'แชทห้องงาน' })
  return { ...s, list: s.items.filter((x) => !x.deleted) }
}

/** หมวดเอกสารของคลังเอกสาร */
export function useDocCategories() {
  const s = useSharedStore<DocCategory>({ localKey: k('doccats'), file: 'doc-categories.json', label: 'หมวดเอกสาร' })
  return { ...s, list: s.items.filter((x) => !x.deleted).sort((a, b) => a.name.localeCompare(b.name, 'th')) }
}

/** ตั้งค่าใบแผนงานประจำปี: คำขวัญ (รายการเดียว) */
export function usePlanSettings() {
  const s = useSharedStore<PlanSettings>({ localKey: k('plansettings'), file: 'plan-settings.json', label: 'ตั้งค่าแผนงานประจำปี' })
  const motto = s.items.find((x) => x.id === 'plan-settings' && !x.deleted)?.motto ?? ''
  return { ...s, motto, save: (m: string) => s.put([{ id: 'plan-settings', updated: 0, motto: m }]) }
}

/** ข่าวจากแอดมินถึงงานต่าง ๆ (กระดิ่ง): แอดมินเป็นคนส่ง ทุกงานอ่านได้ */
export function useAnnouncements() {
  const s = useSharedStore<Announcement>({ localKey: k('announcements'), file: 'announcements.json', label: 'ข่าวจากแอดมิน', write: 'settings' })
  return { ...s, list: [...s.items].filter((x) => !x.deleted).sort((a, b) => b.at - a.at) }
}

/** ผู้รับผิดชอบของแต่ละงานในห้องทำงาน: ไฟล์เดียว · แอดมินเป็นคนบันทึก ทุกคนเห็น */
export function useWorkTeams() {
  const s = useSharedStore<WorkTeam>({ localKey: k('work-teams'), file: 'work-teams.json', label: 'ผู้รับผิดชอบงาน', write: 'settings' })
  return { ...s, of: (n: number) => s.items.find((x) => x.n === n)?.people ?? [], save: (n: number, people: WorkTeam['people']) => s.put([{ id: `team-${n}`, n, people, updated: 0 }]) }
}

/** การประชุมของศูนย์จัดการประชุม (ไม่แบ่งปี · แต่ละครั้งเป็นรายการเดียวที่เก็บทุกขั้น) */
export function useMeetings() {
  const s = useSharedStore<Meeting>({ localKey: k('meetings'), file: 'meetings.json', label: 'การประชุม', writeCheck: writeWork1 })
  return { ...s, list: [...s.items].sort((a, b) => b.date.localeCompare(a.date) || b.updated - a.updated) }
}
/** หัวจดหมาย/ท้ายจดหมาย: รายการเดียว (id = letterhead) · แอดมินตั้งค่า */
export function useLetterhead() {
  const s = useSharedStore<Letterhead>({ localKey: k('letterhead'), file: 'letterhead.json', label: 'หัวจดหมาย', write: 'settings' })
  return { ...s, value: s.items.find((x) => x.id === 'letterhead'), save: (v: Pick<Letterhead, 'header' | 'footer'>) => s.put([{ id: 'letterhead', updated: 0, ...v }]) }
}

/** เช็คลิสต์ของลำดับงานที่ไม่ผูกกับการประชุม (หนังสือเชิญ ฯลฯ) · ทุกคนที่แก้ข้อมูลรายละเอียดได้ติ๊กได้ */
export function useFlowTicks() {
  return useSharedStore<FlowTicks>({ localKey: k('flowticks'), file: 'flow-ticks.json', label: 'ลำดับงาน', writeCheck: writeWork1 })
}

/** หนังสือเชิญร่วมงานฉบับที่กำลังทำ (รายการเดียว id = draft) */
export function useInviteLetter(live = false) {
  // live = หน้าที่กำลังเปิดแก้/ตรวจหนังสือ: ซิงก์ทุก 10 วินาที เพื่อเห็นสิ่งที่อีกคนพิมพ์เกือบสด
  return useSharedStore<InviteLetter>({ localKey: k('inviteletter'), file: 'invite-letter.json', label: 'หนังสือเชิญร่วมงาน', writeCheck: writeWork1, ...(live ? { pollMs: 10_000 } : {}) })
}
/** ค่าตั้งต้นหนังสือเชิญ (รายการเดียว id = settings) */
export function useInviteSettings() {
  return useSharedStore<InviteSettings>({ localKey: k('invitesettings'), file: 'invite-settings.json', label: 'ค่าตั้งต้นหนังสือเชิญ', writeCheck: writeWork1 })
}

/** สมุดส่วนตัวของแอดมิน (ซ่อนจากผู้ใช้อื่นในแอป · แอดมินเท่านั้นที่เขียนได้) */
export function useAdminNotes() {
  const s = useSharedStore<AdminNote>({ localKey: k('adminnotes'), file: 'admin-notes.json', label: 'สมุดส่วนตัวแอดมิน', write: 'settings' })
  return { ...s, list: s.items }
}
