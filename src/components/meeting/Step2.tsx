import type { StepProps } from './Step1'
import { AgendaBody } from './docs'
import { SelectField, TextField } from './fields'
import LetterPage from '../LetterPage'
import { AGENDA_GROUPS, blankAgenda, carryOver, letterDate, moveAgenda, PURPOSES } from '../../lib/meetings'
import { newId } from '../../lib/money'
import type { MtAgenda } from '../../lib/types'
import { useRef } from 'react'
import { downloadSheetPdf } from '../../lib/pdf'

/** ขั้น 2: จัดวาระ — รับเรื่อง ดึงเรื่องค้าง จัดกลุ่ม/จุดประสงค์/เอกสาร ให้ประธานเห็นชอบ และดูใบระเบียบวาระ A4 */
export default function Step2({ m, save, list }: StepProps) {
  const page = useRef<HTMLDivElement>(null)
  // แก้วาระหลังประธานเห็นชอบแล้ว = ต้องให้ประธานเห็นชอบใหม่
  const setAgenda = (agenda: MtAgenda[]) => save({ agenda, agendaOk: undefined })
  const patch = (id: string, p: Partial<MtAgenda>) => setAgenda(m.agenda.map((a) => (a.id === id ? { ...a, ...p } : a)))
  const move = (id: string, d: number) => setAgenda(moveAgenda(m.agenda, id, d))
  const carried = carryOver(list, m).filter((c) => !m.agenda.some((a) => a.carried && a.title === c.title))
  const items = m.agenda.filter((a) => a.title.trim())
  const ready = items.length > 0 && !!m.chair.trim()
  return (
    <>
      <section className="card" aria-labelledby="s2-a">
        <h2 id="s2-a">รับเรื่องเสนอ</h2>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="mt-deadline" label="วันปิดรับเรื่องเสนอ" type="date" value={m.deadline} onCommit={(v) => save({ deadline: v || undefined })} />
        </div>
        <p className="muted small" style={{ margin: 0 }}>{m.deadline ? `ปิดรับเรื่อง ${letterDate(m.deadline)}` : 'ยังไม่ได้กำหนดวันปิดรับเรื่อง'} · เพิ่มเรื่องที่กรรมการเสนอได้ด้านล่าง</p>
        {carried.length > 0 && (
          <div style={{ marginTop: '0.6rem' }}>
            <b className="small">เรื่องค้างจากการประชุมครั้งก่อน ({carried.length})</b>
            <ul className="list">
              {carried.map((c) => (
                <li key={c.id} className="row row--between"><span className="grow">{c.title}<br /><span className="muted small">{c.minute?.result ? `มติ: ${c.minute.result}` : `ผู้รับผิดชอบ ${c.minute?.assignee ?? '—'}`}</span></span>
                  <button type="button" className="mini" onClick={() => setAgenda([...m.agenda, { ...blankAgenda(), id: newId('ag'), title: c.title, group: 'ติดตามงาน', purpose: 'ทราบ', carried: true }])} aria-label={`นำเรื่อง ${c.title} มาเป็นวาระ`}>＋ นำมาเป็นวาระ</button></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="s2-b">
        <h2 id="s2-b">จัดลำดับวาระ</h2>
        {AGENDA_GROUPS.map((g) => {
          const rows = m.agenda.filter((a) => a.group === g)
          return (
            <div key={g} style={{ margin: '0.4rem 0' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem' }}>{g} <span className="muted small">({rows.length})</span></h3>
              {rows.map((a) => (
                <div key={a.id} className="card" style={{ margin: '0.3rem 0', padding: '0.5rem 0.6rem' }}>
                  <TextField id={`at-${a.id}`} label="เรื่อง" value={a.title} onCommit={(v) => patch(a.id, { title: v.trim() })} placeholder="ชื่อเรื่อง/วาระ" />
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <SelectField id={`ag-${a.id}`} label="กลุ่ม" value={a.group} options={AGENDA_GROUPS} onChange={(v) => patch(a.id, { group: v })} />
                    <SelectField id={`ap-${a.id}`} label="เพื่อ" value={a.purpose} options={PURPOSES} onChange={(v) => patch(a.id, { purpose: v })} />
                  </div>
                  <TextField id={`ad-${a.id}`} label="เอกสารประกอบ" value={a.docs} onCommit={(v) => patch(a.id, { docs: v.trim() || undefined })} placeholder="เช่น งบประมาณ ใบเสนอราคา หนังสือเสนอเรื่อง" />
                  <div className="row">
                    <button type="button" className="mini" onClick={() => move(a.id, -1)} aria-label={`เลื่อน ${a.title || 'วาระ'} ขึ้น`}>↑</button>
                    <button type="button" className="mini" onClick={() => move(a.id, 1)} aria-label={`เลื่อน ${a.title || 'วาระ'} ลง`}>↓</button>
                    <button type="button" className="mini" onClick={() => setAgenda(m.agenda.filter((x) => x.id !== a.id))} aria-label={`ลบ ${a.title || 'วาระ'}`}>🗑️ ลบ</button>
                  </div>
                </div>
              ))}
              <button type="button" className="mini" onClick={() => setAgenda([...m.agenda, { ...blankAgenda(), group: g, purpose: g === 'แจ้งเพื่อทราบ' ? 'ทราบ' : g === 'เรื่องเสนอพิจารณา' ? 'ขอมติ' : 'หารือ' }])}>＋ เพิ่มวาระใน “{g}”</button>
            </div>
          )
        })}
      </section>

      <section className="card" aria-labelledby="s2-c">
        <h2 id="s2-c">ประธานตรวจวาระ</h2>
        {m.agendaOk
          ? <p role="status" style={{ margin: 0 }}>✅ ประธาน <b>{m.agendaOk.by}</b> เห็นชอบร่างวาระแล้ว เมื่อ {letterDate(new Date(m.agendaOk.at).toISOString().slice(0, 10))} <button type="button" className="mini" onClick={() => save({ agendaOk: undefined })}>ยกเลิกการเห็นชอบ</button></p>
          : <>
              <p className="muted small" style={{ margin: '0 0 0.4rem' }}>{ready ? 'ให้ประธานตรวจร่างวาระด้านล่างก่อนแจ้งประชุม — เมื่อประธานเห็นชอบ กดปุ่มบันทึก' : 'ต้องมีวาระอย่างน้อย 1 เรื่อง และระบุชื่อประธานในขั้นที่ 1 ก่อน'}</p>
              <button type="button" className="btn btn--gold" disabled={!ready} onClick={() => save({ agendaOk: { by: m.chair.trim(), at: Date.now() } })}>บันทึกว่าประธานเห็นชอบวาระ</button>
            </>}
        <p className="muted small" style={{ margin: '0.4rem 0 0' }}>แก้ไขวาระหลังประธานเห็นชอบแล้ว จะต้องให้ประธานเห็นชอบใหม่</p>
      </section>

      <section aria-label="ใบระเบียบวาระ">
        <h2 style={{ margin: '0.6rem 0 0.3rem' }}>ใบระเบียบวาระ (หัวจดหมาย A4)</h2>
        <LetterPage ref={page}><AgendaBody m={m} /></LetterPage>
        <button type="button" className="btn" disabled={items.length === 0} onClick={() => page.current && downloadSheetPdf([page.current], `meeting-agenda-${m.no}-${m.year}.pdf`, 'full')}>⬇️ ดาวน์โหลด PDF ระเบียบวาระ</button>
      </section>
    </>
  )
}
