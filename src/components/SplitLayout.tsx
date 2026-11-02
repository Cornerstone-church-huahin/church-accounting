import { useEffect, useRef, useState, type ReactNode } from 'react'

const KEY = 'acct.split.pct.v1'
const read = () => { try { const v = Number(localStorage.getItem(KEY)); return v >= 20 && v <= 80 ? v : 50 } catch { return 50 } }

/**
 * จอแบ่งสองส่วนตั้งแต่ใต้แถบบนถึงเหนือเมนูล่าง: บน = ส่วนที่กำลังทำงาน (ฟอร์ม) · ล่าง = ตัวอย่างเอกสารสมจริง
 * แต่ละส่วนเลื่อนขึ้นลงเองได้ · ลากแถบกลางเพื่อปรับสัดส่วนบน/ล่าง · ปุ่ม “เรียบร้อยแล้ว” ด้านล่างเพื่อออกจากโหมดนี้
 * scrollKey เปลี่ยน (เช่น วาระเปลี่ยน) → ส่วนล่างเลื่อนไปหาจุดที่มี data-split-focus ให้เห็นผลทันที
 */
export default function SplitLayout({ active, top, bottom, onDone, scrollKey }: { active: boolean; top: ReactNode; bottom: ReactNode; onDone: () => void; scrollKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(read)
  const [edge, setEdge] = useState({ top: 58, bottom: 56 })

  useEffect(() => {
    if (!active) return
    const fit = () => setEdge({ top: (document.querySelector('.topbar') as HTMLElement | null)?.offsetHeight ?? 58, bottom: (document.querySelector('.bottomnav') as HTMLElement | null)?.offsetHeight ?? 56 })
    fit(); window.addEventListener('resize', fit)
    document.body.classList.add('split-on')
    return () => { window.removeEventListener('resize', fit); document.body.classList.remove('split-on') }
  }, [active])
  useEffect(() => {
    if (!active) return
    const el = bottomRef.current?.querySelector('[data-split-focus]')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [scrollKey, active])

  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const bar = e.currentTarget
    bar.setPointerCapture(e.pointerId)
    let last = pct
    const move = (ev: PointerEvent) => {
      const r = box.current?.getBoundingClientRect(); if (!r) return
      last = Math.max(20, Math.min(80, Math.round(((ev.clientY - r.top) / r.height) * 100)))
      setPct(last)
    }
    const end = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', end); bar.removeEventListener('pointercancel', end); try { localStorage.setItem(KEY, String(last)) } catch { /* ignore */ } }
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end)
  }
  const nudge = (d: number) => { const v = Math.max(20, Math.min(80, pct + d)); setPct(v); try { localStorage.setItem(KEY, String(v)) } catch { /* ignore */ } }

  // โครง DOM เหมือนเดิมทั้งสองโหมด (ส่วนบน/ล่างไม่ถูกสร้างใหม่ ช่องที่กำลังพิมพ์ไม่หลุดโฟกัส) — ปิดโหมดแล้วทุกชั้นเป็น display: contents
  return (
    <div className={active ? 'split' : 'sp-plain'} style={active ? { top: edge.top, bottom: edge.bottom } : undefined} role={active ? 'region' : undefined} aria-label={active ? 'แบ่งจอ: ส่วนที่กำลังทำงาน และตัวอย่างเอกสาร' : undefined}>
      <div ref={box} className={active ? 'split__panes' : 'sp-plain'}>
        <div className={active ? 'split__top' : 'sp-plain'} style={active ? { flexBasis: `${pct}%` } : undefined}>{top}</div>
        {active && (
          <div className="split__bar no-print" role="separator" aria-orientation="horizontal" aria-label="ลากเพื่อปรับสัดส่วนส่วนบนและส่วนล่าง" tabIndex={0}
            onPointerDown={drag} onKeyDown={(e) => { if (e.key === 'ArrowUp') nudge(-5); if (e.key === 'ArrowDown') nudge(5) }}>
            <i aria-hidden="true" />
          </div>
        )}
        <div ref={bottomRef} className={active ? 'split__bottom' : 'sp-plain'}>{bottom}</div>
      </div>
      {active && <div className="split__done no-print"><button type="button" className="btn btn--gold" onClick={onDone}>✔ เรียบร้อยแล้ว</button></div>}
    </div>
  )
}
