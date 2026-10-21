import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import { useLetterhead } from '../lib/data'
import { cacheImage } from '../lib/imageCache'
import { getSync, putBinary } from '../lib/sync'

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png'))

/** ตัดส่วนจากรูปตัวอย่าง (สัดส่วนความสูง 0–1) เป็นรูป PNG กว้างไม่เกิน 1400px */
export async function cropBand(img: HTMLImageElement, from: number, to: number): Promise<Blob> {
  const sw = img.naturalWidth, sy = Math.round(img.naturalHeight * from), sh = Math.max(1, Math.round(img.naturalHeight * (to - from)))
  const k = Math.min(1, 1400 / sw)
  const c = document.createElement('canvas')
  c.width = Math.round(sw * k); c.height = Math.round(sh * k)
  c.getContext('2d')?.drawImage(img, 0, sy, sw, sh, 0, 0, c.width, c.height)
  return toBlob(c)
}

/**
 * ตั้งค่าหัวจดหมาย/ท้ายจดหมาย (แอดมิน): เลือกรูปจดหมายตัวอย่างทั้งแผ่น แล้วเลื่อนเส้นเลือกส่วนหัวและส่วนท้าย
 * รูปถูกเก็บใน repo ข้อมูลส่วนตัวของคริสตจักร (ไม่อยู่ในโค้ดของแอป) และใช้เป็นหัว-ท้ายของเอกสารทุกฉบับ
 */
export default function LetterheadSetup({ onClose }: { onClose: () => void }) {
  const lh = useLetterhead()
  const [src, setSrc] = useState('')
  const [headEnd, setHeadEnd] = useState(14)
  const [footFrom, setFootFrom] = useState(89)
  const [footTo, setFootTo] = useState(96)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])
  const pick = (f?: File) => { if (f) { setSrc(URL.createObjectURL(f)); setMsg('') } }
  const save = async () => {
    const img = imgRef.current
    if (!img || !img.complete) return setMsg('เลือกรูปจดหมายตัวอย่างก่อน')
    if (footFrom <= headEnd) return setMsg('ส่วนท้ายต้องอยู่ต่ำกว่าส่วนหัว')
    setBusy(true); setMsg('')
    try {
      const cfg = getSync(), ts = Date.now().toString(36)
      const out: { header?: { path: string }; footer?: { path: string } } = {}
      for (const [key, from, to] of [['header', 0, headEnd / 100], ['footer', footFrom / 100, footTo / 100]] as const) {
        const blob = await cropBand(img, from, to), data = await blob.arrayBuffer()
        const path = `attachments/letterhead/${key}-${ts}.png`
        if (cfg) await putBinary(cfg, path, data, 'หัว-ท้ายจดหมาย')
        await cacheImage(path, data, 'image/png')
        out[key] = { path }
      }
      if (!lh.save(out)) return setMsg('ไม่มีสิทธิ์บันทึก — เฉพาะแอดมิน')
      onClose()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ') } finally { setBusy(false) }
  }
  return (
    <Sheet title="ตั้งค่าหัวจดหมาย" onClose={onClose}>
      <p className="muted small" style={{ margin: '0 0 0.5rem' }}>เลือกรูปจดหมายฉบับจริงทั้งแผ่น (ภาพถ่ายหน้าจอหรือสแกน) แล้วเลื่อนเส้นให้ครอบส่วน <b>หัวจดหมาย</b> (โลโก้-ชื่อ-ที่อยู่) และ <b>ท้ายจดหมาย</b> (ข้อมูลติดต่อ) — ระบบจะใช้สองส่วนนี้เป็นหัว-ท้ายของเอกสารทุกฉบับ</p>
      <input type="file" accept="image/*" aria-label="รูปจดหมายตัวอย่าง" onChange={(e) => pick(e.target.files?.[0])} />
      {src && (
        <div style={{ position: 'relative', margin: '0.6rem 0', lineHeight: 0 }}>
          <img ref={imgRef} src={src} alt="จดหมายตัวอย่าง" style={{ width: '100%', border: '1px solid var(--line)' }} />
          <div className="lhline" style={{ top: `${headEnd}%`, background: '#1f6feb' }} aria-hidden="true"><span>จบส่วนหัว</span></div>
          <div className="lhline" style={{ top: `${footFrom}%`, background: '#2f9e44' }} aria-hidden="true"><span>เริ่มส่วนท้าย</span></div>
          <div className="lhline" style={{ top: `${footTo}%`, background: '#c92a2a' }} aria-hidden="true"><span>จบส่วนท้าย</span></div>
        </div>
      )}
      {src && (
        <div className="field-grid" style={{ display: 'grid', gap: '0.4rem' }}>
          <label className="small">ส่วนหัวจบที่ {headEnd}% <input type="range" min={3} max={40} value={headEnd} onChange={(e) => setHeadEnd(Number(e.target.value))} style={{ width: '100%' }} aria-label="ส่วนหัวจบที่กี่เปอร์เซ็นต์" /></label>
          <label className="small">ส่วนท้ายเริ่มที่ {footFrom}% <input type="range" min={50} max={98} value={footFrom} onChange={(e) => setFootFrom(Number(e.target.value))} style={{ width: '100%' }} aria-label="ส่วนท้ายเริ่มที่กี่เปอร์เซ็นต์" /></label>
          <label className="small">ส่วนท้ายจบที่ {footTo}% <input type="range" min={55} max={100} value={footTo} onChange={(e) => setFootTo(Number(e.target.value))} style={{ width: '100%' }} aria-label="ส่วนท้ายจบที่กี่เปอร์เซ็นต์" /></label>
        </div>
      )}
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <button type="button" className="btn btn--gold" onClick={save} disabled={busy || !src}>{busy ? 'กำลังบันทึก…' : 'บันทึกหัว-ท้ายจดหมาย'}</button>
        <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
        {lh.value?.header && <button type="button" className="mini" onClick={() => { if (window.confirm('ล้างหัว-ท้ายจดหมายที่ตั้งไว้ ?')) { lh.save({}); onClose() } }}>ล้างที่ตั้งไว้</button>}
      </div>
    </Sheet>
  )
}
