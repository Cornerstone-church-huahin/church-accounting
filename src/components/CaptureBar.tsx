import { useState, type ReactNode } from 'react'

interface Props {
  /** ชื่อเอกสาร เช่น "สลิป" "บิล" */
  noun: string
  onFile: (file: File) => void
  /** ปุ่มดาวน์โหลด (ถ้ามี): ตัวเลือกหลายแบบจะขึ้นเมนูเล็ก ๆ */
  downloads?: { label: string; run: () => void | Promise<void> }[]
  busy?: boolean
  children?: ReactNode
}

/** แถวไอคอน 3 ปุ่มรูปแบบเดียวกัน: ⬇️ ดาวน์โหลด · 📎 แนบไฟล์ · 📷 ถ่ายรูป */
export default function CaptureBar({ noun, onFile, downloads, busy, children }: Props) {
  const [menu, setMenu] = useState(false)
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }
  return (
    <div className="capbar">
      <div className="capbar__row">
        {downloads && downloads.length > 0 && (
          <button type="button" className="act-btn" disabled={busy} aria-expanded={menu} aria-label="ดาวน์โหลดใบเปล่า" onClick={() => (downloads.length === 1 ? void downloads[0].run() : setMenu(!menu))}>
            <span className="act-btn__ico" aria-hidden="true">{busy ? '…' : '⬇️'}</span><span>ดาวน์โหลด</span>
          </button>
        )}
        <label className="act-btn">
          <span className="act-btn__ico" aria-hidden="true">📎</span><span>แนบ{noun}</span>
          <input type="file" accept="image/*" aria-label={`แนบไฟล์${noun}`} style={{ display: 'none' }} onChange={pick} />
        </label>
        <label className="act-btn">
          <span className="act-btn__ico" aria-hidden="true">📷</span><span>ถ่ายรูป{noun}</span>
          <input type="file" accept="image/*" capture="environment" aria-label={`ถ่ายรูป${noun}`} style={{ display: 'none' }} onChange={pick} />
        </label>
      </div>
      {menu && downloads && (
        <div className="capbar__menu">
          {downloads.map((d) => <button key={d.label} type="button" className="mini" onClick={async () => { setMenu(false); await d.run() }}>{d.label}</button>)}
        </div>
      )}
      {children}
    </div>
  )
}
