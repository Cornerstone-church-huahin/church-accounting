import { useEffect, useRef, useState } from 'react'
import { whoAmI } from '../lib/access'
import { useRoomChat } from '../lib/data'
import { newId } from '../lib/money'
import { CHAT_MAX, roomMsgs, setSeen } from '../lib/roomChat'

const when = (t: number) => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * แชทของห้องงาน n ↔ แอดมิน (เธรดเดียวต่อห้อง · ตอบย้อนกลับไปมา) — ใช้ในกระดิ่งของห้องงานและกระดิ่งของแอดมิน
 * side = ฝั่งของผู้ดู (admin / room) ใช้ตัดสินว่าข้อความใครเป็น "ของเรา" และบันทึกเวลาที่อ่านล่าสุด
 */
export default function RoomChat({ n, side, canWrite, onSeen }: { n: number; side: 'admin' | 'room'; canWrite: boolean; onSeen?: () => void }) {
  const chat = useRoomChat()
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const msgs = roomMsgs(chat.list, n)
  const last = msgs[msgs.length - 1]?.at ?? 0
  useEffect(() => { if (last) { setSeen(side, n, last); onSeen?.() } end.current?.scrollIntoView({ block: 'nearest' }) }, [last, side, n]) // eslint-disable-line react-hooks/exhaustive-deps
  const send = () => {
    const t = text.trim()
    if (!t) return setErr('พิมพ์ข้อความก่อนส่ง')
    if (t.length > CHAT_MAX) return setErr(`ข้อความยาวเกินไป (${t.length}/${CHAT_MAX} ตัวอักษร)`)
    const me = whoAmI()
    if (!chat.put([{ id: newId('chat'), updated: 0, n, text: t, at: Date.now(), fromAdmin: side === 'admin', byId: me.id, by: me.name }])) return setErr('ส่งไม่ได้ — สิทธิ์ของท่านไม่พอ')
    setText(''); setErr('')
  }
  return (
    <div className="roomchat" aria-label="แชทกับแอดมิน">
      {msgs.length === 0 ? <p className="muted small" style={{ margin: 0 }}>ยังไม่มีข้อความ{canWrite ? ' — เขียนถึง' + (side === 'admin' ? 'ห้องนี้' : 'แอดมิน') + 'ด้านล่างได้เลย' : ''}</p> : (
        <ul className="roomchat__list" aria-label="ข้อความ">
          {msgs.map((m) => {
            const mine = (side === 'admin') === m.fromAdmin
            return (
              <li key={m.id} className={`roomchat__msg${mine ? ' roomchat__msg--mine' : ''}`}>
                <span className="small muted">{m.fromAdmin ? '👑 แอดมิน' : m.by} · {when(m.at)}</span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
              </li>
            )
          })}
        </ul>
      )}
      <div ref={end} />
      {canWrite ? (
        <div className="roomchat__send">
          <label className="small" htmlFor={`rc-${side}-${n}`}>{side === 'admin' ? 'ตอบห้องนี้' : 'เขียนถึงแอดมิน'}</label>
          <textarea id={`rc-${side}-${n}`} className="input" rows={2} maxLength={CHAT_MAX + 50} value={text} onChange={(e) => { setText(e.target.value); setErr('') }} placeholder="พิมพ์ข้อความ…" />
          {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button type="button" className="btn btn--gold" onClick={send}>📨 ส่ง</button>
          <p className="small muted" style={{ margin: 0 }}>ข้อความนี้เห็นเฉพาะแอดมินกับคนในห้องนี้ (กันที่ระดับแอป ไม่ใช่การเข้ารหัส) — อย่าพิมพ์รหัสผ่านหรือเลขบัญชีเต็ม</p>
        </div>
      ) : <p className="muted small" style={{ margin: 0 }}>ดูข้อความได้อย่างเดียว</p>}
    </div>
  )
}
