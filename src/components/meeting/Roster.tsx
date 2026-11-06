import { useEffect, useRef, useState } from 'react'
import { TextField } from './fields'
import { useCommittee } from '../../lib/data'
import { blankPerson } from '../../lib/meetings'
import { newId } from '../../lib/money'
import type { MtAttend, MtPerson } from '../../lib/types'
import type { StepProps } from './Step1'

/** ป้ายการมาที่แสดง (เก็บเป็น มา/ลา/ไม่มา ตามเดิม เพื่อให้ขั้น 5 และรายงานใช้ร่วมกัน) */
const ATT: { v: MtAttend; label: string }[] = [{ v: 'มา', label: 'ร่วม' }, { v: 'ลา', label: 'ลา' }, { v: 'ไม่มา', label: 'ขาด' }]

/**
 * บันทึกการประชุม ส่วนที่ 1: รายชื่อผู้เข้าประชุม
 * - คณะธรรมกิจ (ตำแหน่ง + ชื่อ) ติ๊ก ร่วม/ลา/ขาด · เพิ่ม แก้ ลบได้ · รายชื่อตั้งต้นมาจาก “รายชื่อคณะธรรมกิจประจำ” (บันทึกไว้ใช้ทุกครั้ง)
 * - ผู้สังเกตการณ์/ผู้เข้าร่วมอื่น ลำดับที่ 1 2 3 … พร้อมหมายเหตุ
 * ข้อมูลนี้เป็นฐานของรายงานการประชุม · เสร็จแล้วกดไปส่วนที่ 2 (วาระ)
 */
