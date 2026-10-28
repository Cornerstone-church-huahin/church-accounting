import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sheet from './Sheet'
import { useDocCategories, useDocLibrary, useFlowTicks } from '../lib/data'
import { cleanPrefix, nextDocNo } from '../lib/docLibrary'
import { be, newId, todayISO } from '../lib/money'
import type { FlowStep, FlowTicks } from '../lib/types'

/** ลำดับงานในตัว: ประชุมธรรมกิจเป็นหน้าเฉพาะ (แก้ไม่ได้) · หนังสือเชิญเป็นลำดับงานปกติที่แก้/ลบได้ */
const FIXED = [
  { key: 'meeting', to: '/meeting/1/1/meeting', icon: '🗓️', title: 'ประชุมธรรมกิจ', blurb: 'เช็คลิสต์ 10 ขั้น ตั้งแต่เตรียมประชุมจนเก็บเอกสาร', created: 0 },
]
const INVITE_DEFAULT: FlowTicks = {
  id: 'invite', updated: 0, created: 1, ticks: [], icon: '✉️', title: 'หนังสือเชิญร่วมงาน',
  steps: [
    { id: 'head', t: 'หัวจดหมาย (ถ้ามี)', hint: 'ใช้หัว-ท้ายจดหมายของคริสตจักรที่แอดมินตั้งไว้ · ไม่มีก็ใช้หัวแบบข้อความ', to: '/meeting/1/1/meeting', toLabel: 'ตั้งค่าหัวจดหมาย ›' },
    { id: 'number', t: 'เลขที่หนังสือและลำดับ', hint: 'ดูเลขล่าสุดและเลขถัดไปจากคลังเอกสาร เพื่อไม่ให้เลขซ้ำ', kind: 'number', to: '/meeting/1/3', toLabel: 'เปิดคลังเอกสาร ›' },
    { id: 'date', t: 'วันที่ของหนังสือ', hint: 'ตั้งวันที่เบื้องต้นไว้ก่อนได้ แก้ภายหลังก่อนลงนามได้', kind: 'date' },
    { id: 'subject', t: 'เรื่อง และเรียน', hint: 'ระบุเรื่อง (เช่น ขอเชิญร่วมงาน…) และชื่อ ตำแหน่ง ของผู้ใหญ่ที่เชิญ' },
    { id: 'body', t: 'เนื้อหาการเชิญ', hint: 'ชื่องาน วัน เวลา สถานที่ เหตุผลที่เชิญ และสิ่งที่ขอ (เช่น กำหนดการ การแต่งกาย)' },
    { id: 'layout', t: 'ตรวจข้อความและจัดหน้าให้พอดีรอลงนาม', hint: 'ตรวจคำผิด ชื่อ วันที่ แล้วจัดให้พอดีหน้ากระดาษ เว้นที่ให้ประธานธรรมกิจลงนาม' },
    { id: 'contact', t: 'หมายเหตุการติดต่อด้านล่าง', hint: 'ชื่อผู้ประสานงาน เบอร์โทร ช่องทางตอบรับ ให้ครบถ้วน' },
    { id: 'sign', t: 'ประธานธรรมกิจลงนาม', hint: 'ส่งให้ประธานตรวจและลงนามตามที่จัดไว้' },
    { id: 'pdf', t: 'สร้างไฟล์ PDF', hint: 'ทำหนังสือที่ลงนามแล้วให้เป็นไฟล์ PDF (พิมพ์เป็น PDF หรือสแกน) เพื่อส่งและเก็บ' },
    { id: 'send', t: 'ส่งหนังสือและติดตามการตอบรับ', hint: 'ส่งตามช่องทางที่ตกลง และจดว่าผู้ใหญ่ตอบรับหรือไม่' },
  ],
}
/** หนังสือเชิญรุ่นแรกเคยบันทึกไว้เป็นหนังสือเชิญประชุม: ถ้าขั้นตอนยังเป็นของเดิมทุกขั้น ให้เปลี่ยนเป็นลำดับใหม่ (ชื่อที่แก้เองยังคงไว้ถ้าไม่ใช่ชื่อเดิม) */
const OLD_INVITE = ['topic', 'draft', 'agenda', 'sign', 'send', 'reply']
/** ลำดับรุ่นที่สอง (ยังไม่มีขั้นสร้างไฟล์ PDF): แทรก PDF เป็นขั้นที่ 9 โดยคงชื่อ/ติ๊กเดิม */
const V2_INVITE = ['head', 'number', 'date', 'subject', 'body', 'layout', 'contact', 'sign', 'send']
const isV2Invite = (x?: FlowTicks) => !!x?.steps && x.steps.length === V2_INVITE.length && V2_INVITE.every((id, i) => x.steps![i]?.id === id)
const isOldInvite = (x?: FlowTicks) => !!x?.steps && x.steps.length >= OLD_INVITE.length && OLD_INVITE.every((id, i) => x.steps![i]?.id === id)

