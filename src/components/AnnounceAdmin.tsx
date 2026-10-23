import { useState } from 'react'
import { BellIcon } from './WorkBell'
import { useAnnouncements } from '../lib/data'
import { ALL_WORKS } from '../lib/announce'
import { newId } from '../lib/money'
import { MEETING_TABS } from '../lib/workTabs'

const when = (t: number) => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** กระดิ่งของแอดมินที่หน้าห้องทำงาน: เขียนข่าว เลือกงานที่จะส่ง (หรือทุกงาน) → ขึ้นที่กระดิ่งของงานนั้น ๆ */
export default function AnnounceAdmin() {
  const ann = useAnnouncements()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [to, setTo] = useState<number[]>([])
  const [err, setErr] = useState('')
  const all = to.includes(ALL_WORKS)
  const toggle = (n: number) => setTo((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t.filter((x) => x !== ALL_WORKS), n]))
  const send = () => {
    if (!text.trim()) { setErr('พิมพ์ข้อความก่อนส่ง'); return }
    if (to.length === 0) { setErr('เลือกงานที่จะส่งถึง (หรือ “ทุกงาน”)'); return }
    if (!ann.put([{ id: newId('ann'), text: text.trim(), works: to, at: Date.now(), updated: 0 }])) { setErr('ส่งไม่ได้ — สิทธิ์ของท่านไม่พอ'); return }
    setText(''); setTo([]); setErr('')
  }
  const name = (n: number) => MEETING_TABS.find((t) => t.n === n)?.name ?? `งาน ${n}`
  return (
    <span className="bellwrap no-print">
      <button type="button" className="bellbtn" aria-expanded={open} aria-label="ส่งข่าวถึงแต่ละงาน" onClick={() => setOpen(!open)}><BellIcon /></button>
      {open && (
        <div className="bellpanel bellpanel--admin card" role="region" aria-label="ส่งข่าวถึงแต่ละงาน">
          <b>ส่งข่าวถึงแต่ละงาน</b>
          <div className="field"><label htmlFor="ann-text">ข้อความ</label><textarea id="ann-text" className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="เช่น ประชุมกรรมการวันอาทิตย์หน้า" /></div>
          <fieldset className="bellpanel__to"><legend className="small">ส่งถึง</legend>
            <label className="row"><input type="checkbox" checked={all} onChange={() => setTo(all ? [] : [ALL_WORKS])} /> <b>ทุกงาน</b></label>
            {MEETING_TABS.map((t) => <label key={t.n} className="row"><input type="checkbox" disabled={all} checked={all || to.includes(t.n)} onChange={() => toggle(t.n)} /> {t.name}</label>)}
          </fieldset>
          {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button type="button" className="btn btn--gold" onClick={send}>ส่งข่าว</button>
          <b className="small">ที่ส่งแล้ว</b>
          {ann.list.length === 0 ? <p className="muted small" style={{ margin: 0 }}>ยังไม่เคยส่งข่าว</p> : (
            <ul className="bellpanel__list">
              {ann.list.map((x) => (
                <li key={x.id}>
                  <span className="small muted">{when(x.at)} → {x.works.includes(ALL_WORKS) ? 'ทุกงาน' : x.works.map(name).join(', ')}</span>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{x.text}</span>
                  <button type="button" className="mini" aria-label={`ลบข่าว ${x.text.slice(0, 20)}`} onClick={() => { if (confirm('ลบข่าวนี้ออกจากทุกงาน?')) ann.remove(x.id) }}>ลบ</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  )
}
