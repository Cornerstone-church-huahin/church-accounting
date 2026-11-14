import { useMemo, useRef, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import MultiPick from './MultiPick'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import { LIGHT } from '../lib/lightBox'
import { getMe } from '../lib/access'
import { useChurchMembers, useSchoolCfg, useSchoolDays, useSchoolTeachers, useSettings } from '../lib/data'
import { isLive } from '../lib/pastoral'
import { usePeople, type People } from '../lib/usePeople'
import { useRole } from '../lib/members'
import { addDays, be, monthName, newId, todayISO } from '../lib/money'
import { dutyFor, itemsFromTpl, schoolWeekDays, sortedItems, weekSummary, withDuty } from '../lib/schoolTimetable'
import { DAY_NAMES, sundayOf } from '../lib/visits'
import type { SchoolCfg, SchoolDay, SchoolItem, SchoolTpl } from '../lib/types'

type Step = 'plan' | 'record' | 'report'
const STEPS: { id: Step; icon: string; label: string }[] = [{ id: 'plan', icon: '📅', label: 'วางแผน' }, { id: 'record', icon: '📝', label: 'บันทึก' }, { id: 'report', icon: '📊', label: 'รายงาน' }]
const NAVY = '#1a2b4c'
const dow = (iso: string) => DAY_NAMES[new Date(iso + 'T00:00:00Z').getUTCDay()]
const dm = (iso: string) => `${Number(iso.slice(8))}/${iso.slice(5, 7)}/${String(be(Number(iso.slice(0, 4)))).slice(2)}`
const hhmm = (at: number) => new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
const nextSunday = () => { const t = todayISO(), s = sundayOf(t); return s === t ? t : addDays(s, 7) }

/** ชิปชื่อพร้อมรูป */
function Chips({ names, people, empty = '—' }: { names: string[]; people: People; empty?: string }) {
  if (!names.length) return <span className="muted small">{empty}</span>
  return <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{names.map((n) => { const m = people.byName.get(n); return <span key={n} className="row" style={{ gap: 4, alignItems: 'center', border: '1.5px solid #d6dbe8', borderRadius: 999, padding: '2px 10px 2px 3px' }}><MemberAvatar path={m?.photoPath} name={n} size={28} member={m} /><b className="small">{n}</b></span> })}</span>
}

/**
 * ตารางงานรวี (แท็บ 2 ของงานรวี): เน้นวันอาทิตย์ (เด็กมาเรียน ~11:00–12:30 น.) · ทีมครูหมุนเวียนทุกสัปดาห์ ·
 * งานเตรียมอังคาร–เสาร์เป็นส่วนรอง · บันทึกว่าทำแล้ว + บันทึกระหว่างวัน · รายงาน A4
 */
export default function SchoolTimetable({ canEdit }: { canEdit: boolean }) {
  const [step, setStep] = useState<Step>('plan')
  const [sunday, setSunday] = useState(nextSunday)
  const days = schoolWeekDays(sunday)
  const store = useSchoolDays()
  const cfgStore = useSchoolCfg()
  const cfg = cfgStore.cfg
  const teachers = useSchoolTeachers()
  const members = useChurchMembers()
  const live = useMemo(() => members.items.filter((m) => !m.deleted && isLive(m)), [members.items])
  const people = usePeople(live)
  const isAdmin = useRole() === 'admin'
  const me = getMe()?.name ?? ''
  const church = useSettings().settings.churchName.split(' ')[0]
  const suggest = dutyFor(cfg, sunday)
  /** วันอาทิตย์ที่ยังไม่เคยบันทึก = แสดงตามแม่แบบ + ครูที่ระบบเสนอ (บันทึกจริงเมื่อมีการแก้/ติ๊กครั้งแรก) */
  const baseOf = (d: SchoolDay): SchoolDay => (d.date === sunday && !d.duty && d.items.length === 0 ? withDuty({ ...d, items: itemsFromTpl(cfg, suggest.duty) }, suggest.duty) : d)
  const docs = days.map((d) => baseOf(store.of(d)))
  const sunDoc = docs[5]
  const duty = sunDoc.duty ?? suggest.duty
  const rest = cfg.pool.filter((x) => !duty.includes(x))
  const sum = weekSummary(docs)
  const save = (d: SchoolDay) => store.put([{ ...d, updated: 0 }])
  const [edit, setEdit] = useState<{ date: string; item: SchoolItem | null } | null>(null)
  const [sheet, setSheet] = useState<'cfg' | 'duty' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const roster = useMemo(() => [...new Set(teachers.items.filter((x) => !x.deleted).map((x) => x.name))].sort((a, b) => a.localeCompare(b)), [teachers.items])
  const range = `อาทิตย์ที่ ${Number(sunday.slice(8))} ${monthName(Number(sunday.slice(5, 7)))} ${be(Number(sunday.slice(0, 4)))}`

  const nav = (
    <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => setSunday(addDays(sunday, -7))}>‹</button>
      <span className="small"><b>{range}</b>{sum.items ? ` · ${sum.items} รายการ${sum.done ? ` · ทำแล้ว ${sum.done}` : ''}` : ''}</span>
      <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => setSunday(addDays(sunday, 7))}>›</button>
    </div>
  )
  const team = (
    <div className="card" style={{ ...LIGHT, background: '#f3f7ff', border: '2px solid #1a56db' }}>
      <div className="row row--between"><b>👥 ทีมครูวันอาทิตย์นี้</b>{canEdit && <span className="row" style={{ gap: 6 }}><button type="button" className="mini" onClick={() => setSheet('duty')}>✎ แก้ทีมสัปดาห์นี้</button><button type="button" className="mini" onClick={() => setSheet('cfg')}>⚙ ตั้งค่า</button></span>}</div>
      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        <div><small className="muted">👑 ผู้ดูแลงานรวี (ฝ่ายธรรมกิจ)</small><br /><Chips names={cfg.overseers ?? []} people={people} empty="ยังไม่ตั้ง — กด ⚙ ตั้งค่า (ต้องมีอย่างน้อย 1 คน)" /></div>
        <div><small className="muted">อาจารย์ฝ่ายอภิบาล (ประจำ)</small><br /><Chips names={cfg.lead} people={people} empty="ยังไม่ตั้ง — กด ⚙ ตั้งค่า" /></div>
        <div><small className="muted">ครูพี่เลี้ยงประจำ (เต้น · อยู่ร่วมกัน · กิจกรรม)</small><br /><Chips names={cfg.helpers} people={people} empty="ยังไม่ตั้ง" /></div>
        <div><small className="muted">ครูหมุนเวียนที่ลงสอนสัปดาห์นี้{sunDoc.duty ? '' : ' (ระบบเสนอตามลำดับหมุน)'}</small><br /><Chips names={duty} people={people} empty="ยังไม่ตั้งรายชื่อครูหมุนเวียน" /></div>
        {rest.length > 0 && <div><small className="muted">ได้ไปนมัสการสัปดาห์นี้</small><br /><Chips names={rest} people={people} /></div>}
      </div>
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
          {team}
          <div className="card" style={{ ...LIGHT, background: '#fff', marginTop: 8, border: '2px solid #d4af37' }}>
            <div className="row row--between"><b>⛪ วันอาทิตย์ {dm(sunday)} · เด็กรวี เริ่ม ~11:00 น.</b>{canEdit && <button type="button" className="mini" onClick={() => setEdit({ date: sunday, item: null })}>＋ เพิ่มรายการ</button>}</div>
            {sunDoc.items.length === 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>ยังไม่มีรายการ</p>}
            {sortedItems(sunDoc.items).map((it) => (
              <div key={it.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '6px 0', borderTop: '1px solid #eee' }}>
                <span style={{ flex: 1, minWidth: 0 }}>{it.time && <b>{it.time} </b>}{it.title}<br /><Chips names={it.teachers} people={people} empty="ยังไม่กำหนดครู" /></span>
                {canEdit && <><button type="button" className="mini" aria-label={`แก้ ${it.title}`} onClick={() => setEdit({ date: sunday, item: it })}>✎</button>
                  <button type="button" className="mini" aria-label={`ลบ ${it.title}`} onClick={() => { if (confirm(`ลบ “${it.title}” ?`)) save({ ...sunDoc, items: sunDoc.items.filter((x) => x.id !== it.id) }) }}>🗑</button></>}
              </div>))}
          </div>
          <details style={{ marginTop: 8 }}><summary className="small"><b>🛠 งานเตรียมระหว่างสัปดาห์ (อังคาร–เสาร์)</b> · {docs.slice(0, 5).reduce((n, d) => n + d.items.length, 0)} รายการ</summary>
            {days.slice(0, 5).map((d, i) => (
              <div key={d} className="card" style={{ ...LIGHT, background: '#fff', marginTop: 6 }}>
                <div className="row row--between"><b>{dow(d)} {dm(d)}</b>{canEdit && <button type="button" className="mini" onClick={() => setEdit({ date: d, item: null })}>＋ เพิ่มรายการ</button>}</div>
                {docs[i].items.length === 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>ยังไม่มีรายการ</p>}
                {sortedItems(docs[i].items).map((it) => (
                  <div key={it.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '5px 0', borderTop: '1px solid #eee' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{it.time && <b>{it.time} </b>}{it.title}<br /><Chips names={it.teachers} people={people} empty="ยังไม่กำหนดครู" /></span>
                    {canEdit && <><button type="button" className="mini" aria-label={`แก้ ${it.title}`} onClick={() => setEdit({ date: d, item: it })}>✎</button>
                      <button type="button" className="mini" aria-label={`ลบ ${it.title}`} onClick={() => { if (confirm(`ลบ “${it.title}” ?`)) save({ ...docs[i], items: docs[i].items.filter((x) => x.id !== it.id) }) }}>🗑</button></>}
                  </div>))}
              </div>))}
          </details>
        </>
      )}

      {step === 'record' && (
        <>
          <DayRecord key={sunday} date={sunday} doc={sunDoc} canEdit={canEdit} isAdmin={isAdmin} me={me} today={sunday === todayISO()} sunday onSave={save} />
          <details style={{ marginTop: 8 }}><summary className="small"><b>🛠 งานเตรียมระหว่างสัปดาห์ (อังคาร–เสาร์)</b></summary>
            {days.slice(0, 5).map((d, i) => <DayRecord key={d} date={d} doc={docs[i]} canEdit={canEdit} isAdmin={isAdmin} me={me} today={d === todayISO()} onSave={save} />)}
          </details>
        </>
      )}

      {step === 'report' && (
        <>
          <PdfTools compact mode="full" els={() => (ref.current ? [ref.current] : [])} file={`ตารางงานรวี-${sunday}.pdf`} title={`ตารางงานรวี ${range}`} label="ตารางงานรวี" />
          <ScaledPage ref={ref}>
            <div style={{ color: '#111', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', background: `linear-gradient(100deg, ${NAVY}, #274a8a 55%, #1a3566)`, color: '#fff', borderRadius: 10, padding: '10px 8px', borderBottom: '6px solid #d4af37' }}>
                <div style={{ fontSize: 15 }}>{church} · ✝ งานรวี</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>ตารางงานรวี</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#ffd978' }}>{range}</div>
                <div style={{ fontSize: 14 }}>ทำแล้ว {sum.done}/{sum.items} รายการ</div>
              </div>
              <div style={{ border: '1.5px solid #a8924a', borderRadius: 8, padding: 8, marginTop: 8, fontSize: 14 }}>
                <div><b>ผู้ดูแลงานรวี:</b> {(cfg.overseers ?? []).join(', ') || '—'}</div>
                <div><b>อาจารย์:</b> {cfg.lead.join(', ') || '—'} &nbsp;|&nbsp; <b>พี่เลี้ยง:</b> {cfg.helpers.join(', ') || '—'}</div>
                <div><b>ครูลงสอนสัปดาห์นี้:</b> {duty.join(', ') || '—'}{rest.length ? <> &nbsp;|&nbsp; <b>ได้นมัสการ:</b> {rest.join(', ')}</> : null}</div>
              </div>
              <div style={{ fontWeight: 800, color: NAVY, margin: '8px 0 2px' }}>⛪ วันอาทิตย์ {dm(sunday)}</div>
              <ReportTable rows={[[sunday, sunDoc]]} />
              {docs.slice(0, 5).some((d) => d.items.length || d.logs.length) && <>
                <div style={{ fontWeight: 800, color: NAVY, margin: '8px 0 2px' }}>🛠 งานเตรียมระหว่างสัปดาห์</div>
                <ReportTable rows={days.slice(0, 5).map((d, i): [string, SchoolDay] => [d, docs[i]]).filter(([, d]) => d.items.length || d.logs.length)} />
              </>}
            </div>
          </ScaledPage>
        </>
      )}

      {edit && <ItemSheet date={edit.date} item={edit.item} roster={roster} people={people} canManageRoster={canEdit}
        onAddTeacher={(n) => { if (!teachers.items.some((x) => !x.deleted && x.name === n)) teachers.put([{ id: newId('tc'), name: n, updated: 0 }]) }}
        onDropTeacher={(n) => { for (const x of teachers.items.filter((y) => y.name === n)) teachers.remove(x.id) }}
        onClose={() => setEdit(null)}
        onSave={(it) => { const doc = baseOf(store.of(edit.date)); save({ ...doc, items: edit.item ? doc.items.map((x) => (x.id === it.id ? { ...x, ...it } : x)) : [...doc.items, it] }); setEdit(null) }} />}
      {sheet === 'duty' && <DutySheet people={people} pool={cfg.pool} value={duty} onClose={() => setSheet(null)} onSave={(v) => { save(withDuty(sunDoc, v)); setSheet(null) }} />}
      {sheet === 'cfg' && <CfgSheet cfg={cfg} sunday={sunday} people={people} onClose={() => setSheet(null)} onSave={(c) => { cfgStore.put([{ ...c, id: 'cfg', updated: 0 }]); setSheet(null) }} />}
    </section>
  )
}

