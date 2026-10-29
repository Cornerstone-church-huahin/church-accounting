import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { freshFile, stampText } from '../lib/visitProof'

export interface Shot { blob: Blob; at: number; lat: number; lng: number; acc?: number; src: 'live' | 'camera-file' }

const getPosition = () => new Promise<GeolocationPosition>((res, rej) => {
  if (!navigator.geolocation) return rej(new Error('เครื่องนี้ไม่รองรับการหาตำแหน่ง'))
  navigator.geolocation.getCurrentPosition(res, () => rej(new Error('หาตำแหน่งตอนถ่ายไม่ได้ — เปิด GPS และอนุญาตให้แอปใช้ตำแหน่ง แล้วถ่ายใหม่')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
})
/** วาดรูป + แถบข้อความ วันที่เวลา/พิกัด ประทับลงในภาพจริง (ปลอมแต่งทีหลังไม่ได้ง่าย ๆ) */
async function stamp(src: CanvasImageSource, w: number, h: number, text: string): Promise<Blob> {
  const scale = Math.min(1, 1280 / Math.max(w, h))
  const cw = Math.round(w * scale), ch = Math.round(h * scale)
  const c = document.createElement('canvas'); c.width = cw; c.height = ch
  const g = c.getContext('2d'); if (!g) throw new Error('ประมวลผลรูปไม่ได้บนเครื่องนี้')
  g.drawImage(src, 0, 0, cw, ch)
  const fs = Math.max(18, Math.round(cw / 26)), pad = Math.round(fs * 0.5)
  g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(0, ch - fs - pad * 2, cw, fs + pad * 2)
  g.fillStyle = '#fff'; g.font = `${fs}px sans-serif`; g.textBaseline = 'middle'
  g.fillText(text, pad, ch - fs / 2 - pad, cw - pad * 2)
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.88))
  if (!b) throw new Error('บันทึกรูปไม่ได้')
  return b
}

/**
 * ถ่ายรูปเยี่ยมบ้านด้วยกล้องในแอปเท่านั้น (ไม่มีทางเลือกรูปจากคลังภาพ): กดถ่าย → บันทึกเวลา + พิกัด ณ ตอนนั้น และประทับลงบนรูป
 * กล้องในแอปเปิดไม่ได้ (ไม่อนุญาต/เครื่องไม่รองรับ) → ใช้กล้องของเครื่องผ่านช่อง capture โดยตรวจว่าไฟล์เพิ่งถ่ายภายใน 2 นาที
 */
export default function VisitCamera({ who, onShot, onClose }: { who?: string; onShot: (s: Shot) => void; onClose: () => void }) {
  const vid = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [live, setLive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null }
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api')
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (dead) { s.getTracks().forEach((t) => t.stop()); return }
        stream.current = s
        if (vid.current) { vid.current.srcObject = s; await vid.current.play().catch(() => undefined) }
        setReady(true)
      } catch { if (!dead) setLive(false) }
    })()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { stop(); onClose() } }
    window.addEventListener('keydown', esc)
    return () => { dead = true; stop(); window.removeEventListener('keydown', esc) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const done = (s: Shot) => { stop(); onShot(s) }
  const snap = async () => {
    const v = vid.current; if (!v || !v.videoWidth) return setErr('กล้องยังไม่พร้อม รอสักครู่')
    setBusy(true); setErr('')
    try {
      const at = Date.now(), p = await getPosition()
      const blob = await stamp(v, v.videoWidth, v.videoHeight, stampText(at, { lat: p.coords.latitude, lng: p.coords.longitude }, p.coords.accuracy, who))
      done({ blob, at, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, src: 'live' })
    } catch (e) { setErr(e instanceof Error ? e.message : 'ถ่ายรูปไม่สำเร็จ'); setBusy(false) }
  }
  const fromDeviceCamera = async (f?: File) => {
    if (!f) return
    setBusy(true); setErr('')
    try {
      const now = Date.now()
      if (!freshFile(f.lastModified, now)) throw new Error('รูปนี้ไม่ได้เพิ่งถ่าย — ต้องถ่ายใหม่ด้วยกล้องตอนนี้เท่านั้น (เลือกรูปเก่าไม่ได้)')
      const p = await getPosition()
      const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' })
      const at = f.lastModified
      const blob = await stamp(bmp, bmp.width, bmp.height, stampText(at, { lat: p.coords.latitude, lng: p.coords.longitude }, p.coords.accuracy, who))
      bmp.close()
      done({ blob, at, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, src: 'camera-file' })
    } catch (e) { setErr(e instanceof Error ? e.message : 'ถ่ายรูปไม่สำเร็จ'); setBusy(false) }
  }
  return createPortal(
    <div className="vcam no-print" role="dialog" aria-modal="true" aria-label="ถ่ายรูปการเยี่ยม">
      <div className="vcam__box">
        {live
          ? <video ref={vid} className="vcam__vid" playsInline muted aria-label="ภาพจากกล้อง" />
          : (
            <div className="vcam__fallback">
              <p style={{ margin: 0 }}>เปิดกล้องในแอปไม่ได้ (อาจยังไม่ได้อนุญาตกล้อง) — ใช้กล้องของเครื่องแทน: กดปุ่มด้านล่างแล้วถ่ายรูปใหม่ตอนนี้ <b>เลือกรูปจากคลังภาพไม่ได้</b></p>
              <label className="btn btn--gold bigbtn">📷 เปิดกล้องของเครื่อง<input type="file" accept="image/*" capture="environment" aria-label="เปิดกล้องของเครื่อง" style={{ display: 'none' }} onChange={(e) => { void fromDeviceCamera(e.target.files?.[0]); e.target.value = '' }} /></label>
            </div>
          )}
        <p className="small vcam__hint" role="status">{busy ? 'กำลังบันทึกเวลาและตำแหน่ง…' : 'รูปจะถูกประทับวันที่ เวลา และพิกัดตอนถ่าย'}</p>
        {err && <p role="alert" className="small vcam__err">{err}</p>}
        <div className="row row--between">
          <button type="button" className="mini" onClick={() => { stop(); onClose() }}>ยกเลิก</button>
          {live && <button type="button" className="btn btn--gold bigbtn" disabled={!ready || busy} onClick={() => void snap()}>📸 ถ่ายภาพ</button>}
        </div>
      </div>
    </div>, document.body)
}
