import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Home from './Home'
import Members from './Members'
import { IconNote } from '../components/Icons'
import TileTabs from '../components/TileTabs'
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

/** รูปแบบมาตรฐานของงานที่ยังไม่มีข้อมูล: บนสุดปุ่ม 📅 ตารางงาน แล้วแท็บ 1–6 (ยังว่าง — พัฒนาทีละแท็บ) */
const DEFAULT_LABELS = ['แท็บ 1', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6']
const TAB_ICONS = ['📋', '📝', '📂', '🗂️', '📌', '📎']
/** งานเลขา: แท็บแรกตั้งชื่อ “การประชุม” ไว้แล้ว */
const SECRETARY_LABELS = ['การประชุม', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6']
function WorkTabs({ n, name, labels = DEFAULT_LABELS }: { n: number; name: string; labels?: string[] }) {
  const [t, setT] = useState(0)
  const cur = Math.min(t, labels.length - 1)
  return (
    <>
      <div className="page-head"><h1>{name}</h1><Link to="/meeting" className="mini">‹ ทุกแท็บ</Link></div>
      <CalToggle n={n} />
      <TileTabs label={`หมวด${name}`} value={String(cur)} onChange={(k) => setT(Number(k))} items={labels.map((l, i) => ({ key: String(i), label: l, icon: TAB_ICONS[i % TAB_ICONS.length] }))} />
      <section className="card" aria-label={`${name} ${labels[cur]}`}><p className="empty">{labels[cur]} — ยังว่าง (รอพัฒนา)</p></section>
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
  if (tab?.n === 1) return <WorkTabs key={1} n={1} name={tab.name} labels={SECRETARY_LABELS} />
  if (tab) return <WorkTabs key={tab.n} n={tab.n} name={tab.name} />
  return (
    <>
      <div className="page-head"><h1>🧑‍🤝‍🧑 ห้องทำงาน</h1><Link to="/meeting/notes" className="topbar__go" aria-label="บันทึกโน้ต" title="บันทึกโน้ต"><IconNote /></Link></div>
      <p className="home-label">เลือกแท็บ <span>(ทุกงานมีปุ่ม “ตารางงาน” ไว้บนสุด · งานเหรัญญิกและงานทะเบียนพร้อมใช้ · งานอื่นมีแท็บ 1–6 รอพัฒนา)</span></p>
      <nav className="balance-tiles" aria-label="โหมดประชุม แท็บ 1 ถึง 12">
        {MEETING_TABS.map((t) => <Link key={t.n} to={`/meeting/${t.n}`} className={`btile btile--${TONE[(t.n - 1) % TONE.length]}`}><small>{t.n}</small><b>{t.name}</b></Link>)}
      </nav>
    </>
  )
}
