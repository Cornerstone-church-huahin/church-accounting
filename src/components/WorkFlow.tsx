import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sheet from './Sheet'
import { useDocCategories, useDocLibrary, useFlowTicks } from '../lib/data'
import { cleanPrefix, nextDocNo } from '../lib/docLibrary'
import { LETTER_KINDS } from '../lib/letterKinds'
import { be, newId, todayISO } from '../lib/money'
import type { FlowStep, FlowTicks } from '../lib/types'

/** ลำดับงานในตัว: ประชุมธรรมกิจและหนังสือเชิญร่วมงานเป็นหน้าเฉพาะ (แก้/ลบไม่ได้) · หนังสือเชิญเป็นลำดับงานปกติที่แก้/ลบได้ */
const FIXED = [
  { key: 'meeting', to: '/meeting/1/1/meeting', icon: '🗓️', title: 'ประชุมธรรมกิจ', blurb: 'เช็คลิสต์ 10 ขั้น ตั้งแต่เตรียมประชุมจนเก็บเอกสาร', created: 0 },
  { key: 'invite', to: '/meeting/1/1/invite', icon: '✉️', title: 'หนังสือเชิญร่วมงาน', blurb: 'หน้าเดียว: เลขที่ วันที่ เรื่อง เรียน เนื้อหา ลงนาม → PDF → คลังเอกสาร', created: 1 },
  { key: 'notice', to: '/meeting/1/1/notice', icon: '📣', title: 'หนังสือแจ้งการประชุมคณะธรรมกิจ', blurb: 'หน้าเดียวแบบเดียวกับหนังสือเชิญ: เลขที่ วันที่ เรื่อง เรียน เนื้อหา ลงนาม → PDF → คลังเอกสาร', created: 2 },
]
/** ขั้นสุดท้ายของทุกลำดับงาน (ใส่ให้เสมอ แก้/ลบไม่ได้): เก็บเอกสาร — ติ๊กแล้วไปคลังเอกสาร */
const FILE_STEP: FlowStep = { id: 'file', t: 'เก็บเอกสาร', hint: 'นำเข้าไฟล์เข้าคลังเอกสาร หรือดาวน์โหลดเก็บเป็นเอกสารจริงไว้ด้วย · ติ๊กแล้วระบบพาไปคลังเอกสาร' }

/** ลำดับงานที่เพิ่มเอง (แก้/ลบได้) · ที่ลบแล้วไม่แสดง */
function useFlows() {
  const t = useFlowTicks()
  const stored = t.all
  const rows = stored.filter((x) => x.id !== 'invite' && !x.id.startsWith('hide:'))  // หนังสือเชิญร่วมงานเป็นหน้าเฉพาะแล้ว (ข้อมูลเช็คลิสต์รุ่นเดิมไม่ใช้)
    .map((x) => ({ ...x, steps: x.steps ?? [] } as FlowTicks & { steps: FlowStep[] }))
    .filter((x) => !x.deleted)
  /** การ์ดในตัว/การ์ดจากหมวดคลังที่ผู้ใช้ลบออก (ซ่อน) — เก็บเป็นรายการ hide:<key> · แสดงอีกครั้ง = ทำเครื่องหมายลบ */
  const hidden = new Set(stored.filter((x) => x.id.startsWith('hide:') && !x.deleted).map((x) => x.id.slice(5)))
  return { ...t, flows: rows, hidden }
}

