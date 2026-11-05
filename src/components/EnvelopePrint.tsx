import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import { useLetterhead, useSettings } from '../lib/data'
import { useStoredUrl } from '../lib/useStoredUrl'
import { buildEnvelopePdf, saveBlob, shareBlob } from '../lib/pdf'

const MM = 96 / 25.4 // px ต่อ มม. (หน้าจอ 96 dpi)
const SIZES = [
  { id: 'dl', label: 'ซอง DL (110 × 220 มม.) — ซองยาวมาตรฐาน', w: 220, h: 110 },
  { id: 'n9', label: 'ซองเบอร์ 9 (98 × 225 มม.)', w: 225, h: 98 },
  { id: 'c5', label: 'ซอง C5 (162 × 229 มม.) — ใส่ A4 พับ 2', w: 229, h: 162 },
  { id: 'custom', label: 'กำหนดขนาดเอง (วัดซองเป็นมิลลิเมตร)', w: 220, h: 110 },
]

/**
 * พิมพ์หน้าซอง: หัวจดหมายของคริสตจักร (โลโก้ ชื่อ ที่อยู่) อยู่มุมซ้ายบนของซอง · ผู้รับเลือกพิมพ์ด้วยได้
 * ได้ PDF ขนาดเท่าซองพอดี (ดาวน์โหลด/แชร์) หรือสั่งพิมพ์จากเครื่องนี้โดยตรง — ตั้งหัวจดหมายที่เมนูตั้งค่าหัวจดหมายของงานเลขา
 */
