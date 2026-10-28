import { useEffect, useState } from 'react'
import RoomChat from './RoomChat'
import { myRole, myWorks } from '../lib/access'
import { useAnnouncements, useRoomChat } from '../lib/data'
import { canChatIn, getSeen, unreadChat } from '../lib/roomChat'
import { forWork, markRead, readIds, unreadOf } from '../lib/announce'

const Bell = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 17h12l-1.5-2.2V10a4.5 4.5 0 0 0-9 0v4.8z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
export { Bell as BellIcon }

/** หัวข้อสั้น ๆ ของข่าว (บรรทัดแรก ไม่เกิน 34 ตัวอักษร) สำหรับแท็บข่าวที่อ่านแล้ว */
export const headline = (t: string) => { const l = t.trim().split('\n')[0]; return l.length > 34 ? `${l.slice(0, 34)}…` : l }
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
  const [openOld, setOpenOld] = useState<Set<string>>(new Set())
  useEffect(() => { if (!open) setOpenOld(new Set()) }, [open])
  const chat = useRoomChat()
  const [, setTick] = useState(0)
  const admin = myRole() === 'admin'
  const side = admin ? 'admin' : 'room'
  const canWrite = canChatIn(n, { admin, works: myWorks() })
  const list = forWork(ann.list, n)
  const unreadChatN = unreadChat(chat.list, n, side, getSeen(side, n)).length
  const unread = unreadOf(list, read)
  const total = unread.length + unreadChatN
  const toggle = () => {
    if (!open) { setFresh(new Set(unread.map((x) => x.id))); markRead(n, unread.map((x) => x.id)); setRead(readIds(n)) }
    setOpen(!open)
  }
  return (
    <span className="bellwrap no-print">
      <button type="button" className={`bellbtn${total > 0 ? ' bellbtn--new' : ''}`} aria-expanded={open} aria-label={total > 0 ? `ข่าวจากแอดมิน มีข้อความใหม่ ${total}` : 'ข่าวจากแอดมิน'} onClick={toggle}>
        <Bell />{total > 0 && <i className="bellbtn__n" aria-hidden="true">{total}</i>}
      </button>
      {open && (
        <div className="bellpanel card" role="region" aria-label="ข่าวจากแอดมิน">
          <div className="bellpanel__head"><b>ข่าวจากแอดมิน</b><button type="button" className="bellpanel__x" aria-label="ปิดข่าว" onClick={() => setOpen(false)}>✕</button></div>
          {list.length === 0 ? <p className="muted small" style={{ margin: 0 }}>ยังไม่มีข่าวถึงงานนี้</p> : (
            <ul className="bellpanel__list">
              {list.map((x) => {
                const isNew = fresh.has(x.id), expanded = isNew || openOld.has(x.id)
                const flip = () => setOpenOld((o) => { const t = new Set(o); if (t.has(x.id)) t.delete(x.id); else t.add(x.id); return t })
                return expanded ? (
                  <li key={x.id} className={isNew ? 'new' : 'bellpanel__open'}>
                    <span className="small muted">{when(x.at)}{isNew ? <b className="bellpanel__tag"> · ใหม่</b> : null}</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{x.text}</span>
                    {!isNew && <button type="button" className="mini" onClick={flip} aria-label={`พับข่าว ${headline(x.text)}`}>▲ พับ</button>}
                  </li>
                ) : (
                  <li key={x.id} className="bellpanel__chip">
                    <button type="button" onClick={flip} aria-expanded={false} aria-label={`เปิดข่าวที่อ่านแล้ว ${headline(x.text)}`}>
                      <span aria-hidden="true">✓</span> <span className="small muted">{when(x.at)}</span> <span className="bellpanel__hl">{headline(x.text)}</span> <span aria-hidden="true">▾</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {(canWrite || chat.list.some((m) => m.n === n)) && (
            <>
              <b className="small" style={{ display: 'block', marginTop: 8 }}>💬 {admin ? 'ข้อความกับห้องนี้' : 'ข้อความกับแอดมิน'}</b>
              <RoomChat n={n} side={side} canWrite={canWrite} onSeen={() => setTick((x) => x + 1)} />
            </>
          )}
        </div>
      )}
    </span>
  )
}
