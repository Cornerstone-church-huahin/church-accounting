import { isFundType } from '../lib/funds'
import type { IncomeType } from '../lib/types'

/** "จ่ายจาก": เงินหมุนเวียนของคริสตจักร (ปกติ) หรือกองทุนใดกองทุนหนึ่ง — จ่ายจากกองทุนจะไปหักที่หน้ากองทุน ไม่ปนในรายจ่ายปกติ */
export default function FundPicker({ id, types, value, onChange }: { id: string; types: IncomeType[]; value: string; onChange: (v: string) => void }) {
  const funds = types.filter((t) => t.active && isFundType(t))
  if (funds.length === 0) return null
  return (
    <div className="field"><label htmlFor={id}>จ่ายจาก</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">เงินหมุนเวียนของคริสตจักร (ปกติ)</option>
        {funds.map((t) => <option key={t.id} value={t.id}>💰 {t.name}</option>)}
      </select>
    </div>
  )
}
