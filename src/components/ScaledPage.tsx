import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export const A4_W = 794, A4_H = 1123 // A4 แนวตั้งที่ 96 dpi (แนวนอนสลับกัน)

/**
 * หน้ากระดาษ A4 เต็มหน้า (794×1123 px) ย่อให้พอดีความกว้างจอ — เห็นทั้งหน้าเหมือนกระดาษจริงโดยไม่ต้องเลื่อนซ้าย-ขวา
 * แตะที่หน้ากระดาษเพื่อขยายเป็นขนาดจริง (เลื่อนดูได้) แตะอีกครั้งเพื่อย่อ · ref ชี้ที่ตัวหน้ากระดาษ (ใช้สร้าง PDF ขนาดจริง) ตอนพิมพ์ใช้ขนาดจริง
 */
const ScaledPage = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; landscape?: boolean }>(function ScaledPage({ children, className = 'a4page', landscape }, ref) {
  const PW = landscape ? A4_H : A4_W, PH = landscape ? A4_W : A4_H
  const wrap = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => inner.current as HTMLDivElement)
  const [fit, setK] = useState(0.45)
  const [zoom, setZoom] = useState(false)
  const k = zoom ? 1 : fit
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const on = () => setK(Math.min(1, el.clientWidth / PW))
    on()
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => ro.disconnect()
  }, [PW])
  return (
    <div ref={wrap} className={`a4wrap${landscape ? ' a4wrap--land' : ''}`} style={{ height: PH * k, overflowX: zoom ? 'auto' : 'hidden', cursor: 'zoom-in' }} onClick={() => setZoom(!zoom)} title={zoom ? 'แตะเพื่อย่อให้พอดีจอ' : 'แตะเพื่อขยาย'}>
      <div ref={inner} className={`${className}${landscape ? ' a4page--land' : ''}`} style={{ transform: `scale(${k})` }}>{children}</div>
    </div>
  )
})
export default ScaledPage
