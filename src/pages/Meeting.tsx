import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Home from './Home'
import Members from './Members'
import { IconNote } from '../components/Icons'
import WorkCalendar from '../components/WorkCalendar'
import { MEETING_TABS } from '../lib/workTabs'

/** ปุ่มเปิด/ปิดตารางงานไว้บนสุดของแต่ละหน้า — เปิดดูได้โดยไม่ไปแตะข้อมูล/หน้าเดิมของงานนั้น */
function CalToggle({ n, defaultOpen = false }: { n: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="caltoggle no-print">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>📅 ตารางงาน {open ? '▴' : '▾'}</button>
      {open && <WorkCalendar tab={n} />}
    </div>
  )
}

/** งานเลขา: แท็บย่อย ตารางงาน (ปฏิทินรวมทุกงาน) / การประชุม / แท็บ 3 / แท็บ 4 — แท็บอื่นๆ ยังว่าง */
const SECRETARY_TABS = ['ตารางงาน', 'การประชุม', 'แท็บ 3', 'แท็บ 4']
function Secretary({ name }: { name: string }) {
  const [t, setT] = useState(SECRETARY_TABS[0])
  return (
    <>
      <div className="page-head"><h1>{name}</h1><Link to="/meeting" className="mini">‹ ทุกแท็บ</Link></div>
      <div className="seg seg--4 no-print" role="tablist" aria-label={`หมวด${name}`}>
        {SECRETARY_TABS.map((k) => <button key={k} type="button" role="tab" aria-selected={t === k} className={t === k ? 'on' : ''} onClick={() => setT(k)}>{k}</button>)}
      </div>
      {t === 'ตารางงาน' ? <WorkCalendar tab={1} /> : <><CalToggle n={1} /><section className="card" aria-label={t}><p className="empty">{t} — ยังว่าง (รอพัฒนา)</p></section></>}
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
  // งานเหรัญญิก = หน้าแรกบัญชีทั้งหมด (เหมือนเดิมทุกอย่าง) · งานทะเบียน = หน้าสมาชิกทั้งหมด (เปิดที่แท็บ ลงชื่อ) — ทุกหน้ามีปุ่ม 📅 ตารางงานไว้บนสุด
  if (tab?.n === 3) return <><CalToggle n={3} /><Home /></>
  if (tab?.n === 2) {
    if (!params.get('tab')) return <Navigate to="/meeting/2?tab=checkin" replace />
    return <><CalToggle n={2} /><Members /></>
  }
  if (tab?.n === 1) return <Secretary name={tab.name} />
  if (tab) {
    return (
      <>
        <div className="page-head"><h1>{tab.name}</h1><Link to="/meeting" className="mini">‹ ทุกแท็บ</Link></div>
        <CalToggle n={tab.n} defaultOpen />
        <section className="card" aria-label={tab.name}><p className="empty">{tab.name} — ยังว่าง (รอพัฒนา)</p></section>
      </>
    )
  }
  return (
    <>
      <div className="page-head"><h1>🧑‍🤝‍🧑 ห้องทำงาน</h1><Link to="/meeting/notes" className="topbar__go" aria-label="บันทึกโน้ต" title="บันทึกโน้ต"><IconNote /></Link></div>
      <p className="home-label">เลือกแท็บ <span>(ทุกงานมีปุ่ม “ตารางงาน” ไว้บนสุด · งานเหรัญญิกและงานทะเบียนพร้อมใช้)</span></p>
      <nav className="balance-tiles" aria-label="โหมดประชุม แท็บ 1 ถึง 12">
        {MEETING_TABS.map((t) => <Link key={t.n} to={`/meeting/${t.n}`} className={`btile btile--${TONE[(t.n - 1) % TONE.length]}`}><small>{t.n}</small><b>{t.name}</b></Link>)}
      </nav>
    </>
  )
}
