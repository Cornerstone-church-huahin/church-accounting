import type { ExpenseCat } from '../lib/types'

/** ตัวเลือกรายการจ่ายใน <select>: รายการเดี่ยว = 1 ตัวเลือก · ถ้ามีรายการย่อยจะจัดเป็นกลุ่ม (ทั้งหมวด + รายการย่อย) */
export default function CatOptions({ groups, itemsOf }: { groups: ExpenseCat[]; itemsOf: (g: string) => ExpenseCat[] }) {
  return (
    <>
      {groups.filter((g) => g.active).map((g) => {
        const items = itemsOf(g.id).filter((x) => x.active)
        if (items.length === 0) return <option key={g.id} value={g.id}>{g.name}</option>
        return (
          <optgroup key={g.id} label={g.name}>
            <option value={g.id}>{g.name} (ทั้งหมวด)</option>
            {items.map((x) => <option key={x.id} value={x.id}>{x.code} {x.name}</option>)}
          </optgroup>
        )
      })}
    </>
  )
}
