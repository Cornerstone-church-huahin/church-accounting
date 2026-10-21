import { useEffect, useState } from 'react'
import { cachedImage } from './imageCache'
import { getBinary, getSync } from './sync'

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b) })

/** รูปใน repo ข้อมูล → data URL (ใช้ทำ PDF ได้ ไม่ติดข้อจำกัดข้ามโดเมน) · ยังโหลดไม่เสร็จ/ไม่มี = '' */
export function useStoredUrl(path?: string): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let live = true
    setUrl('')
    if (!path) return
    ;(async () => {
      try {
        const local = await cachedImage(path)
        const cfg = getSync()
        const b = local ?? (cfg ? await getBinary(cfg, path) : null)
        if (b && live) setUrl(await toDataUrl(b))
      } catch { /* ไม่มีรูป: ใช้หัวแบบข้อความแทน */ }
    })()
    return () => { live = false }
  }, [path])
  return url
}
