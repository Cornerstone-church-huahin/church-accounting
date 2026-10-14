import { useRef } from 'react'
import { usePeople } from '../lib/data'
import { newId } from '../lib/money'
import CatalogManager from './CatalogManager'

/** เลือกชื่อผู้วางบิล/ผู้สำรองจ่ายจากรายชื่อที่เคยกรอก — เพิ่ม/แก้ชื่อ/ลบได้ทันทีใต้ช่อง (ใช้ซ้ำได้ทุกใบ) */
export default function PersonField({ id, value, onChange, label = 'ผู้วางบิล / ผู้สำรองจ่าย' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const people = usePeople()
  const added = useRef('')
  const list = [...people.items].sort((a, b) => a.name.localeCompare(b.name, 'th'))
  const options = value && !list.some((p) => p.name === value) ? [...list.map((p) => p.name), value] : list.map((p) => p.name)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— ไม่ระบุ —</option>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <CatalogManager noun="ชื่อ" items={list.map((p) => ({ id: p.id, name: p.name }))} onAdded={() => onChange(added.current)} ops={{
        add: (name) => {
          const n = name.trim()
          if (!n) return { error: 'พิมพ์ชื่อก่อน' }
          if (list.some((p) => p.name === n)) return { error: `มี “${n}” อยู่แล้ว` }
          added.current = n
          const rec = { id: newId('pp'), name: n, updated: 0 }
          return people.put([rec]) ? { id: rec.id } : { error: 'สิทธิ์ของท่านเพิ่มไม่ได้' }
        },
        rename: (pid, cur) => { const n = prompt('แก้ชื่อ', cur)?.trim(); const x = people.items.find((p) => p.id === pid); if (n && x && n !== cur) { people.put([{ ...x, name: n }]); if (value === cur) onChange(n) } },
        remove: (pid, nm) => { if (confirm(`ลบชื่อ “${nm}” ออกจากรายชื่อ?\n(รายการที่บันทึกไว้แล้วยังคงชื่อเดิม)`)) people.remove(pid) },
      }} />
    </div>
  )
}