export default function Roster({ m, save, onDone }: StepProps & { onDone: () => void }) {
  const committee = useCommittee()
  const [bulk, setBulk] = useState(false)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const members = m.people.filter((p) => p.kind === 'กรรมการ')
  const guests = m.people.filter((p) => p.kind === 'ผู้เข้าร่วมอื่น')
  const seeded = useRef(false)
  // การประชุมใหม่ที่ยังไม่มีกรรมการ: ดึงรายชื่อคณะธรรมกิจประจำมาให้ทันที
  useEffect(() => {
    if (seeded.current || members.length > 0 || committee.list.length === 0) return
    seeded.current = true
    save({ people: [...m.people, ...committee.list.map((c) => ({ ...blankPerson('กรรมการ'), name: c.name, role: c.role }))] })
  }, [committee.list.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const setP = (id: string, p: Partial<MtPerson>) => save({ people: m.people.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const del = (id: string) => save({ people: m.people.filter((x) => x.id !== id) })
  const count = (v: MtAttend) => members.filter((p) => p.att === v).length
  const unmarked = members.filter((p) => p.name.trim() && !p.att).length
  const addBulk = () => {
    const rows = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [a, ...b] = l.split('|'); return b.length ? { role: a.trim(), name: b.join('|').trim() } : { role: '', name: a.trim() } }).filter((r) => r.name)
    if (!rows.length) return setMsg('พิมพ์บรรทัดละ 1 คน เช่น ประธาน | สมชาย ใจดี')
    save({ people: [...m.people, ...rows.map((r) => ({ ...blankPerson('กรรมการ'), name: r.name, role: r.role }))] })
    setText(''); setBulk(false); setMsg(`เพิ่ม ${rows.length} รายชื่อแล้ว`)
  }
  /** บันทึกรายชื่อปัจจุบันเป็นรายชื่อคณะธรรมกิจประจำ (ตั้งต้นของทุกการประชุม) · quiet = ไม่แสดงข้อความ */
  const saveRoster = (quiet?: boolean) => {
    const rows = members.filter((p) => p.name.trim())
    const old = committee.list
    const next: CommitteeLike[] = rows.map((p, i) => ({ id: old.find((c) => c.name === p.name)?.id ?? newId('cm'), name: p.name.trim(), role: (p.role ?? '').trim(), order: i, updated: Date.now() }))
    const gone = old.filter((c) => !next.some((n) => n.id === c.id)).map((c) => ({ ...c, deleted: true, updated: Date.now() }))
    const ok = committee.put([...next, ...gone])
    if (quiet) return
    setMsg(ok ? `บันทึกเป็นรายชื่อคณะธรรมกิจประจำแล้ว (${rows.length} คน) — การประชุมครั้งหน้าจะมีรายชื่อนี้ให้ทันที` : 'ไม่มีสิทธิ์บันทึก')
  }
  return (
    <>
      <section className="card" aria-labelledby="r1-a">
        <h2 id="r1-a">ส่วนที่ 1 · ใบลงชื่อผู้ร่วมประชุม — คณะธรรมกิจ ({members.filter((p) => p.name.trim()).length} คน)</h2>
        <p className="small" role="status" style={{ margin: '0 0 0.5rem' }}>ร่วม {count('มา')} · ลา {count('ลา')} · ขาด {count('ไม่มา')} · ยังไม่ติ๊ก {unmarked}</p>
        {members.length === 0 && <p className="empty">ยังไม่มีรายชื่อ — กด “＋ เพิ่มกรรมการ” หรือ “เพิ่มหลายคนพร้อมกัน” แล้วกด “บันทึกเป็นรายชื่อประจำ” เพื่อใช้ทุกครั้ง</p>}
        <ol className="rosterlist" aria-label="รายชื่อคณะธรรมกิจ">
          {members.map((p, i) => (
            <li key={p.id} className="rosterrow">
              <span className="rosterrow__n">{i + 1}</span>
              <div className="rosterrow__f">
                <TextField id={`rn-${p.id}`} label="ชื่อ" value={p.name} onCommit={(v) => setP(p.id, { name: v.trim() })} />
                <TextField id={`rr-${p.id}`} label="ตำแหน่ง" value={p.role} onCommit={(v) => setP(p.id, { role: v.trim() || undefined })} />
                <TextField id={`rt-${p.id}`} label="หมายเหตุ" value={p.note} onCommit={(v) => setP(p.id, { note: v.trim() || undefined })} />
              </div>
              <div className="rosterrow__a" role="group" aria-label={`การมาของ ${p.name || `คนที่ ${i + 1}`}`}>
                {ATT.map((x) => <button key={x.v} type="button" className="wchip" aria-pressed={p.att === x.v} onClick={() => setP(p.id, { att: p.att === x.v ? undefined : x.v })}>{x.label}</button>)}
                <button type="button" className="mini" aria-label={`ลบ ${p.name || `คนที่ ${i + 1}`}`} onClick={() => del(p.id)}>🗑️</button>
              </div>
            </li>
          ))}
        </ol>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="mini" onClick={() => save({ people: [...m.people, blankPerson('กรรมการ')] })}>＋ เพิ่มกรรมการ</button>
          <button type="button" className="mini" onClick={() => setBulk(!bulk)} aria-expanded={bulk}>เพิ่มหลายคนพร้อมกัน</button>
          <button type="button" className="mini" onClick={() => save({ people: m.people.map((p) => (p.kind === 'กรรมการ' && p.name.trim() && !p.att ? { ...p, att: 'มา' } : p)) })}>ติ๊ก “ร่วม” ให้ทุกคนที่ยังไม่ติ๊ก</button>
          <button type="button" className="mini" onClick={() => saveRoster()}>💾 บันทึกเป็นรายชื่อประจำ</button>
        </div>
        {bulk && (
          <div className="field" style={{ marginTop: '0.4rem' }}>
            <label htmlFor="r1-bulk">บรรทัดละ 1 คน · รูปแบบ “ตำแหน่ง | ชื่อ”</label>
            <textarea id="r1-bulk" className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'ประธาน | …\nเลขานุการ | …\nกรรมการ | …'} />
            <button type="button" className="btn btn--gold" onClick={addBulk}>เพิ่มรายชื่อ</button>
          </div>
        )}
        {msg && <p role="status" className="small" style={{ margin: '0.4rem 0 0' }}>{msg}</p>}
      </section>

      <section className="card" aria-labelledby="r1-b">
        <h2 id="r1-b">ผู้เข้าร่วมประชุม / ผู้สังเกตการณ์ ({guests.filter((p) => p.name.trim()).length} คน)</h2>
        <p className="muted small" style={{ margin: '0 0 0.4rem' }}>ลำดับที่ 1, 2, 3 … ใส่ชื่อและหมายเหตุ (เช่น ผู้ช่วยเลขา, แขกรับเชิญ) · ข้อมูลนี้ไปอยู่ในรายงานการประชุม</p>
        <ol className="rosterlist" aria-label="ผู้เข้าร่วมประชุมและผู้สังเกตการณ์">
          {guests.map((p, i) => (
            <li key={p.id} className="rosterrow">
              <span className="rosterrow__n">{i + 1}</span>
              <div className="rosterrow__f">
                <TextField id={`gn1-${p.id}`} label="ชื่อ" value={p.name} onCommit={(v) => { const t = v.trim(); if (t && guests.some((g) => g.id !== p.id && g.name.trim() === t)) { setMsg(`ชื่อ “${t}” มีในรายชื่อผู้เข้าร่วมแล้ว — ไม่ใส่ซ้ำ`); return } setP(p.id, { name: t, att: p.att ?? 'มา' }) }} />
                <TextField id={`gr-${p.id}`} label="หมายเหตุ / บทบาท" value={p.role} onCommit={(v) => setP(p.id, { role: v.trim() || undefined })} />
              </div>
              <button type="button" className="mini" aria-label={`ลบผู้เข้าร่วมคนที่ ${i + 1}`} onClick={() => del(p.id)}>🗑️</button>
            </li>
          ))}
        </ol>
        <button type="button" className="mini" onClick={() => save({ people: [...m.people, { ...blankPerson('ผู้เข้าร่วมอื่น'), att: 'มา' }] })}>＋ เพิ่มผู้เข้าร่วม / ผู้สังเกตการณ์</button>
      </section>

      <section className="card" aria-labelledby="r1-c">
        <p role="status" style={{ margin: '0 0 0.4rem' }}><b>ผู้ร่วมประชุมทั้งหมด {members.filter((p) => p.att === 'มา').length + guests.filter((p) => p.name.trim()).length} คน</b> <span className="muted small">(กรรมการร่วม {members.filter((p) => p.att === 'มา').length} + ผู้เข้าร่วม/สังเกตการณ์ {guests.filter((p) => p.name.trim()).length})</span></p>
        <button type="button" className="btn btn--gold" disabled={members.filter((p) => p.name.trim()).length === 0 || unmarked > 0} onClick={() => { saveRoster(true); onDone() }}>✅ บันทึกใบลงชื่อ — ไปส่วนที่ 2 (วาระ)</button>
        <p className="muted small" style={{ margin: '0.3rem 0 0' }}>{unmarked > 0 ? `ติ๊ก ร่วม / ลา / ขาด ให้ครบทุกคนก่อน (เหลือ ${unmarked} คน)` : 'ครบแล้ว กดเพื่อไปบันทึกวาระการประชุม'}</p>
      </section>
    </>
  )
}
type CommitteeLike = { id: string; name: string; role: string; order: number; updated: number }
