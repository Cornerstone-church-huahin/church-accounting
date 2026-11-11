import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { LIGHT } from '../lib/lightBox'
import { Link } from 'react-router-dom'
import Sheet from './Sheet'
import MemberAvatar from './MemberAvatar'
import { useChurchMembers, useSettings, useVisits } from '../lib/data'
import { useRole } from '../lib/members'
import { isWorkStaffOnly } from '../lib/access'
import { distanceM, formatCoord, hasCoord, mapsLink, parseCoords, type Coord } from '../lib/geo'
import { addDays, be, fmtDate, monthName, todayISO } from '../lib/money'
import VisitTimetableLab from './VisitTimetableLab'
import VisitStatsLab from './VisitStatsLab'
import { useActivityLog, useTripLogs, useVisitPlans } from '../lib/data'
import { getMe } from '../lib/access'
import { VEHICLES, vehicleOf, vehicleRate } from '../lib/vehicles'
import { DAY_NAMES, dayKind, splitVisitors, sundayOf, weekDays } from '../lib/visits'
import type { ChurchMember } from '../lib/types'

const LeafletMap = lazy(() => import('./LeafletMap'))

/** โซนแอดมิน (ทดสอบ): มองเห็นเฉพาะแอดมินเท่านั้น */
export const useIsAdminZone = () => useRole() === 'admin' && !isWorkStaffOnly()

const TOOLS = [
  { to: '/meeting/4/report', icon: '📊', label: 'รายงานการเยี่ยม' },
  { to: '/meeting/4/route', icon: '🧭', label: 'รายงานเส้นทาง' },
  { to: '/meeting/4/lab/1', icon: '🧪', label: 'งาน/การเยี่ยม (ทดลอง)' },
] as const

