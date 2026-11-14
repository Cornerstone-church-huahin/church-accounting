import { useMemo, useRef, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import MultiPick from './MultiPick'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import { LIGHT } from '../lib/lightBox'
import { getMe } from '../lib/access'
import { useChurchMembers, useSchoolDays, useSchoolTeachers, useSettings } from '../lib/data'
import { isLive } from '../lib/pastoral'
import { useRole } from '../lib/members'
import { addDays, be, monthName, newId, todayISO } from '../lib/money'
import { copyPlan, schoolWeekDays, sortedItems, weekSummary } from '../lib/schoolTimetable'
import { DAY_NAMES, sundayOf } from '../lib/visits'
import type { ChurchMember, SchoolDay, SchoolItem } from '../lib/types'

type Step = 'plan' | 'record' | 'report'
const STEPS: { id: Step; icon: string; label: string }[] = [{ id: 'plan', icon: '📅', label: 'วางแผน' }, { id: 'record', icon: '📝', label: 'บันทึก' }, { id: 'report', icon: '📊', label: 'รายงาน' }]
const NAVY = '#1a2b4c'
const dow = (iso: string) => DAY_NAMES[new Date(iso + 'T00:00:00Z').getUTCDay()]
const dm = (iso: string) => `${Number(iso.slice(8))}/${iso.slice(5, 7)}/${String(be(Number(iso.slice(0, 4)))).slice(2)}`
const hhmm = (at: number) => new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

/**
 * ตารางงานรวี (แท็บ 2 ของงานรวี): อังคาร–อาทิตย์ · วางแผนรายการสอน/งานพร้อมครูผู้รับผิดชอบหลายคน ·
 * บันทึกว่าทำแล้ว + หมายเหตุ + บันทึกระหว่างวัน · รายงาน A4 พิมพ์/PDF
 */
export default function SchoolTimetable({ canEdit }: { canEdit: boolean }) {
  const [step, setStep] = useState<Step>('plan')
  const [anchor, setAnchor] = useState(todayISO())
  const sunday = sundayOf(anchor)
  const days = schoolWeekDays(sunday)
  const store = useSchoolDays()
  const teachers = useSchoolTeachers()
  const people = useChurchMembers()
  const isAdmin = useRole() === 'admin'
  const me = getMe()?.name ?? ''
  const church = useSettings().settings.churchName.split(' ')[0]
  const docs = days.map((d) => store.of(d))
  const sum = weekSummary(docs)
  const range = (() => { const [ya, ma, da] = days[0].split('-').map(Number), [yb, mb, db] = days[5].split('-').map(Number); return ya === yb && ma === mb ? `${da}-${db} ${monthName(ma)} ${be(ya)}` : `${da} ${monthName(ma)} ${be(ya)} – ${db} ${monthName(mb)} ${be(yb)}` })()
  const save = (d: SchoolDay) => store.put([{ ...d, updated: 0 }])
  const [edit, setEdit] = useState<{ date: string; item: SchoolItem | null } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const roster = useMemo(() => [...new Set(teachers.items.filter((x) => !x.deleted).map((x) => x.name))].sort((a, b) => a.localeCompare(b)), [teachers.items])

  const copyPrev = () => {
    const prev = days.map((d) => store.of(addDays(d, -7)))
    const next = docs.filter((d, i) => d.items.length === 0 && prev[i].items.length > 0).map((d) => ({ ...d, items: copyPlan(prev[docs.indexOf(d)], () => newId('sc')) }))
    if (!next.length) return alert('ไม่มีวันว่างที่จะคัดลอก หรือสัปดาห์ก่อนยังไม่มีตาราง')
    if (confirm(`คัดลอกตารางจากสัปดาห์ก่อนมาใส่ ${next.length} วันที่ยังว่าง?`)) next.forEach(save)
  }
  const nav = (
    <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => setAnchor(addDays(sunday, -4))}>‹</button>
      <span className="small"><b>{range}</b>{sum.items ? ` · ${sum.items} รายการ${sum.done ? ` · ทำแล้ว ${sum.done}` : ''}` : ''}</span>
      <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => setAnchor(addDays(sunday, 10))}>›</button>
    </div>
  )

  return (
    <section aria-label="ตารางงานรวี">
      <nav className="tabicons tabicons--txt tabicons--arrow tabicons--four no-print" aria-label="วางแผน บันทึก รายงาน">
        {STEPS.map((x, i) => (
          <button key={x.id} type="button" className={`tabicons__i${x.id === step ? ' on' : ''}`} aria-label={x.label} onClick={() => setStep(x.id)}>
            <i aria-hidden="true">{i + 1}</i><span aria-hidden="true">{x.icon}</span><em aria-hidden="true">{x.label}</em>
          </button>))}
      </nav>
      {nav}
      {!canEdit && <p className="muted small no-print" role="note">ดูอย่างเดียว — ผู้ดูแล/ผู้ช่วยของงานรวีเท่านั้นที่แก้ไขได้</p>}

      {step === 'plan' && (
        <>
          {canEdit && <button type="button" className="btn btn--block no-print" onClick={copyPrev}>📋 คัดลอกตารางจากสัปดาห์ก่อน (เฉพาะวันที่ยังว่าง)</button>}
          {days.map((d, i) => (
            <div key={d} className="card" style={{ ...LIGHT, background: '#fff', marginTop: 8 }}>
              <div className="row row--between"><b>{dow(d)} {dm(d)}</b>{canEdit && <button type="button" className="mini" onClick={() => setEdit({ date: d, item: null })}>＋ เพิ่มรายการ</button>}</div>
              {docs[i].items.length === 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>ยังไม่มีรายการ</p>}
              {sortedItems(docs[i].items).map((it) => (
                <div key={it.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '5px 0', borderTop: '1px solid #eee' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{it.time && <b>{it.time} </b>}{it.title}<br /><small className="muted">👩‍🏫 {it.teachers.length ? it.teachers.join(', ') : 'ยังไม่กำหนดครู'}</small></span>
                  {canEdit && <><button type="button" className="mini" aria-label={`แก้ ${it.title}`} onClick={() => setEdit({ date: d, item: it })}>✎</button>
                    <button type="button" className="mini" aria-label={`ลบ ${it.title}`} onClick={() => { if (confirm(`ลบ “${it.title}” ?`)) save({ ...docs[i], items: docs[i].items.filter((x) => x.id !== it.id) }) }}>🗑</button></>}
                </div>))}
            </div>))}
        </>
      )}

      {step === 'record' && days.map((d, i) => {
        const doc = docs[i]
        return <DayRecord key={d} date={d} doc={doc} canEdit={canEdit} isAdmin={isAdmin} me={me} today={d === todayISO()} onSave={save} />
      })}

      {step === 'report' && (
        <>
          <PdfTools compact mode="full" els={() => (ref.current ? [ref.current] : [])} file={`ตารางงานรวี-${days[0]}.pdf`} title={`ตารางงานรวี ${range}`} label="ตารางงานรวี" />
          <ScaledPage ref={ref}>
            <div style={{ color: '#111', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', background: `linear-gradient(100deg, ${NAVY}, #274a8a 55%, #1a3566)`, color: '#fff', borderRadius: 10, padding: '10px 8px', borderBottom: '6px solid #d4af37' }}>
                <div style={{ fontSize: 15 }}>{church} · ✝ งานรวี</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>ตารางงานรวี</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#ffd978' }}>วันที่ {range}</div>
                <div style={{ fontSize: 14 }}>ครูผู้รับผิดชอบ {sum.teachers.length} คน · ทำแล้ว {sum.done}/{sum.items} รายการ</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 8, fontSize: 14 }}>
                <colgroup><col style={{ width: '16%' }} /><col style={{ width: '38%' }} /><col style={{ width: '22%' }} /><col style={{ width: '24%' }} /></colgroup>
                <thead><tr>{['วัน', 'รายการ / ชั้น', 'ครูผู้รับผิดชอบ', 'บันทึก'].map((h) => <th key={h} style={{ border: '1.5px solid #a8924a', background: '#eef1f6', color: NAVY, padding: 4 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {days.map((d, i) => {
                    const doc = docs[i], its = sortedItems(doc.items)
                    return (
                      <tr key={d} style={{ breakInside: 'avoid' }}>
                        <td style={{ border: '1.5px solid #a8924a', padding: 4, textAlign: 'center', fontWeight: 700, color: '#a4262c' }}>{dow(d)}<br /><small>{dm(d)}</small></td>
                        <td style={{ border: '1.5px solid #a8924a', padding: 4, verticalAlign: 'top' }}>{its.length ? its.map((it, j) => <div key={it.id}>{j + 1}. {it.time && <b>{it.time} </b>}{it.title}{it.done ? ' ✓' : ''}{it.note ? <small style={{ color: '#555' }}> — {it.note}</small> : null}</div>) : <span style={{ color: '#999' }}>—</span>}</td>
                        <td style={{ border: '1.5px solid #a8924a', padding: 4, verticalAlign: 'top' }}>{its.map((it) => <div key={it.id}>{it.teachers.join(', ') || '—'}</div>)}</td>
                        <td style={{ border: '1.5px solid #a8924a', padding: 4, verticalAlign: 'top', fontSize: 12 }}>{doc.logs.length ? [...doc.logs].sort((a, b) => a.at - b.at).map((l) => <div key={l.id}><b>{hhmm(l.at)}</b> {l.text}{l.by ? ` (${l.by})` : ''}</div>) : <span style={{ color: '#999' }}>—</span>}</td>
                      </tr>)
                  })}
                </tbody>
              </table>
            </div>
          </ScaledPage>
        </>
      )}

      {edit && <ItemSheet date={edit.date} item={edit.item} roster={roster} members={people.items.filter((m) => !m.deleted && isLive(m))} canManageRoster={canEdit}
        onAddTeacher={(n) => { if (!teachers.items.some((x) => !x.deleted && x.name === n)) teachers.put([{ id: newId('tc'), name: n, updated: 0 }]) }}
        onDropTeacher={(n) => { for (const x of teachers.items.filter((y) => y.name === n)) teachers.remove(x.id) }}
        onClose={() => setEdit(null)}
        onSave={(it) => { const doc = store.of(edit.date); save({ ...doc, items: edit.item ? doc.items.map((x) => (x.id === it.id ? { ...x, ...it } : x)) : [...doc.items, it] }); setEdit(null) }} />}
    </section>
  )
}

/** ฟอร์มเพิ่ม/แก้รายการสอนหรืองาน: เวลา · ชั้น/วิชา/งาน · ครูผู้รับผิดชอบ (เลือกหลายคน เพิ่มชื่อใหม่ได้) */
function ItemSheet({ date, item, roster, members, canManageRoster, onAddTeacher, onDropTeacher, onClose, onSave }: { date: string; item: SchoolItem | null; roster: string[]; /** สมาชิกในทะเบียน (ใช้ค้นหาเลือกเป็นครู) */ members: ChurchMember[]; canManageRoster: boolean; onAddTeacher: (n: string) => void; onDropTeacher: (n: string) => void; onClose: () => void; onSave: (it: SchoolItem) => void }) {
  const [time, setTime] = useState(item?.time ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [picked, setPicked] = useState<string[]>(item?.teachers ?? [])
  const [q, setQ] = useState('')
  const found = useMemo(() => { const t = q.trim().toLowerCase(); return t ? members.filter((m) => `${m.name} ${m.nick ?? ''}`.toLowerCase().includes(t)).slice(0, 8) : [] }, [q, members])
  const [err, setErr] = useState('')
  const go = () => { if (!title.trim()) return setErr('ใส่ชื่อรายการ เช่น ชั้นเด็กเล็ก · เตรียมสื่อการสอน'); onSave({ ...(item ?? {}), id: item?.id ?? newId('sc'), time: time.trim(), title: title.trim(), teachers: picked }) }
  return (
    <Sheet title={`${item ? '✎ แก้' : '＋ เพิ่ม'}รายการ · ${dow(date)} ${dm(date)}`} onClose={onClose}>
      <div className="field"><label htmlFor="sc-time">เวลา (ไม่บังคับ)</label><input id="sc-time" className="input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="เช่น 09:00-10:00" /></div>
      <div className="field"><label htmlFor="sc-title">รายการ / ชั้น / วิชา / งาน</label><input id="sc-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ชั้นเด็กเล็ก · ประชุมครู · เตรียมสื่อ" /></div>
      <div className="field"><label htmlFor="sc-by">👩‍🏫 ครูผู้รับผิดชอบ (เลือกได้หลายคน)</label>
        <MultiPick id="sc-by" title="ครูผู้รับผิดชอบ" options={[...new Set([...roster, ...picked])].map((n) => ({ value: n, label: n }))} value={picked} onChange={setPicked} empty="— เลือกครู —"
          {...(canManageRoster ? { onAdd: (n: string) => { const v = n.trim().replace(/,/g, ' '); if (!v) return; onAddTeacher(v); setPicked((xs) => (xs.includes(v) ? xs : [...xs, v])) }, onRemove: (n: string) => { onDropTeacher(n); setPicked((xs) => xs.filter((x) => x !== n)) }, addHint: 'พิมพ์ชื่อครูใหม่ แล้วกด เพิ่ม (เก็บไว้เลือกได้ทุกครั้ง)' } : {})} /></div>
      <div className="field"><label htmlFor="sc-q">🔎 ค้นหาครูจากทะเบียนสมาชิก (ชื่อ / ชื่อเล่น)</label>
        <input id="sc-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อแล้วกดเลือก" />
        {q.trim() && found.length === 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>ไม่พบในทะเบียน — เพิ่มชื่อเองได้ในช่อง “เลือกครู”</p>}
        {found.map((m) => { const nm = m.name.replace(/^place:/, ''), on = picked.includes(nm); return (
          <div key={m.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee' }}>
            <MemberAvatar path={m.photoPath} name={nm} size={40} member={m} />
            <span style={{ flex: 1, minWidth: 0 }}><b>{nm}</b>{m.nick ? ` (${m.nick})` : ''}</span>
            <button type="button" className={`btn ${on ? '' : 'btn--gold'}`} onClick={() => setPicked((xs) => (on ? xs.filter((x) => x !== nm) : [...xs, nm]))}>{on ? '✓ เลือกแล้ว (กดยกเลิก)' : '＋ เลือก'}</button>
          </div>) })}
      </div>
      {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button type="button" className="btn btn--gold btn--block" onClick={go}>✓ บันทึก</button>
    </Sheet>
  )
}

/** บันทึกของหนึ่งวัน: ติ๊ก “ทำแล้ว” + หมายเหตุรายการ · บันทึกระหว่างวันว่าทำอะไรบ้าง (หลายครั้งได้) */
function DayRecord({ date, doc, canEdit, isAdmin, me, today, onSave }: { date: string; doc: SchoolDay; canEdit: boolean; isAdmin: boolean; me: string; today: boolean; onSave: (d: SchoolDay) => void }) {
  const [text, setText] = useState('')
  const its = sortedItems(doc.items)
  const setItem = (id: string, patch: Partial<SchoolItem>) => onSave({ ...doc, items: doc.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const addLog = () => { const t = text.trim(); if (!t) return; onSave({ ...doc, logs: [...doc.logs, { id: newId('lg'), at: Date.now(), by: me, text: t }] }); setText('') }
  return (
    <div className="card" style={{ ...LIGHT, background: today ? '#f3fbf8' : '#fff', border: today ? '2px solid #1e8e3e' : undefined, marginTop: 8 }}>
      <b>{dow(date)} {dm(date)}{today ? ' · วันนี้' : ''}</b>
      {its.length === 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>ไม่มีรายการในแผน (เพิ่มได้ที่ขั้น “วางแผน”)</p>}
      {its.map((it) => (
        <div key={it.id} style={{ padding: '5px 0', borderTop: '1px solid #eee' }}>
          <label className="row" style={{ gap: 10, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 24, height: 24 }} disabled={!canEdit} checked={!!it.done} onChange={(e) => setItem(it.id, { done: e.target.checked ? { at: Date.now(), by: me } : undefined })} />
            <span style={{ flex: 1 }}>{it.time && <b>{it.time} </b>}{it.title}<br /><small className="muted">👩‍🏫 {it.teachers.join(', ') || '—'}</small></span>
            {it.done && <small className="muted">✓ {hhmm(it.done.at)}{it.done.by ? ` · ${it.done.by}` : ''}</small>}
          </label>
          {canEdit && <input className="input" style={{ marginTop: 4 }} aria-label={`หมายเหตุ ${it.title}`} placeholder="หมายเหตุ (ถ้ามี)" defaultValue={it.note ?? ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (it.note ?? '')) setItem(it.id, { note: v || undefined }) }} />}
          {!canEdit && it.note && <small className="muted">📝 {it.note}</small>}
        </div>))}
      <div style={{ marginTop: 8, borderTop: '2px solid #d6dbe8', paddingTop: 6 }}>
        <b className="small">📓 บันทึกระหว่างวัน — ทำอะไรบ้าง</b>
        {doc.logs.length === 0 && <p className="muted small" style={{ margin: '2px 0' }}>ยังไม่มีบันทึก</p>}
        {[...doc.logs].sort((a, b) => a.at - b.at).map((l) => (
          <div key={l.id} className="row" style={{ gap: 6, alignItems: 'baseline', padding: '2px 0' }}>
            <span style={{ flex: 1 }}><b>{hhmm(l.at)}</b> {l.text}{l.by ? <small className="muted"> · {l.by}</small> : null}</span>
            {(isAdmin || (canEdit && l.by === me)) && <button type="button" className="mini" aria-label="ลบบันทึก" onClick={() => onSave({ ...doc, logs: doc.logs.filter((x) => x.id !== l.id) })}>✕</button>}
          </div>))}
        {canEdit && <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <input className="input grow" aria-label={`บันทึกของ ${dow(date)}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLog() } }} placeholder="เช่น ครูสอนเด็กเล็ก 12 คน · แจกขนม" />
          <button type="button" className="btn btn--gold" onClick={addLog}>＋ บันทึก</button>
        </div>}
      </div>
    </div>
  )
}
