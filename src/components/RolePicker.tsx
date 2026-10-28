import { useState } from 'react'
import Sheet from './Sheet'
import { normalizeRoles, ROLE_HELP, ROLE_LABEL, ROLES, rolesLabel, type Role } from '../lib/access'

/** เลือกสิทธิ์ได้มากกว่า 1 อย่าง (เช่น ผู้บันทึกบัญชี + ผู้บันทึกการนมัสการ) · แอดมินรวมทุกอย่างอยู่แล้ว · ดูอย่างเดียวใช้ร่วมกับอื่นไม่ได้ */
export default function RolePicker({ value, onChange, label, disabled, confirmText = 'ตกลง', only }: { only?: Role[]; value: Role[]; onChange: (rs: Role[]) => void; label: string; disabled?: boolean; confirmText?: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Role[]>(value)
  const start = () => { setDraft(value); setOpen(true) }
  const toggle = (r: Role) => {
    if (draft.includes(r)) { if (draft.length > 1) setDraft(normalizeRoles(draft.filter((x) => x !== r))); return }
    // ผู้ดูแลกองทุนเป็นสิทธิ์เฉพาะทาง: เลือกแล้วแทนที่สิทธิ์อื่นทั้งหมด · เลือกสิทธิ์อื่นเพิ่มจะยกเลิกผู้ดูแลกองทุนให้
    if (r === 'fundkeeper') { setDraft(['fundkeeper']); return }
    setDraft(normalizeRoles(r === 'admin' || r === 'viewer' ? [r] : [...draft.filter((x) => x !== 'fundkeeper'), r]))
  }
  const adminOn = draft.includes('admin')
  return (
    <>
      <button type="button" className="input rolepick" disabled={disabled} onClick={start} aria-label={`${label}: ${rolesLabel(value)} · แตะเพื่อเปลี่ยน`}>
        <span className="rolepick__v">{rolesLabel(value)}</span><span aria-hidden="true">▾</span>
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)}>
          <p className="pagehint" style={{ margin: 0 }}>เลือกได้มากกว่า 1 อย่าง เครื่องของคนนั้นจะเห็นเมนูและทำได้ตามทุกสิทธิ์ที่เลือก</p>
          <ul className="list">
            {(only ?? ROLES).map((r) => {
              const on = draft.includes(r)
              const off = adminOn && r !== 'admin'
              return (
                <li key={r} style={{ display: 'block' }}>
                  <label className="rolechk" style={{ opacity: off ? 0.5 : 1 }}>
                    <input type="checkbox" checked={on} disabled={off || (on && draft.length === 1)} onChange={() => toggle(r)} />
                    <span><b>{ROLE_LABEL[r]}</b><br /><span className="small muted">{ROLE_HELP[r]}</span></span>
                  </label>
                </li>
              )
            })}
          </ul>
          {adminOn && <p className="pagehint" style={{ margin: 0 }}>แอดมินรวมทุกสิทธิ์อยู่แล้ว เลือกร่วมกับอย่างอื่นไม่ได้</p>}
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button type="button" className="btn btn--ghost bigbtn grow" onClick={() => setOpen(false)}>ยกเลิก</button>
            <button type="button" className="btn btn--gold bigbtn grow" onClick={() => { onChange(draft); setOpen(false) }}>{confirmText}</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
