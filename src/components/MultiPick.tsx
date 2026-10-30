import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PickOption { value: string; label: string }

/**
 * ตัวเลือกหลายรายการแบบป๊อปอัพ: ปุ่มเดียวบรรทัดเดียว (ไม่กินพื้นที่) → แตะแล้วมีรายการให้ติ๊กได้หลายอัน → “เสร็จ”
 * onAdd = เพิ่มรายการใหม่ในป๊อปอัพ (เก็บถาวรโดยเจ้าของข้อมูล) · onRemove = โหมด “ลบ” แสดงปุ่ม ✕ ที่แต่ละรายการ
 */
export default function MultiPick({ title, options, value, onChange, empty, id, onAdd, onRemove, addHint, allLabel }: {
  /** แถวแรกในป๊อปอัพ “ทุก…” (ติ๊กอยู่เมื่อยังไม่ได้เลือกรายการใด · แตะ = ล้างที่เลือกทั้งหมด) */ allLabel?: string; title: string; options: PickOption[]; value: string[]; onChange: (v: string[]) => void; empty: string; id?: string
  onAdd?: (name: string) => void; onRemove?: (value: string) => void; addHint?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [del, setDel] = useState(false)
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v
  const shown = value.length === 0 ? empty : value.length <= 2 ? value.map(labelOf).join(', ') : `${value.length} รายการ · ${labelOf(value[0])} …`
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    window.addEventListener('keydown', on, true)
    return () => window.removeEventListener('keydown', on, true)
  }, [open])
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const add = () => { const n = name.trim(); if (!n || !onAdd) return; onAdd(n); setName('') }
  // รายการที่เลือกไว้แต่ไม่อยู่ในตัวเลือกแล้ว (เช่น บันทึกเก่า) ยังติ๊กให้เห็น
  const rows = [...options, ...value.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v }))]
  return (
    <>
      <button type="button" id={id} className="input mpick__btn" aria-haspopup="dialog" aria-label={`${title}: ${shown}`} onClick={() => setOpen(true)}>
        <span className="mpick__txt">{shown}</span><span aria-hidden="true">▾</span>
      </button>
      {open && createPortal(
        <div className="mpick no-print" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="mpick__card">
            <div className="row row--between"><b>{title}{value.length ? ` · เลือกแล้ว ${value.length}` : ''}</b>{value.length > 0 && <button type="button" className="mini" onClick={() => onChange([])}>ล้าง</button>}</div>
            <ul className="mpick__list">
              {allLabel && (
                <li><label className="mpick__row mpick__row--all"><input type="checkbox" checked={value.length === 0} onChange={() => { if (value.length > 0) onChange([]) }} /><span><b>{allLabel}</b></span></label></li>
              )}
              {rows.map((o) => (
                <li key={o.value}>
                  <label className="mpick__row"><input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} /><span>{o.label}</span></label>
                  {del && onRemove && <button type="button" className="chip__x" aria-label={`ลบ ${o.label} ออกจากรายชื่อ`} onClick={() => { onRemove(o.value); onChange(value.filter((x) => x !== o.value)) }}>✕</button>}
                </li>
              ))}
              {rows.length === 0 && <li className="muted small" style={{ padding: '0.6rem' }}>ยังไม่มีรายชื่อ — เพิ่มด้านล่าง</li>}
            </ul>
            {onAdd && (
              <div className="pvadd2">
                <input aria-label="เพิ่มชื่อใหม่" className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder={addHint ?? 'พิมพ์ชื่อใหม่'} />
                <button type="button" className="btn btn--gold" disabled={!name.trim()} onClick={add}>＋ เพิ่ม</button>
              </div>
            )}
            <div className="row row--between">
              {onRemove ? <button type="button" className={`mini${del ? ' on' : ''}`} aria-pressed={del} onClick={() => setDel((v) => !v)}>{del ? 'เลิกลบ' : '✏️ ลบชื่อ'}</button> : <span />}
              <button type="button" className="btn btn--gold" onClick={() => setOpen(false)}>เสร็จ</button>
            </div>
          </div>
        </div>, document.body)}
    </>
  )
}
