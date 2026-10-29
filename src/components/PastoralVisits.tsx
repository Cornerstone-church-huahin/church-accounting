import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { PaperHead } from './PaperSheets'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import MultiPick from './MultiPick'
import { formatCoord, hasCoord, homeFromCheckin, mapsLink } from '../lib/geo'
import { canRole, canWork } from '../lib/access'
import { useAttendance, useChurchMembers, useSettings, useVisitorNames, useVisits, useWorkTeams } from '../lib/data'
import { useRole } from '../lib/members'
import { absenceBar, absentMonths, visitCandidates, visitStats } from '../lib/pastoral'
import { addDays, fmtDate, newId, todayISO } from '../lib/money'
import MemberAvatar from './MemberAvatar'
import { MAX_VISIT_PHOTOS, uploadVisitPhoto } from '../lib/visitPhoto'
import { removeMemberPhotoFile } from '../lib/memberPhoto'
import { canSharePdf, downloadSheetPdf, sharePdf } from '../lib/pdf'
import { OFFICIAL_STATUSES, statusShort, toAttendance } from '../lib/registry'
import { DAY_NAMES, dayKind, sundayOf, visitsOfWeek, visitsOn, weekDays, weekStats, splitVisitors, joinVisitors, visitorRoster } from '../lib/visits'
import type { ChurchMember, Visit } from '../lib/types'

const LeafletMap = lazy(() => import('./LeafletMap'))
const KEY = 'acct.visit.by'
const fmtDay = (iso: string) => fmtDate(iso).replace(/ \d+$/, '')
const rangeText = (sun: string) => `${fmtDate(sun)} – ${fmtDate(addDays(sun, 6))}`

/**
 * งานอภิบาล › ตารางเยี่ยม: การ์ด 7 วันของสัปดาห์ (เริ่มวันอาทิตย์) · อาทิตย์ = นมัสการ · จันทร์ = วันหยุด (อัตโนมัติ)
 * อังคาร–เสาร์ แตะเพื่อบันทึกการเยี่ยม: เลือกสมาชิก + เหตุผล/หมายเหตุ + ผู้เยี่ยมลงชื่อ · สรุปเป็นรายงานรายสัปดาห์ (A4) ย้อนดูสัปดาห์ก่อนได้
 */
