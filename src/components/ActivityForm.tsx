import { useRef, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import Sheet from './Sheet'
import VehicleGrid from './VehicleGrid'
import VisitCamera, { type Shot } from './VisitCamera'
import VisitorPick from './VisitorPick'
import { useSettings } from '../lib/data'
import { distanceM, formatCoord, mapsLink } from '../lib/geo'
import { removeMemberPhotoFile } from '../lib/memberPhoto'
import { NO_CAR } from '../lib/vehicles'
import { MAX_SHOT_FROM_CHECKIN_M, nearCheckin } from '../lib/visitProof'
import { MAX_VISIT_PHOTOS, uploadVisitPhoto } from '../lib/visitPhoto'

export interface ActivityFormResult { at: number; checkin: { lat: number; lng: number; acc?: number }; photos: string[]; vehicle: string; doers: string[]; place?: string; note?: string }

/**
 * ฟอร์ม “บันทึกกิจกรรม” ทีละรายการ เรียงขั้นเหมือนฟอร์มบันทึกการเยี่ยม:
 * กิจกรรม → รถ → ผู้ไปทำ → สถานที่/หมายเหตุ → เช็คอินพิกัด + ถ่ายรูป (บังคับ) → ปุ่มเขียวบันทึก
 * ผู้ทำรับผิดชอบกรอกเอง · 1 กิจกรรม = 1 การเช็คอิน (ไปหลายจุดต่อเนื่อง = บันทึกทีละกิจกรรม ระบบต่อเป็นเส้นทางเดียวให้)
 */
export default function ActivityForm({ line, vehicles, onClose, onSave }: { line: string; vehicles: boolean; onClose: () => void; onSave: (r: ActivityFormResult) => void }) {
  const st = useSettings().settings
  const [vehicle, setVehicle] = useState(NO_CAR)
  const [doers, setDoers] = useState<string[]>([])
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [checkin, setCheckin] = useState<{ lat: number; lng: number; acc?: number; at: number } | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [local, setLocal] = useState<Record<string, string>>({})
  const [cam, setCam] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loc, setLoc] = useState(false)
  const [err, setErr] = useState('')
  const added = useRef<string[]>([])
  const saved = useRef(false)

  const close = () => { if (!saved.current) added.current.forEach((p) => void removeMemberPhotoFile(p)); onClose() }
  const locate = () => {
    if (!navigator.geolocation) return setErr('เครื่องนี้ไม่รองรับการหาตำแหน่ง')
    setLoc(true); setErr('')
    navigator.geolocation.getCurrentPosition((p) => {
      setLoc(false)
      const c = { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, acc: Math.round(p.coords.accuracy), at: Date.now() }
      if (typeof st.churchLat === 'number' && typeof st.churchLng === 'number' && distanceM(c, { lat: st.churchLat, lng: st.churchLng }) <= 150
        && !window.confirm('⚠️ จุดเช็คอินอยู่ใกล้คริสตจักร (ไม่เกิน 150 เมตร)\nถึงที่ทำกิจกรรมจริงแล้วหรือยัง?\n\nกด “ตกลง” = ใช้จุดนี้ · “ยกเลิก” = ยังไม่เช็คอิน')) return
      setCheckin(c)
    }, () => { setLoc(false); setErr('หาตำแหน่งไม่ได้ — เปิด GPS และอนุญาตให้แอปใช้ตำแหน่ง แล้วกดเช็คอินอีกครั้ง') }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }
  const addShot = async (shot: Shot) => {
    setCam(false)
    if (photos.length >= MAX_VISIT_PHOTOS || !checkin) return
    const n = nearCheckin({ lat: shot.lat, lng: shot.lng }, checkin)
    if (!n.ok) return setErr(`ตำแหน่งที่ถ่ายห่างจากจุดเช็คอิน ${n.meters} เมตร (ต้องไม่เกิน ${MAX_SHOT_FROM_CHECKIN_M} เมตร) — ถ่ายที่จุดเช็คอิน หรือเช็คอินใหม่ที่จุดที่ถ่าย`)
    setBusy(true); setErr('')
    try {
      const p = await uploadVisitPhoto(new File([shot.blob], `act-${shot.at}.jpg`, { type: 'image/jpeg' }))
      added.current.push(p)
      setPhotos((xs) => [...xs, p].slice(0, MAX_VISIT_PHOTOS))
      try { const u = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(shot.blob) }); setLocal((m) => ({ ...m, [p]: u })) } catch { /* ใช้ตัวโหลดปกติ */ }
    } catch { setErr('แนบรูปไม่สำเร็จ ลองใหม่อีกครั้ง') }
    setBusy(false)
  }
  const drop = (p: string) => { setPhotos((xs) => xs.filter((x) => x !== p)); added.current = added.current.filter((x) => x !== p); void removeMemberPhotoFile(p) }
  const save = () => {
    if (busy || loc) return setErr('รอสักครู่')
    const miss = [...(!doers.length ? ['👥 ผู้ไปทำกิจกรรม — เลือกอย่างน้อย 1 คน'] : []), ...(!checkin ? ['📍 พิกัด — กด “เช็คอินตำแหน่ง”'] : []), ...(!photos.length ? ['📸 รูปถ่าย — ถ่ายอย่างน้อย 1 รูป (หลังเช็คอิน)'] : [])]
    if (miss.length) return setErr(`ยังขาด:\n${miss.join('\n')}`)
    saved.current = true
    onSave({ at: checkin!.at, checkin: { lat: checkin!.lat, lng: checkin!.lng, ...(checkin!.acc ? { acc: checkin!.acc } : {}) }, photos, vehicle: vehicles ? vehicle || NO_CAR : NO_CAR, doers, ...(place.trim() ? { place: place.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) })
  }
  return (
    <Sheet title="📋 บันทึกกิจกรรม" onClose={close}>
      <div style={{ border: '2px solid #e0b100', borderRadius: 12, padding: '8px 12px', background: '#fff8e6', color: '#1a2b4c' }}><b>{line}</b></div>
      {vehicles && <div className="field"><label>🚗 ยานพาหนะที่ใช้ (เลือกรถก่อน · ค่าเริ่มต้น ไม่ใช้รถ)</label><VehicleGrid value={vehicle} onChange={setVehicle} /></div>}
      <div className="field"><label htmlFor="af-by">👥 ผู้ไปทำกิจกรรม — ติ๊กชื่อทุกคนที่ไป (ค้นจากทะเบียนได้)</label>
        <VisitorPick id="af-by" title="ผู้ไปทำกิจกรรม" value={doers} onChange={setDoers} empty="— เลือกผู้ไปทำกิจกรรม —" /></div>
      <div className="field"><label htmlFor="af-pl">📌 ชื่อสถานที่ที่ไปทำกิจกรรมจุดนี้</label><input id="af-pl" className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="ชื่อสถานที่ ถ้ามี" /></div>
      <div className="field"><label htmlFor="af-nt">หมายเหตุ</label><textarea id="af-nt" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ซื้อของ 12 รายการ · ไปรับของ" /></div>
      <div className="field"><label>เช็คอินตำแหน่ง (บังคับ)</label>
        <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className={`btn ${checkin ? '' : 'btn--gold'}`} disabled={loc} onClick={locate}>{loc ? 'กำลังหาตำแหน่ง…' : checkin ? '📍 เช็คอินตำแหน่งใหม่' : '📍 เช็คอินตำแหน่ง'}</button>
          <button type="button" className={`btn ${photos.length ? '' : 'btn--gold'}`} disabled={busy || photos.length >= MAX_VISIT_PHOTOS} onClick={() => { if (!checkin) { setErr('เช็คอินตำแหน่งก่อน แล้วจึงถ่ายรูป'); return } setCam(true) }}>{busy ? 'กำลังแนบรูป…' : photos.length ? `📸 ถ่ายรูปเพิ่ม (${photos.length}/${MAX_VISIT_PHOTOS})` : '📸 ถ่ายรูป (บังคับ)'}</button>
          {checkin && <a className="mini" href={mapsLink(checkin)} target="_blank" rel="noreferrer">เปิดใน Google Maps</a>}
        </div>
        <span className="muted small" role="status">{checkin ? `✓ เช็คอินแล้ว ${formatCoord(checkin)}${checkin.acc ? ` (±${checkin.acc} ม.)` : ''}` : 'ยังไม่ได้เช็คอิน — ไปถึงที่ทำกิจกรรมแล้วกดปุ่มเช็คอิน'}</span>
        {photos.length > 0 && <div className="pvphotos" style={{ marginTop: 8 }}>{photos.map((p, i) => (
          <span key={p} className="pvphoto">{local[p] ? <img src={local[p]} alt={`รูปที่ ${i + 1}`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, border: '2px solid #1e8e3e' }} /> : <MemberAvatar path={p} name="📷" size={96} />}<button type="button" className="pvphoto__x" aria-label={`ลบรูปที่ ${i + 1}`} onClick={() => drop(p)}>✕</button></span>))}</div>}
      </div>
      {cam && <VisitCamera who={line} onShot={(s) => void addShot(s)} onClose={() => setCam(false)} />}
      {err && <p className="error small" role="alert" style={{ margin: 0, whiteSpace: 'pre-line' }}>{err}</p>}
      <button type="button" className="btn" style={{ background: '#1e8e3e', borderColor: '#1e8e3e', color: '#fff', fontWeight: 800, fontSize: '1.1rem' }} onClick={save}>📍 บันทึกและเช็คอินกิจกรรม</button>
    </Sheet>
  )
}
