import { useMemo, useState } from 'react'
import { fmtDateLong, todayISO } from '../lib/money'
import { reportText, serviceReport } from '../lib/serviceReport'
import type { CheckIn, ChurchMember } from '../lib/types'

/** สรุปผู้มานมัสการของวันที่เลือก → แชร์ไป LINE / Messenger / Facebook ผ่านเมนูแชร์ของเครื่อง */
export default function ShareReport({ checkins, members }: { checkins: CheckIn[]; members: ChurchMember[] }) {
  const [date, setDate] = useState(todayISO)
  const [msg, setMsg] = useState('')
  const r = useMemo(() => serviceReport(checkins, members, date), [checkins, members, date])
  const text = reportText(r)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 4000) }
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); flash('คัดลอกแล้ว วางในแชตได้เลย') } catch { flash('คัดลอกไม่ได้ ให้กดค้างที่ข้อความด้านบนแล้วเลือกคัดลอก') }
  }
  const share = async () => {
    try { await navigator.share({ title: `สรุปนมัสการ ${fmtDateLong(date)}`, text }) } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) void copy() }
  }
  return (
    <section className="card">
      <div className="field">
        <label htmlFor="sh-date">วันนมัสการที่จะสรุป</label>
        <input id="sh-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {r.total === 0 && <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>วันนี้ยังไม่มีใครลงชื่อ — ลงชื่อที่แท็บ “ลงชื่อ” ก่อน</p>}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
        {([['ทั้งหมด', r.total], ['ชาย', r.male], ['หญิง', r.female], ['สมาชิกสมบูรณ์', r.complete], ['ผู้ร่วมนมัสการ', r.worshiper], ['คนมาใหม่', r.newcomers.length]] as const).map(([k, v]) => (
          <div key={k} style={{ border: '1.5px solid var(--line)', borderRadius: '0.8rem', padding: '0.5rem 0.2rem' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            <div className="small muted">{k}</div>
          </div>
        ))}
      </div>
      <pre aria-label="ข้อความที่จะส่ง" style={{ whiteSpace: 'pre-wrap', margin: 0, padding: '0.75rem', borderRadius: '0.8rem', background: 'var(--surface-2)', border: '1px solid var(--line)', fontFamily: 'inherit', userSelect: 'text' }}>{text}</pre>
      {canShare
        ? <button type="button" className="btn btn--gold bigbtn btn--block" onClick={share} disabled={r.total === 0}>📤 แชร์ไป LINE / Messenger / Facebook</button>
        : <a className={`btn btn--gold bigbtn btn--block${r.total === 0 ? ' btn--off' : ''}`} href={`https://line.me/R/msg/text/?${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">📤 ส่งไป LINE</a>}
      <button type="button" className="btn btn--ghost btn--block" onClick={copy} disabled={r.total === 0}>คัดลอกข้อความ</button>
      {msg && <p className="small" role="status" style={{ margin: 0 }}>{msg}</p>}
      <p className="pagehint">กดแชร์แล้วเลือกแอปที่ต้องการ (เช่น LINE ของผู้นำที่ประกาศ) ข้อความมีเฉพาะตัวเลขและชื่อคนมาใหม่ ไม่มีเบอร์โทรหรือวันเกิด</p>
    </section>
  )
}
