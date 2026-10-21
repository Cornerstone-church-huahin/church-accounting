import { useRef } from 'react'
import type { StepProps } from './Step1'
import { AgendaBody, defaultNoticeBody, NoticeBody } from './docs'
import { TextField } from './fields'
import LetterPage from '../LetterPage'
import { CHANNELS, letterDate, refNo } from '../../lib/meetings'
import { downloadSheetPdf } from '../../lib/pdf'
import type { MtRsvp } from '../../lib/types'

const RSVPS: MtRsvp[] = ['ยังไม่ตอบ', 'ตอบรับ', 'ลา']

/** ขั้น 3: แจ้งประชุม — หนังสือเชิญ (หัวจดหมายจริง) + แนบวาระ · เลือกช่องทาง · ติดตามการตอบรับ/ลา · บันทึกว่าแจ้งแล้ว */
export default function Step3({ m, save }: StepProps) {
  const p1 = useRef<HTMLDivElement>(null), p2 = useRef<HTMLDivElement>(null)
  const n = m.notice ?? { channels: [] }
  const body = n.body ?? defaultNoticeBody(m)
  const setN = (p: Partial<NonNullable<typeof m.notice>>) => save({ notice: { ...n, ...p } })
  const people = m.people.filter((p) => p.name.trim())
  const cnt = (r: MtRsvp) => people.filter((p) => (p.rsvp ?? 'ยังไม่ตอบ') === r).length
  const canSend = !!m.agendaOk && n.channels.length > 0
  return (
    <>
      <section className="card" aria-labelledby="s3-a">
        <h2 id="s3-a">หนังสือเชิญประชุม</h2>
        {!m.agendaOk && <p className="error small" role="status" style={{ margin: '0 0 0.4rem' }}>⚠️ ประธานยังไม่เห็นชอบวาระ (ขั้นที่ 2) — ควรให้ประธานตรวจวาระก่อนแจ้งประชุม</p>}
        <TextField id="nt-ref" label="เลขที่หนังสือ" value={n.ref ?? refNo(m)} onCommit={(v) => setN({ ref: v.trim() || undefined })} />
        <TextField id="nt-body" label="ข้อความหนังสือเชิญ (แก้ไขได้)" multiline rows={7} value={body} onCommit={(v) => setN({ body: v })} />
        {n.body && <button type="button" className="mini" onClick={() => setN({ body: undefined })}>↺ ใช้ข้อความมาตรฐานใหม่จากข้อมูลการประชุม</button>}
      </section>

      <section className="card" aria-labelledby="s3-b">
        <h2 id="s3-b">ช่องทางแจ้งประชุม</h2>
        <div className="row" role="group" aria-label="ช่องทางแจ้งประชุม">
          {CHANNELS.map((c) => {
            const on = n.channels.includes(c)
            return <button key={c} type="button" className="wchip" style={{ padding: '0 0.8rem' }} aria-pressed={on} onClick={() => setN({ channels: on ? n.channels.filter((x) => x !== c) : [...n.channels, c] })}>{c}</button>
          })}
        </div>
        {n.sentAt
          ? <p role="status" style={{ margin: '0.6rem 0 0' }}>✅ แจ้งประชุมแล้ว ({n.channels.join(', ')}) เมื่อ {letterDate(new Date(n.sentAt).toISOString().slice(0, 10))} <button type="button" className="mini" onClick={() => setN({ sentAt: undefined })}>ยกเลิก</button></p>
          : <div style={{ marginTop: '0.6rem' }}>
              <button type="button" className="btn btn--gold" disabled={!canSend} onClick={() => setN({ sentAt: Date.now() })}>บันทึกว่าแจ้งประชุมแล้ว</button>
              <p className="muted small" style={{ margin: '0.3rem 0 0' }}>{canSend ? 'กดเมื่อส่งหนังสือเชิญและวาระให้ผู้ประชุมแล้ว (ระบบไม่ส่งข้อความให้ — ส่งเองผ่านช่องทางที่เลือก แล้วดาวน์โหลดไฟล์ด้านล่างแนบไปได้)' : 'เลือกช่องทางอย่างน้อย 1 ช่องทาง และให้ประธานเห็นชอบวาระก่อน'}</p>
            </div>}
      </section>

      <section className="card" aria-labelledby="s3-c">
        <h2 id="s3-c">การตอบรับและการลา</h2>
        <p className="small" role="status" style={{ margin: '0 0 0.4rem' }}>ตอบรับ {cnt('ตอบรับ')} · ลา {cnt('ลา')} · ยังไม่ตอบ {cnt('ยังไม่ตอบ')} (จาก {people.length} คน)</p>
        {people.length === 0 && <p className="empty">ยังไม่มีรายชื่อ — เพิ่มที่ขั้นที่ 1</p>}
        <ul className="list" aria-label="การตอบรับของผู้ประชุม">
          {people.map((p) => (
            <li key={p.id} className="row row--between" style={{ flexWrap: 'nowrap' }}>
              <span className="grow"><b>{p.name}</b><br /><span className="muted small">{p.kind}</span></span>
              <select className="input" style={{ width: '7.5rem', flex: 'none' }} aria-label={`การตอบรับของ ${p.name}`} value={p.rsvp ?? 'ยังไม่ตอบ'} onChange={(e) => save({ people: m.people.map((x) => (x.id === p.id ? { ...x, rsvp: e.target.value as MtRsvp } : x)) })}>
                {RSVPS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="เอกสารแจ้งประชุม">
        <h2 style={{ margin: '0.6rem 0 0.3rem' }}>เอกสารแจ้งประชุม (หัวจดหมาย A4)</h2>
        <LetterPage ref={p1}><NoticeBody m={m} body={body} /></LetterPage>
        <LetterPage ref={p2}><AgendaBody m={m} /></LetterPage>
        <button type="button" className="btn" onClick={() => p1.current && p2.current && downloadSheetPdf([p1.current, p2.current], `meeting-notice-${m.no}-${m.year}.pdf`, 'full')}>⬇️ ดาวน์โหลด PDF หนังสือเชิญ + ระเบียบวาระ</button>
      </section>
    </>
  )
}
