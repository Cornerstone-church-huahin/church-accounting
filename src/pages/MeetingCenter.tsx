import { Link } from 'react-router-dom'
import { CENTER_SUB, CENTER_TITLE, MEETING_STEPS, stepOf } from '../lib/meetingCenter'

const BASE = '/meeting/1/1'
const TONES = ['own', 'fund', 'total', 'indebt', 'debt', 'land'] as const

/**
 * ศูนย์จัดการประชุม (งานเลขา › การประชุม): เมนู 10 ขั้นตามลำดับงานเลขานุการ → หน้ารายละเอียดของแต่ละขั้น (หัวข้อย่อยและคำอธิบาย)
 * หน้าอธิบายอย่างเดียว — ยังไม่มีระบบบันทึก ส่ง พิมพ์ อนุมัติ ลงนาม หรือเชื่อมข้อมูลอื่น จึงไม่แสดงสถานะ/ความคืบหน้า
 */
export default function MeetingCenter({ step }: { step?: number }) {
  if (step === undefined) return <Hub />
  const s = stepOf(step)
  if (!s) return <><Head title={CENTER_TITLE} /><p className="empty">ไม่พบขั้นตอนนี้</p><Link to={BASE} className="btn">กลับศูนย์จัดการประชุม</Link></>
  const prev = stepOf(s.n - 1), next = stepOf(s.n + 1)
  return (
    <div className="mcenter">
      <div className="page-head no-print">
        <h1>{s.n}. {s.title}</h1>
        <Link to={BASE} className="mini">‹ กลับศูนย์จัดการประชุม</Link>
      </div>
      <p className="mc__blurb"><span aria-hidden="true">{s.icon}</span> {s.blurb}</p>
      <ol className="mc__items" aria-label={`หัวข้อของ ${s.title}`}>
        {s.items.map((it) => (
          <li key={it.no} className="card">
            <span className="mc__no">{it.no}</span>
            <div><b>{it.title}</b><p>{it.desc}</p></div>
          </li>
        ))}
      </ol>
      {s.note && <p className="mc__note" role="note">หมายเหตุ: {s.note}</p>}
      <nav className="mc__nav no-print" aria-label="เปลี่ยนขั้นตอน">
        {prev ? <Link to={`${BASE}/${prev.n}`} className="mc__step"><small>‹ ขั้นตอนก่อนหน้า</small><b>{prev.n}. {prev.title}</b></Link> : <span />}
        {next ? <Link to={`${BASE}/${next.n}`} className="mc__step mc__step--next"><small>ขั้นตอนถัดไป ›</small><b>{next.n}. {next.title}</b></Link> : <span />}
      </nav>
      <p style={{ textAlign: 'center', margin: '0.6rem 0' }}><Link to={BASE} className="btn">กลับศูนย์จัดการประชุม</Link></p>
    </div>
  )
}

function Head({ title }: { title: string }) {
  return <div className="page-head no-print"><h1>{title}</h1><Link to="/meeting/1" className="mini">‹ งานเลขา</Link></div>
}

function Hub() {
  return (
    <div className="mcenter">
      <div className="page-head no-print"><h1>{CENTER_TITLE}</h1><Link to="/meeting/1" className="mini">‹ งานเลขา</Link></div>
      <p className="muted" style={{ margin: '0 0 0.7rem' }}>{CENTER_SUB}</p>
      <nav className="mcgrid" aria-label="ขั้นตอนการประชุม 10 ขั้น">
        {MEETING_STEPS.map((s, i) => (
          <Link key={s.n} to={`${BASE}/${s.n}`} className={`mcbtn btile--${TONES[i % TONES.length]}`}>
            <span className="mcbtn__no" aria-hidden="true">{s.n}</span>
            <span className="mcbtn__icon" aria-hidden="true">{s.icon}</span>
            <b>{s.title}</b>
            <small>{s.blurb}</small>
          </Link>
        ))}
      </nav>
    </div>
  )
}
