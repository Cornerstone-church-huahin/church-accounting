import { lazy, Suspense, useState } from 'react'
import Sheet from './Sheet'
import { formatCoord, mapsLink, type Coord } from '../lib/geo'

const LeafletMap = lazy(() => import('./LeafletMap'))

/** ป๊อปอัพแผนที่เลือกตำแหน่งบ้าน: แตะแผนที่หรือลากหมุดไปที่หลังคาบ้าน · ใช้ตำแหน่งปัจจุบันได้ · กดบันทึกตำแหน่งเมื่อพอใจ */
export default function MapPickSheet({ initial, title = 'เลือกตำแหน่งบ้านบนแผนที่', onSave, onClose }: { initial?: Coord | null; title?: string; onSave: (c: Coord) => void; onClose: () => void }) {
  const [c, setC] = useState<Coord | null>(initial ?? null)
  const [msg, setMsg] = useState('')
  const here = () => {
    if (!navigator.geolocation) return setMsg('เครื่องนี้ไม่รองรับการหาตำแหน่ง')
    setMsg('กำลังหาตำแหน่ง…')
    navigator.geolocation.getCurrentPosition((p) => { setC({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }); setMsg('') }, () => setMsg('หาตำแหน่งไม่ได้ — อนุญาตการเข้าถึงตำแหน่งแล้วลองใหม่'), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>แตะบนแผนที่เพื่อวางหมุด หรือ <b>ลากหมุดสีแดงไปที่บ้าน</b> (ย่อ/ขยายแผนที่ได้) แล้วกด “บันทึกตำแหน่ง”</p>
      <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap label="เลือกตำแหน่งบ้านบนแผนที่ (แตะหรือลากหมุด)" height={320} pick={c} onPick={setC} /></Suspense>
      <p className="small" role="status" style={{ margin: 0 }}>{c ? <>ตำแหน่งที่เลือก {formatCoord(c)} · <a href={mapsLink(c)} target="_blank" rel="noreferrer">เปิดใน Google Maps</a></> : 'ยังไม่ได้เลือกตำแหน่ง'}{msg ? ` · ${msg}` : ''}</p>
      <div className="row">
        <button type="button" className="btn btn--ghost" onClick={here}>📍 ใช้ตำแหน่งปัจจุบัน</button>
        <button type="button" className="btn btn--gold" disabled={!c} onClick={() => c && onSave(c)}>✓ บันทึกตำแหน่ง</button>
      </div>
    </Sheet>
  )
}
