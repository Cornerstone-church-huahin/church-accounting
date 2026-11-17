export interface PersonRow<T> { item: T; /** ลำดับกลุ่มคน (ไม่มีชื่อ = -1) */ g: number; /** จำนวนแถวของกลุ่ม ถ้าเป็นแถวแรกของกลุ่ม · แถวอื่น = 0 (ใช้ rowSpan) */ span: number; /** ยอดรวมของคนนั้น (ทุกรายการ) */ total: number; /** กลุ่มที่มีมากกว่า 1 รายการ = ใส่สีให้เห็นเป็นชุดเดียวกัน */ multi: boolean }

/** เรียงรายการให้คนเดียวกันอยู่ติดกัน (ตามลำดับที่ชื่อปรากฏครั้งแรก) พร้อมยอดรวมต่อคน — รายการไม่มีชื่ออยู่ที่เดิม */
export function groupByPerson<T extends { person?: string; amount: number }>(items: T[]): PersonRow<T>[] {
  const key = (x: T) => (x.person ?? '').trim()
  const seen = new Set<string>()
  const out: PersonRow<T>[] = []
  let g = 0
  for (const it of items) {
    const k = key(it)
    if (!k) { out.push({ item: it, g: -1, span: 1, total: it.amount, multi: false }); continue }
    if (seen.has(k)) continue
    seen.add(k)
    const mine = items.filter((x) => key(x) === k)
    const total = mine.reduce((s, x) => s + x.amount, 0)
    mine.forEach((x, i) => out.push({ item: x, g, span: i === 0 ? mine.length : 0, total, multi: mine.length > 1 }))
    g++
  }
  return out
}
