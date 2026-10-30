import { useMemo, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import AbsentList from './AbsentList'
import Sheet from './Sheet'
import { VisitForm, fmtDay } from './PastoralVisits'
import { monthsText } from './AbsentList'
import { canRole, canWork } from '../lib/access'
import { useAttendance, useChurchMembers, useVisitPlans, useVisits, useWorkTeams } from '../lib/data'
import { useRole } from '../lib/members'
import { absentMonths, visitStats } from '../lib/pastoral'
import { toAttendance } from '../lib/registry'
import { todayISO } from '../lib/money'
import { addItem, dropItem, refreshPrep, setStop, stopColor } from '../lib/visitPlan'
import { timeText } from '../lib/visitProof'
import { homeFromCheckin } from '../lib/geo'
import { removeMemberPhotoFile } from '../lib/memberPhoto'
import { DAY_NAMES, visitsOn } from '../lib/visits'
import type { Visit } from '../lib/types'

/**
 * งานอภิบาล › บันทึกการเยี่ยม: รายการที่ “ส่งข้อมูลเตรียมเยี่ยม” มาจากตะกร้า (ตารางเยี่ยม) เรียงเป็นจุดที่ 1, 2, 3 …
 * แตะชื่อ = เปิดฟอร์มบันทึกการเยี่ยม (เหตุผล รูป เช็คอินพิกัด/เวลา) · แต่ละจุดเพิ่มผู้ถูกเยี่ยมที่พบเพิ่มได้ · ไม่พบ/ไม่อยู่บ้านใส่หมายเหตุได้
 */
const DROP_REASONS = ['ไม่เจอ/ไม่อยู่', 'ย้ายที่อยู่', 'ยกเลิกนัด', 'ใส่ผิดคน', 'อื่นๆ']

export default function VisitRecord() {
  const role = useRole()
  const isAdmin = role === 'admin'
  const canWrite = canRole(role, 'detail') || canWork(4, 'edit')
  const canView = canWrite || canWork(4, 'view')
  const visits = useVisits(true)
  const plans = useVisitPlans()
  const team = useWorkTeams().of(4)
  const people = useChurchMembers()
  const y = new Date().getFullYear()
  const a0 = useAttendance(y), a1 = useAttendance(y - 1, false), a2 = useAttendance(y - 2, false), a3 = useAttendance(y - 3, false)
  const today = todayISO()
  const att = useMemo(() => toAttendance([a3, a2, a1, a0].flatMap((st) => st.items)), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => visitStats(att, today), [att, today])
  const [form, setForm] = useState<{ entry: Visit | null; stop: number; member?: { id: string; name: string }; absent?: boolean } | null>(null)
  const [note, setNote] = useState('')
  const [leave, setLeave] = useState<{ id: string; name: string; stop: number; step?: 'remove'; reason?: string; note?: string } | null>(null) // ✕ ที่แถว: ไปแล้วไม่พบ หรือเอาออกจากรายการ
  const [adding, setAdding] = useState<number | null>(null) // เปิดป๊อปอัพเลือกคนเพิ่มเข้าจุดนี้
  const planDoc = plans.of(today)
  const prep = planDoc.prep
  const canPlan = plans.canEdit()
  const todays = visitsOn(visits.list, today)
  const stopNos = useMemo(() => {
    const set = new Set<number>([...(prep?.items ?? []).map((x) => x.g), ...todays.map((v) => v.stop ?? 0).filter((g) => g > 0)])
    return [...set].sort((a, b) => a - b)
  }, [prep, todays])
  if (!canView) return <p className="empty">ไม่มีสิทธิ์ดูบันทึกการเยี่ยม</p>
  const dayLabel = `${DAY_NAMES[new Date(today + 'T00:00:00Z').getUTCDay()]} ${fmtDay(today)}`
  const byId = (id: string) => people.items.find((m) => m.id === id)
  const reasonOf = (id: string) => { const mo = absentMonths(stats.get(id)?.last, today); return mo !== null && mo >= 1 ? monthsText(mo) : '' }
  // เช็คอิน/ผู้ออกเยี่ยมของจุดเดียวกัน ใช้ต่อให้คนถัดไป (แก้ได้)
  const carry = (g: number) => {
    const last = todays.filter((v) => v.stop === g && v.checkin).sort((a, b) => b.updated - a.updated)[0] ?? todays.filter((v) => v.stop === g).sort((a, b) => b.updated - a.updated)[0]
    return last ? { ...(last.checkin ? { checkin: last.checkin } : {}), visitor: last.visitor } : {}
  }
  const applyCheckin = (v: Visit) => {
    const m = v.checkin ? byId(v.memberId) : undefined
    if (!m || !v.checkin) return
    const at = { lat: v.checkin.lat, lng: v.checkin.lng }
    const r = homeFromCheckin(m, at)
    if (r.action === 'keep') return
    if (r.action === 'ask' && !window.confirm(`พิกัดบ้านของ ${m.name} ในทะเบียนต่างจากจุดเช็คอินนี้ ${r.meters} เมตร\nอัปเดตพิกัดบ้านตามจุดเช็คอินนี้ไหม?`)) return
    people.put([{ ...m, ...at }]) && setNote(`บันทึกพิกัดบ้านของ ${m.name} เข้าทะเบียนสมาชิกแล้ว`)
  }
  const total = (prep?.items.length ?? 0) + todays.filter((v) => v.stop && !(prep?.items ?? []).some((x) => x.id === v.memberId)).length
  const met = todays.filter((v) => v.stop && !v.absent).length, notMet = todays.filter((v) => v.stop && v.absent).length
  return (
    <div className="vrec">
      <p className="small" role="status" style={{ margin: '0 0 0.4rem' }}>
        <b>วันนี้ {dayLabel}</b>{prep ? ` · ส่งข้อมูลเตรียมเยี่ยมเมื่อ ${timeText(prep.at)} น. · พบ ${met} · ไปแล้วไม่พบ ${notMet} · รอบันทึก ${Math.max(0, total - met - notMet)}` : ''}
      </p>
      {note && <p className="small pvnote" role="status" style={{ margin: '0 0 0.4rem' }}>📍 {note}</p>}
      {!prep && todays.length === 0 && stopNos.length === 0 && (
        <p className="empty">ยังไม่มีรายการเตรียมเยี่ยมของวันนี้ — ไปที่ “ตารางเยี่ยม” จัดตะกร้าและเลือกจุดเยี่ยม แล้วกด “📤 ส่งข้อมูลเตรียมเยี่ยม” รายชื่อจะมาที่นี่ตามลำดับ</p>
      )}
      {stopNos.map((g) => {
        const planned = (prep?.items ?? []).filter((x) => x.g === g)
        const extras = todays.filter((v) => v.stop === g && !(prep?.items ?? []).some((x) => x.id === v.memberId))
        const c = stopColor(g)
        return (
          <section key={g} className="vrec__stop" aria-label={`จุดที่ ${g}`} style={{ borderLeft: `6px solid ${c.dark}`, background: c.tint }}>
            <div className="vplan__gh">
              <b style={{ color: c.dark }}>จุดที่ {g}</b><span className="small muted">{planned.length + extras.length} คน</span>
              {canPlan && <button type="button" className="mini vrec__add" aria-label={`เพิ่มผู้ถูกเยี่ยมในจุดที่ ${g}`} onClick={() => setAdding(g)}>＋ เพิ่มคน</button>}
            </div>
            <ul className="vrec__list">
              {planned.map((x) => {
                const v = todays.find((y2) => y2.memberId === x.id)
                return <Row key={x.id} id={x.id} name={x.name} photo={byId(x.id)?.photoPath} v={v} onRemove={!v && canPlan ? () => setLeave({ id: x.id, name: x.name, stop: g }) : undefined} canTap={canWrite && (!v || isAdmin)} onTap={() => setForm({ entry: v ?? null, stop: g, ...(v ? {} : { member: { id: x.id, name: x.name } }) })} />
              })}
              {extras.map((v) => <Row key={v.id} id={v.memberId} name={v.memberName} photo={byId(v.memberId)?.photoPath} v={v} extra canTap={canWrite && isAdmin} onTap={() => setForm({ entry: v, stop: g })} />)}
            </ul>
          </section>
        )
      })}
      {canPlan && (prep || todays.length > 0) && (
        <button type="button" className="mini" onClick={() => setAdding(Math.max(0, ...stopNos) + 1)}>＋ เพิ่มจุดเยี่ยม</button>
      )}
      {adding !== null && (
        <Sheet title={`เพิ่มผู้ถูกเยี่ยมในจุดที่ ${adding}`} onClose={() => setAdding(null)}>
          <AbsentList label="ค้นหาสมาชิก แล้วแตะ ＋ เพื่อเพิ่มเข้าจุดนี้" members={people.items} stats={stats} today={today}
            selectedIds={planDoc.items.filter((x) => x.g === adding).map((x) => x.id)}
            onPick={(m) => {
              const cur = planDoc.items.find((x) => x.id === m.id)
              if (cur && (cur.g === adding || todays.some((v) => v.memberId === m.id))) return // อยู่จุดนี้แล้ว / บันทึกการเยี่ยมไปแล้ว
              const base = planDoc.prep ? planDoc : { ...planDoc, prep: { at: Date.now(), items: [] } }
              plans.save(today, refreshPrep(setStop(cur ? base : addItem(base, m), m.id, adding)))
            }} />
          <div className="row"><button type="button" className="btn btn--gold" onClick={() => setAdding(null)}>เสร็จ</button></div>
        </Sheet>
      )}
      {leave && (
        <Sheet title={leave.name} onClose={() => setLeave(null)}>
          {leave.step !== 'remove' ? (
            <>
              <p style={{ margin: 0 }}>จุดที่ {leave.stop} · เลือกให้ตรงกับที่เกิดขึ้นจริง</p>
              <button type="button" className="btn btn--gold" onClick={() => { const l = leave; setLeave(null); setForm({ entry: null, stop: l.stop, member: { id: l.id, name: l.name }, absent: true }) }}>ไปแล้วแต่ไม่พบ (เช็คอินเก็บเส้นทางไว้)</button>
              <button type="button" className="btn btn--ghost" onClick={() => setLeave({ ...leave, step: 'remove' })}>เอาออกจากรายการ…</button>
              <button type="button" className="mini" onClick={() => setLeave(null)}>ยกเลิก</button>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}><b>สาเหตุที่ลบ {leave.name} ออกจากรายการ</b></p>
              <div className="vrec__reasons" role="radiogroup" aria-label="สาเหตุที่ลบ">
                {DROP_REASONS.map((r) => <button key={r} type="button" role="radio" aria-checked={leave.reason === r} className={`vbasket__num${leave.reason === r ? ' on' : ''}`} onClick={() => setLeave({ ...leave, reason: r })}>{r}</button>)}
              </div>
              <input className="input" aria-label="หมายเหตุสาเหตุที่ลบ" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" maxLength={80} value={leave.note ?? ''} onChange={(e) => setLeave({ ...leave, note: e.target.value })} />
              <button type="button" className="btn btn--gold" disabled={!leave.reason && !leave.note?.trim()} onClick={() => { plans.save(today, refreshPrep(dropItem(planDoc, leave.id, [leave.reason, leave.note?.trim()].filter(Boolean).join(' — '), Date.now()))); setLeave(null) }}>ยืนยันลบรายชื่อนี้</button>
              <button type="button" className="mini" onClick={() => setLeave({ ...leave, step: undefined })}>ย้อนกลับ</button>
            </>
          )}
        </Sheet>
      )}
      {form && (
        <VisitForm date={today} entry={form.entry} stop={form.stop} startAbsent={form.absent} team={team.map((t) => t.name).filter(Boolean)} writeNames={canWrite} members={people.items} stats={stats} today={today}
          preset={{ ...carry(form.stop), ...(form.member ? { member: form.member, reason: reasonOf(form.member.id) } : {}) }}
          onClose={() => setForm(null)}
          onSave={(v) => { visits.put([v]); applyCheckin(v); setForm(null) }}
          onDelete={form.entry ? () => { if (confirm(`ลบการเยี่ยม ${form.entry!.memberName}?`)) { visits.remove(form.entry!.id); (form.entry!.photos ?? []).forEach((p) => void removeMemberPhotoFile(p)); setForm(null) } } : undefined} />
      )}
    </div>
  )
}

