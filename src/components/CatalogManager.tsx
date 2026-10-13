import { useState } from 'react'

export interface CatalogOps {
  /** เพิ่มรายการใหม่ — คืน id ของรายการที่เพิ่ม หรือข้อความผิดพลาด */
  add: (name: string) => { id: string } | { error: string }
  rename: (id: string, current: string) => void
  remove: (id: string, name: string) => void
}

/** เพิ่ม / แก้ชื่อ / ลบรายการ ใต้ฟอร์มบันทึก (ตัวเลือกแบบเลื่อนลงของมือถือใส่ปุ่มไม่ได้) — ใช้ข้อมูลชุดเดียวกับหน้าตั้งค่า */
export default function CatalogManager({ noun, items, ops, onAdded }: { noun: string; items: { id: string; name: string }[]; ops: CatalogOps; onAdded?: (id: string) => void }) {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const add = () => {
    const r = ops.add(name)
    if ('error' in r) return setMsg(r.error)
    setMsg(`เพิ่ม “${name.trim()}” แล้ว — ขึ้นในตั้งค่าด้วย`); setName(''); onAdded?.(r.id)
  }
  return (
    <details className="editlist">
      <summary className="small">＋ เพิ่ม / ✎ แก้ชื่อ / 🗑️ ลบ {noun} ({items.length})</summary>
      <div className="row" style={{ margin: '6px 0' }}>
        <input className="input grow" aria-label={`ชื่อ${noun}ใหม่`} placeholder={`ชื่อ${noun}ใหม่`} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button type="button" className="btn btn--gold" onClick={add}>＋ เพิ่ม</button>
      </div>
      {msg && <p className="small" role="status" style={{ margin: '2px 0' }}>{msg}</p>}
      <ul className="list">{items.map((t) => <li key={t.id}><span className="grow">{t.name}</span><button type="button" className="mini" aria-label={`แก้ชื่อ ${t.name}`} onClick={() => ops.rename(t.id, t.name)}>✎ แก้ชื่อ</button><button type="button" className="mini" aria-label={`ลบ${noun} ${t.name}`} onClick={() => ops.remove(t.id, t.name)}>🗑️ ลบ</button></li>)}</ul>
    </details>
  )
}