/** งานเลขา › ลำดับงาน: การ์ดเรียงใหม่สุดไว้บน · เลือกจากตัวเลือกเพื่อเรียกเฉพาะการ์ด · เพิ่ม แก้ ลบได้ */
export function WorkflowMenu() {
  const f = useFlows()
  const cats = useDocCategories(), lib = useDocLibrary()
  const [pick, setPick] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [form, setForm] = useState<FlowTicks | 'new' | null>(null)
  const [msg, setMsg] = useState('')
  /** หมวดในคลังเอกสาร (ที่ไม่ใช่ของหนังสือเชิญ/แจ้งการประชุม) → การ์ดหนังสือของหมวดนั้น · ตามชื่อหมวดและตัวย่อที่ตั้งในคลัง */
  const catNames = [...new Set([...cats.list.filter((c) => !c.deleted).map((c) => c.name), ...lib.list.filter((d) => !d.deleted && d.category).map((d) => d.category)])].filter((n) => LETTER_KINDS.doc.isCat(n))
  const catCards = catNames.map((n, i) => {
    const c = cats.list.find((x) => !x.deleted && x.name === n)
    return { key: `cat:${n}`, to: `/meeting/1/1/cat-${encodeURIComponent(n)}`, icon: '📄', title: n, blurb: `เลขที่ ${cleanPrefix(c?.prefix ?? '') || 'ศอช'}.### ตามตัวย่อของหมวดในคลังเอกสาร`, created: -1 - i, flow: undefined as FlowTicks | undefined }
  })
  const allCards = [
    ...FIXED.map((x) => ({ key: x.key, to: x.to, icon: x.icon, title: x.title, blurb: x.blurb, created: x.created, flow: undefined as FlowTicks | undefined })),
    ...f.flows.map((x) => ({ key: x.id, to: x.id === 'invite' ? '/meeting/1/1/invite' : `/meeting/1/1/f-${x.id}`, icon: x.icon || '📋', title: x.title || 'ลำดับงาน', blurb: `${x.steps.length + 1} ขั้น (รวมเก็บเอกสาร) · ติ๊กแล้ว ${[...x.steps, FILE_STEP].filter((s) => x.ticks.includes(s.id)).length}`, created: x.created ?? 0, flow: x })),
    ...catCards,
  ]
  const cards = allCards.filter((c) => !f.hidden.has(c.key)).sort((a, b) => b.created - a.created)
  const hiddenCards = allCards.filter((c) => f.hidden.has(c.key))
  const hide = (c: { key: string; title: string }) => { if (window.confirm(`ลบการ์ด “${c.title}” ออกจากหน้านี้ ?\n(เอกสารที่เคยสร้างและคลังเอกสารไม่หาย · กด “แสดงการ์ดที่ลบ” เพื่อเอากลับมาได้)`)) setMsg(f.put([{ id: `hide:${c.key}`, ticks: [], updated: Date.now() }]) ? '' : 'ไม่มีสิทธิ์ลบ') }
  const unhide = (key: string) => { const it = f.all.find((x) => x.id === `hide:${key}`); if (it) f.put([{ ...it, deleted: true, updated: Date.now() }]); }
  const shown = pick ? cards.filter((c) => c.key === pick) : cards
  const remove = (x: FlowTicks) => { if (window.confirm(`ลบลำดับงาน “${x.title}” ?`)) setMsg(f.put([{ ...x, deleted: true, updated: Date.now() }]) ? '' : 'ไม่มีสิทธิ์ลบ') }
  return (
    <>
      <div className="page-head no-print"><h1>📋 สร้างเอกสาร</h1><Link to="/meeting/1" className="mini">‹ งานเลขา</Link></div>
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
            {!c.flow && <span className="wfitem__act"><button type="button" className="mini" aria-label={`ลบการ์ด ${c.title}`} onClick={() => hide(c)}>🗑️</button></span>}
            {c.flow && (
              <span className="wfitem__act">
                <button type="button" className="mini" aria-label={`แก้ไข ${c.title}`} onClick={() => setForm(c.flow!)}>✏️</button>
                <button type="button" className="mini" aria-label={`ลบ ${c.title}`} onClick={() => remove(c.flow!)}>🗑️</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {hiddenCards.length > 0 && <p className="no-print" style={{ margin: '0.5rem 0' }}><button type="button" className="mini" onClick={() => setShowHidden(true)}>↩︎ แสดงการ์ดที่ลบ ({hiddenCards.length})</button></p>}
      {showHidden && (
        <Sheet title="การ์ดที่ลบไว้" onClose={() => setShowHidden(false)}>
          {hiddenCards.length === 0 ? <p className="empty">ไม่มีการ์ดที่ลบไว้</p> : hiddenCards.map((c) => (
            <div key={c.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 6 }}><span>{c.icon} {c.title}</span><button type="button" className="btn btn--gold" onClick={() => unhide(c.key)}>แสดงอีกครั้ง</button></div>
          ))}
        </Sheet>
      )}
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
  if (!x) return <><div className="page-head no-print"><h1>สร้างเอกสาร</h1><Link to="/meeting/1/1" className="mini">‹ สร้างเอกสาร</Link></div><p className="empty">ไม่พบลำดับงานนี้</p></>
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
    if (on && s.id === 'file') navigate('/meeting/1/2', { state: { importMeeting: { title: x.title, date: x.date || todayISO(), note: `จากลำดับงาน ${x.title}` } } })
  }
  return (
    <>
      <div className="page-head no-print"><h1>{x.icon} {x.title}</h1><Link to="/meeting/1/1" className="mini">‹ สร้างเอกสาร</Link></div>
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
