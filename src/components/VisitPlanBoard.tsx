import { useMemo, useState } from 'react'
import AbsentList, { monthsText } from './AbsentList'
import MemberAvatar from './MemberAvatar'
import { useVisitPlans } from '../lib/data'
import { absentMonths, type VisitStat } from '../lib/pastoral'
import { statusShort } from '../lib/registry'
import { addDays } from '../lib/money'
import { DAY_NAMES } from '../lib/visits'
import { fmtDay } from './PastoralVisits'
import type { ChurchMember } from '../lib/types'

/**
 * แผนเยี่ยมรายวัน (เหมือนตะกร้าสินค้า): เลือกสมาชิกเพิ่มเรื่อยๆ จากรายชื่อคนที่ควรเยี่ยม → เปิดดู “แผนของวัน” เรียงลำดับเส้นทางได้ (▲▼) เพิ่ม/ลบได้
 * แอดมิน ผู้ดูแลหลัก ผู้ช่วย เห็นและแก้ร่วมกันแบบสด (ซิงก์ทุก 10 วินาที) · ที่ปรึกษาดูอย่างเดียว
 */
export default function VisitPlanBoard({ members, stats, today }: { members: ChurchMember[]; stats: Map<string, VisitStat>; today: string }) {
  const plans = useVisitPlans()
  const [date, setDate] = useState(today)
  const [view, setView] = useState<'pick' | 'plan'>('pick')
  const [msg, setMsg] = useState('')
  const items = plans.of(date)
  const canEdit = plans.canEdit()
  const ids = useMemo(() => items.map((x) => x.id), [items])
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const write = (next: typeof items) => setMsg(plans.save(date, next) ? '' : 'สิทธิ์ของท่านแก้แผนเยี่ยมไม่ได้')
  const toggle = (m: ChurchMember) => write(ids.includes(m.id) ? items.filter((x) => x.id !== m.id) : [...items, { id: m.id, name: m.name }])
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; write(n) }
  const dayLabel = `${DAY_NAMES[new Date(date + 'T00:00:00Z').getUTCDay()]} ${fmtDay(date)}${date === today ? ' · วันนี้' : ''}`
  return (
    <div className="vplan">
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="วันก่อน" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div style={{ textAlign: 'center', lineHeight: 1.25 }}><b>แผนเยี่ยมวัน</b><br /><span className="small">{dayLabel}</span></div>
        <button type="button" className="mini" aria-label="วันถัดไป" onClick={() => setDate(addDays(date, 1))}>›</button>
      </div>
      <div className="seg seg--2 no-print" role="tablist" aria-label="เลือกคน / แผนของวัน">
        <button type="button" role="tab" aria-selected={view === 'pick'} className={view === 'pick' ? 'on' : ''} onClick={() => setView('pick')}>👥 เลือกคน</button>
        <button type="button" role="tab" aria-selected={view === 'plan'} className={view === 'plan' ? 'on' : ''} onClick={() => setView('plan')}>🧺 แผนของวัน <span className="vplan__n" aria-label={`${items.length} คน`}>{items.length}</span></button>
      </div>
      {msg && <p className="error small" role="alert" style={{ margin: '0.3rem 0 0' }}>{msg}</p>}
      {view === 'pick' ? (
        <>
          {!canEdit && <p className="pagehint" style={{ margin: '0.3rem 0 0' }}>ดูอย่างเดียว — แอดมิน ผู้ดูแลหลัก และผู้ช่วยเลือกคนเข้าแผนได้</p>}
          <AbsentList label={canEdit ? `แตะชื่อเพื่อเพิ่ม/เอาออกจากแผนวันนี้ · เลือกแล้ว ${items.length} คน` : 'ค้นหาสมาชิก / เลือกสถานะ'} members={members} stats={stats} today={today}
            {...(canEdit ? { selectedIds: ids, onPick: toggle } : {})} />
        </>
      ) : (
        <section aria-label={`แผนเยี่ยม ${dayLabel}`} style={{ marginTop: '0.4rem' }}>
          {items.length === 0
            ? <p className="empty">ยังไม่มีคนในแผนของวันนี้ — ไปที่ “เลือกคน” แล้วแตะชื่อเพื่อเพิ่ม</p>
            : (
              <>
                <p className="pagehint" style={{ margin: '0 0 0.3rem' }}>{canEdit ? 'เรียงลำดับเส้นทางด้วยปุ่ม ▲ ▼ (คนที่ 1 ไปก่อน)' : 'ลำดับเส้นทางที่วางแผนไว้'} · {items.length} คน</p>
                <ol className="vplan__list" aria-label="ลำดับที่จะไปเยี่ยม">
                  {items.map((x, i) => {
                    const m = byId.get(x.id)
                    const mo = m ? absentMonths(stats.get(m.id)?.last, today) : null
                    return (
                      <li key={x.id} className="vplan__item">
                        <span className="vplan__no" aria-hidden="true">{i + 1}</span>
                        <MemberAvatar path={m?.photoPath} name={x.name} size={44} />
                        <span className="vplan__who"><b>{x.name}</b><small className="muted">{m ? `${statusShort(m.status)} · ${monthsText(mo)}` : 'ไม่พบในทะเบียน'}</small></span>
                        {canEdit && (
                          <span className="vplan__ctl no-print">
                            <button type="button" className="mini" aria-label={`เลื่อน ${x.name} ขึ้น`} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                            <button type="button" className="mini" aria-label={`เลื่อน ${x.name} ลง`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>▼</button>
                            <button type="button" className="mini" aria-label={`เอา ${x.name} ออกจากแผน`} onClick={() => write(items.filter((y) => y.id !== x.id))}>✕</button>
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ol>
                {canEdit && <button type="button" className="mini no-print" onClick={() => { if (window.confirm(`ล้างแผนเยี่ยมวัน ${dayLabel} ทั้งหมด ${items.length} คน ?`)) write([]) }}>ล้างแผนของวันนี้</button>}
              </>
            )}
        </section>
      )}
    </div>
  )
}
