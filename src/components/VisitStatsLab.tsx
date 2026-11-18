import { useVisitNs } from '../lib/labNs'
import { cloneElement, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import { slotOfVisit } from './VisitTimetableLab'
import Sheet from './Sheet'
import { useRole } from '../lib/members'
import { useActivityLog, useLiveActs, useSettings, useVisitPlans, useVisits } from '../lib/data'
import { addDays, be, monthName, todayISO } from '../lib/money'
import { renameDoersIn, renameVisitorIn, splitVisitors, sundayOf, tripsOf } from '../lib/visits'
import { paginate } from '../lib/paginate'

const NAVY = '#14264a', GOLD = '#c99a14'
/** โทนอ่อน ประหยัดหมึก: พื้นขาว/พาสเทล ตัวอักษรเข้ม */
const SOFT = { navy: '#c9d3ea', green: '#bfe5cb', blue: '#cfe3f7', red: '#f3c9cb', teal: '#c5e6df', purple: '#ddd0ee', orange: '#fbdcae' }
/** สีประจำรายงานทั้ง 3: ผู้ออกเยี่ยม = น้ำเงิน · ผู้รับการเยี่ยม = เขียว · ผู้ร่วมกิจกรรม = ส้ม (ใช้ตั้งแต่หัวแผ่น แถบหัวข้อ แถบกราฟ ไปจนถึงเส้นกราฟแนวโน้ม) */
const TONE = {
  visitors: { main: '#2557b8', soft: '#e6eefc', mid: '#7f9fe0', label: 'ผู้ออกเยี่ยม' },
  visited: { main: '#23814a', soft: '#e3f4ea', mid: '#7cc496', label: 'ผู้รับการเยี่ยม' },
  doers: { main: '#d9660a', soft: '#fdecd8', mid: '#f0a766', label: 'ผู้ร่วมกิจกรรม' },
} as const
type Tone = (typeof TONE)[keyof typeof TONE]
const keep: React.CSSProperties = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties
const SLOT_COL: Record<string, string> = { เช้า: '#fde9b8', บ่าย: '#d6e8f8', ค่ำ: '#e4d9f1' }

/** แผ่นแท่งแนวตั้ง (SVG) */
function Bars({ data, color = '#8fa6d6', height = 105 }: { data: { label: string; v: number }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  const W = 700, bw = W / data.length
  return (
    <svg viewBox={`0 0 ${W} ${height + 30}`} width="100%" role="img" aria-label="กราฟแท่ง" style={{ display: 'block' }}>
      {data.map((d, i) => {
        const h = Math.round((d.v / max) * height)
        return (
          <g key={i}>
            <rect x={i * bw + bw * 0.12} y={height - h + 14} width={bw * 0.76} height={h} rx={3} fill={d.v ? color : '#e3e7ef'} />
            {d.v > 0 && <text x={i * bw + bw / 2} y={height - h + 10} textAnchor="middle" fontSize={bw > 40 ? 15 : 11} fontWeight={700} fill="#222">{d.v}</text>}
            <text x={i * bw + bw / 2} y={height + 28} textAnchor="middle" fontSize={bw > 40 ? 14 : 10.5} fill="#555">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** กราฟเส้นหลายชุด (SVG): แกนนอน = ช่วงเวลา แกนตั้ง = จำนวน พร้อมตัวเลขบนจุด */
function Lines({ labels, series, height = 150 }: { labels: string[]; series: { name: string; color: string; values: number[] }[]; height?: number }) {
  const W = 700, padL = 28, padR = 14, padT = 18, padB = 30
  const max = Math.max(1, ...series.flatMap((x) => x.values))
  const step = labels.length > 1 ? (W - padL - padR) / (labels.length - 1) : 0
  const X = (i: number) => padL + (labels.length > 1 ? i * step : (W - padL - padR) / 2)
  const Y = (v: number) => padT + (1 - v / max) * height
  const ticks = [0, Math.ceil(max / 2), max].filter((t, i, a) => a.indexOf(t) === i)
  const dense = labels.length > 14
  return (
    <svg viewBox={`0 0 ${W} ${height + padT + padB}`} width="100%" role="img" aria-label="กราฟเส้นแนวโน้ม" style={{ display: 'block' }}>
      {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke="#e3e7ef" strokeDasharray="4 4" /><text x={padL - 6} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="#777">{t}</text></g>)}
      {labels.map((l, i) => <text key={i} x={X(i)} y={height + padT + 20} textAnchor="middle" fontSize={dense ? 9.5 : 12} fill="#555">{l}</text>)}
      {series.map((sr) => (
        <g key={sr.name}>
          <polyline points={sr.values.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={sr.color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {sr.values.map((v, i) => <g key={i}><circle cx={X(i)} cy={Y(v)} r={4} fill="#fff" stroke={sr.color} strokeWidth={2.5} />{!dense || v === max ? <text x={X(i)} y={Y(v) - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={sr.color}>{v}</text> : null}</g>)}
        </g>))}
    </svg>
  )
}

/** แถบแนวนอน: รายชื่อ + จำนวน */
function HBars({ rows, color = '#8fcfa4', track = '#eef0f5', empty = 'ยังไม่มีข้อมูล', warnOver }: { track?: string; rows: { name: string; sub?: string; v: number }[]; color?: string; empty?: string; /** แถวที่จำนวนมากกว่าค่านี้ใช้สีส้มเตือน (เช่น เยี่ยมซ้ำ) */ warnOver?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  if (!rows.length) return <div style={{ color: '#777', fontSize: 15 }}>{empty}</div>
  return (
    <div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0', fontSize: 15.5 }}>
          <span style={{ width: 190, flex: 'none', overflow: 'hidden', lineHeight: 1.15 }}><span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>{r.sub && <span style={{ display: 'block', fontSize: 12.5, color: '#555' }}>{r.sub}</span>}</span>
          <span style={{ flex: 1, background: track, borderRadius: 6, height: 16, ...keep }}><span style={{ display: 'block', width: `${Math.max(4, (r.v / max) * 100)}%`, height: '100%', background: warnOver != null && r.v > warnOver ? '#f0a35a' : color, borderRadius: 6, ...keep }} /></span>
          <b style={{ width: 34, textAlign: 'right' }}>{r.v}</b>
        </div>
      ))}
    </div>
  )
}

/** แบ่งรายการเป็น 2 คอลัมน์ (เรียงลงตามลำดับ) */
function TwoCol({ children }: { children: React.ReactElement<{ rows: { name: string; sub?: string; v: number }[] }> }) {
  const rows = children.props.rows
  const half = Math.ceil(rows.length / 2)
  return <div style={{ display: 'flex', gap: 14 }}>{[rows.slice(0, half), rows.slice(half)].map((r, i) => <div key={i} style={{ flex: 1, minWidth: 0 }}>{r.length > 0 && cloneElement(children, { rows: r })}</div>)}</div>
}

const Box = ({ title, children, tone }: { title: string; children: React.ReactNode; tone?: Tone }) => tone ? (
  <div style={{ ...keep, border: `2.5px solid ${tone.main}`, borderRadius: 12, overflow: 'hidden', background: tone.soft, breakInside: 'avoid' }}>
    <div style={{ ...keep, fontWeight: 800, color: '#fff', background: tone.main, fontSize: 18, padding: '6px 12px' }}>{title}</div>
    <div style={{ padding: '8px 12px' }}>{children}</div>
  </div>
) : (
  <div style={{ ...keep, border: '1.5px solid #d6dbe8', borderRadius: 12, padding: '8px 12px', background: '#fff', breakInside: 'avoid' }}>
    <div style={{ fontWeight: 800, color: NAVY, fontSize: 17, marginBottom: 4 }}>{title}</div>{children}
  </div>
)

/** สถิติงานเยี่ยม: รายเดือน/รายปี · ตัวเลขสำคัญ · กราฟ · อันดับผู้ออกเยี่ยม — ส่งออก PDF/แชร์รูป/พิมพ์ได้ */
export default function VisitStatsLab() {
  const ns = useVisitNs()
  const ref = useRef<HTMLDivElement>(null)
  const extra = useRef<(HTMLDivElement | null)[]>([])
  const visits = useVisits(true, ns)
  const acts = useLiveActs(ns)
  const plans = useVisitPlans(ns)
  const church = useSettings().settings.churchName || 'คริสตจักรศิลาเอก'
  const today = todayISO()
  const [mode, setMode] = useState<'month' | 'year'>('month')
  const [y, setY] = useState(Number(today.slice(0, 4)))
  const [m, setM] = useState(Number(today.slice(5, 7)))
  const shift = (n: number) => {
    if (mode === 'year') return setY((v) => v + n)
    const t = y * 12 + (m - 1) + n
    setY(Math.floor(t / 12)); setM((t % 12) + 1)
  }
  const isAdmin = useRole() === 'admin'
  const [mergeOpen, setMergeOpen] = useState(false)
  const [trend, setTrend] = useState<'week' | 'month' | 'year'>('week') // กราฟเส้น: 12 สัปดาห์ · 12 เดือน · 5 ปี
  const prefix = mode === 'year' ? `${y}-` : `${y}-${String(m).padStart(2, '0')}-`
  const title = mode === 'year' ? `ปี ${be(y)}` : `${monthName(m)} ${be(y)}`
  const st = useMemo(() => {
    const vs = visits.list.filter((v) => v.date.startsWith(prefix))
    const real = vs.filter((v) => !v.memberId.startsWith('place:'))
    const met = real.filter((v) => !v.absent)
    const notMet = real.filter((v) => v.absent)
    const trips = tripsOf(vs).length
    const days = new Set(vs.map((v) => v.date))
    const people = new Set(met.map((v) => v.memberId))
    const visitorCount = new Map<string, number>()
    for (const v of vs) for (const n of splitVisitors(v.visitor ?? '')) visitorCount.set(n, (visitorCount.get(n) ?? 0) + 1)
    const visited = new Map<string, { name: string; v: number }>()
    for (const v of met) { const e = visited.get(v.memberId) ?? { name: v.memberName, v: 0 }; e.v++; visited.set(v.memberId, e) }
    const slotCount: Record<string, number> = { เช้า: 0, บ่าย: 0, ค่ำ: 0 }
    for (const v of vs) slotCount[slotOfVisit(v, plans.of(v.date))]++
    const bars = mode === 'year'
      ? Array.from({ length: 12 }, (_, i) => ({ label: monthName(i + 1).slice(0, 3), v: vs.filter((v) => Number(v.date.slice(5, 7)) === i + 1).length }))
      : Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => ({ label: String(i + 1), v: vs.filter((v) => Number(v.date.slice(8, 10)) === i + 1).length }))
    const actsIn = acts.list.filter((a) => a.date.startsWith(prefix))
    const actDone = actsIn.length
    const doerCount = new Map<string, number>()
    // นับเฉพาะผู้ไปทำกิจกรรมที่ระบุชื่อไว้ — ผู้ติ๊กไม่นับ (การติ๊กเป็นแค่การยืนยันว่าทำแล้ว)
    for (const a of actsIn) for (const n of a.doers ?? []) doerCount.set(n, (doerCount.get(n) ?? 0) + 1)
    const noDoer = actsIn.filter((a) => !a.doers?.length).length
    const doers = [...doerCount].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v || a.name.localeCompare(b.name, 'th'))
    // รวมผู้ปฏิบัติงาน: เยี่ยม + กิจกรรม ต่อคน
    const allWork = new Map<string, { visit: number; act: number }>()
    for (const [n, v] of visitorCount) allWork.set(n, { visit: v, act: 0 })
    for (const [n, v] of doerCount) allWork.set(n, { visit: allWork.get(n)?.visit ?? 0, act: v })
    const workers = [...allWork].map(([name, e]) => ({ name, sub: `เยี่ยม ${e.visit} · กิจกรรม ${e.act}`, v: e.visit + e.act })).sort((a, b) => b.v - a.v || a.name.localeCompare(b.name, 'th'))
    return {
      doers, workers, noDoer, total: vs.length, trips, days: days.size, people: people.size, met: met.length, notMet: notMet.length, actDone, bars,
      visitors: [...visitorCount].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v || a.name.localeCompare(b.name, 'th')),
      top: [...visited.values()].sort((a, b) => b.v - a.v || a.name.localeCompare(b.name, 'th')),
      absentNames: [...new Set(notMet.map((v) => v.memberName))].slice(0, 12), slotCount,
    }
  }, [visits.list, acts.list, plans, prefix, mode, y, m])
  /** กราฟเส้นแนวโน้ม: การเยี่ยม (บันทึก) กับกิจกรรมที่ทำแล้ว ตามช่วงที่เลือก (สิ้นสุดที่เดือน/ปีที่ดูอยู่ ไม่เกินวันนี้) */
  const trendData = useMemo(() => {
    const endDay = mode === 'year' ? `${y}-12-31` : `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    const end = endDay > today ? today : endDay
    const vdates = visits.list.flatMap((v) => splitVisitors(v.visitor ?? '').map(() => v.date)) // ผู้ออกเยี่ยม (นับต่อคน ตรงกับแผ่นที่ 1)
    const rdates = visits.list.filter((v) => !v.memberId.startsWith('place:') && !v.absent).map((v) => v.date) // ผู้รับการเยี่ยม (พบตัว ตรงกับแผ่นที่ 2)
    const adates = acts.list.flatMap((a) => (a.doers ?? []).map(() => a.date)) // ผู้ร่วมกิจกรรม (นับต่อคน ตรงกับแผ่นที่ 3)
    const cnt = (ds: string[], a: string, b: string) => ds.filter((d) => d >= a && d <= b).length
    const labels: string[] = [], v: number[] = [], a: number[] = [], r: number[] = []
    if (trend === 'week') {
      const mon = addDays(sundayOf(addDays(end, -1)), 1) // วันจันทร์ของสัปดาห์ที่มีวันสิ้นสุด
      for (let i = 11; i >= 0; i--) { const s0 = addDays(mon, -7 * i), e0 = addDays(s0, 6); labels.push(`${Number(s0.slice(8))}/${s0.slice(5, 7)}`); v.push(cnt(vdates, s0, e0)); r.push(cnt(rdates, s0, e0)); a.push(cnt(adates, s0, e0)) }
    } else if (trend === 'month') {
      const ey = Number(end.slice(0, 4)), em = Number(end.slice(5, 7))
      for (let i = 11; i >= 0; i--) { const t = ey * 12 + (em - 1) - i, yy = Math.floor(t / 12), mm = (t % 12) + 1, pre = `${yy}-${String(mm).padStart(2, '0')}-`; labels.push(`${monthName(mm).slice(0, 3)}${i === 11 || mm === 1 ? ` ${String(be(yy)).slice(2)}` : ''}`); v.push(vdates.filter((d) => d.startsWith(pre)).length); r.push(rdates.filter((d) => d.startsWith(pre)).length); a.push(adates.filter((d) => d.startsWith(pre)).length) }
    } else {
      const ey = Number(end.slice(0, 4))
      for (let i = 4; i >= 0; i--) { const yy = ey - i; labels.push(String(be(yy))); v.push(vdates.filter((d) => d.startsWith(`${yy}-`)).length); r.push(rdates.filter((d) => d.startsWith(`${yy}-`)).length); a.push(adates.filter((d) => d.startsWith(`${yy}-`)).length) }
    }
    return { labels, series: [{ name: TONE.visitors.label, color: TONE.visitors.main, values: v }, { name: TONE.visited.label, color: TONE.visited.main, values: r }, { name: TONE.doers.label, color: TONE.doers.main, values: a }] }
  }, [visits.list, acts.list, trend, mode, y, m, today])
  /** แผ่นรายชื่อครบทุกคน 3 ชุด: ผู้ออกเยี่ยม · ผู้รับการเยี่ยม · ผู้ร่วมกิจกรรม (แต่ละชุดหน้าละ 56 · เกินก็ต่อหน้าถัดไปเอง) */
  const pages = useMemo(() => [
    ...paginate(st.visitors, 56).map((rows, i) => ({ kind: 'visitors' as const, n: i + 1, rows })),
    ...paginate(st.top.map((t) => ({ name: t.name, v: t.v })), 56).map((rows, i) => ({ kind: 'visited' as const, n: i + 1, rows })),
    ...paginate(st.doers, 56).map((rows, i) => ({ kind: 'doers' as const, n: i + 1, rows })),
  ], [st.visitors, st.top, st.doers])
  const tile = (icon: string, label: string, val: number | string, color: string) => (
    <div style={{ ...keep, flex: '1 1 0', minWidth: 0, textAlign: 'center', background: color, color: '#1a2b4c', borderRadius: 12, padding: '8px 4px', border: '1px solid #cfd6e4' }}>
      <div style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>{val}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
    </div>
  )
  return (
    <section aria-label="สถิติงานเยี่ยม">
      <div className="page-head no-print"><h1>{ns ? '🧪 ' : '🆕 '}📈 สถิติงานเยี่ยม{ns ? ' (ทดลอง)' : ''}</h1><Link to={ns ? '/meeting/4/lab/3' : '/meeting/4/3/3'} className="mini">‹ รายงาน{ns ? ' (ทดลอง)' : ''}</Link></div>
      <div className="seg seg--2 no-print" role="tablist" aria-label="ช่วงเวลา" style={{ marginBottom: 6 }}>
        <button type="button" role="tab" aria-selected={mode === 'month'} className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>รายเดือน</button>
        <button type="button" role="tab" aria-selected={mode === 'year'} className={mode === 'year' ? 'on' : ''} onClick={() => setMode('year')}>รายปี</button>
      </div>
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="ย้อนหลัง" onClick={() => shift(-1)}>‹</button>
        <span className="small"><b>{title}</b></span>
        <button type="button" className="mini" aria-label="ถัดไป" onClick={() => shift(1)}>›</button>
      </div>
      {isAdmin && <button type="button" className="btn btn--block no-print" style={{ marginBottom: 6 }} onClick={() => setMergeOpen(true)}>✎ แก้/รวมชื่อย้อนหลัง (ชื่อซ้ำคนเดียวกัน)</button>}
      {mergeOpen && <MergeNames onClose={() => setMergeOpen(false)} />}
      <div className="seg seg--3 no-print" role="tablist" aria-label="กราฟเส้นแนวโน้ม" style={{ marginBottom: 6 }}>
        {([['week', '📈 กราฟ 12 สัปดาห์'], ['month', '12 เดือน'], ['year', '5 ปี']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={trend === k} className={trend === k ? 'on' : ''} onClick={() => setTrend(k)}>{l}</button>)}
      </div>
      <ScaledPage ref={ref}>
        <div style={{ ...keep, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', color: '#111' }}>
          <div style={{ ...keep, background: '#fff', color: NAVY, borderRadius: 14, padding: '12px 18px', border: `2px solid ${GOLD}`, borderBottom: `5px solid ${GOLD}`, textAlign: 'center' }}>
            <div style={{ fontSize: 15, opacity: 0.9 }}>{church} · ✝ งานอภิบาล</div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>📈 สถิติงานและการเยี่ยมครอบครัว</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#8a6a00' }}>{mode === 'year' ? 'สรุปรายปี' : 'สรุปรายเดือน'} · {title}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {tile('🚗', 'ออกเยี่ยม (ครั้ง)', st.trips, SOFT.navy)}
            {tile('🏠', 'เยี่ยมแล้ว (ราย)', st.people, SOFT.green)}
            {tile('📍', 'บันทึกเช็คอิน', st.total, SOFT.blue)}
            {tile('✗', 'ไม่พบ (ครั้ง)', st.notMet, SOFT.red)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {tile('📅', 'วันที่ออกเยี่ยม', st.days, SOFT.teal)}
            {tile('👥', 'ผู้ออกเยี่ยม (คน)', st.visitors.length, SOFT.purple)}
            {tile('📋', 'กิจกรรมที่ทำแล้ว', st.actDone, SOFT.orange)}
          </div>
          <Box title={mode === 'year' ? '📊 จำนวนบันทึกเยี่ยมรายเดือน' : '📊 จำนวนบันทึกเยี่ยมรายวัน'}><Bars data={st.bars} height={150} /></Box>
          <Box title="🕘 แยกตามช่วงเวลา">
            <div style={{ display: 'flex', gap: 8 }}>{(['เช้า', 'บ่าย', 'ค่ำ'] as const).map((k) => (
              <div key={k} style={{ ...keep, flex: 1, textAlign: 'center', borderRadius: 10, padding: '6px 0', background: SLOT_COL[k], color: '#1a2b4c', fontWeight: 700, border: '1px solid #cfd6e4' }}><div style={{ fontSize: 15 }}>ภาค{k}</div><div style={{ fontSize: 28, fontWeight: 800 }}>{st.slotCount[k]}</div></div>
            ))}</div>
          </Box>
          <Box title={`📈 แนวโน้ม${trend === 'week' ? ' 12 สัปดาห์ล่าสุด' : trend === 'month' ? ' 12 เดือน' : ' 5 ปี'}`}>
            <Lines labels={trendData.labels} series={trendData.series} height={125} />
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 13.5, marginTop: 2 }}>{trendData.series.map((x) => <span key={x.name}><b style={{ color: x.color }}>●</b> {x.name} (รวม {x.values.reduce((p, q) => p + q, 0)})</span>)}</div>
          </Box>
          {st.absentNames.length > 0 && <Box title="✗ ไม่พบ / ไม่อยู่บ้าน"><div style={{ fontSize: 15.5 }}>{st.absentNames.join(' · ')}</div></Box>}
          <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 12.5, color: '#666' }}>พิมพ์/สรุปเมื่อ {today.split('-').reverse().join('/')} · ข้อมูลจากบันทึกการเยี่ยมที่เช็คอินแล้ว</div>
        </div>
      </ScaledPage>
      {pages.map((pg, pi) => (
        <ScaledPage key={`${pg.kind}-${pi}`} ref={(el) => { extra.current[pi] = el }}>
          <div style={{ ...keep, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', color: '#111' }}>
          <div style={{ ...keep, background: TONE[pg.kind].main, color: '#fff', borderRadius: 14, padding: '12px 18px', border: `2px solid ${TONE[pg.kind].main}`, borderBottom: `6px solid ${TONE[pg.kind].mid}`, textAlign: 'center' }}>
            <div style={{ fontSize: 15, opacity: 0.95 }}>{church} · ✝ งานอภิบาล</div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>📈 {pg.kind === 'visitors' ? 'ผู้ออกเยี่ยม — รายชื่อครบทุกคน' : pg.kind === 'doers' ? 'ผู้ร่วมกิจกรรม — รายชื่อครบทุกคน' : 'ผู้ที่ได้รับการเยี่ยม — รายชื่อครบทุกคน'}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{mode === 'year' ? 'สรุปรายปี' : 'สรุปรายเดือน'} · {title}</div>
          </div>
            {pg.kind === 'visitors'
              ? <Box tone={TONE.visitors} title={`🚗 ผู้ออกเยี่ยม · ${st.visitors.length} คน${pages.filter((x) => x.kind === 'visitors').length > 1 ? ` · หน้า ${pg.n}/${pages.filter((x) => x.kind === 'visitors').length}` : ''}`}><TwoCol><HBars rows={pg.rows} color={TONE.visitors.mid} track="#fff" /></TwoCol><div style={{ fontSize: 12.5, color: '#666', marginTop: 4 }}>ตัวเลข = จำนวนครั้งที่ออกเยี่ยม</div></Box>
              : pg.kind === 'doers'
              ? <Box tone={TONE.doers} title={`🙌 ผู้ร่วมกิจกรรม · ${st.doers.length} คน${pages.filter((x) => x.kind === 'doers').length > 1 ? ` · หน้า ${pg.n}/${pages.filter((x) => x.kind === 'doers').length}` : ''}`}><TwoCol><HBars rows={pg.rows} color={TONE.doers.mid} track="#fff" /></TwoCol><div style={{ fontSize: 12.5, color: '#666', marginTop: 4 }}>ตัวเลข = จำนวนครั้งที่ไปทำกิจกรรม{st.noDoer > 0 ? ` · กิจกรรมที่ไม่ได้ระบุผู้ไปทำ ${st.noDoer} รายการ` : ''}</div></Box>
              : <Box tone={TONE.visited} title={`⭐ ผู้ที่ได้รับการเยี่ยม · ${st.top.length} ราย · เยี่ยมซ้ำ ${st.top.filter((t) => t.v > 1).length} ราย${pages.filter((x) => x.kind === 'visited').length > 1 ? ` · หน้า ${pg.n}/${pages.filter((x) => x.kind === 'visited').length}` : ''}`}><TwoCol><HBars rows={pg.rows} color={TONE.visited.mid} track="#fff" warnOver={1} /></TwoCol>
                <div style={{ fontSize: 12.5, color: '#666', marginTop: 4 }}>สีส้ม = เยี่ยมซ้ำมากกว่า 1 ครั้งในช่วงนี้ (ตรวจความซ้ำซ้อน)</div></Box>}
          <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 12.5, color: '#666' }}>พิมพ์/สรุปเมื่อ {today.split('-').reverse().join('/')} · ข้อมูลจากบันทึกการเยี่ยมที่เช็คอินแล้ว</div>
          </div>
        </ScaledPage>
      ))}
      <PdfTools compact mode="full" els={() => [ref.current, ...extra.current.slice(0, pages.length)].filter((x): x is HTMLDivElement => !!x)} file={`สถิติงานเยี่ยม-${mode === 'year' ? y : `${y}-${String(m).padStart(2, '0')}`}.pdf`} title={`สถิติงานเยี่ยม ${title}`} label="สถิติงานเยี่ยม" />
    </section>
  )
}

/** แก้/รวมชื่อย้อนหลัง: เลือกชื่อเดิม → พิมพ์หรือเลือกชื่อใหม่ → เปลี่ยนในการเยี่ยม (ผู้ออกเยี่ยม) และกิจกรรม (ผู้ไปทำ) ทั้งหมดของชุดข้อมูลนี้ */
function MergeNames({ onClose }: { onClose: () => void }) {
  const ns = useVisitNs()
  const visits = useVisits(true, ns)
  const acts = useActivityLog(ns)
  const counts = useMemo(() => {
    const m = new Map<string, { v: number; a: number }>()
    for (const v of visits.list) for (const n of splitVisitors(v.visitor ?? '')) m.set(n, { v: (m.get(n)?.v ?? 0) + 1, a: m.get(n)?.a ?? 0 })
    for (const a of acts.list) for (const n of a.doers ?? []) m.set(n, { v: m.get(n)?.v ?? 0, a: (m.get(n)?.a ?? 0) + 1 })
    return [...m].map(([name, c]) => ({ name, ...c })).sort((x, y) => x.name.localeCompare(y.name, 'th'))
  }, [visits.list, acts.list])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [msg, setMsg] = useState('')
  const go = () => {
    const nn = to.trim().replace(/,/g, ' ')
    if (!from || !nn || nn === from) return setMsg('เลือกชื่อเดิม และใส่ชื่อใหม่ที่ต่างจากเดิม')
    const vs = visits.list.filter((v) => splitVisitors(v.visitor ?? '').includes(from)), as = acts.list.filter((a) => a.doers?.includes(from))
    if (!window.confirm(`เปลี่ยน “${from}” เป็น “${nn}”\nการเยี่ยม ${vs.length} รายการ · กิจกรรม ${as.length} รายการ\nแน่ใจหรือไม่?`)) return
    if (vs.length) visits.put(vs.map((v) => ({ ...v, visitor: renameVisitorIn(v.visitor ?? '', from, nn), updated: 0 })))
    if (as.length) acts.put(as.map((a) => ({ ...a, doers: renameDoersIn(a.doers ?? [], from, nn), updated: 0 })))
    setMsg(`เปลี่ยนแล้ว: การเยี่ยม ${vs.length} · กิจกรรม ${as.length}`); setFrom(''); setTo('')
  }
  return (
    <Sheet title="✎ แก้/รวมชื่อย้อนหลัง" onClose={onClose}>
      <p className="muted small" style={{ margin: 0 }}>ใช้เมื่อคนเดียวกันมีหลายชื่อในสถิติ (เช่น “คศ.พิชิต เผ่าดี” กับ “อ.พิชิต เผ่าดี”) — เลือกชื่อเดิม แล้วใส่ชื่อที่ต้องการ ระบบเปลี่ยนในการเยี่ยมและกิจกรรมที่บันทึกไว้ทั้งหมด</p>
      <div className="field"><label htmlFor="mg-f">ชื่อเดิม (เลือก)</label>
        <select id="mg-f" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">— เลือกชื่อ —</option>
          {counts.map((c) => <option key={c.name} value={c.name}>{c.name} (เยี่ยม {c.v} · กิจกรรม {c.a})</option>)}
        </select></div>
      <div className="field"><label htmlFor="mg-t">ชื่อใหม่ (พิมพ์ หรือเลือกชื่อที่มีอยู่)</label>
        <input id="mg-t" className="input" list="mg-names" value={to} onChange={(e) => setTo(e.target.value)} placeholder="เช่น อ.พิชิต เผ่าดี" />
        <datalist id="mg-names">{counts.filter((c) => c.name !== from).map((c) => <option key={c.name} value={c.name} />)}</datalist></div>
      {msg && <p className="small" role="status" style={{ margin: 0 }}>{msg}</p>}
      <button type="button" className="btn btn--gold btn--block" onClick={go}>✓ เปลี่ยนชื่อย้อนหลัง</button>
    </Sheet>
  )
}
