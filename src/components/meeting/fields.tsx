import { useEffect, useState } from 'react'

/** ช่องกรอกที่บันทึกเมื่อออกจากช่อง (blur) หรือกด Enter — พิมพ์ลื่น ไม่บันทึกทุกตัวอักษร */
export function TextField({ label, value, onCommit, type = 'text', placeholder, multiline, rows = 3, list, id, narrow }: { label: string; value: string | number | undefined; onCommit: (v: string) => void; type?: string; placeholder?: string; multiline?: boolean; rows?: number; list?: string; id: string; narrow?: boolean }) {
  const [v, setV] = useState(String(value ?? ''))
  useEffect(() => setV(String(value ?? '')), [value])
  const commit = () => { if (v !== String(value ?? '')) onCommit(v) }
  return (
    <div className="field" style={narrow ? { flex: '0 0 6.5rem' } : { flex: '1 1 auto', minWidth: '9rem' }}>
      <label htmlFor={id}>{label}</label>
      {multiline
        ? <textarea id={id} className="input" rows={rows} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
        : <input id={id} className="input" type={type} value={v} placeholder={placeholder} list={list} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />}
    </div>
  )
}

export function SelectField<T extends string>({ label, value, options, onChange, id }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="field" style={{ flex: '1 1 auto', minWidth: '7rem' }}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
    </div>
  )
}
