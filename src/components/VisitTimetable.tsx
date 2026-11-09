import { useMemo, useRef, useState } from 'react'
import AbsentList from './AbsentList'
import { VisitForm } from './PastoralVisits'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import { useAttendance, useChurchMembers, useSettings, useVisitPlans, useVisits, useWorkTeams } from '../lib/data'
import { addDays, be, monthName, todayISO } from '../lib/money'
import { visitStats } from '../lib/pastoral'
import { toAttendance } from '../lib/registry'
import { dayKind, DAY_NAMES, sundayOf, weekDays } from '../lib/visits'
import type { Visit } from '../lib/types'
import { addItem, addPlace, removeItem, removePlace, setDayText, setSlot, setSlotNote, SLOTS, type PlanDoc, type Slot } from '../lib/visitPlan'

const NAVY = '#14264a', RED = '#a4262c', GOLD = '#c99a14'
const TONE: Record<Slot, { bg: string; dark: string; tint: string }> = {
  เช้า: { bg: '#f6b73c', dark: '#6b4a00', tint: '#fff6dd' },
  บ่าย: { bg: '#4a90d9', dark: '#0e3a6b', tint: '#e8f2fc' },
  ค่ำ: { bg: '#7b5ea7', dark: '#3a2466', tint: '#f0eaf8' },
}
const EN: Record<Slot, string> = { เช้า: 'Morning Visits', บ่าย: 'Afternoon Visits', ค่ำ: 'Evening · Cell Group' }
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_VERSE = '“จงรักกันและกัน เหมือนที่เรารักท่านทั้งหลาย” — ยอห์น 15:12 · “Love one another as I have loved you.” — John 15:12'
const cell: React.CSSProperties = { border: '1.5px solid #5a6a8c', padding: '6px 8px', verticalAlign: 'top', fontSize: 18, lineHeight: 1.3 }
const keep: React.CSSProperties = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties

