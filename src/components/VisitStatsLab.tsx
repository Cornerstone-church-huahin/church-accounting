import { useVisitNs } from '../lib/labNs'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import { slotOfVisit } from './VisitTimetableLab'
import { useActivityLog, useSettings, useVisitPlans, useVisits } from '../lib/data'
import { be, monthName, todayISO } from '../lib/money'
import { splitVisitors, tripsOf } from '../lib/visits'

const NAVY = '#14264a', GOLD = '#c99a14'
/** โทนอ่อน ประหยัดหมึก: พื้นขาว/พาสเทล ตัวอักษรเข้ม */
const SOFT = { navy: '#c9d3ea', green: '#bfe5cb', blue: '#cfe3f7', red: '#f3c9cb', teal: '#c5e6df', purple: '#ddd0ee', orange: '#fbdcae' }
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

/** แถบแนวนอน: รายชื่อ + จำนวน */
function HBars({ rows, color = '#8fcfa4', empty = 'ยังไม่มีข้อมูล' }: { rows: { name: string; sub?: string; v: number }[]; color?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  if (!rows.length) return <div style={{ color: '#777', fontSize: 15 }}>{empty}</div>
  return (
    <div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0', fontSize: 15.5 }}>
          <span style={{ width: 190, flex: 'none', overflow: 'hidden', lineHeight: 1.15 }}><span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>{r.sub && <span style={{ display: 'block', fontSize: 12.5, color: '#555' }}>{r.sub}</span>}</span>
          <span style={{ flex: 1, background: '#eef0f5', borderRadius: 6, height: 16, ...keep }}><span style={{ display: 'block', width: `${Math.max(4, (r.v / max) * 100)}%`, height: '100%', background: color, borderRadius: 6, ...keep }} /></span>
          <b style={{ width: 34, textAlign: 'right' }}>{r.v}</b>
        </div>
      ))}
    </div>
  )
}

const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ ...keep, border: '1.5px solid #d6dbe8', borderRadius: 12, padding: '8px 12px', background: '#fff', breakInside: 'avoid' }}>
    <div style={{ fontWeight: 800, color: NAVY, fontSize: 17, marginBottom: 4 }}>{title}</div>{children}
  </div>
)

/** สถิติงานเยี่ยม: รายเดือน/รายปี · ตัวเลขสำคัญ · กราฟ · อันดับผู้ออกเยี่ยม — ส่งออก PDF/แชร์รูป/พิมพ์ได้ */
export default function VisitStatsLab() {
  const ns = useVisitNs()
  const ref = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  const visits = useVisits(true, ns)
  const acts = useActivityLog(ns)
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
      top: [...visited.values()].sort((a, b) => b.v - a.v || a.name.localeCompare(b.name, 'th')).slice(0, 10),
      absentNames: [...new Set(notMet.map((v) => v.memberName))].slice(0, 12), slotCount,
    }
  }, [visits.list, acts.list, plans, prefix, mode, y, m])
  const tile = (icon: string, label: string, val: number | string, color: string) => (
    <div style={{ ...keep, flex: '1 1 0', minWidth: 0, textAlign: 'center', background: color, color: '#1a2b4c', borderRadius: 12, padding: '8px 4px', border: '1px solid #cfd6e4' }}>
      <div style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>{val}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
    </div>
  )
  return (
    <section aria-label="สถิติงานเยี่ยม">
      <div className="page-head no-print"><h1>{ns ? '🧪 ' : '🆕 '}📈 สถิติงานเยี่ยม{ns ? ' (ทดลอง)' : ''}</h1><Link to={ns ? '/meeting/4/lab/3' : '/meeting/4/new/3'} className="mini">‹ รายงาน{ns ? ' (ทดลอง)' : ''}</Link></div>
      <div className="seg seg--2 no-print" role="tablist" aria-label="ช่วงเวลา" style={{ marginBottom: 6 }}>
        <button type="button" role="tab" aria-selected={mode === 'month'} className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>รายเดือน</button>
        <button type="button" role="tab" aria-selected={mode === 'year'} className={mode === 'year' ? 'on' : ''} onClick={() => setMode('year')}>รายปี</button>
      </div>
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="ย้อนหลัง" onClick={() => shift(-1)}>‹</button>
        <span className="small"><b>{title}</b></span>
        <button type="button" className="mini" aria-label="ถัดไป" onClick={() => shift(1)}>›</button>
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
          {st.absentNames.length > 0 && <Box title="✗ ไม่พบ / ไม่อยู่บ้าน"><div style={{ fontSize: 15.5 }}>{st.absentNames.join(' · ')}</div></Box>}
          <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 12.5, color: '#666' }}>พิมพ์/สรุปเมื่อ {today.split('-').reverse().join('/')} · ข้อมูลจากบันทึกการเยี่ยมที่เช็คอินแล้ว</div>
        </div>
      </ScaledPage>
      <ScaledPage ref={ref2}>
        <div style={{ ...keep, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', color: '#111' }}>
          <div style={{ ...keep, background: '#fff', color: NAVY, borderRadius: 14, padding: '12px 18px', border: `2px solid ${GOLD}`, borderBottom: `5px solid ${GOLD}`, textAlign: 'center' }}>
            <div style={{ fontSize: 15, opacity: 0.9 }}>{church} · ✝ งานอภิบาล</div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>📈 สถิติงานและการเยี่ยมครอบครัว — รายชื่อ</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#8a6a00' }}>{mode === 'year' ? 'สรุปรายปี' : 'สรุปรายเดือน'} · {title}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}><Box title="👥 ผู้ออกเยี่ยม (ครั้ง)"><HBars rows={st.visitors.slice(0, 10)} color="#8fa6d6" /></Box></div>
            <div style={{ flex: 1, minWidth: 0 }}><Box title="⭐ ผู้ที่ได้รับการเยี่ยม"><HBars rows={st.top.slice(0, 10).map((t) => ({ name: t.name, v: t.v }))} color="#8fcfa4" /></Box></div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}><Box title="📋 ผู้ทำกิจกรรม (ครั้ง)"><HBars rows={st.doers.slice(0, 10)} color="#f0c27a" empty="ยังไม่ได้ระบุผู้ไปทำกิจกรรม" />{st.noDoer > 0 && <div style={{ fontSize: 12.5, color: '#666', marginTop: 4 }}>ยังไม่ระบุผู้ทำ {st.noDoer} กิจกรรม (แอดมินระบุได้ที่ ✎ แก้)</div>}</Box></div>
            <div style={{ flex: 1, minWidth: 0 }}><Box title="🙌 รวมผู้ปฏิบัติงาน (เยี่ยม + กิจกรรม)"><HBars rows={st.workers.slice(0, 10)} color="#b9a3dc" /></Box></div>
          </div>
          <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 12.5, color: '#666' }}>พิมพ์/สรุปเมื่อ {today.split('-').reverse().join('/')} · ข้อมูลจากบันทึกการเยี่ยมที่เช็คอินแล้ว</div>
        </div>
      </ScaledPage>
      <PdfTools compact mode="full" els={() => [ref.current, ref2.current].filter((x): x is HTMLDivElement => !!x)} file={`สถิติงานเยี่ยม-${mode === 'year' ? y : `${y}-${String(m).padStart(2, '0')}`}.pdf`} title={`สถิติงานเยี่ยม ${title}`} label="สถิติงานเยี่ยม" />
    </section>
  )
}