export function AdminZone() {
  const st = useSettings()
  if (!useIsAdminZone()) return null
  const on = !!st.settings.visitTestMode
  return (
    <section aria-label="โซนแอดมิน" className="no-print" style={{ marginTop: 14, border: '2px dashed #a4262c', borderRadius: 16, padding: '10px 10px 12px', ...LIGHT, background: '#fff7f7' }}>
      <b style={{ display: 'block', marginBottom: 8, color: '#a4262c' }}>🔒 โซนแอดมิน · ทดสอบระบบ (คนอื่นไม่เห็น)</b>
      <nav className="balance-tiles tiletabs" aria-label="เครื่องมือแอดมิน">
        {TOOLS.map((t, i) => (
          <Link key={t.to} to={t.to} className={`btile btile--${(['own', 'fund', 'total'] as const)[i]}`}><small aria-hidden="true">{t.icon}</small><b>{t.label}</b></Link>
        ))}
        {[4, 5, 6].map((n) => (
          <span key={n} className="btile btile--indebt" style={{ opacity: 0.45 }} aria-disabled="true"><small aria-hidden="true">➕</small><b>ช่อง {n} (ว่าง)</b></span>
        ))}
      </nav>
      <label className="row" style={{ gap: 10, alignItems: 'center', marginTop: 10, padding: 8, borderRadius: 10, ...LIGHT, background: on ? '#fff3cd' : '#fff', border: '1px solid #e0b100' }}>
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
export function VisitRoute({ ns = '', byVehicle = false, embedded = false }: { /** ชุดข้อมูล (-lab = ทดลอง) */ ns?: string; /** แยกสาย/สีตามยานพาหนะ แทนหัวหน้าทีม */ byVehicle?: boolean; embedded?: boolean } = {}) {
  const ok = useIsAdminZone()
  const visits = useVisits(true, ns)
  const st = useSettings()
  const church: Coord | null = typeof st.settings.churchLat === 'number' && typeof st.settings.churchLng === 'number' ? { lat: st.settings.churchLat, lng: st.settings.churchLng } : null
  const rate = typeof st.settings.fuelPerKm === 'number' && st.settings.fuelPerKm >= 0 ? st.settings.fuelPerKm : 3.5
  const [rateTxt, setRateTxt] = useState<string | null>(null)
  const rateOf = (w: string) => (byVehicle ? vehicleRate(st.settings.vehicleFuel, w, rate) : rate)
  const [rateSheet, setRateSheet] = useState(false)
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
    const byAt = new Map<number, { at: number; lat: number; lng: number; kind?: 'home' | 'work' | 'place'; sim?: boolean; who: string; team: string[]; names: string[] }>()
    for (const v of visits.list) {
      if (v.date !== date || !v.checkin) continue
      const s = byAt.get(v.checkin.at) ?? { at: v.checkin.at, lat: v.checkin.lat, lng: v.checkin.lng, kind: v.checkin.kind, sim: v.checkin.sim, who: byVehicle ? (v.vehicle ?? '') : splitVisitors(v.visitor ?? '')[0] ?? '', team: splitVisitors(v.visitor ?? ''), names: [] }
      s.names.push(v.memberName.replace(/^place:/, ''))
      byAt.set(v.checkin.at, s)
    }
    const stops = [...byAt.values()].sort((a, b) => a.at - b.at)
    // แยกสายตามชุดผู้ออกเยี่ยม (ชุดเดียวกัน = สายเดียวกัน) แล้วแยกรอบด้วยช่วงเวลาห่างกัน
    const byWho = new Map<string, typeof stops>()
    for (const s of stops) byWho.set(s.who, [...(byWho.get(s.who) ?? []), s])
    const out: (typeof stops)[] = []
    for (const list of byWho.values()) {
      const part: (typeof stops)[] = []
      for (const s of list) { const last = part[part.length - 1]; if (last && s.at - last[last.length - 1].at <= GAP_MS) last.push(s); else part.push([s]) }
      out.push(...part)
    }
    out.sort((a, b) => a[0].at - b[0].at)
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
  // สาย: ชุดผู้ออกเยี่ยมที่ต่างกัน (เรียงตามเวลาที่ออกก่อน) → สายที่ 1, 2, 3 … คนละสีเส้น
  const whoList = byVehicle ? [...VEHICLES.map((c) => c.id), ''].filter((id) => trips.some((t) => t[0].who === id)) : [...new Set(trips.map((t) => t[0].who))]
  const LINE_COL = byVehicle ? whoList.map((w) => vehicleOf(w)?.color ?? '#607d8b') : ['#1a73e8', '#e8710a', '#8e24aa', '#0b8043', '#c2185b']
  const whoName = (w: string) => (byVehicle ? vehicleOf(w)?.name ?? 'ไม่ระบุรถ' : w || 'ไม่ระบุ')
  const lineOf = (t: { who: string }[]) => Math.max(0, whoList.indexOf(t[0].who))
  const multi = whoList.length > 1 || byVehicle
  // สาย = หัวหน้าทีม (ชื่อแรกที่ลงไว้) · ทีม = ผู้ออกเยี่ยมทุกคนที่ไปกับหัวหน้าคนนั้นในวัน
  const teamOf = (w: string) => [...new Set(trips.filter((t) => t[0].who === w).flatMap((t) => t.flatMap((s) => s.team)))].filter((n) => n !== w)
  const legCount = calcs.reduce((a, c) => a + c.legs.length, 0)
  const roadCount = calcs.reduce((a, c) => a + c.legs.filter((l) => l.road).length, 0)
  const pins = [
    ...(church ? [{ id: 'church', lat: church.lat, lng: church.lng, label: '⛪ คริสตจักร', sub: 'จุดเริ่มต้น/กลับ', color: '#1e9e4a', badge: '⛪', size: 42 }] : []),
    ...trips.flatMap((t, ti) => t.map((s, i) => ({ id: String(s.at), lat: s.lat, lng: s.lng, label: `${trips.length > 1 ? `รอบ ${ti + 1} · ` : ''}${i + 1}. ${s.names.join(', ')}`, sub: hhmm(s.at), color: LINE_COL[lineOf(t) % LINE_COL.length], badge: String(i + 1) }))),
  ]
  // เส้นทาง: คริสตจักร → จุด 1 → … → กลับคริสตจักร (สีน้ำเงิน ตามถนนจริงเมื่อคำนวณได้)
  const segs = calcs.flatMap((c) => c.legs)
  const segCol = calcs.flatMap((c, ci) => c.legs.map(() => LINE_COL[lineOf(trips[ci]) % LINE_COL.length]))
  const line = segs.length ? { segments: segs.map((l) => l.g), colors: segCol, labels: segs.map((l) => ({ at: l.g[Math.floor(l.g.length / 2)], text: `${km(l.m)}${l.road ? ` · ${mins(l.s)}` : ''}` })) } : undefined
  const roadNote = legCount === 0 ? '' : roadCount === legCount ? '🛣️ ระยะตามถนนจริง' : roadCount === 0 ? '⏳ กำลังคำนวณตามถนน… (ถ้าไม่ขึ้น ใช้เส้นตรงแทนชั่วคราว)' : `⏳ คำนวณตามถนนแล้ว ${roadCount}/${legCount} ช่วง`
  return (
    <>
      {!embedded && <Back title="🧭 รายงานเส้นทาง" />}
      {rateSheet && <VehicleRateSheet onClose={() => setRateSheet(false)} />}
      <div className="weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => shift(-1)}>‹</button>
        <span className="small"><b>{range}</b></span>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => shift(1)}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 8 }} role="tablist" aria-label="เลือกวัน">
        {days.map((d) => {
          const full = DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()], short = full.startsWith('พฤ') ? 'พฤ.' : `${full[0]}.`
          return (
            <button key={d} type="button" role="tab" aria-selected={d === date} aria-label={`${full} ${Number(d.slice(8))}${checkDays.has(d) ? ' มีเช็คอิน' : ''}`} className="mini" style={{ minHeight: 0, padding: '4px 0', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', ...(d === date ? { background: '#1a2b4c', color: '#fff' } : {}) }} onClick={() => setPickDay(d)}>{short}{Number(d.slice(8))}{checkDays.has(d) ? <span style={{ color: d === date ? '#7fe0a0' : '#1e9e4a' }}>●</span> : null}</button>
          )
        })}
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
          <p><b>{trips.length} รอบ · {all.length} จุด</b> · ระยะรวม{church ? 'ไป-กลับ' : ' (ยังไม่นับคริสตจักร)'} <b>{km(grand)}</b> · ⛽ ค่าน้ำมันประมาณ <b>{baht(calcs.reduce((x, c, ci) => x + c.total / 1000 * rateOf(trips[ci][0].who), 0))}</b> <small className="muted">({roadNote})</small></p>
          {multi && <div className="small" style={{ margin: '4px 0' }} aria-label="สรุปแต่ละสาย">{whoList.map((w, i) => { const tot = calcs.reduce((x, c, ci) => (lineOf(trips[ci]) === i ? x + c.total : x), 0); return <div key={w} style={{ color: '#222' }}><b style={{ color: LINE_COL[i % LINE_COL.length] }}>━━ สายที่ {i + 1}</b> · {byVehicle ? (vehicleOf(w) ? <img src={vehicleOf(w)!.img} alt={whoName(w)} style={{ width: 44, height: 28, objectFit: 'cover', borderRadius: 6, verticalAlign: 'middle', marginRight: 4 }} /> : '🚗') : 'หัวหน้า'} <b>{whoName(w)}</b>{!byVehicle && teamOf(w).length ? <small className="muted"> (ทีม: {teamOf(w).join(', ')})</small> : null} · <b>{km(tot)}</b> · ⛽ {baht(tot / 1000 * rateOf(w))} <small className="muted">({rateOf(w)} บ./กม.)</small>{byVehicle && <> <button type="button" className="mini" onClick={() => setRateSheet(true)} aria-label={`ตั้งค่าน้ำมัน ${whoName(w)}`}>⚙️ ตั้งอัตรา</button></>}</div> })}</div>}
          <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={pins} line={line} height={340} label="เส้นทางการเยี่ยม" /></Suspense>
          <p className="small" style={{ margin: '4px 0' }}><span style={{ color: '#1e9e4a', fontWeight: 700 }}>● ⛪ คริสตจักร</span> · <span style={{ fontWeight: 700 }}>● จุดเยี่ยม (เลขตามลำดับ · สีเดียวกับเส้นของสาย)</span> · <span style={{ color: '#1a73e8', fontWeight: 700 }}>━ เส้นทาง</span></p>
          {trips.map((t, ti) => {
            const { legs, total } = calc(t)
            const off = church ? 0 : 1
            return (
              <section key={t[0].at} style={{ marginTop: 10, border: '1px solid #ddd', borderRadius: 12, padding: 10 }}>
                {multi && <b style={{ color: LINE_COL[lineOf(t) % LINE_COL.length] }}>━ {byVehicle ? '🚗' : `สายที่ ${lineOf(t) + 1}`} <small style={{ color: '#555', fontWeight: 600 }}>({byVehicle ? whoName(t[0].who) : `หัวหน้า ${t[0].who || 'ไม่ระบุ'}`})</small> · </b>}<b>รอบที่ {ti + 1}</b> · {hhmm(t[0].at)} – {hhmm(t[t.length - 1].at)} · <b>{km(total)}</b>{church ? ' (ไป-กลับ)' : ''} · ⛽ <b>{baht(total / 1000 * rateOf(t[0].who))}</b>
                <ol style={{ margin: '6px 0 0', paddingLeft: '1.3rem' }}>
                  {church && <li>⛪ คริสตจักร (ออกเดินทาง)</li>}
                  {t.map((s, i) => (
                    <li key={s.at} style={{ marginBottom: 4 }}>
                      <b>{s.names.join(', ')}</b> · {s.kind === 'work' ? '🏢 ที่ทำงาน' : s.kind === 'place' ? '📌 สถานที่นัดพบ' : '🏠 ที่บ้าน'}{s.sim ? ' 🧪จำลอง' : ''} · {hhmm(s.at)}
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
type HomeRow = { id: string; name: string; nick: string; photo?: string; lat?: number; lng?: number; wlat?: number; wlng?: number; plat?: number; plng?: number; pname?: string }
const hasW = (m: { workLat?: number; workLng?: number }) => typeof m.workLat === 'number' && typeof m.workLng === 'number'

/** ปุ่มนำทาง 2 แบบ: 🏠 ไปบ้าน · 🏢 ไปที่ทำงาน (ไม่มีพิกัดแบบไหน ปุ่มนั้นจาง กดไม่ได้) */
function NavButtons({ m, onGo }: { m: HomeRow; onGo: (kind: 'home' | 'work' | 'place') => void }) {
  const NAME = { home: 'บ้าน', work: 'ที่ทำงาน', place: 'สถานที่' } as const, COL = { home: '#c2255c', work: '#e67700', place: '#6a1b9a' } as const, ICO = { home: '🏠', work: '🏢', place: '📌' } as const
  const btn = (kind: 'home' | 'work' | 'place', ok: boolean) => (
    <button type="button" disabled={!ok} onClick={() => onGo(kind)} aria-label={`นำทางไป${NAME[kind]} ${m.name}`} title={ok ? `นำทางไป${NAME[kind]}${kind === 'place' && m.pname ? ` (${m.pname})` : ''}` : `ยังไม่มีพิกัด${NAME[kind]}`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52, padding: '5px 4px', borderRadius: 12, border: `2px solid ${ok ? COL[kind] : '#b9bec7'}`, background: ok ? '#fff' : '#e6e8ec', filter: ok ? undefined : 'grayscale(1)', opacity: ok ? 1 : 0.55, color: '#1a2b4c', font: 'inherit', lineHeight: 1.1 }}>
      <span style={{ fontSize: 22 }} aria-hidden="true">{ICO[kind]}</span><small style={{ fontSize: 11.5, fontWeight: 700 }}>{NAME[kind]}</small>
    </button>
  )
  return <span style={{ display: 'flex', gap: 8, flex: 'none' }}>{btn('home', typeof m.lat === 'number' && typeof m.lng === 'number')}{btn('work', typeof m.wlat === 'number' && typeof m.wlng === 'number')}{btn('place', typeof m.plat === 'number' && typeof m.plng === 'number')}</span>
}

/** แผนที่บ้านและที่ทำงานของสมาชิก */
export function MemberHomesMap({ embedded = false }: { embedded?: boolean }) {
  const ok = true // เปิดให้ทีมอภิบาล (สิทธิ์ตรวจที่หน้าเรียกใช้)
  const people = useChurchMembers()
  const st = useSettings()
  const churchPt = typeof st.settings.churchLat === 'number' && typeof st.settings.churchLng === 'number' ? { lat: st.settings.churchLat, lng: st.settings.churchLng } : null // พิกัดคริสตจักรที่ตั้งไว้แล้ว = จุดศูนย์กลางของแผนที่
  const [q, setQ] = useState('')
  const [dest, setDest] = useState<{ name: string; lat: number; lng: number; work?: boolean; place?: boolean } | null>(null)
  const [nav, setNav] = useState<{ from: Coord; m: number; s: number; road: boolean; g: Coord[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [pop, setPop] = useState(true) // ป๊อปอัพรายชื่อที่ตรงกับคำค้น (ปิดหลังเลือกแล้ว)
  const toRow = (m: ChurchMember): HomeRow => ({ id: m.id, name: m.name, nick: m.nick?.trim() ?? '', photo: m.photoPath, ...(hasCoord(m) ? { lat: m.lat, lng: m.lng } : {}), ...(hasW(m) ? { wlat: m.workLat, wlng: m.workLng } : {}), ...(typeof m.placeLat === 'number' && typeof m.placeLng === 'number' ? { plat: m.placeLat, plng: m.placeLng, ...(m.placeName ? { pname: m.placeName } : {}) } : {}) })
  const homeCount = useMemo(() => people.items.filter(hasCoord).length, [people.items])
  // ค้นหา: ชื่อ/ชื่อเล่น/รหัส/เบอร์/หมายเหตุ ตรงคำค้น + "คนที่เกี่ยวข้อง" ดึงจากข้อมูลหลังบ้าน (นามสกุลเดียวกัน · ที่อยู่เดียวกัน · หมายเหตุที่กล่าวถึงกัน) แสดงเฉพาะรายชื่อ
  const matched = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s+/g, '')
    if (!t) return []
    const all = people.items
    const direct = all.filter((m) => `${m.name ?? ''}${m.nick ?? ''}${m.code ?? ''}${m.tel ?? ''}${m.note ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t))
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
  const shown = useMemo<HomeRow[]>(() => (q.trim() ? matched : people.items).filter((m) => hasCoord(m) || hasW(m) || typeof m.placeLat === 'number').map(toRow), [matched, people.items, q]) // eslint-disable-line react-hooks/exhaustive-deps
  // รายชื่อ: สมาชิกทุกคน (หรือทุกคนที่ตรงคำค้น) — คนที่มีพิกัดขึ้นก่อน · ปุ่มบ้าน/ที่ทำงานที่ยังไม่มีพิกัดเป็นสีเทา
  const rows = useMemo<HomeRow[]>(() => { const r = (q.trim() ? matched : people.items).map(toRow); return [...r.filter((x) => x.lat != null || x.wlat != null || x.plat != null), ...r.filter((x) => x.lat == null && x.wlat == null && x.plat == null)] }, [matched, people.items, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const target = q.trim() ? (shown.find((m) => m.id === sel) ?? shown[0] ?? null) : null
  if (!ok) return <p className="empty">เฉพาะแอดมิน</p>
  // นำทาง: ตำแหน่งปัจจุบัน → บ้านสมาชิก (วาดเส้นตามถนนบนแผนที่ + เปิดนำทางต่อใน Google Maps)
  const go = (d: { name: string; lat: number; lng: number; work?: boolean; place?: boolean }) => {
    if (!navigator.geolocation) return setMsg('เครื่องนี้ไม่รองรับการหาตำแหน่ง')
    setDest(d); setNav(null); setMsg(''); setBusy(true)
    navigator.geolocation.getCurrentPosition(async (p) => {
      const from = { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }
      const r = await fetchRoad(from, d)
      setNav(r ? { from, m: r.m, s: r.s, road: true, g: r.g } : { from, m: distanceM(from, d), s: 0, road: false, g: [from, d] })
      setBusy(false)
    }, () => { setBusy(false); setMsg('หาตำแหน่งปัจจุบันไม่ได้ — เปิด GPS และอนุญาตให้แอปใช้ตำแหน่ง แล้วลองใหม่') }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }
  const gmaps = (d: Coord) => `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}&travelmode=driving&dir_action=navigate`
  const goKind = (m: HomeRow, kind: 'home' | 'work' | 'place') => {
    setSel(m.id); setPop(false)
    if (kind === 'place' && typeof m.plat === 'number' && typeof m.plng === 'number') { go({ name: `${m.pname || 'สถานที่นัดพบ'} (${m.name})`, lat: m.plat, lng: m.plng, place: true }); try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* ignore */ } return }
    if (kind === 'work' && typeof m.wlat === 'number' && typeof m.wlng === 'number') go({ name: `ที่ทำงานของ ${m.name}`, lat: m.wlat, lng: m.wlng, work: true })
    else if (typeof m.lat === 'number' && typeof m.lng === 'number') go({ name: m.name, lat: m.lat, lng: m.lng })
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* ignore */ }
  }
  // หมุดบนแผนที่: คนที่อยู่จุดเดียวกัน (บ้านเดียวกัน/ที่ทำงานเดียวกัน) รวมเป็นหมุดเดียว — ป๊อปอัพบรรทัดแรก = บ้าน/ที่ทำงาน แล้วตามด้วยชื่อทีละบรรทัด
  const groupPins = (kind: 'home' | 'work' | 'place') => {
    const g = new Map<string, { lat: number; lng: number; names: string[] }>()
    for (const m of shown) {
      const lat = kind === 'home' ? m.lat : kind === 'work' ? m.wlat : m.plat, lng = kind === 'home' ? m.lng : kind === 'work' ? m.wlng : m.plng
      if (typeof lat !== 'number' || typeof lng !== 'number') continue
      const k = `${lat.toFixed(5)},${lng.toFixed(5)}`
      const e = g.get(k) ?? { lat, lng, names: [] }
      e.names.push(m.name); g.set(k, e)
    }
    return [...g.entries()].map(([k, e]) => ({ id: `${kind}-${k}`, lat: e.lat, lng: e.lng, label: kind === 'home' ? '🏠 บ้าน' : kind === 'work' ? '🏢 ที่ทำงาน' : '📌 สถานที่นัดพบ', sub: e.names.join('\n'), ...(kind === 'work' ? { color: '#e67700', badge: '🏢' } : kind === 'place' ? { color: '#6a1b9a', badge: '📌' } : {}) }))
  }
  // เลือกนำทางแล้ว: แผนที่แสดงเฉพาะปลายทาง + จุดที่ผู้ใช้อยู่ (ซูมพอดีกับเส้นทาง) · ยังไม่เลือก: แสดงทุกหมุด
  const pins = dest
    ? [
      { id: 'dest', lat: dest.lat, lng: dest.lng, label: dest.name, sub: formatCoord(dest), color: dest.work ? '#e67700' : dest.place ? '#6a1b9a' : '#c2255c', badge: dest.work ? '🏢' : dest.place ? '📌' : '🏠' },
      ...(nav ? [{ id: 'me', lat: nav.from.lat, lng: nav.from.lng, label: '📍 ฉันอยู่ที่นี่', sub: 'ตำแหน่งปัจจุบัน', color: '#1f5fbf', badge: '📍' }] : []),
    ]
    : [...(churchPt ? [{ id: 'church', lat: churchPt.lat, lng: churchPt.lng, label: '⛪ คริสตจักรศิลาเอก', sub: 'ศูนย์กลาง · จุดเริ่มต้นการเยี่ยม', color: '#1e9e4a', badge: '⛪', size: 42 }] : []), ...groupPins('home'), ...groupPins('work'), ...groupPins('place')]
  const line = nav ? { segments: [nav.g], labels: [{ at: nav.g[Math.floor(nav.g.length / 2)], text: `${km(nav.m)}${nav.road ? ` · ${mins(nav.s)}` : ''}` }] } : undefined
  return (
    <>
      {!embedded && <Back title="🗺️ บ้านและที่ทำงานสมาชิก" />}
      <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
        <input className="input grow" placeholder="พิมพ์ชื่อหรือชื่อเล่น" aria-label="ค้นหาชื่อ" value={q} onChange={(e) => { setQ(e.target.value); setSel(null); setPop(true) }} />
      </div>
      {dest && (
        <div style={{ margin: '8px 0', border: '2px solid #1a73e8', borderRadius: 12, padding: 10, ...LIGHT, background: '#eef5ff' }} role="status">
          <b>🧭 นำทางไป{dest.work || dest.place ? '' : 'บ้าน'} {dest.name}</b>
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
          <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={pins} {...(line ? { line } : {})} height={420} label="แผนที่บ้านและที่ทำงานสมาชิก" /></Suspense>
        )}
        {pop && q.trim() && (
          <div role="listbox" aria-label="ชื่อที่ตรงกับคำค้น" style={{ position: 'absolute', left: 8, right: 8, top: 8, zIndex: 1000, maxHeight: '85%', overflowY: 'auto', ...LIGHT, background: '#fff', border: '2px solid #1a73e8', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>
            <div style={{ padding: '8px 12px', ...LIGHT, background: '#eef5ff', borderBottom: '1px solid #cfe0ff' }}><b>เลือกชื่อและปลายทางที่ต้องการนำทาง</b> <small className="muted">({rows.length} คนที่ตรงและเกี่ยวข้องกับ “{q.trim()}”)</small></div>
            {rows.length === 0 && <p className="muted" style={{ padding: 12, margin: 0 }}>ไม่พบสมาชิกที่ตรงกับคำค้น</p>}
            {rows.map((m) => (
              <div key={m.id} role="option" aria-selected={target?.id === m.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #eee', ...LIGHT, background: '#fff' }}>
                <MemberAvatar path={m.photo} name={m.name} size={48} /><span style={{ flex: 1, minWidth: 0 }}><b>{m.name}</b>{m.nick ? ` (${m.nick})` : ''}</span>
                <NavButtons m={m} onGo={(k) => goKind(m, k)} />
              </div>))}
          </div>
        )}
      </div>
      <p className="muted small" style={{ margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 มีพิกัดบ้านแล้ว <b>{homeCount}</b> จาก {people.items.length} คน · เข้าเองเมื่อเช็คอิน</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }} aria-label="รายชื่อสมาชิกทั้งหมด">
        {rows.map((m) => {
          const on = !!q.trim() && target?.id === m.id
          const editNick = () => {
            const full = people.items.find((x) => x.id === m.id)
            if (!full) return
            const v = window.prompt(`ชื่อเล่นของ ${m.name}${m.nick ? ` (ตอนนี้: ${m.nick})` : ' (ยังไม่มี)'}\nพิมพ์ชื่อเล่น แล้วกดตกลง (เว้นว่าง = ลบ)`, m.nick)
            if (v === null) return
            if (!people.put([{ ...full, nick: v.trim() }])) setMsg('บันทึกชื่อเล่นไม่ได้ (ต้องมีสิทธิ์แก้ทะเบียนสมาชิก)')
          }
          return (
            <li key={m.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee', ...LIGHT, background: on ? '#fff3cd' : 'transparent' }}>
              <MemberAvatar path={m.photo} name={m.name} size={44} />
              <span style={{ flex: 1, minWidth: 0 }}><b>{m.name}</b>{m.nick ? ` (${m.nick})` : <small className="muted"> · ยังไม่มีชื่อเล่น</small>}</span>
              <NavButtons m={m} onGo={(k) => goKind(m, k)} />
              <button type="button" className="mini" aria-label={`แก้ชื่อเล่น ${m.name}`} title="เพิ่ม/แก้ชื่อเล่น" onClick={editNick}>✏️</button>
            </li>)
        })}
      </ul>
    </>
  )
}

/** 🧪 งาน/การเยี่ยม (ทดลอง): สำเนาของแท็บจริง ข้อมูลแยกชุด (-lab) เห็นและเข้าได้เฉพาะแอดมิน — ใช้พัฒนาฟังก์ชันใหม่โดยไม่กระทบผู้ดูแลและข้อมูลจริง */
export function VisitLab({ step }: { step?: string }) {
  const ok = useIsAdminZone()
  const realPlans = useVisitPlans(), labPlans = useVisitPlans('-lab')
  const realVisits = useVisits(true), labVisits = useVisits(true, '-lab')
  const realActs = useActivityLog(), labActs = useActivityLog('-lab')
  const [msg, setMsg] = useState('')
  if (!ok) return <p className="empty">เฉพาะแอดมิน</p>
  const n = step === '2' ? 2 : step === '3' ? 3 : step === '4' ? 4 : step === '5' ? 5 : step === '6' ? 6 : 1
  const seed = () => {
    if (!window.confirm('คัดลอกข้อมูลจริง (แผน บันทึกเยี่ยม กิจกรรม) มาเป็นข้อมูลตั้งต้นของแท็บทดลอง?\nข้อมูลทดลองเดิมที่ id ซ้ำกันจะถูกเขียนทับ — ข้อมูลจริงไม่เปลี่ยน')) return
    labPlans.put(realPlans.items.filter((x) => !x.deleted).map((x) => ({ ...x, updated: 0 })))
    labVisits.put(realVisits.list.map((x) => ({ ...x, updated: 0 })))
    labActs.put(realActs.list.map((x) => ({ ...x, updated: 0 })))
    setMsg(`คัดลอกแล้ว: แผน ${realPlans.items.filter((x) => !x.deleted).length} · บันทึกเยี่ยม ${realVisits.list.length} · กิจกรรม ${realActs.list.length}`)
  }
  const wipe = () => {
    if (!window.confirm('ล้างข้อมูลทดลองทั้งหมด (แผน บันทึกเยี่ยม กิจกรรม ของแท็บทดลอง)? ข้อมูลจริงไม่เปลี่ยน')) return
    labPlans.items.forEach((x) => labPlans.remove(x.id)); labVisits.list.forEach((x) => labVisits.remove(x.id)); labActs.list.forEach((x) => labActs.remove(x.id))
    setMsg('ล้างข้อมูลทดลองแล้ว')
  }
  const steps = [['1', '📅', 'วางแผน'], ['2', '📍', 'บันทึก/เช็คอิน'], ['3', '📊', 'รายงาน'], ['4', '📈', 'สถิติ'], ['5', '🧭', 'เส้นทางรถ'], ['6', '⛽', 'ค่าน้ำมัน']] as const
  return (
    <>
      <div className="page-head no-print"><h1>🧪 งาน/การเยี่ยม (ทดลอง)</h1><Link to="/meeting/4" className="mini">‹ งานอภิบาล</Link></div>
      <div role="note" className="no-print" style={{ ...LIGHT, background: '#fff3cd', border: '1.5px dashed #e0b100', borderRadius: 12, padding: '6px 10px', marginBottom: 8, fontSize: '0.9rem' }}>
        🔒 <b>สำเนาทดลอง · เฉพาะแอดมิน</b> — ใช้ข้อมูลแยกจากของจริง ผู้ดูแลคนอื่นไม่เห็นและไม่กระทบ
        <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <button type="button" className="mini" onClick={seed}>📥 คัดลอกข้อมูลจริงมาเป็นตั้งต้น</button>
          <button type="button" className="mini" onClick={wipe}>🗑 ล้างข้อมูลทดลอง</button>
        </div>
        {msg && <div className="small" role="status">{msg}</div>}
      </div>
      <nav className="tabicons tabicons--txt no-print" aria-label="ขั้นตอน (ทดลอง)" style={{ marginBottom: 6 }}>
        {steps.map(([k, ico, label]) => <Link key={k} to={`/meeting/4/lab/${k}`} replace className={`tabicons__i${String(n) === k ? ' on' : ''}`} aria-current={String(n) === k ? 'page' : undefined}><i aria-hidden="true">{k}</i><span aria-hidden="true">{ico}</span><em aria-hidden="true">{label}</em></Link>)}
      </nav>
      {n === 2 && <TripLogButton ns="-lab" />}
      {n === 6 ? <VehicleFuelReport ns="-lab" /> : n === 5 ? <VisitRoute ns="-lab" byVehicle embedded /> : n === 4 ? <VisitStatsLab /> : <VisitTimetableLab mode={n === 1 ? 'plan' : n === 2 ? 'record' : 'report'} />}
    </>
  )
}

/** ตั้งอัตราค่าน้ำมัน (บาท/กม.) ของรถแต่ละคัน */
export function VehicleRateSheet({ onClose }: { onClose: () => void }) {
  const st = useSettings()
  const base = typeof st.settings.fuelPerKm === 'number' ? st.settings.fuelPerKm : 3.5
  const [txt, setTxt] = useState<Record<string, string>>(() => Object.fromEntries(VEHICLES.map((v) => [v.id, String(vehicleRate(st.settings.vehicleFuel, v.id, base))])))
  const [msg, setMsg] = useState('')
  const save = () => {
    const out: Record<string, number> = {}
    for (const v of VEHICLES) { const n = Number(String(txt[v.id]).replace(/,/g, '')); if (!Number.isFinite(n) || n < 0) return setMsg(`อัตราของ ${v.name} ไม่ถูกต้อง`); out[v.id] = n }
    if (st.save({ vehicleFuel: out })) onClose() // บันทึกสำเร็จ → ปิดหน้าต่าง ตัวเลขด้านหลังอัปเดตทันที
    else setMsg('บันทึกไม่ได้ (ต้องเป็นแอดมิน)')
  }
  return (
    <Sheet title="⛽ อัตราค่าน้ำมันรายคัน (บาท/กม.)" onClose={onClose}>
      <p className="muted small" style={{ margin: 0 }}>ตั้งราคาต่อกิโลเมตรของรถแต่ละคัน (ค่าเริ่มต้น {base} บาท/กม.) ใช้คำนวณค่าน้ำมันในเส้นทางรถและรายงานค่าน้ำมัน</p>
      {VEHICLES.map((v) => (
        <div key={v.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
          <img src={v.img} alt={v.name} style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 8, border: `3px solid ${v.color}` }} />
          <span style={{ flex: 1 }}><b>{v.name}</b></span>
          <input className="input" style={{ width: 90 }} inputMode="decimal" aria-label={`อัตรา ${v.name}`} value={txt[v.id]} onChange={(e) => setTxt({ ...txt, [v.id]: e.target.value })} />
          <span className="small">บ./กม.</span>
        </div>))}
      {msg && <span className="small" role="status">{msg}</span>}
      <button type="button" className="btn btn--gold btn--block" onClick={save}>✓ บันทึกอัตราและปิด</button>
    </Sheet>
  )
}

/** รายงานค่าน้ำมันรายคัน: รายสัปดาห์ (ตัดยอดทุกสัปดาห์) · รายเดือน (แยกสัปดาห์) · รายปี (แยกเดือน) */
export function VehicleFuelReport({ ns = '' }: { ns?: string }) {
  const ok = useIsAdminZone()
  const visits = useVisits(true, ns)
  const tl = useTripLogs(ns)
  const st = useSettings()
  const base = typeof st.settings.fuelPerKm === 'number' ? st.settings.fuelPerKm : 3.5
  const church: Coord | null = typeof st.settings.churchLat === 'number' && typeof st.settings.churchLng === 'number' ? { lat: st.settings.churchLat, lng: st.settings.churchLng } : null
  const today = todayISO()
  const [mode, setMode] = useState<'week' | 'month' | 'year'>('week')
  const [anchor, setAnchor] = useState(today)
  const [rateSheet, setRateSheet] = useState(false)
  const range = useMemo(() => {
    const y = Number(anchor.slice(0, 4)), m = Number(anchor.slice(5, 7))
    if (mode === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, title: `ปี ${be(y)}` }
    if (mode === 'month') { const last = new Date(y, m, 0).getDate(); return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`, title: `${monthName(m)} ${be(y)}` } }
    const sun = sundayOf(anchor)
    return { from: sun, to: addDays(sun, 6), title: `สัปดาห์ ${sun.slice(8)}/${sun.slice(5, 7)} – ${addDays(sun, 6).slice(8)}/${addDays(sun, 6).slice(5, 7)}/${be(Number(sun.slice(0, 4)))}` }
  }, [anchor, mode])
  const shift = (n: number) => {
    if (mode === 'week') return setAnchor(addDays(anchor, n * 7))
    const y = Number(anchor.slice(0, 4)), m = Number(anchor.slice(5, 7))
    if (mode === 'year') return setAnchor(`${y + n}-01-15`)
    const t = y * 12 + (m - 1) + n
    setAnchor(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-15`)
  }
  // รอบ = (วัน, รถ): จุดเช็คอินเรียงเวลา แยกรอบเมื่อห่าง > 3 ชม. · คริสตจักร → จุด → กลับ
  const trips = useMemo(() => {
    const byKey = new Map<string, Map<number, Coord>>()
    for (const v of visits.list) {
      if (!v.checkin || v.date < range.from || v.date > range.to) continue
      const key = `${v.date}|${v.vehicle ?? ''}`
      const m = byKey.get(key) ?? new Map<number, Coord>()
      m.set(v.checkin.at, { lat: v.checkin.lat, lng: v.checkin.lng }); byKey.set(key, m)
    }
    const out: { date: string; vehicle: string; pts: Coord[] }[] = []
    for (const [key, m] of byKey) {
      const [date, vehicle] = key.split('|')
      const stops = [...m.entries()].sort((a, b) => a[0] - b[0])
      let cur: [number, Coord][] = []
      for (const s of stops) { if (cur.length && s[0] - cur[cur.length - 1][0] > GAP_MS) { out.push({ date, vehicle, pts: cur.map((x) => x[1]) }); cur = [] } cur.push(s) }
      if (cur.length) out.push({ date, vehicle, pts: cur.map((x) => x[1]) })
    }
    return out
  }, [visits.list, range])
  const chain = (pts: Coord[]) => (church ? [church, ...pts, church] : pts)
  const pairs = trips.slice(0, 120).flatMap((t) => { const c = chain(t.pts); return c.slice(1).map((p, i) => [c[i], p] as [Coord, Coord]) })
  const road = useRoadLegs(pairs)
  if (!ok) return <p className="empty">เฉพาะแอดมิน</p>
  const meters = (t: { pts: Coord[] }) => { const c = chain(t.pts); return c.slice(1).reduce((a, p, i) => a + (road(c[i], p)?.m ?? distanceM(c[i], p)), 0) }
  type Row = { key: string; label: string; m: Record<string, number> }
  const bucketKey = (date: string) => (mode === 'year' ? date.slice(0, 7) : mode === 'month' ? sundayOf(date) : date)
  const bucketLabel = (k: string) => (mode === 'year' ? `${monthName(Number(k.slice(5)))}` : mode === 'month' ? `สัปดาห์ ${k.slice(8)}/${k.slice(5, 7)}` : `${DAY_NAMES[new Date(k + 'T00:00:00Z').getUTCDay()]} ${Number(k.slice(8))}`)
  const rows = new Map<string, Row>()
  for (const t of trips) { const k = bucketKey(t.date); const r = rows.get(k) ?? { key: k, label: bucketLabel(k), m: {} }; r.m[t.vehicle] = (r.m[t.vehicle] ?? 0) + meters(t); rows.set(k, r) }
  const tripsIn = tl.list.filter((x) => x.date >= range.from && x.date <= range.to)
  for (const x of tripsIn) { const k = bucketKey(x.date); const r = rows.get(k) ?? { key: k, label: bucketLabel(k), m: {} }; r.m[x.vehicle] = (r.m[x.vehicle] ?? 0) + x.km * 1000; rows.set(k, r) }
  const tripM = (id: string) => tripsIn.filter((x) => x.vehicle === id).reduce((a, x) => a + x.km * 1000, 0)
  const list = [...rows.values()].sort((a, b) => a.key.localeCompare(b.key))
  const vids = [...VEHICLES.map((v) => v.id), ''].filter((id) => trips.some((t) => t.vehicle === id) || tripsIn.some((x) => x.vehicle === id))
  const rate = (id: string) => vehicleRate(st.settings.vehicleFuel, id, base)
  const totM = (id: string) => list.reduce((a, r) => a + (r.m[id] ?? 0), 0)
  const grand = vids.reduce((a, id) => a + totM(id) / 1000 * rate(id), 0)
  const name = (id: string) => vehicleOf(id)?.name ?? 'ไม่ระบุรถ'
  return (
    <section aria-label="รายงานค่าน้ำมันรายคัน">
      {rateSheet && <VehicleRateSheet onClose={() => setRateSheet(false)} />}
      <div className="seg seg--3 no-print" role="tablist" aria-label="ช่วงเวลา" style={{ marginBottom: 6 }}>
        {([['week', 'รายสัปดาห์'], ['month', 'รายเดือน'], ['year', 'รายปี']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}
      </div>
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="ย้อนหลัง" onClick={() => shift(-1)}>‹</button>
        <span className="small"><b>{range.title}</b></span>
        <button type="button" className="mini" aria-label="ถัดไป" onClick={() => shift(1)}>›</button>
      </div>
      <button type="button" className="btn btn--block" style={{ marginBottom: 8 }} onClick={() => setRateSheet(true)}>⚙️ ตั้งค่าอัตราค่าน้ำมันรายคัน</button>
      {vids.length === 0 ? <p className="empty">ไม่มีการเช็คอินในช่วงนี้</p> : (
        <>
          <div style={{ border: '2px solid #d6dbe8', borderRadius: 12, padding: 10, ...LIGHT, background: '#fff' }}>
            <b>⛽ สรุปค่าน้ำมันที่ต้องจ่าย · {range.title}</b>
            {vids.map((id) => (
              <div key={id || 'none'} className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                {vehicleOf(id) ? <img src={vehicleOf(id)!.img} alt={name(id)} style={{ width: 52, height: 34, objectFit: 'cover', borderRadius: 6, border: `3px solid ${vehicleOf(id)!.color}` }} /> : <span aria-hidden="true">🚗</span>}
                <span style={{ flex: 1, minWidth: 0 }}><b>{name(id)}</b><br /><small className="muted">{km(Math.round(totM(id)))} × {rate(id)} บ./กม.{tripM(id) > 0 ? ` (เยี่ยม ${km(Math.round(totM(id) - tripM(id)))} + เที่ยวงาน ${km(Math.round(tripM(id)))})` : ''}</small></span>
                <b style={{ fontSize: '1.1rem' }}>{baht(totM(id) / 1000 * rate(id))}</b>
              </div>))}
            <div className="row row--between" style={{ paddingTop: 6 }}><b>รวมทั้งหมด</b><b style={{ fontSize: '1.2rem' }}>{baht(grand)}</b></div>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...LIGHT, background: '#fff', fontSize: 14 }} aria-label="ตารางค่าน้ำมันแยกตามช่วง">
              <thead><tr><th style={{ textAlign: 'left', padding: 6, borderBottom: '2px solid #cfd6e4' }}>{mode === 'year' ? 'เดือน' : mode === 'month' ? 'สัปดาห์ (ตัดยอด)' : 'วัน'}</th>{vids.map((id) => <th key={id || 'n'} style={{ padding: 6, borderBottom: `3px solid ${vehicleOf(id)?.color ?? '#999'}` }}>{name(id).replace('รถ', '')}</th>)}</tr></thead>
              <tbody>
                {list.map((r) => <tr key={r.key}><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>{r.label}</td>{vids.map((id) => <td key={id || 'n'} style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{r.m[id] ? <>{km(Math.round(r.m[id]))}<br /><b>{baht(r.m[id] / 1000 * rate(id))}</b></> : '—'}</td>)}</tr>)}
                <tr><td style={{ padding: 6, fontWeight: 800 }}>รวม</td>{vids.map((id) => <td key={id || 'n'} style={{ padding: 6, textAlign: 'right', fontWeight: 800 }}>{baht(totM(id) / 1000 * rate(id))}</td>)}</tr>
              </tbody>
            </table>
          </div>
          {tripsIn.length > 0 && <div style={{ ...LIGHT, background: '#fff', border: '1.5px solid #d6dbe8', borderRadius: 12, padding: 8, marginTop: 8 }}><b>🚗 เที่ยวงานในช่วงนี้</b>{tripsIn.map((x) => <div key={x.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee' }}><span style={{ flex: 1, minWidth: 0 }}>{Number(x.date.slice(8))}/{x.date.slice(5, 7)} · <b>{x.title}</b> <small className="muted">· {name(x.vehicle)} · {km(Math.round(x.km * 1000))}{x.roundTrip ? ' ไป-กลับ' : ''} · {baht(x.km * rate(x.vehicle))}</small></span><button type="button" className="mini" aria-label={`ลบเที่ยว ${x.title}`} onClick={() => { if (window.confirm(`ลบเที่ยวงาน “${x.title}”?`)) tl.remove(x.id) }}>🗑</button></div>)}</div>}
          <p className="muted small">คำนวณจากระยะ คริสตจักร → จุดเช็คอิน → กลับ ตามถนนจริง (เส้นตรงถ้าคำนวณไม่ได้) เป็นค่าประมาณ ไม่ใช่ค่าน้ำมันที่จ่ายจริง</p>
        </>
      )}
    </section>
  )
}

/** ปุ่ม + หน้าต่างบันทึก “เที่ยวงาน” (สัมมนา/ไปรับของ ฯลฯ): เลือกรถ · เรื่อง · วันที่ · ระยะ (กรอกกม.เอง หรือวางพิกัดปลายทางให้คำนวณตามถนน) · ไป-กลับ */
export function TripLogButton({ ns = '' }: { ns?: string }) {
  const tl = useTripLogs(ns)
  const st = useSettings()
  const church: Coord | null = typeof st.settings.churchLat === 'number' && typeof st.settings.churchLng === 'number' ? { lat: st.settings.churchLat, lng: st.settings.churchLng } : null
  const base = typeof st.settings.fuelPerKm === 'number' ? st.settings.fuelPerKm : 3.5
  const [open, setOpen] = useState(false)
  const [vehicle, setVehicle] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayISO())
  const [round, setRound] = useState(true)
  const [kmTxt, setKmTxt] = useState('')
  const [destTxt, setDestTxt] = useState('')
  const [dest, setDest] = useState<Coord | null>(null)
  const [oneWay, setOneWay] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const reset = () => { setVehicle(''); setTitle(''); setDate(todayISO()); setRound(true); setKmTxt(''); setDestTxt(''); setDest(null); setOneWay(null); setErr('') }
  const calc = async () => {
    const c = parseCoords(destTxt)
    if (!c) return setErr('อ่านพิกัดปลายทางไม่ได้ — วางลิงก์ Google Maps หรือพิมพ์ เช่น 12.5684, 99.9577')
    if (!church) return setErr('ยังไม่ได้ตั้งพิกัดคริสตจักร (ตั้งในหน้ารายงานเส้นทาง → ตั้งค่า)')
    setErr(''); setBusy(true); setDest(c)
    const r = await fetchRoad(church, c)
    const m = r ? r.m : distanceM(church, c)
    setOneWay(m / 1000); setKmTxt(((m / 1000) * (round ? 2 : 1)).toFixed(1)); setBusy(false)
    if (!r) setErr('คำนวณตามถนนไม่ได้ — ใช้ระยะเส้นตรงแทน แก้เลขกิโลเมตรเองได้')
  }
  const kmNum = Number(kmTxt.replace(/,/g, ''))
  const rate = vehicleRate(st.settings.vehicleFuel, vehicle, base)
  const save = () => {
    if (!vehicle) return setErr('เลือกรถก่อน')
    if (!title.trim()) return setErr('ใส่เรื่อง/จุดประสงค์ของเที่ยวนี้')
    if (!Number.isFinite(kmNum) || kmNum <= 0) return setErr('ใส่ระยะทาง (กม.) หรือวางพิกัดปลายทางแล้วกด “คำนวณระยะ”')
    const me = getMe()
    if (tl.put([{ id: `trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, date, vehicle, title: title.trim(), km: Math.round(kmNum * 10) / 10, roundTrip: round, ...(dest ? { dest } : {}), by: me?.name ?? '', at: Date.now(), updated: 0 }])) { reset(); setOpen(false) }
    else setErr('บันทึกไม่ได้ (สิทธิ์ไม่พอ)')
  }
  return (
    <>
      <button type="button" className="btn btn--block no-print" style={{ marginBottom: 8 }} onClick={() => setOpen(true)}>🚗 บันทึกเที่ยวงาน (สัมมนา / ไปรับของ ฯลฯ)</button>
      {open && (
        <Sheet title="🚗 บันทึกเที่ยวงาน" onClose={() => setOpen(false)}>
          <p className="muted small" style={{ margin: 0 }}>รถคันไหนไป ค่าน้ำมันเป็นของคันนั้น (ไม่ต้องเลือกผู้ขับ) ยอดเข้ารายงานค่าน้ำมันรวมกับการเยี่ยม</p>
          <div className="field"><label>🚗 รถที่ใช้</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }} role="radiogroup" aria-label="รถ">
              {VEHICLES.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={vehicle === c.id} onClick={() => setVehicle(c.id)} style={{ ...LIGHT, background: '#fff', padding: 3, borderRadius: 10, border: `3px solid ${vehicle === c.id ? c.color : '#d6dbe8'}`, font: 'inherit', textAlign: 'center' }}>
                  <img src={c.img} alt={c.name} style={{ width: '100%', height: 44, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                  <div style={{ fontSize: 10.5, fontWeight: 700 }}>{c.name.replace('รถ', '')}{vehicle === c.id ? ' ✓' : ''}</div>
                </button>))}
            </div></div>
          <div className="field"><label htmlFor="tl-t">เรื่อง / จุดประสงค์</label><input id="tl-t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น สัมมนาที่ประจวบฯ · ไปรับของที่กรุงเทพ" /></div>
          <div className="field"><label htmlFor="tl-d">วันที่</label><input id="tl-d" type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
          <div className="seg seg--2" role="tablist" aria-label="เที่ยว"><button type="button" role="tab" aria-selected={round} className={round ? 'on' : ''} onClick={() => { setRound(true); if (oneWay) setKmTxt((oneWay * 2).toFixed(1)) }}>↔ ไป-กลับ</button><button type="button" role="tab" aria-selected={!round} className={!round ? 'on' : ''} onClick={() => { setRound(false); if (oneWay) setKmTxt(oneWay.toFixed(1)) }}>→ เที่ยวเดียว</button></div>
          <div className="field"><label htmlFor="tl-c">ปลายทาง (วางลิงก์ Google Maps / พิกัด — ให้ระบบคำนวณระยะตามถนนจากคริสตจักร)</label>
            <div className="row" style={{ gap: 6 }}><input id="tl-c" className="input grow" value={destTxt} onChange={(e) => setDestTxt(e.target.value)} placeholder="เช่น 11.8124, 99.7973" /><button type="button" className="btn" disabled={busy} onClick={() => void calc()}>{busy ? '…' : 'คำนวณระยะ'}</button></div></div>
          <div className="field"><label htmlFor="tl-k">ระยะทางรวมที่นับค่าน้ำมัน (กม.) — แก้เองได้</label><input id="tl-k" className="input" inputMode="decimal" value={kmTxt} onChange={(e) => setKmTxt(e.target.value)} placeholder="เช่น 560" />
            {vehicle && Number.isFinite(kmNum) && kmNum > 0 && <span className="small" role="status">⛽ ประมาณ <b>{baht(kmNum * rate)}</b> ({rate} บ./กม. · {vehicleOf(vehicle)?.name})</span>}</div>
          {err && <p role="alert" style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>}
          <button type="button" className="btn btn--gold btn--block" onClick={save}>✓ บันทึกเที่ยวงาน</button>
        </Sheet>
      )}
    </>
  )
}
