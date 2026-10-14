import { useEffect, useState } from 'react'
import { getBinary, getSync } from '../lib/sync'

/** ดูรูปบิล/สลิปแบบเต็มจอ + พิมพ์ · แชร์ · บันทึก (แตะรูปในช่องหมายเหตุของใบเบิก-จ่าย) */
export default function ImageViewer({ path, name, title, onClose }: { path: string; name: string; title: string; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const cfg = getSync()
    if (!path) { setErr('ไม่ได้เก็บรูป (โหมดทดลอง — ยังไม่ได้เชื่อมต่อออนไลน์ตอนแนบ)'); return }
    if (!cfg) { setErr('ต้องเชื่อมต่อออนไลน์จึงจะเปิดดูรูปได้'); return }
    let u = ''
    getBinary(cfg, path).then((b) => { u = URL.createObjectURL(b); setBlob(b); setUrl(u) }).catch((e: Error) => setErr(e.message))
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [path])
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  const fileName = name || `bill-${Date.now()}.jpg`
  const asFile = () => (blob ? new File([blob], fileName, { type: blob.type || 'image/jpeg' }) : null)

  const print = () => {
    if (!url) return
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
    f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:10mm}body{margin:0}img{max-width:100%;max-height:277mm;display:block;margin:0 auto}</style></head><body><img src="${url}" onload="window.focus();window.print()"></body></html>`
    document.body.appendChild(f)
    window.setTimeout(() => f.remove(), 60_000)
  }
  const save = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = fileName
    document.body.appendChild(a); a.click(); a.remove()
    setMsg('บันทึกรูปแล้ว (ดูในโฟลเดอร์ดาวน์โหลด)')
  }
  const share = async () => {
    const f = asFile()
    if (!f) return
    try {
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title })
      else if (navigator.share) await navigator.share({ title, text: title, url: location.href })
      else { save(); setMsg('เครื่องนี้ยังแชร์โดยตรงไม่ได้ จึงบันทึกรูปให้แทน') }
    } catch (e) { if ((e as Error).name !== 'AbortError') setMsg('แชร์ไม่สำเร็จ ลองกดบันทึกแทน') }
  }

  return (
    <div className="imgviewer no-print" role="dialog" aria-modal="true" aria-label={`ดูรูปแนบ: ${title}`} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,12,24,.94)', display: 'flex', flexDirection: 'column' }}>
      <div className="row row--between" style={{ padding: '10px 12px', color: '#fff', gap: 8 }}>
        <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</b>
        <button type="button" className="mini" onClick={onClose} aria-label="ปิดรูป">✕ ปิด</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, overflow: 'auto' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
        {url ? <img src={url} alt={title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <p style={{ color: '#fff', textAlign: 'center' }} role="status">{err || 'กำลังโหลดรูป…'}</p>}
      </div>
      {msg && <p role="status" style={{ color: '#fff', textAlign: 'center', margin: '4px 0' }} className="small">{msg}</p>}
      <div className="row" style={{ padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', gap: 8 }}>
        <button type="button" className="btn btn--gold grow" disabled={!url} onClick={print}>🖨 พิมพ์</button>
        <button type="button" className="btn btn--gold grow" disabled={!url} onClick={() => void share()}>📤 แชร์</button>
        <button type="button" className="btn btn--gold grow" disabled={!url} onClick={save}>💾 บันทึก</button>
      </div>
    </div>
  )
}
