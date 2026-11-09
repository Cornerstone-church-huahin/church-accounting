import { useMemo, useRef, useState } from 'react'
import AbsentList from './AbsentList'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import { useAttendance, useChurchMembers, useSettings, useVisitPlans, useVisits } from '../lib/data'
import { usePlanDate } from '../lib/planDate'
import { addDays, be, monthName, todayISO } from '../lib/money'
import { visitStats } from '../lib/pastoral'
import { toAttendance } from '../lib/registry'
import { dayKind, DAY_NAMES, sundayOf, weekDays } from '../lib/visits'
import { addItem, addPlace, removeItem, removePlace, setDayText, setSlot, setSlotNote, SLOTS, type PlanDoc, type Slot } from '../lib/visitPlan'

const NAVY = '#14264a', RED = '#a4262c', GOLD = '#c99a14'
const TONE: Record<Slot, { bg: string; dark: string; tint: string }> = {
  เช้า: { bg: '#f6b73c', dark: '#6b4a00', tint: '#fff6dd' },
  บ่าย: { bg: '#4a90d9', dark: '#0e3a6b', tint: '#e8f2fc' },
  ค่ำ: { bg: '#7b5ea7', dark: '#3a2466', tint: '#f0eaf8' },
}
const DEFAULT_VERSE = '“จงรักกันและกัน เหมือนที่เรารักท่านทั้งหลาย” — ยอห์น 15:12'
const cell: React.CSSProperties = { border: '1.5px solid #5a6a8c', padding: '6px 8px', verticalAlign: 'top', fontSize: 15, lineHeight: 1.35 }
const keep: React.CSSProperties = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties

