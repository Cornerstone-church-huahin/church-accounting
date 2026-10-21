import { useState } from 'react'
import type { StepProps } from './Step1'
import { TextField } from './fields'
import { attendance, quorumNeeded } from './minutes'
import { orderedAgenda } from './docs'
import { AGENDA_GROUPS, blankAgenda, blankPerson, letterDate, moveAgenda } from '../../lib/meetings'
import type { MtAgenda, MtAttend } from '../../lib/types'

const ATT: MtAttend[] = ['มา', 'ลา', 'ไม่มา']
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/** ขั้น 5: เริ่มประชุม — ลงชื่อผู้มา/ลา/ไม่มา · ตรวจองค์ประชุมจริง · ประธานเปิดประชุม · ยืนยัน/ปรับวาระ */
export default function Step5({ m, save }: StepProps) {
  const a = attendance(m)
  const need = quorumNeeded(m)
  const ok = a.present.length >= need && a.voters.length > 0
  const [time, setTime] = useState(nowHM())
  const [confirmed, setConfirmed] = useState(true)
  const mark = (id: string, att: MtAttend | undefined) => save({ people: m.people.map((p) => (p.id === id ? { ...p, att } : p)) })
  const setAgenda = (agenda: MtAgenda[]) => save({ agenda })
  const items = orderedAgenda(m)
  return (
    <>
      <section className="card" aria-labelledby="s5-a">
        <h2 id="s5-a">5.1–5.3 ลงชื่อผู้มาประชุม</h2>
        <div className="row" style={{ margin: '0 0 0.4rem' }}>
          <button type="button" className="mini" onClick={() => save({ people: m.people.map((p) => (p.name.trim() && !p.att ? { ...p, att: p.rsvp === 'ลา' ? 'ลา' : undefined } : p)) })}>ใส่ “ลา” ให้คนที่แจ้งลาไว้</button>
        </div>
        {m.people.filter((p) => p.name.trim()).length === 0 && <p className="empty">ยังไม่มีรายชื่อ — เพิ่มที่ขั้นที่ 1</p>}
        <ul className="list" aria-label="ลงชื่อผู้มาประชุม">
          {m.people.filter((p) => p.name.trim() || p.att === 'มา').map((p) => p.name.trim() ? (
            <li key={p.id} className="row row--between" style={{ flexWrap: 'nowrap', gap: '0.4rem' }}>
              <span className="grow" style={{ minWidth: 0 }}><b>{p.name}</b><br /><span className="muted small">{p.kind}{p.rsvp === 'ลา' ? ' · แจ้งลาไว้' : ''}</span></span>
              <span className="row" role="group" aria-label={`การมาของ ${p.name}`} style={{ gap: '0.2rem', flexWrap: 'nowrap', flex: 'none' }}>
                {ATT.map((v) => <button key={v} type="button" className="wchip" style={{ minWidth: '2.6rem', padding: '0 0.4rem', fontSize: '0.85rem' }} aria-pressed={p.att === v} onClick={() => mark(p.id, p.att === v ? undefined : v)}>{v}</button>)}
              </span>
            </li>
          ) : (
            <li key={p.id} className="row" style={{ flexWrap: 'nowrap', gap: '0.4rem', alignItems: 'flex-end' }}>
              <TextField id={`gn-${p.id}`} label="ชื่อผู้เข้าร่วมเพิ่มเติม" value="" onCommit={(v) => save({ people: m.people.map((x) => (x.id === p.id ? { ...x, name: v.trim() } : x)) })} />
              <button type="button" className="mini" onClick={() => save({ people: m.people.filter((x) => x.id !== p.id) })} aria-label="ลบแถวผู้เข้าร่วมเพิ่มเติมที่ยังไม่มีชื่อ">🗑️</button>
            </li>
          ))}
        </ul>
        <button type="button" className="mini" onClick={() => save({ people: [...m.people, { ...blankPerson('ผู้เข้าร่วมอื่น'), att: 'มา' }] })}>＋ เพิ่มผู้เข้าร่วมเพิ่มเติม (ผู้ได้รับเชิญ/ผู้สังเกตการณ์)</button>
        <p className="small" role="status" style={{ margin: '0.5rem 0 0' }}>มา {a.present.length} · ลา {a.leave.length} · ไม่มา {a.absent.length} · ยังไม่ลงชื่อ {a.unmarked.length} (ผู้มีสิทธิ์) · ผู้เข้าร่วมเพิ่มเติม {a.guests.length}</p>
      </section>

      <section className="card" aria-labelledby="s5-b">
        <h2 id="s5-b">5.4 ตรวจองค์ประชุม</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <TextField id="mt-quorum" label="องค์ประชุมขั้นต่ำ (คน)" type="number" narrow value={need} onCommit={(v) => { const n = Math.floor(Number(v)); save({ quorumMin: n > 0 ? n : undefined }) }} />
          <p className="muted small" style={{ flex: 1, margin: 0 }}>ตั้งตามข้อกำหนดของคริสตจักร (ค่าเริ่มต้น = มากกว่าครึ่งของกรรมการและผู้มีสิทธิ์ลงคะแนน {a.voters.length} คน) · ผู้เข้าร่วมเพิ่มเติมไม่นับ</p>
        </div>
        <p role="status" style={{ margin: '0.4rem 0 0', fontWeight: 700, color: ok ? '#1b7f4b' : '#b3261e' }}>{ok ? `✅ ครบองค์ประชุม (มา ${a.present.length} / ต้องมี ${need})` : `ยังไม่ครบองค์ประชุม (มา ${a.present.length} / ต้องมี ${need})`}</p>
      </section>

      <section className="card" aria-labelledby="s5-c">
        <h2 id="s5-c">5.6 ยืนยันวาระ</h2>
        <p className="muted small" style={{ margin: '0 0 0.4rem' }}>ปรับลำดับหรือเพิ่มวาระตามที่ที่ประชุมเห็นชอบ (ไม่ต้องให้ประธานเห็นชอบซ้ำ)</p>
        <ol className="list" aria-label="วาระที่จะประชุม">
          {items.map(({ n, item }) => (
            <li key={item.id} className="row row--between" style={{ flexWrap: 'nowrap' }}>
              <span className="grow"><b>{n}.</b> {item.title}<br /><span className="muted small">{item.group} · {item.purpose}</span></span>
              <button type="button" className="mini" onClick={() => setAgenda(moveAgenda(m.agenda, item.id, -1))} aria-label={`เลื่อนวาระ ${item.title} ขึ้น`}>↑</button>
              <button type="button" className="mini" onClick={() => setAgenda(moveAgenda(m.agenda, item.id, 1))} aria-label={`เลื่อนวาระ ${item.title} ลง`}>↓</button>
            </li>
          ))}
        </ol>
        <div className="row">
          <button type="button" className="mini" onClick={() => setAgenda([...m.agenda, { ...blankAgenda(), group: AGENDA_GROUPS[3], title: 'เรื่องอื่น ๆ' }])}>＋ เพิ่มวาระ “เรื่องอื่น ๆ”</button>
        </div>
      </section>

      <section className="card" aria-labelledby="s5-d">
        <h2 id="s5-d">5.5 ประธานเปิดประชุม</h2>
        {m.opened
          ? <p role="status" style={{ margin: 0 }}>✅ ประธาน <b>{m.opened.chair}</b> เปิดประชุมเมื่อเวลา {m.opened.time} น. {m.opened.agendaConfirmed ? '· ที่ประชุมเห็นชอบวาระ' : '· ยังไม่ยืนยันวาระ'} <button type="button" className="mini" onClick={() => save({ opened: undefined })}>ยกเลิก</button></p>
          : <>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <TextField id="mt-open-time" label="เวลาเปิดประชุมจริง" type="time" value={time} onCommit={setTime} />
                <TextField id="mt-open-chair" label="ประธาน" value={m.chair} onCommit={(v) => save({ chair: v.trim() })} />
              </div>
              <label className="row" style={{ margin: '0.4rem 0' }}><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> ที่ประชุมเห็นชอบระเบียบวาระ</label>
              <button type="button" className="btn btn--gold" disabled={!ok || !m.chair.trim()} onClick={() => save({ opened: { chair: m.chair.trim(), time, agendaConfirmed: confirmed, at: Date.now() } })}>บันทึกว่าประธานเปิดประชุม</button>
              <p className="muted small" style={{ margin: '0.3rem 0 0' }}>{ok ? 'บันทึกชื่อประธานและเวลาเปิดประชุมจริงลงรายงาน' : 'ต้องครบองค์ประชุมก่อนจึงเปิดประชุมได้'}</p>
            </>}
        {m.date && <p className="muted small" style={{ margin: '0.3rem 0 0' }}>กำหนดการ: {letterDate(m.date)} {m.time} น.</p>}
      </section>
    </>
  )
}
