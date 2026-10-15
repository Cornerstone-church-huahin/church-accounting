import { useEffect, useRef, useState } from 'react'
import { cacheImage, cachedImage } from '../lib/imageCache'
import { getBinary, getSync } from '../lib/sync'

/** รูปในรายชื่อ: โหลดเฉพาะแถวที่เลื่อนมาถึง · สำเนาในเครื่อง (IndexedDB) กันดึง GitHub ซ้ำ · โหลดพร้อมกันไม่เกิน 4 รูป */
const urls = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()
let active = 0
const waiting: (() => void)[] = []
const slot = () => new Promise<void>((res) => { if (active < 4) { active++; res() } else waiting.push(() => { active++; res() }) })
const release = () => { active--; waiting.shift()?.() }

function loadUrl(path: string): Promise<string | null> {
  const hit = urls.get(path)
  if (hit) return Promise.resolve(hit)
  const run = pending.get(path) ?? (async () => {
    await slot()
    try {
      let blob = await cachedImage(path)
      if (!blob) {
        const cfg = getSync()
        if (!cfg) return null
        blob = await getBinary(cfg, path)
        void cacheImage(path, await blob.arrayBuffer(), blob.type || 'image/jpeg')
      }
      const u = URL.createObjectURL(blob)
      urls.set(path, u)
      return u
    } catch { return null } finally { release(); pending.delete(path) }
  })()
  pending.set(path, run)
  return run
}

export default function MemberAvatar({ path, name, size = 44 }: { path?: string; name: string; size?: number }) {
  const box = useRef<HTMLSpanElement>(null)
  const [seen, setSeen] = useState(false)
  const [url, setUrl] = useState<string | null>(path ? urls.get(path) ?? null : null)
  useEffect(() => {
    if (!path || seen || !box.current) return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(box.current)
    return () => io.disconnect()
  }, [path, seen])
  useEffect(() => {
    if (!path || !seen) return
    let live = true
    loadUrl(path).then((u) => { if (live) setUrl(u) })
    return () => { live = false }
  }, [path, seen])
  const style = { width: size, height: size, borderRadius: size >= 44 ? 14 : '50%', flex: 'none', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 700, fontSize: size * 0.42 } as const
  return (
    <span ref={box} style={style} aria-hidden>
      {url ? <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (name.trim().charAt(0) || '👤')}
    </span>
  )
}