/** ตารางรายงาน: วัน · รายการ · ครู · บันทึก */
function ReportTable({ rows }: { rows: [string, SchoolDay][] }) {
  const th = { border: '1.5px solid #a8924a', background: '#eef1f6', color: NAVY, padding: 4 } as const
  const td = { border: '1.5px solid #a8924a', padding: 4, verticalAlign: 'top' } as const
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 14 }}>
      <colgroup><col style={{ width: '14%' }} /><col style={{ width: '38%' }} /><col style={{ width: '22%' }} /><col style={{ width: '26%' }} /></colgroup>
      <thead><tr>{['วัน', 'รายการ', 'ครูผู้รับผิดชอบ', 'บันทึก'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map(([d, doc]) => { const its = sortedItems(doc.items); return (
          <tr key={d} style={{ breakInside: 'avoid' }}>
            <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: '#a4262c' }}>{dow(d)}<br /><small>{dm(d)}</small></td>
            <td style={td}>{its.length ? its.map((it, j) => <div key={it.id}>{j + 1}. {it.time && <b>{it.time} </b>}{it.title}{it.done ? ' ✓' : ''}{it.note ? <small style={{ color: '#555' }}> — {it.note}</small> : null}</div>) : <span style={{ color: '#999' }}>—</span>}</td>
            <td style={td}>{its.map((it) => <div key={it.id}>{it.teachers.join(', ') || '—'}</div>)}</td>
            <td style={{ ...td, fontSize: 12 }}>{doc.logs.length ? [...doc.logs].sort((a, b) => a.at - b.at).map((l) => <div key={l.id}><b>{hhmm(l.at)}</b> {l.text}{l.by ? ` (${l.by})` : ''}</div>) : <span style={{ color: '#999' }}>—</span>}</td>
          </tr>) })}
      </tbody>
    </table>
  )
}

