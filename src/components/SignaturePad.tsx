import { useEffect, useRef, useState } from 'react'

/** ช่องเซ็นชื่อด้วยนิ้ว/เมาส์ → ภาพ PNG (data URL) ขนาดเล็ก · ใช้กับรายงานการประชุม */
export default function SignaturePad({ label, onSave, onCancel }: { label: string; onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!
    g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0b1f4d'
  }, [])
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = ref.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height } }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const g = ref.current!.getContext('2d')!, p = pos(e); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 0.1, p.y + 0.1); g.stroke(); setEmpty(false) }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const g = ref.current!.getContext('2d')!, p = pos(e); g.lineTo(p.x, p.y); g.stroke() }
  const up = () => { drawing.current = false }
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setEmpty(true) }
  return (
    <div role="group" aria-label={`ลายเซ็น ${label}`} style={{ border: '2px solid var(--navy)', borderRadius: '0.8rem', padding: '0.5rem', background: '#fff' }}>
      <p className="small muted" style={{ margin: '0 0 0.3rem' }}>เซ็นชื่อ {label} ในกรอบด้านล่าง</p>
      <canvas ref={ref} width={600} height={220} aria-label="กรอบเซ็นชื่อ" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ width: '100%', height: 'auto', aspectRatio: '600 / 220', touchAction: 'none', border: '1px dashed #888', background: '#fff', borderRadius: 6 }} />
      <div className="row" style={{ marginTop: '0.4rem' }}>
        <button type="button" className="btn btn--gold" disabled={empty} onClick={() => onSave(ref.current!.toDataURL('image/png'))}>ใช้ลายเซ็นนี้</button>
        <button type="button" className="mini" onClick={clear}>ล้าง</button>
        <button type="button" className="mini" onClick={onCancel}>ยกเลิก</button>
      </div>
    </div>
  )
}
