import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { monthsText } from './AbsentList'
import MemberAvatar from './MemberAvatar'
import { useAttendance, useChurchMembers, useVisitPlans } from '../lib/data'
import { absentMonths, type VisitStat } from '../lib/pastoral'
import { statusShort } from '../lib/registry'
import { DAY_NAMES } from '../lib/visits'
import { moveItem, removeItem, setStop, stopColor, stopsOf, type PlanDoc } from '../lib/visitPlan'
import { toAttendance } from '../lib/registry'
import { todayISO } from '../lib/money'
import { visitStats } from '../lib/pastoral'
import { fmtDay } from './PastoralVisits'
import type { ChurchMember } from '../lib/types'

type Plans = ReturnType<typeof useVisitPlans>

/**
 * ตะกร้าแผนเยี่ยมของวันนี้: ปุ่ม 🧺 + ตัวเลข อยู่บนหัวหน้าของ 3 หน้า (วางแผน → บันทึก → รายงาน) เสมอ · กดเปิดเต็มจอ จัดจุด/ลำดับ/ลบ/ล้างตะกร้า
 * ตัวเลข = จำนวนคนในแผน (plans เดียวกันทุกหน้า) เพิ่ม/ลบจากหน้าไหนก็ตามกัน · บันทึกการเยี่ยมแล้วก็ยังนับอยู่ จนกว่าจะกด “ล้างตะกร้า”
 */
