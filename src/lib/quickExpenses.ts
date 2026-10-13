import type { QuickExpense } from './types'

/** รายการจ่ายประจำตามใบเบิก-จ่ายเงินสดฉบับล่าสุด พร้อมหมวดรายจ่ายที่ใกล้ที่สุด (แก้ได้ที่ ตั้งค่า › รายการจ่ายประจำ) */
export const DEFAULT_QUICK_EXPENSES: QuickExpense[] = [
  { id: 'q1', name: 'ค่าน้ำมันออกเยี่ยม อ.กฤต', catId: 'ei-5-2' },
  { id: 'q2', name: 'ค่าน้ำมันออกเยี่ยม อ.พิชิต', catId: 'ei-5-2' },
  { id: 'q3', name: 'เงินเดือน อ.กฤต', catId: 'ei-1-1' },
  { id: 'q4', name: 'เงินเดือน อ.พิชิต', catId: 'ei-1-2' },
  { id: 'q5', name: 'เงินเดือน อ.สายฝน', catId: 'ei-1-2' },
  { id: 'q6', name: 'ค่าอาหารวันอาทิตย์', catId: 'ei-4-1' },
  { id: 'q7', name: 'ค่าอาหารคนงาน', catId: 'ei-4-2' },
  { id: 'q8', name: 'อุปกรณ์สำนักงาน', catId: 'eg-6' },
  { id: 'q9', name: 'ค่าอินเตอร์เน็ต', catId: 'ei-3-5' },
  { id: 'q10', name: 'ค่าไฟ', catId: 'ei-3-1' },
  { id: 'q11', name: 'ค่าน้ำ', catId: 'ei-3-3' },
]
export const quickExpenseList = (s: { quickExpenses?: QuickExpense[] }) => s.quickExpenses ?? DEFAULT_QUICK_EXPENSES
