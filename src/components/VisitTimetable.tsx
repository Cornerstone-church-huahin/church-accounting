import { useMemo, useRef, useState } from 'react'
import { LIGHT } from '../lib/lightBox'
import AbsentList from './AbsentList'
import { VisitForm } from './PastoralVisits'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import { useRole } from '../lib/members'
import { removeMemberPhotoFile } from '../lib/memberPhoto'
import { distanceM, homeFromCheckin } from '../lib/geo'
import { shareVisit, visitShareText } from '../lib/visitShare'
import Sheet from './Sheet'
import { useAttendance, useChurchMembers, useSettings, useVisitPlans, useVisits, useWorkTeams } from '../lib/data'
import { addDays, be, monthName, todayISO } from '../lib/money'
import { visitStats } from '../lib/pastoral'
import { toAttendance } from '../lib/registry'
import { dayKind, DAY_NAMES, sundayOf, weekDays } from '../lib/visits'
import type { Visit } from '../lib/types'
import { addItem, addPlace, removeItem, removePlace, setDayText, setSlot, setSlotNote, SLOTS, type PlanDoc, type Slot } from '../lib/visitPlan'

/** หมุดสีเขียว = เช็คอินแล้ว (รายงาน) */
const GreenPin = () => <svg viewBox="0 0 24 24" width="1em" height="1em" role="img" aria-label="เช็คอินแล้ว" style={{ marginLeft: 6, verticalAlign: '-0.12em' }}><path fill="#1e9e4a" stroke="#0b6b2c" strokeWidth="1" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" /><circle cx="12" cy="9" r="2.6" fill="#fff" /></svg>
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
  const [shareMsg, setShareMsg] = useState('')
  const shareDone = async (v: Visit) => { // แชร์รายงาน: เยี่ยมที่ไหน/ใคร + รูป (รวมคนที่เช็คอินพร้อมกัน)
    const same = v.checkin ? visits.list.filter((x) => x.date === date && x.checkin?.at === v.checkin!.at) : [v]
    const names = same.filter((x) => !x.absent).map((x) => x.memberName), gone = same.filter((x) => x.absent).map((x) => x.memberName)
    const text = visitShareText({ dateText: `${dayName(date)} ${dmy(date)}`, names, absentNames: gone, visitor: v.visitor, checkin: v.checkin ?? null, note: v.reason })
    const r = await shareVisit(text, [...new Set(same.flatMap((x) => x.photos ?? []))])
    setShareMsg(r === 'shared' ? 'ส่งออกแล้ว' : r === 'copied' ? 'คัดลอกข้อความแล้ว — เปิดไลน์แล้วกดวาง' : r === 'cancelled' ? '' : 'แชร์ไม่ได้บนเครื่องนี้')
  }
  // เช็คอินที่บ้าน → พิกัดบ้าน · เช็คอินที่ทำงาน → พิกัดที่ทำงาน ในทะเบียนสมาชิกอัตโนมัติ (ยังไม่มี = ตั้งให้เลย · มีแล้วและห่างเกิน 100 ม. ถามก่อนทับ) · สถานที่/โหมดทดสอบไม่นับ
  const pinHomes = (vs: Visit[]) => {
    for (const v of vs) {
      if (!v.checkin || v.checkin.sim || v.memberId.startsWith('place:')) continue
      const m = people.items.find((x) => x.id === v.memberId)
      if (!m) continue
      const at = { lat: v.checkin.lat, lng: v.checkin.lng }
      const work = v.checkin.kind === 'work' // เช็คอินที่ทำงาน → พิกัดที่ทำงานของสมาชิก (ทุกคนที่ติ๊กพร้อมกันได้พิกัดเดียวกัน)
      const cur = work ? { lat: m.workLat, lng: m.workLng } : { lat: m.lat, lng: m.lng }
      const r = homeFromCheckin(cur, at)
      if (r.action === 'keep') continue
      if (r.action === 'ask' && !window.confirm(`พิกัด${work ? 'ที่ทำงาน' : 'บ้าน'}ของ ${m.name} ในทะเบียนต่างจากจุดเช็คอินนี้ ${r.meters} เมตร\nอัปเดตตามจุดเช็คอินนี้ไหม?`)) continue
      // กติกา: ยังไม่มีพิกัด → ใช้จุดเช็คอินใหม่ · มีแล้วและคลาดเคลื่อนไม่เกิน 100 ม. → ใช้พิกัดเดิม (ข้างบน) · ถ้าบ้าน/ที่ทำงานอีกอันอยู่ใกล้จุดนี้ (≤100 ม.) → ใช้พิกัดของอันนั้นเป็นหลัก
      const other = work ? { lat: m.lat, lng: m.lng } : { lat: m.workLat, lng: m.workLng }
      const useOther = typeof other.lat === 'number' && typeof other.lng === 'number' && distanceM(at, { lat: other.lat, lng: other.lng }) <= 100
      const final = useOther ? { lat: other.lat as number, lng: other.lng as number } : at
      people.put([{ ...m, ...(work ? { workLat: final.lat, workLng: final.lng } : final) }])
    }
  }
  const noteRef = useRef<string | null>(null) // ข้อความหมายเหตุที่พิมพ์ค้างอยู่ — บันทึกตอนกด “บันทึก” หรือปิด
  const finish = () => { if (noteRef.current !== null && noteRef.current !== (doc.slotNotes?.[slot] ?? '')) onChange(setSlotNote(doc, slot, noteRef.current)); onClose() }
  return (
    <Sheet title={`${dayName(date)} ${dmy(date)} · ภาค${slot}`} onClose={finish}>
      {!planOnly && pend.length > 0 && <div style={{ position: 'sticky', top: 0, zIndex: 3, display: 'flex', justifyContent: 'flex-end', paddingBottom: 6, pointerEvents: 'none' }}>
        <div role="dialog" aria-label="ยืนยันบันทึกการเยี่ยม" style={{ pointerEvents: 'auto', width: '88%', ...LIGHT, background: '#fff', border: '3px solid #d4af37', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,.4)', padding: '10px 12px' }}>
          <b style={{ display: 'block', fontSize: '1.05rem' }}>📍 บันทึกและเช็คอินการเยี่ยม · {pend.length} คน ในพิกัดเดียวกัน</b>
          <ol style={{ margin: '4px 0 6px', paddingLeft: '1.4rem', fontSize: '1.05rem', maxHeight: '8.5rem', overflowY: 'auto' }}>{pend.map((x) => <li key={x.id}>{x.name.replace(/^place:/, '')}</li>)}</ol>
          <div className="muted small" style={{ marginBottom: 6 }}>กดปุ่มด้านล่างเพื่อบันทึกการเยี่ยม — เลือกเช็คอินที่บ้านหรือที่ทำงาน (ใช้พิกัดเดียวกันทั้ง {pend.length} คน · ใครอยู่คนละที่ ให้เอาติ๊กออกแล้วบันทึกแยกทีหลัง)</div>
          <button type="button" className="btn btn--gold btn--block" onClick={() => setForm({ entry: null, group: pend })}>📍 คลิกเพื่อบันทึกและเช็คอินตามรายชื่อ ›</button>
        </div></div>}
      {mine.length > 0 && <b className="small">{planOnly ? '👥 คนที่จะไปเยี่ยม' : '📍 คนที่จะบันทึกและเช็คอินเยี่ยม'} ({mine.length})</b>}
      {mine.length > 0 && <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>{mine.map((x) => { const v = done(x.id); return <li key={x.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '3px 0' }}>{!planOnly && <input type="checkbox" aria-label={`ติ๊กเยี่ยม ${x.name}`} style={{ width: 22, height: 22 }} checked={!!v || ticked.includes(x.id)} disabled={!!v} onChange={(e) => tick(x.id, e.target.checked)} />}<span>{x.name}{v ? (v.absent ? ' ✗ ไม่พบ' : ' ✓') : ''}</span> {!planOnly && v && <button type="button" className="mini" aria-label={`แก้การเยี่ยม ${x.name}`} onClick={() => setForm({ entry: v, member: { id: x.id, name: x.name } })}>✎ แก้</button>}{!planOnly && v && <button type="button" className="mini" aria-label={`แชร์รายงาน ${x.name}`} title="แชร์เข้ากลุ่ม" onClick={() => void shareDone(v)}>📤</button>} {!recordOnly && <button type="button" className="mini" aria-label={`เอา ${x.name} ออก`} onClick={() => { tick(x.id, false); onChange(removeItem(doc, x.id)) }}>✕</button>}</li> })}</ul>}
      {!recordOnly && <div className="field"><label htmlFor="vt-note">📝 หมายเหตุ (พิมพ์ข้อความ หรือจะเลือกคนจากรายชื่อด้านล่างก็ได้)</label>
        <textarea id="vt-note" className="input" rows={2} defaultValue={doc.slotNotes?.[slot] ?? ''} onChange={(e) => { noteRef.current = e.target.value }} onBlur={(e) => { noteRef.current = null; onChange(setSlotNote(doc, slot, e.target.value)) }} /></div>}
      {!recordOnly && <AbsentList hideLabel members={people.items} stats={stats} today={today} label="ค้นหาสมาชิก" selectedIds={doc.items.map((x) => x.id)} onPick={toggle} />}
      <b className="small">📍 สถานที่ / โครงการ{recordOnly ? '' : ' (ไม่ใส่ชื่อคน)'}</b>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>{places.map((p, i) => { const v = done(`place:${p}`); return <li key={`${p}-${i}`} className="row" style={{ gap: 8, alignItems: 'center', padding: '3px 0' }}>{!planOnly && <input type="checkbox" aria-label={`ติ๊กไปแล้ว ${p}`} style={{ width: 22, height: 22 }} checked={!!v || ticked.includes(`place:${p}`)} disabled={!!v} onChange={(e) => tick(`place:${p}`, e.target.checked)} />}<span>📍 {p}{v ? ' ✓' : ''}</span> {!planOnly && v && <button type="button" className="mini" aria-label={`แก้การเยี่ยม ${p}`} onClick={() => setForm({ entry: v, member: { id: `place:${p}`, name: p } })}>✎ แก้</button>}{!planOnly && v && <button type="button" className="mini" aria-label={`แชร์รายงาน ${p}`} title="แชร์เข้ากลุ่ม" onClick={() => void shareDone(v)}>📤</button>} {!recordOnly && <button type="button" className="mini" aria-label={`ลบ ${p}`} onClick={() => { tick(`place:${p}`, false); onChange(removePlace(doc, slot, i)) }}>✕</button>}</li> })}</ul>
      {!recordOnly && (
      <div className="row" style={{ gap: 6 }}>
        <input className="input grow" aria-label="สถานที่หรือโครงการ" placeholder="เช่น โครงการโคโค่ · ร้านพี่ตาล" value={place} onChange={(e) => setPlace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && place.trim()) { onChange(addPlace(doc, slot, place)); setPlace('') } }} />
        <button type="button" className="btn btn--gold" onClick={() => { if (place.trim()) { onChange(addPlace(doc, slot, place)); setPlace('') } }}>＋ เพิ่ม</button>
      </div>
      )}
      {shareMsg && <span className="muted small" role="status">{shareMsg}</span>}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--card, #fff)', paddingTop: 6, paddingBottom: 6, zIndex: 2 }}><button type="button" className="btn btn--block" onClick={finish}>{planOnly ? '✓ บันทึก' : '📍 บันทึกและเช็คอิน'}</button></div>
      {form && (
        <VisitForm date={date} entry={form.entry} stop={0} {...(form.group ? { group: form.group, onSaveMany: (vs: Visit[]) => { visits.put(vs); pinHomes(vs); setForm(null) } } : {})} team={team.map((t) => t.name).filter(Boolean)} writeNames members={people.items} stats={stats} today={today}
          preset={form.member ? { member: form.member } : {}}
          photoShared={(p) => visits.list.some((v) => v.id !== form.entry?.id && v.photos?.includes(p))}
          onClose={() => setForm(null)} onSave={(v) => { visits.put([v]); pinHomes([v]); setForm(null) }}
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
  plan: { th: 'เตรียมงานและการเยี่ยมครอบครัวศิลาเอก', en: 'Cornerstone Family Visitation Preparation · Pastoral Visits', short: 'เตรียมการเยี่ยม', file: 'เตรียมการเยี่ยม' },
  record: { th: 'บันทึกงานและการเยี่ยมครอบครัวศิลาเอก', en: 'Cornerstone Family Visitation Record · Pastoral Visits', short: 'บันทึกการเยี่ยม', file: 'บันทึกการเยี่ยม' },
  report: { th: 'รายงานงานและการเยี่ยมครอบครัวศิลาเอก', en: 'Cornerstone Family Visitation Report · Pastoral Visits', short: 'รายงานการเยี่ยม', file: 'รายงานการเยี่ยม' },
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
  const isAdmin = useRole() === 'admin'
  const [del, setDel] = useState<{ d: string; slot: Slot } | null>(null) // รายงาน: แอดมินยกเลิกการบันทึกที่บันทึกผิด
  const open = (d: string, slot: Slot | 'day') => { if (report) { if (isAdmin && slot !== 'day') setDel({ d, slot }); return } if (canEdit) setEdit({ d, slot }) }
  const doc = edit ? plans.of(edit.d) : null
  const save = (d: string, next: PlanDoc) => plans.save(d, next)
  // ธีมสีต่างกันตามหน้า: วางแผน = ขาวเรียบ · บันทึก/เช็คอิน = สีอ่อนนุ่ม · รายงาน = เต็มรูปแบบ (กรอบทอง ไล่เฉด) เพราะเป็นหน้าที่ใช้นำเสนอ/ติดประกาศ
  const P = mode === 'plan', R = mode === 'report', C = mode === 'record' // C = บันทึก/เช็คอิน: โทนเขียวมิ้นต์ (สีของการเช็คอิน)
  const cl: React.CSSProperties = { ...cell, border: `1.5px solid ${P ? '#c3cbdb' : R ? '#a8924a' : '#79b8ac'}` }
  const thx = (bg: string, color: string): React.CSSProperties => ({ ...cl, ...keep, background: P ? '#eef1f6' : C ? '#d4efe8' : bg, color: P ? NAVY : C ? '#0f4f47' : color, textAlign: 'center', ...(R ? { borderBottom: `3px solid ${GOLD}` } : {}) })
  const slotBg = (i: number, tint: string) => (P ? '#fff' : C ? (i % 2 ? '#f3fbf8' : '#e4f6f1') : R ? `linear-gradient(180deg, ${i % 2 ? '#fff' : tint}, ${i % 2 ? tint : '#fff'})` : tint)
  return (
    <section aria-label="ตารางเยี่ยมเยียน">
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => shift(-1)}>‹</button>
        <span className="small"><b>{range}</b>{total ? ` · ${total} คนในแผน` : ''}</span>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => shift(1)}>›</button>
      </div>
      <ScaledPage ref={ref}>
        <div style={{ ...keep, display: 'flex', flexDirection: 'column', height: '100%', color: '#111' }}>
          <div style={{ ...keep, ...(P ? { background: '#fff', color: NAVY, border: '2px solid #c3cbdb', borderBottom: `5px solid #c3cbdb` } : R ? { background: `linear-gradient(100deg, ${NAVY}, #274a8a 55%, #1a3566)`, color: '#fff', border: `2px solid ${GOLD}`, borderBottom: `6px solid ${GOLD}`, boxShadow: '0 3px 10px rgba(20,38,74,.35)' } : { background: 'linear-gradient(100deg, #0f5f56, #1f8a7a)', color: '#fff', borderBottom: '5px solid #7fd1c1' }), borderRadius: 14, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 40 }} aria-hidden="true">🏠</span>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 15, letterSpacing: 1, opacity: 0.9 }}>{church} · ✝ งานอภิบาล</div>
              <div style={{ fontSize: 29, fontWeight: 800, lineHeight: 1.15 }}>{TITLE[mode].th}</div>
              <div style={{ fontSize: 21, fontWeight: 700, color: P ? '#8a6a00' : C ? '#d8fff5' : '#ffd978' }}>วันที่ {range}</div>
              <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.95 }}>{TITLE[mode].en}</div>
            </div>
            <span style={{ fontSize: 40 }} aria-hidden="true">💛</span>
          </div>
          <div style={{ ...keep, display: 'flex', flexDirection: 'column', flex: 1, marginTop: 8, ...(R ? { border: `4px double ${GOLD}`, borderRadius: 12, padding: 4, background: '#fffdf5' } : {}) }}>
          <table aria-label="ตารางเยี่ยมเยียน" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', flex: 1 }}>
            <colgroup><col style={{ width: '13%' }} /><col style={{ width: '15%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /></colgroup>
            <thead>
              <tr>
                <th style={{ ...thx(NAVY, '#fff'), fontSize: 18 }}>📅 วัน<br /><span style={{ fontSize: 14 }}>Day / Date</span></th>
                <th style={{ ...thx('#2e7d6b', '#fff'), fontSize: 17 }}>🙏 กิจกรรมช่วงเช้า<br /><span style={{ fontSize: 14 }}>Morning Activity</span></th>
                {SLOTS.map((sl) => <th key={sl.k} style={{ ...thx(TONE[sl.k].bg, sl.k === 'เช้า' ? TONE[sl.k].dark : '#fff'), fontSize: 18 }}>{sl.icon} {sl.label}<br /><span style={{ fontSize: 15 }}>{sl.time.replace(' (กลุ่มเซล)', '')}{sl.k === 'ค่ำ' ? ' (กลุ่มเซล)' : ''}</span><br /><span style={{ fontSize: 14 }}>{EN[sl.k]}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const pd = plans.of(d), seen = visitedBy.get(d) ?? new Set<string>()
                return (
                  <tr key={d} style={{ height: 160 }}>
                    <td style={{ ...cl, ...keep, textAlign: 'center', verticalAlign: 'middle', background: P ? '#fff' : R ? 'linear-gradient(180deg, #fff5f5, #fbdcdc)' : i % 2 ? '#e1f4ee' : '#edf9f5', color: C ? '#0f5f56' : RED, fontWeight: 800 }}>
                      <div style={{ fontSize: 21 }}>{dayName(d)}</div><div style={{ fontSize: 14, fontWeight: 600 }}>{DAY_EN[new Date(d + 'T00:00:00Z').getUTCDay()]}</div><div style={{ fontSize: 18 }}>{dmy(d)}</div>
                    </td>
                    <td style={{ ...cl, ...keep, background: P ? '#fff' : R ? 'linear-gradient(180deg, #f1faf7, #d6efe6)' : '#f6fcfa', cursor: canEdit ? 'pointer' : undefined, whiteSpace: 'pre-line', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle', fontSize: 18 }} onClick={() => open(d, 'day')} aria-label={`${dayName(d)} กิจกรรมช่วงเช้า`}>{pd.dayText ?? ''}</td>
                    {SLOTS.map((sl) => {
                      const ppl = pd.items.filter((x) => (x.slot ?? 'บ่าย') === sl.k), pls = pd.places?.[sl.k] ?? [], note = pd.slotNotes?.[sl.k]
                      let n = 0
                      const vsl = visits.list.filter((v) => v.date === d && slotOfVisit(v, pd) === sl.k)
                      return (
                        <td key={sl.k} style={{ ...cl, ...keep, background: slotBg(i, TONE[sl.k].tint), cursor: canEdit || (report && isAdmin) ? 'pointer' : undefined }} onClick={() => open(d, sl.k)} aria-label={`${dayName(d)} ภาค${sl.k}`}>
                          {!report && note && <div style={{ whiteSpace: 'pre-line', fontStyle: 'italic', marginBottom: 3 }}>📝 {note}</div>}
                          {report ? vsl.map((v) => <div key={v.id} style={{ color: v.absent ? '#a4262c' : undefined }}>{++n}. {v.memberName.replace(/^place:/, '')}{v.absent ? ' ✗ ไม่พบ' : ''}{v.checkin ? <GreenPin /> : null}</div>) : null}
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
          </div>
          <div style={{ ...keep, marginTop: 8, border: `2px solid ${GOLD}`, ...LIGHT, background: '#fff8e6', borderRadius: 12, padding: '6px 14px', textAlign: 'center', fontSize: 19, fontWeight: 700, color: NAVY, cursor: canEdit ? 'pointer' : undefined }} onClick={() => { if (!canEdit) return; const v = window.prompt('ข้อพระคัมภีร์ท้ายตาราง (ว่าง = ใช้ข้อความตั้งต้น)', verse); if (v !== null) plans.saveVerse(monday, v) }} aria-label="ข้อพระคัมภีร์">✝ {verse}</div>
          <div style={{ fontSize: 13.5, marginTop: 3, color: '#555', textAlign: 'center' }}>{report ? '📍 หมุดเขียว = เช็คอินแล้ว / Checked in' : '✓ = ไปเยี่ยมและบันทึกแล้ว / Visited'} · 📍 = สถานที่/โครงการ / Place or project · 📝 = หมายเหตุ / Note</div>
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
      {del && (() => {
        const pd = plans.of(del.d)
        const vs = visits.list.filter((v) => v.date === del.d && slotOfVisit(v, pd) === del.slot)
        const cancel = (v: Visit) => {
          if (!confirm(`ยกเลิกการบันทึกเยี่ยม ${v.memberName}?\n(ลบออกจากรายงานและลบรูปของรายการนี้)`)) return
          visits.remove(v.id)
          ;(v.photos ?? []).filter((ph) => !visits.list.some((x) => x.id !== v.id && x.photos?.includes(ph))).forEach((ph) => void removeMemberPhotoFile(ph))
        }
        return (
          <Sheet title={`${dayName(del.d)} ${dmy(del.d)} · ภาค${del.slot} · การบันทึกเยี่ยม`} onClose={() => setDel(null)}>
            {vs.length === 0 && <p className="muted">ไม่มีรายการบันทึกในช่องนี้</p>}
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>{vs.map((v) => (
              <li key={v.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <span style={{ flex: 1 }}>{v.memberName.replace(/^place:/, '')}{v.absent ? ' ✗ ไม่พบ' : ' ✓'}{v.visitor ? <small className="muted"> · {v.visitor}</small> : null}</span>
                <button type="button" className="btn btn--danger" aria-label={`ยกเลิกการบันทึก ${v.memberName}`} onClick={() => cancel(v)}>🗑 ยกเลิกการบันทึก</button>
              </li>))}</ul>
            <p className="muted small">เฉพาะแอดมินเท่านั้นที่ยกเลิกได้</p>
            <button type="button" className="btn" onClick={() => setDel(null)}>ปิด</button>
          </Sheet>
        )
      })()}
      {edit && doc && edit.slot !== 'day' && <CellEditor date={edit.d} slot={edit.slot} doc={doc} onChange={(next) => save(edit.d, next)} onClose={() => setEdit(null)} planOnly={mode === 'plan'} />}
    </section>
  )
}
