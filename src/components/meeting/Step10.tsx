import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StepProps } from './Step1'
import { assignedTasks, letterDate, stepStatuses } from '../../lib/meetings'

const ACC = { ทั่วไป: 'ทุกคนที่เข้าระบบอ่านได้', ภายใน: 'เฉพาะกรรมการและผู้ได้รับมอบหมาย', ลับ: 'เฉพาะผู้ดูแลระบบ' } as const

/** ขั้น 10: เก็บเอกสาร — รายการไฟล์ ทะเบียนมติ/งาน ระดับการเข้าถึง ค้นย้อนหลัง และปิดแฟ้ม */
export default function Step10({ m, save, list }: StepProps) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const toLibrary = () => navigate('/meeting/1/5', { state: { importMeeting: { title: `รายงานการประชุม${m.name ? ` ${m.name}` : ''} ครั้งที่ ${m.no}/${m.year}`, date: m.date || '', note: `ฉบับสมบูรณ์ที่ลงนามแล้ว · ${m.name} ครั้งที่ ${m.no}/${m.year}` } } })
  const st = stepStatuses(m, list)
  const files = [
    { t: 'ระเบียบวาระ', ok: st[2].state === 'done' }, { t: 'หนังสือแจ้งประชุม', ok: st[3].state === 'done' }, { t: 'ใบลงชื่อ/บันทึกประชุม', ok: st[6].state === 'done' },
    { t: 'ร่างรายงาน (ประวัติ)', ok: (m.drafts?.length ?? 0) > 0 }, { t: 'ฉบับสมบูรณ์ที่ลงนาม', ok: st[9].state === 'done' },
  ]
  const reg = list.filter((x) => !x.deleted).flatMap((x) => x.agenda.filter((a) => a.minute?.result).map((a) => ({ key: `${x.id}-${a.id}`, mt: `${x.name} ${x.no}/${x.year}`, title: a.title, res: a.minute!.result!, who: a.minute!.assignee, done: !!a.minute!.done })))
  const hits = q.trim() ? reg.filter((r) => `${r.mt} ${r.title} ${r.res} ${r.who ?? ''}`.includes(q.trim())) : reg
  const open = assignedTasks(m).filter((t) => !t.done).length
  const ready = st[9].state === 'done'
  return (
    <>
      <section className="card" aria-label="10.1 แฟ้มการประชุม">
        <h2 style={{ margin: 0 }}>10.1 แฟ้ม {m.name} ครั้งที่ {m.no}/{m.year}</h2>
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{files.map((f) => <li key={f.t}>{f.ok ? '✅' : '⬜'} {f.t}</li>)}</ul>
        <p className="muted small" style={{ margin: '0.2rem 0 0' }}>ดาวน์โหลด PDF ของแต่ละฉบับได้จากขั้นตอนที่เกี่ยวข้อง (2, 3, 4, 7, 9)</p>
      </section>
      <section className="card" aria-label="10.2 ระดับการเข้าถึง">
        <h2 style={{ margin: 0 }}>10.2 ระดับการเข้าถึง</h2>
        <div className="field"><label htmlFor="s10-a">ระดับ</label>
          <select id="s10-a" className="input" value={m.access ?? 'ภายใน'} onChange={(e) => save({ access: e.target.value as keyof typeof ACC })}>{(Object.keys(ACC) as (keyof typeof ACC)[]).map((k) => <option key={k} value={k}>{k} — {ACC[k]}</option>)}</select></div>
      </section>
      <section className="card" aria-label="10.3 ทะเบียนมติ">
        <h2 style={{ margin: 0 }}>10.3 ทะเบียนมติและค้นย้อนหลัง</h2>
        <input aria-label="ค้นหามติ" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาจากชื่อวาระ มติ หรือผู้รับผิดชอบ" />
        {hits.length === 0 ? <p className="muted small" style={{ margin: 0 }}>ไม่พบรายการ</p> : (
          <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>{hits.map((r) => <li key={r.key}>{r.mt} · {r.title} · <b>{r.res}</b>{r.who ? ` · ${r.who}` : ''}{r.who ? (r.done ? ' ✓ เสร็จ' : ' ⏳') : ''}</li>)}</ul>
        )}
      </section>
      <section className="card" aria-label="10.4 ปิดแฟ้ม">
        <h2 style={{ margin: 0 }}>10.4 ปิดแฟ้ม</h2>
        {m.archived
          ? <><p role="status" style={{ margin: 0 }}>✅ เก็บเอกสารแล้ว เมื่อ {letterDate(new Date(m.archived.at).toISOString().slice(0, 10))} <button type="button" className="mini" onClick={() => save({ archived: undefined })}>เปิดแฟ้มอีกครั้ง</button></p><button type="button" className="btn btn--gold" onClick={toLibrary}>📚 นำเข้าคลังเอกสาร ›</button></>
          : <button type="button" className="btn btn--gold" disabled={!ready} onClick={() => { save({ archived: { at: Date.now() } }); toLibrary() }}>🗄️ เก็บเอกสารเข้าแฟ้ม แล้วนำเข้าคลังเอกสาร</button>}
        {!ready && !m.archived && <p className="muted small" style={{ margin: 0 }}>ต้องรับรองและลงนามฉบับสมบูรณ์ (ขั้นที่ 9) ก่อน</p>}
        {open > 0 && <p className="small" style={{ margin: 0 }}>มีงานที่มอบหมายยังไม่เสร็จ {open} รายการ (ติดตามต่อที่ขั้นที่ 8)</p>}
      </section>
    </>
  )
}
