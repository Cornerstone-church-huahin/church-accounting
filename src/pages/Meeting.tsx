import type { ReactNode } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Home from './Home'
import Members from './Members'
import WorkCalendar from '../components/WorkCalendar'
import { MEETING_TABS } from '../lib/workTabs'

/** แท็บย่อยของแต่ละงาน: แถบแรก = ตารางงาน (ปฏิทินของงานนั้น เห็นร่วมกับงานเลขา) · แถบอื่นเพิ่มตามที่พัฒนา */
interface SubTab { key: string; label: string; node?: ReactNode }
function WorkShell({ n, name, extra = [] }: { n: number; name: string; extra?: SubTab[] }) {
  const [params, setParams] = useSearchParams()
  const tabs: SubTab[] = [{ key: 'cal', label: 'ตารางงาน', node: <WorkCalendar tab={n} /> }, ...extra]
  const cur = tabs.find((t) => t.key === params.get('v')) ?? tabs[0]
  return (
    <>
      <div className="page-head"><h1>{name}</h1><Link to="/meeting" className="mini">‹ ทุกแท็บ</Link></div>
      <div className={`seg ${tabs.length >= 3 ? `seg--${Math.min(tabs.length, 4)}` : ''} no-print`} role="tablist" aria-label={`หมวด${name}`}>
        {tabs.map((t) => <button key={t.key} type="button" role="tab" aria-selected={cur.key === t.key} className={cur.key === t.key ? 'on' : ''} onClick={() => setParams(t.key === 'cal' ? {} : { v: t.key }, { replace: true })}>{t.label}</button>)}
      </div>
      {cur.node ?? <section className="card" aria-label={cur.label}><p className="empty">{cur.label} — ยังว่าง (รอพัฒนา)</p></section>}
    </>
  )
}

const TONE = ['own', 'fund', 'total', 'indebt', 'debt', 'spare'] as const

export default function Meeting() {
  const { n } = useParams()
  const tab = MEETING_TABS.find((x) => String(x.n) === n)
  if (n && !tab) return <><div className="page-head"><h1>โหมดประชุม</h1><Link to="/meeting" className="mini">‹ โหมดประชุม</Link></div><p className="empty">ไม่พบแท็บนี้</p></>
  const [params] = useSearchParams()
  // งานเหรัญญิก = หน้าแรกบัญชีทั้งหมด (เงินคริสตจักร + ขั้นตอน รับ/จ่าย/ปรับ/สรุป) · งานทะเบียน = หน้าสมาชิกทั้งหมด (เปิดที่แท็บ ลงชื่อ)
  // งานเหรัญญิก = ตารางงาน + หน้าแรกบัญชีทั้งหมด · งานทะเบียน = ตารางงาน + หน้าสมาชิกทั้งหมด (เปิดที่แท็บ ลงชื่อ) · งานเลขา = ตารางงาน + แท็บที่ยังว่าง
  if (tab?.n === 3) return <WorkShell n={3} name={tab.name} extra={[{ key: 'work', label: 'หน้างาน', node: <Home /> }]} />
  if (tab?.n === 2) {
    const work = params.get('v') === 'work'
    if (work && !params.get('tab')) return <Navigate to="/meeting/2?v=work&tab=checkin" replace />
    return <WorkShell n={2} name={tab.name} extra={[{ key: 'work', label: 'หน้างาน', node: <Members /> }]} />
  }
  if (tab?.n === 1) return <WorkShell n={1} name={tab.name} extra={['การประชุม', 'แท็บ 3', 'แท็บ 4'].map((l) => ({ key: l, label: l }))} />
  if (tab) return <WorkShell n={tab.n} name={tab.name} />
  return (
    <>
      <div className="page-head"><h1>🧑‍🤝‍🧑 ห้องทำงาน</h1></div>
      <p className="home-label">เลือกแท็บ <span>(ทุกงานมี “ตารางงาน” · งานเหรัญญิกและงานทะเบียนมีหน้างานพร้อมใช้)</span></p>
      <nav className="balance-tiles" aria-label="โหมดประชุม แท็บ 1 ถึง 12">
        {MEETING_TABS.map((t) => <Link key={t.n} to={`/meeting/${t.n}`} className={`btile btile--${TONE[(t.n - 1) % TONE.length]}`}><small>{t.n}</small><b>{t.name}</b></Link>)}
      </nav>
    </>
  )
}