/** ขั้นสุดท้ายของทุกลำดับงาน (ใส่ให้เสมอ แก้/ลบไม่ได้): เก็บเอกสาร — ติ๊กแล้วไปคลังเอกสาร */
const FILE_STEP: FlowStep = { id: 'file', t: 'เก็บเอกสาร', hint: 'นำเข้าไฟล์เข้าคลังเอกสาร หรือดาวน์โหลดเก็บเป็นเอกสารจริงไว้ด้วย · ติ๊กแล้วระบบพาไปคลังเอกสาร' }

/** ลำดับงานที่แก้ได้ทั้งหมด: ค่าเริ่มต้น (หนังสือเชิญ) ซ้อนด้วยที่บันทึกไว้ · ที่ลบแล้วไม่แสดง */
function useFlows() {
  const t = useFlowTicks()
  const stored = t.all
  const inv = stored.find((x) => x.id === 'invite')
  const invite: FlowTicks = isOldInvite(inv)
    ? { ...INVITE_DEFAULT, ...inv, title: ['หนังสือเชิญ', 'ทำหนังสือเชิญ'].includes(inv!.title ?? '') ? INVITE_DEFAULT.title : inv!.title, steps: INVITE_DEFAULT.steps, ticks: (inv!.ticks ?? []).filter((id) => id === 'file' || INVITE_DEFAULT.steps!.some((s) => s.id === id)) }
    : isV2Invite(inv)
      ? { ...INVITE_DEFAULT, ...inv, steps: [...inv!.steps!.slice(0, 8), INVITE_DEFAULT.steps!.find((x) => x.id === 'pdf')!, inv!.steps![8]] }
      : { ...INVITE_DEFAULT, ...(inv ?? {}) }
  const rows = [invite, ...stored.filter((x) => x.id !== 'invite')]
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
    ...f.flows.map((x) => ({ key: x.id, to: x.id === 'invite' ? '/meeting/1/1/invite' : `/meeting/1/1/f-${x.id}`, icon: x.icon || '📋', title: x.title || 'ลำดับงาน', blurb: `${x.steps.length + 1} ขั้น (รวมเก็บเอกสาร) · ติ๊กแล้ว ${[...x.steps, FILE_STEP].filter((s) => x.ticks.includes(s.id)).length}`, created: x.created ?? 0, flow: x })),
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
  const [msg, setMsg] = useState('')
  const save = () => {
    const steps = parseSteps(text, flow?.steps ?? [])
    if (!title.trim()) return setMsg('ใส่ชื่อลำดับงาน')
    if (steps.length === 0) return setMsg('ใส่ขั้นตอนอย่างน้อย 1 ขั้น (บรรทัดละ 1 ขั้น)')
    onSave({ ...(flow ?? { id: newId('flow'), ticks: [], created: Date.now() }), title: title.trim(), icon: icon.trim() || '📋', steps, ticks: (flow?.ticks ?? []).filter((id) => steps.some((s) => s.id === id)), updated: Date.now() })
  }
  return (
    <Sheet title={flow ? 'แก้ไขลำดับงาน' : 'เพิ่มลำดับงาน'} onClose={onClose}>
      <div className="field"><label htmlFor="wf-title">ชื่อลำดับงาน</label><input id="wf-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น เตรียมงานคริสต์มาส" /></div>
      <div className="field"><label htmlFor="wf-icon">ไอคอน (อีโมจิ)</label><input id="wf-icon" className="input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} /></div>
      <div className="field"><label htmlFor="wf-steps">ขั้นตอนตามลำดับ (บรรทัดละ 1 ขั้น ไม่ต้องใส่ “เก็บเอกสาร” · เติมคำอธิบายหลังเครื่องหมาย | ได้)</label><textarea id="wf-steps" className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'ตั้งคณะทำงาน | ประชุมผู้รับผิดชอบ\nวางแผนงบประมาณ\n…'} /></div>
      <p className="small muted" style={{ margin: 0 }}>ขั้นสุดท้าย “เก็บเอกสาร” (ส่งเข้าคลังเอกสาร) ใส่ให้ทุกลำดับงานอัตโนมัติ</p>
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row"><button type="button" className="btn btn--gold" onClick={save}>บันทึก</button><button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button></div>
    </Sheet>
  )
}

