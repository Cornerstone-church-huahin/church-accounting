import { useEffect, useState } from 'react'
import { cachedImage } from '../lib/imageCache'
import { getBinary, getSync } from '../lib/sync'

/** รูปย่อเล็ก ๆ ของไฟล์ใน repo ข้อมูล (ใช้ในการ์ดรูปสมุดบัญชี) */
export default function Thumb({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let u = ''
    let dead = false
    const show = (b: Blob) => { if (dead) return; u = URL.createObjectURL(b); setUrl(u) }
    void (async () => {
      try {
        const c = await cachedImage(path)
        if (c) return show(c)
        const cfg = getSync()
        if (cfg) show(await getBinary(cfg, path))
      } catch { /* ไม่มีรูป = แสดงช่องว่าง */ }
    })()
    return () => { dead = true; if (u) URL.revokeObjectURL(u) }
  }, [path])
  return url ? <img src={url} alt={alt} loading="lazy" /> : <span className="thumb__ph" aria-hidden="true">🏦</span>
}
