import { useId } from 'react'
import { fmtBaht, fmtShort } from '../lib/money'
import type { Bucket } from '../lib/seriesLedger'

/** กราฟสถิติของใบสรุป (SVG) — สีรายรับเขียวทึบ · รายจ่ายแดงมีลายเฉียง (ไม่พึ่งสีอย่างเดียว) · แกนเดียว · ชี้ดูรายละเอียดได้ที่แท่ง */
export const INC = '#1b8a4b', OUT = '#b3261e', INK = '#222', MUTED = '#666', GRID = '#ddd'

const niceMax = (v: number) => {
  if (v <= 0) return 1000
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v) ?? v)
}
/** แท่งปลายมนด้านบน 4px ฐานตรง */
const barPath = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
}
const Hatch = ({ id }: { id: string }) => <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.8" height="5" fill="#fff" fillOpacity="0.5" /></pattern>

export function Legend() {
  return (
    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: INK }}>
      <span><i style={{ display: 'inline-block', width: 12, height: 12, background: INC, borderRadius: 2, marginRight: 5, verticalAlign: -1 }} />รายรับ</span>
      <span><i style={{ display: 'inline-block', width: 12, height: 12, background: `repeating-linear-gradient(45deg, ${OUT} 0 3px, #d98a84 3px 5px)`, borderRadius: 2, marginRight: 5, verticalAlign: -1 }} />รายจ่าย (รวมค้างจ่าย)</span>
    </div>
  )
}

