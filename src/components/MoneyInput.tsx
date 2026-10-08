import { useState } from 'react'
import { fmtBaht, parseBaht } from '../lib/money'

/** ช่องกรอกเงินบาท · เก็บค่าเป็นสตางค์ (null = ยังไม่กรอก/ไม่ถูกต้อง) */
export default function MoneyInput({ id, value, onChange, placeholder = '0.00', autoFocus }: { id?: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(value ? fmtBaht(value).replace(/,/g, '') : '')
  return (
    <input
      id={id} className="input input--money" inputMode="decimal" placeholder={placeholder} autoFocus={autoFocus} value={text}
      onChange={(e) => { setText(e.target.value); const n = parseBaht(e.target.value); onChange(Number.isNaN(n) ? null : n) }}
      onBlur={() => { const n = parseBaht(text); if (!Number.isNaN(n)) setText(fmtBaht(n).replace(/,/g, '')) }}
    />
  )
}
