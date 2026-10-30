import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AbsentList, { monthsText } from './AbsentList'
import MemberAvatar from './MemberAvatar'
import { useVisitPlans } from '../lib/data'
import { absentMonths, type VisitStat } from '../lib/pastoral'
import { statusShort } from '../lib/registry'
import { addDays } from '../lib/money'
import { DAY_NAMES } from '../lib/visits'
import { addGroup, addItem, groupsOf, moveTo, moveWithin, removeGroup, removeItem, renameGroup, type PlanDoc } from '../lib/visitPlan'
import { fmtDay } from './PastoralVisits'
import type { ChurchMember } from '../lib/types'

/**
 * แผนเยี่ยมรายวัน (ตะกร้า): แตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า (ตัวเลขบนปุ่มตะกร้าเพิ่มขึ้น) → เปิดตะกร้าเห็นรูป+ชื่อ แบ่งเป็นกลุ่มที่ 1, 2, 3 … (เช่น กลุ่มที่ไปสถานที่เดียวกัน)
 * เลื่อนลำดับในกลุ่ม ▲▼ · ย้ายกลุ่ม · ตั้งชื่อสถานที่ของกลุ่มได้ · แอดมิน ผู้ดูแลหลัก ผู้ช่วย เห็นและแก้ร่วมกันแบบสด (ซิงก์ทุก 10 วินาที) · ที่ปรึกษาดูอย่างเดียว
 */
