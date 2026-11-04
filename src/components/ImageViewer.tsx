import { useEffect, useState } from 'react'
import { getBinary, getSync } from '../lib/sync'
import ImageTools from './ImageTools'

/** ดูรูปบิล/สลิปแบบเต็มจอ + พิมพ์ · แชร์ · บันทึก · แก้ไข (เปลี่ยนรูป/ลบรูป) (แตะรูปในช่องหมายเหตุของใบเบิก-จ่าย) */
export default function ImageViewer({ path, name, title, onClose, onReplace, onRemove }: { path: string; name: string; title: string; onClose: () => void; /** ใส่มา = มีปุ่ม แก้ไข > เปลี่ยนรูป */ onReplace?: (f: File) => Promise<void>; /** ใส่มา = มีปุ่ม แก้ไข > ลบรูป */ onRemove?: () => Promise<void> }) {
  const [menu, setMenu] = useState(false)
  const [askDel, setAskDel] = useState(false)
  const [busy, setBusy] = useState(false)
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
  const run = async (job: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg('')
    try { await job(); setMenu(false); setAskDel(false); if (ok) setMsg(ok) } catch (e) { setMsg(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ') } finally { setBusy(false) }
  }
  const fileName = name || `bill-${Date.now()}.jpg`

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
      <div style={{ padding: '8px 12px calc(10px + env(safe-area-inset-bottom))', display: 'grid', gap: 8 }}>
        {blob ? <ImageTools load={async () => [blob]} title={title} base={fileName.replace(/\.[^.]+$/, '')} /> : <p className="small" style={{ color: '#fff', textAlign: 'center', margin: 0 }}>รอโหลดรูปก่อนจึงจะดาวน์โหลด/แชร์/พิมพ์ได้</p>}
        {(onReplace || onRemove) && <button type="button" className="btn btn--gold" disabled={busy} onClick={() => setMenu(true)} aria-label="แก้ไขรูป">✎ แก้ไข</button>}
      </div>
      {menu && (
        <div role="dialog" aria-label="แก้ไขรูป" style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(8,12,24,.6)', display: 'flex', alignItems: 'flex-end' }} onClick={(e) => e.target === e.currentTarget && !busy && (setMenu(false), setAskDel(false))}>
          <div className="card" style={{ width: '100%', borderRadius: '1.2rem 1.2rem 0 0', display: 'grid', gap: '0.6rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="row row--between"><h2 style={{ margin: 0 }}>{askDel ? 'ลบรูปนี้?' : 'แก้ไขรูป'}</h2><button type="button" className="mini" disabled={busy} onClick={() => { setMenu(false); setAskDel(false) }}>ปิด</button></div>
            {askDel ? (
              <>
                <p style={{ margin: 0 }}>ลบรูปของ “{title}” ออกจากรายการนี้ใช่ไหม? (รายการและยอดเงินยังอยู่ ลบเฉพาะรูป)</p>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <button type="button" className="btn btn--ghost bigbtn grow" disabled={busy} onClick={() => setAskDel(false)}>ไม่ลบ</button>
                  <button type="button" className="btn btn--danger bigbtn grow" disabled={busy} onClick={() => onRemove && void run(onRemove, '')}>{busy ? 'กำลังลบ…' : 'ลบรูป'}</button>
                </div>
              </>
            ) : (
              <>
                {onReplace && <label className="btn btn--gold bigbtn btn--block" style={{ cursor: 'pointer' }}>{busy ? 'กำลังอัปโหลด…' : '📷 เปลี่ยนรูป (ถ่าย / เลือกรูปใหม่)'}<input hidden type="file" accept="image/*" aria-label="รูปใหม่" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(() => onReplace(f), 'เปลี่ยนรูปแล้ว ✓') }} /></label>}
                {onRemove && <button type="button" className="btn btn--danger bigbtn btn--block" disabled={busy} onClick={() => setAskDel(true)}>🗑 ลบรูป</button>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