const dmy = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}/${m}/${String(be(y)).slice(2)}` }
const dayName = (d: string) => DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()]
/** “10-14 พฤศจิกายน 2569” หรือข้ามเดือน “30 พฤศจิกายน 2569 – 4 ธันวาคม 2569” */
const rangeTitle = (a: string, b: string) => {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number)
  return ya === yb && ma === mb ? `${da}-${db} ${monthName(ma)} ${be(ya)}` : `${da} ${monthName(ma)} ${be(ya)} – ${db} ${monthName(mb)} ${be(yb)}`
}

/** หน้าต่างแก้ช่องหนึ่ง: เลือกคน (จากรายชื่อขาดนมัสการ กด ＋) · สถานที่/โครงการ (ไม่ผูกรายชื่อ) · หมายเหตุ */
function CellEditor({ date, slot, doc, onChange, onClose }: { date: string; slot: Slot; doc: PlanDoc; onChange: (d: PlanDoc) => void; onClose: () => void }) {
  const people = useChurchMembers()
  const y = new Date().getFullYear()
  const a0 = useAttendance(y), a1 = useAttendance(y - 1, false), a2 = useAttendance(y - 2, false), a3 = useAttendance(y - 3, false)
  const today = todayISO()
  const att = useMemo(() => toAttendance([a3, a2, a1, a0].flatMap((st) => st.items)), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => visitStats(att, today), [att, today])
  const [pick, setPick] = useState(false)
  const [place, setPlace] = useState('')
  const mine = doc.items.filter((x) => (x.slot ?? 'บ่าย') === slot)
  const places = doc.places?.[slot] ?? []
  const toggle = (m: { id: string; name: string }) => onChange(mine.some((x) => x.id === m.id) ? removeItem(doc, m.id) : doc.items.some((x) => x.id === m.id) ? setSlot(doc, m.id, slot) : setSlot(addItem(doc, m), m.id, slot))
  return (
    <Sheet title={`${dayName(date)} ${dmy(date)} · ภาค${slot}`} onClose={onClose}>
      <b className="small">👥 คนที่จะไปเยี่ยม ({mine.length})</b>
      {mine.length === 0 && <p className="muted small" style={{ margin: 0 }}>ยังไม่มี — กด ＋ เลือกคน</p>}
      <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>{mine.map((x) => <li key={x.id}>{x.name} <button type="button" className="mini" aria-label={`เอา ${x.name} ออก`} onClick={() => onChange(removeItem(doc, x.id))}>✕</button></li>)}</ol>
      <button type="button" className="btn btn--gold" onClick={() => setPick(!pick)}>{pick ? 'ปิดรายชื่อ' : '＋ เลือกคนจากรายชื่อ (ดูว่าขาดนมัสการกี่เดือน)'}</button>
      {pick && <AbsentList hideLabel members={people.items} stats={stats} today={today} label="ค้นหาสมาชิก" selectedIds={doc.items.map((x) => x.id)} onPick={toggle} />}
      <b className="small">📍 สถานที่ / โครงการ (ไม่ใส่ชื่อคน)</b>
      <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{places.map((p, i) => <li key={`${p}-${i}`}>{p} <button type="button" className="mini" aria-label={`ลบ ${p}`} onClick={() => onChange(removePlace(doc, slot, i))}>✕</button></li>)}</ul>
      <div className="row" style={{ gap: 6 }}>
        <input className="input grow" aria-label="สถานที่หรือโครงการ" placeholder="เช่น โครงการโคโค่ · ร้านพี่ตาล" value={place} onChange={(e) => setPlace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && place.trim()) { onChange(addPlace(doc, slot, place)); setPlace('') } }} />
        <button type="button" className="btn btn--gold" onClick={() => { if (place.trim()) { onChange(addPlace(doc, slot, place)); setPlace('') } }}>＋ เพิ่ม</button>
      </div>
      <div className="field"><label htmlFor="vt-note">📝 หมายเหตุ (เช่น ไม่ได้เยี่ยมวันนั้น แต่ทำอะไร)</label>
        <textarea id="vt-note" className="input" rows={2} defaultValue={doc.slotNotes?.[slot] ?? ''} onBlur={(e) => onChange(setSlotNote(doc, slot, e.target.value))} /></div>
      <button type="button" className="btn" onClick={onClose}>เสร็จ</button>
    </Sheet>
  )
}

/**
 * ตารางเยี่ยมเยียนรายสัปดาห์: แถว = วัน (อังคาร–เสาร์ · วันที่ตามปฏิทินอัตโนมัติ) · คอลัมน์ 2 = ข้อความช่วงเช้า/กิจกรรมประจำของวัน (พิมพ์เอง)
 * คอลัมน์ 3–5 = ภาคเช้า/บ่าย/ค่ำ: เลือกคน (กด ＋) · เพิ่มสถานที่/โครงการ · หมายเหตุ · พิมพ์/PDF A4 แนวนอน
 */
export default function VisitTimetable() {
  const { settings } = useSettings()
  const church = settings.churchName.split(' ')[0]
  const plans = useVisitPlans()
  const visits = useVisits(true)
  const today = todayISO()
  const [anchor, setAnchor] = usePlanDate(today)
  const sunday = sundayOf(anchor)
  const days = weekDays(sunday).filter((d) => dayKind(d) === 'visit')
  const ref = useRef<HTMLDivElement>(null)
  const canEdit = plans.canEdit()
  const monday = addDays(sunday, 1)
  const verse = plans.verseOf(monday) || DEFAULT_VERSE
  const [edit, setEdit] = useState<{ d: string; slot: Slot | 'day' } | null>(null)
  const visitedBy = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const v of visits.list) if (!v.absent) m.set(v.date, new Set([...(m.get(v.date) ?? []), v.memberId]))
    return m
  }, [visits.list])
  const shift = (n: number) => { const t = addDays(sunday, n * 7 + 3); setAnchor(t < today ? today : t) }
  const total = days.reduce((n, d) => n + plans.of(d).items.length, 0)
  const range = rangeTitle(days[0], days[days.length - 1])
  const open = (d: string, slot: Slot | 'day') => { if (canEdit) setEdit({ d, slot }) }
  const doc = edit ? plans.of(edit.d) : null
  const save = (d: string, next: PlanDoc) => plans.save(d, next)
  return (
    <section aria-label="ตารางเยี่ยมเยียน">
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => shift(-1)}>‹</button>
        <div style={{ textAlign: 'center', lineHeight: 1.25 }}><b>ตารางเยี่ยม</b><br /><span className="small">{range} · {total} คนในแผน</span></div>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => shift(1)}>›</button>
      </div>
      {canEdit && <p className="muted small no-print" style={{ margin: '0 0 0.3rem', textAlign: 'center' }}>👆 แตะช่องในตารางเพื่อเพิ่มคน สถานที่/โครงการ หรือหมายเหตุ</p>}
      <ScaledPage ref={ref} landscape>
        <div style={{ ...keep, display: 'flex', flexDirection: 'column', height: '100%', color: '#111' }}>
          <div style={{ ...keep, background: `linear-gradient(100deg, ${NAVY}, #274a8a)`, color: '#fff', borderRadius: 14, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `5px solid ${GOLD}` }}>
            <span style={{ fontSize: 40 }} aria-hidden="true">🏠</span>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.9 }}>{church} · ✝ งานอภิบาล</div>
              <div style={{ fontSize: 27, fontWeight: 800, lineHeight: 1.15 }}>ตารางเยี่ยมเยียนครอบครัวศิลาเอก</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#ffd978' }}>วันที่ {range}</div>
              <div style={{ fontSize: 12.5, opacity: 0.9 }}>Cornerstone Family Visitation Schedule</div>
            </div>
            <span style={{ fontSize: 40 }} aria-hidden="true">💛</span>
          </div>
          <table aria-label="ตารางเยี่ยมเยียน" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 8, flex: 1 }}>
            <colgroup><col style={{ width: '12%' }} /><col style={{ width: '17%' }} /><col style={{ width: '23.6%' }} /><col style={{ width: '23.6%' }} /><col style={{ width: '23.8%' }} /></colgroup>
            <thead>
              <tr>
                <th style={{ ...cell, ...keep, background: NAVY, color: '#fff', textAlign: 'center', fontSize: 16 }}>📅 วัน</th>
                <th style={{ ...cell, ...keep, background: '#2e7d6b', color: '#fff', textAlign: 'center', fontSize: 15 }}>🙏 กิจกรรมช่วงเช้า</th>
                {SLOTS.map((sl) => <th key={sl.k} style={{ ...cell, ...keep, background: TONE[sl.k].bg, color: sl.k === 'เช้า' ? TONE[sl.k].dark : '#fff', textAlign: 'center', fontSize: 15 }}>{sl.icon} {sl.label}<br /><span style={{ fontSize: 13 }}>{sl.time.replace(' (กลุ่มเซล)', '')}{sl.k === 'ค่ำ' ? ' (กลุ่มเซล)' : ''}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const pd = plans.of(d), seen = visitedBy.get(d) ?? new Set<string>()
                return (
                  <tr key={d} style={{ height: 92 }}>
                    <td style={{ ...cell, ...keep, textAlign: 'center', verticalAlign: 'middle', background: i % 2 ? '#fdecec' : '#fff5f5', color: RED, fontWeight: 800 }}>
                      <div style={{ fontSize: 17 }}>{dayName(d)}</div><div style={{ fontSize: 15 }}>{dmy(d)}</div>
                    </td>
                    <td style={{ ...cell, ...keep, background: '#eaf6f2', cursor: canEdit ? 'pointer' : undefined, whiteSpace: 'pre-line', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }} onClick={() => open(d, 'day')} aria-label={`${dayName(d)} กิจกรรมช่วงเช้า`}>{pd.dayText ?? ''}</td>
                    {SLOTS.map((sl) => {
                      const ppl = pd.items.filter((x) => (x.slot ?? 'บ่าย') === sl.k), pls = pd.places?.[sl.k] ?? [], note = pd.slotNotes?.[sl.k]
                      let n = 0
                      return (
                        <td key={sl.k} style={{ ...cell, ...keep, background: i % 2 ? '#fff' : TONE[sl.k].tint, cursor: canEdit ? 'pointer' : undefined }} onClick={() => open(d, sl.k)} aria-label={`${dayName(d)} ภาค${sl.k}`}>
                          {ppl.map((x) => <div key={x.id}>{++n}. {x.name}{seen.has(x.id) ? ' ✓' : ''}</div>)}
                          {pls.map((p, j) => <div key={j} style={{ fontWeight: 700, color: TONE[sl.k].dark }}>📍 {p}</div>)}
                          {note && <div style={{ whiteSpace: 'pre-line', fontStyle: 'italic', marginTop: 3 }}>📝 {note}</div>}
                          {canEdit && !ppl.length && !pls.length && !note && <span className="no-print" style={{ color: '#9aa5bd', fontSize: 22 }}>＋</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ ...keep, marginTop: 8, border: `2px solid ${GOLD}`, background: '#fff8e6', borderRadius: 12, padding: '6px 14px', textAlign: 'center', fontSize: 16, fontWeight: 700, color: NAVY, cursor: canEdit ? 'pointer' : undefined }} onClick={() => { if (!canEdit) return; const v = window.prompt('ข้อพระคัมภีร์ท้ายตาราง (ว่าง = ใช้ข้อความตั้งต้น)', verse); if (v !== null) plans.saveVerse(monday, v) }} aria-label="ข้อพระคัมภีร์">✝ {verse}</div>
          <div style={{ fontSize: 11.5, marginTop: 3, color: '#555', textAlign: 'center' }}>✓ = ไปเยี่ยมและบันทึกแล้ว · 📍 = สถานที่/โครงการ · ที่ยังไม่เลือกภาคนับเป็นภาคบ่าย</div>
        </div>
      </ScaledPage>
      <PdfTools compact mode="landscape" els={() => (ref.current ? [ref.current] : [])} file={`ตารางเยี่ยม-${monday}.pdf`} title={`ตารางเยี่ยมเยียน ${range}`} label="ตารางเยี่ยมเยียน" />
      {edit && doc && edit.slot === 'day' && (
        <Sheet title={`${dayName(edit.d)} ${dmy(edit.d)} · กิจกรรมช่วงเช้า`} onClose={() => setEdit(null)}>
          <div className="field"><label htmlFor="vt-day">พิมพ์ว่าช่วงเช้าทำอะไร (เช่น กลุ่มอธิษฐาน · ศึกษาพระคัมภีร์ 09.00-10.00 น.)</label>
            <textarea id="vt-day" className="input" rows={4} defaultValue={doc.dayText ?? ''} onBlur={(e) => save(edit.d, setDayText(doc, e.target.value))} /></div>
          <button type="button" className="btn btn--gold" onClick={() => setEdit(null)}>เสร็จ</button>
        </Sheet>
      )}
      {edit && doc && edit.slot !== 'day' && <CellEditor date={edit.d} slot={edit.slot} doc={doc} onChange={(next) => save(edit.d, next)} onClose={() => setEdit(null)} />}
    </section>
  )
}