export default function PastoralVisits({ log = false }: { log?: boolean }) {
  const role = useRole()
  const canWrite = canRole(role, 'detail') || canWork(4, 'edit')
  const { settings } = useSettings()
  const visits = useVisits(log)
  const team = useWorkTeams().of(4)
  const people = useChurchMembers()
  const y = new Date().getFullYear()
  const a0 = useAttendance(y), a1 = useAttendance(y - 1, false), a2 = useAttendance(y - 2, false), a3 = useAttendance(y - 3, false)
  const today = todayISO()
  const att = useMemo(() => toAttendance([a3, a2, a1, a0].flatMap((st) => st.items)), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => visitStats(att, today), [att, today])
  const thisSunday = sundayOf(today)
  const [sunday, setSunday] = useState(thisSunday)
  const [mode, setMode] = useState<'cards' | 'report'>('cards')
  const [form, setForm] = useState<{ date: string; entry: Visit | null } | null>(null)
  const [note, setNote] = useState('')
  // เช็คอินที่บ้าน → พิกัดบ้านเข้าทะเบียนสมาชิกอัตโนมัติ (ยังไม่มีพิกัด) · ถ้ามีแล้วและห่างเกิน 100 ม. ถามก่อนทับ
  const applyCheckin = (v: Visit) => {
    const m = v.checkin ? people.items.find((x) => x.id === v.memberId) : undefined
    if (!m || !v.checkin) return
    const at = { lat: v.checkin.lat, lng: v.checkin.lng }
    const r = homeFromCheckin(m, at)
    if (r.action === 'keep') return
    if (r.action === 'ask' && !window.confirm(`พิกัดบ้านของ ${m.name} ในทะเบียนต่างจากจุดเช็คอินนี้ ${r.meters} เมตร\nอัปเดตพิกัดบ้านตามจุดเช็คอินนี้ไหม?`)) return
    setNote(people.put([{ ...m, ...at }]) ? `บันทึกพิกัดบ้านของ ${m.name} เข้าทะเบียนสมาชิกแล้ว (ดูแผนที่ได้ในรายละเอียดสมาชิก)` : 'บันทึกการเยี่ยมแล้ว แต่สิทธิ์ของท่านบันทึกพิกัดเข้าทะเบียนสมาชิกไม่ได้')
  }
  const days = weekDays(sunday)
  const wk = visitsOfWeek(visits.list, sunday)
  const st = weekStats(wk)
  if (!canWrite) return <p className="empty">ไม่มีสิทธิ์ดูตารางเยี่ยม</p>
  const nav = (
    <div className="no-print weekbar" style={{ margin: '0.3rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => setSunday(addDays(sunday, -7))}>‹</button>
      <div style={{ textAlign: 'center', lineHeight: 1.25 }}><b>{sunday === thisSunday ? 'สัปดาห์นี้' : 'สัปดาห์'}</b><br /><span className="small">{rangeText(sunday)}</span></div>
      <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" disabled={sunday >= thisSunday} onClick={() => setSunday(addDays(sunday, 7))}>›</button>
    </div>
  )
  return (
    <div className="pvisits">
      <div className="seg seg--2 no-print" role="tablist" aria-label="มุมมอง">
        <button type="button" role="tab" aria-selected={mode === 'cards'} className={mode === 'cards' ? 'on' : ''} onClick={() => setMode('cards')}>🗓️ การ์ด 7 วัน</button>
        <button type="button" role="tab" aria-selected={mode === 'report'} className={mode === 'report' ? 'on' : ''} onClick={() => setMode('report')}>📄 รายงานสัปดาห์</button>
      </div>
      {nav}
      {note && <p className="small pvnote" role="status" style={{ margin: '0 0 0.4rem' }}>📍 {note}</p>}
      {mode === 'cards' ? (
        <>
          <p className="small" role="status" style={{ margin: '0 0 0.4rem' }}>เยี่ยมแล้ว <b>{st.count}</b> ครั้ง · <b>{st.people}</b> คน{st.visitors.length ? ` · ผู้เยี่ยม ${st.visitors.join(', ')}` : ''}</p>
          <ul className="pvdays">
            {days.map((d) => {
              const kind = dayKind(d), xs = visitsOn(visits.list, d), future = d > today
              return (
                <li key={d} className={`pvday pvday--${kind}${d === today ? ' today' : ''}`} aria-label={`${DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()]} ${fmtDay(d)}`}>
                  <div className="pvday__h"><b>{DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()]}</b><span className="muted small">{fmtDay(d)}{d === today ? ' · วันนี้' : ''}</span></div>
                  {kind === 'worship' && <p className="pvday__auto">⛪ นมัสการ</p>}
                  {kind === 'off' && <p className="pvday__auto">🌿 วันหยุด</p>}
                  {kind === 'visit' && (
                    <>
                      {xs.length === 0 && <p className="muted small" style={{ margin: 0 }}>{future ? 'ยังไม่ถึงวัน' : 'ยังไม่มีการเยี่ยม'}</p>}
                      {xs.map((x) => (
                        <button key={x.id} type="button" className="pvvisit" onClick={() => setForm({ date: d, entry: x })} aria-label={`แก้ไขการเยี่ยม ${x.memberName}`}>
                          <span className="pvvisit__pic">{x.photos?.[0] ? <MemberAvatar path={x.photos[0]} name="📷" size={64} /> : <span className="pvvisit__nopic" aria-label="ยังไม่มีรูป">📷</span>}{(x.photos?.length ?? 0) > 1 && <i className="pvvisit__more">+{(x.photos?.length ?? 1) - 1}</i>}</span>
                          <span className="pvvisit__txt">
                            <b>{x.memberName}</b>
                            <span className="small">{x.reason || '—'}</span>
                            <span className="small muted">ผู้ออกเยี่ยม {x.visitor}</span>
                          </span>
                        </button>
                      ))}
                      <button type="button" className="btn btn--ghost pvadd" onClick={() => setForm({ date: d, entry: null })}>＋ บันทึกการเยี่ยม</button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <VisitReport church={settings.churchName.split(' ')[0]} sunday={sunday} visits={wk} />
      )}
      {form && (
        <VisitForm date={form.date} entry={form.entry} team={team.map((t) => t.name).filter(Boolean)} writeNames={canWrite} members={people.items} stats={stats} today={today}
          onClose={() => setForm(null)}
          onSave={(v) => { visits.put([v]); applyCheckin(v); setForm(null) }}
          onDelete={form.entry ? () => { if (confirm(`ลบการเยี่ยม ${form.entry!.memberName}?`)) { visits.remove(form.entry!.id); (form.entry!.photos ?? []).forEach((p) => void removeMemberPhotoFile(p)); setForm(null) } } : undefined} />
      )}
    </div>
  )
}

function VisitForm({ date, entry, team, writeNames, members, stats, today, onClose, onSave, onDelete }: { date: string; entry: Visit | null; team: string[]; members: ChurchMember[]; stats: ReturnType<typeof visitStats>; writeNames: boolean; today: string; onClose: () => void; onSave: (v: Visit) => void; onDelete?: () => void }) {
  const lastBy = (() => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } })()
  const [member, setMember] = useState<{ id: string; name: string } | null>(entry ? { id: entry.memberId, name: entry.memberName } : null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string[]>([])
  const [reason, setReason] = useState(entry?.reason ?? '')
  const [detail, setDetail] = useState(entry?.detail ?? '')
  const names = useVisitorNames()
  const initBy = splitVisitors(entry?.visitor ?? lastBy)
  const roster = visitorRoster(team, names.items)
  const [picked, setPicked] = useState<string[]>(initBy)
  // ชื่อที่เลือกไว้แต่ไม่อยู่ในรายชื่อแล้ว (เช่น บันทึกเก่า) MultiPick ยังแสดงให้เห็น เพื่อไม่ให้หายตอนแก้ไข
  const addName = (raw: string) => {
    const n = raw.trim().replace(/,/g, ' ')
    if (!n) return
    const hid = names.items.find((x) => x.hide && x.name === n)
    if (hid) names.remove(hid.id)
    if (!roster.includes(n) && !names.items.some((x) => !x.hide && x.name === n) && !(team.includes(n) && hid)) names.put([{ id: newId('vn'), name: n, updated: 0 }])
    setPicked((xs) => (xs.includes(n) ? xs : [...xs, n]))
  }
  const dropName = (n: string) => {
    for (const x of names.items.filter((y) => !y.hide && y.name === n)) names.remove(x.id)
    if (team.includes(n)) names.put([{ id: `hide-${n}`, name: n, hide: true, updated: 0 }])
    setPicked((xs) => xs.filter((x) => x !== n))
  }
  const [err, setErr] = useState('')
  const [photos, setPhotos] = useState<string[]>(entry?.photos ?? [])
  const [busy, setBusy] = useState(false)
  const [checkin, setCheckin] = useState<Visit['checkin'] | null>(entry?.checkin ?? null)
  const [locBusy, setLocBusy] = useState(false)
  // การเยี่ยมใหม่ (และฉบับที่เคยเช็คอินไว้) ต้องมีเช็คอินตำแหน่ง + รูป · ฉบับเก่าที่บันทึกก่อนมีกฎนี้แก้ไขได้ตามเดิม
  const needProof = !entry || !!entry.checkin
  const locate = () => {
    if (!navigator.geolocation) return setErr('เครื่องนี้ไม่รองรับการหาตำแหน่ง')
    setLocBusy(true); setErr('')
    navigator.geolocation.getCurrentPosition(
      (p) => { setCheckin({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, acc: Math.round(p.coords.accuracy), at: Date.now() }); setLocBusy(false) },
      () => { setLocBusy(false); setErr('หาตำแหน่งไม่ได้ — เปิด GPS และอนุญาตให้แอปใช้ตำแหน่ง แล้วกดเช็คอินอีกครั้ง') },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }
  const added = useRef<string[]>([])
  const addPhoto = async (f?: File | null) => {
    if (!f || photos.length >= MAX_VISIT_PHOTOS) return
    setBusy(true); setErr('')
    try { const p = await uploadVisitPhoto(f); added.current.push(p); setPhotos((xs) => [...xs, p].slice(0, MAX_VISIT_PHOTOS)) } catch (e) { console.error('visit photo', e); setErr('แนบรูปไม่สำเร็จ ลองใหม่อีกครั้ง') }
    setBusy(false)
  }
  const dropPhoto = (p: string) => setPhotos((xs) => xs.filter((x) => x !== p))
  const close = () => { added.current.filter((p) => !(entry?.photos ?? []).includes(p) && !photos.includes(p)).forEach((p) => void removeMemberPhotoFile(p)); if (!saved.current) added.current.forEach((p) => void removeMemberPhotoFile(p)); onClose() }
  const saved = useRef(false)
  const list = useMemo(() => visitCandidates(members, { status, q }, stats, today).slice(0, 80), [members, status, q, stats, today])
  const pick = (m: ChurchMember, label: string) => { setMember({ id: m.id, name: m.name }); if (!reason.trim() && label) setReason(label) }
  const monthsText = (n: number | null) => (n === null ? 'ไม่เคยมีบันทึกการมา' : n < 1 ? 'มาภายใน 1 เดือน' : n >= 12 ? `ขาด ${Math.floor(n / 12)} ปี${n % 12 ? ` ${n % 12} เดือน` : ''}` : `ขาด ${n} เดือน`)
  const save = () => {
    const visitor = joinVisitors(picked)
    if (!member) return setErr('เลือกสมาชิกที่ไปเยี่ยม')
    if (!visitor) return setErr('ลงชื่อผู้ออกเยี่ยมอย่างน้อย 1 คน')
    try { localStorage.setItem(KEY, visitor) } catch { /* ignore */ }
    if (busy) return setErr('กำลังแนบรูป รอสักครู่')
    if (locBusy) return setErr('กำลังหาตำแหน่ง รอสักครู่')
    if (needProof && !checkin) return setErr('ต้องกด “เช็คอินที่บ้าน” ก่อนจึงบันทึกการเยี่ยมได้')
    if (needProof && photos.length === 0) return setErr('ต้องแนบรูปการเยี่ยมอย่างน้อย 1 รูปก่อนจึงบันทึกได้')
    saved.current = true
    ;(entry?.photos ?? []).filter((p) => !photos.includes(p)).forEach((p) => void removeMemberPhotoFile(p))
    added.current.filter((p) => !photos.includes(p)).forEach((p) => void removeMemberPhotoFile(p))
    onSave({ id: entry?.id ?? newId('vis'), date, memberId: member.id, memberName: member.name, reason: reason.trim(), ...(detail.trim() ? { detail: detail.trim() } : {}), visitor, ...(photos.length ? { photos } : {}), ...(checkin ? { checkin } : {}), updated: 0 })
  }
  return (
    <Sheet title={`${entry ? 'แก้ไข' : 'บันทึก'}การเยี่ยม · ${DAY_NAMES[new Date(date + 'T00:00:00Z').getUTCDay()]} ${fmtDay(date)}`} onClose={close}>
      <div className="field"><label htmlFor="pv-by">ผู้ออกเยี่ยม (ลงชื่อ · เลือกได้หลายคน)</label>
        <MultiPick id="pv-by" title="ผู้ออกเยี่ยม" options={roster.map((n) => ({ value: n, label: n }))} value={picked} onChange={setPicked} empty="— เลือกผู้ออกเยี่ยม —"
          {...(writeNames ? { onAdd: addName, onRemove: dropName, addHint: 'พิมพ์ชื่อใหม่ แล้วกด เพิ่ม (เก็บไว้เลือกได้ทุกครั้ง)' } : {})} /></div>
      <div className="field"><label htmlFor="pv-q">① เลือกสมาชิกที่ไปเยี่ยม{member ? ` · เลือกแล้ว: ${member.name}` : ''}</label>
        <div className="pvfind">
          <input id="pv-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / ชื่อเล่น" />
          <MultiPick id="pv-st" title="สถานะสมาชิก" options={OFFICIAL_STATUSES.map((x) => ({ value: x, label: statusShort(x) }))} value={status} onChange={setStatus} empty="ทุกสถานะ" />
        </div></div>
      <div className="field"><span className="pvhint">② {q.trim() ? 'ผลการค้นหา' : `ขาดนมัสการตั้งแต่ 1 เดือนขึ้นไป${status.length ? ` · ${status.map(statusShort).join(', ')}` : ''}`} · เรียงจากขาดน้อย → มาก ({list.length} คน)</span>
        <ul className="pvpick" aria-label="รายชื่อสมาชิก">
          {list.map((m) => { const mo = absentMonths(stats.get(m.id)?.last, today); const absent = mo === null || mo >= 1; return (
            <li key={m.id}><button type="button" className={`pvpick__r${member?.id === m.id ? ' on' : ''}`} aria-pressed={member?.id === m.id} onClick={() => pick(m, absent ? monthsText(mo) : '')}>
              <MemberAvatar path={m.photoPath} name={m.name} size={48} />
              <span className="pvpick__body">
                <span className="pvpick__who"><span><b>{m.name}</b>{m.nick?.trim() ? ` (${m.nick.trim()})` : ''} <small className="muted">{statusShort(m.status)}</small></span>
                  <b className={absent ? 'pvpick__abs' : 'pvpick__ok'}>{monthsText(mo)}</b></span>
                {absent && <span className="pvabs" role="img" aria-label={`ขาดนมัสการ ${mo ?? 'ไม่ทราบ'} เดือน`}><span className="pvabs__f" style={{ width: `${Math.round(absenceBar(mo) * 100)}%` }} /></span>}
              </span>
            </button></li>
          ) })}
          {list.length === 0 && <li className="muted small">{q.trim() ? 'ไม่พบสมาชิก' : 'ไม่มีสมาชิกที่ขาดนมัสการตั้งแต่ 1 เดือนในสถานะนี้ — พิมพ์ค้นหาชื่อได้เลย'}</li>}
        </ul></div>
      <div className="field"><label htmlFor="pv-reason">เหตุผล / หมายเหตุ (ทำไมต้องไปเยี่ยม)</label><textarea id="pv-reason" className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ขาดการนมัสการเกิน 3 เดือน · ป่วย" /></div>
      <div className="field"><label htmlFor="pv-detail">รายละเอียดการเยี่ยม (ไม่บังคับ)</label><textarea id="pv-detail" className="input" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} /></div>
      <div className="field"><label>เช็คอินตำแหน่ง{needProof ? ' (บังคับ)' : ''}</label>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <button type="button" className="btn btn--gold" disabled={locBusy} onClick={locate}>{locBusy ? 'กำลังหาตำแหน่ง…' : checkin ? '📍 เช็คอินใหม่' : '📍 เช็คอินที่บ้าน'}</button>
          {checkin && <a className="mini" href={mapsLink(checkin)} target="_blank" rel="noreferrer">เปิดใน Google Maps</a>}
        </div>
        <span className="muted small" role="status">{checkin ? `✓ เช็คอินแล้ว ${formatCoord(checkin)}${checkin.acc ? ` (±${checkin.acc} ม.)` : ''} · พิกัดนี้จะเข้าทะเบียนสมาชิกเป็นแผนที่บ้านโดยอัตโนมัติ` : 'ยังไม่ได้เช็คอิน — ไปถึงบ้านสมาชิกแล้วกดปุ่มนี้'}</span>
        {checkin && hasCoord(checkin) && <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={[{ id: 'ci', lat: checkin.lat, lng: checkin.lng, label: member?.name ?? 'จุดเช็คอิน' }]} height={150} label="จุดเช็คอินเยี่ยมบ้าน" noLinks /></Suspense>}</div>
      <div className="field"><label>รูปการเยี่ยม (แนบ 1–{MAX_VISIT_PHOTOS} รูป{needProof ? ' · บังคับอย่างน้อย 1 รูป' : ''})</label>
        <div className="pvphotos" aria-label="รูปการเยี่ยม">
          {photos.map((p, i) => (
            <span key={p} className="pvphoto"><MemberAvatar path={p} name="📷" size={84} /><button type="button" className="pvphoto__x" aria-label={`ลบรูปที่ ${i + 1}`} onClick={() => dropPhoto(p)}>✕</button></span>
          ))}
          {photos.length < MAX_VISIT_PHOTOS && (
            <>
              <label className="act-btn pvphoto__add"><span className="act-btn__ico" aria-hidden="true">📷</span><span>ถ่ายรูป</span><input type="file" accept="image/*" capture="environment" aria-label="ถ่ายรูปการเยี่ยม" style={{ display: 'none' }} onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = '' }} /></label>
              <label className="act-btn pvphoto__add"><span className="act-btn__ico" aria-hidden="true">🖼️</span><span>เลือกรูป</span><input type="file" accept="image/*" aria-label="เลือกรูปการเยี่ยมจากเครื่อง" style={{ display: 'none' }} onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = '' }} /></label>
            </>
          )}
        </div>
        <span className="muted small">{busy ? 'กำลังแนบรูป…' : photos.length === 0 ? 'ยังไม่ได้แนบรูป — ควรแนบอย่างน้อย 1 รูป' : `แนบแล้ว ${photos.length} รูป · รูปแรกจะขึ้นที่การ์ด`}</span></div>
      {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>{onDelete && <button type="button" className="mini" onClick={onDelete}>ลบ</button>}</div>
    </Sheet>
  )
}

const ROWS = 18
/** รายงานการเยี่ยมประจำสัปดาห์ (A4) — ย้อนดูสัปดาห์ก่อนได้ด้วยลูกศรด้านบน · ดาวน์โหลด/แชร์ PDF */
function VisitReport({ church, sunday, visits }: { church: string; sunday: string; visits: Visit[] }) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const [busy, setBusy] = useState(false)
  const st = weekStats(visits)
  const rows = [...visits].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / ROWS)) }, (_, i) => rows.slice(i * ROWS, (i + 1) * ROWS))
  const els = () => refs.current.filter((e): e is HTMLDivElement => !!e)
  const file = `visit-report-${sunday}.pdf`
  const run = async (share: boolean) => {
    setBusy(true)
    try {
      if (share) { if ((await sharePdf(els(), file, 'full', `รายงานการเยี่ยม ${rangeText(sunday)}`)) === 'unsupported') { await downloadSheetPdf(els(), file, 'full'); alert('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ PDF ให้แทนแล้ว') } } else await downloadSheetPdf(els(), file, 'full')
    } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ') }
    setBusy(false)
  }
  return (
    <>
      {pages.map((pr, pi) => (
        <ScaledPage key={pi} ref={(el) => { refs.current[pi] = el }}>
          <>
            <PaperHead church={church} title="รายงานการเยี่ยมประจำสัปดาห์ · งานอภิบาล" sub={`สัปดาห์ ${rangeText(sunday)}${pages.length > 1 ? ` · แผ่นที่ ${pi + 1}/${pages.length}` : ''}`} />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 }}>
              <thead><tr style={{ background: '#eef1f8' }}>{['ที่', 'วัน/วันที่', 'ผู้ที่ไปเยี่ยม', 'เหตุผล / หมายเหตุ', 'ผู้ออกเยี่ยม'].map((h) => <th key={h} style={{ border: '1px solid #1a2b4c', padding: '3px 5px' }}>{h}</th>)}</tr></thead>
              <tbody>
                {pr.map((v, i) => (
                  <tr key={v.id}>
                    <td style={{ border: '1px solid #1a2b4c', padding: '3px 5px', textAlign: 'center' }}>{pi * ROWS + i + 1}</td>
                    <td style={{ border: '1px solid #1a2b4c', padding: '3px 5px', whiteSpace: 'nowrap' }}>{DAY_NAMES[new Date(v.date + 'T00:00:00Z').getUTCDay()]} {fmtDay(v.date)}</td>
                    <td style={{ border: '1px solid #1a2b4c', padding: '3px 5px' }}>{v.memberName}</td>
                    <td style={{ border: '1px solid #1a2b4c', padding: '3px 5px' }}>{v.reason || '—'}{v.detail ? <div style={{ fontSize: 12, color: '#444' }}>{v.detail}</div> : null}</td>
                    <td style={{ border: '1px solid #1a2b4c', padding: '3px 5px' }}>{v.visitor}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} style={{ border: '1px solid #1a2b4c', padding: 10, textAlign: 'center' }}>ไม่มีการเยี่ยมในสัปดาห์นี้</td></tr>}
              </tbody>
            </table>
            {pi === pages.length - 1 && (
              <>
                <p style={{ fontSize: 15, margin: '10px 0 0' }}>รวมเยี่ยม <b>{st.count}</b> ครั้ง · <b>{st.people}</b> คน</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '22px 40px', marginTop: 26, fontSize: 14 }}>
                  {(st.visitors.length ? st.visitors : ['………………………']).map((n) => <div key={n} style={{ textAlign: 'center', minWidth: 190 }}>ลงชื่อ ……………………………<br />({n})<br />ผู้ออกเยี่ยม</div>)}
                </div>
              </>
            )}
          </>
        </ScaledPage>
      ))}
      <div className="row no-print" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void run(false)}>{busy ? 'กำลังสร้าง…' : '⬇️ ดาวน์โหลด PDF'}</button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void run(true)} title={canSharePdf() ? undefined : 'เครื่องนี้จะดาวน์โหลดไฟล์ให้แทน'}>📤 แชร์ PDF</button>
      </div>
    </>
  )
}
