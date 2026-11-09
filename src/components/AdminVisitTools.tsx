import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChurchMembers, useVisits } from '../lib/data'
import { useRole } from '../lib/members'
import { isWorkStaffOnly } from '../lib/access'
import { distanceM, formatCoord, hasCoord, mapsLink } from '../lib/geo'
import { fmtDate, todayISO } from '../lib/money'

const LeafletMap = lazy(() => import('./LeafletMap'))

/** โซนแอดมิน (ทดสอบ): มองเห็นเฉพาะแอดมินเท่านั้น */
export const useIsAdminZone = () => useRole() === 'admin' && !isWorkStaffOnly()

const TOOLS = [
  { to: '/meeting/4/report', icon: '📊', label: 'รายงานการเยี่ยม' },
  { to: '/meeting/4/route', icon: '🧭', label: 'รายงานเส้นทาง' },
  { to: '/meeting/4/homes', icon: '🗺️', label: 'แผนที่บ้านสมาชิก' },
] as const

export function AdminZone() {
  if (!useIsAdminZone()) return null
  return (
    <section aria-label="โซนแอดมิน" className="no-print" style={{ marginTop: 14, border: '2px dashed #a4262c', borderRadius: 16, padding: '10px 10px 12px', background: '#fff7f7' }}>
      <b style={{ display: 'block', marginBottom: 8, color: '#a4262c' }}>🔒 โซนแอดมิน · ทดสอบระบบ (คนอื่นไม่เห็น)</b>
      <nav className="balance-tiles tiletabs" aria-label="เครื่องมือแอดมิน">
        {TOOLS.map((t, i) => (
          <Link key={t.to} to={t.to} className={`btile btile--${(['own', 'fund', 'total'] as const)[i]}`}><small aria-hidden="true">{t.icon}</small><b>{t.label}</b></Link>
        ))}
        {[4, 5, 6].map((n) => (
          <span key={n} className="btile btile--indebt" style={{ opacity: 0.45 }} aria-disabled="true"><small aria-hidden="true">➕</small><b>ช่อง {n} (ว่าง)</b></span>
        ))}
      </nav>
    </section>
  )
}

const Back = ({ title }: { title: string }) => <div className="page-head page-head--tight no-print"><h1>{title}</h1><Link to="/meeting/4" className="mini">‹ งานอภิบาล</Link></div>

/** รายงานเส้นทาง: จุดเช็คอินของวันที่เลือกเรียงตามเวลา พร้อมระยะระหว่างจุด */
export function VisitRoute() {
  const ok = useIsAdminZone()
  const visits = useVisits(true)
  const [date, setDate] = useState(todayISO())
  const stops = useMemo(() => {
    const byAt = new Map<number, { at: number; lat: number; lng: number; kind?: 'home' | 'work'; names: string[] }>()
    for (const v of visits.list) {
      if (v.date !== date || !v.checkin) continue
      const s = byAt.get(v.checkin.at) ?? { at: v.checkin.at, lat: v.checkin.lat, lng: v.checkin.lng, kind: v.checkin.kind, names: [] }
      s.names.push(v.memberName.replace(/^place:/, ''))
      byAt.set(v.checkin.at, s)
    }
    return [...byAt.values()].sort((a, b) => a.at - b.at)
  }, [visits.list, date])
  if (!ok) return <p className="empty">เฉพาะแอดมิน</p>
  let total = 0
  const rows = stops.map((s, i) => { const d = i ? distanceM(stops[i - 1], s) : 0; total += d; return { s, d } })
  const pins = stops.map((s, i) => ({ id: String(s.at), lat: s.lat, lng: s.lng, label: `${i + 1}. ${s.names.join(', ')}`, sub: new Date(s.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' }))
  return (
    <>
      <Back title="🧭 รายงานเส้นทาง" />
      <div className="field"><label htmlFor="rt-date">วันที่</label><input id="rt-date" type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
      {stops.length === 0 ? <p className="empty">วันที่ {fmtDate(date)} ไม่มีการเช็คอิน</p> : (
        <>
          <p><b>{stops.length} จุด</b> · ระยะรวมประมาณ {total >= 1000 ? `${(total / 1000).toFixed(1)} กม.` : `${total} ม.`} (เส้นตรงระหว่างจุด)</p>
          <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={pins} height={300} label="เส้นทางการเยี่ยม" /></Suspense>
          <ol style={{ paddingLeft: '1.3rem' }}>{rows.map(({ s, d }) => (
            <li key={s.at} style={{ marginBottom: 6 }}>
              <b>{s.names.join(', ')}</b> · {s.kind === 'work' ? '🏢 ที่ทำงาน' : '🏠 ที่บ้าน'} · {new Date(s.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              {d > 0 && <small className="muted"> · จากจุดก่อนหน้า {d >= 1000 ? `${(d / 1000).toFixed(1)} กม.` : `${d} ม.`}</small>}
              {' '}<a className="mini" href={mapsLink(s)} target="_blank" rel="noreferrer">แผนที่</a>
            </li>))}</ol>
        </>
      )}
    </>
  )
}

/** แผนที่บ้านของสมาชิกที่มีพิกัด */
export function MemberHomesMap() {
  const ok = useIsAdminZone()
  const people = useChurchMembers()
  const [q, setQ] = useState('')
  const withC = useMemo(() => people.items.flatMap((m) => (hasCoord(m) ? [{ id: m.id, name: m.name, lat: m.lat, lng: m.lng }] : [])), [people.items])
  const shown = useMemo(() => withC.filter((m) => !q.trim() || m.name.includes(q.trim())), [withC, q])
  if (!ok) return <p className="empty">เฉพาะแอดมิน</p>
  return (
    <>
      <Back title="🗺️ แผนที่บ้านสมาชิก" />
      <p>มีพิกัดบ้านแล้ว <b>{withC.length}</b> จาก {people.items.length} คน (พิกัดเข้าอัตโนมัติเมื่อ “เช็คอินที่บ้าน”)</p>
      <input className="input" placeholder="ค้นหาชื่อ" aria-label="ค้นหาชื่อ" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 ? <p className="empty">ไม่มีสมาชิกที่มีพิกัด</p> : (
        <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={shown.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, label: m.name, sub: formatCoord(m) }))} height={420} label="แผนที่บ้านสมาชิก" /></Suspense>
      )}
    </>
  )
}
