import { useRef } from 'react'
import { dow, fmtDateLong } from '../lib/money'

/**
 * ตัวเลื่อนอาทิตย์แบบบรรทัดเดียว (เตี้ย): ‹ วันที่ · จำนวนผู้มา › — แตะลูกศรหรือปัดซ้าย-ขวาเพื่อเลื่อนทีละอาทิตย์
 * (เหมือนตัวเลื่อนสัปดาห์ในหน้าบัญชี แต่ย่อให้กินที่แนวตั้งน้อยที่สุด)
 */
export default function WeekStrip({ dates, value, onPick, counts, today }: { dates: string[]; value: string; onPick: (d: string) => void; counts?: Map<string, number>; today: string }) {
  const i = dates.indexOf(value)
  const prev = i > 0 ? dates[i - 1] : null
  const next = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null
  const x0 = useRef<number | null>(null)
  const n = counts?.get(value)
  const swipe = (dx: number) => { if (Math.abs(dx) < 50) return; const to = dx > 0 ? prev : next; if (to) onPick(to) }   // ปัดไปทางขวา = อาทิตย์ก่อนหน้า
  return (
    <div className="weekstep no-print" role="group" aria-label="เลือกอาทิตย์" onTouchStart={(e) => { x0.current = e.touches[0].clientX }} onTouchEnd={(e) => { if (x0.current != null) swipe(e.changedTouches[0].clientX - x0.current); x0.current = null }}>
      <button type="button" className="weekstep__b" aria-label="อาทิตย์ก่อนหน้า" disabled={!prev} onClick={() => prev && onPick(prev)}>‹</button>
      <div className="weekstep__t" aria-live="polite">
        <b>{value === today ? 'วันนี้ · ' : ''}{fmtDateLong(value)}</b>
        {n != null && <small> · {n} คน</small>}{dow(value) !== 0 && <small className="weekstep__off"> · ไม่ใช่อาทิตย์</small>}
      </div>
      <button type="button" className="weekstep__b" aria-label="อาทิตย์ถัดไป" disabled={!next} onClick={() => next && onPick(next)}>›</button>
    </div>
  )
}
