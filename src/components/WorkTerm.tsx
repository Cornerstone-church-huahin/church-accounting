import { useState } from 'react'
import Sheet from './Sheet'
import { can } from '../lib/access'
import { useWorkTerms } from '../lib/data'
import { useRole } from '../lib/members'
import { todayISO } from '../lib/money'
import { termStatus, thaiShort, ymdText } from '../lib/workTerm'

/** วาระของงาน (ตำแหน่งเดียวกันทุกห้อง ใต้รายชื่อผู้รับผิดชอบ): วันเริ่ม–สิ้นสุด + นับถอยหลัง · แอดมินแก้ได้ (มีคำเตือนทุกครั้ง) */
export default function WorkTerm({ n, name }: { n: number; name: string }) {
  const role = useRole()
  const terms = useWorkTerms()
  const today = todayISO()
  const t = terms.of(n, today)
  const st = termStatus(t, today)
  const [editing, setEditing] = useState(false)
  const label = st.kind === 'before' ? `ยังไม่เริ่ม · อีก ${ymdText(st.left)} จะเริ่มวาระ` : st.kind === 'active' ? `เหลืออีก ${ymdText(st.left)}` : `หมดวาระแล้ว ${ymdText(st.left)}`
  return (
    <div className="no-print" aria-label={`วาระ${name}`} style={{ margin: '0 0 0.5rem', padding: '0.4rem 0.6rem', background: 'var(--surface-2)', borderRadius: 10, fontSize: '0.82rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span aria-hidden>⏳</span>
        <span style={{ flex: 1 }}>วาระ <b>{thaiShort(t.start)}</b> – <b>{thaiShort(t.end)}</b></span>
        {can(role, 'settings') && <button type="button" className="workteam__edit" aria-label="ตั้งวาระ" title="ตั้งวาระ (แอดมิน)" onClick={() => setEditing(true)}>✏️</button>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
        <b role="status" style={{ color: st.kind === 'ended' ? '#b3261e' : 'inherit' }}>{label}</b>
        <span aria-hidden style={{ flex: 1, height: 6, background: 'var(--line, #ddd)', borderRadius: 3, overflow: 'hidden' }}><span style={{ display: 'block', width: `${st.pct}%`, height: '100%', background: st.kind === 'ended' ? '#b3261e' : '#c9a227' }} /></span>
      </div>
      {editing && <TermEditor name={name} start={t.start} end={t.end} onClose={() => setEditing(false)} onSave={(s, e) => terms.save(n, s, e)} />}
    </div>
  )
}

function TermEditor({ name, start, end, onClose, onSave }: { name: string; start: string; end: string; onClose: () => void; onSave: (s: string, e: string) => boolean }) {
  const [s, setS] = useState(start)
  const [e, setE] = useState(end)
  const [msg, setMsg] = useState('')
  const save = () => {
    if (!s || !e) return setMsg('ใส่วันที่ให้ครบทั้งวันเริ่มและวันสิ้นสุด')
    if (e <= s) return setMsg('วันสิ้นสุดต้องหลังวันเริ่ม')
    if (!confirm(`⚠️ โปรดตรวจให้ถูกต้องก่อนบันทึก\n\nวาระ${name}\nเริ่ม ${thaiShort(s)}\nสิ้นสุด ${thaiShort(e)}\n\nวันที่ผิดจะทำให้ทุกคนในห้องเห็นเวลานับถอยหลังผิด ยืนยันบันทึก?`)) return
    if (!onSave(s, e)) return setMsg('ไม่มีสิทธิ์บันทึก — เฉพาะแอดมิน')
    onClose()
  }
  return (
    <Sheet title={`ตั้งวาระ ${name}`} onClose={onClose}>
      <p className="error small" role="alert" style={{ margin: 0 }}>⚠️ ระวังตั้งค่าผิด — ทุกคนในห้องนี้จะเห็นวันเริ่ม วันสิ้นสุด และเวลานับถอยหลังตามที่ตั้ง</p>
      <label className="field"><span>วันเริ่มวาระ</span><input type="date" value={s} onChange={(x) => setS(x.target.value)} /></label>
      <label className="field"><span>วันสิ้นสุดวาระ</span><input type="date" value={e} onChange={(x) => setE(x.target.value)} /></label>
      <p className="muted small" style={{ margin: 0 }}>วาระปกติ 2 ปี เช่น 1 ม.ค. 2570 – 31 ธ.ค. 2571</p>
      {msg && <p className="error" role="status">{msg}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>บันทึกวาระ</button>
    </Sheet>
  )
}