export default function VisitBasket({ plans, members, stats, today }: { plans: Plans; members: ChurchMember[]; stats: Map<string, VisitStat>; today: string }) {
  const date = today // แผนเป็นของวันนี้เท่านั้น (บันทึกจริงทำตอนไปหน้างาน)
  const [open, setOpen] = useState(false) // ตะกร้าเปิดเป็นป๊อปอัพ (false = ย่อเหลือปุ่มตะกร้าลอยอยู่ด้านล่าง)
  const [ask, setAsk] = useState<{ id: string; name: string; val: string } | null>(null) // ป๊อปอัพ “จุดเยี่ยมที่”
  const [msg, setMsg] = useState('')
  const doc = plans.of(date)
  const canEdit = plans.canEdit()
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const stops = stopsOf(doc)
  const write = (next: PlanDoc) => setMsg(plans.save(date, next) ? '' : 'สิทธิ์ของท่านแก้แผนเยี่ยมไม่ได้')
  const dayLabel = `${DAY_NAMES[new Date(date + 'T00:00:00Z').getUTCDay()]} ${fmtDay(date)}${date === today ? ' · วันนี้' : ''}`
  const n = doc.items.length
  // ลากเรียงลำดับ: กดค้างที่ปุ่มจับ ⋮⋮ (≈0.3 วินาที) แล้วลากขึ้นลง · ปล่อยแล้วบันทึก
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const hold = useRef<{ id: string; t: number; y0: number; on: boolean; over: number | null } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const locate = (id: string, y: number): number => {
    const rows = [...(sheet.current?.querySelectorAll<HTMLElement>('.vplan__body > .vplan__list > [data-pid]') ?? [])].filter((e) => e.dataset.pid !== id)
    for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (y < r.top + r.height / 2) return i }
    return rows.length
  }
  const down = (e: React.PointerEvent, id: string) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    const h = { id, y0: e.clientY, on: false, over: null as number | null, t: window.setTimeout(() => { if (hold.current === h) { h.on = true; setDrag({ id, dy: 0 }); navigator.vibrate?.(15) } }, 300) }
    hold.current = h
  }
  const moveDrag = (e: React.PointerEvent) => {
    const h = hold.current; if (!h || !h.on) return
    setDrag({ id: h.id, dy: e.clientY - h.y0 })
    h.over = locate(h.id, e.clientY); setOver(h.over)
    const box = sheet.current?.getBoundingClientRect()
    if (box && sheet.current) { if (e.clientY < box.top + 70) sheet.current.scrollTop -= 14; else if (e.clientY > box.bottom - 70) sheet.current.scrollTop += 14 }
  }
  const up = () => {
    const h = hold.current; hold.current = null
    if (h) window.clearTimeout(h.t)
    if (h?.on && h.over !== null) write(moveItem(doc, h.id, h.over))
    setDrag(null); setOver(null)
  }
  const keyMove = (e: React.KeyboardEvent, id: string) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const i = doc.items.findIndex((x) => x.id === id)
    write(moveItem(doc, id, i + (e.key === 'ArrowUp' ? -1 : 1)))
  }
  const askStop = (x: { id: string; name: string; g: number }) => setAsk({ id: x.id, name: x.name, val: x.g > 0 ? String(x.g) : '' })
  const okStop = () => {
    if (!ask) return
    const v = Math.round(Number(ask.val))
    if (!(v >= 1 && v <= 99)) return
    write(setStop(doc, ask.id, v)); setAsk(null)
  }
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [open])
  const icon = (
    <button type="button" className="vbasket__icon" aria-label={`เปิดตะกร้า ${n} คน`} title={n === 0 ? 'ตะกร้าแผนเยี่ยม (ว่าง)' : stops.map((gr) => `จุด ${gr.g}${gr.name ? ` ${gr.name}` : ''}: ${gr.items.length} คน`).join(' · ')} onClick={() => setOpen(true)}>
          🧺{n > 0 && <span className="vbasket__badge">{n}</span>}
        </button>
  )
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setSlot(document.getElementById('vbasket-slot')) }, [])
  return (
    <>
      {slot ? createPortal(icon, slot) : <div className="vbasket__top no-print">{icon}</div>}
      {msg && !open && <p className="error small" role="alert" style={{ margin: '0.3rem 0 0' }}>{msg}</p>}
      {createPortal(
        open ? (
          <div className="vbasket__ov no-print" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="vbasket" role="dialog" aria-modal="true" aria-label="ตะกร้าแผนเยี่ยม" ref={sheet}>
              <div className="vbasket__h">
                <b>🧺 ตะกร้า · {dayLabel}</b>
                <span className="vbasket__hb">
                  <button type="button" className="vbasket__x" aria-label="ย่อตะกร้า" onClick={() => setOpen(false)}>✕</button>
                </span>
              </div>
        <div className="vplan__body">
          {n === 0
            ? <p className="empty">ตะกร้ายังว่าง — ปิดป๊อปอัพนี้แล้วแตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า</p>
            : (
              <>
                {canEdit && <p className="vplan__hint no-print" role="note"><span className="vplan__grip" aria-hidden="true">⋮⋮</span><span aria-hidden="true" className="vplan__finger">👆</span> กดค้างที่ปุ่มนี้ แล้วลากขึ้น-ลงเพื่อเรียงลำดับ · แตะ ＋ เพื่อเลือกจุดเยี่ยม (คนที่เลือกแล้วจะเปลี่ยนสี)</p>}
                <p className="pagehint" style={{ margin: '0 0 0.3rem' }}>{n} คน · กำหนดจุดแล้ว {doc.items.filter((x) => x.g > 0).length} คน</p>
                <ol className={`vplan__list${drag && over !== null && over >= doc.items.length - 1 ? ' vplan__list--end' : ''}`} aria-label="รายชื่อในตะกร้า">
                  {doc.items.map((x) => {
                    const m = byId.get(x.id)
                    const mo = m ? absentMonths(stats.get(m.id)?.last, today) : null
                    return (
                      <li key={x.id} data-pid={x.id} className={`vplan__item${x.g > 0 ? ' vplan__item--set' : ''}${drag?.id === x.id ? ' vplan__item--drag' : ''}${drag && drag.id !== x.id && over !== null && over === doc.items.filter((y) => y.id !== drag.id).findIndex((y) => y.id === x.id) ? ' vplan__item--ins' : ''}`} style={{ ...(x.g > 0 ? { background: stopColor(x.g).tint } : {}), ...(drag?.id === x.id ? { transform: `translateY(${drag.dy}px)` } : {}) }}>
                        {canEdit && <button type="button" className="vplan__handle" aria-label={`จับ ${x.name} เพื่อลากเรียงลำดับ (กดค้างแล้วลาก · ลูกศรขึ้นลงบนคีย์บอร์ด)`} onPointerDown={(e) => down(e, x.id)} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={up} onKeyDown={(e) => keyMove(e, x.id)} onContextMenu={(e) => e.preventDefault()}>⋮⋮<span className="vplan__finger" aria-hidden="true">👆</span></button>}
                        {canEdit
                          ? <button type="button" className="vplan__stop" aria-label={x.g > 0 ? `${x.name} จุดที่ ${x.g} (แตะเพื่อเปลี่ยนจุด)` : `กำหนดจุดเยี่ยมของ ${x.name}`} style={x.g > 0 ? { background: stopColor(x.g).dark, borderColor: stopColor(x.g).dark } : undefined} onClick={() => askStop(x)}>{x.g > 0 ? x.g : '＋'}</button>
                          : <span className="vplan__no" aria-hidden="true">{x.g > 0 ? x.g : '–'}</span>}
                        <MemberAvatar path={m?.photoPath} name={x.name} size={44} />
                        <span className="vplan__who"><b>{x.name}</b><small className="muted">{m ? `${statusShort(m.status)} · ${monthsText(mo)}` : 'ไม่พบในทะเบียน'}</small></span>
                        {canEdit && <button type="button" className="mini vplan__x" aria-label={`เอา ${x.name} ออกจากตะกร้า`} onClick={() => write(removeItem(doc, x.id))}>✕</button>}
                      </li>
                    )
                  })}
                </ol>
                {canEdit && n > 0 && (
                  <div className="row no-print">
                    <button type="button" className="mini" onClick={() => { if (window.confirm(`ล้างตะกร้าวัน ${dayLabel} ทั้งหมด ${n} คน ?`)) write({ ...doc, items: [] }) }}>ล้างตะกร้า</button>
                  </div>
                )}
              </>
            )}
        </div>
            </div>
          </div>
        ) : null, document.body)}
      {ask && createPortal(
        <div className="vbasket__ov vbasket__ov--ask no-print" onMouseDown={(e) => e.target === e.currentTarget && setAsk(null)}>
          <form className="vbasket__ask" role="dialog" aria-modal="true" aria-label="จุดเยี่ยม" onSubmit={(e) => { e.preventDefault(); okStop() }}>
            <p style={{ margin: 0 }}><b>{ask.name}</b></p>
            <p style={{ margin: 0 }}>รวมเข้าจุดเยี่ยมที่</p>
            <div className="vbasket__nums" role="radiogroup" aria-label="จุดเยี่ยมที่">
              {Array.from({ length: Math.max(10, Number(ask.val) || 0) }, (_, i) => i + 1).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={Number(ask.val) === k} className={`vbasket__num${Number(ask.val) === k ? ' on' : ''}`} onClick={() => setAsk({ ...ask, val: String(k) })}>{k}</button>
              ))}
            </div>
            <div className="row">
              <button type="submit" className="btn" disabled={!(Number(ask.val) >= 1)}>โอเค</button>
              <button type="button" className="mini" onClick={() => setAsk(null)}>ยกเลิก</button>
              {(doc.items.find((x) => x.id === ask.id)?.g ?? 0) > 0 && <button type="button" className="mini" onClick={() => { write(setStop(doc, ask.id, 0)); setAsk(null) }}>เอาออกจากจุด</button>}
            </div>
          </form>
        </div>, document.body)}
    </>
  )
}

/** ใช้ในหน้าที่ยังไม่มีข้อมูลสมาชิก/สถิติของตัวเอง (หน้ารายงาน): โหลดเอง แล้วแสดงตะกร้าเดียวกัน */
export function VisitBasketAuto() {
  const plans = useVisitPlans()
  const people = useChurchMembers()
  const y = new Date().getFullYear()
  const a0 = useAttendance(y), a1 = useAttendance(y - 1, false), a2 = useAttendance(y - 2, false), a3 = useAttendance(y - 3, false)
  const today = todayISO()
  const att = useMemo(() => toAttendance([a3, a2, a1, a0].flatMap((st) => st.items)), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => visitStats(att, today), [att, today])
  return <VisitBasket plans={plans} members={people.items} stats={stats} today={today} />
}
