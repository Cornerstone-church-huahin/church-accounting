import { useMemo, useState } from 'react'
import AbsentList, { monthsText } from './AbsentList'
import MemberAvatar from './MemberAvatar'
import { useVisitPlans } from '../lib/data'
import { absentMonths, type VisitStat } from '../lib/pastoral'
import { statusShort } from '../lib/registry'
import { addDays } from '../lib/money'
import { DAY_NAMES } from '../lib/visits'
import { addGroup, addItem, groupsOf, moveToGroup, moveWithin, removeGroup, removeItem, renameGroup, type PlanDoc } from '../lib/visitPlan'
import { fmtDay } from './PastoralVisits'
import type { ChurchMember } from '../lib/types'

/**
 * แผนเยี่ยมรายวัน (ตะกร้า): แตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า (ตัวเลขบนปุ่มตะกร้าเพิ่มขึ้น) → เปิดตะกร้าเห็นรูป+ชื่อ แบ่งเป็นกลุ่มที่ 1, 2, 3 … (เช่น กลุ่มที่ไปสถานที่เดียวกัน)
 * เลื่อนลำดับในกลุ่ม ▲▼ · ย้ายกลุ่ม · ตั้งชื่อสถานที่ของกลุ่มได้ · แอดมิน ผู้ดูแลหลัก ผู้ช่วย เห็นและแก้ร่วมกันแบบสด (ซิงก์ทุก 10 วินาที) · ที่ปรึกษาดูอย่างเดียว
 */
export default function VisitPlanBoard({ members, stats, today }: { members: ChurchMember[]; stats: Map<string, VisitStat>; today: string }) {
  const plans = useVisitPlans()
  const [date, setDate] = useState(today)
  const [view, setView] = useState<'pick' | 'plan'>('pick')
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
  const groupOpts = (cur: number) => [...Array.from({ length: doc.groups }, (_, i) => i + 1), doc.groups + 1].map((g) => <option key={g} value={g}>{g === doc.groups + 1 ? '＋ กลุ่มใหม่' : `กลุ่ม ${g}`}</option>).filter((o) => o.key !== String(cur))
  return (
    <div className="vplan">
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="วันก่อน" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div style={{ textAlign: 'center', lineHeight: 1.25 }}><b>แผนเยี่ยมวัน</b><br /><span className="small">{dayLabel}</span></div>
        <button type="button" className="mini" aria-label="วันถัดไป" onClick={() => setDate(addDays(date, 1))}>›</button>
      </div>
      <div className="seg seg--2 no-print" role="tablist" aria-label="เลือกคน / แผนของวัน">
        <button type="button" role="tab" aria-selected={view === 'pick'} className={view === 'pick' ? 'on' : ''} onClick={() => setView('pick')}>👥 เลือกคน</button>
        <button type="button" role="tab" aria-selected={view === 'plan'} className={view === 'plan' ? 'on' : ''} onClick={() => setView('plan')}>🧺 ตะกร้า <span className="vplan__n" aria-label={`${n} คน`}>{n}</span></button>
      </div>
      {msg && <p className="error small" role="alert" style={{ margin: '0.3rem 0 0' }}>{msg}</p>}
      {view === 'pick' ? (
        <>
          {canEdit
            ? (
              <div className="vplan__bar no-print">
                <button type="button" className="btn btn--gold vplan__go" onClick={() => setView('plan')}>🧺 ดูตะกร้า ({n})</button>
                {doc.groups > 1 && <label className="small">เพิ่มเข้า <select className="input" aria-label="เพิ่มเข้ากลุ่ม" value={addTo} onChange={(e) => setTarget(Number(e.target.value))}>{groups.map((g) => <option key={g.g} value={g.g}>กลุ่ม {g.g}{g.name ? ` · ${g.name}` : ''}</option>)}</select></label>}
              </div>
            )
            : <p className="pagehint" style={{ margin: '0.3rem 0 0' }}>ดูอย่างเดียว — แอดมิน ผู้ดูแลหลัก และผู้ช่วยเลือกคนเข้าแผนได้</p>}
          <AbsentList label={canEdit ? `แตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า (${n} คน${doc.groups > 1 ? ` · เพิ่มเข้ากลุ่ม ${addTo}` : ''})` : 'ค้นหาสมาชิก / เลือกสถานะ'} members={members} stats={stats} today={today}
            {...(canEdit ? { selectedIds: ids, onPick: toggle } : {})} />
        </>
      ) : (
        <section aria-label={`ตะกร้าแผนเยี่ยม ${dayLabel}`} style={{ marginTop: '0.4rem' }}>
          {n === 0 && groups.length <= 1
            ? <p className="empty">ตะกร้ายังว่าง — ไปที่ “เลือกคน” แล้วแตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า</p>
            : (
              <>
                <p className="pagehint" style={{ margin: '0 0 0.3rem' }}>{n} คน · {doc.groups} กลุ่ม{canEdit ? ' · เลื่อนลำดับด้วย ▲ ▼ · ย้ายกลุ่มที่ช่องกลุ่ม' : ''}</p>
                {groups.map((gr) => (
                  <section key={gr.g} className="vplan__grp" aria-label={`กลุ่มที่ ${gr.g}`}>
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
                        <ol className="vplan__list" aria-label={`ลำดับในกลุ่มที่ ${gr.g}`}>
                          {gr.items.map((x, i) => {
                            const m = byId.get(x.id)
                            const mo = m ? absentMonths(stats.get(m.id)?.last, today) : null
                            return (
                              <li key={x.id} className="vplan__item">
                                <span className="vplan__no" aria-hidden="true">{i + 1}</span>
                                <MemberAvatar path={m?.photoPath} name={x.name} size={44} />
                                <span className="vplan__who"><b>{x.name}</b><small className="muted">{m ? `${statusShort(m.status)} · ${monthsText(mo)}` : 'ไม่พบในทะเบียน'}</small></span>
                                {canEdit && (
                                  <span className="vplan__ctl no-print">
                                    <button type="button" className="mini" aria-label={`เลื่อน ${x.name} ขึ้น`} disabled={i === 0} onClick={() => write(moveWithin(doc, x.id, -1))}>▲</button>
                                    <button type="button" className="mini" aria-label={`เลื่อน ${x.name} ลง`} disabled={i === gr.items.length - 1} onClick={() => write(moveWithin(doc, x.id, 1))}>▼</button>
                                    <select className="input vplan__mv" aria-label={`ย้าย ${x.name} ไปกลุ่ม`} value="" onChange={(e) => { if (e.target.value) write(moveToGroup(doc, x.id, Number(e.target.value))) }}>
                                      <option value="">กลุ่ม {gr.g} ▾</option>{groupOpts(gr.g)}
                                    </select>
                                    <button type="button" className="mini" aria-label={`เอา ${x.name} ออกจากตะกร้า`} onClick={() => write(removeItem(doc, x.id))}>✕</button>
                                  </span>
                                )}
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
        </section>
      )}
    </div>
  )
}
