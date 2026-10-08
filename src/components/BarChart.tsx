import { useId, useState } from 'react'
import { fmtBaht, fmtShort } from '../lib/money'

export interface Series { name: string; values: number[]; cls: 's1' | 's2' | 's3' }

/**
 * กราฟแท่งแนวนอน (ป้ายหมวดอยู่ซ้าย อ่านชื่อไทยยาว ๆ ได้บนมือถือ) · 1–2 ชุดข้อมูล
 * - ตัวเลขกำกับที่ปลายแท่งทุกแท่ง (เป็นรายงานปิดประกาศ) · แตะแท่งเพื่อดูรายละเอียด
 * - ชุดที่ 2 ใช้ลายเฉียงตอนพิมพ์ขาวดำ · มีตารางตัวเลขใต้กราฟเสมอ (ในหน้ารายงาน)
 */
export default function BarChart({ title, cats, series, unit = 'บาท' }: { title: string; cats: string[]; series: Series[]; unit?: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const hatch = `h${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const rowH = series.length === 1 ? 30 : 44
  const barH = series.length === 1 ? 18 : 14
  const left = 112, right = 70, W = 360
  const H = cats.length * rowH + 8
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const x = (v: number) => (Math.max(0, v) / max) * (W - left - right)
  if (cats.length === 0) return <p className="empty">ไม่มีข้อมูล</p>
  return (
    <figure className="chart" style={{ margin: 0, position: 'relative' }} aria-label={title}>
      {series.length > 1 && <div className="legend" style={{ marginBottom: 6 }}>{series.map((s) => <span key={s.name}><i className={s.cls} />{s.name}</span>)}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${cats.map((c, i) => `${c} ${series.map((s) => `${s.name} ${fmtBaht(s.values[i])}`).join(' ')}`).join(', ')}`}>
        <defs><pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff" /><rect width="2.2" height="5" fill="var(--series-2)" /></pattern></defs>
        <style>{`@media print{.chart svg .s2{fill:url(#${hatch})}}`}</style>
        <line className="grid" x1={left} x2={left} y1={0} y2={H} />
        {cats.map((c, i) => {
          const y0 = i * rowH + 4
          const gap = (rowH - 8 - series.length * barH) / 2
          return (
            <g key={c + i}>
              <text x={left - 6} y={y0 + rowH / 2} textAnchor="end" dominantBaseline="middle" fontSize="11">{c.length > 16 ? `${c.slice(0, 15)}…` : c}</text>
              {series.map((s, j) => {
                const v = s.values[i] ?? 0
                const w = Math.max(v > 0 ? 3 : 0, x(v))
                const y = y0 + gap + j * (barH + 2)
                return (
                  <g key={s.name}>
                    <path className={s.cls} d={`M${left},${y} h${Math.max(0, w - 4)} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h-${Math.max(0, w - 4)} z`} style={{ display: w > 0 ? undefined : 'none' }} />
                    <text className="val" x={left + w + 5} y={y + barH / 2} dominantBaseline="middle" fontSize="10.5">{fmtShort(v)}</text>
                    <rect className="hit" x={0} y={y - 2} width={W} height={barH + 4}
                      onClick={() => setTip({ x: ((left + w / 2) / W) * 100, y: ((y) / H) * 100, text: `${c} · ${s.name} ${fmtBaht(v)} ${unit}` })}
                      onMouseLeave={() => setTip(null)} />
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      {tip && <div className="tip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }} role="status">{tip.text}</div>}
    </figure>
  )
}
