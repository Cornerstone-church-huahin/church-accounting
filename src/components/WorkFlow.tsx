import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sheet from './Sheet'
import { useFlowTicks } from '../lib/data'
import { newId, todayISO } from '../lib/money'
import type { FlowStep, FlowTicks } from '../lib/types'

/** ลำดับงานในตัว: ประชุมธรรมกิจ/เก็บเอกสารเป็นหน้าเฉพาะ (แก้ไม่ได้) · หนังสือเชิญเป็นลำดับงานปกติที่แก้/ลบได้ */
const FIXED = [
  { key: 'meeting', to: '/meeting/1/1/meeting', icon: '🗓️', title: 'ประชุมธรรมกิจ', blurb: 'เช็คลิสต์ 10 ขั้น ตั้งแต่เตรียมประชุมจนเก็บเอกสาร', created: 0 },
  { key: 'file', to: '/meeting/1/3', icon: '🗄️', title: 'เก็บเอกสาร', blurb: 'เข้าสู่คลังเอกสารโดยตรง', created: 2 },
]
const INVITE_DEFAULT: FlowTicks = {
  id: 'invite', updated: 0, created: 1, ticks: [], icon: '✉️', title: 'หนังสือเชิญ', toLibrary: true,
  steps: [
    { id: 'topic', t: 'กำหนดเรื่อง วัน เวลา และสถานที่', hint: 'สร้างหรือเลือกการประชุมก่อน เพื่อให้หนังสือเชิญใช้ข้อมูลชุดเดียวกัน', to: '/meeting/1/1/meeting', toLabel: 'ไปประชุมธรรมกิจ ›' },
    { id: 'draft', t: 'ร่างหนังสือเชิญ', hint: 'ใช้ขั้น “แจ้งประชุม” ในเช็คลิสต์การประชุม สร้างหนังสือและดูตัวอย่างหน้ากระดาษ', to: '/meeting/1/1/3', toLabel: 'ไปขั้นแจ้งประชุม ›' },
    { id: 'agenda', t: 'แนบระเบียบวาระที่ประธานตรวจแล้ว', hint: 'ให้ประธานเห็นชอบวาระก่อนส่ง' },
    { id: 'sign', t: 'ประธานตรวจและลงนาม', hint: 'ตรวจชื่อ วันที่ เวลา สถานที่ ให้ถูกต้อง' },
    { id: 'send', t: 'ส่งให้ผู้รับ', hint: 'LINE อีเมล หรือเอกสารกระดาษ ตามที่ตกลง' },
    { id: 'reply', t: 'ติดตามการตอบรับและการลา', hint: 'จดว่าใครมา ใครลา ใครยังไม่ตอบ' },
    { id: 'file', t: 'เก็บสำเนาเข้าคลังเอกสาร', hint: 'ติ๊กข้อนี้แล้วระบบพาไปคลังเอกสารเพื่อนำเข้าไฟล์ทันที' },
  ],
}

/** ลำดับงานที่แก้ได้ทั้งหมด: ค่าเริ่มต้น (หนังสือเชิญ) ซ้อนด้วยที่บันทึกไว้ · ที่ลบแล้วไม่แสดง */
function useFlows() {
  const t = useFlowTicks()
  const stored = t.all
  const rows = [INVITE_DEFAULT, ...stored.filter((x) => x.id !== 'invite')].map((d) => (d.id === 'invite' ? { ...INVITE_DEFAULT, ...(stored.find((x) => x.id === 'invite') ?? {}) } : d))
    .map((x) => ({ ...x, steps: x.steps ?? [] } as FlowTicks & { steps: FlowStep[] }))
    .filter((x) => !x.deleted)
  return { ...t, flows: rows }
}

