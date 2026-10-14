import { addDays, fmtDate, fmtDateLong } from '../lib/money'

/** แถบเลือกสัปดาห์ (‹ วันอาทิตย์ที่ … ›) + ช่วงวันที่ — ใช้เหมือนกันทั้งฝั่งรับ จ่าย และสรุป */
export default function WeekBar({ sunday, sundays, onChange, label, disabled, marks }: { sunday: string; sundays: string[]; onChange: (s: string) => void; label?: string; disabled?: boolean; /** สัปดาห์ (วันอาทิตย์) → จำนวนรายการที่บันทึกไว้ — แสดงเป็นปุ่มลัดไปสัปดาห์นั้น */ marks?: Record<string, number> }) {
  const idx = sundays.indexOf(sunday)
  const marked = Object.keys(marks ?? {}).filter((d) => (marks?.[d] ?? 0) > 0 && sundays.includes(d)).sort().reverse().slice(0, 12)
  return (
    <>
      <div className="no-print weekbar" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" disabled={disabled || idx <= 0} onClick={() => onChange(sundays[idx - 1])}>‹</button>
        <b style={{ textAlign: 'center' }}>{label ?? fmtDateLong(sunday)}</b>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" disabled={disabled || idx >= sundays.length - 1} onClick={() => onChange(sundays[idx + 1])}>›</button>
      </div>
      <p className="muted small no-print weekbar__range" style={{ textAlign: 'center' }}>{disabled ? 'รวมทุกสัปดาห์ในปี' : `${fmtDate(addDays(sunday, -6))} – ${fmtDate(sunday)}`}</p>
      {!disabled && marked.length > 0 && (
        <div className="no-print weekchips" role="group" aria-label="สัปดาห์ที่มีรายการบันทึก">
          <span className="small muted">สัปดาห์ที่มีรายการ:</span>
          {marked.map((d) => <button key={d} type="button" className={`mini${d === sunday ? ' on' : ''}`} aria-pressed={d === sunday} onClick={() => onChange(d)}>{fmtDate(addDays(d, -6))} – {fmtDate(d)} ({marks?.[d]})</button>)}
        </div>
      )}
    </>
  )
}
