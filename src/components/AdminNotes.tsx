import { useState } from 'react'
import { Link } from 'react-router-dom'
import Sheet from './Sheet'
import NoAccess from './NoAccess'
import { can } from '../lib/access'
import { DEFAULT_WEIGHT, gainsOf, nextStatus, relief, STATUS_LABEL, STATUS_ORDER } from '../lib/adminNotes'
import { MIN_PASS, useAdminBook } from '../lib/adminBook'
import { fmtDate, newId, todayISO } from '../lib/money'
import { useRole } from '../lib/members'
import { MEETING_TABS } from '../lib/workTabs'
import type { AdminNote, GainStatus } from '../lib/types'

const MARK: Record<GainStatus, string> = { todo: '○', part: '◐', done: '●' }

function Bar({ pct, label }: { pct: number; label: string }) {
  return <div className="nbar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}><span style={{ width: `${pct}%` }} /></div>
}

/** สมุดส่วนตัวของแอดมินต่อหนึ่งงาน: สิ่งที่แบ่งเบาให้ผู้อื่นได้ (+ แถบ %) และบันทึกอิสระ · เห็นเฉพาะแอดมิน */
export default function AdminNotes({ n, name }: { n: number; name: string }) {
  const role = useRole()
  const book = useAdminBook()
  const [form, setForm] = useState<AdminNote | 'gain' | 'note' | null>(null)
  const [msg, setMsg] = useState('')
  if (!can(role, 'settings')) return <NoAccess />
  if (book.state !== 'open') return <Gate n={n} name={name} book={book} />
  const gains = gainsOf(book.list, n)
  const r = relief(gains)
  const notes = book.list.filter((x) => !x.deleted && x.work === n && x.kind === 'note').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.updated - a.updated)
  const put = async (x: AdminNote) => { const ok = await book.put(x); setMsg(ok ? '' : 'ไม่มีสิทธิ์บันทึก'); return ok }
  const del = (x: AdminNote) => { if (window.confirm(`ลบ “${x.title || x.detail?.slice(0, 20) || 'รายการนี้'}” ?`)) void put({ ...x, deleted: true }) }
  const overview = MEETING_TABS.map((t) => ({ t, r: relief(gainsOf(book.list, t.n)), has: gainsOf(book.list, t.n).length > 0 })).filter((x) => x.has)
  return (
    <>
      <div className="page-head no-print"><h1>📔 สมุดส่วนตัว · {name}</h1><Link to={`/meeting/${n}`} className="mini">‹ {name}</Link></div>
      <p className="muted small" style={{ margin: '0 0 0.5rem' }}>🔒 เข้ารหัสด้วยรหัสผ่านของแอดมิน — คนอื่นอ่านไม่ได้แม้เปิดไฟล์ข้อมูลโดยตรง · จดว่าท่านแบ่งเบาอะไรให้ผู้อื่นได้บ้าง <button type="button" className="mini" onClick={book.lock}>🔒 ล็อกสมุด</button></p>
      {msg && <p className="error" role="alert">{msg}</p>}

      <section className="card" aria-label="สรุปที่แบ่งเบา">
        <div className="mcard__head"><b>แบ่งเบาให้ผู้อื่นแล้ว</b><span className="mcard__n" aria-label={`แบ่งเบาแล้ว ${r.pct} เปอร์เซ็นต์`}>{r.pct}%</span></div>
        <Bar pct={r.pct} label={`แบ่งเบาให้ผู้อื่นแล้ว ${r.pct}%`} />
        <p className="small muted" style={{ margin: '0.3rem 0 0' }}>{r.total === 0 ? 'ยังไม่มีรายการ — กด ➕ เพิ่มรายการด้านล่าง' : `แบ่งเบาแล้ว ${r.done} จาก ${r.total} รายการ`}{r.hoursAll > 0 ? ` · ประหยัดเวลาแล้ว ≈ ${r.hoursSaved} จาก ${r.hoursAll} ชม./เดือน` : ''}</p>
      </section>

      <section className="card" aria-label="สิ่งที่แบ่งเบาได้">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><b>สิ่งที่แบ่งเบา / ประโยชน์ที่ได้</b><button type="button" className="btn btn--gold" onClick={() => setForm('gain')}>➕ เพิ่มรายการ</button></div>
        <ul className="nlist" aria-label="รายการที่แบ่งเบา">
          {gains.map((g) => (
            <li key={g.id} className="nitem">
              <button type="button" className={`nitem__st nitem__st--${g.status ?? 'todo'}`} aria-label={`${g.title}: ${STATUS_LABEL[g.status ?? 'todo']} (กดเพื่อเปลี่ยนสถานะ)`} onClick={() => void put({ ...g, status: nextStatus(g.status) })}>{MARK[g.status ?? 'todo']}</button>
              <span className="nitem__t"><b>{g.title}</b>{g.detail && <small>{g.detail}</small>}<small className="muted">{STATUS_LABEL[g.status ?? 'todo']} · น้ำหนัก {g.weight ?? DEFAULT_WEIGHT}{g.hours ? ` · ${g.hours} ชม./เดือน` : ''}</small></span>
              <span className="nitem__act"><button type="button" className="mini" aria-label={`แก้ ${g.title}`} onClick={() => setForm(g)}>✏️</button><button type="button" className="mini" aria-label={`ลบ ${g.title}`} onClick={() => del(g)}>🗑️</button></span>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ margin: 0 }}>กดวงกลมหน้ารายการเพื่อเปลี่ยนสถานะ: ○ ยังไม่ → ◐ บางส่วน → ● แบ่งเบาแล้ว</p>
      </section>

      <section className="card" aria-label="บันทึกอิสระ">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><b>บันทึกอิสระ</b><button type="button" className="btn btn--ghost" onClick={() => setForm('note')}>➕ เพิ่มบันทึก</button></div>
        {notes.length === 0 ? <p className="empty" style={{ margin: 0 }}>ยังไม่มีบันทึก</p> : (
          <ul className="nlist" aria-label="บันทึกอิสระ">
            {notes.map((x) => (
              <li key={x.id} className="nitem">
                <span className="nitem__t"><small className="muted">{fmtDate(x.date ?? todayISO())}</small><span style={{ whiteSpace: 'pre-wrap' }}>{x.detail}</span></span>
                <span className="nitem__act"><button type="button" className="mini" aria-label="แก้บันทึก" onClick={() => setForm(x)}>✏️</button><button type="button" className="mini" aria-label="ลบบันทึก" onClick={() => del(x)}>🗑️</button></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {overview.length > 0 && (
        <section className="card" aria-label="ภาพรวมทุกงาน">
          <b>ภาพรวมทุกงาน (แบ่งเบาให้ผู้อื่นแล้ว)</b>
          {overview.map(({ t, r: o }) => (
            <Link key={t.n} to={`/meeting/${t.n}/admin`} className="nover">
              <span>{t.n}. {t.name}</span><Bar pct={o.pct} label={`${t.name} ${o.pct}%`} /><b>{o.pct}%</b>
            </Link>
          ))}
        </section>
      )}
      {form && <NoteForm work={n} item={form} onClose={() => setForm(null)} onSave={async (x) => { if (await put(x)) setForm(null) }} />}
    </>
  )
}

function NoteForm({ work, item, onClose, onSave }: { work: number; item: AdminNote | 'gain' | 'note'; onClose: () => void; onSave: (x: AdminNote) => void | Promise<void> }) {
  const cur = typeof item === 'string' ? null : item
  const kind = cur?.kind ?? (item as 'gain' | 'note')
  const [title, setTitle] = useState(cur?.title ?? '')
  const [detail, setDetail] = useState(cur?.detail ?? '')
  const [weight, setWeight] = useState(String(cur?.weight ?? DEFAULT_WEIGHT))
  const [hours, setHours] = useState(cur?.hours ? String(cur.hours) : '')
  const [status, setStatus] = useState<GainStatus>(cur?.status ?? 'todo')
  const [date, setDate] = useState(cur?.date ?? todayISO())
  const [msg, setMsg] = useState('')
  const save = () => {
    if (kind === 'gain' && !title.trim()) return setMsg('ใส่ชื่อรายการ')
    if (kind === 'note' && !detail.trim()) return setMsg('พิมพ์บันทึก')
    onSave({ ...(cur ?? { id: newId('an'), updated: 0, work }), work, kind, title: title.trim(), detail: detail.trim() || undefined,
      ...(kind === 'gain' ? { weight: Math.min(10, Math.max(1, Number(weight) || DEFAULT_WEIGHT)), hours: Number(hours) > 0 ? Number(hours) : undefined, status } : { date }) })
  }
  return (
    <Sheet title={kind === 'gain' ? (cur ? 'แก้รายการที่แบ่งเบา' : 'เพิ่มรายการที่แบ่งเบา') : (cur ? 'แก้บันทึก' : 'เพิ่มบันทึก')} onClose={onClose}>
      {kind === 'gain' ? (
        <>
          <div className="field"><label htmlFor="an-t">ชื่อรายการ</label><input id="an-t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ส่งเอกสารเทศบาล" /></div>
          <div className="field"><label htmlFor="an-d">รายละเอียด (เดิมใครทำ → ตอนนี้ใครทำ)</label><textarea id="an-d" className="input" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="เช่น เดิมประธานทำหนังสือและไปส่งเอง → ตอนนี้เลขาทำและไปส่งเอง" /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="an-w">น้ำหนัก (1–10 ยิ่งหนักยิ่งมาก)</label><select id="an-w" className="input" value={weight} onChange={(e) => setWeight(e.target.value)}>{Array.from({ length: 10 }, (_, i) => i + 1).map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="an-h">ชม./เดือนที่ประหยัดได้</label><input id="an-h" className="input" type="number" min={0} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="an-s">สถานะ</label><select id="an-s" className="input" value={status} onChange={(e) => setStatus(e.target.value as GainStatus)}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
        </>
      ) : (
        <>
          <div className="field"><label htmlFor="an-dt">วันที่</label><input id="an-dt" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="an-n">บันทึก</label><textarea id="an-n" className="input" rows={6} value={detail} onChange={(e) => setDetail(e.target.value)} /></div>
        </>
      )}
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row"><button type="button" className="btn btn--gold" onClick={save}>บันทึก</button><button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button></div>
    </Sheet>
  )
}

/** หน้าก่อนเปิดสมุด: ตั้งรหัสครั้งแรก หรือใส่รหัสเพื่อปลดล็อก (ทุกเครื่องของแอดมินใช้รหัสเดียวกัน) */
function Gate({ n, name, book }: { n: number; name: string; book: ReturnType<typeof useAdminBook> }) {
  const [pass, setPass] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const first = book.state === 'nopass'
  const go = async () => {
    if (first && pass !== again) return setMsg('รหัสผ่านสองช่องไม่ตรงกัน')
    setBusy(true); setMsg('')
    setMsg(await (first ? book.setup(pass) : book.unlock(pass)))
    setBusy(false)
  }
  return (
    <>
      <div className="page-head no-print"><h1>📔 สมุดส่วนตัว · {name}</h1><Link to={`/meeting/${n}`} className="mini">‹ {name}</Link></div>
      <section className="card" aria-label={first ? 'ตั้งรหัสสมุดส่วนตัว' : 'ปลดล็อกสมุดส่วนตัว'}>
        <b>{first ? '🔐 ตั้งรหัสผ่านของสมุดส่วนตัว (ครั้งแรก)' : '🔒 ใส่รหัสผ่านเพื่อเปิดสมุด'}</b>
        {first && <p className="small" style={{ margin: '0.3rem 0' }}>สมุดนี้เข้ารหัสในเครื่องก่อนส่งขึ้นที่เก็บข้อมูลกลาง มีแต่แอดมินที่รู้รหัสเท่านั้นที่อ่านได้ ทุกเครื่องที่แอดมินใช้ ใช้รหัสเดียวกัน<br /><b>⚠️ ถ้าลืมรหัส กู้ข้อมูลในสมุดคืนไม่ได้ ไม่มีใครช่วยได้ — จดรหัสเก็บไว้ในที่ปลอดภัย</b></p>}
        <div className="field"><label htmlFor="vp">รหัสผ่าน{first ? ` (ยาวอย่างน้อย ${MIN_PASS} ตัว)` : ''}</label><input id="vp" className="input" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !first && go()} /></div>
        {first && <div className="field"><label htmlFor="vp2">พิมพ์รหัสผ่านอีกครั้ง</label><input id="vp2" className="input" type="password" autoComplete="off" value={again} onChange={(e) => setAgain(e.target.value)} /></div>}
        {msg && <p className="error" role="alert">{msg}</p>}
        <button type="button" className="btn btn--gold" disabled={busy || !pass} onClick={go}>{first ? 'ตั้งรหัสและเปิดสมุด' : 'ปลดล็อก'}</button>
        {first && <p className="small muted" style={{ margin: '0.4rem 0 0' }}>ข้อมูลที่เคยจดไว้ก่อนตั้งรหัส จะถูกเข้ารหัสให้ทันที (แต่ฉบับเก่าที่ยังไม่เข้ารหัสอาจยังค้างในประวัติของที่เก็บข้อมูล)</p>}
      </section>
    </>
  )
}