/** งานเลขา › ลำดับงาน: การ์ดเรียงใหม่สุดไว้บน · เลือกจากตัวเลือกเพื่อเรียกเฉพาะการ์ด · เพิ่ม แก้ ลบได้ */
export function WorkflowMenu() {
  const f = useFlows()
  const [pick, setPick] = useState('')
  const [form, setForm] = useState<FlowTicks | 'new' | null>(null)
  const [msg, setMsg] = useState('')
  const cards = [
    ...FIXED.map((x) => ({ key: x.key, to: x.to, icon: x.icon, title: x.title, blurb: x.blurb, created: x.created, flow: undefined as FlowTicks | undefined })),
    ...f.flows.map((x) => ({ key: x.id, to: x.id === 'invite' ? '/meeting/1/1/invite' : `/meeting/1/1/f-${x.id}`, icon: x.icon || '📋', title: x.title || 'ลำดับงาน', blurb: `${x.steps.length} ขั้น · ติ๊กแล้ว ${x.steps.filter((s) => x.ticks.includes(s.id)).length}`, created: x.created ?? 0, flow: x })),
  ].sort((a, b) => b.created - a.created)
  const shown = pick ? cards.filter((c) => c.key === pick) : cards
  const remove = (x: FlowTicks) => { if (window.confirm(`ลบลำดับงาน “${x.title}” ?`)) setMsg(f.put([{ ...x, deleted: true, updated: Date.now() }]) ? '' : 'ไม่มีสิทธิ์ลบ') }
  return (
    <>
      <div className="page-head no-print"><h1>📋 ลำดับงาน</h1><Link to="/meeting/1" className="mini">‹ งานเลขา</Link></div>
      <section className="card" aria-label="เลือกลำดับงาน">
        <div className="field" style={{ margin: 0 }}><label htmlFor="wf-pick">เลือกเรียกเฉพาะการ์ด</label>
          <select id="wf-pick" className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">ทุกลำดับงาน ({cards.length})</option>
            {cards.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.title}</option>)}
          </select></div>
        <div className="row" style={{ marginTop: '0.5rem' }}><button type="button" className="btn btn--gold" onClick={() => setForm('new')}>➕ เพิ่มลำดับงาน</button></div>
      </section>
      {msg && <p className="error" role="alert">{msg}</p>}
      <ul className="wflist" aria-label="รายการลำดับงาน">
        {shown.map((c) => (
          <li key={c.key} className="wfitem">
            <Link to={c.to} className="wfcard" aria-label={`เปิด ${c.title}`}>
              <span className="wfcard__icon" aria-hidden="true">{c.icon}</span>
              <span className="wfcard__t"><b>{c.title}</b><small>{c.blurb}</small></span>
              <span aria-hidden="true">›</span>
            </Link>
            {!c.flow && <span className="wfitem__act" aria-hidden="true" />}
            {c.flow && (
              <span className="wfitem__act">
                <button type="button" className="mini" aria-label={`แก้ไข ${c.title}`} onClick={() => setForm(c.flow!)}>✏️</button>
                <button type="button" className="mini" aria-label={`ลบ ${c.title}`} onClick={() => remove(c.flow!)}>🗑️</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {form && <FlowForm flow={form === 'new' ? null : form} onClose={() => setForm(null)} onSave={(x) => { const ok = f.put([x]); setMsg(ok ? '' : 'ไม่มีสิทธิ์บันทึก'); if (ok) setForm(null); return ok }} />}
    </>
  )
}

/** แปลงบรรทัดข้อความเป็นขั้น: “ชื่อขั้น | คำอธิบาย” · ขั้นที่ชื่อเดิมคง id/ลิงก์ไว้ (ติ๊กไม่หาย) */
function parseSteps(text: string, old: FlowStep[]): FlowStep[] {
  const used = new Set<string>()
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const [t, ...rest] = l.split('|'), title = t.trim(), hint = rest.join('|').trim()
    const prev = old.find((o) => o.t === title && !used.has(o.id))
    if (prev) used.add(prev.id)
    return { ...(prev ?? { id: `s${Date.now().toString(36)}${i}` }), t: title, hint: hint || undefined } as FlowStep
  })
}
const stepsText = (steps: FlowStep[]) => steps.map((s) => (s.hint ? `${s.t} | ${s.hint}` : s.t)).join('\n')

function FlowForm({ flow, onClose, onSave }: { flow: FlowTicks | null; onClose: () => void; onSave: (x: FlowTicks) => boolean }) {
  const [title, setTitle] = useState(flow?.title ?? '')
  const [icon, setIcon] = useState(flow?.icon ?? '📋')
  const [text, setText] = useState(stepsText(flow?.steps ?? []))
  const [toLibrary, setToLibrary] = useState(!!flow?.toLibrary)
  const [msg, setMsg] = useState('')
  const save = () => {
    const steps = parseSteps(text, flow?.steps ?? [])
    if (!title.trim()) return setMsg('ใส่ชื่อลำดับงาน')
    if (steps.length === 0) return setMsg('ใส่ขั้นตอนอย่างน้อย 1 ขั้น (บรรทัดละ 1 ขั้น)')
    onSave({ ...(flow ?? { id: newId('flow'), ticks: [], created: Date.now() }), title: title.trim(), icon: icon.trim() || '📋', steps, toLibrary, ticks: (flow?.ticks ?? []).filter((id) => steps.some((s) => s.id === id)), updated: Date.now() })
  }
  return (
    <Sheet title={flow ? 'แก้ไขลำดับงาน' : 'เพิ่มลำดับงาน'} onClose={onClose}>
      <div className="field"><label htmlFor="wf-title">ชื่อลำดับงาน</label><input id="wf-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น เตรียมงานคริสต์มาส" /></div>
      <div className="field"><label htmlFor="wf-icon">ไอคอน (อีโมจิ)</label><input id="wf-icon" className="input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} /></div>
      <div className="field"><label htmlFor="wf-steps">ขั้นตอนตามลำดับ (บรรทัดละ 1 ขั้น · เติมคำอธิบายหลังเครื่องหมาย | ได้)</label><textarea id="wf-steps" className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'ตั้งคณะทำงาน | ประชุมผู้รับผิดชอบ\nวางแผนงบประมาณ\n…'} /></div>
      <label className="rolechk"><input type="checkbox" checked={toLibrary} onChange={(e) => setToLibrary(e.target.checked)} /><span>ติ๊กขั้นสุดท้ายแล้วส่งต่อไปคลังเอกสาร</span></label>
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row"><button type="button" className="btn btn--gold" onClick={save}>บันทึก</button><button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button></div>
    </Sheet>
  )
}

