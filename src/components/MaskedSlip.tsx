import { useEffect, useRef, useState } from 'react'
import ImageTools from './ImageTools'
import Sheet from './Sheet'
import StoredImage from './StoredImage'
import { loadAttachment } from '../lib/imageExport'
import { detectCard, detectQr, readSlipLines } from '../lib/slipOcr'
import { maskLabel, slipLayout, type Box } from '../lib/slipMask'
import { renderMaskedSlip, type MaskBoxes } from '../lib/slipMaskRender'

type Key = 'crop' | 'name' | 'qr'
const COL: Record<Key, { c: string; t: string }> = { crop: { c: '#1a56db', t: '✂️ ขอบสลิป' }, name: { c: '#c026d3', t: '👤 ปิดชื่อ' }, qr: { c: '#6b7280', t: '▦ ปิดคิวอาร์' } }

/** แชร์สลิปแบบปิดชื่อ: ระบบหาตำแหน่งชื่อ/คิวอาร์/ขอบสลิปให้ ผู้บันทึกลากปรับได้ → ได้รูปใหม่ที่ถูกปิดจริง พร้อมดาวน์โหลด/แชร์/พิมพ์ */
export default function MaskedSlip({ slip, memberNo, typeName, masked, savedBoxes, onStore, onClose }: { slip: { path: string; name: string }; memberNo?: string; typeName: string; /** รูปปิดชื่อที่ระบบสร้างไว้แล้วตอนบันทึก */ masked?: { path: string; name: string }; /** กรอบที่ใช้ตอนสร้าง (ปรับแก้ต่อได้โดยไม่ต้องอ่านใหม่) */ savedBoxes?: MaskBoxes; /** เก็บรูปที่ปิดชื่อนี้เข้าระบบ (แทนของเดิม) */ onStore?: (blob: Blob, boxes: MaskBoxes) => Promise<void>; onClose: () => void }) {
  const [editing, setEditing] = useState(!masked)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [dim, setDim] = useState<{ W: number; H: number } | null>(null)
  const [boxes, setBoxes] = useState<MaskBoxes | null>(null)
  const [sel, setSel] = useState<Key>('name')
  const [code, setCode] = useState(memberNo ?? '')
  const [label, setLabel] = useState(() => maskLabel(memberNo ?? '', typeName))
  const [msg, setMsg] = useState('กำลังเปิดรูปสลิป…')
  const [found, setFound] = useState(true)
  const [prev, setPrev] = useState('')
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<{ k: Key; mode: 'move' | 'size'; sx: number; sy: number; b: Box; scale: number } | null>(null)

  useEffect(() => {
    if (!editing) return
    let dead = false, u = ''
    void (async () => {
      try {
        const b = await loadAttachment(slip.path)
        if (dead) return
        u = URL.createObjectURL(b); setBlob(b); setUrl(u)
        if (savedBoxes) { // ใช้กรอบที่เคยสร้างไว้ ไม่ต้องอ่านใหม่
          const bmp = await createImageBitmap(b, { imageOrientation: 'from-image' }); setDim({ W: bmp.width, H: bmp.height }); bmp.close()
          setBoxes(savedBoxes); setFound(true); setMsg('ปรับกรอบให้ตรง แล้วกด “บันทึกรูปนี้ไว้ในระบบ” เพื่อแทนรูปเดิม'); return
        }
        setMsg('กำลังหาตำแหน่งชื่อและคิวอาร์ (ครั้งแรกอาจนานขึ้นเล็กน้อย)…')
        const [{ lines, W, H }, qr, card] = await Promise.all([readSlipLines(b), detectQr(b).catch(() => null), detectCard(b).catch(() => null)])
        if (dead) return
        const lay = slipLayout(lines, W, H, qr, card)
        setDim({ W, H }); setFound(lay.found)
        setBoxes({ crop: lay.crop, name: lay.name, qr: lay.qr })
        setMsg(lay.found ? 'ตรวจกรอบชื่อและคิวอาร์ให้ตรงตำแหน่ง ลากกรอบเพื่อย้าย ลากจุดมุมเพื่อปรับขนาด' : 'ระบบหาตำแหน่งชื่อไม่เจอ — กด “＋ เพิ่มกรอบ” แล้วลากไปทับชื่อและคิวอาร์เอง')
      } catch (e) { if (!dead) setMsg(e instanceof Error ? e.message : 'เปิดรูปสลิปไม่ได้') }
    })()
    return () => { dead = true; if (u) URL.revokeObjectURL(u) }
  }, [slip.path, editing]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (prev) URL.revokeObjectURL(prev) }, [prev])

  const [saving, setSaving] = useState(false)
  const store = async () => { if (!onStore || !boxes) return; setSaving(true); try { await onStore(await render(), boxes); setMsg('✓ เก็บรูปที่ปิดชื่อไว้ในระบบแล้ว'); setEditing(false) } catch (e) { setMsg(e instanceof Error ? e.message : 'เก็บรูปไม่สำเร็จ') } finally { setSaving(false) } }
  const upd = (k: Key, fn: (b: Box) => Box) => setBoxes((s) => (s && s[k] ? { ...s, [k]: fn(s[k] as Box) } : s))
  const add = (k: 'name' | 'qr') => dim && setBoxes((s) => s && ({ ...s, [k]: k === 'name' ? { x: dim.W * 0.25, y: dim.H * 0.3, w: dim.W * 0.4, h: dim.H * 0.03 } : { x: dim.W * 0.6, y: dim.H * 0.6, w: dim.W * 0.25, h: dim.W * 0.25 } }))
  const down = (e: React.PointerEvent, k: Key, mode: 'move' | 'size') => {
    if (!boxes?.[k] || !dim || !wrap.current) return
    e.stopPropagation(); setSel(k)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { k, mode, sx: e.clientX, sy: e.clientY, b: boxes[k] as Box, scale: dim.W / wrap.current.getBoundingClientRect().width }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !dim) return
    const dx = (e.clientX - d.sx) * d.scale, dy = (e.clientY - d.sy) * d.scale
    upd(d.k, () => (d.mode === 'move'
      ? { ...d.b, x: Math.min(Math.max(0, d.b.x + dx), dim.W - d.b.w), y: Math.min(Math.max(0, d.b.y + dy), dim.H - d.b.h) }
      : { ...d.b, w: Math.min(Math.max(20, d.b.w + dx), dim.W - d.b.x), h: Math.min(Math.max(14, d.b.h + dy), dim.H - d.b.y) }))
  }
  const up = () => { drag.current = null }
  const render = async () => { if (!blob || !boxes) throw new Error('ยังไม่พร้อม'); return renderMaskedSlip(blob, boxes, label) }
  const preview = async () => { try { const b = await render(); setPrev(URL.createObjectURL(b)) } catch (e) { setMsg(e instanceof Error ? e.message : 'สร้างตัวอย่างไม่ได้') } }
  const pct = (b: Box) => dim ? { left: `${(b.x / dim.W) * 100}%`, top: `${(b.y / dim.H) * 100}%`, width: `${(b.w / dim.W) * 100}%`, height: `${(b.h / dim.H) * 100}%` } : {}

  if (!editing && masked) return (
    <Sheet title="🔒 สลิปปิดชื่อ (พร้อมแชร์)" onClose={onClose}>
      <p className="small" style={{ margin: 0 }}>✓ ระบบสร้างและเก็บรูปที่ปิดชื่อผู้โอนและคิวอาร์ไว้ให้แล้ว · รูปต้นฉบับเก็บไว้ภายใน ไม่ถูกแชร์</p>
      <StoredImage path={masked.path} alt="สลิปที่ปิดชื่อแล้ว" />
      <ImageTools files={[masked]} title={`สลิป ${memberNo ?? ''}`} base={`สลิป-สมาชิก-${memberNo || 'x'}`} />
      {msg && !msg.startsWith('กำลัง') && <p className="small" role="status" style={{ margin: 0 }}>{msg}</p>}
      <button type="button" className="btn btn--block" onClick={() => setEditing(true)}>✏️ ปรับกรอบ / สร้างรูปใหม่</button>
    </Sheet>
  )
  return (
    <Sheet title="🔒 แชร์สลิป (ปิดชื่อผู้โอน)" onClose={onClose}>
      <p className="muted small" style={{ margin: 0 }} role="status">{msg}</p>
      <div className="field"><label htmlFor="ms-label">ข้อความบนป้ายที่ปิดทับชื่อ</label>
        <div className="row" style={{ gap: 6 }}><input id="ms-code" className="input" style={{ width: 90 }} inputMode="numeric" placeholder="เลขสมาชิก" aria-label="เลขสมาชิก" value={code} onChange={(e) => { setCode(e.target.value); setLabel(maskLabel(e.target.value, typeName)) }} /><input id="ms-label" className="input grow" value={label} onChange={(e) => setLabel(e.target.value)} /></div></div>
      {boxes && dim && (
        <>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="เลือกกรอบที่จะปรับ">
            {(['crop', 'name', 'qr'] as Key[]).map((k) => boxes[k] ? <button key={k} type="button" className={`mini${sel === k ? ' on' : ''}`} style={sel === k ? { background: COL[k].c, color: '#fff' } : { borderColor: COL[k].c }} onClick={() => setSel(k)}>{COL[k].t}</button> : null)}
            {!boxes.name && <button type="button" className="mini" onClick={() => add('name')}>＋ เพิ่มกรอบชื่อ</button>}
            {!boxes.qr && <button type="button" className="mini" onClick={() => add('qr')}>＋ เพิ่มกรอบคิวอาร์</button>}
          </div>
          <div ref={wrap} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ position: 'relative', width: '100%', touchAction: 'none', userSelect: 'none', borderRadius: 8, overflow: 'hidden', background: '#222' }}>
            <img src={url} alt="สลิปต้นฉบับ" draggable={false} style={{ display: 'block', width: '100%', height: 'auto' }} />
            {(['crop', 'qr', 'name'] as Key[]).map((k) => { const b = boxes[k]; if (!b) return null
              return (
                <div key={k} onPointerDown={(e) => down(e, k, 'move')} style={{ position: 'absolute', ...pct(b), border: `3px ${k === 'crop' ? 'dashed' : 'solid'} ${COL[k].c}`, background: k === 'crop' ? 'transparent' : `${COL[k].c}55`, boxSizing: 'border-box', cursor: 'move', outline: sel === k ? '2px solid #fff' : 'none', zIndex: sel === k ? 3 : 2 }}>
                  {sel === k && <span onPointerDown={(e) => down(e, k, 'size')} aria-label="ปรับขนาดกรอบ" style={{ position: 'absolute', right: -13, bottom: -13, width: 26, height: 26, borderRadius: 13, background: COL[k].c, border: '3px solid #fff', cursor: 'nwse-resize' }} />}
                </div>) })}
          </div>
          {!found && <p className="small" style={{ color: '#a4262c', margin: 0 }}>⚠ ระบบจับตำแหน่งอัตโนมัติไม่ได้ — ตรวจให้กรอบม่วงทับชื่อและกรอบเทาทับคิวอาร์ครบก่อนแชร์</p>}
          <button type="button" className="btn btn--block" onClick={() => void preview()}>👁 ดูตัวอย่างรูปที่จะแชร์</button>
          {prev && <img src={prev} alt="ตัวอย่างสลิปที่ปิดชื่อแล้ว" style={{ width: '100%', borderRadius: 8, border: '2px solid #c026d3' }} />}
          <p className="small" style={{ margin: 0 }}>⚠ ตรวจตัวอย่างอีกครั้งว่าไม่เห็นชื่อจริงและคิวอาร์ก่อนส่ง · รูปที่ได้เป็นไฟล์ใหม่ ต้นฉบับยังเก็บไว้ในระบบเหมือนเดิม</p>
          {onStore && <button type="button" className="btn btn--gold btn--block" disabled={saving} onClick={() => void store()}>{saving ? 'กำลังเก็บรูป…' : '💾 บันทึกรูปที่ปิดชื่อนี้ไว้ในระบบ (ใช้แชร์)'}</button>}
          <ImageTools load={async () => [await render()]} title={`สลิป ${label}`} base={`สลิป-สมาชิก-${code || 'x'}`} />
        </>
      )}
    </Sheet>
  )
}
