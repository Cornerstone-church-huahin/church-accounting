import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import StoredImage from './StoredImage'
import MemberAvatar from './MemberAvatar'
import PastoralVisits, { VisitReport, TRIP_TINT, fmtDay, rangeText } from './PastoralVisits'
import { canRole, canWork } from '../lib/access'
import { VisitBasketAuto } from './VisitBasket'
import { useChurchMembers, useSettings, useVisits } from '../lib/data'
import { useRole } from '../lib/members'
import { formatCoord, mapsLink } from '../lib/geo'
import { nearCheckin, timeText } from '../lib/visitProof'
import { DAY_NAMES, sundayOf, tripNumbers, weekStats } from '../lib/visits'
import type { Visit } from '../lib/types'

const dayName = (iso: string) => DAY_NAMES[new Date(iso + 'T00:00:00Z').getUTCDay()]

/**
 * งานอภิบาล › รายงานการเยี่ยม: รายการสัปดาห์แบบแถวยาวแคบ (ใหม่สุดบน) → แตะแล้วเห็นการเยี่ยมของสัปดาห์นั้นทั้งหมด
 * (ผู้ออกเยี่ยม เหตุผล รายละเอียด เวลาเช็คอิน รูป) · ข้อมูลมาจากแท็บ “บันทึกเยี่ยม”
 */
