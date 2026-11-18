import { useId } from 'react'
import { usePeople } from '../lib/data'

/** ช่องผู้รับเงิน: พิมพ์เองได้ (ร้านค้า/คนนอก) หรือกดเลือกจากรายชื่อชุดเดียวกับช่อง ผู้วางบิล/ผู้สำรองจ่าย — ชื่อที่เพิ่มในช่องนั้นมาโผล่ที่นี่ด้วย */
export default function PayeeField({ id, value, onChange, label = 'ผู้รับเงิน' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const people = usePeople()
  const dl = useId()
  const names = [...new Set(people.items.filter((p) => !p.deleted).map((p) => p.name))].sort((a, b) => a.localeCompare(b, 'th'))
  const q = value.trim()
  const shown = (q ? names.filter((n) => n.includes(q) && n !== q) : names).slice(0, 10)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} list={dl} autoComplete="off" onChange={(e) => onChange(e.target.value)} placeholder="พิมพ์ชื่อ หรือกดเลือกจากรายชื่อด้านล่าง" />
      <datalist id={dl}>{names.map((n) => <option key={n} value={n} />)}</datalist>
      {shown.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }} role="group" aria-label="เลือกชื่อจากรายชื่อ">
          {shown.map((n) => <button key={n} type="button" className="mini" onClick={() => onChange(n)}>{n}</button>)}
        </div>
      )}
    </div>
  )
}
