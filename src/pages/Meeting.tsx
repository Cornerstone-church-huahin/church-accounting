import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Home from './Home'
import Members from './Members'

/** โหมดประชุม: แท็บ 1–12 (ยังว่าง — พัฒนาทีละแท็บ) ขนาดเดียวกับช่องเงินคริสตจักรหน้าแรก */
export const MEETING_TABS = [
  { n: 1, name: 'งานเลขา' }, { n: 2, name: 'งานทะเบียน' }, { n: 3, name: 'งานเหรัญญิก' }, { n: 4, name: 'งานอภิบาล' }, { n: 5, name: 'งานสุสาน' },
  { n: 6, name: 'งานนมัสการ' }, { n: 7, name: 'งานต่างชาติ' }, { n: 8, name: 'งานรวี' }, { n: 9, name: 'งานอนุชน' }, { n: 10, name: 'งานสตรี' },
  { n: 11, name: 'แท็บ 11' }, { n: 12, name: 'แท็บ 12' }, // ยังไม่ได้ตั้งชื่อ
]
/** แท็บย่อยในงานเลขา (ยังว่าง — พัฒนาทีละแท็บ) */
const SECRETARY_TABS = ['ตารางงาน', 'การประชุม', 'แท็บ 3', 'แท็บ 4']

function Secretary() {
  const [t, setT] = useState(SECRETARY_TABS[0])
  return (
    <>
      <div className="page-head"><h1>งานเลขา</h1><Link to="/meeting" className="mini">‹ ทุกแท็บ</Link></div>
      <div className="seg seg--4 no-print" role="tablist" aria-label="หมวดงานเลขา">
        {SECRETARY_TABS.map((k) => <button key={k} type="button" role="tab" aria-selected={t === k} className={t === k ? 'on' : ''} onClick={() => setT(k)}>{k}</button>)}
      </div>
      <section className="card" aria-label={t}><p className="empty">{t} — ยังว่าง (รอพัฒนา)</p></section>
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
  if (tab?.n === 3) return <><Home /></>
  if (tab?.n === 2) {
    if (!params.get('tab')) return <Navigate to="/meeting/2?tab=checkin" replace />
    return <><Members /></>
  }
  if (tab?.n === 1) return <Secretary />
  if (tab) {
    return (
      <>
        <div className="page-head"><h1>{tab.name}</h1><Link to="/meeting" className="mini">‹ ทุกแท็บ</Link></div>
        <section className="card" aria-label={tab.name}><p className="empty">{tab.name} — ยังว่าง (รอพัฒนา)</p></section>
      </>
    )
  }
  return (
    <>
      <div className="page-head"><h1>🧑‍🤝‍🧑 ห้องทำงาน</h1></div>
      <p className="home-label">เลือกแท็บ <span>(งานเหรัญญิกและงานทะเบียนพร้อมใช้ · แท็บอื่นยังว่าง)</span></p>
      <nav className="balance-tiles" aria-label="โหมดประชุม แท็บ 1 ถึง 12">
        {MEETING_TABS.map((t) => <Link key={t.n} to={`/meeting/${t.n}`} className={`btile btile--${TONE[(t.n - 1) % TONE.length]}`}><small>{t.n}</small><b>{t.name}</b></Link>)}
      </nav>
    </>
  )
}