/** หน้าเช็คลิสต์ของลำดับงานหนึ่งใบ — ติ๊กทีละข้อ (บันทึกร่วมกัน) · ถ้าตั้งไว้ ขั้นสุดท้ายส่งต่อคลังเอกสาร */
export function FlowPage({ id }: { id: string }) {
  const f = useFlows()
  const navigate = useNavigate()
  const x = f.flows.find((y) => y.id === id)
  if (!x) return <><div className="page-head no-print"><h1>ลำดับงาน</h1><Link to="/meeting/1/1" className="mini">‹ ลำดับงาน</Link></div><p className="empty">ไม่พบลำดับงานนี้</p></>
  const done = x.steps.filter((s) => x.ticks.includes(s.id)).length
  const set = (next: string[]) => f.put([{ ...x, ticks: next, updated: Date.now() }])
  const toggle = (s: FlowStep, i: number) => {
    const on = !x.ticks.includes(s.id)
    if (!set(on ? [...x.ticks, s.id] : x.ticks.filter((k) => k !== s.id))) return
    if (on && x.toLibrary && i === x.steps.length - 1) navigate('/meeting/1/3', { state: { importMeeting: { title: x.title, date: todayISO(), note: `จากลำดับงาน ${x.title}` } } })
  }
  return (
    <>
      <div className="page-head no-print"><h1>{x.icon} {x.title}</h1><Link to="/meeting/1/1" className="mini">‹ ลำดับงาน</Link></div>
      <section className="card mcard" aria-label={`ลำดับงาน${x.title}`}>
        <div className="mcard__head"><div><b>ลำดับสิ่งที่ต้องทำ</b><div className="small muted">ติ๊กเมื่อทำเสร็จแต่ละข้อ</div></div><span className="mcard__n" aria-label={`ทำแล้ว ${done} จาก ${x.steps.length} ข้อ`}>{done}/{x.steps.length}</span></div>
        <ol className="mcheck" aria-label={`เช็คลิสต์${x.title}`}>
          {x.steps.map((s, i) => {
            const on = x.ticks.includes(s.id)
            return (
              <li key={s.id}>
                <div className={`mcheck__row mcheck__row--${on ? 'done' : 'todo'}`}>
                  <button type="button" className="mcheck__box" role="checkbox" aria-checked={on} aria-label={`${i + 1}. ${s.t}`} onClick={() => toggle(s, i)}>{on ? '✓' : ''}</button>
                  <span className="mcheck__t"><b>{i + 1}. {s.t}</b>{s.hint && <small>{s.hint}</small>}{s.to && <Link to={s.to} className="small">{s.toLabel}</Link>}</span>
                </div>
              </li>
            )
          })}
        </ol>
        {done > 0 && <div className="row" style={{ marginTop: '0.4rem' }}><button type="button" className="mini" onClick={() => { if (window.confirm('เริ่มเช็คลิสต์ใหม่ (ล้างเครื่องหมายทั้งหมด) ?')) set([]) }}>↺ เริ่มใหม่</button></div>}
      </section>
    </>
  )
}
