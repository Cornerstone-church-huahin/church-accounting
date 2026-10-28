import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LetterheadSetup from '../components/LetterheadSetup'
import Step1 from '../components/meeting/Step1'
import Step2 from '../components/meeting/Step2'
import Step3 from '../components/meeting/Step3'
import Step4 from '../components/meeting/Step4'
import Step5 from '../components/meeting/Step5'
import Step6 from '../components/meeting/Step6'
import Step7 from '../components/meeting/Step7'
import Step8 from '../components/meeting/Step8'
import Step9 from '../components/meeting/Step9'
import Step10 from '../components/meeting/Step10'
import { can } from '../lib/access'
import { useLetterhead, useMeetings } from '../lib/data'
import { blankMeeting, letterDate, nextNo, stepStatuses, type StepState } from '../lib/meetings'
import { CENTER_SUB, CENTER_TITLE, MEETING_STEPS, stepOf } from '../lib/meetingCenter'
import { useRole } from '../lib/members'
import { todayISO, yearOf } from '../lib/money'
import type { Meeting } from '../lib/types'

const BASE = '/meeting/1/1'
const HUB = `${BASE}/meeting`
const CUR_KEY = 'acct.mc.cur'
const MARK: Record<StepState, string> = { done: '✓', partial: '•', todo: '' }

/** การประชุมที่กำลังจัดการ (จำไว้ในเครื่อง) + บันทึกแก้ไขทับข้อมูลล่าสุดเสมอ */
function useCurrentMeeting() {
  const ms = useMeetings()
  const [curId, setCurId] = useState(() => { try { return localStorage.getItem(CUR_KEY) ?? '' } catch { return '' } })
  const cur = ms.list.find((x) => x.id === curId) ?? ms.list[0]
  const latest = useRef<Meeting | undefined>(cur)
  latest.current = cur
  const [denied, setDenied] = useState(false)
  const select = (id: string) => { setCurId(id); try { localStorage.setItem(CUR_KEY, id) } catch { /* ignore */ } }
  const save = (patch: Partial<Meeting>) => {
    if (!latest.current) return
    const next = { ...latest.current, ...patch }
    latest.current = next
    setDenied(!ms.put([next]))
  }
  const create = () => {
    const y = yearOf(todayISO())
    const m = blankMeeting(y, nextNo(ms.list, y))
    if (!ms.put([m])) { setDenied(true); return }
    setDenied(false); select(m.id)
  }
  const remove = (id: string) => { if (!ms.remove(id)) setDenied(true) }
  return { ...ms, cur, select, save, create, remove, denied }
}

/**
 * ศูนย์จัดการประชุม (งานเลขา › การประชุม): เมนู 10 ขั้นตามลำดับงานเลขานุการ → ทำงานจริงในแต่ละขั้น → แถบเช็คด้านล่างแสดงความพร้อมของแต่ละขั้น
 * การประชุมแต่ละครั้งเก็บเป็นรายการเดียว (meetings.json) ใช้ข้อมูลร่วมกันทุกขั้นและทุกเอกสาร (หัวจดหมาย A4)
 */
export default function MeetingCenter({ step }: { step?: number }) {
  const c = useCurrentMeeting()
  const role = useRole()
  const status = c.cur ? stepStatuses(c.cur, c.list) : undefined
  return (
    <div className={`mcenter${c.cur ? ' mcenter--bar' : ''}`}>
      {step === undefined ? <Hub c={c} canSetup={can(role, 'settings')} /> : <Step n={step} c={c} />}
      {c.cur && status && <StatusBar m={c.cur} status={status} step={step} />}
    </div>
  )
}
type Cur = ReturnType<typeof useCurrentMeeting>

