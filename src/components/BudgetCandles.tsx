import { fmtBaht } from '../lib/money'

/**
 * แท่งสามแท่งของแต่ละงบ: ซ้าย เขียว = รายรับที่ได้รับ · กลาง = งบที่ตั้ง · ขวา แดง = รายจ่าย
 * ความสูงเทียบกับค่าสูงสุดของสามแท่ง · ตัวเลขกำกับบนทุกแท่ง · แท่งแดงมีลายเฉียงกันสับสนกับเขียวสำหรับคนตาบอดสี
 */
export default function BudgetCandles({ title, income, budget, spent, committed = 0 }: { title: string; income: number; budget: number; spent: number; committed?: number }) {
  const W = 300, H = 168, base = 128, top = 22, bw = 62
  const max = Math.max(1, income, budget, spent)
  const h = (v: number) => Math.max(v > 0 ? 3 : 0, ((Math.max(0, v) / max) * (base - top)))
  const bars = [
    { x: 38, v: income, cls: 's1', label: 'ได้รับ' },
    { x: 119, v: budget, cls: 's3', label: 'งบที่ตั้ง' },
    { x: 200, v: spent, cls: 's2', label: 'จ่ายแล้ว' },
  ]
  const hatch = `cd${title.replace(/[^a-zA-Z0-9ก-๙]/g, '').slice(0, 12)}${Math.abs(Math.round(income + budget + spent)) % 9973}`
  return (
    <figure className="chart" style={{ margin: 0 }} aria-label={title}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ได้รับ ${fmtBaht(income)} บาท, งบที่ตั้ง ${fmtBaht(budget)} บาท, จ่ายแล้ว ${fmtBaht(spent)} บาท`}>
        <defs><pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="6" fill="#fff" fillOpacity="0.45" /></pattern></defs>
        <line className="grid" x1={10} x2={W - 10} y1={base} y2={base} />
        {bars.map((b) => {
          const bh = h(b.v)
          const y = base - bh
          // มุมบนโค้ง 4px ฐานแนบเส้นพื้น
          const d = `M${b.x},${base} V${y + 4} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 V${base} z`
          return (
            <g key={b.label}>
              {bh > 0 && <path className={b.cls} d={d} />}
              {bh > 0 && b.cls === 's2' && <path d={d} fill={`url(#${hatch})`} />}
              <text className="val" x={b.x + bw / 2} y={(bh > 0 ? y : base) - 5} textAnchor="middle" fontSize="11" fontWeight="600">{fmtBaht(b.v, { dec: false })}</text>
              <text x={b.x + bw / 2} y={base + 16} textAnchor="middle" fontSize="11">{b.label}</text>
            </g>
          )
        })}
        {committed > 0 && <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10.5">ยื่นเบิกแล้วยังไม่จ่ายอีก {fmtBaht(committed, { dec: false })} บาท</text>}
      </svg>
    </figure>
  )
}