/** รายรับ-รายจ่ายต่อช่วง (แท่งคู่) — ป้ายตัวเลขเฉพาะแท่งสูงสุดของแต่ละชุด */
export function GroupedBars({ buckets, height = 250 }: { buckets: Bucket[]; height?: number }) {
  const hid = `h${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const W = 758, L = 46, R = 8, T = 16, B = 24
  const plotW = W - L - R, plotH = height - T - B
  const max = niceMax(Math.max(0, ...buckets.flatMap((b) => [b.inTotal, b.outTotal])) / 100) * 100
  const y = (v: number) => T + plotH - (Math.max(0, v) / max) * plotH
  const gW = plotW / Math.max(1, buckets.length)
  const bw = Math.min(22, gW * 0.34)
  const maxIn = Math.max(...buckets.map((b) => b.inTotal)), maxOut = Math.max(...buckets.map((b) => b.outTotal))
  if (max <= 100 || buckets.every((b) => b.inTotal === 0 && b.outTotal === 0)) return <p style={{ color: MUTED, fontSize: 13, margin: '30px 0', textAlign: 'center' }}>ยังไม่มีรายการในช่วงนี้</p>
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="รายรับและรายจ่ายแยกตามช่วง">
      <defs><Hatch id={hid} /></defs>
      {[0, 1, 2, 3, 4].map((i) => { const v = (max / 4) * i; return <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={i === 0 ? 1.2 : 0.8} /><text x={L - 6} y={y(v) + 3.5} fontSize="10" textAnchor="end" fill={MUTED}>{fmtShort(v)}</text></g> })}
      {buckets.map((b, i) => {
        const cx = L + gW * i + gW / 2
        const hi = plotH - (y(b.inTotal) - T), ho = plotH - (y(b.outTotal) - T)
        return (
          <g key={b.from}>
            <title>{`${b.label}: รับ ${fmtBaht(b.inTotal)} · จ่าย ${fmtBaht(b.outTotal)} · คงเหลือ ${fmtBaht(b.balance)}`}</title>
            {b.inTotal > 0 && <path d={barPath(cx - bw - 1, y(b.inTotal), bw, hi)} fill={INC} />}
            {b.outTotal > 0 && <><path d={barPath(cx + 1, y(b.outTotal), bw, ho)} fill={OUT} /><path d={barPath(cx + 1, y(b.outTotal), bw, ho)} fill={`url(#${hid})`} /></>}
            {b.inTotal === maxIn && maxIn > 0 && <text x={cx - bw / 2 - 1} y={y(b.inTotal) - 4} fontSize="10" fontWeight="700" textAnchor="middle" fill={INK}>{fmtShort(b.inTotal)}</text>}
            {b.outTotal === maxOut && maxOut > 0 && <text x={cx + bw / 2 + 1} y={y(b.outTotal) - 4} fontSize="10" fontWeight="700" textAnchor="middle" fill={INK}>{fmtShort(b.outTotal)}</text>}
            <text x={cx} y={height - 8} fontSize="10.5" textAnchor="middle" fill={INK}>{b.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** คงเหลือสะสม (รับ − จ่าย) เส้น 2px จุดมีขอบขาว เส้นศูนย์ประ */
export function CumLine({ buckets, height = 150 }: { buckets: Bucket[]; height?: number }) {
  const W = 758, L = 46, R = 36, T = 14, B = 24
  const plotW = W - L - R, plotH = height - T - B
  const vals = buckets.map((b) => b.cum)
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals)
  const span = Math.max(1, hi - lo)
  const y = (v: number) => T + plotH - ((v - lo) / span) * plotH
  const gW = plotW / Math.max(1, buckets.length)
  const px = (i: number) => L + gW * i + gW / 2
  if (buckets.every((b) => b.inTotal === 0 && b.outTotal === 0)) return null
  const d = buckets.map((b, i) => `${i ? 'L' : 'M'}${px(i)},${y(b.cum)}`).join(' ')
  const last = buckets[buckets.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="คงเหลือสะสม">
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke={MUTED} strokeWidth="1" strokeDasharray="4 3" />
      <text x={L - 6} y={y(0) + 3.5} fontSize="10" textAnchor="end" fill={MUTED}>0</text>
      <text x={L - 6} y={y(hi) + 3.5} fontSize="10" textAnchor="end" fill={MUTED}>{fmtShort(hi)}</text>
      {lo < 0 && <text x={L - 6} y={y(lo) + 3.5} fontSize="10" textAnchor="end" fill={MUTED}>{fmtShort(lo)}</text>}
      <path d={d} fill="none" stroke="#1a2b4c" strokeWidth="2" strokeLinejoin="round" />
      {buckets.map((b, i) => <g key={b.from}><title>{`${b.label}: คงเหลือสะสม ${fmtBaht(b.cum)}`}</title><circle cx={px(i)} cy={y(b.cum)} r="4.5" fill="#1a2b4c" stroke="#fff" strokeWidth="2" /><text x={px(i)} y={height - 8} fontSize="10.5" textAnchor="middle" fill={INK}>{b.label}</text></g>)}
      <text x={px(buckets.length - 1) + 9} y={y(last.cum) + 3.5} fontSize="10.5" fontWeight="700" fill={INK}>{fmtShort(last.cum)}</text>
    </svg>
  )
}

/** แท่งแนวนอน: ป้ายหมวดซ้าย ตัวเลขที่ปลายแท่ง (≤ 8 แถว) */
export function HBars({ rows, tone, width = 372 }: { rows: { label: string; value: number }[]; tone: 'in' | 'out'; width?: number }) {
  const hid = `h${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const rowH = 27, left = 150, right = 54
  const H = Math.max(1, rows.length) * rowH + 6
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p style={{ color: MUTED, fontSize: 13, margin: '14px 0' }}>ยังไม่มีรายการ</p>
  const color = tone === 'in' ? INC : OUT
  return (
    <svg viewBox={`0 0 ${width} ${H}`} width="100%" role="img" aria-label={tone === 'in' ? 'รายรับตามประเภท' : 'รายจ่ายตามหมวด'}>
      <defs><Hatch id={hid} /></defs>
      {rows.map((r, i) => {
        const w = Math.max(3, (r.value / max) * (width - left - right))
        const y0 = i * rowH + 4
        return (
          <g key={r.label}>
            <title>{`${r.label}: ${fmtBaht(r.value)}`}</title>
            <text x={left - 6} y={y0 + 14} fontSize="11" textAnchor="end" fill={INK}>{r.label.length > 24 ? `${r.label.slice(0, 23)}…` : r.label}</text>
            <path d={`M${left},${y0 + 4} L${left + w - 4},${y0 + 4} Q${left + w},${y0 + 4} ${left + w},${y0 + 8} L${left + w},${y0 + 14} Q${left + w},${y0 + 18} ${left + w - 4},${y0 + 18} L${left},${y0 + 18} Z`} fill={color} />
            {tone === 'out' && <path d={`M${left},${y0 + 4} L${left + w - 4},${y0 + 4} Q${left + w},${y0 + 4} ${left + w},${y0 + 8} L${left + w},${y0 + 14} Q${left + w},${y0 + 18} ${left + w - 4},${y0 + 18} L${left},${y0 + 18} Z`} fill={`url(#${hid})`} />}
            <text x={left + w + 5} y={y0 + 14} fontSize="11" fontWeight="700" fill={INK}>{fmtShort(r.value)}</text>
          </g>
        )
      })}
    </svg>
  )
}
