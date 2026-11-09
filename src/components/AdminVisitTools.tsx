import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Sheet from './Sheet'
import MemberAvatar from './MemberAvatar'
import { useChurchMembers, useSettings, useVisits } from '../lib/data'
import { useRole } from '../lib/members'
import { isWorkStaffOnly } from '../lib/access'
import { distanceM, formatCoord, hasCoord, mapsLink, parseCoords, type Coord } from '../lib/geo'
import { addDays, be, fmtDate, monthName, todayISO } from '../lib/money'
import { DAY_NAMES, dayKind, sundayOf, weekDays } from '../lib/visits'

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

// ---- ระยะตามถนนจริง: OSRM (OpenStreetMap routing · ฟรี ไม่ต้องใช้คีย์) · ล้มเหลว/ออฟไลน์ = ใช้เส้นตรงแทน ----
interface Road { m: number; s: number; g: Coord[] }
const roadCache = new Map<string, Road>()
const keyOf = (a: Coord, b: Coord) => `${a.lat},${a.lng}>${b.lat},${b.lng}`
async function fetchRoad(a: Coord, b: Coord): Promise<Road | null> {
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)
    if (!r.ok) return null
    const j = await r.json() as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
    const x = j.routes?.[0]
    return x ? { m: Math.round(x.distance), s: Math.round(x.duration), g: x.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) } : null
  } catch { return null }
}
function useRoadLegs(pairs: [Coord, Coord][]) {
  const [, bump] = useState(0)
  const sig = pairs.map(([a, b]) => keyOf(a, b)).join('|')
  useEffect(() => {
    let dead = false
    void (async () => {
      let changed = false
      await Promise.all(pairs.map(async ([a, b]) => {
        const k = keyOf(a, b)
        if (roadCache.has(k)) return
        if (a.lat === b.lat && a.lng === b.lng) { roadCache.set(k, { m: 0, s: 0, g: [a, b] }); changed = true; return }
        const r = await fetchRoad(a, b)
        if (r) { roadCache.set(k, r); changed = true }
      }))
      if (changed && !dead) bump((n) => n + 1)
    })()
    return () => { dead = true }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  return (a: Coord, b: Coord) => roadCache.get(keyOf(a, b))
}
const baht = (n: number) => `${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
const mins = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} ชม. ${Math.round((s % 3600) / 60)} น.` : `${Math.max(1, Math.round(s / 60))} น.`)
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
  const rate = typeof st.settings.fuelPerKm === 'number' && st.settings.fuelPerKm >= 0 ? st.settings.fuelPerKm : 3.5
  const [rateTxt, setRateTxt] = useState<string | null>(null)
  // สัปดาห์: ใช้ตัวเลือกเดียวกับตารางเยี่ยม (จำสัปดาห์ร่วมกัน) · เลือกวันในสัปดาห์ด้วยปุ่มวัน
  const [anchor, setAnchorRaw] = useState(() => { try { const v = localStorage.getItem('acct.visittable.week'); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayISO() } catch { return todayISO() } })
  const setAnchor = (d: string) => { setAnchorRaw(d); try { localStorage.setItem('acct.visittable.week', d) } catch { /* ignore */ } }
  const sunday = sundayOf(anchor)
  const days = weekDays(sunday).filter((d) => dayKind(d) === 'visit')
  const shift = (n: number) => setAnchor(addDays(sunday, n * 7 + 3))
  const [pickDay, setPickDay] = useState<string | null>(null)
  const [cfg, setCfg] = useState(false)
  const checkDays = useMemo(() => new Set(visits.list.filter((v) => v.checkin && days.includes(v.date)).map((v) => v.date)), [visits.list, sunday]) // eslint-disable-line react-hooks/exhaustive-deps
  const date = pickDay && days.includes(pickDay) ? pickDay : days.includes(todayISO()) ? todayISO() : days.find((d) => checkDays.has(d)) ?? days[0]
  const range = (() => { const [ya, ma, da] = days[0].split('-').map(Number), [yb, mb, db] = days[days.length - 1].split('-').map(Number); return ya === yb && ma === mb ? `${da}-${db} ${monthName(ma)} ${be(ya)}` : `${da} ${monthName(ma)} ${be(ya)} – ${db} ${monthName(mb)} ${be(yb)}` })()
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
  const tripPts = (t: Coord[]) => (church ? [church, ...t, church] : t)
  const allPairs = trips.flatMap((t) => { const pts = tripPts(t); return pts.slice(1).map((p, i) => [pts[i], p] as [Coord, Coord]) })
  const road = useRoadLegs(allPairs)
  if (!ok) return <p className="empty">เฉพาะแอดมิน</p>
  const calc = (stops: Coord[]) => {
    const pts = tripPts(stops)
    const legs = pts.slice(1).map((p, i) => { const r = road(pts[i], p); return { m: r ? r.m : distanceM(pts[i], p), s: r?.s ?? 0, road: !!r, g: r?.g ?? [pts[i], p] } })
    return { legs, total: legs.reduce((a, b) => a + b.m, 0), secs: legs.reduce((a, b) => a + b.s, 0) }
  }
  const all = trips.flat()
  const calcs = trips.map((t) => calc(t))
  const grand = calcs.reduce((a, c) => a + c.total, 0)
  const legCount = calcs.reduce((a, c) => a + c.legs.length, 0)
  const roadCount = calcs.reduce((a, c) => a + c.legs.filter((l) => l.road).length, 0)
  const pins = [
    ...(church ? [{ id: 'church', lat: church.lat, lng: church.lng, label: '⛪ คริสตจักร', sub: 'จุดเริ่มต้น/กลับ', color: '#1f5fbf', badge: '⛪' }] : []),
    ...trips.flatMap((t, ti) => t.map((s, i) => ({ id: String(s.at), lat: s.lat, lng: s.lng, label: `${trips.length > 1 ? `รอบ ${ti + 1} · ` : ''}${i + 1}. ${s.names.join(', ')}`, sub: hhmm(s.at), color: s.kind === 'work' ? '#e67700' : '#c2255c', badge: String(i + 1) }))),
  ]
  // เส้นทาง: คริสตจักร → จุด 1 → … → กลับคริสตจักร (สีน้ำเงิน ตามถนนจริงเมื่อคำนวณได้)
  const segs = calcs.flatMap((c) => c.legs)
  const line = segs.length ? { segments: segs.map((l) => l.g), labels: segs.map((l) => ({ at: l.g[Math.floor(l.g.length / 2)], text: `${km(l.m)}${l.road ? ` · ${mins(l.s)}` : ''}` })) } : undefined
  const roadNote = legCount === 0 ? '' : roadCount === legCount ? '🛣️ ระยะตามถนนจริง' : roadCount === 0 ? '⏳ กำลังคำนวณตามถนน… (ถ้าไม่ขึ้น ใช้เส้นตรงแทนชั่วคราว)' : `⏳ คำนวณตามถนนแล้ว ${roadCount}/${legCount} ช่วง`
  return (
    <>
      <Back title="🧭 รายงานเส้นทาง" />
      <div className="weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => shift(-1)}>‹</button>
        <span className="small"><b>{range}</b></span>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => shift(1)}>›</button>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }} role="tablist" aria-label="เลือกวัน">
        {days.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={d === date} className={`mini${d === date ? ' on' : ''}`} style={d === date ? { background: '#1a2b4c', color: '#fff' } : undefined} onClick={() => setPickDay(d)}>{DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()]} {Number(d.slice(8))}{checkDays.has(d) ? ' ●' : ''}</button>
        ))}
      </div>
      <button type="button" className="btn btn--block" style={{ marginBottom: 8 }} onClick={() => setCfg(true)}>⚙️ ตั้งค่า (พิกัดคริสตจักร · ค่าน้ำมัน)</button>
      {cfg && <Sheet title="⚙️ ตั้งค่ารายงานเส้นทาง" onClose={() => setCfg(false)}>
      <ChurchPoint />
      <div className="field" style={{ border: '1px solid #ddd', borderRadius: 12, padding: 10 }}>
        <label htmlFor="rt-fuel"><b>⛽ ค่าน้ำมัน (บาทต่อ 1 กิโลเมตร)</b> — แก้ได้เมื่อราคาน้ำมันเปลี่ยน</label>
        <div className="row" style={{ gap: 6 }}>
          <input id="rt-fuel" className="input grow" inputMode="decimal" value={rateTxt ?? String(rate)} onChange={(e) => setRateTxt(e.target.value)} />
          <button type="button" className="btn btn--gold" onClick={() => { const n = Number(String(rateTxt ?? rate).replace(/,/g, '')); if (Number.isFinite(n) && n >= 0) { st.save({ fuelPerKm: n }); setRateTxt(null) } }}>บันทึก</button>
        </div>
        <span className="muted small">ตอนนี้ใช้ {rate} บาท/กม. · ประมาณการจากระยะไป-กลับ ไม่ใช่ค่าน้ำมันจริงที่จ่าย</span>
      </div>
        <button type="button" className="btn btn--block" onClick={() => setCfg(false)}>เสร็จ</button>
      </Sheet>}
      {trips.length === 0 ? <p className="empty">วันที่ {fmtDate(date)} ไม่มีการเช็คอิน</p> : (
        <>
          <p><b>{trips.length} รอบ · {all.length} จุด</b> · ระยะรวม{church ? 'ไป-กลับ' : ' (ยังไม่นับคริสตจักร)'} <b>{km(grand)}</b> · ⛽ ค่าน้ำมันประมาณ <b>{baht(grand / 1000 * rate)}</b> <small className="muted">({roadNote})</small></p>
          <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={pins} line={line} height={340} label="เส้นทางการเยี่ยม" /></Suspense>
          <p className="small" style={{ margin: '4px 0' }}><span style={{ color: '#1f5fbf', fontWeight: 700 }}>● ⛪ คริสตจักร</span> · <span style={{ color: '#c2255c', fontWeight: 700 }}>● บ้านสมาชิก/จุดเยี่ยม (เลขตามลำดับ)</span> · <span style={{ color: '#1a73e8', fontWeight: 700 }}>━ เส้นทาง</span></p>
          {trips.map((t, ti) => {
            const { legs, total } = calc(t)
            const off = church ? 0 : 1
            return (
              <section key={t[0].at} style={{ marginTop: 10, border: '1px solid #ddd', borderRadius: 12, padding: 10 }}>
                <b>รอบที่ {ti + 1}</b> · {hhmm(t[0].at)} – {hhmm(t[t.length - 1].at)} · <b>{km(total)}</b>{church ? ' (ไป-กลับ)' : ''} · ⛽ <b>{baht(total / 1000 * rate)}</b>
                <ol style={{ margin: '6px 0 0', paddingLeft: '1.3rem' }}>
                  {church && <li>⛪ คริสตจักร (ออกเดินทาง)</li>}
                  {t.map((s, i) => (
                    <li key={s.at} style={{ marginBottom: 4 }}>
                      <b>{s.names.join(', ')}</b> · {s.kind === 'work' ? '🏢 ที่ทำงาน' : '🏠 ที่บ้าน'}{s.sim ? ' 🧪จำลอง' : ''} · {hhmm(s.at)}
                      {legs[i - off] != null && i - off >= 0 && <small className="muted"> · +{km(legs[i - off].m)}{legs[i - off].road ? ` · ${mins(legs[i - off].s)}` : ''}</small>}
                      {' '}<a className="mini" href={mapsLink(s)} target="_blank" rel="noreferrer">แผนที่</a>
                    </li>))}
                  {church && <li>⛪ กลับคริสตจักร <small className="muted">· +{km(legs[legs.length - 1].m)}{legs[legs.length - 1].road ? ` · ${mins(legs[legs.length - 1].s)}` : ''}</small></li>}
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
  const [dest, setDest] = useState<{ name: string; lat: number; lng: number } | null>(null)
  const [nav, setNav] = useState<{ from: Coord; m: number; s: number; road: boolean; g: Coord[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [pop, setPop] = useState(true) // ป๊อปอัพรายชื่อที่ตรงกับคำค้น (ปิดหลังเลือกแล้ว)
  const withC = useMemo(() => people.items.flatMap((m) => (hasCoord(m) ? [{ id: m.id, name: m.name, nick: m.nick?.trim() ?? '', photo: m.photoPath, lat: m.lat, lng: m.lng }] : [])), [people.items])
  // ค้นหา: ชื่อ/ชื่อเล่น/หมายเหตุ ตรงคำค้น + "คนที่เกี่ยวข้อง" ดึงจากข้อมูลหลังบ้าน (นามสกุลเดียวกัน · ที่อยู่เดียวกัน · หมายเหตุที่กล่าวถึงกัน)
  // ไม่แสดงว่าเกี่ยวข้องอย่างไร แสดงเฉพาะรายชื่อ (ตรงคำค้นก่อน แล้วตามด้วยคนที่เกี่ยวข้อง)
  const matched = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s+/g, '')
    if (!t) return []
    const all = people.items
    const direct = all.filter((m) => `${m.name ?? ''}${m.nick ?? ''}${m.code ?? ''}${m.tel ?? ''}${m.note ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t)) // ค้นเหมือนหน้าสมาชิก (ชื่อ ชื่อเล่น รหัส เบอร์ หมายเหตุ)
    if (t.length < 3) return direct
    const sur = (n: string) => { const w = n.trim().split(/\s+/); return w.length >= 2 ? w[w.length - 1] : '' }
    const ids = new Set(direct.map((m) => m.id))
    const rel = all.filter((p) => !ids.has(p.id) && direct.some((d) => {
      const sd = sur(d.name ?? ''), sp = sur(p.name ?? '')
      const ad = d.address?.trim(), pn = p.note ?? '', dn = d.note ?? ''
      return (sd.length >= 2 && sd === sp)
        || (!!ad && ad.length > 6 && p.address?.trim() === ad)
        || (pn.length > 0 && ((d.name && pn.includes(d.name)) || (!!d.nick?.trim() && d.nick.trim().length >= 2 && pn.includes(d.nick.trim()))))
        || (dn.length > 0 && !!p.name && dn.includes(p.name))
    }))
    return [...direct, ...rel]
  }, [people.items, q])
  const shown = useMemo(() => (q.trim() ? matched : people.items).flatMap((m) => (hasCoord(m) ? [{ id: m.id, name: m.name, nick: m.nick?.trim() ?? '', photo: m.photoPath, lat: m.lat, lng: m.lng }] : [])), [matched, people.items, q])
  const noCoord = useMemo(() => matched.filter((m) => !hasCoord(m)), [matched])
  const target = q.trim() ? (shown.find((m) => m.id === sel) ?? shown[0] ?? null) : null // พิมพ์ชื่อแล้ว: คนที่แตะเลือก หรือคนแรกที่ตรง
  if (!ok) return <p className="empty">เฉพาะแอดมิน</p>
  // นำทาง: ตำแหน่งปัจจุบัน → บ้านสมาชิก (วาดเส้นตามถนนบนแผนที่ + เปิดนำทางต่อใน Google Maps)
  const go = (d: { name: string; lat: number; lng: number }) => {
    if (!navigator.geolocation) return setMsg('เครื่องนี้ไม่รองรับการหาตำแหน่ง')
    setDest(d); setNav(null); setMsg(''); setBusy(true)
    navigator.geolocation.getCurrentPosition(async (p) => {
      const from = { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }
      const r = await fetchRoad(from, d)
      setNav(r ? { from, m: r.m, s: r.s, road: true, g: r.g } : { from, m: distanceM(from, d), s: 0, road: false, g: [from, d] })
      setBusy(false)
    }, () => { setBusy(false); setMsg('หาตำแหน่งปัจจุบันไม่ได้ — เปิด GPS และอนุญาตให้แอปใช้ตำแหน่ง แล้วลองใหม่') }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }
  const gmaps = (d: Coord) => `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}&travelmode=driving`
  const pins = [
    ...shown.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, label: `${m.name}${m.nick ? ` (${m.nick})` : ''}`, sub: formatCoord(m), ...(dest && m.lat === dest.lat && m.lng === dest.lng ? { color: '#c2255c', badge: '🏠' } : {}) })),
    ...(nav ? [{ id: 'me', lat: nav.from.lat, lng: nav.from.lng, label: '📍 ฉันอยู่ที่นี่', sub: 'ตำแหน่งปัจจุบัน', color: '#1f5fbf', badge: '📍' }] : []),
  ]
  const line = nav ? { segments: [nav.g], labels: [{ at: nav.g[Math.floor(nav.g.length / 2)], text: `${km(nav.m)}${nav.road ? ` · ${mins(nav.s)}` : ''}` }] } : undefined
  return (
    <>
      <Back title="🗺️ แผนที่บ้านสมาชิก" />
      <p>มีพิกัดบ้านแล้ว <b>{withC.length}</b> จาก {people.items.length} คน (พิกัดเข้าอัตโนมัติเมื่อ “เช็คอินที่บ้าน”)</p>
      <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
        <input className="input grow" placeholder="พิมพ์ชื่อหรือชื่อเล่น" aria-label="ค้นหาชื่อ" value={q} onChange={(e) => { setQ(e.target.value); setSel(null); setPop(true) }} />
      </div>
      {dest && (
        <div style={{ margin: '8px 0', border: '2px solid #1a73e8', borderRadius: 12, padding: 10, background: '#eef5ff' }} role="status">
          <b>🧭 นำทางไปบ้าน {dest.name}</b>
          <div>{busy ? 'กำลังหาตำแหน่งปัจจุบันและเส้นทาง…' : nav ? <>จากที่ที่คุณอยู่ <b>{km(nav.m)}</b>{nav.road ? <> · ขับประมาณ <b>{mins(nav.s)}</b></> : ' (เส้นตรง — คำนวณตามถนนไม่ได้ตอนนี้)'}</> : msg}</div>
          <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <a className="btn btn--gold" href={gmaps(dest)} target="_blank" rel="noreferrer">🚗 เปิดนำทางใน Google Maps</a>
            <button type="button" className="btn" onClick={() => { setDest(null); setNav(null); setMsg('') }}>ปิดเส้นทาง</button>
          </div>
        </div>
      )}
      {!dest && msg && <p className="muted small" role="status">{msg}</p>}
      <div style={{ position: 'relative', minHeight: 150 }}>
      {shown.length === 0 ? <p className="empty">ไม่มีสมาชิกที่มีพิกัด</p> : (
        <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={pins} {...(line ? { line } : {})} height={420} label="แผนที่บ้านสมาชิก" /></Suspense>
      )}
        {pop && q.trim() && (
          <div role="listbox" aria-label="ชื่อที่ตรงกับคำค้น" style={{ position: 'absolute', left: 8, right: 8, top: 8, zIndex: 1000, maxHeight: '85%', overflowY: 'auto', background: '#fff', border: '2px solid #1a73e8', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>
            <div style={{ padding: '8px 12px', background: '#eef5ff', borderBottom: '1px solid #cfe0ff' }}><b>เลือกชื่อที่ต้องการนำทาง</b> <small className="muted">({shown.length + noCoord.length} คนที่ตรงและเกี่ยวข้องกับ “{q.trim()}”)</small></div>
            {shown.length + noCoord.length === 0 && <p className="muted" style={{ padding: 12, margin: 0 }}>ไม่พบผู้ที่มีพิกัดบ้านตรงกับคำค้น{noCoord.length ? ' — มีคนที่ตรงแต่ยังไม่มีพิกัด ดูใต้แผนที่' : ''}</p>}
            {shown.map((m) => (
              <button key={m.id} type="button" role="option" aria-selected={target?.id === m.id} className="row" style={{ width: '100%', gap: 8, alignItems: 'center', padding: '12px', border: 0, borderBottom: '1px solid #eee', background: '#fff', textAlign: 'left', font: 'inherit' }} onClick={() => { setSel(m.id); setPop(false); go(m); try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* ignore */ } }}>
                <MemberAvatar path={m.photo} name={m.name} size={48} /><span style={{ flex: 1 }}><b>{m.name}</b>{m.nick ? ` (${m.nick})` : ''}</span><small>🧭 นำทาง</small>
              </button>))}
            {noCoord.map((m) => (
              <div key={m.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '12px', borderBottom: '1px solid #eee', opacity: 0.6 }}>
                <MemberAvatar path={m.photoPath} name={m.name} size={48} /><span style={{ flex: 1 }}><b>{m.name}</b>{m.nick?.trim() ? ` (${m.nick.trim()})` : ''}</span><small>ยังไม่มีพิกัดบ้าน</small>
              </div>))}
          </div>
        )}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }} aria-label="รายชื่อสมาชิกที่มีพิกัด">
        {shown.map((m) => {
          const on = !!q.trim() && target?.id === m.id
          const editNick = () => {
            const full = people.items.find((x) => x.id === m.id)
            if (!full) return
            const v = window.prompt(`ชื่อเล่นของ ${m.name}${m.nick ? ` (ตอนนี้: ${m.nick})` : ' (ยังไม่มี)'}\nพิมพ์ชื่อเล่น แล้วกดตกลง (เว้นว่าง = ลบ)`, m.nick)
            if (v === null) return
            if (!people.put([{ ...full, nick: v.trim() }])) setMsg('บันทึกชื่อเล่นไม่ได้ (ต้องมีสิทธิ์แก้ทะเบียนสมาชิก)')
          }
          return (
            <li key={m.id} className="row" style={{ gap: 4, alignItems: 'center', borderBottom: '1px solid #eee', background: on ? '#fff3cd' : 'transparent' }}>
              <button type="button" className="row" style={{ flex: 1, gap: 8, alignItems: 'center', padding: '8px 6px', border: 0, background: 'transparent', textAlign: 'left', font: 'inherit' }} aria-label={`นำทางไปบ้าน ${m.name}`} onClick={() => { setSel(m.id); go(m); try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* ignore */ } }}>
                <MemberAvatar path={m.photo} name={m.name} size={44} /><span style={{ flex: 1 }}><b>{m.name}</b>{m.nick ? ` (${m.nick})` : <small className="muted"> · ยังไม่มีชื่อเล่น</small>}</span><small className="muted">{on ? 'เลือกแล้ว' : 'แตะเพื่อนำทาง'} 🧭</small>
              </button>
              <button type="button" className="mini" aria-label={`แก้ชื่อเล่น ${m.name}`} title="เพิ่ม/แก้ชื่อเล่น" onClick={editNick}>✏️</button>
            </li>)
        })}
      </ul>
    </>
  )
}
