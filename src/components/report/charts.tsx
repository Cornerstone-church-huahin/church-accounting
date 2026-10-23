import { fmtBaht, fmtShort } from '../../lib/money'

export const money = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })
export const TONE = { in: '#1b7f4b', out: '#c4552b', bal: '#1f3f8f' } as const
export type Tone = keyof typeof TONE

/** แท่งแนวนอน: ชื่ออยู่ซ้าย ยอดอยู่ปลายแท่ง · แตะแท่งเพื่อเจาะรายการ (onPick) · ยอด 0 แสดง 0 โดยไม่มีแท่ง */
export function HBars({ bars, tone, title, onPick, active }: { bars: { key: string; label: string; amount: number | null }[]; tone: Tone; title: string; onPick?: (key: string) => void; active?: string | null }) {
  if (bars.length === 0) return <p className="empty">ยังไม่มีข้อมูล</p>
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.amount ?? 0)))
  return (
    <ul className="hbars" aria-label={title}>
      {bars.map((b) => {
        const w = b.amount ? Math.max(2, (Math.abs(b.amount) / max) * 100) : 0
        const inner = (<>
          <span className="hbars__l">{b.label}</span>
          <span className="hbars__t"><span className="hbars__b" style={{ width: `${w}%`, background: TONE[tone] }} /></span>
          <span className="hbars__v" style={{ color: TONE[tone] }}>{b.amount === null ? 'ข้อมูลยังไม่ครบ' : money(b.amount)}</span>
        </>)
        return <li key={b.key}>{onPick ? <button type="button" className={`hbars__r${active === b.key ? ' on' : ''}`} aria-pressed={active === b.key} aria-label={`${b.label} ${b.amount === null ? 'ข้อมูลยังไม่ครบ' : money(b.amount)} บาท ดูรายการ`} onClick={() => onPick(b.key)}>{inner}</button> : <div className="hbars__r">{inner}</div>}</li>
      })}
    </ul>
  )
}

