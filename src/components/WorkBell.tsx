import { useState } from 'react'
import { useAnnouncements } from '../lib/data'
import { forWork, markRead, readIds, unreadOf } from '../lib/announce'

const Bell = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 17h12l-1.5-2.2V10a4.5 4.5 0 0 0-9 0v4.8z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
export { Bell as BellIcon }

const when = (t: number) => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * กระดิ่งข่าวของแต่ละงาน: แอดมินส่งข่าวถึงงาน → กระดิ่งขึ้นสีแดงพร้อมจำนวนที่ยังไม่อ่าน · แตะเปิดอ่าน (อ่านแล้วกลับเป็นกระดิ่งธรรมดา)
 * สถานะอ่านแล้วเก็บในเครื่องนี้ (แยกตามงาน)
 */
export default function WorkBell({ n }: { n: number }) {
  const ann = useAnnouncements()
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState(() => readIds(n))
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const list = forWork(ann.list, n)
  const unread = unreadOf(list, read)
  const toggle = () => {
    if (!open) { setFresh(new Set(unread.map((x) => x.id))); markRead(n, unread.map((x) => x.id)); setRead(readIds(n)) }
    setOpen(!open)
  }
  return (
    <span className="bellwrap no-print">
      <button type="button" className={`bellbtn${unread.length > 0 ? ' bellbtn--new' : ''}`} aria-expanded={open} aria-label={unread.length > 0 ? `ข่าวจากแอดมิน มีข้อความใหม่ ${unread.length}` : 'ข่าวจากแอดมิน'} onClick={toggle}>
        <Bell />{unread.length > 0 && <i className="bellbtn__n" aria-hidden="true">{unread.length}</i>}
      </button>
      {open && (
        <div className="bellpanel card" role="region" aria-label="ข่าวจากแอดมิน">
          <b>ข่าวจากแอดมิน</b>
          {list.length === 0 ? <p className="muted small" style={{ margin: 0 }}>ยังไม่มีข่าวถึงงานนี้</p> : (
            <ul className="bellpanel__list">
              {list.map((x) => (
                <li key={x.id} className={fresh.has(x.id) ? 'new' : undefined}>
                  <span className="small muted">{when(x.at)}{fresh.has(x.id) ? <b className="bellpanel__tag"> · ใหม่</b> : null}</span>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{x.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  )
}
