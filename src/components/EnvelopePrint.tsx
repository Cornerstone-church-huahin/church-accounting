import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import logoUrl from '../assets/logo.png'
import { buildEnvelopePdf, saveBlob, shareBlob, type EnvFeed } from '../lib/pdf'

const MM = 96 / 25.4 // px ต่อ มม. (หน้าจอ 96 dpi)
const SIZES = [
  { id: 'mine', label: 'ซองของคุณ (วัดจากไม้บรรทัด ≈ 110 × 228 มม.)', w: 228, h: 110 },
  { id: 'dl', label: 'ซอง DL (110 × 220 มม.) — ซองยาวมาตรฐาน', w: 220, h: 110 },
  { id: 'n9', label: 'ซองเบอร์ 9 (98 × 225 มม.)', w: 225, h: 98 },
  { id: 'c5', label: 'ซอง C5 (162 × 229 มม.) — ใส่ A4 พับ 2', w: 229, h: 162 },
  { id: 'custom', label: 'กำหนดขนาดเอง (วัดซองเป็นมิลลิเมตร)', w: 220, h: 110 },
]

/**
 * พิมพ์หน้าซอง: หัวจดหมายของคริสตจักร (โลโก้ ชื่อ ที่อยู่) อยู่มุมซ้ายบนของซอง · ผู้รับเลือกพิมพ์ด้วยได้
 * ได้ PDF ขนาดเท่าซองพอดี (ดาวน์โหลด/แชร์) หรือสั่งพิมพ์จากเครื่องนี้โดยตรง — ตั้งหัวจดหมายที่เมนูตั้งค่าหัวจดหมายของงานเลขา
 */
/** หัวจดหมายตามหนังสือ: โลโก้ + ชื่อไทย + ชื่ออังกฤษ + ที่อยู่ (ค่าจากปุ่ม “แก้หัวจดหมาย” ของหนังสือ) */
export interface EnvHead { thName: string; enName?: string; addr?: string }
const HEAD_NATURAL_PX = 660 // ความกว้างธรรมชาติของหัวจดหมายบน A4 (ย่อ/ขยายให้เท่าความกว้างที่เลือกบนซอง)


let measureCtx: CanvasRenderingContext2D | null = null
/** ย่อข้อความผู้รับอัตโนมัติถ้าบรรทัดที่ยาวที่สุดยาวเกินความยาวที่พิมพ์ได้ (px) · วัดด้วย canvas ฟอนต์เดียวกับหน้าเว็บ */
function fitScale(lines: string[], px: number, availPx: number): number {
  try {
    measureCtx ??= document.createElement('canvas').getContext('2d')
    if (!measureCtx) return 1
    const fam = getComputedStyle(document.body).fontFamily
    let w = 0
    lines.forEach((t, i) => { if (!t.trim()) return; measureCtx!.font = `${i === 0 ? 700 : 400} ${px * (i === 0 ? 1 : 0.88)}px ${fam}`; w = Math.max(w, measureCtx!.measureText(t).width) })
    return w > availPx && w > 0 ? availPx / w : 1
  } catch { return 1 }
}
/** ไม้บรรทัดโหมดทดสอบ: ขีดทุก 10 มม. ตามขอบบน (x) / ขอบซ้าย (y) ของหน้านอน — เลขทุก 50 มม. */
function rulerTicks(len: number, axis: 'x' | 'y') {
  const out: JSX.Element[] = []
  for (let mm = 10; mm < len; mm += 10) {
    const big = mm % 50 === 0
    const pos = mm * MM, tl = (big ? 6 : 3) * MM
    out.push(axis === 'x'
      ? <div key={`x${mm}`} style={{ position: 'absolute', left: pos, top: 0, width: 1.5, height: tl, background: '#c4332a' }}>{big && <span style={{ position: 'absolute', left: 3, top: tl, fontSize: 11, color: '#c4332a', fontWeight: 700 }}>{mm}</span>}</div>
      : <div key={`y${mm}`} style={{ position: 'absolute', top: pos, left: 0, height: 1.5, width: tl, background: '#c4332a' }}>{big && <span style={{ position: 'absolute', top: 2, left: tl + 2, fontSize: 11, color: '#c4332a', fontWeight: 700 }}>{mm}</span>}</div>)
  }
  return out
}

