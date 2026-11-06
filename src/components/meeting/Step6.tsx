import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLetters } from '../../lib/data'
import { agendaOf } from '../InviteLetter'
import type { StepProps } from './Step1'
import { TextField } from './fields'
import { mergeNoticeAgenda, orderedAgenda } from './docs'
import { attendance } from './minutes'
import Roster from './Roster'
import { blankAgenda, minuteComplete, moveAgenda } from '../../lib/meetings'
import type { MtAgenda, MtMinute, MtResult } from '../../lib/types'

/** แถบสีของวาระ (วนซ้ำ): bar = สีเข้ม · bg = พื้นอ่อน */
const TONES = [{ bar: '#1f5fbf', bg: '#e8f0fd' }, { bar: '#b36b00', bg: '#fff1d6' }, { bar: '#7b3fa0', bg: '#f1e8f8' }, { bar: '#0b7285', bg: '#e0f4f6' }, { bar: '#5f3dc4', bg: '#ece8fb' }, { bar: '#a0522d', bg: '#f8ebe3' }]   // ไม่ใช้สีเขียว (เขียว = วาระที่เสร็จแล้ว)
const RESULTS: MtResult[] = ['เห็นชอบ', 'ไม่เห็นชอบ', 'เลื่อนพิจารณา', 'มีเงื่อนไข']
/** บันทึกการประชุม 4 ส่วน (ทำตามลำดับ ไม่ข้ามได้): ใบลงชื่อผู้ร่วมประชุม → วาระ/สาระ/มติ → เลิกประชุม → สรุปและส่งไปรายงาน */
const PARTS = ['ใบลงชื่อผู้ร่วมประชุม', 'วาระ สาระ และมติ', 'เลิกประชุมและนัดครั้งต่อไป', 'สรุปและส่งไปรายงาน']

