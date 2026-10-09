/** แถบเลือกช่วงเวลา (‹ ป้ายช่วง ›) + บรรทัดช่วงวันที่ — ใช้กับใบสรุปรายสัปดาห์/เดือน/ไตรมาส/ปี */
export default function PeriodBar({ label, rangeText, onPrev, onNext, canPrev, canNext }: { label: string; rangeText: string; onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean }) {
  return (
    <>
      <div className="no-print" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="ช่วงก่อน" disabled={!canPrev} onClick={onPrev}>‹</button>
        <b style={{ textAlign: 'center' }}>{label}</b>
        <button type="button" className="mini" aria-label="ช่วงถัดไป" disabled={!canNext} onClick={onNext}>›</button>
      </div>
      <p className="muted small no-print" style={{ textAlign: 'center' }}>{rangeText}</p>
    </>
  )
}