export default function EnvelopePrint({ recipient, head, onClose }: { recipient?: string; head: EnvHead; onClose: () => void }) {
  const [size, setSize] = useState('mine')
  const [cw, setCw] = useState(220), [ch, setCh] = useState(110)
  const [headW, setHeadW] = useState(90)        // ความกว้างหัวจดหมายบนซอง (มม.)
  const [margin, setMargin] = useState(10)        // ระยะจากขอบซองซ้าย/บน (มม.) — เครื่องพิมพ์พิมพ์ชิดขอบเกิน ~3–5 มม. ไม่ได้
  const [withTo, setWithTo] = useState(true)
  const [to1, setTo1] = useState(recipient ?? '')   // ชื่อผู้รับ (บรรทัดที่ 1)
  const [to2, setTo2] = useState('')                // ตำแหน่ง/ที่อยู่ (บรรทัดที่ 2)
  const toSize = 13.33 // ตัวอักษรชื่อผู้รับ 10 pt ตายตัว (px บนหน้าจอ = pt × 96/72) — ย่ออัตโนมัติเฉพาะเมื่อบรรทัดยาวเกินความยาวซอง
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const feed: EnvFeed = 'cw' // ทิศทางตายตัว: หน้าแนวตั้ง หมุนเนื้อหาตามเข็ม (หัวจดหมายมุมขวาบน) — ตรงกับซองที่ป้อนด้านสั้นขวางถาด Brother DCP-T520W
  const [test, setTest] = useState(false)           // โหมดทดสอบ: พิมพ์กรอบ+ป้ายมุมลงกระดาษธรรมดาก่อน
  // ปรับชดเชยตามเครื่องพิมพ์จริง (ซองคนละขนาดกับกระดาษที่เลือกในหน้าต่างพิมพ์ → ถูกย่อ/ขยาย หรือเลื่อน): % ทั้งหน้า · เลื่อนขวา/ลง ตามกระดาษที่วางจริง (มม.)
  const [cal, setCalRaw] = useState<{ pct: number; x: number; y: number }>(() => { try { const j = JSON.parse(localStorage.getItem('acct.env.cal') ?? 'null'); return j && typeof j.pct === 'number' ? j : { pct: 100, x: 0, y: 0 } } catch { return { pct: 100, x: 0, y: 0 } } })
  const setCal = (c: { pct: number; x: number; y: number }) => { setCalRaw(c); try { localStorage.setItem('acct.env.cal', JSON.stringify(c)) } catch { /* ignore */ } }
  const sheet = useRef<HTMLDivElement>(null)
  const preset = SIZES.find((s) => s.id === size)!
  const W = size === 'custom' ? cw : preset.w, H = size === 'custom' ? ch : preset.h
  // เลื่อนตามกระดาษที่วางจริง (ขวา/ลง) → แกนของหน้านอนที่เราวาด
  const tx = cal.y   // หมุนตามเข็ม: ลงล่าง (กระดาษ) = ขวา (หน้านอน)
  const ty = -cal.x  // ขวา (กระดาษ) = ขึ้น (หน้านอน)
  const fitTo = fitScale([to1, to2 ? to2 : ''], toSize, (W - 2 * margin) * MM)
  const pw = H, ph = W   // ขนาดหน้าที่ส่งให้เครื่องพิมพ์ (มม.) หลังหมุน: กว้าง = ด้านสั้นของซอง สูง = ด้านยาว
  const [fit, setFit] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const on = () => setFit(Math.min(1, el.clientWidth / (pw * MM)))
    on()
    const ro = new ResizeObserver(on); ro.observe(el)
    return () => ro.disconnect()
  }, [pw])
  const file = () => `หน้าซอง-${H}x${W}${test ? '-ทดสอบ' : ''}.pdf`
  const make = async () => { if (!sheet.current) throw new Error('ยังไม่พบหน้าซอง'); return buildEnvelopePdf(sheet.current, W, H, feed) }
  const run = async (act: 'dl' | 'share') => {
    setBusy(true); setMsg('')
    try {
      const b = await make()
      if (act === 'dl') { saveBlob(b, file()); setMsg('ดาวน์โหลดแล้ว — เปิดไฟล์ PDF แล้วสั่งพิมพ์ ตั้งกระดาษเป็นขนาดซอง') }
      else if ((await shareBlob(b, file(), 'หน้าซองจดหมาย')) === 'unsupported') { saveBlob(b, file()); setMsg('เครื่องนี้แชร์ตรงไม่ได้ — ดาวน์โหลดไฟล์ให้แทนแล้ว') }
    } catch (e) { if ((e as Error).name !== 'AbortError') setMsg(e instanceof Error ? e.message : 'ทำไฟล์ไม่สำเร็จ') }
    setBusy(false)
  }
  const sheetBody = (
    <>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 50%', transform: `translate(${tx * MM}px, ${ty * MM}px) scale(${cal.pct / 100})` }}>
          <div style={{ position: 'absolute', left: margin * MM, top: margin * MM, width: HEAD_NATURAL_PX, transform: `scale(${(headW * MM) / HEAD_NATURAL_PX})`, transformOrigin: 'top left' }}>
        <div className="il__head" style={{ justifyContent: 'flex-start', padding: 0, gap: 12 }}>
          <img src={logoUrl} alt="" className="il__logo" />
          <div className="il__heads" style={{ textAlign: 'left' }}>
            <div className="il__th">{head.thName}</div>
            {head.enName && <div className="il__en">{head.enName}</div>}
            {head.addr && <div className="il__addr">{head.addr}</div>}
          </div>
        </div>
      </div>
      {withTo && (to1.trim() || to2.trim()) && (
        <div aria-label="ชื่อผู้รับ" style={{ position: 'absolute', left: margin * MM, right: margin * MM, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#111', lineHeight: 1.45 }}>
          {to1.trim() && <div style={{ fontSize: toSize * fitTo, fontWeight: 700, whiteSpace: 'nowrap' }}>{to1}</div>}
          {to2.trim() && <div style={{ fontSize: toSize * 0.88 * fitTo, whiteSpace: 'nowrap' }}>{to2}</div>}
        </div>
      )}
      </div>
      {test && (
        <div aria-label="กรอบทดสอบ" style={{ position: 'absolute', inset: 0, border: '3px dashed #c4332a', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: `${22 * MM}px ${22 * MM}px 0 0`, borderColor: '#c4332a transparent transparent transparent' }} />
          <div style={{ position: 'absolute', right: margin * MM, bottom: margin * MM, textAlign: 'right', color: '#c4332a', fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>ทดสอบ — ◤ = มุมซ้ายบนของซอง (ด้านหน้า)<br />ขนาด {W}×{H} มม. · ไม้บรรทัด: ขีดทุก 10 มม. เลขทุก 50 มม.</div>
          {rulerTicks(W, 'x')}{rulerTicks(H, 'y')}
        </div>
      )}
    </>
  )
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
        <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={withTo} onChange={(e) => setWithTo(e.target.checked)} /> พิมพ์ชื่อผู้รับตรงกลางซอง</label>
        {withTo && (
          <>
            <div className="field" style={{ margin: 0 }}><label htmlFor="env-to1">บรรทัดที่ 1 — ชื่อผู้รับ</label><input id="env-to1" className="input" value={to1} onChange={(e) => setTo1(e.target.value)} placeholder="เช่น เรียน ท่านนพพร วุฒิกุล" /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="env-to2">บรรทัดที่ 2 — ตำแหน่ง/ที่อยู่</label><input id="env-to2" className="input" value={to2} onChange={(e) => setTo2(e.target.value)} placeholder="เช่น นายกเทศมนตรีนครหัวหิน" /></div>
          </>
        )}
      </div>
      <label className="small envprint__ui" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} /> 🧪 โหมดทดสอบ (พิมพ์กรอบซอง + ไม้บรรทัด ลงกระดาษธรรมดา)</label>
      <fieldset className="envprint__ui" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', margin: 0, display: 'grid', gap: 4 }}>
        <legend className="small"><b>ปรับให้พอดีกับเครื่องพิมพ์</b></legend>
        <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>ขนาดทั้งหน้า <input type="range" min={60} max={120} step={1} value={cal.pct} onChange={(e) => setCal({ ...cal, pct: Number(e.target.value) })} aria-label="ย่อขยายทั้งหน้า เปอร์เซ็นต์" style={{ flex: 1 }} /> {cal.pct}%</label>
        <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>เลื่อนไปทางขวา <input type="range" min={-30} max={30} step={0.5} value={cal.x} onChange={(e) => setCal({ ...cal, x: Number(e.target.value) })} aria-label="เลื่อนไปทางขวา มม." style={{ flex: 1 }} /> {cal.x} มม.</label>
        <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>เลื่อนลงล่าง <input type="range" min={-30} max={30} step={0.5} value={cal.y} onChange={(e) => setCal({ ...cal, y: Number(e.target.value) })} aria-label="เลื่อนลงล่าง มม." style={{ flex: 1 }} /> {cal.y} มม.</label>
        <p className="small muted" style={{ margin: 0 }}>ทิศ “ขวา/ลงล่าง” นับตามกระดาษที่วางจริงตอนมองจากด้านหน้า (แนวตั้ง) · ถ้าพิมพ์แล้วเลยขอบ/ใหญ่เกินไป ให้พิมพ์โหมดทดสอบ (มีไม้บรรทัด) แล้วย่อ % หรือเลื่อนเข้าตามที่เลยออกไป · ในหน้าต่างพิมพ์ต้องเลือกขนาดกระดาษเท่าซองและ “ขนาดจริง 100%” ไม่ใช่ “พอดีหน้า”</p>
        <button type="button" className="mini" onClick={() => setCal({ pct: 100, x: 0, y: 0 })}>↺ คืนค่าปรับ</button>
      </fieldset>
      {/* ตัวอย่าง = หน้าที่จะส่งให้เครื่องพิมพ์จริง (หมุนตามทิศทางที่เลือก) · ชุดส่งออก/พิมพ์เป็นสำเนาซ่อนไว้ด้านนอกจอ ไม่ถูกหมุน */}
      <div ref={box} className="envprint__box" style={{ position: 'relative', width: '100%', height: ph * MM * fit, overflow: 'hidden', border: '1px dashed var(--line)', borderRadius: 6, background: '#eef1f7' }} aria-label="ตัวอย่างหน้าที่ส่งให้เครื่องพิมพ์">
        <div style={{ position: 'absolute', left: 0, top: 0, width: W * MM, height: H * MM, background: '#fff', overflow: 'hidden', transformOrigin: '0 0', transform: `translateX(${H * MM * fit}px) rotate(90deg) scale(${fit})` }}>
          {sheetBody}
        </div>
      </div>
      <div className="envprint__export" aria-hidden="true" style={{ position: 'fixed', left: -100000, top: 0 }}>
        <div ref={sheet} className="envprint__sheet" aria-label="ตัวอย่างหน้าซอง" style={{ width: W * MM, height: H * MM, background: '#fff', position: 'relative', overflow: 'hidden' }}>
          {sheetBody}
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>หัวจดหมายตามหนังสือ (โลโก้ ชื่อ ที่อยู่) — แก้ข้อความได้ที่ปุ่ม “แก้หัวจดหมาย” ของหนังสือ</p>
      <div className="envprint__ui row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void run('dl')}>⬇️ ดาวน์โหลด PDF</button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void run('share')}>📤 แชร์ PDF</button>
      </div>
      {msg && <p role="status" className="small envprint__ui" style={{ margin: 0 }}>{msg}</p>}
      <p className="small muted envprint__ui" style={{ margin: 0 }}>ไฟล์ที่ได้เป็นหน้าแนวตั้ง {H}×{W} มม. พอดีกับซอง · พิมพ์จากไฟล์ PDF (ดาวน์โหลด/แชร์) · ตั้งกระดาษในเครื่องพิมพ์เป็นขนาดซองเดียวกัน ขนาดจริง 100% ไม่ใช่ “พอดีหน้า”</p>
    </Sheet>
  )
}
