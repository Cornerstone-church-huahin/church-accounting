import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChurchMembers, useSettings, useVisits } from '../lib/data'
import { useRole } from '../lib/members'
import { isWorkStaffOnly } from '../lib/access'
import { distanceM, formatCoord, hasCoord, mapsLink, parseCoords, type Coord } from '../lib/geo'
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
  const st = useSettings()
  if (!useIsAdminZone()) return null
  const on = !!st.settings.visitTestMode
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
      <label className="row" style={{ gap: 10, alignItems: 'center', marginTop: 10, padding: 8, borderRadius: 10, background: on ? '#fff3cd' : '#fff', border: '1px solid #e0b100' }}>
        <input type="checkbox" style={{ width: 24, height: 24 }} checked={on} onChange={(e) => st.save({ visitTestMode: e.target.checked })} />
        <span><b>🧪 โหมดทดสอบการเยี่ยม</b><br /><small>เปิด = บันทึกเยี่ยมโดยไม่ต้องเช็คอิน/ถ่ายรูป ระบบใช้พิกัดบ้านที่มีในทะเบียนสร้างเส้นทาง · ปิด = กลับเป็นบังคับตามปกติ</small></span>
      </label>
    </section>
  )
}

const Back = ({ title }: { title: string }) => <div className="page-head page-head--tight no-print"><h1>{title}</h1><Link to="/meeting/4" className="mini">‹ งานอภิบาล</Link></div>

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${m} ม.`)
const hhmm = (at: number) => new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
const GAP_MS = 3 * 3600 * 1000 // จุดเช็คอินห่างกันเกิน 3 ชม. = คนละรอบ (กลับคริสตจักรแล้วออกใหม่)

/** ตั้งพิกัดคริสตจักร: ใช้ตำแหน่งปัจจุบัน หรือวางลิงก์/พิกัดจาก Google Maps */
function ChurchPoint() {
  const st = useSettings()
  const cur = typeof st.settings.churchLat === 'number' && typeof st.settings.churchLng === 'number' ? { lat: st.settings.churchLat, lng: st.settings.churchLng } : null
  const [txt, setTxt] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (c: Coord) => { setMsg(st.save({ churchLat: c.lat, churchLng: c.lng }) ? `บันทึกพิกัดคริสตจักรแล้ว ${formatCoord(c)}` : 'บันทึกไม่ได้ (ต้องเป็นแอดมิน)') }
  const here = () => {
    if (!navigator.geolocation) return setMsg('เครื่องนี้ไม่รองรับการหาตำแหน่ง')
    setBusy(true)
    navigator.geolocation.getCurrentPosition((p) => { setBusy(false); set({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }) }, () => { setBusy(false); setMsg('หาตำแหน่งไม่ได้ — เปิด GPS แล้วลองใหม่') }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }
  const paste = () => { const c = parseCoords(txt); if (!c) return setMsg('อ่านพิกัดไม่ได้ — วางลิงก์ Google Maps หรือพิมพ์ เช่น 12.5684, 99.9577'); set(c); setTxt('') }
  return (
    <div className="field" style={{ border: '1px solid #ddd', borderRadius: 12, padding: 10 }}>
      <b>⛪ พิกัดคริสตจักร (จุดเริ่มต้น–กลับของทุกรอบ)</b>
      <p className="small" style={{ margin: '4px 0' }}>{cur ? <>ตั้งไว้แล้ว: {formatCoord(cur)} · <a href={mapsLink(cur)} target="_blank" rel="noreferrer">ดูแผนที่</a></> : 'ยังไม่ได้ตั้ง — ตั้งก่อนจึงวัดระยะไป-กลับได้'}</p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--gold" disabled={busy} onClick={here}>{busy ? 'กำลังหาตำแหน่ง…' : '📍 ใช้ตำแหน่งที่ยืนอยู่ตอนนี้ (ต้องอยู่ที่คริสตจักร)'}</button>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <input className="input grow" aria-label="วางลิงก์หรือพิกัดคริสตจักร" placeholder="หรือวางลิงก์ Google Maps / พิกัด 12.5684, 99.9577" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button type="button" className="btn" onClick={paste}>บันทึก</button>
      </div>
      {msg && <span className="muted small" role="status">{msg}</span>}
    </div>
  )
}

/** รายงานเส้นทาง: คริสตจักร → จุดที่ 1 → … → กลับคริสตจักร (แยกเป็นรอบ) พร้อมระยะไป-กลับ */
export function VisitRoute() {
  const ok = useIsAdminZone()
  const visits = useVisits(true)
  const st = useSettings()
  const church: Coord | null = typeof st.settings.churchLat === 'number' && typeof st.settings.churchLng === 'number' ? { lat: st.settings.churchLat, lng: st.settings.churchLng } : null
  const [date, setDate] = useState(todayISO())
  const trips = useMemo(() => {
    const byAt = new Map<number, { at: number; lat: number; lng: number; kind?: 'home' | 'work'; sim?: boolean; names: string[] }>()
    for (const v of visits.list) {
      if (v.date !== date || !v.checkin) continue
      const s = byAt.get(v.checkin.at) ?? { at: v.checkin.at, lat: v.checkin.lat, lng: v.checkin.lng, kind: v.checkin.kind, sim: v.checkin.sim, names: [] }
      s.names.push(v.memberName.replace(/^place:/, ''))
      byAt.set(v.checkin.at, s)
    }
    const stops = [...byAt.values()].sort((a, b) => a.at - b.at)
    const out: (typeof stops)[] = []
    for (const s of stops) { const last = out[out.length - 1]; if (last && s.at - last[last.length - 1].at <= GAP_MS) last.push(s); else out.push([s]) }
    return out
  }, [visits.list, date])
  if (!ok) return <p className="empty">เฉพาะแอดมิน</p>
  const calc = (stops: { lat: number; lng: number }[]) => {
    const pts = church ? [church, ...stops, church] : stops
    const legs = pts.slice(1).map((p, i) => distanceM(pts[i], p))
    return { legs, total: legs.reduce((a, b) => a + b, 0) }
  }
  const all = trips.flat()
  const grand = trips.reduce((a, t) => a + calc(t).total, 0)
  return (
    <>
      <Back title="🧭 รายงานเส้นทาง" />
      <ChurchPoint />
      <div className="field"><label htmlFor="rt-date">วันที่</label><input id="rt-date" type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
      {trips.length === 0 ? <p className="empty">วันที่ {fmtDate(date)} ไม่มีการเช็คอิน</p> : (
        <>
          <p><b>{trips.length} รอบ · {all.length} จุด</b> · ระยะรวม{church ? 'ไป-กลับ' : ' (ยังไม่นับคริสตจักร)'} <b>{km(grand)}</b> <small className="muted">(เส้นตรงระหว่างจุด ไม่ใช่ระยะถนนจริง)</small></p>
          <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={[...(church ? [{ id: 'church', lat: church.lat, lng: church.lng, label: '⛪ คริสตจักร', sub: 'จุดเริ่มต้น/กลับ' }] : []), ...trips.flatMap((t, ti) => t.map((s, i) => ({ id: String(s.at), lat: s.lat, lng: s.lng, label: `รอบ ${ti + 1} · ${i + 1}. ${s.names.join(', ')}`, sub: hhmm(s.at) })))]} height={300} label="เส้นทางการเยี่ยม" /></Suspense>
          {trips.map((t, ti) => {
            const { legs, total } = calc(t)
            const off = church ? 0 : 1
            return (
              <section key={t[0].at} style={{ marginTop: 10, border: '1px solid #ddd', borderRadius: 12, padding: 10 }}>
                <b>รอบที่ {ti + 1}</b> · {hhmm(t[0].at)} – {hhmm(t[t.length - 1].at)} · <b>{km(total)}</b>{church ? ' (ไป-กลับ)' : ''}
                <ol style={{ margin: '6px 0 0', paddingLeft: '1.3rem' }}>
                  {church && <li>⛪ คริสตจักร (ออกเดินทาง)</li>}
                  {t.map((s, i) => (
                    <li key={s.at} style={{ marginBottom: 4 }}>
                      <b>{s.names.join(', ')}</b> · {s.kind === 'work' ? '🏢 ที่ทำงาน' : '🏠 ที่บ้าน'}{s.sim ? ' 🧪จำลอง' : ''} · {hhmm(s.at)}
                      {legs[i - off] != null && i - off >= 0 && <small className="muted"> · +{km(legs[i - off])}</small>}
                      {' '}<a className="mini" href={mapsLink(s)} target="_blank" rel="noreferrer">แผนที่</a>
                    </li>))}
                  {church && <li>⛪ กลับคริสตจักร <small className="muted">· +{km(legs[legs.length - 1])}</small></li>}
                </ol>
              </section>
            )
          })}
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