/** แก้ครูหมุนเวียนที่ลงสอนสัปดาห์นี้ (กรณีมีคนติดธุระ/แทนกัน) */
function DutySheet({ people, pool, value, onClose, onSave }: { people: People; pool: string[]; value: string[]; onClose: () => void; onSave: (v: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>(value)
  return (
    <Sheet title="✎ ครูที่ลงสอนสัปดาห์นี้" onClose={onClose}>
      <p className="muted small" style={{ margin: 0 }}>เปลี่ยนได้ถ้ามีคนติดธุระหรือแทนกัน — รายการที่เป็นหน้าที่ “ครูหมุนเวียน” จะเปลี่ยนตาม (ค้นจากทะเบียนได้)</p>
      <div className="field"><label htmlFor="du-by">👩‍🏫 ครูลงสอน</label>
        <MultiPick id="du-by" title="ครูที่ลงสอน" options={[...new Set([...pool, ...picked])].map(people.optOf)} value={picked} onChange={setPicked} empty="— เลือกครู —" search={{ find: people.find, placeholder: '🔎 ชื่อจริง / นามสกุล / ชื่อเล่น / ญาติ' }} /></div>
      <button type="button" className="btn btn--gold btn--block" onClick={() => onSave(picked)}>✓ บันทึกทีมสัปดาห์นี้</button>
    </Sheet>
  )
}

/** ตั้งค่า: อาจารย์ · พี่เลี้ยง · ครูหมุนเวียน + จำนวนลงสอนต่อสัปดาห์ + แม่แบบรายการวันอาทิตย์ */
function CfgSheet({ cfg, sunday, people, onClose, onSave }: { cfg: SchoolCfg; sunday: string; people: People; onClose: () => void; onSave: (c: SchoolCfg) => void }) {
  const [over, setOver] = useState(cfg.overseers ?? [])
  const [err, setErr] = useState('')
  const [lead, setLead] = useState(cfg.lead)
  const [helpers, setHelpers] = useState(cfg.helpers)
  const [pool, setPool] = useState(cfg.pool)
  const [per, setPer] = useState(String(cfg.perWeek))
  const [anchor, setAnchor] = useState(cfg.anchor || sunday)
  const [tpl, setTpl] = useState<SchoolTpl[]>(cfg.tpl)
  const pick = (id: string, title: string, v: string[], set: (x: string[]) => void) => (
    <MultiPick id={id} title={title} options={[...new Set(v)].map(people.optOf)} value={v} onChange={set} empty="— เลือก —" search={{ find: people.find, placeholder: '🔎 ชื่อจริง / นามสกุล / ชื่อเล่น / ญาติ' }} />)
  const k = Math.max(1, Math.min(pool.length || 1, Number(per) || 1))
  const preview = [0, 1, 2, 3].map((i) => { const d = addDays(anchor || sunday, i * 7); return `${dm(d)}: ${dutyFor({ pool, perWeek: k, anchor: anchor || sunday }, d).duty.join(', ') || '—'}` })
  const move = (i: number, d: number) => setTpl((xs) => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c })
  return (
    <Sheet title="⚙ ตั้งค่างานรวีวันอาทิตย์" onClose={onClose}>
      <div className="field"><label htmlFor="cf-over">👑 ผู้ดูแลงานรวี (ฝ่ายธรรมกิจ) — อย่างน้อย 1 คน · ควบคุมดูแลและตรวจสอบได้ทั้งหมด</label>{pick('cf-over', 'ผู้ดูแลงานรวี (ธรรมกิจ)', over, setOver)}</div>
      <div className="field"><label htmlFor="cf-lead">🎓 อาจารย์ฝ่ายอภิบาล (ประจำทุกสัปดาห์)</label>{pick('cf-lead', 'อาจารย์ฝ่ายอภิบาล', lead, setLead)}</div>
      <div className="field"><label htmlFor="cf-help">🤝 ครูพี่เลี้ยงประจำ (เต้น · อยู่ร่วมกัน · กิจกรรม)</label>{pick('cf-help', 'ครูพี่เลี้ยง', helpers, setHelpers)}</div>
      <div className="field"><label htmlFor="cf-pool">🔄 ครูหมุนเวียน (ลำดับที่เลือก = ลำดับการหมุน)</label>{pick('cf-pool', 'ครูหมุนเวียน', pool, setPool)}</div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field grow"><label htmlFor="cf-per">ลงสอนสัปดาห์ละกี่คน</label><input id="cf-per" className="input" inputMode="numeric" value={per} onChange={(e) => setPer(e.target.value.replace(/\D/g, ''))} /></div>
        <div className="field grow"><label htmlFor="cf-anc">เริ่มหมุนกลุ่มแรกวันอาทิตย์ที่</label><input id="cf-anc" type="date" className="input" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} /></div>
      </div>
      {pool.length > 0 && <div className="small muted" role="note">ตัวอย่าง 4 สัปดาห์ถัดไป:<br />{preview.map((p) => <div key={p}>{p}</div>)}</div>}
      <div className="field"><label>📋 แม่แบบรายการวันอาทิตย์ (ใช้ทุกสัปดาห์ · เวลาเป็นค่าประมาณ)</label>
        {tpl.map((t, i) => (
          <div key={t.id} style={{ border: '1.5px solid #d6dbe8', borderRadius: 10, padding: 6, marginBottom: 6 }}>
            <div className="row" style={{ gap: 6 }}>
              <input className="input" style={{ width: '6rem' }} aria-label={`เวลา ${i + 1}`} value={t.time} onChange={(e) => setTpl(tpl.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} placeholder="11:00" />
              <input className="input grow" aria-label={`รายการ ${i + 1}`} value={t.title} onChange={(e) => setTpl(tpl.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="ชื่อรายการ" />
            </div>
            <div className="row" style={{ gap: 6, marginTop: 4, alignItems: 'center' }}>
              <select className="input grow" aria-label={`ผู้รับผิดชอบ ${i + 1}`} value={t.role} onChange={(e) => setTpl(tpl.map((x, j) => (j === i ? { ...x, role: e.target.value as SchoolTpl['role'] } : x)))}>
                <option value="lead">อาจารย์ฝ่ายอภิบาล</option><option value="helpers">ครูพี่เลี้ยงประจำ</option><option value="duty">ครูหมุนเวียนที่ลงสอน</option><option value="none">ไม่กำหนด</option>
              </select>
              <button type="button" className="mini" aria-label="เลื่อนขึ้น" onClick={() => move(i, -1)}>▲</button>
              <button type="button" className="mini" aria-label="เลื่อนลง" onClick={() => move(i, 1)}>▼</button>
              <button type="button" className="mini" aria-label="ลบรายการแม่แบบ" onClick={() => setTpl(tpl.filter((_, j) => j !== i))}>✕</button>
            </div>
          </div>))}
        <button type="button" className="btn" onClick={() => setTpl([...tpl, { id: newId('tp'), time: '', title: '', role: 'none' }])}>＋ เพิ่มรายการแม่แบบ</button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>แม่แบบใช้กับวันอาทิตย์ที่ยังไม่เคยบันทึก — สัปดาห์ที่บันทึกไปแล้วไม่เปลี่ยน</p>
      {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button type="button" className="btn btn--gold btn--block" onClick={() => { if (!over.length) return setErr('ต้องเลือกผู้ดูแลงานรวี (ฝ่ายธรรมกิจ) อย่างน้อย 1 คน'); onSave({ ...cfg, overseers: over, lead, helpers, pool, perWeek: k, anchor: anchor || sunday, tpl: tpl.filter((t) => t.title.trim()).map((t) => ({ ...t, title: t.title.trim(), time: t.time.trim() })) }) }}>✓ บันทึกการตั้งค่า</button>
    </Sheet>
  )
}

/** ฟอร์มเพิ่ม/แก้รายการสอนหรืองาน: เวลา · ชั้น/วิชา/งาน · ครูผู้รับผิดชอบ (เลือกหลายคน เพิ่มชื่อใหม่ได้) */
function ItemSheet({ date, item, roster, people, canManageRoster, onAddTeacher, onDropTeacher, onClose, onSave }: { date: string; item: SchoolItem | null; roster: string[]; people: People; canManageRoster: boolean; onAddTeacher: (n: string) => void; onDropTeacher: (n: string) => void; onClose: () => void; onSave: (it: SchoolItem) => void }) {
  const [time, setTime] = useState(item?.time ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [picked, setPicked] = useState<string[]>(item?.teachers ?? [])
  const [err, setErr] = useState('')
  const go = () => { if (!title.trim()) return setErr('ใส่ชื่อรายการ เช่น ชั้นเด็กเล็ก · เตรียมสื่อการสอน'); onSave({ ...(item ?? {}), id: item?.id ?? newId('sc'), time: time.trim(), title: title.trim(), teachers: picked }) }
  return (
    <Sheet title={`${item ? '✎ แก้' : '＋ เพิ่ม'}รายการ · ${dow(date)} ${dm(date)}`} onClose={onClose}>
      <div className="field"><label htmlFor="sc-time">เวลา (ไม่บังคับ)</label><input id="sc-time" className="input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="เช่น 09:00-10:00" /></div>
      <div className="field"><label htmlFor="sc-title">รายการ / ชั้น / วิชา / งาน</label><input id="sc-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ชั้นเด็กเล็ก · ประชุมครู · เตรียมสื่อ" /></div>
      <div className="field"><label htmlFor="sc-by">👩‍🏫 ครูผู้รับผิดชอบ (เลือกได้หลายคน)</label>
        <MultiPick id="sc-by" title="ครูผู้รับผิดชอบ" options={[...new Set([...roster, ...picked])].map(people.optOf)} value={picked} onChange={setPicked} empty="— เลือกครู (พิมพ์ค้นหาจากทะเบียน) —" search={{ find: people.find, placeholder: '🔎 ชื่อจริง / นามสกุล / ชื่อเล่น / ญาติ — พิมพ์ได้บางส่วน' }}
          {...(canManageRoster ? { onAdd: (n: string) => { const v = n.trim().replace(/,/g, ' '); if (!v) return; onAddTeacher(v); setPicked((xs) => (xs.includes(v) ? xs : [...xs, v])) }, onRemove: (n: string) => { onDropTeacher(n); setPicked((xs) => xs.filter((x) => x !== n)) }, addHint: 'พิมพ์ชื่อครูใหม่ แล้วกด เพิ่ม (เก็บไว้เลือกได้ทุกครั้ง)' } : {})} /></div>
      {picked.length > 0 && <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} aria-label="ครูที่เลือกแล้ว">
        {picked.map((n) => { const m = people.byName.get(n); return (
          <span key={n} className="row" style={{ gap: 6, alignItems: 'center', border: '1.5px solid #d6dbe8', borderRadius: 999, padding: '3px 10px 3px 4px' }}>
            <MemberAvatar path={m?.photoPath} name={n} size={36} member={m} /><b>{n}</b>
            <button type="button" className="mini" aria-label={`เอา ${n} ออก`} onClick={() => setPicked((xs) => xs.filter((x) => x !== n))}>✕</button>
          </span>) })}
      </div>}
      {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button type="button" className="btn btn--gold btn--block" onClick={go}>✓ บันทึก</button>
    </Sheet>
  )
}

/** บันทึกของหนึ่งวัน: ติ๊ก “ทำแล้ว” + หมายเหตุรายการ · บันทึกระหว่างวันว่าทำอะไรบ้าง (หลายครั้งได้) */
function DayRecord({ date, doc, canEdit, isAdmin, me, today, sunday, onSave }: { sunday?: boolean; date: string; doc: SchoolDay; canEdit: boolean; isAdmin: boolean; me: string; today: boolean; onSave: (d: SchoolDay) => void }) {
  const [text, setText] = useState('')
  const its = sortedItems(doc.items)
  const setItem = (id: string, patch: Partial<SchoolItem>) => onSave({ ...doc, items: doc.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const addLog = () => { const t = text.trim(); if (!t) return; onSave({ ...doc, logs: [...doc.logs, { id: newId('lg'), at: Date.now(), by: me, text: t }] }); setText('') }
  return (
    <div className="card" style={{ ...LIGHT, background: today ? '#f3fbf8' : '#fff', border: today ? '2px solid #1e8e3e' : sunday ? '2px solid #d4af37' : undefined, marginTop: 8 }}>
      <b>{sunday ? '⛪ ' : ''}{dow(date)} {dm(date)}{sunday ? ' · เด็กรวี' : ''}{today ? ' · วันนี้' : ''}</b>
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