/** ภาคของการเยี่ยมจริง: ตามภาคที่วางแผนไว้ ไม่มีแผน = ดูจากเวลาเช็คอิน (ก่อน 12 เช้า · ก่อน 18 บ่าย · หลังจากนั้นค่ำ) */
const slotOfVisit = (v: Visit, doc: PlanDoc): Slot => {
  const planned = doc.items.find((x) => x.id === v.memberId)?.slot
  if (planned) return planned
  if (v.memberId.startsWith('place:')) for (const sl of SLOTS) if (doc.places?.[sl.k]?.includes(v.memberId.slice(6))) return sl.k
  const h = v.checkin ? new Date(v.checkin.at).getHours() : 13
  return h < 12 ? 'เช้า' : h < 18 ? 'บ่าย' : 'ค่ำ'
}
const dmy = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}/${m}/${String(be(y)).slice(2)}` }
const dayName = (d: string) => DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()]
/** “10-14 พฤศจิกายน 2569” หรือข้ามเดือน “30 พฤศจิกายน 2569 – 4 ธันวาคม 2569” */
const rangeTitle = (a: string, b: string) => {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number)
  return ya === yb && ma === mb ? `${da}-${db} ${monthName(ma)} ${be(ya)}` : `${da} ${monthName(ma)} ${be(ya)} – ${db} ${monthName(mb)} ${be(yb)}`
}

/** หน้าต่างแก้ช่องหนึ่ง: เลือกคน (จากรายชื่อขาดนมัสการ กด ＋) · สถานที่/โครงการ (ไม่ผูกรายชื่อ) · หมายเหตุ */
function CellEditor({ date, slot, doc, onChange, onClose, recordOnly, planOnly }: { date: string; slot: Slot; doc: PlanDoc; onChange: (d: PlanDoc) => void; onClose: () => void; /** หน้า “บันทึก”: เห็นรายชื่อที่วางแผนไว้และบันทึกเยี่ยมได้ แก้แผนไม่ได้ */ recordOnly?: boolean; /** หน้า “วางแผน”: เป็นแค่ข้อความ ไม่มีปุ่มบันทึกเยี่ยม/แผนที่ */ planOnly?: boolean }) {
  const people = useChurchMembers()
  const y = new Date().getFullYear()
  const a0 = useAttendance(y), a1 = useAttendance(y - 1, false), a2 = useAttendance(y - 2, false), a3 = useAttendance(y - 3, false)
  const today = todayISO()
  const att = useMemo(() => toAttendance([a3, a2, a1, a0].flatMap((st) => st.items)), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => visitStats(att, today), [att, today])
    const [place, setPlace] = useState('')
  const [ticked, setTicked] = useState<string[]>([]) // ติ๊กไว้เพื่อบันทึก “เยี่ยมแล้ว” ทีเดียวพร้อมกัน
  const tick = (id: string, on: boolean) => setTicked((xs) => on ? (xs.includes(id) ? xs : [...xs, id]) : xs.filter((x) => x !== id))
  const visits = useVisits(true)
  const team = useWorkTeams().of(4)
  const [form, setForm] = useState<{ entry: Visit | null; member?: { id: string; name: string }; group?: { id: string; name: string }[] } | null>(null)
  const done = (id: string) => visits.list.find((v) => v.date === date && v.memberId === id)
  const mine = doc.items.filter((x) => (x.slot ?? 'บ่าย') === slot)
  const places = doc.places?.[slot] ?? []
  const toggle = (m: { id: string; name: string }) => { if (!planOnly) tick(m.id, !mine.some((x) => x.id === m.id)); onChange(mine.some((x) => x.id === m.id) ? removeItem(doc, m.id) : doc.items.some((x) => x.id === m.id) ? setSlot(doc, m.id, slot) : setSlot(addItem(doc, m), m.id, slot)) }
  const pend = [...mine.map((x) => ({ id: x.id, name: x.name })), ...places.map((p) => ({ id: `place:${p}`, name: p }))].filter((x) => ticked.includes(x.id) && !done(x.id))
  const noteRef = useRef<string | null>(null) // ข้อความหมายเหตุที่พิมพ์ค้างอยู่ — บันทึกตอนกด “บันทึก” หรือปิด
  const finish = () => { if (noteRef.current !== null && noteRef.current !== (doc.slotNotes?.[slot] ?? '')) onChange(setSlotNote(doc, slot, noteRef.current)); onClose() }
  return (
    <Sheet title={`${dayName(date)} ${dmy(date)} · ภาค${slot}`} onClose={finish}>
      {!planOnly && pend.length > 0 && <div style={{ position: 'sticky', top: 0, zIndex: 3, display: 'flex', justifyContent: 'flex-end', paddingBottom: 4, pointerEvents: 'none' }}><button type="button" className="btn btn--gold" style={{ pointerEvents: 'auto', boxShadow: '0 4px 14px rgba(0,0,0,.35)', fontSize: '1.05rem' }} onClick={() => setForm({ entry: null, group: pend })}>📝 บันทึกการเยี่ยม ({pend.length} คน) ›</button></div>}
      {mine.length > 0 && <b className="small">👥 คนที่จะไปเยี่ยม ({mine.length})</b>}
      {mine.length > 0 && <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>{mine.map((x) => { const v = done(x.id); return <li key={x.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '3px 0' }}>{!planOnly && <input type="checkbox" aria-label={`ติ๊กเยี่ยม ${x.name}`} style={{ width: 22, height: 22 }} checked={!!v || ticked.includes(x.id)} disabled={!!v} onChange={(e) => tick(x.id, e.target.checked)} />}<span>{x.name}{v ? (v.absent ? ' ✗ ไม่พบ' : ' ✓') : ''}</span> {!planOnly && v && <button type="button" className="mini" aria-label={`แก้การเยี่ยม ${x.name}`} onClick={() => setForm({ entry: v, member: { id: x.id, name: x.name } })}>✎ แก้</button>} {!recordOnly && <button type="button" className="mini" aria-label={`เอา ${x.name} ออก`} onClick={() => { tick(x.id, false); onChange(removeItem(doc, x.id)) }}>✕</button>}</li> })}</ul>}
      {!recordOnly && <div className="field"><label htmlFor="vt-note">📝 หมายเหตุ (พิมพ์ข้อความ หรือจะเลือกคนจากรายชื่อด้านล่างก็ได้)</label>
        <textarea id="vt-note" className="input" rows={2} defaultValue={doc.slotNotes?.[slot] ?? ''} onChange={(e) => { noteRef.current = e.target.value }} onBlur={(e) => { noteRef.current = null; onChange(setSlotNote(doc, slot, e.target.value)) }} /></div>}
      {!recordOnly && <AbsentList hideLabel members={people.items} stats={stats} today={today} label="ค้นหาสมาชิก" selectedIds={doc.items.map((x) => x.id)} onPick={toggle} />}
      <b className="small">📍 สถานที่ / โครงการ{recordOnly ? '' : ' (ไม่ใส่ชื่อคน)'}</b>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>{places.map((p, i) => { const v = done(`place:${p}`); return <li key={`${p}-${i}`} className="row" style={{ gap: 8, alignItems: 'center', padding: '3px 0' }}>{!planOnly && <input type="checkbox" aria-label={`ติ๊กไปแล้ว ${p}`} style={{ width: 22, height: 22 }} checked={!!v || ticked.includes(`place:${p}`)} disabled={!!v} onChange={(e) => tick(`place:${p}`, e.target.checked)} />}<span>📍 {p}{v ? ' ✓' : ''}</span> {!planOnly && v && <button type="button" className="mini" aria-label={`แก้การเยี่ยม ${p}`} onClick={() => setForm({ entry: v, member: { id: `place:${p}`, name: p } })}>✎ แก้</button>} {!recordOnly && <button type="button" className="mini" aria-label={`ลบ ${p}`} onClick={() => { tick(`place:${p}`, false); onChange(removePlace(doc, slot, i)) }}>✕</button>}</li> })}</ul>
      {!recordOnly && (
      <div className="row" style={{ gap: 6 }}>
        <input className="input grow" aria-label="สถานที่หรือโครงการ" placeholder="เช่น โครงการโคโค่ · ร้านพี่ตาล" value={place} onChange={(e) => setPlace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && place.trim()) { onChange(addPlace(doc, slot, place)); setPlace('') } }} />
        <button type="button" className="btn btn--gold" onClick={() => { if (place.trim()) { onChange(addPlace(doc, slot, place)); setPlace('') } }}>＋ เพิ่ม</button>
      </div>
      )}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--card, #fff)', paddingTop: 6, paddingBottom: 6, zIndex: 2 }}><button type="button" className="btn btn--block" onClick={finish}>✓ บันทึก</button></div>
      {form && (
        <VisitForm date={date} entry={form.entry} stop={0} {...(form.group ? { group: form.group, onSaveMany: (vs: Visit[]) => { visits.put(vs); setForm(null) } } : {})} team={team.map((t) => t.name).filter(Boolean)} writeNames members={people.items} stats={stats} today={today}
          preset={form.member ? { member: form.member } : {}}
          photoShared={(p) => visits.list.some((v) => v.id !== form.entry?.id && v.photos?.includes(p))}
          onClose={() => setForm(null)} onSave={(v) => { visits.put([v]); setForm(null) }}
          onDelete={form.entry ? () => { if (confirm(`ลบการเยี่ยม ${form.entry!.memberName}?`)) { visits.remove(form.entry!.id); setForm(null) } } : undefined} />
      )}
    </Sheet>
  )
}

/**
 * ตารางเยี่ยมเยียนรายสัปดาห์: แถว = วัน (อังคาร–เสาร์ · วันที่ตามปฏิทินอัตโนมัติ) · คอลัมน์ 2 = ข้อความช่วงเช้า/กิจกรรมประจำของวัน (พิมพ์เอง)
 * คอลัมน์ 3–5 = ภาคเช้า/บ่าย/ค่ำ: เลือกคน (กด ＋) · เพิ่มสถานที่/โครงการ · หมายเหตุ · พิมพ์/PDF A4 แนวนอน
 */
/** หัวกระดาษ 3 แผ่น: เตรียมการเยี่ยม → บันทึกการเยี่ยม → รายงานการเยี่ยม (แผ่นที่ 3 ใช้ประมวลผล/ติดประกาศ) */
const TITLE = {
  plan: { th: 'เตรียมการเยี่ยมครอบครัวศิลาเอก', en: 'Cornerstone Family Visitation Preparation · Pastoral Visits', short: 'เตรียมการเยี่ยม', file: 'เตรียมการเยี่ยม' },
  record: { th: 'บันทึกการเยี่ยมครอบครัวศิลาเอก', en: 'Cornerstone Family Visitation Record · Pastoral Visits', short: 'บันทึกการเยี่ยม', file: 'บันทึกการเยี่ยม' },
  report: { th: 'รายงานการเยี่ยมครอบครัวศิลาเอก', en: 'Cornerstone Family Visitation Report · Pastoral Visits', short: 'รายงานการเยี่ยม', file: 'รายงานการเยี่ยม' },
} as const

export default function VisitTimetable({ mode = 'plan' }: { mode?: 'plan' | 'record' | 'report' }) {
  const { settings } = useSettings()
  const church = settings.churchName.split(' ')[0]
  const plans = useVisitPlans()
  const visits = useVisits(true)
  const today = todayISO()
  // สัปดาห์ที่เปิดดู: ใช้ร่วมกันทั้ง วางแผน/บันทึก/รายงาน (เลื่อนไปสัปดาห์ก่อน/ถัดไปได้อิสระ)
  const [anchor, setAnchorRaw] = useState(() => { try { const v = localStorage.getItem('acct.visittable.week'); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today } catch { return today } })
  const setAnchor = (d: string) => { setAnchorRaw(d); try { localStorage.setItem('acct.visittable.week', d) } catch { /* ignore */ } }
  const sunday = sundayOf(anchor)
  const days = weekDays(sunday).filter((d) => dayKind(d) === 'visit')
  const ref = useRef<HTMLDivElement>(null)
  const canEdit = plans.canEdit()
  const monday = addDays(sunday, 1)
  const verse = plans.verseOf(monday) || DEFAULT_VERSE
  const [edit, setEdit] = useState<{ d: string; slot: Slot | 'day' } | null>(null)
  const report = mode === 'report' // รายงานผลจริง · plan = วางแผน (แก้ได้) · record = มุมมองเดียวกัน แตะช่องเพื่อบันทึกเยี่ยม
  const visitedBy = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const v of visits.list) if (!v.absent) m.set(v.date, new Set([...(m.get(v.date) ?? []), v.memberId]))
    return m
  }, [visits.list])
  const shift = (n: number) => setAnchor(addDays(sunday, n * 7 + 3))
  const total = days.reduce((n, d) => n + plans.of(d).items.length, 0)
  const range = rangeTitle(days[0], days[days.length - 1])
  const open = (d: string, slot: Slot | 'day') => { if (canEdit && !report) setEdit({ d, slot }) }
  const doc = edit ? plans.of(edit.d) : null
  const save = (d: string, next: PlanDoc) => plans.save(d, next)
  return (
    <section aria-label="ตารางเยี่ยมเยียน">
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => shift(-1)}>‹</button>
        <span className="small"><b>{range}</b>{total ? ` · ${total} คนในแผน` : ''}</span>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => shift(1)}>›</button>
      </div>
      <ScaledPage ref={ref}>
        <div style={{ ...keep, display: 'flex', flexDirection: 'column', height: '100%', color: '#111' }}>
          <div style={{ ...keep, background: `linear-gradient(100deg, ${NAVY}, #274a8a)`, color: '#fff', borderRadius: 14, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `5px solid ${GOLD}` }}>
            <span style={{ fontSize: 40 }} aria-hidden="true">🏠</span>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 15, letterSpacing: 1, opacity: 0.9 }}>{church} · ✝ งานอภิบาล</div>
              <div style={{ fontSize: 29, fontWeight: 800, lineHeight: 1.15 }}>{TITLE[mode].th}</div>
              <div style={{ fontSize: 21, fontWeight: 700, color: '#ffd978' }}>วันที่ {range}</div>
              <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.95 }}>{TITLE[mode].en}</div>
            </div>
            <span style={{ fontSize: 40 }} aria-hidden="true">💛</span>
          </div>
          <table aria-label="ตารางเยี่ยมเยียน" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 8, flex: 1 }}>
            <colgroup><col style={{ width: '13%' }} /><col style={{ width: '15%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /></colgroup>
            <thead>
              <tr>
                <th style={{ ...cell, ...keep, background: NAVY, color: '#fff', textAlign: 'center', fontSize: 18 }}>📅 วัน<br /><span style={{ fontSize: 14 }}>Day / Date</span></th>
                <th style={{ ...cell, ...keep, background: '#2e7d6b', color: '#fff', textAlign: 'center', fontSize: 17 }}>🙏 กิจกรรมช่วงเช้า<br /><span style={{ fontSize: 14 }}>Morning Activity</span></th>
                {SLOTS.map((sl) => <th key={sl.k} style={{ ...cell, ...keep, background: TONE[sl.k].bg, color: sl.k === 'เช้า' ? TONE[sl.k].dark : '#fff', textAlign: 'center', fontSize: 18 }}>{sl.icon} {sl.label}<br /><span style={{ fontSize: 15 }}>{sl.time.replace(' (กลุ่มเซล)', '')}{sl.k === 'ค่ำ' ? ' (กลุ่มเซล)' : ''}</span><br /><span style={{ fontSize: 14 }}>{EN[sl.k]}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const pd = plans.of(d), seen = visitedBy.get(d) ?? new Set<string>()
                return (
                  <tr key={d} style={{ height: 160 }}>
                    <td style={{ ...cell, ...keep, textAlign: 'center', verticalAlign: 'middle', background: i % 2 ? '#fdecec' : '#fff5f5', color: RED, fontWeight: 800 }}>
                      <div style={{ fontSize: 21 }}>{dayName(d)}</div><div style={{ fontSize: 14, fontWeight: 600 }}>{DAY_EN[new Date(d + 'T00:00:00Z').getUTCDay()]}</div><div style={{ fontSize: 18 }}>{dmy(d)}</div>
                    </td>
                    <td style={{ ...cell, ...keep, background: '#eaf6f2', cursor: canEdit ? 'pointer' : undefined, whiteSpace: 'pre-line', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle', fontSize: 18 }} onClick={() => open(d, 'day')} aria-label={`${dayName(d)} กิจกรรมช่วงเช้า`}>{pd.dayText ?? ''}</td>
                    {SLOTS.map((sl) => {
                      const ppl = pd.items.filter((x) => (x.slot ?? 'บ่าย') === sl.k), pls = pd.places?.[sl.k] ?? [], note = pd.slotNotes?.[sl.k]
                      let n = 0
                      const vsl = visits.list.filter((v) => v.date === d && slotOfVisit(v, pd) === sl.k)
                      return (
                        <td key={sl.k} style={{ ...cell, ...keep, background: i % 2 ? '#fff' : TONE[sl.k].tint, cursor: canEdit ? 'pointer' : undefined }} onClick={() => open(d, sl.k)} aria-label={`${dayName(d)} ภาค${sl.k}`}>
                          {!report && note && <div style={{ whiteSpace: 'pre-line', fontStyle: 'italic', marginBottom: 3 }}>📝 {note}</div>}
                          {report ? vsl.map((v) => <div key={v.id} style={{ color: v.absent ? '#a4262c' : undefined }}>{++n}. {v.memberName}{v.absent ? ' ✗ ไม่พบ' : ' ✓'}{v.checkin ? <small style={{ color: '#555' }}> {new Date(v.checkin.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</small> : null}{v.visitor ? <div style={{ fontSize: 14, color: '#555' }}>ผู้เยี่ยม: {v.visitor}</div> : null}</div>) : null}
                          {report ? null : ppl.map((x) => <div key={x.id}>{++n}. {x.name}{seen.has(x.id) ? ' ✓' : ''}</div>)}
                          {report ? null : pls.map((p, j) => <div key={j} style={{ fontWeight: 700, color: TONE[sl.k].dark }}>📍 {p}{seen.has(`place:${p}`) ? ' ✓' : ''}</div>)}
                                                    {!report && canEdit && !ppl.length && !pls.length && !note && <span className="no-print" style={{ color: '#9aa5bd', fontSize: 22 }}>＋</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ ...keep, marginTop: 8, border: `2px solid ${GOLD}`, background: '#fff8e6', borderRadius: 12, padding: '6px 14px', textAlign: 'center', fontSize: 19, fontWeight: 700, color: NAVY, cursor: canEdit ? 'pointer' : undefined }} onClick={() => { if (!canEdit) return; const v = window.prompt('ข้อพระคัมภีร์ท้ายตาราง (ว่าง = ใช้ข้อความตั้งต้น)', verse); if (v !== null) plans.saveVerse(monday, v) }} aria-label="ข้อพระคัมภีร์">✝ {verse}</div>
          <div style={{ fontSize: 13.5, marginTop: 3, color: '#555', textAlign: 'center' }}>✓ = ไปเยี่ยมและบันทึกแล้ว / Visited · 📍 = สถานที่/โครงการ / Place or project · 📝 = หมายเหตุ / Note</div>
        </div>
      </ScaledPage>
      <PdfTools compact mode="full" els={() => (ref.current ? [ref.current] : [])} file={`${TITLE[mode].file}-${monday}.pdf`} title={`${TITLE[mode].short} ${range}`} label={TITLE[mode].short} />
      {edit && doc && edit.slot === 'day' && (
        <Sheet title={`${dayName(edit.d)} ${dmy(edit.d)} · กิจกรรมช่วงเช้า`} onClose={() => setEdit(null)}>
          <div className="field"><label htmlFor="vt-day">พิมพ์ว่าช่วงเช้าทำอะไร (เช่น กลุ่มอธิษฐาน · ศึกษาพระคัมภีร์ 09.00-10.00 น.)</label>
            <textarea id="vt-day" className="input" rows={4} defaultValue={doc.dayText ?? ''} onBlur={(e) => save(edit.d, setDayText(doc, e.target.value))} /></div>
          <button type="button" className="btn btn--gold" onClick={() => setEdit(null)}>เสร็จ</button>
        </Sheet>
      )}
      {edit && doc && edit.slot !== 'day' && <CellEditor date={edit.d} slot={edit.slot} doc={doc} onChange={(next) => save(edit.d, next)} onClose={() => setEdit(null)} planOnly={mode === 'plan'} />}
    </section>
  )
}
