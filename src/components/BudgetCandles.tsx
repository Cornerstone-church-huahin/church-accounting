import type React from 'react'
import { fmtBaht } from '../lib/money'

/**
 * แท่งสามแท่งของแต่ละงบ: ซ้าย เขียว = รายรับที่ได้รับ · กลาง = งบที่ตั้ง · ขวา แดง = รายจ่ายที่จ่ายแล้ว
 * แท่งกลางแบ่งสองสี: ส่วนล่างสีเข้ม = ใช้ไปแล้ว · ส่วนบนสีอ่อน = ยังไม่ได้ใช้
 * ความสูงเทียบกับค่าสูงสุดของสามแท่ง · ตัวเลขกำกับบนทุกแท่ง · แท่งแดงมีลายเฉียงกันสับสนกับเขียวสำหรับคนตาบอดสี
 */
export default function BudgetCandles({ title, income, budget, spent, committed = 0, compact, fund, onEdit }: { title: string; income: number; budget: number; spent: number; committed?: number; compact?: boolean; fund?: boolean; onEdit?: (bar: 'in' | 'budget' | 'out') => void }) {
  const W = 300, H = compact ? 150 : 168, base = compact ? 112 : 128, top = 22, bw = 62
  const max = Math.max(1, income, budget, spent)
  const h = (v: number) => Math.max(v > 0 ? 3 : 0, (Math.max(0, v) / max) * (base - top))
  const usedH = budget > 0 ? Math.min(h(budget), (Math.min(spent, budget) / max) * (base - top)) : 0
  const bars = [
    { x: 38, v: income, cls: 's1', label: fund ? 'เก็บได้' : 'ได้รับ', key: 'in' as const },
    { x: 119, v: budget, cls: 's3', label: fund ? 'เป้าหมาย' : 'งบที่ตั้ง', key: 'budget' as const },
    { x: 200, v: spent, cls: 's2', label: 'จ่ายแล้ว', key: 'out' as const },
  ]
  const hatch = `cd${Math.abs(Math.round(income * 3 + budget * 5 + spent * 7)) % 99991}${title.length}`
  const pct = budget > 0 ? Math.round(((fund ? income : spent) / budget) * 100) : 0
  return (
    <figure className="chart" style={{ margin: 0 }} aria-label={title}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${fund ? 'เก็บได้' : 'ได้รับ'} ${fmtBaht(income)} บาท, ${fund ? 'เป้าหมาย' : 'งบที่ตั้ง'} ${fmtBaht(budget)} บาท, จ่ายแล้ว ${fmtBaht(spent)} บาท`}>
        <defs><pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="6" fill="#fff" fillOpacity="0.45" /></pattern></defs>
        <line className="grid" x1={10} x2={W - 10} y1={base} y2={base} />
        {bars.map((b) => {
          const bh = h(b.v)
          const y = base - bh
          // มุมบนโค้ง 4px ฐานแนบเส้นพื้น
          const d = `M${b.x},${base} V${y + 4} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 V${base} z`
          return (
            <g key={b.label} {...(onEdit ? { role: 'button', tabIndex: 0, 'aria-label': `แก้ตัวเลขแท่ง ${b.label}`, style: { cursor: 'pointer' }, onClick: () => onEdit(b.key), onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onEdit(b.key) } : {})}>
              {onEdit && <rect x={b.x - 6} y={0} width={bw + 12} height={base + 24} fill="transparent" />}
              {bh > 0 && <path className={b.cls} d={d} />}
              {bh > 0 && b.cls === 's2' && <path d={d} fill={`url(#${hatch})`} />}
              {!fund && bh > 0 && b.cls === 's3' && usedH > 0 && <rect x={b.x} y={base - usedH} width={bw} height={usedH} fill="var(--ref-used)" />}
              <text className="val" x={b.x + bw / 2} y={(bh > 0 ? y : base) - 5} textAnchor="middle" fontSize="11" fontWeight="600">{fmtBaht(b.v, { dec: false })}</text>
              <text x={b.x + bw / 2} y={base + 16} textAnchor="middle" fontSize="11">{b.label}</text>
            </g>
          )
        })}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10.5">
          {onEdit ? '✎ แตะแท่งเพื่อแก้ตัวเลข · ' : ''}{fund ? (budget > 0 ? `เก็บได้ ${pct}% ของเป้าหมาย` : 'ยังไม่ได้ตั้งเป้าหมาย — แท่งกลางติดพื้น') : budget > 0 ? `ใช้ไปแล้ว ${pct}% ของงบ (ส่วนเข้มในแท่งกลาง)` : 'ยังไม่ได้ตั้งงบ — แท่งกลางติดพื้น'} · คงเหลือจริง {fmtBaht(income - spent, { dec: false })}{committed > 0 ? ` · ยื่นเบิกค้าง ${fmtBaht(committed, { dec: false })}` : ''}
        </text>
      </svg>
    </figure>
  )
}
