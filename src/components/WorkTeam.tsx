import { useState } from 'react'
import Sheet from './Sheet'
import { can, myWorkLevel, workLevelHelp, WORK_LEVEL_LABEL } from '../lib/access'
import { useWorkTeams } from '../lib/data'
import { useRole } from '../lib/members'
import type { TeamMember } from '../lib/types'

/** ตัดช่องว่างและทิ้งแถวที่ว่างทั้งสองช่อง */
export const cleanTeam = (rows: TeamMember[]): TeamMember[] => rows.map((r) => ({ role: r.role.trim(), name: r.name.trim() })).filter((r) => r.role || r.name)

/**
 * ผู้รับผิดชอบของงาน (ใต้ชื่องาน ตำแหน่งเดียวกันทุกงาน): แสดง “ตำแหน่ง · ชื่อ” เรียงตามลำดับ — ทุกคนเห็น แอดมินเท่านั้นแก้ได้
 */
export default function WorkTeam({ n, name }: { n: number; name: string }) {
  const role = useRole()
  const teams = useWorkTeams()
  const people = teams.of(n)
  const [editing, setEditing] = useState(false)
  const canEdit = can(role, 'settings')
  const lv = myWorkLevel(n)
  return (
    <div className="workteam no-print" aria-label={`ผู้รับผิดชอบ${name}`}>
      {people.length === 0
        ? <span className="muted">ยังไม่ระบุผู้รับผิดชอบ</span>
        : <ol className="workteam__list">{people.map((p, i) => <li key={i}><span>{p.role}</span> <b>{p.name}</b>{' '}</li>)}</ol>}
      {canEdit && <button type="button" className="workteam__edit" aria-label={`${people.length ? 'แก้ไข' : 'ใส่'}ผู้รับผิดชอบ`} title={`${people.length ? 'แก้ไข' : 'ใส่'}ผู้รับผิดชอบ`} onClick={() => setEditing(true)}>✏️</button>}
      {lv && lv !== 'admin' && <p className="small" style={{ margin: '0.2rem 0 0' }} aria-label="ตำแหน่งของคุณในงานนี้">🪪 ตำแหน่งของคุณ: <b>{WORK_LEVEL_LABEL[lv]}</b> <span className="muted workteam__help">— {workLevelHelp(lv, n)}</span></p>}
      {editing && <TeamEditor name={name} initial={people} onClose={() => setEditing(false)} onSave={(rows) => teams.save(n, rows)} />}
    </div>
  )
}

function TeamEditor({ name, initial, onClose, onSave }: { name: string; initial: TeamMember[]; onClose: () => void; onSave: (rows: TeamMember[]) => boolean }) {
  const [rows, setRows] = useState<TeamMember[]>(initial.length ? initial : [{ role: '', name: '' }])
  const [msg, setMsg] = useState('')
  const set = (i: number, k: keyof TeamMember, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const move = (i: number, d: number) => setRows((rs) => { const j = i + d; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c })
  const save = () => {
    const clean = cleanTeam(rows)
    if (clean.some((r) => !r.name)) return setMsg('ใส่ชื่อให้ครบทุกแถว (หรือลบแถวที่ไม่ใช้)')
    if (!onSave(clean)) return setMsg('ไม่มีสิทธิ์บันทึก — เฉพาะแอดมิน')
    onClose()
  }
  return (
    <Sheet title={`ผู้รับผิดชอบ ${name}`} onClose={onClose}>
      <p className="muted small" style={{ margin: '0 0 0.5rem' }}>เรียงตามลำดับที่แสดง (เช่น เลขา → รองเลขา → ครูศาสนกิจ) · ใส่กี่คนก็ได้</p>
      <ol className="list" style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((r, i) => (
          <li key={i} className="row" style={{ alignItems: 'flex-end', gap: '0.4rem', flexWrap: 'nowrap' }}>
            <div className="field" style={{ width: '34%' }}><label htmlFor={`tr-${i}`}>ตำแหน่ง</label><input id={`tr-${i}`} className="input" value={r.role} onChange={(e) => set(i, 'role', e.target.value)} placeholder="เช่น เลขา" /></div>
            <div className="field" style={{ flex: 1, minWidth: 0 }}><label htmlFor={`tn-${i}`}>ชื่อ</label><input id={`tn-${i}`} className="input" value={r.name} onChange={(e) => set(i, 'name', e.target.value)} /></div>
            <span className="row" style={{ gap: '0.2rem', flexWrap: 'nowrap' }}>
              <button type="button" className="mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`เลื่อนแถว ${i + 1} ขึ้น`}>↑</button>
              <button type="button" className="mini" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`เลื่อนแถว ${i + 1} ลง`}>↓</button>
              <button type="button" className="mini" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`ลบแถว ${i + 1}`}>🗑️</button>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="mini" onClick={() => setRows((rs) => [...rs, { role: '', name: '' }])}>＋ เพิ่มแถว</button>
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>
        <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
      </div>
    </Sheet>
  )
}