function Row({ name, photo, v, extra, canTap, onTap, onRemove }: { id: string; name: string; photo?: string; v?: Visit; extra?: boolean; canTap: boolean; onTap: () => void; onRemove?: () => void }) {
  const status = v ? (v.absent ? '✗ ไม่พบ/ไม่อยู่บ้าน' : '✓ บันทึกแล้ว') : 'แตะเพื่อบันทึกการเยี่ยม'
  const inner = (
    <>
      <MemberAvatar path={photo} name={name} size={48} />
      <span className="vplan__who">
        <b>{name}{extra ? ' (พบเพิ่ม)' : ''}</b>
        <small className={v ? (v.absent ? 'vrec__no' : 'vrec__ok') : 'muted'}>{status}{v && v.reason.replace(/^ไม่พบ\/ไม่อยู่บ้าน\s*—?\s*/, '') ? ` · ${v.reason.replace(/^ไม่พบ\/ไม่อยู่บ้าน\s*—?\s*/, '')}` : ''}{v?.photos?.length ? ` · 📷 ${v.photos.length}` : ''}{v?.checkin ? ` · ⏱ ${timeText(v.checkin.at)} น.` : ''}</small>
      </span>
    </>
  )
  return (
    <li className={`vrec__row vrec__li${v ? (v.absent ? ' vrec__row--no' : ' vrec__row--ok') : ''}`}>
      {canTap ? <button type="button" className="vrec__btn" aria-label={`${v ? 'แก้ไขการเยี่ยม' : 'บันทึกการเยี่ยม'} ${name}`} onClick={onTap}>{inner}</button> : <div className="vrec__btn vrec__btn--ro" role="group" aria-label={`การเยี่ยม ${name}`}>{inner}</div>}
      {onRemove && <button type="button" className="mini vplan__x" aria-label={`ไม่พบหรือเอา ${name} ออกจากรายการ`} onClick={onRemove}>✕</button>}
    </li>
  )
}
