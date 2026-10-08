import { useEffect, useState } from 'react'
import { getBinary, getSync } from '../lib/sync'

/** รูปที่เก็บใน repo ข้อมูล (บิล/ใบเสร็จ/สลิป): ดึงมาแสดงเมื่อเปิดดู */
export default function StoredImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    const cfg = getSync()
    if (!path) { setErr('ไม่ได้เก็บรูป (โหมดทดลอง)'); return }
    if (!cfg) { setErr('ต้องเชื่อมต่อออนไลน์จึงจะเปิดดูรูปได้'); return }
    let u = ''
    getBinary(cfg, path).then((b) => { u = URL.createObjectURL(b); setUrl(u) }).catch((e: Error) => setErr(e.message))
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
