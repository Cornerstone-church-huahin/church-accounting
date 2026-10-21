import { useState } from 'react'
import type { StepProps } from './Step1'
import { assignedTasks, chairReviewed, CHANNELS_DIST, letterDate } from '../../lib/meetings'

const fmt = (t: number) => letterDate(new Date(t).toISOString().slice(0, 10))

/** ขั้น 8: รอที่ประชุมรับรอง — ฉบับที่ประธานตรวจ แจกกรรมการ เก็บข้อสังเกต บรรจุวาระรับรอง ติดตามงาน */
export default function Step8({ m, save }: StepProps) {
  const [ch, setCh] = useState(m.distributed?.channel ?? CHANNELS_DIST[0])
  const [ob, setOb] = useState('')
  const ok = chairReviewed(m)
  const last = m.drafts?.[m.drafts.length - 1]
  const tasks = assignedTasks(m)
  const toggle = (id: string, done: boolean) => save({ agenda: m.agenda.map((a) => (a.id === id ? { ...a, minute: { ...a.minute, done } } : a)) })
  return (
    <>
      <section className="card" aria-label="8.1 ฉบับที่ประธานตรวจ">
        <h2 style={{ margin: 0 }}>8.1 ฉบับที่ประธานตรวจแล้ว</h2>
        {ok && last ? <p role="status" style={{ margin: 0 }}>✅ ฉบับล่าสุด ({fmt(last.at)}) · ประธาน {m.chairOk!.by} ตรวจแล้ว — ใช้ฉบับนี้เสนอที่ประชุม</p>
          : <p className="error small" role="alert" style={{ margin: 0 }}>ยังไม่มีฉบับที่ประธานตรวจ — ไปที่ขั้นที่ 7</p>}
      </section>
      <section className="card" aria-label="8.2 แจกกรรมการ">
        <h2 style={{ margin: 0 }}>8.2 แจกกรรมการอ่านล่วงหน้า</h2>
        {m.distributed
          ? <p role="status" style={{ margin: 0 }}>✅ แจกทาง {m.distributed.channel} เมื่อ {fmt(m.distributed.at)} <button type="button" className="mini" onClick={() => save({ distributed: undefined })}>ยกเลิก</button></p>
          : <div className="row"><select aria-label="ช่องทางแจก" className="input" value={ch} onChange={(e) => setCh(e.target.value)}>{CHANNELS_DIST.map((c) => <option key={c}>{c}</option>)}</select>
              <button type="button" className="btn btn--gold" disabled={!ok} onClick={() => save({ distributed: { at: Date.now(), channel: ch } })}>บันทึกว่าแจกแล้ว</button></div>}
      </section>
      <section className="card" aria-label="8.3 ข้อสังเกตจากกรรมการ">
        <h2 style={{ margin: 0 }}>8.3 ข้อสังเกต/ข้อคัดค้านก่อนประชุม</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>{(m.objections ?? []).map((o, i) => <li key={i}>{o} <button type="button" className="mini" aria-label={`ลบข้อสังเกต ${i + 1}`} onClick={() => save({ objections: (m.objections ?? []).filter((_, j) => j !== i) })}>ลบ</button></li>)}</ul>
        {(m.objections ?? []).length === 0 && <p className="muted small" style={{ margin: 0 }}>ยังไม่มีข้อสังเกต</p>}
        <div className="row"><input aria-label="ข้อสังเกตใหม่" className="input" value={ob} onChange={(e) => setOb(e.target.value)} placeholder="เช่น แก้ชื่อผู้ลาในวาระที่ 2" />
          <button type="button" className="mini" disabled={!ob.trim()} onClick={() => { save({ objections: [...(m.objections ?? []), ob.trim()] }); setOb('') }}>＋ เพิ่ม</button></div>
      </section>
      <section className="card" aria-label="8.4 บรรจุวาระรับรอง">
        <h2 style={{ margin: 0 }}>8.4 บรรจุ “รับรองรายงานการประชุม” ในการประชุมครั้งถัดไป</h2>
        <label className="row"><input type="checkbox" checked={!!m.queuedNext} onChange={(e) => save({ queuedNext: e.target.checked })} /> <b>บรรจุวาระรับรองแล้ว</b></label>
        <p className="muted small" style={{ margin: 0 }}>{m.closed?.next ? `ประชุมครั้งถัดไป: ${m.closed.next}` : 'ยังไม่ได้กำหนดนัดครั้งถัดไป (ขั้นที่ 6.6)'} · ระบบจะนำรายงานฉบับนี้ไปแสดงในขั้นที่ 4 ของการประชุมครั้งถัดไป</p>
      </section>
      <section className="card" aria-label="8.5 ติดตามงาน">
        <h2 style={{ margin: 0 }}>8.5 ติดตามงานที่มอบหมาย</h2>
        {tasks.length === 0 ? <p className="muted small" style={{ margin: 0 }}>ไม่มีงานที่มอบหมายจากมติ</p> : tasks.map((t) => (
          <label key={t.id} className="row" style={{ margin: '0.2rem 0' }}><input type="checkbox" checked={t.done} onChange={(e) => toggle(t.id, e.target.checked)} /> {t.title} — {t.assignee}{t.due ? ` (ภายใน ${letterDate(t.due)})` : ''}</label>
        ))}
      </section>
    </>
  )
}
