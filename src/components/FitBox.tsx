import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * ย่อเนื้อหาให้พอดีหน้ากระดาษเมื่อข้อมูลล้น (เช่น ตารางที่มีแถวมากขึ้น) — ไม่ให้ส่วนล่างถูกตัดหาย
 * ลูกคนแรกต้องเป็นกล่องสูง 100% (flex column) · เปลี่ยน key เมื่อข้อมูลเปลี่ยนเพื่อคำนวณใหม่
 */
export default function FitBox({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useLayoutEffect(() => {
    const c = inner.current?.firstElementChild as HTMLElement | null
    if (!c) return
    if (c.scrollHeight - c.clientHeight > 2 && k > 0.55) setK(Math.max(0.55, +((k * c.clientHeight) / c.scrollHeight * 0.99).toFixed(4)))
  })
  return (
    <div style={{ height: '100%', boxSizing: 'border-box', paddingBottom: 22, overflow: 'hidden' }}>
      <div ref={inner} style={{ width: `${100 / k}%`, height: `${100 / k}%`, transform: `scale(${k})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}
