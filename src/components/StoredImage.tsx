import { useEffect, useState } from 'react'

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b) })
import { getBinary, getSync } from '../lib/sync'
import { cachedImage } from '../lib/imageCache'

/** รูปที่เก็บใน repo ข้อมูล (บิล/ใบเสร็จ/สลิป): ดึงมาแสดงเมื่อเปิดดู */
export default function StoredImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    const cfg = getSync()
    if (!path) { setErr('ไม่ได้เก็บรูป (โหมดทดลอง)'); return }
    let u = ''
    if (!cfg) { // โหมดทดลอง: ดูได้เฉพาะรูปที่เก็บไว้ในเครื่องนี้
      cachedImage(path).then(async (b) => { if (b) setUrl(await toDataUrl(b)); else setErr('ต้องเชื่อมต่อออนไลน์จึงจะเปิดดูรูปได้') })
      return () => { if (u) URL.revokeObjectURL(u) }
    }
    getBinary(cfg, path).then(async (b) => setUrl(await toDataUrl(b))).catch((e: Error) => setErr(e.message))
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [path])
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={alt} style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8 }} /></a> : <p className="muted small">{err || 'กำลังโหลดรูป…'}</p>
}

/** รูปที่เพิ่งเลือก (ยังไม่ได้อัปโหลด) */
export function LocalImage({ file, alt }: { file: File; alt: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u) }, [file])
  return url ? <img src={url} alt={alt} style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 8 }} /> : null
}
