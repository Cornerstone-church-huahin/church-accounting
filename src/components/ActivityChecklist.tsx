import { useMemo, useState } from 'react'
import MultiPick from './MultiPick'
import { isLive } from '../lib/pastoral'
import { usePeople } from '../lib/usePeople'
import Sheet from './Sheet'
import { useRole } from '../lib/members'
import { VEHICLES, inkOf, vehicleOf } from '../lib/vehicles'
import { formatCoord, parseCoords } from '../lib/geo'
import type { ActivityLog } from '../lib/types'
import VisitCamera, { type Shot } from './VisitCamera'
import MemberAvatar from './MemberAvatar'
import { activityId, activityLines } from '../lib/activityLines'
import { getMe } from '../lib/access'
import { useActivityLog, useChurchMembers } from '../lib/data'
import { mapsLink } from '../lib/geo'
import { removeMemberPhotoFile } from '../lib/memberPhoto'
import { uploadVisitPhoto } from '../lib/visitPhoto'

/**
 * รายการกิจกรรมของช่วงนั้น พร้อมช่องติ๊ก “ทำแล้ว”
 * ติ๊ก = เปิดกล้องในแอป ถ่ายรูปอย่างน้อย 1 รูป (บังคับ) — ตำแหน่งที่ถ่ายบันทึกเป็นการเช็คอินของกิจกรรมนั้นด้วย
 */
export default function ActivityChecklist({ date, slot, text, ns = '', vehicles = false }: { date: string; slot: string; text: string | undefined; ns?: string; /** หน้าที่ใช้รถ (แท็บใหม่/ทดลอง): แอดมินเลือกรถที่ใช้ได้ */ vehicles?: boolean }) {
  const acts = useActivityLog(ns)
  const me = getMe()
  const lines = activityLines(text)
  const [cam, setCam] = useState<string | null>(null) // บรรทัดกิจกรรมที่กำลังถ่ายรูป
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const isAdmin = useRole() === 'admin'
  const [fix, setFix] = useState<ActivityLog | null>(null) // แอดมินแก้รายการที่ทำแล้ว
  if (!lines.length) return <p className="muted small" style={{ margin: 0 }}>ยังไม่มีกิจกรรมที่วางแผนไว้ในช่วงนี้ — พิมพ์ได้ที่หน้า “วางแผน”</p>
  const done = async (line: string, shot: Shot) => {
    setCam(null); setBusy(true); setErr('')
    try {
      const p = await uploadVisitPhoto(new File([shot.blob], `act-${shot.at}.jpg`, { type: 'image/jpeg' }))
      const ok = acts.put([{ id: activityId(date, slot, line), date, slot, text: line, by: me?.name ?? '', at: shot.at, photos: [p], checkin: { lat: Math.round(shot.lat * 1e6) / 1e6, lng: Math.round(shot.lng * 1e6) / 1e6, ...(shot.acc ? { acc: Math.round(shot.acc) } : {}) }, updated: 0 }])
      if (!ok) { void removeMemberPhotoFile(p); setErr('บันทึกไม่ได้ (สิทธิ์ไม่พอ)') }
    } catch (e) { console.error('activity photo', e); setErr('แนบรูปไม่สำเร็จ ลองใหม่อีกครั้ง') }
    setBusy(false)
  }
  return (
    <>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }} aria-label="กิจกรรม">
        {lines.map((l) => {
          const id = activityId(date, slot, l), rec = acts.list.find((x) => x.id === id)
          return (
            <li key={id} style={{ padding: '4px 0' }}>
              <label className="row" style={{ gap: 10, alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 24, height: 24 }} disabled={busy} checked={!!rec} onChange={(e) => { if (e.target.checked) { setErr(''); setCam(l) } else { (rec?.photos ?? []).forEach((p) => void removeMemberPhotoFile(p)); acts.remove(id) } }} />
                <span style={{ flex: 1 }}>{l}</span>
                {rec && <small className="muted">✓ ทำแล้ว {new Date(rec.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.{rec.by ? ` · ${rec.by}` : ''}</small>}
              </label>
              {rec && !(rec.photos?.length || rec.checkin) && isAdmin && <div style={{ marginLeft: 34, marginTop: 4 }}><button type="button" className="mini" onClick={() => setFix(rec)}>✎ แก้ (แอดมิน) · เพิ่มรูป/พิกัด</button></div>}
              {rec && (rec.photos?.length || rec.checkin) && (
                <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 34, marginTop: 4 }}>
                  {rec.photos?.map((p) => <MemberAvatar key={p} path={p} name="📷" size={64} />)}
                  {(rec.doers?.length || rec.vehicle || rec.place) && <small className="muted" style={{ flexBasis: '100%' }}>{rec.doers?.length ? `👥 ${rec.doers.join(', ')}` : ''}{rec.vehicle ? ` · 🚗 ${vehicleOf(rec.vehicle)?.name ?? rec.vehicle}` : ''}{rec.place ? ` · 📌 ${rec.place}` : ''}</small>}
                  {rec.checkin && <a className="mini" href={mapsLink(rec.checkin)} target="_blank" rel="noreferrer">📍 เช็คอินแล้ว · เปิดแผนที่</a>}
                  {isAdmin && <button type="button" className="mini" onClick={() => setFix(rec)}>✎ แก้ (แอดมิน)</button>}
                </div>)}
              {!rec && <div className="muted small" style={{ marginLeft: 34 }}>ติ๊กแล้วจะเปิดกล้อง — ต้องถ่ายรูป 1 รูป (บันทึกตำแหน่งเช็คอินให้อัตโนมัติ)</div>}
            </li>)
        })}
      </ul>
      {busy && <p className="muted small" role="status" style={{ margin: '4px 0 0' }}>กำลังแนบรูป…</p>}
      {err && <p className="error small" role="alert" style={{ margin: '4px 0 0' }}>{err}</p>}
      {cam && <VisitCamera who={cam} onShot={(s) => void done(cam, s)} onClose={() => setCam(null)} />}
      {fix && <FixSheet rec={fix} vehicles={vehicles} onClose={() => setFix(null)} onSave={(next) => { if (acts.put([next])) setFix(null) }} />}
    </>
  )
}