export default function VisitReports() {
  const role = useRole()
  const { settings } = useSettings()
  const visits = useVisits(true)
  const members = useChurchMembers()
  const [open, setOpen] = useState<string | null>(null)
  const [a4, setA4] = useState(false)
  const [view, setView] = useState<'weeks' | 'cards' | 'report'>('weeks') // รายการสัปดาห์ · การ์ด 7 วัน · ใบรายงานสัปดาห์
  const [pic, setPic] = useState<{ v: Visit; path: string } | null>(null)
  const weeks = useMemo(() => {
    const m = new Map<string, Visit[]>()
    for (const v of visits.list) { const k = sundayOf(v.date); m.set(k, [...(m.get(k) ?? []), v]) }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([sunday, vs]) => ({ sunday, vs, st: weekStats(vs) }))
  }, [visits.list])
  if (!(canRole(role, 'detail') || canWork(4, 'view'))) return <p className="empty">ไม่มีสิทธิ์ดูรายงานการเยี่ยม</p>
  const photoOf = (id: string) => members.items.find((m) => m.id === id)?.photoPath
  const wk = weeks.find((w) => w.sunday === open)

  if (wk) {
    const days = [...new Set(wk.vs.map((v) => v.date))].sort()
    const trip = tripNumbers(wk.vs)
    return (
      <div className="vrep">
      <VisitBasketAuto />
        <div className="row row--between no-print" style={{ marginBottom: '0.4rem' }}>
          <button type="button" className="mini" onClick={() => { setOpen(null); setA4(false) }}>‹ รายการสัปดาห์</button>
          <div className="seg seg--2" role="tablist" aria-label="มุมมอง" style={{ maxWidth: '14rem' }}>
            <button type="button" role="tab" aria-selected={!a4} className={!a4 ? 'on' : ''} onClick={() => setA4(false)}>รายละเอียด</button>
            <button type="button" role="tab" aria-selected={a4} className={a4 ? 'on' : ''} onClick={() => setA4(true)}>ใบ A4</button>
          </div>
        </div>
        <h2 className="vrep__h">สัปดาห์ {rangeText(wk.sunday)}</h2>
        <p className="small" role="status" style={{ margin: '0 0 0.5rem' }}>ออกเยี่ยม <b>{wk.st.trips}</b> ครั้ง · เยี่ยม <b>{wk.st.people}</b> คน · ผู้ออกเยี่ยม: {wk.st.visitors.join(', ') || '—'}</p>
        {a4
          ? <VisitReport church={settings.churchName.split(' ')[0]} sunday={wk.sunday} visits={wk.vs} />
          : days.map((d) => (
            <section key={d} className="vrep__day" aria-label={`${dayName(d)} ${fmtDay(d)}`}>
              <h3>{dayName(d)} {fmtDay(d)}</h3>
              {wk.vs.filter((v) => v.date === d).sort((a, b) => a.updated - b.updated).map((v) => (
                <article key={v.id} className="vrep__v" style={{ background: TRIP_TINT[(trip.get(v.id) ?? 1) % 2] }}>
                  <div className="vrep__top">
                    <MemberAvatar path={photoOf(v.memberId)} name={v.memberName} size={44} />
                    <div className="vrep__who"><b>{v.memberName}</b><span className="small muted">ออกเยี่ยมครั้งที่ {trip.get(v.id)} · ผู้ออกเยี่ยม: {v.visitor}</span></div>
                  </div>
                  {v.reason && <p className="vrep__p"><span className="muted small">เหตุผล</span> {v.reason}</p>}
                  {v.checkin && <p className="vrep__p small">📍 เช็คอิน {timeText(v.checkin.at)} น. · <a href={mapsLink(v.checkin)} target="_blank" rel="noreferrer">{formatCoord(v.checkin)}</a></p>}
                  {(v.photos?.length ?? 0) > 0 && (
                    <div className="vrep__pics">
                      {v.photos!.map((p, i) => {
                        const pr = v.photoProof?.find((x) => x.path === p)
                        return (
                          <button key={p} type="button" className="vrep__pic" aria-label={`ดูรูปที่ ${i + 1} ของ ${v.memberName}`} onClick={() => setPic({ v, path: p })}>
                            <MemberAvatar path={p} name="📷" size={64} />
                            <small>{pr ? `ถ่าย ${timeText(pr.at)} น.` : 'รูป'}</small>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </article>
              ))}
            </section>
          ))}
        {pic && (() => {
          const pr = pic.v.photoProof?.find((x) => x.path === pic.path)
          return (
            <Sheet title={`รูปเยี่ยม ${pic.v.memberName}`} onClose={() => setPic(null)}>
              <StoredImage path={pic.path} alt={`รูปเยี่ยม ${pic.v.memberName}`} />
              {pr
                ? <p className="small" style={{ margin: 0 }}>ถ่ายเมื่อ {new Date(pr.at).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} น. · <a href={mapsLink(pr)} target="_blank" rel="noreferrer">{formatCoord(pr)}</a>{pic.v.checkin ? ` · ห่างจุดเช็คอิน ${nearCheckin(pr, pic.v.checkin).meters} ม.` : ''}</p>
                : <p className="small muted" style={{ margin: 0 }}>รูปนี้ไม่มีข้อมูลเวลา/ตำแหน่งตอนถ่าย (บันทึกก่อนมีระบบถ่ายรูปในแอป)</p>}
            </Sheet>
          )
        })()}
      </div>
    )
  }

  return (
    <div className="vrep">
      <VisitBasketAuto />
      <div className="seg seg--3 no-print" role="tablist" aria-label="มุมมองรายงาน" style={{ marginBottom: '0.4rem' }}>
        <button type="button" role="tab" aria-selected={view === 'weeks'} className={view === 'weeks' ? 'on' : ''} onClick={() => setView('weeks')}>📋 รายสัปดาห์</button>
        <button type="button" role="tab" aria-selected={view === 'cards'} className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>🗓️ การ์ด 7 วัน</button>
        <button type="button" role="tab" aria-selected={view === 'report'} className={view === 'report' ? 'on' : ''} onClick={() => setView('report')}>📄 รายงานสัปดาห์</button>
      </div>
      {view === 'cards' ? <PastoralVisits key="cards" only="cards" readOnly /> : view === 'report' ? <PastoralVisits key="report" only="report" readOnly /> : null}
      {view !== 'weeks' ? null : weeks.length === 0
        ? <p className="empty">ยังไม่มีบันทึกการเยี่ยม — บันทึกที่แท็บ “บันทึกเยี่ยม” แล้วจะขึ้นที่นี่</p>
        : (
          <ul className="vrep__list" aria-label="สัปดาห์ที่มีการเยี่ยม">
            {weeks.map((w) => (
              <li key={w.sunday}>
                <button type="button" className="vrow" aria-label={`สัปดาห์ ${rangeText(w.sunday)}`} onClick={() => setOpen(w.sunday)}>
                  <span className="vrow__main"><b>{rangeText(w.sunday)}</b><span className="vrow__n">{w.st.trips} ครั้ง · {w.st.people} คน</span></span>
                  <small className="vrow__sub muted">ผู้ออกเยี่ยม: {w.st.visitors.join(', ') || '—'}</small>
                  <span className="vrow__go" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