export default function VisitPlanBoard({ members, stats, today }: { members: ChurchMember[]; stats: Map<string, VisitStat>; today: string }) {
  const plans = useVisitPlans()
  const [date, setDate] = useState(today)
  const [open, setOpen] = useState(false) // ตะกร้าเปิดเป็นป๊อปอัพ (false = ย่อเหลือปุ่มตะกร้าลอยอยู่ด้านล่าง)
  const [target, setTarget] = useState(0) // กลุ่มที่จะเพิ่มคนเข้า (0 = กลุ่มสุดท้าย)
  const [msg, setMsg] = useState('')
  const doc = plans.of(date)
  const canEdit = plans.canEdit()
  const ids = useMemo(() => doc.items.map((x) => x.id), [doc])
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const groups = groupsOf(doc)
  const addTo = target > 0 && target <= doc.groups ? target : doc.groups
  const write = (next: PlanDoc) => setMsg(plans.save(date, next) ? '' : 'สิทธิ์ของท่านแก้แผนเยี่ยมไม่ได้')
  const toggle = (m: ChurchMember) => write(ids.includes(m.id) ? removeItem(doc, m.id) : addItem(doc, m, addTo))
  const dayLabel = `${DAY_NAMES[new Date(date + 'T00:00:00Z').getUTCDay()]} ${fmtDay(date)}${date === today ? ' · วันนี้' : ''}`
  const n = doc.items.length
  // ลากวาง: กดค้างที่ปุ่มจับ ⋮⋮ (≈0.3 วินาที) แล้วลากไปวางตำแหน่ง/กลุ่มใหม่ · ปล่อยแล้วบันทึก
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null)
  const [over, setOver] = useState<{ g: number; index: number } | null>(null)
  const hold = useRef<{ id: string; t: number; y0: number; on: boolean; over: { g: number; index: number } | null } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const locate = (id: string, y: number): { g: number; index: number } | null => {
    const root = sheet.current; if (!root) return null
    const secs = [...root.querySelectorAll<HTMLElement>('[data-gid]')]
    if (!secs.length) return null
    let sec = secs.find((e) => { const r = e.getBoundingClientRect(); return y >= r.top && y <= r.bottom })
    if (!sec) sec = y < secs[0].getBoundingClientRect().top ? secs[0] : secs[secs.length - 1]
    const g = Number(sec.dataset.gid)
    const rows = [...sec.querySelectorAll<HTMLElement>('[data-pid]')].filter((e) => e.dataset.pid !== id)
    let index = rows.length
    for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { index = i; break } }
    return { g, index }
  }
  const down = (e: React.PointerEvent, id: string) => {
    if (!canEdit) return
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    const h = { id, y0: e.clientY, on: false, over: null as { g: number; index: number } | null, t: window.setTimeout(() => { if (hold.current === h) { h.on = true; setDrag({ id, dy: 0 }); navigator.vibrate?.(15) } }, 300) }
    hold.current = h
  }
  const moveDrag = (e: React.PointerEvent) => {
    const h = hold.current; if (!h || !h.on) return
    setDrag({ id: h.id, dy: e.clientY - h.y0 })
    h.over = locate(h.id, e.clientY); setOver(h.over)
    const box = sheet.current?.getBoundingClientRect() // ลากใกล้ขอบบน/ล่างของป๊อปอัพ = เลื่อนหน้าให้
    if (box && sheet.current) { if (e.clientY < box.top + 70) sheet.current.scrollTop -= 14; else if (e.clientY > box.bottom - 70) sheet.current.scrollTop += 14 }
  }
  const up = () => {
    const h = hold.current; hold.current = null
    if (h) window.clearTimeout(h.t)
    if (h?.on && h.over) write(moveTo(doc, h.id, h.over.g, h.over.index))
    setDrag(null); setOver(null)
  }
  const keyMove = (e: React.KeyboardEvent, id: string) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); write(moveWithin(doc, id, e.key === 'ArrowUp' ? -1 : 1)) } }
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [open])
  return (
    <div className="vplan">
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="วันก่อน" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div style={{ textAlign: 'center', lineHeight: 1.25 }}><b>แผนเยี่ยมวัน</b><br /><span className="small">{dayLabel}</span></div>
        <button type="button" className="mini" aria-label="วันถัดไป" onClick={() => setDate(addDays(date, 1))}>›</button>
      </div>
      {msg && <p className="error small" role="alert" style={{ margin: '0.3rem 0 0' }}>{msg}</p>}
        <>
          {canEdit
            ? (
              <div className="vplan__bar no-print">
                <span className="small">แตะ ＋ เพื่อใส่ตะกร้า · กดปุ่ม 🧺 ด้านล่างเพื่อดู/จัดกลุ่ม/เรียงลำดับ</span>
                {doc.groups > 1 && <label className="small">เพิ่มเข้า <select className="input" aria-label="เพิ่มเข้ากลุ่ม" value={addTo} onChange={(e) => setTarget(Number(e.target.value))}>{groups.map((g) => <option key={g.g} value={g.g}>กลุ่ม {g.g}{g.name ? ` · ${g.name}` : ''}</option>)}</select></label>}
              </div>
            )
            : <p className="pagehint" style={{ margin: '0.3rem 0 0' }}>ดูอย่างเดียว — แอดมิน ผู้ดูแลหลัก และผู้ช่วยเลือกคนเข้าแผนได้</p>}
          <AbsentList label={canEdit ? `แตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า (${n} คน${doc.groups > 1 ? ` · เพิ่มเข้ากลุ่ม ${addTo}` : ''})` : 'ค้นหาสมาชิก / เลือกสถานะ'} members={members} stats={stats} today={today}
            {...(canEdit ? { selectedIds: ids, onPick: toggle } : {})} />
        </>
      {createPortal(
        open ? (
          <div className="vbasket__ov no-print" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="vbasket" role="dialog" aria-modal="true" aria-label="ตะกร้าแผนเยี่ยม" ref={sheet}>
              <div className="vbasket__h">
                <b>🧺 ตะกร้า · {dayLabel}</b>
                <span className="vbasket__hb">
                  <button type="button" className="mini" aria-label="ย่อตะกร้า" onClick={() => setOpen(false)}>ย่อ ▾</button>
                </span>
              </div>
        <div className="vplan__body">
            {canEdit && n > 0 && <p className="vplan__hint no-print" role="note"><span className="vplan__grip" aria-hidden="true">⋮⋮</span> กดค้างที่ปุ่มนี้ แล้วลากเพื่อเรียงลำดับ หรือย้ายไปกลุ่มอื่น</p>}
          {n === 0 && groups.length <= 1
            ? <p className="empty">ตะกร้ายังว่าง — ปิดป๊อปอัพนี้แล้วแตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า</p>
            : (
              <>
                <p className="pagehint" style={{ margin: '0 0 0.3rem' }}>{n} คน · {doc.groups} กลุ่ม</p>
                {groups.map((gr) => (
                  <section key={gr.g} className={`vplan__grp${drag && over?.g === gr.g ? ' vplan__grp--over' : ''}`} aria-label={`กลุ่มที่ ${gr.g}`} data-gid={gr.g}>
                    <div className="vplan__gh">
                      <b>กลุ่มที่ {gr.g}</b>
                      {canEdit
                        ? <input className="input vplan__gname" aria-label={`ชื่อสถานที่ของกลุ่มที่ ${gr.g}`} placeholder="สถานที่/โซน (ถ้ามี)" maxLength={40} defaultValue={gr.name} key={`${date}-${gr.g}-${gr.name}`} onBlur={(e) => { if (e.target.value.trim() !== gr.name) write(renameGroup(doc, gr.g, e.target.value)) }} />
                        : gr.name && <span className="small muted">{gr.name}</span>}
                      <span className="small muted">{gr.items.length} คน</span>
                      {canEdit && gr.items.length === 0 && doc.groups > 1 && <button type="button" className="mini" aria-label={`ลบกลุ่มที่ ${gr.g}`} onClick={() => write(removeGroup(doc, gr.g))}>ลบกลุ่ม</button>}
                    </div>
                    {gr.items.length === 0
                      ? <p className="muted small" style={{ margin: '0.2rem 0.5rem' }}>ยังไม่มีคนในกลุ่มนี้</p>
                      : (
                        <ol className={`vplan__list${drag && over && over.g === gr.g && over.index >= gr.items.filter((y) => y.id !== drag.id).length ? ' vplan__list--end' : ''}`} aria-label={`ลำดับในกลุ่มที่ ${gr.g}`}>
                          {gr.items.map((x, i) => {
                            const m = byId.get(x.id)
                            const mo = m ? absentMonths(stats.get(m.id)?.last, today) : null
                            return (
                              <li key={x.id} data-pid={x.id} className={`vplan__item${drag?.id === x.id ? ' vplan__item--drag' : ''}${drag && over && over.g === gr.g && drag.id !== x.id && over.index === gr.items.filter((y) => y.id !== drag.id).findIndex((y) => y.id === x.id) ? ' vplan__item--ins' : ''}`} style={drag?.id === x.id ? { transform: `translateY(${drag.dy}px)` } : undefined}>
                                {canEdit && <button type="button" className="vplan__handle" aria-label={`จับ ${x.name} เพื่อลากเรียงลำดับ (กดค้างแล้วลาก · ลูกศรขึ้นลงบนคีย์บอร์ด)`} onPointerDown={(e) => down(e, x.id)} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={up} onKeyDown={(e) => keyMove(e, x.id)} onContextMenu={(e) => e.preventDefault()}>⋮⋮</button>}
                                <span className="vplan__no" aria-hidden="true">{i + 1}</span>
                                <MemberAvatar path={m?.photoPath} name={x.name} size={44} />
                                <span className="vplan__who"><b>{x.name}</b><small className="muted">{m ? `${statusShort(m.status)} · ${monthsText(mo)}` : 'ไม่พบในทะเบียน'}</small></span>
                                {canEdit && <button type="button" className="mini vplan__x" aria-label={`เอา ${x.name} ออกจากตะกร้า`} onClick={() => write(removeItem(doc, x.id))}>✕</button>}
                              </li>
                            )
                          })}
                        </ol>
                      )}
                  </section>
                ))}
                {canEdit && (
                  <div className="row no-print">
                    <button type="button" className="mini" onClick={() => write(addGroup(doc))}>＋ เพิ่มกลุ่ม</button>
                    {n > 0 && <button type="button" className="mini" onClick={() => { if (window.confirm(`ล้างตะกร้าวัน ${dayLabel} ทั้งหมด ${n} คน ?`)) write({ ...doc, items: [] }) }}>ล้างตะกร้า</button>}
                  </div>
                )}
              </>
            )}
        </div>
            </div>
          </div>
        ) : (
          <button type="button" className="vbasket__bar no-print" aria-label={`เปิดตะกร้า ${n} คน`} onClick={() => setOpen(true)}>
            <span className="vbasket__ic">🧺 <span className="vplan__n">{n}</span></span>
            <span className="vbasket__chips" aria-label="สรุปแต่ละกลุ่ม">
              {n === 0
                ? <span className="vbasket__empty">ยังไม่มีคนในตะกร้า</span>
                : groups.map((gr) => <span key={gr.g} className="vbasket__chip"><b>{gr.g}</b>{gr.name ? ` ${gr.name}` : ''} · {gr.items.length}</span>)}
            </span>
            <span aria-hidden="true" className="vbasket__up">▴</span>
          </button>
        ), document.body)}
    </div>
  )
}
