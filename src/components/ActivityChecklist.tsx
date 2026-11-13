import { useState } from 'react'
import VisitCamera, { type Shot } from './VisitCamera'
import MemberAvatar from './MemberAvatar'
import { activityId, activityLines } from '../lib/activityLines'
import { getMe } from '../lib/access'
import { useActivityLog } from '../lib/data'
import { mapsLink } from '../lib/geo'
import { removeMemberPhotoFile } from '../lib/memberPhoto'
import { uploadVisitPhoto } from '../lib/visitPhoto'

/**
 * รายการกิจกรรมของช่วงนั้น พร้อมช่องติ๊ก “ทำแล้ว”
 * ติ๊ก = เปิดกล้องในแอป ถ่ายรูปอย่างน้อย 1 รูป (บังคับ) — ตำแหน่งที่ถ่ายบันทึกเป็นการเช็คอินของกิจกรรมนั้นด้วย
 */
export default function ActivityChecklist({ date, slot, text, ns = '' }: { date: string; slot: string; text: string | undefined; ns?: string }) {
  const acts = useActivityLog(ns)
  const me = getMe()
  const lines = activityLines(text)
  const [cam, setCam] = useState<string | null>(null) // บรรทัดกิจกรรมที่กำลังถ่ายรูป
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
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
              {rec && (rec.photos?.length || rec.checkin) && (
                <div className="row" style={{ gap: 8, alignItems: 'center', marginLeft: 34, marginTop: 4 }}>
                  {rec.photos?.map((p) => <MemberAvatar key={p} path={p} name="📷" size={64} />)}
                  {rec.checkin && <a className="mini" href={mapsLink(rec.checkin)} target="_blank" rel="noreferrer">📍 เช็คอินแล้ว · เปิดแผนที่</a>}
                </div>)}
              {!rec && <div className="muted small" style={{ marginLeft: 34 }}>ติ๊กแล้วจะเปิดกล้อง — ต้องถ่ายรูป 1 รูป (บันทึกตำแหน่งเช็คอินให้อัตโนมัติ)</div>}
            </li>)
        })}
      </ul>
      {busy && <p className="muted small" role="status" style={{ margin: '4px 0 0' }}>กำลังแนบรูป…</p>}
      {err && <p className="error small" role="alert" style={{ margin: '4px 0 0' }}>{err}</p>}
      {cam && <VisitCamera who={cam} onShot={(s) => void done(cam, s)} onClose={() => setCam(null)} />}
    </>
  )
}
