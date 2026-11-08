import { DocCredit } from './Credit'
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export const A4_W = 794, A4_H = 1123 // A4 แนวตั้งที่ 96 dpi (แนวนอนสลับกัน)

/**
 * หน้ากระดาษ A4 เต็มหน้า (794×1123 px) ย่อให้พอดีความกว้างจอ — เห็นทั้งหน้าเหมือนกระดาษจริงโดยไม่ต้องเลื่อนซ้าย-ขวา
 * แตะที่หน้ากระดาษเพื่อขยายเป็นขนาดจริง (เลื่อนดูได้) แตะอีกครั้งเพื่อย่อ · ref ชี้ที่ตัวหน้ากระดาษ (ใช้สร้าง PDF ขนาดจริง) ตอนพิมพ์ใช้ขนาดจริง
 */
/** ตัดแสดงเฉพาะช่วงของหน้า (จาก from ถึงก้นของ to) แล้วย่อให้พอดีทั้งความกว้างและความสูงของกล่อง container (ใช้ในโหมดแบ่งจอ) */
export type Crop = { from: string; to: string; container: string }
const ScaledPage = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; landscape?: boolean; half?: boolean; crop?: Crop | null; /** ไม่ใส่เครดิตท้ายหน้า (เอกสารส่งภายนอก) */ noCredit?: boolean }>(function ScaledPage({ noCredit, children, className = 'a4page', landscape, half, crop }, ref) {
  const PW = landscape ? A4_H : A4_W, PH = half ? A4_H / 2 : landscape ? A4_W : A4_H
  const wrap = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => inner.current as HTMLDivElement)
  const [fit, setK] = useState(0.45)
  const [zoom, setZoom] = useState(false)
  const [cropBox, setCropBox] = useState<{ k: number; top: number; h: number; dx: number } | null>(null)
  const k = cropBox ? cropBox.k : zoom ? 1 : fit
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const on = () => setK(Math.min(1, el.clientWidth / PW))
    on()
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => ro.disconnect()
  }, [PW])
  // โหมดตัดช่วง: วัดตำแหน่งจริงของจุดเริ่ม/จุดจบทุกครั้งที่วาดใหม่หรือกล่องเปลี่ยนขนาด แล้วคำนวณสัดส่วนให้ทั้งช่วงอยู่ในกล่องพอดี
  useLayoutEffect(() => {
    const el = wrap.current, pg = inner.current
    if (!crop || !el || !pg) { setCropBox((b) => (b ? null : b)); return }
    const box = el.closest(crop.container) as HTMLElement | null
    const measure = () => {
      const a = pg.querySelector(crop.from) as HTMLElement | null, z = pg.querySelector(crop.to) as HTMLElement | null
      if (!a || !z || !box) return
      const pr = pg.getBoundingClientRect(), cur = pr.width / PW || 1   // สัดส่วนปัจจุบันของหน้า
      const top = (a.getBoundingClientRect().top - pr.top) / cur - 6, bottom = (z.getBoundingClientRect().bottom - pr.top) / cur + 6
      const h = Math.max(50, bottom - top)
      const cs = getComputedStyle(box), availH = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), availW = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const nk = Math.max(0.2, Math.min(1, availW / PW, availH / h))
      const next = { k: nk, top, h, dx: Math.max(0, (availW - PW * nk) / 2) }
      setCropBox((b) => (b && Math.abs(b.k - next.k) < 0.001 && Math.abs(b.top - next.top) < 0.5 && Math.abs(b.h - next.h) < 0.5 && Math.abs(b.dx - next.dx) < 0.5 ? b : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (box) ro.observe(box)
    return () => ro.disconnect()
  })
  return (
    <div ref={wrap} className={`a4wrap${landscape ? ' a4wrap--land' : ''}${half ? ' a4wrap--half' : ''}`} style={cropBox ? { height: cropBox.h * cropBox.k, overflow: 'hidden' } : { height: PH * k, overflowX: zoom ? 'auto' : 'hidden', cursor: 'zoom-in' }} onClick={() => { if (!cropBox) setZoom(!zoom) }} title={cropBox ? undefined : zoom ? 'แตะเพื่อย่อให้พอดีจอ' : 'แตะเพื่อขยาย'}>
      <div ref={inner} className={`${className}${landscape ? ' a4page--land' : ''}${half ? ' a4page--half' : ''}`} style={{ transform: cropBox ? `translate(${cropBox.dx}px, ${-cropBox.top * cropBox.k}px) scale(${cropBox.k})` : `scale(${k})` }}>{children}{!noCredit && <DocCredit />}</div>
    </div>
  )
})
export default ScaledPage