/** หน้าเช็คลิสต์ของลำดับงานหนึ่งใบ — ติ๊กทีละข้อ (บันทึกร่วมกัน) · ถ้าตั้งไว้ ขั้นสุดท้ายส่งต่อคลังเอกสาร */
export function FlowPage({ id }: { id: string }) {
  const f = useFlows()
  const lib = useDocLibrary(), cats = useDocCategories()
  const navigate = useNavigate()
  const x = f.flows.find((y) => y.id === id)
  if (!x) return <><div className="page-head no-print"><h1>ลำดับงาน</h1><Link to="/meeting/1/1" className="mini">‹ ลำดับงาน</Link></div><p className="empty">ไม่พบลำดับงานนี้</p></>
  const steps = [...x.steps, FILE_STEP]
  const done = steps.filter((s) => x.ticks.includes(s.id)).length
  const set = (next: string[]) => f.put([{ ...x, ticks: next, updated: Date.now() }])
  /** เลขที่หนังสือจากคลังเอกสาร: หมวดที่ชื่อมี “เชิญ” (ถ้าไม่มีใช้ทั้งคลัง) → เลขล่าสุดและเลขถัดไป */
  const cat = cats.list.find((c) => c.name.includes('เชิญ'))
  const pool = cat ? lib.list.filter((d) => d.category === cat.name) : lib.list
  const latest = [...pool].sort((a, b) => b.date.localeCompare(a.date))[0]?.no
  const nextNo = nextDocNo(pool, cleanPrefix(cat?.prefix ?? '') || be(Number(todayISO().slice(0, 4))))
  const toggle = (s: FlowStep) => {
    const on = !x.ticks.includes(s.id)
    if (!set(on ? [...x.ticks, s.id] : x.ticks.filter((k) => k !== s.id))) return
    if (on && s.id === 'file') navigate('/meeting/1/3', { state: { importMeeting: { title: x.title, date: x.date || todayISO(), note: `จากลำดับงาน ${x.title}` } } })
  }
  return (
    <>
      <div className="page-head no-print"><h1>{x.icon} {x.title}</h1><Link to="/meeting/1/1" className="mini">‹ ลำดับงาน</Link></div>
      <section className="card mcard" aria-label={`ลำดับงาน${x.title}`}>
        <div className="mcard__head"><div><b>ลำดับสิ่งที่ต้องทำ</b><div className="small muted">ติ๊กเมื่อทำเสร็จแต่ละข้อ</div></div><span className="mcard__n" aria-label={`ทำแล้ว ${done} จาก ${steps.length} ข้อ`}>{done}/{steps.length}</span></div>
        <ol className="mcheck" aria-label={`เช็คลิสต์${x.title}`}>
          {steps.map((s, i) => {
            const on = x.ticks.includes(s.id)
            return (
              <li key={s.id}>
                <div className={`mcheck__row mcheck__row--${on ? 'done' : 'todo'}`}>
                  <button type="button" className="mcheck__box" role="checkbox" aria-checked={on} aria-label={`${i + 1}. ${s.t}`} onClick={() => toggle(s)}>{on ? '✓' : ''}</button>
                  <span className="mcheck__t"><b>{i + 1}. {s.t}</b>{s.hint && <small>{s.hint}</small>}{s.to && <Link to={s.to} className="small">{s.toLabel}</Link>}{s.kind === 'number' && <small role="note">{cat ? `หมวด “${cat.name}”` : 'ทั้งคลังเอกสาร'} · เลขล่าสุด: <b>{latest || 'ยังไม่มี'}</b> · เลขถัดไป: <b>{nextNo}</b></small>}{s.kind === 'date' && <input type="date" className="input" aria-label="วันที่ของหนังสือ (เบื้องต้น)" value={x.date ?? ''} onChange={(e) => f.put([{ ...x, date: e.target.value, updated: Date.now() }])} style={{ maxWidth: '11rem', minHeight: '2.2rem' }} />}</span>
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
