import { Link, useParams } from 'react-router-dom'

/** โหมดประชุม: แท็บ 1–6 (ยังว่าง — พัฒนาทีละแท็บ) ขนาดเดียวกับช่องเงินคริสตจักรหน้าแรก */
export const MEETING_TABS = [
  { n: 1, name: 'งานเลขา' }, { n: 2, name: 'งานทะเบียน' }, { n: 3, name: 'งานเหรัญญิก' }, { n: 4, name: 'งานอภิบาล' }, { n: 5, name: 'งานสุสาน' },
  { n: 6, name: 'แท็บ 6' }, // ยังไม่ได้ตั้งชื่อ
]
const TONE = ['own', 'fund', 'total', 'indebt', 'debt', 'spare'] as const

export default function Meeting() {
  const { n } = useParams()
  const tab = MEETING_TABS.find((x) => String(x.n) === n)
  if (n && !tab) return <><div className="page-head"><h1>โหมดประชุม</h1><Link to="/meeting" className="mini">‹ โหมดประชุม</Link></div><p className="empty">ไม่พบแท็บนี้</p></>
  if (tab) {
    return (
      <>
        <div className="page-head"><h1>โหมดประชุม · {tab.name}</h1><Link to="/meeting" className="mini">‹ ทุกแท็บ</Link></div>
        <section className="card" aria-label={tab.name}><p className="empty">{tab.name} — ยังว่าง (รอพัฒนา)</p></section>
      </>
    )
  }
  return (
    <>
      <div className="page-head"><h1>🧑‍🤝‍🧑 โหมดประชุม</h1></div>
      <p className="home-label">เลือกแท็บ <span>(ยังว่างทุกแท็บ — พัฒนาทีละแท็บ)</span></p>
      <nav className="balance-tiles" aria-label="โหมดประชุม แท็บ 1 ถึง 6">
        {MEETING_TABS.map((t) => <Link key={t.n} to={`/meeting/${t.n}`} className={`btile btile--${TONE[t.n - 1]}`}><small>{t.n}</small><b>{t.name}</b></Link>)}
      </nav>
    </>
  )
}