/** ขั้น 6: บันทึกประชุม — แถบล่างเป็นลำดับ 1–4 ของหน้านี้เอง เริ่มที่ 1 เสมอ ทำเสร็จส่วนไหนจึงเขียวและไปส่วนต่อไป */
export default function Step6({ m, save, list }: StepProps) {
  const navigate = useNavigate()
  const notices = useLetters('notice')
  const [pulled, setPulled] = useState('')
  const [openId, setOpenId] = useState('')   // วาระที่เสร็จแล้วแต่ผู้ใช้แตะเปิดดู
  const done = [!!m.rosterDone, !!m.agendaDone, !!m.closeDone, !!m.minutesDone]
  const current = done.findIndex((d) => !d) < 0 ? 3 : done.findIndex((d) => !d)   // ส่วนแรกที่ยังไม่เสร็จ
  const [sel, setSel] = useState<number | null>(null)
  const view = sel !== null && (sel <= current) ? sel : current
  const go = (i: number) => setSel(i)
  const present = attendance(m).present.length
  const patch = (id: string, p: Partial<MtMinute>) => save({ agenda: m.agenda.map((a: MtAgenda) => (a.id === id ? { ...a, minute: { ...a.minute, ...p } } : a)) })
  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.floor(Number(v)) || 0))
  const items = orderedAgenda(m)
  const doneCount = items.filter((x) => minuteComplete(x.item)).length
  /** กดปุ่มเหลือง = บันทึกส่วนนั้น (ยังอยู่หน้าเดิม) แล้วมีปุ่มเล็ก ย้อนกลับ/ต่อไป เท่านั้น */
  const notice = m.noticeLetterId ? notices.items.find((x) => x.id === m.noticeLetterId) : undefined
  /** ดึงวาระ + หัวข้อย่อย (5.1, 5.2 …) จากหนังสือแจ้งการประชุมของการประชุมนี้ — เติมเฉพาะที่ยังไม่มี ไม่ทับที่บันทึก/แก้แล้ว */
  const pull = () => {
    if (!notice) return
    const merged = mergeNoticeAgenda(m.agenda, agendaOf(notice), blankAgenda)
    const added = merged.length - m.agenda.length
    if (added > 0) save({ agenda: merged })
    setPulled(added > 0 ? `ดึงเพิ่ม ${added} หัวข้อ` : 'วาระตรงกับหนังสือแจ้งแล้ว')
  }
  /** ติ๊กวาระเสร็จ → แถบเป็นสีเขียว พับเนื้อหา แล้วเลื่อนไปวาระถัดไป */
  const finishAgenda = (id: string, on: boolean) => {
    save({ agenda: m.agenda.map((x: MtAgenda) => (x.id === id ? { ...x, done: on || undefined } : x)) })
    setOpenId('')
    if (on) { const k = items.findIndex((x) => x.item.id === id); const nx = items[k + 1]; if (nx) setTimeout(() => document.getElementById(`ag-${nx.item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }
  }
  const next = (i: number, patchDone: Partial<typeof m>) => { save(patchDone); setSel(i) }
  const step = (i: number, key: 'rosterDone' | 'agendaDone' | 'closeDone') => done[i] && (
    <div className="row no-print" style={{ justifyContent: 'space-between', margin: '0.4rem 0 0' }}>
      <button type="button" className="mini" onClick={() => { save({ [key]: undefined }); setSel(i) }}>‹ ย้อนกลับ (แก้ไข)</button>
      <button type="button" className="mini" onClick={() => setSel(i + 1)}>ต่อไป ›</button>
    </div>
  )
  const a = attendance(m)
  const bar = (
    <nav className="mcbar no-print" aria-label="ลำดับการบันทึกการประชุม">
      <div className="mcbar__dots" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {PARTS.map((t, i) => (
          <button key={t} type="button" disabled={i > current} onClick={() => go(i)} aria-label={`ส่วนที่ ${i + 1} ${t}${done[i] ? ' (เสร็จแล้ว)' : ''}`} aria-current={view === i ? 'step' : undefined}
            className={`mcbar__dot${done[i] ? ' mcbar__dot--done' : i === current ? ' mcbar__dot--partial' : ''}${view === i ? ' mcbar__dot--cur' : ''}`} style={{ cursor: i > current ? 'not-allowed' : 'pointer', opacity: i > current ? 0.5 : 1 }}>{done[i] ? '✓' : i + 1}</button>
        ))}
      </div>
      <div className="mcbar__cap">ครั้งที่ {m.no}/{m.year}{m.name ? ` · ${m.name}` : ''} · ส่วนที่ {view + 1}: {PARTS[view]}</div>
    </nav>
  )
  return (
    <>
      {view === 0 && <Roster m={m} save={save} list={list} onDone={() => next(0, { rosterDone: { at: Date.now() } })} nav={step(0, 'rosterDone')} />}
      {view === 1 && (<>
      <p className="small" role="status" style={{ margin: '0 0 0.5rem' }}>ส่วนที่ 2 · บันทึกแล้ว {doneCount}/{items.length} วาระ · ผู้มีสิทธิ์ที่มาประชุม {present} คน</p>
      {items.length === 0 && <p className="empty">ยังไม่มีวาระ — จัดวาระที่ขั้นที่ 2</p>}
      {items.map(({ label, item }, idx) => {
        const mi = item.minute ?? {}
        const votes = (mi.yes ?? 0) + (mi.no ?? 0) + (mi.abstain ?? 0)
        const dn = !!item.done
        const tone = TONES[idx % TONES.length]   // แถบสีของแต่ละวาระ (วนสี) เพื่อแยกวาระให้เห็นชัด
        return (
          <section key={item.id} id={`ag-${item.id}`} className="card agcard" aria-label={`วาระที่ ${label} ${item.title}`} style={{ borderLeft: `8px solid ${dn ? '#14573a' : tone.bar}`, padding: 0, overflow: 'hidden', background: dn ? '#f1faf5' : undefined }}>
            <div className="agband" style={{ background: dn ? '#1b7a52' : tone.bg, borderBottom: `3px solid ${dn ? '#14573a' : tone.bar}` }}>
              <div className="agband__top">
                <button type="button" className="agband__h" style={{ color: dn ? '#fff' : tone.bar }} aria-expanded={!dn || openId === item.id} onClick={() => setOpenId(openId === item.id ? '' : item.id)}><b>วาระที่ {label}</b> {item.title}</button>
                <label className="agtick" style={{ background: dn ? '#fff' : 'rgba(255,255,255,0.8)', color: dn ? '#14573a' : '#111' }}>
                  <input type="checkbox" checked={dn} aria-label={`วาระที่ ${label} เสร็จแล้ว`} onChange={(e) => finishAgenda(item.id, e.target.checked)} /> <span>{dn ? 'เสร็จแล้ว' : 'เสร็จ'}</span>
                </label>
              </div>
              <div className="agband__tools no-print">
                <button type="button" className="mini" aria-label={`เลื่อนวาระ ${item.title} ขึ้น`} onClick={() => save({ agenda: moveAgenda(m.agenda, item.id, -1) })}>↑</button>
                <button type="button" className="mini" aria-label={`เลื่อนวาระ ${item.title} ลง`} onClick={() => save({ agenda: moveAgenda(m.agenda, item.id, 1) })}>↓</button>
                <button type="button" className="mini" aria-label={`แก้ชื่อวาระ ${item.title}`} onClick={() => { const t = window.prompt('ชื่อวาระ', item.title); if (t && t.trim()) save({ agenda: m.agenda.map((x: MtAgenda) => (x.id === item.id ? { ...x, title: t.trim() } : x)) }) }}>✏️ แก้ชื่อ</button>
                <button type="button" className="mini" aria-label={`ลบวาระ ${item.title}`} onClick={() => { if (window.confirm(`ลบวาระ “${item.title}” ?`)) save({ agenda: m.agenda.filter((x: MtAgenda) => x.id !== item.id && x.parentId !== item.id) }) }}>🗑️</button>
              </div>
            </div>
            {(!dn || openId === item.id) && <div className="agbody">
            <p className="muted small" style={{ margin: '0.1rem 0 0.4rem' }}>{item.group} · เพื่อ{item.purpose}</p>
            <TextField id={`ms-${item.id}`} label={`${label}.1 สาระสำคัญ`} multiline rows={3} value={mi.summary} onCommit={(v) => patch(item.id, { summary: v.trim() || undefined })} placeholder="สรุปประเด็นที่เกี่ยวข้องกับการพิจารณา" />
            <TextField id={`mp-${item.id}`} label={`${label}.2 ข้อเสนอให้พิจารณา`} multiline rows={2} value={mi.proposal} onCommit={(v) => patch(item.id, { proposal: v.trim() || undefined })} />
            <div className="field"><label htmlFor={`mr-${item.id}`}>{label}.3 มติที่ประชุม</label>
              <select id={`mr-${item.id}`} className="input" value={mi.result ?? ''} onChange={(e) => patch(item.id, { result: (e.target.value || undefined) as MtResult | undefined })}>
                <option value="">— ยังไม่มีมติ —</option>{RESULTS.map((r) => <option key={r}>{r}</option>)}
              </select></div>
            {mi.result === 'มีเงื่อนไข' && <TextField id={`mc-${item.id}`} label="เงื่อนไข" value={mi.condition} onCommit={(v) => patch(item.id, { condition: v.trim() || undefined })} />}
            <p className="small" style={{ margin: '0.3rem 0 0.1rem' }}><b>{label}.4 ผลลงคะแนน</b></p>
            <div className="row votes" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <TextField id={`my-${item.id}`} label="เห็นชอบ" type="number" narrow value={mi.yes} onCommit={(v) => patch(item.id, { yes: num(v) })} />
              <TextField id={`mn-${item.id}`} label="ไม่เห็นชอบ" type="number" narrow value={mi.no} onCommit={(v) => patch(item.id, { no: num(v) })} />
              <TextField id={`ma-${item.id}`} label="งดออกเสียง" type="number" narrow value={mi.abstain} onCommit={(v) => patch(item.id, { abstain: num(v) })} />
            </div>
            {votes > present && present > 0 && <p className="error small" role="alert" style={{ margin: 0 }}>⚠️ จำนวนคะแนนรวม {votes} มากกว่าผู้มีสิทธิ์ที่มาประชุม {present} คน — ตรวจตัวเลขอีกครั้ง</p>}
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <TextField id={`mo-${item.id}`} label={`${label}.5 ผู้รับผิดชอบ`} value={mi.assignee} onCommit={(v) => patch(item.id, { assignee: v.trim() || undefined })} />
              <TextField id={`md-${item.id}`} label="กำหนดเสร็จ" type="date" value={mi.due} onCommit={(v) => patch(item.id, { due: v || undefined })} />
            </div>
            </div>}
          </section>
        )
      })}
      <div className="row" style={{ margin: '0 0 0.5rem' }}>
        <button type="button" className="mini" onClick={() => save({ agenda: [...m.agenda, { ...blankAgenda(), title: 'วาระใหม่', purpose: 'ทราบ' }] })}>＋ เพิ่มวาระ</button>
        <button type="button" className="mini" disabled={!notice} onClick={pull}>🔄 ดึงวาระจากหนังสือแจ้งประชุม</button>
        {pulled && <span role="status" className="small">{pulled}</span>}
      </div>
      <section className="card" aria-label="เสร็จส่วนที่ 2">
        <button type="button" className="btn btn--gold" onClick={() => next(1, { agendaDone: { at: Date.now() } })}>✅ บันทึกส่วนที่ 2 (วาระ)</button>
        {step(1, 'agendaDone')}
      </section>
      </>)}
      {view === 2 && (<>
      <section className="card" aria-labelledby="s6-z">
        <h2 id="s6-z">6.6 เลิกประชุมและนัดครั้งถัดไป</h2>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="mt-close-time" label="เวลาเลิกประชุม" type="time" value={m.closed?.time} onCommit={(v) => save({ closed: v ? { ...m.closed, time: v } : undefined })} />
          <TextField id="mt-next" label="นัดประชุมครั้งต่อไป (ถ้ามี)" value={m.closed?.next} onCommit={(v) => m.closed?.time && save({ closed: { ...m.closed, next: v.trim() || undefined } })} placeholder="เช่น อาทิตย์ที่ 13 ธันวาคม 2026 เวลา 18.30 น." />
        </div>
        {!m.closed?.time && <p className="muted small" style={{ margin: 0 }}>กรอกเวลาเลิกประชุมก่อน จึงบันทึกการนัดครั้งถัดไปได้</p>}
      </section>
      <section className="card" aria-label="เสร็จส่วนที่ 3">
        <button type="button" className="btn btn--gold" onClick={() => next(2, { closeDone: { at: Date.now() } })}>✅ บันทึกส่วนที่ 3 (เลิกประชุม)</button>
        {!m.closed?.time && <p className="muted small" style={{ margin: '0.3rem 0 0' }}>ยังไม่ได้ใส่เวลาเลิกประชุม</p>}
        {step(2, 'closeDone')}
      </section>
      </>)}
      {view === 3 && (<>
      <section className="card" aria-label="สรุปบันทึกการประชุม">
        <h2 style={{ marginTop: 0 }}>ส่วนที่ 4 · สรุปก่อนส่งไปรายงาน</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          <li>ผู้ร่วมประชุมทั้งหมด {a.present.length + a.guests.length} คน (กรรมการร่วม {a.present.length} · ลา {a.leave.length} · ขาด {a.absent.length} · ผู้เข้าร่วม/สังเกตการณ์ {a.guests.length})</li>
          <li>วาระที่บันทึกแล้ว {doneCount}/{items.length}</li>
          <li>เลิกประชุมเวลา {m.closed?.time || '—'} น.{m.closed?.next ? ` · นัดครั้งต่อไป ${m.closed.next}` : ''}</li>
        </ul>
      </section>
      <section className="card" aria-label="บันทึกการประชุมเสร็จ">
        {m.minutesDone
          ? <p role="status" style={{ margin: 0 }}>✅ <b>บันทึกการประชุมเสร็จแล้ว</b> — ส่งไปรายงานการประชุมแล้ว <button type="button" className="mini" onClick={() => save({ minutesDone: undefined })}>แก้ไขต่อ</button></p>
          : <button type="button" className="btn btn--gold" disabled={items.length === 0} onClick={() => { save({ minutesDone: { at: Date.now() } }); navigate('/meeting/1/4/7') }}>✅ บันทึกเสร็จ — ส่งไปรายงานการประชุม</button>}
        <p className="muted small" style={{ margin: '0.3rem 0 0' }}>กดแล้วไอคอนบันทึกการประชุมเป็นสีเขียว และข้อมูลทั้งหมดไปเป็นฐานของรายงานการประชุม (ไอคอนที่ 3) · แก้ไขต่อได้ภายหลัง</p>
      </section>
      </>)}
      {bar}
    </>
  )
}
