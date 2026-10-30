import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import AbsentList, { monthsText } from './AbsentList'
import MemberAvatar from './MemberAvatar'
import { useVisitPlans } from '../lib/data'
import { absentMonths, type VisitStat } from '../lib/pastoral'
import { statusShort } from '../lib/registry'
import { addDays } from '../lib/money'
import { DAY_NAMES } from '../lib/visits'
import { addItem, removeItem, renameGroup, setStop, stopsOf, type PlanDoc } from '../lib/visitPlan'
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
  const [ask, setAsk] = useState<{ id: string; name: string; val: string } | null>(null) // ป๊อปอัพ “จุดเยี่ยมที่”
  const [msg, setMsg] = useState('')
  const doc = plans.of(date)
  const canEdit = plans.canEdit()
  const ids = useMemo(() => doc.items.map((x) => x.id), [doc])
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const stops = stopsOf(doc)
  const write = (next: PlanDoc) => setMsg(plans.save(date, next) ? '' : 'สิทธิ์ของท่านแก้แผนเยี่ยมไม่ได้')
  const toggle = (m: ChurchMember) => write(ids.includes(m.id) ? removeItem(doc, m.id) : addItem(doc, m))
  const dayLabel = `${DAY_NAMES[new Date(date + 'T00:00:00Z').getUTCDay()]} ${fmtDay(date)}${date === today ? ' · วันนี้' : ''}`
  const n = doc.items.length
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
    <div className="vplan">
      {slot ? createPortal(icon, slot) : <div className="vbasket__top no-print">{icon}</div>}
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
                <span className="small">แตะ ＋ เพื่อใส่ตะกร้า · กดปุ่ม 🧺 ด้านบนเพื่อกำหนดจุดเยี่ยม</span>
              </div>
            )
            : <p className="pagehint" style={{ margin: '0.3rem 0 0' }}>ดูอย่างเดียว — แอดมิน ผู้ดูแลหลัก และผู้ช่วยเลือกคนเข้าแผนได้</p>}
          <AbsentList label={canEdit ? `แตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า (${n} คน)` : 'ค้นหาสมาชิก / เลือกสถานะ'} members={members} stats={stats} today={today}
            {...(canEdit ? { selectedIds: ids, onPick: toggle } : {})} />
        </>
      {createPortal(
        open ? (
          <div className="vbasket__ov no-print" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="vbasket" role="dialog" aria-modal="true" aria-label="ตะกร้าแผนเยี่ยม">
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
                {canEdit && <p className="vplan__hint no-print" role="note">แตะ ＋ ที่ชื่อ แล้วใส่เลข “จุดเยี่ยมที่” (1, 2, 3 …) · คนที่กำหนดจุดแล้วจะเปลี่ยนสี</p>}
                <p className="pagehint" style={{ margin: '0 0 0.3rem' }}>{n} คน · กำหนดจุดแล้ว {doc.items.filter((x) => x.g > 0).length} คน</p>
                <ol className="vplan__list" aria-label="รายชื่อในตะกร้า">
                  {doc.items.map((x) => {
                    const m = byId.get(x.id)
                    const mo = m ? absentMonths(stats.get(m.id)?.last, today) : null
                    return (
                      <li key={x.id} className={`vplan__item${x.g > 0 ? ' vplan__item--set' : ''}`}>
                        {canEdit
                          ? <button type="button" className="vplan__stop" aria-label={x.g > 0 ? `${x.name} จุดที่ ${x.g} (แตะเพื่อเปลี่ยนจุด)` : `กำหนดจุดเยี่ยมของ ${x.name}`} onClick={() => askStop(x)}>{x.g > 0 ? x.g : '＋'}</button>
                          : <span className="vplan__no" aria-hidden="true">{x.g > 0 ? x.g : '–'}</span>}
                        <MemberAvatar path={m?.photoPath} name={x.name} size={44} />
                        <span className="vplan__who"><b>{x.name}</b><small className="muted">{m ? `${statusShort(m.status)} · ${monthsText(mo)}` : 'ไม่พบในทะเบียน'}</small></span>
                        {canEdit && <button type="button" className="mini vplan__x" aria-label={`เอา ${x.name} ออกจากตะกร้า`} onClick={() => write(removeItem(doc, x.id))}>✕</button>}
                      </li>
                    )
                  })}
                </ol>
                <h3 className="vplan__th">📍 ตารางจุดเยี่ยม</h3>
                {stops.length === 0
                  ? <p className="muted small">ยังไม่มีจุดเยี่ยม — แตะ ＋ ที่ชื่อด้านบนเพื่อกำหนดจุด</p>
                  : stops.map((gr) => (
                    <section key={gr.g} className="vplan__grp" aria-label={`จุดที่ ${gr.g}`}>
                      <div className="vplan__gh">
                        <b>จุดที่ {gr.g}</b>
                        {canEdit
                          ? <input className="input vplan__gname" aria-label={`ชื่อสถานที่ของจุดที่ ${gr.g}`} placeholder="สถานที่/โซน (ถ้ามี)" maxLength={40} defaultValue={gr.name} key={`${date}-${gr.g}-${gr.name}`} onBlur={(e) => { if (e.target.value.trim() !== gr.name) write(renameGroup(doc, gr.g, e.target.value)) }} />
                          : gr.name && <span className="small muted">{gr.name}</span>}
                        <span className="small muted">{gr.items.length} คน</span>
                      </div>
                      <ol className="vplan__list" aria-label={`ลำดับในจุดที่ ${gr.g}`}>
                        {gr.items.map((x, i) => (
                          <li key={x.id} className="vplan__item">
                            <span className="vplan__no" aria-hidden="true">{i + 1}</span>
                            <span className="vplan__who"><b>{x.name}</b></span>
                            {canEdit && <button type="button" className="mini vplan__x" aria-label={`แก้จุดของ ${x.name}`} onClick={() => askStop(x)}>✎</button>}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
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
    </div>
  )
}