export interface GroupItem { key: string; label: string; a: number; b: number; note?: string }
/** แท่งคู่แนวตั้ง (รับ–จ่าย) ต่อช่วง · แตะช่วงเพื่อเจาะรายการ */
export function GroupBars({ items, title, onPick, active }: { items: GroupItem[]; title: string; onPick?: (key: string) => void; active?: string | null }) {
  const W = 340, H = 190, top = 18, bot = 34, bw = Math.min(26, (W / items.length - 14) / 2)
  const max = Math.max(1, ...items.flatMap((i) => [i.a, i.b]))
  const y = (v: number) => top + (1 - v / max) * (H - top - bot)
  const step = W / items.length
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <div className="legend" style={{ marginBottom: 4 }}><span><i style={{ background: TONE.in }} />รายรับ</span><span><i style={{ background: TONE.out }} />เงินจ่ายออก</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title}>
        <line className="grid" x1={0} x2={W} y1={H - bot} y2={H - bot} />
        {items.map((it, i) => {
          const cx = step * i + step / 2
          return (
            <g key={it.key} aria-label={`${it.label} รับ ${money(it.a)} จ่าย ${money(it.b)} บาท`} {...(onPick ? { role: 'button', tabIndex: 0, 'aria-pressed': active === it.key, style: { cursor: 'pointer' }, onClick: () => onPick(it.key), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(it.key) } } } : { role: 'img' })}>
              <rect x={cx - step / 2 + 2} y={0} width={step - 4} height={H} fill={active === it.key ? 'rgba(31,63,143,.10)' : 'transparent'} rx={6} />
              <rect x={cx - bw - 1} y={y(it.a)} width={bw} height={Math.max(0, H - bot - y(it.a))} fill={TONE.in} rx={3} />
              <rect x={cx + 1} y={y(it.b)} width={bw} height={Math.max(0, H - bot - y(it.b))} fill={TONE.out} rx={3} />
              {it.a > 0 && <text x={cx - bw / 2 - 1} y={y(it.a) - 3} textAnchor="middle" fontSize="9" fill={TONE.in}>{fmtShort(it.a)}</text>}
              {it.b > 0 && <text x={cx + bw / 2 + 1} y={y(it.b) - 3} textAnchor="middle" fontSize="9" fill={TONE.out}>{fmtShort(it.b)}</text>}
              <text x={cx} y={H - bot + 13} textAnchor="middle" fontSize="9.5">{it.label}</text>
              {it.note && <text x={cx} y={H - bot + 25} textAnchor="middle" fontSize="8.5" fill="#8a6d00">{it.note}</text>}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export interface LinePt { key: string; label: string; a: number | null; b: number | null; partial?: boolean }
/** กราฟเส้นรับ–จ่าย: จุดที่ไม่มีข้อมูลเว้นช่วง (ไม่ลากเส้นเป็นศูนย์) · มีจุดเดียวแสดงเป็นจุด · แตะจุดเพื่อเปิดเดือน */
export function Lines({ points, title, onPick }: { points: LinePt[]; title: string; onPick?: (key: string) => void }) {
  const W = 340, H = 200, left = 6, right = 6, top = 22, bot = 24
  const max = Math.max(1, ...points.flatMap((p) => [p.a ?? 0, p.b ?? 0]))
  const x = (i: number) => left + ((W - left - right) / Math.max(1, points.length - 1)) * i
  const y = (v: number) => top + (1 - v / max) * (H - top - bot)
  const path = (pick: (p: LinePt) => number | null) => {
    let d = '', pen = false
    points.forEach((p, i) => { const v = pick(p); if (v === null) { pen = false; return } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true })
    return d
  }
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <div className="legend" style={{ marginBottom: 4 }}><span><i style={{ background: TONE.in }} />รายรับ</span><span><i style={{ background: TONE.out }} />เงินจ่ายออก</span><span>○ = ข้อมูลบางส่วน</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title}>
        <line className="grid" x1={left} x2={W - right} y1={H - bot} y2={H - bot} />
        {([['a', TONE.in], ['b', TONE.out]] as const).map(([k, c]) => <path key={k} d={path((p) => p[k])} fill="none" stroke={c} strokeWidth="2.2" strokeLinejoin="round" />)}
        {points.map((p, i) => (
          <g key={p.key} aria-label={`${p.label}${p.a === null ? ' ยังไม่มีข้อมูล' : ` รับ ${money(p.a)} จ่าย ${money(p.b ?? 0)} บาท${p.partial ? ' ข้อมูลบางส่วน' : ''}`}`} {...(onPick ? { role: 'button', tabIndex: 0, style: { cursor: p.a === null ? 'default' : 'pointer' }, onClick: () => p.a !== null && onPick(p.key), onKeyDown: (e: React.KeyboardEvent) => { if (p.a !== null && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(p.key) } } } : { role: 'img' })}>
            <rect x={x(i) - 12} y={0} width={24} height={H} fill="transparent" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill={p.a === null ? '#aaa' : undefined}>{p.label}</text>
            {p.a !== null && ([['a', TONE.in, p.a], ['b', TONE.out, p.b ?? 0]] as const).map(([k, c, v]) => <circle key={k} cx={x(i)} cy={y(v)} r={4} fill={p.partial ? '#fff' : c} stroke={c} strokeWidth="2" />)}
            {p.a !== null && points.filter((q) => q.a !== null).length === 1 && <><text x={x(i)} y={y(p.a) - 8} textAnchor="middle" fontSize="10" fill={TONE.in}>{fmtShort(p.a)}</text><text x={x(i)} y={y(p.b ?? 0) + 14} textAnchor="middle" fontSize="10" fill={TONE.out}>{fmtShort(p.b ?? 0)}</text></>}
          </g>
        ))}
      </svg>
    </figure>
  )
}
