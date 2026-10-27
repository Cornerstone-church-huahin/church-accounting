import { fmtBaht } from '../lib/money'

const NAVY = '#1a2b4c', ORANGE = '#c2571a', GOLD = '#b8860b'
const m = (x: number) => fmtBaht(x, { dec: false })
const short = (x: number) => (Math.abs(x) >= 1000 ? `${(x / 1000).toFixed(Math.abs(x) >= 10000 ? 0 : 1)}k` : String(Math.round(x)))
const W = 720

/** แท่งคู่ รายรับ (ทึบ) / รายจ่าย (ลายเฉียง) — ขาวดำพิมพ์แล้วแยกได้จากลายและตัวเลขบนแท่ง */
export function PairedBars({ pairs, id }: { pairs: { label: string; inn: number; out: number }[]; id: string }) {
  const H = 170, pad = { l: 8, r: 8, t: 16, b: 22 }
  const max = Math.max(1, ...pairs.flatMap((p) => [p.inn, p.out]))
  const gw = (W - pad.l - pad.r) / Math.max(1, pairs.length), bw = Math.min(26, gw / 2 - 3)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="แท่งคู่รายรับและรายจ่าย" style={{ display: 'block' }}>
      <defs><pattern id={`hatch-${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff" /><rect width="2.4" height="5" fill={ORANGE} /></pattern></defs>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#999" />
      {pairs.map((p, i) => {
        const cx = pad.l + gw * i + gw / 2
        return (
          <g key={i}>
            <rect x={cx - bw - 1} y={y(p.inn)} width={bw} height={H - pad.b - y(p.inn)} fill={NAVY} />
            <rect x={cx + 1} y={y(p.out)} width={bw} height={H - pad.b - y(p.out)} fill={`url(#hatch-${id})`} stroke={ORANGE} />
            {p.inn > 0 && <text x={cx - bw / 2 - 1} y={y(p.inn) - 3} textAnchor="middle" fontSize="9.5" fill={NAVY}>{short(p.inn)}</text>}
            {p.out > 0 && <text x={cx + bw / 2 + 1} y={y(p.out) - 3} textAnchor="middle" fontSize="9.5" fill={ORANGE}>{short(p.out)}</text>}
            <text x={cx} y={H - 7} textAnchor="middle" fontSize="10.5" fill="#222">{p.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** แท่งนอนตามหมวด พร้อมตัวเลขและร้อยละ */
export function HBarRows({ rows, color = ORANGE }: { rows: { label: string; amount: number; pct?: number }[]; color?: string }) {
  const top = rows.slice(0, 8)
  const max = Math.max(1, ...top.map((r) => r.amount))
  const rh = 22, H = Math.max(rh, top.length * rh) + 4
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="แท่งรายจ่ายแยกหมวด" style={{ display: 'block' }}>
      {top.map((r, i) => {
        const w = ((W - 330) * r.amount) / max
        return (
          <g key={i}>
            <text x={0} y={i * rh + 15} fontSize="11.5" fill="#222">{r.label.length > 24 ? `${r.label.slice(0, 23)}…` : r.label}</text>
            <rect x={190} y={i * rh + 4} width={Math.max(2, w)} height={14} fill={color} />
            <text x={190 + Math.max(2, w) + 5} y={i * rh + 15} fontSize="11" fill="#222">{m(r.amount)}{r.pct !== undefined ? ` · ${r.pct}%` : ''}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** เส้นเงินหมุนเวียนคงเหลือ ณ สิ้นแต่ละเดือน */
export function TrendLine({ points }: { points: { label: string; balance: number }[] }) {
  const H = 150, pad = { l: 40, r: 14, t: 16, b: 22 }
  if (points.length === 0) return <p className="muted small" style={{ margin: 0 }}>ยังไม่มีข้อมูลรายเดือน</p>
  const vals = points.map((p) => p.balance)
  const lo = Math.min(0, ...vals), hi = Math.max(1, ...vals)
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, points.length - 1)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo || 1))
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.balance)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="เส้นเงินหมุนเวียนคงเหลือรายเดือน" style={{ display: 'block' }}>
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#999" strokeDasharray="3 3" />
      <text x={pad.l - 4} y={y(0) + 3} fontSize="9.5" textAnchor="end" fill="#555">0</text>
      <path d={d} fill="none" stroke={NAVY} strokeWidth="2.2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.balance)} r="3.2" fill="#fff" stroke={NAVY} strokeWidth="2" />
          <text x={x(i)} y={y(p.balance) - 6} fontSize="9.5" textAnchor="middle" fill={NAVY}>{short(p.balance)}</text>
          <text x={x(i)} y={H - 7} fontSize="10.5" textAnchor="middle" fill="#222">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

/** แท่งนอนเงินกองทุนคงเหลือ ณ สิ้นช่วง */
export function FundBars({ rows }: { rows: { label: string; amount: number }[] }) {
  return <HBarRows rows={rows} color={GOLD} />
}
