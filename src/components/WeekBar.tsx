import { addDays, fmtDate, fmtDateLong } from '../lib/money'

/** แถบเลือกสัปดาห์ (‹ วันอาทิตย์ที่ … ›) + ช่วงวันที่ — ใช้เหมือนกันทั้งฝั่งรับ จ่าย และสรุป */
export default function WeekBar({ sunday, sundays, onChange, label, disabled }: { sunday: string; sundays: string[]; onChange: (s: string) => void; label?: string; disabled?: boolean }) {
  const idx = sundays.indexOf(sunday)
  return (
    <>
      <div className="no-print" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" disabled={disabled || idx <= 0} onClick={() => onChange(sundays[idx - 1])}>‹</button>
        <b style={{ textAlign: 'center' }}>{label ?? fmtDateLong(sunday)}</b>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" disabled={disabled || idx >= sundays.length - 1} onClick={() => onChange(sundays[idx + 1])}>›</button>
      </div>
      <p className="muted small no-print" style={{ textAlign: 'center' }}>{disabled ? 'รวมทุกสัปดาห์ในปี' : `${fmtDate(addDays(sunday, -6))} – ${fmtDate(sunday)}`}</p>
    </>
  )
}
