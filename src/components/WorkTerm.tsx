import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { can } from '../lib/access'
import { useWorkTerms } from '../lib/data'
import { useRole } from '../lib/members'
import { todayISO } from '../lib/money'
import { endFromStart, termStatus, thaiShort, ymdText } from '../lib/workTerm'

/** วาระของงาน (ตำแหน่งเดียวกันทุกห้อง ใต้รายชื่อผู้รับผิดชอบ): วันเริ่ม–สิ้นสุด + นับถอยหลัง · แอดมินแก้ได้ (มีคำเตือนทุกครั้ง) */
export default function WorkTerm({ n, name }: { n: number; name: string }) {
  const role = useRole()
  const terms = useWorkTerms()
  const [today, setToday] = useState(todayISO)
  useEffect(() => { // อัปเดตทุกวัน: ตั้งเวลาเที่ยงคืน + ตรวจเมื่อกลับมาเปิดแอป
    const upd = () => setToday(todayISO())
    const ms = new Date(new Date().setHours(24, 0, 5, 0)).getTime() - Date.now()
    const id = setTimeout(upd, Math.max(1000, ms))
    document.addEventListener('visibilitychange', upd)
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', upd) }
  }, [today])
  const t = terms.of(n, today)
  const st = termStatus(t, today)
  const [editing, setEditing] = useState(false)
  const label = st.kind === 'before' ? `ยังไม่เริ่ม · อีก ${ymdText(st.left)} จะเริ่มวาระ` : st.kind === 'active' ? `เหลืออีก ${ymdText(st.left)}` : `หมดวาระแล้ว ${ymdText(st.left)}`
  return (
    <div className="no-print workterm" aria-label={`วาระ${name}`}>
      <div className="workterm__r">
        <span aria-hidden>⏳</span>
        <span style={{ flex: 1 }}>วาระ {t.years} ปี · <b>{thaiShort(t.start)}</b> – <b>{thaiShort(t.end)}</b></span>
        {can(role, 'settings') && <button type="button" className="workteam__edit" aria-label="ตั้งวาระ" title="ตั้งวาระ (แอดมิน)" onClick={() => setEditing(true)}>✏️</button>}
      </div>
      <div className="workterm__r workterm__r--2">
        <b role="status" style={{ color: st.kind === 'ended' ? '#b3261e' : 'inherit' }}>{label}</b>
        <span aria-hidden className="workterm__bar"><span style={{ display: 'block', width: `${st.pct}%`, height: '100%', background: st.kind === 'ended' ? '#b3261e' : '#c9a227' }} /></span>
      </div>
      {editing && <TermEditor name={name} start={t.start} years={t.years} onClose={() => setEditing(false)} onSave={(s, e, y) => terms.save(n, s, e, y)} />}
    </div>
  )
}

function TermEditor({ name, start, years, onClose, onSave }: { name: string; start: string; years: number; onClose: () => void; onSave: (s: string, e: string, y: number) => boolean }) {
  const [s, setS] = useState(start)
  const [y, setY] = useState(years)
  const e = s ? endFromStart(s, y) : ''
  const [msg, setMsg] = useState('')
  const save = () => {
    if (!s) return setMsg('ใส่วันเริ่มวาระ')
    if (!(y >= 1 && y <= 10)) return setMsg('จำนวนปีต้อง 1–10')
    if (!confirm(`⚠️ โปรดตรวจให้ถูกต้องก่อนบันทึก\n\nวาระ${name} (${y} ปี)\nเริ่ม ${thaiShort(s)}\nสิ้นสุด ${thaiShort(e)}\n\nวันที่ผิดจะทำให้ทุกคนในห้องเห็นเวลานับถอยหลังผิด ยืนยันบันทึก?`)) return
    if (!onSave(s, e, y)) return setMsg('ไม่มีสิทธิ์บันทึก — เฉพาะแอดมิน')
    onClose()
  }
  return (
    <Sheet title={`ตั้งวาระ ${name}`} onClose={onClose}>
      <p className="error small" role="alert" style={{ margin: 0 }}>⚠️ ระวังตั้งค่าผิด — ทุกคนในห้องนี้จะเห็นวันเริ่ม วันสิ้นสุด และเวลานับถอยหลังตามที่ตั้ง</p>
      <label className="field"><span>1 วาระ ยาวกี่ปี</span><select value={y} onChange={(x) => setY(Number(x.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ปี</option>)}</select></label>
      <label className="field"><span>วันเริ่มวาระ</span><input type="date" value={s} onChange={(x) => setS(x.target.value)} /></label>
      <p role="status" style={{ margin: 0 }}>วันสิ้นสุดวาระ (คำนวณให้): <b>{thaiShort(e)}</b></p>
      {msg && <p className="error" role="status">{msg}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>บันทึกวาระ</button>
    </Sheet>
  )
}
