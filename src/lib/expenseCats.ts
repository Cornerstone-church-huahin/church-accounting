import type { ExpenseCat } from './types'

/** รายการจ่ายตั้งต้น = ตามใบเบิก-จ่ายเงินสดฉบับล่าสุด (แต่ละรายการเป็น 1 แถวในตารางรายจ่ายของใบสรุป) เพิ่ม/ลบ/ซ่อนได้ที่ ตั้งค่า */
export const DEFAULT_EXPENSE_NAMES = [
  'ค่าน้ำมันออกเยี่ยมสมาชิก อ.กฤต', 'ค่าน้ำมันออกเยี่ยมสมาชิก อ.พิชิต', 'เงินเดือน อ.กฤต', 'เงินเดือน อ.พิชิต', 'เงินเดือน อ.สายฝน',
  'ค่าอาหารวันอาทิตย์', 'ค่าอาหารคนงาน', 'อุปกรณ์สำนักงาน', 'ค่าอินเตอร์เน็ต', 'ค่าไฟ', 'ค่าน้ำ',
]
export const DEFAULT_EXPENSE_CATS: ExpenseCat[] = DEFAULT_EXPENSE_NAMES.map((name, i) => ({ id: `xq-${i + 1}`, kind: 'group', group: `xq-${i + 1}`, code: String(i + 1), name, order: i, active: true, updated: 0 }))

/** รหัสของแคตตาล็อก 15 หมวด/150 รายการรุ่นเก่า — เลิกใช้แล้ว ตัดออกจากรายการเสมอ */
export const isLegacyCatId = (id: string) => /^(eg|ei)-\d+(-\d+)?$/.test(id)
