import { addDays, fmtDate, fmtDateLong, isISO, sheetSunday } from '../lib/money'

/** แถบเลือกสัปดาห์ (‹ วันอาทิตย์ที่ … ›) + ช่วงวันที่ — ใช้เหมือนกันทั้งฝั่งรับ จ่าย และสรุป */
export default function WeekBar({ sunday, sundays, onChange, label, disabled }: { sunday: string; sundays: string[]; onChange: (s: string) => void; label?: string; disabled?: boolean }) {
  const idx = sundays.indexOf(sunday)
  return (
    <>
      <div className="no-print weekbar" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" disabled={disabled || idx <= 0} onClick={() => onChange(sundays[idx - 1])}>‹</button>
        <b style={{ textAlign: 'center' }}>{label ?? fmtDateLong(sunday)}</b>
        {!disabled && (
          <label className="weekpick mini" aria-label="เลือกวันที่เพื่อไปสัปดาห์นั้น" title="เลือกวันที่จากปฏิทิน">📅
            <input type="date" value={sunday} onChange={(e) => { const w = isISO(e.target.value) ? sheetSunday(e.target.value) : ''; if (w && sundays.includes(w)) onChange(w) }} />
          </label>
        )}
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" disabled={disabled || idx >= sundays.length - 1} onClick={() => onChange(sundays[idx + 1])}>›</button>
      </div>
      <p className="muted small no-print weekbar__range" style={{ textAlign: 'center' }}>{disabled ? 'รวมทุกสัปดาห์ในปี' : `${fmtDate(addDays(sunday, -6))} – ${fmtDate(sunday)}`}</p>
    </>
  )
}