/** แอดมินแก้กิจกรรมที่ทำแล้ว: รูป · พิกัดเช็คอิน (มีผลกับเส้นทาง/ระยะ/ค่าน้ำมันในรายงานเส้นทาง) · รถที่ใช้ (แท็บทดลอง) */
function FixSheet({ rec, vehicles, onClose, onSave }: { rec: ActivityLog; vehicles: boolean; onClose: () => void; onSave: (a: ActivityLog) => void }) {
  const [photos, setPhotos] = useState<string[]>(rec.photos ?? [])
  const [coord, setCoord] = useState(rec.checkin ? formatCoord(rec.checkin) : '')
  const [vehicle, setVehicle] = useState(rec.vehicle ?? '')
  const [doers, setDoers] = useState<string[]>(rec.doers ?? [])
  const [place, setPlace] = useState(rec.place ?? '')
  const members = useChurchMembers()
  const people = usePeople(useMemo(() => members.items.filter((m) => !m.deleted && isLive(m)), [members.items]))
  const [cam, setCam] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const added = useState<string[]>([])[0]
  const addShot = async (shot: Shot) => {
    setCam(false); setBusy(true); setErr('')
    try {
      const p = await uploadVisitPhoto(new File([shot.blob], `act-${shot.at}.jpg`, { type: 'image/jpeg' }))
      added.push(p); setPhotos((xs) => [...xs, p].slice(0, 2))
      if (!coord.trim()) setCoord(formatCoord({ lat: Math.round(shot.lat * 1e6) / 1e6, lng: Math.round(shot.lng * 1e6) / 1e6 }))
    } catch { setErr('แนบรูปไม่สำเร็จ ลองใหม่อีกครั้ง') }
    setBusy(false)
  }
  /** แอดมิน: เลือกรูปจากอัลบั้มในเครื่องได้ (ไม่ต้องถ่ายใหม่) */
  const pickFile = async (f: File | undefined) => {
    if (!f || photos.length >= 2) return
    setBusy(true); setErr('')
    try { const p = await uploadVisitPhoto(f); added.push(p); setPhotos((xs) => [...xs, p].slice(0, 2)) } catch { setErr('แนบรูปไม่สำเร็จ ลองใหม่อีกครั้ง') }
    setBusy(false)
  }
  const here = () => {
    if (!navigator.geolocation) return setErr('เครื่องนี้ไม่รองรับการหาตำแหน่ง')
    setBusy(true); setErr('')
    navigator.geolocation.getCurrentPosition((p) => { setBusy(false); setCoord(formatCoord({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 })) }, () => { setBusy(false); setErr('หาตำแหน่งไม่ได้ — เปิด GPS แล้วลองใหม่') }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }
  const save = () => {
    const c = coord.trim() ? parseCoords(coord) : null
    if (coord.trim() && !c) return setErr('อ่านพิกัดไม่ได้ (เช่น 12.5684, 99.9577)')
    ;(rec.photos ?? []).filter((p) => !photos.includes(p)).forEach((p) => void removeMemberPhotoFile(p))
    added.filter((p) => !photos.includes(p)).forEach((p) => void removeMemberPhotoFile(p))
    const { checkin: _c, photos: _p, vehicle: _v, doers: _d, place: _pl, ...rest } = rec
    void _c; void _p; void _v; void _d; void _pl
    onSave({ ...rest, ...(photos.length ? { photos } : {}), ...(c ? { checkin: { lat: c.lat, lng: c.lng } } : {}), ...(vehicle ? { vehicle } : {}), ...(doers.length ? { doers } : {}), ...(place.trim() ? { place: place.trim() } : {}) })
  }
  return (
    <Sheet title="✎ แก้กิจกรรม (แอดมิน)" onClose={onClose}>
      <p style={{ margin: 0 }}><b>{rec.text}</b></p>
      <div className="field"><label>📸 รูป (สูงสุด 2 รูป)</label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {photos.map((p) => <span key={p} style={{ position: 'relative', display: 'inline-block' }}><MemberAvatar path={p} name="📷" size={84} /><button type="button" className="mini" aria-label="ลบรูป" style={{ position: 'absolute', top: -6, right: -6 }} onClick={() => setPhotos((xs) => xs.filter((x) => x !== p))}>✕</button></span>)}
          {photos.length < 2 && <button type="button" className="btn" disabled={busy} onClick={() => setCam(true)}>📸 ถ่ายรูป</button>}
          {photos.length < 2 && <label className="btn" style={{ cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>🖼️ เลือกจากอัลบั้ม<input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pickFile(f) }} /></label>}
        </div></div>
      <div className="field"><label htmlFor="fx-c">📍 พิกัดเช็คอิน (แก้แล้วเส้นทางและค่าน้ำมันคำนวณใหม่ตามพิกัดนี้)</label>
        <input id="fx-c" className="input" inputMode="decimal" value={coord} onChange={(e) => setCoord(e.target.value)} placeholder="เช่น 12.5684, 99.9577" />
        <div className="row" style={{ gap: 6, marginTop: 4 }}><button type="button" className="mini" disabled={busy} onClick={here}>📍 ใช้ตำแหน่งปัจจุบัน</button>{parseCoords(coord) && <a className="mini" href={mapsLink(parseCoords(coord)!)} target="_blank" rel="noreferrer">เปิดแผนที่</a>}</div></div>
      <div className="field"><label htmlFor="fx-by">👥 ผู้ไปทำกิจกรรม (เลือกได้หลายคน · ค้นจากทะเบียน)</label>
        <MultiPick id="fx-by" title="ผู้ไปทำกิจกรรม" options={doers.map(people.optOf)} value={doers} onChange={setDoers} empty="— เลือกผู้ไปทำกิจกรรม —" search={{ find: people.find, placeholder: '🔎 ชื่อจริง / นามสกุล / ชื่อเล่น / ญาติ' }} />
        {doers.length > 0 && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>{doers.map((n) => { const m = people.byName.get(n); return <span key={n} className="row" style={{ gap: 4, alignItems: 'center', border: '1.5px solid #d6dbe8', borderRadius: 999, padding: '2px 10px 2px 3px' }}><MemberAvatar path={m?.photoPath} name={n} size={28} member={m} /><b className="small">{n}</b></span> })}</div>}</div>
      <div className="field"><label htmlFor="fx-pl">📌 ไปทำที่ไหน (ชื่อสถานที่)</label><input id="fx-pl" className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="เช่น ตลาดนัดหัวหิน" /></div>
      {vehicles && <div className="field"><label>🚗 รถที่ใช้ไปทำกิจกรรมนี้</label>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="รถ">
          {VEHICLES.map((v) => <button key={v.id} type="button" role="radio" aria-checked={vehicle === v.id} className={`btn ${vehicle === v.id ? 'btn--gold' : 'btn--ghost'}`} style={{ borderColor: inkOf(v.color) }} onClick={() => setVehicle(vehicle === v.id ? '' : v.id)}>{v.name}</button>)}
        </div></div>}
      {busy && <p className="muted small" role="status" style={{ margin: 0 }}>กำลังทำงาน…</p>}
      {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button type="button" className="btn btn--gold btn--block" disabled={busy} onClick={save}>✓ บันทึกการแก้ไข</button>
      {cam && <VisitCamera who={rec.text} onShot={(s) => void addShot(s)} onClose={() => setCam(false)} />}
    </Sheet>
  )
}