function Hub({ c, canSetup }: { c: Cur; canSetup: boolean }) {
  const [setup, setSetup] = useState(false)
  const lh = useLetterhead().value
  const navigate = useNavigate()
  const meetings = [...c.list].sort((x, y) => y.year - x.year || y.no - x.no)
  return (
    <>
      <div className="page-head no-print"><h1>{CENTER_TITLE}</h1><Link to={BASE} className="mini">‹ ลำดับงาน</Link></div>
      <p className="muted" style={{ margin: '0 0 0.7rem' }}>{CENTER_SUB}</p>
      {c.denied && <p className="error" role="alert">ไม่มีสิทธิ์บันทึกข้อมูลการประชุม</p>}
      <section className="card" aria-label="จัดการการประชุม">
        <div className="row">
          <button type="button" className="btn btn--gold" onClick={() => { c.create(); navigate(`${BASE}/1`) }}>＋ สร้างการประชุมใหม่</button>
          {canSetup && <button type="button" className="mini" onClick={() => setSetup(true)}>⚙️ ตั้งค่าหัวจดหมาย{lh?.header ? ' ✓' : ''}</button>}
        </div>
        {!lh?.header && <p className="muted small" style={{ margin: '0.4rem 0 0' }}>เอกสารยังใช้หัวแบบข้อความ — แอดมินตั้งหัว-ท้ายจดหมายจริงของคริสตจักรได้ที่ปุ่ม “ตั้งค่าหัวจดหมาย”</p>}
      </section>
      {c.list.length === 0 && <p className="empty">ยังไม่มีการประชุม — กด “＋ สร้างการประชุมใหม่” เพื่อเริ่มขั้นที่ 1</p>}
      {meetings.map((m) => {
        const st = stepStatuses(m, c.list)
        const done = MEETING_STEPS.filter((s) => st[s.n].state === 'done').length
        const label = `ครั้งที่ ${m.no}/${m.year} · ${m.name || 'ยังไม่ตั้งชื่อ'}`
        return (
          <section key={m.id} className="card mcard" aria-label={`การประชุม ${label}`}>
            <div className="mcard__head">
              <div><b>{label}</b><div className="small muted">{letterDate(m.date) || 'ยังไม่กำหนดวัน'}{m.place ? ` · ${m.place}` : ''}</div></div>
              <span className="mcard__n" aria-label={`ทำแล้ว ${done} จาก 10 ขั้น`}>{done}/10</span>
            </div>
            <ol className="mcheck" aria-label={`เช็คลิสต์ ${label}`}>
              {MEETING_STEPS.map((s) => (
                <li key={s.n}>
                  <Link to={`${BASE}/${s.n}`} onClick={() => c.select(m.id)} className={`mcheck__row mcheck__row--${st[s.n].state}`}>
                    <span className="mcheck__box" aria-hidden="true">{MARK[st[s.n].state]}</span>
                    <span className="mcheck__t"><b>{s.n}. {s.title}</b><small>{st[s.n].hint}</small></span>
                    <span aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ol>
            <div className="row" style={{ marginTop: '0.4rem' }}>
              {st[10].state === 'done' && <Link to="/meeting/1/3" state={{ importMeeting: { title: `รายงานการประชุม${m.name ? ` ${m.name}` : ''} ครั้งที่ ${m.no}/${m.year}`, date: m.date || '', note: `ฉบับสมบูรณ์ที่ลงนามแล้ว · ${m.name} ครั้งที่ ${m.no}/${m.year}` } }} className="btn btn--gold">📚 นำเข้าคลังเอกสาร ›</Link>}
              <button type="button" className="mini" onClick={() => { if (window.confirm(`ลบการประชุม “${m.name || `ครั้งที่ ${m.no}/${m.year}`}” ?`)) c.remove(m.id) }}>🗑️ ลบการประชุมนี้</button>
            </div>
          </section>
        )
      })}
      {setup && <LetterheadSetup onClose={() => setSetup(false)} />}
    </>
  )
}

function Step({ n, c }: { n: number; c: Cur }) {
  const s = stepOf(n)
  if (!s) return <><div className="page-head no-print"><h1>{CENTER_TITLE}</h1><Link to={BASE} className="mini">‹ ลำดับงาน</Link></div><p className="empty">ไม่พบขั้นตอนนี้</p><Link to={HUB} className="btn">กลับศูนย์จัดการประชุม</Link></>
  const prev = stepOf(n - 1), next = stepOf(n + 1)
  const working = n >= 1 && n <= 10
  const props = c.cur ? { m: c.cur, save: c.save, list: c.list } : undefined
  return (
    <>
      <div className="page-head no-print">
        <h1>{s.n}. {s.title}</h1>
        <Link to={HUB} className="mini">‹ กลับศูนย์จัดการประชุม</Link>
      </div>
      <p className="mc__blurb"><span aria-hidden="true">{s.icon}</span> {s.blurb}</p>
      {c.denied && <p className="error" role="alert">ไม่มีสิทธิ์บันทึกข้อมูลการประชุม</p>}
      {working && !props && (
        <section className="card"><p className="empty">ยังไม่มีการประชุม — สร้างการประชุมก่อนเพื่อเริ่มทำงานในขั้นนี้</p><button type="button" className="btn btn--gold" onClick={c.create}>＋ สร้างการประชุมใหม่</button></section>
      )}
      {working && props && (n === 1 ? <Step1 {...props} /> : n === 2 ? <Step2 {...props} /> : n === 3 ? <Step3 {...props} /> : n === 4 ? <Step4 {...props} /> : n === 5 ? <Step5 {...props} /> : n === 6 ? <Step6 {...props} /> : n === 7 ? <Step7 {...props} /> : n === 8 ? <Step8 {...props} /> : n === 9 ? <Step9 {...props} /> : <Step10 {...props} />)}
      <details className="mc__guide" open={!working}>
        <summary>{working ? 'คำอธิบายขั้นตอนนี้' : 'หัวข้อและคำอธิบายของขั้นตอนนี้'}</summary>
        <ol className="mc__items" aria-label={`หัวข้อของ ${s.title}`}>
          {s.items.map((it) => (
            <li key={it.no} className="card">
              <span className="mc__no">{it.no}</span>
              <div><b>{it.title}</b><p>{it.desc}</p></div>
            </li>
          ))}
        </ol>
        {s.note && <p className="mc__note" role="note">หมายเหตุ: {s.note}</p>}
      </details>
      <nav className="mc__nav no-print" aria-label="เปลี่ยนขั้นตอน">
        {prev ? <Link to={`${BASE}/${prev.n}`} className="mc__step"><small>‹ ขั้นตอนก่อนหน้า</small><b>{prev.n}. {prev.title}</b></Link> : <span />}
        {next ? <Link to={`${BASE}/${next.n}`} className="mc__step mc__step--next"><small>ขั้นตอนถัดไป ›</small><b>{next.n}. {next.title}</b></Link> : <span />}
      </nav>
      <p style={{ textAlign: 'center', margin: '0.6rem 0' }}><Link to={HUB} className="btn">กลับศูนย์จัดการประชุม</Link></p>
    </>
  )
}

/** แถบเช็คด้านล่าง: ✓ = ข้อมูลของขั้นนั้นครบพร้อมเข้าสู่ขั้นถัดไป · • = กรอกบางส่วน · แตะเพื่อไปขั้นนั้น */
function StatusBar({ m, status, step }: { m: Meeting; status: ReturnType<typeof stepStatuses>; step?: number }) {
  const cur = step ? status[step] : undefined
  return (
    <nav className="mcbar no-print" aria-label="ความพร้อมของแต่ละขั้นตอน">
      <div className="mcbar__dots">
        {MEETING_STEPS.map((s) => (
          <Link key={s.n} to={`${BASE}/${s.n}`} className={`mcbar__dot mcbar__dot--${status[s.n].state}${step === s.n ? ' mcbar__dot--cur' : ''}`} aria-label={`ขั้นที่ ${s.n} ${s.title}: ${status[s.n].hint}`} aria-current={step === s.n ? 'step' : undefined} title={`${s.title}: ${status[s.n].hint}`}>
            {status[s.n].state === 'done' ? '✓' : s.n}
          </Link>
        ))}
      </div>
      <div className="mcbar__cap">ครั้งที่ {m.no}/{m.year}{m.name ? ` · ${m.name}` : ''}{cur && step ? ` · ขั้น ${step}: ${cur.hint}` : ''}</div>
    </nav>
  )
}