export default function EnvelopePrint({ recipient, onClose }: { recipient?: string; onClose: () => void }) {
  const lh = useLetterhead().value
  const { settings } = useSettings()
  const head = useStoredUrl(lh?.header?.path)
  const [size, setSize] = useState('dl')
  const [cw, setCw] = useState(220), [ch, setCh] = useState(110)
  const [headW, setHeadW] = useState(130)        // ความกว้างหัวจดหมายบนซอง (มม.)
  const [margin, setMargin] = useState(8)        // ระยะจากขอบซองซ้าย/บน (มม.) — เครื่องพิมพ์พิมพ์ชิดขอบเกิน ~3–5 มม. ไม่ได้
  const [withTo, setWithTo] = useState(false)
  const [to, setTo] = useState(recipient ? `เรียน ${recipient}` : '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)
  const preset = SIZES.find((s) => s.id === size)!
  const W = size === 'custom' ? cw : preset.w, H = size === 'custom' ? ch : preset.h
  const [fit, setFit] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const on = () => setFit(Math.min(1, el.clientWidth / (W * MM)))
    on()
    const ro = new ResizeObserver(on); ro.observe(el)
    return () => ro.disconnect()
  }, [W])
  // ตั้งขนาดหน้ากระดาษของการพิมพ์ตรงจากเบราว์เซอร์ให้เท่าซอง
  useEffect(() => {
    const st = document.createElement('style')
    st.setAttribute('data-envelope', '1')
    st.textContent = `@media print { @page { size: ${W}mm ${H}mm; margin: 0 } body.print-env > *:not(.sheet) { display: none !important } body.print-env .sheet { position: static !important; background: none !important; overflow: visible !important } body.print-env .sheet > .card { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-height: none !important; overflow: visible !important } body.print-env .envprint__ui { display: none !important } body.print-env .envprint__box { height: auto !important; overflow: visible !important } body.print-env .envprint__sheet { transform: none !important } }`
    document.head.appendChild(st)
    return () => { st.remove(); document.body.classList.remove('print-env') }
  }, [W, H])
  const file = () => `หน้าซอง-${W}x${H}.pdf`
  const make = async () => { if (!sheet.current) throw new Error('ยังไม่พบหน้าซอง'); return buildEnvelopePdf(sheet.current, W, H) }
  const run = async (act: 'dl' | 'share') => {
    setBusy(true); setMsg('')
    try {
      const b = await make()
      if (act === 'dl') { saveBlob(b, file()); setMsg('ดาวน์โหลดแล้ว — เปิดไฟล์ PDF แล้วสั่งพิมพ์ ตั้งกระดาษเป็นขนาดซอง') }
      else if ((await shareBlob(b, file(), 'หน้าซองจดหมาย')) === 'unsupported') { saveBlob(b, file()); setMsg('เครื่องนี้แชร์ตรงไม่ได้ — ดาวน์โหลดไฟล์ให้แทนแล้ว') }
    } catch (e) { if ((e as Error).name !== 'AbortError') setMsg(e instanceof Error ? e.message : 'ทำไฟล์ไม่สำเร็จ') }
    setBusy(false)
  }
  const print = () => {
    document.body.classList.add('print-env')
    const done = () => { document.body.classList.remove('print-env'); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
  }
  return (
    <Sheet title="✉️ พิมพ์หน้าซอง" onClose={onClose}>
      <div className="envprint__ui" style={{ display: 'grid', gap: 8 }}>
        <div className="field" style={{ margin: 0 }}><label htmlFor="env-size">ขนาดซอง</label>
          <select id="env-size" className="input" value={size} onChange={(e) => setSize(e.target.value)}>{SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        {size === 'custom' && (
          <div className="row" style={{ gap: 6 }}>
            <label className="small" style={{ flex: 1 }}>ยาว (มม.)<input className="input" type="number" min={80} max={400} value={cw} onChange={(e) => setCw(Number(e.target.value) || 220)} aria-label="ความยาวซอง มม." /></label>
            <label className="small" style={{ flex: 1 }}>กว้าง/สูง (มม.)<input className="input" type="number" min={60} max={300} value={ch} onChange={(e) => setCh(Number(e.target.value) || 110)} aria-label="ความสูงซอง มม." /></label>
          </div>
        )}
        <div className="row" style={{ gap: 6 }}>
          <label className="small" style={{ flex: 1 }}>ความกว้างหัวจดหมาย (มม.)<input className="input" type="number" min={60} max={W - 2 * margin} value={headW} onChange={(e) => setHeadW(Math.max(60, Number(e.target.value) || 130))} aria-label="ความกว้างหัวจดหมายบนซอง" /></label>
          <label className="small" style={{ flex: 1 }}>ห่างขอบซ้าย/บน (มม.)<input className="input" type="number" min={4} max={30} value={margin} onChange={(e) => setMargin(Math.max(4, Number(e.target.value) || 8))} aria-label="ระยะห่างขอบซอง" /></label>
        </div>
        <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={withTo} onChange={(e) => setWithTo(e.target.checked)} /> พิมพ์ชื่อ/ที่อยู่ผู้รับบนซองด้วย</label>
        {withTo && <textarea className="input" rows={3} value={to} onChange={(e) => setTo(e.target.value)} aria-label="ผู้รับ" placeholder="เรียน … (ชื่อ ที่อยู่)" />}
      </div>
      <div ref={box} className="envprint__box" style={{ width: '100%', height: H * MM * fit, overflow: 'hidden', border: '1px dashed var(--line)', borderRadius: 6, background: '#eef1f7' }}>
        <div ref={sheet} className="envprint__sheet" aria-label="ตัวอย่างหน้าซอง" style={{ width: W * MM, height: H * MM, background: '#fff', position: 'relative', transform: `scale(${fit})`, transformOrigin: 'top left', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: margin * MM, top: margin * MM, width: headW * MM }}>
            {head ? <img src={head} alt="หัวจดหมาย" style={{ width: '100%', display: 'block' }} /> : <b style={{ fontSize: 16 }}>{settings.churchName}</b>}
          </div>
          {withTo && to.trim() && <div style={{ position: 'absolute', left: Math.max(margin + 8, W * 0.38) * MM, top: H * 0.46 * MM, right: margin * MM, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5, color: '#111' }}>{to}</div>}
        </div>
      </div>
      {!head && <p className="small muted" role="note" style={{ margin: 0 }}>ยังไม่ได้ตั้งรูปหัวจดหมาย จึงใช้ชื่อคริสตจักรเป็นข้อความแทน — ตั้งรูปหัวได้ที่เมนูตั้งค่าหัวจดหมายของงานเลขา</p>}
      <div className="envprint__ui row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void run('dl')}>⬇️ ดาวน์โหลด PDF</button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void run('share')}>📤 แชร์ PDF</button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={print}>🖨 พิมพ์</button>
      </div>
      {msg && <p role="status" className="small envprint__ui" style={{ margin: 0 }}>{msg}</p>}
      <p className="small muted envprint__ui" style={{ margin: 0 }}>ไฟล์ที่ได้ขนาด {W}×{H} มม. พอดีกับซอง · ตั้งกระดาษในเครื่องพิมพ์เป็นซองขนาดเดียวกัน แนวนอน ไม่ย่อ/ขยาย (Actual size / 100%)</p>
    </Sheet>
  )
}
