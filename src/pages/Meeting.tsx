import { Link, useParams } from 'react-router-dom'

/** โหมดประชุม: แท็บ 1–6 (ยังว่าง — พัฒนาทีละแท็บ) ขนาดเดียวกับช่องเงินคริสตจักรหน้าแรก */
export const MEETING_TABS = [1, 2, 3, 4, 5, 6]
const TONE = ['own', 'fund', 'total', 'indebt', 'debt', 'spare'] as const

export default function Meeting() {
  const { n } = useParams()
  const tab = MEETING_TABS.find((x) => String(x) === n)
  if (n && !tab) return <><div className="page-head"><h1>โหมดประชุม</h1><Link to="/meeting" className="mini">‹ โหมดประชุม</Link></div><p className="empty">ไม่พบแท็บนี้</p></>
  if (tab) {
    return (
      <>
        <div className="page-head"><h1>โหมดประชุม · แท็บ {tab}</h1><Link to="/meeting" className="mini">‹ ทุกแท็บ</Link></div>
        <section className="card" aria-label={`แท็บที่ ${tab}`}><p className="empty">แท็บที่ {tab} — ยังว่าง (รอพัฒนา)</p></section>
      </>
    )
  }
  return (
    <>
      <div className="page-head"><h1>🧑‍🤝‍🧑 โหมดประชุม</h1></div>
      <p className="home-label">เลือกแท็บ <span>(ยังว่างทุกแท็บ — พัฒนาทีละแท็บ)</span></p>
      <nav className="balance-tiles" aria-label="โหมดประชุม แท็บ 1 ถึง 6">
        {MEETING_TABS.map((i) => <Link key={i} to={`/meeting/${i}`} className={`btile btile--${TONE[i - 1]}`}><small>แท็บ</small><b>{i}</b></Link>)}
      </nav>
    </>
  )
}
