import { useEffect, useRef, useState } from 'react'
import Sheet from '../Sheet'
import { TextField } from './fields'
import { useCommittee } from '../../lib/data'
import { blankPerson } from '../../lib/meetings'
import { newId } from '../../lib/money'
import type { CommitteeMember, MtAttend, MtPerson } from '../../lib/types'
import type { StepProps } from './Step1'

/** ป้ายการมาที่แสดง (เก็บเป็น มา/ลา/ไม่มา ตามเดิม เพื่อให้ขั้น 5 และรายงานใช้ร่วมกัน) */
const ATT: { v: MtAttend; label: string }[] = [{ v: 'มา', label: 'ร่วม' }, { v: 'ลา', label: 'ลา' }, { v: 'ไม่มา', label: 'ขาด' }]
type Row = { id: string; role: string; name: string }

/**
 * ตั้งค่ารายชื่อคณะกรรมการหลัก (ป๊อปอัพ): เพิ่ม/แก้/ลบ ตำแหน่ง + ชื่อ · บันทึกแล้วใช้เป็นรายชื่อตั้งต้นของ “ทุกการประชุม” (สามัญและวิสามัญ)
 */
function RosterSetup({ initial, addBlank, onClose, onSave }: { initial: Row[]; addBlank?: boolean; onClose: () => void; onSave: (rows: Row[]) => boolean }) {
  const [rows, setRows] = useState<Row[]>(initial.length && !addBlank ? initial : [...initial, { id: newId('cm'), role: '', name: '' }])
  const [bulk, setBulk] = useState(false)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const set = (id: string, k: 'role' | 'name', v: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  const move = (i: number, d: number) => setRows((rs) => { const j = i + d; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c })
  const addBulk = () => {
    const add = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [a, ...b] = l.split('|'); return b.length ? { role: a.trim(), name: b.join('|').trim() } : { role: '', name: a.trim() } }).filter((r) => r.name)
    if (!add.length) return setMsg('พิมพ์บรรทัดละ 1 คน เช่น ประธาน | สมชาย ใจดี')
    setRows((rs) => [...rs.filter((r) => r.name.trim() || r.role.trim()), ...add.map((r) => ({ id: newId('cm'), ...r }))]); setText(''); setBulk(false); setMsg('')
  }
  const save = () => {
    const clean = rows.map((r) => ({ ...r, name: r.name.trim(), role: r.role.trim() })).filter((r) => r.name)
    if (!clean.length) return setMsg('ใส่ชื่ออย่างน้อย 1 คน')
    if (!onSave(clean)) setMsg('ไม่มีสิทธิ์บันทึก')
  }
  return (
    <Sheet title="ตั้งค่ารายชื่อคณะกรรมการหลัก" onClose={onClose}>
      <p className="muted small" style={{ margin: 0 }}>รายชื่อนี้ใช้เป็นตัวตั้งต้นของทุกการประชุม (สามัญและวิสามัญ) · แก้ไข เพิ่ม ลบ เรียงลำดับได้ตลอด</p>
      <ol className="rosterlist" aria-label="รายชื่อคณะกรรมการหลัก">
        {rows.map((r, i) => (
          <li key={r.id} className="rosterrow">
            <span className="rosterrow__n">{i + 1}</span>
            <div className="rosterrow__f">
              <div className="field"><label htmlFor={`su-r-${r.id}`}>ตำแหน่ง</label><input id={`su-r-${r.id}`} className="input" value={r.role} onChange={(e) => set(r.id, 'role', e.target.value)} /></div>
              <div className="field"><label htmlFor={`su-n-${r.id}`}>ชื่อ</label><input id={`su-n-${r.id}`} className="input" value={r.name} onChange={(e) => set(r.id, 'name', e.target.value)} /></div>
            </div>
            <div className="rosterrow__a">
              <button type="button" className="mini" aria-label={`เลื่อน ${r.name || `คนที่ ${i + 1}`} ขึ้น`} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="mini" aria-label={`เลื่อน ${r.name || `คนที่ ${i + 1}`} ลง`} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="mini" aria-label={`ลบ ${r.name || `คนที่ ${i + 1}`}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>🗑️</button>
            </div>
          </li>
        ))}
      </ol>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="mini" onClick={() => setRows((rs) => [...rs, { id: newId('cm'), role: '', name: '' }])}>＋ เพิ่มกรรมการ</button>
        <button type="button" className="mini" aria-expanded={bulk} onClick={() => setBulk(!bulk)}>เพิ่มหลายคนพร้อมกัน</button>
      </div>
      {bulk && (
        <div className="field">
          <label htmlFor="su-bulk">บรรทัดละ 1 คน · รูปแบบ “ตำแหน่ง | ชื่อ”</label>
          <textarea id="su-bulk" className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'ประธาน | …\nเลขานุการ | …\nกรรมการ | …'} />
          <button type="button" className="btn btn--gold" onClick={addBulk}>เพิ่มรายชื่อ</button>
        </div>
      )}
      {msg && <p role="alert" className="error small" style={{ margin: 0 }}>{msg}</p>}
      <div className="row"><button type="button" className="btn btn--gold" onClick={save}>บันทึกรายชื่อ</button><button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button></div>
    </Sheet>
  )
}

/**
 * บันทึกการประชุม ส่วนที่ 1: ใบลงชื่อผู้ร่วมประชุม
 * - คณะกรรมการหลัก: ตั้งค่าที่ปุ่ม ⚙️ มุมขวาบน (ป๊อปอัพ) → แสดงตามลำดับพร้อมตำแหน่ง ติ๊ก ร่วม/ลา/ขาด + หมายเหตุ
 * - ผู้เข้าร่วม/ผู้สังเกตการณ์ ลำดับที่ 1 2 3 … · ข้อมูลนี้เป็นฐานของรายงานการประชุม
 */
export default function Roster({ m, save, onDone }: StepProps & { onDone: () => void }) {
  const committee = useCommittee()
  const members = m.people.filter((p) => p.kind === 'กรรมการ')
  const guests = m.people.filter((p) => p.kind === 'ผู้เข้าร่วมอื่น')
  const [msg, setMsg] = useState('')
  const [setup, setSetup] = useState<false | 'edit' | 'add'>(() => (committee.list.length === 0 && members.length === 0 ? 'edit' : false))   // ยังไม่เคยตั้งค่า: เปิดป๊อปอัพตั้งค่าก่อน
  const seeded = useRef(false)
  // การประชุมใหม่ที่ยังไม่มีกรรมการ: ดึงรายชื่อหลักมาให้ทันที
  useEffect(() => {
    if (seeded.current || members.length > 0 || committee.list.length === 0) return
    seeded.current = true
    save({ people: [...m.people, ...committee.list.map((c) => ({ ...blankPerson('กรรมการ'), name: c.name, role: c.role }))] })
  }, [committee.list.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const setP = (id: string, p: Partial<MtPerson>) => save({ people: m.people.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const del = (id: string) => save({ people: m.people.filter((x) => x.id !== id) })
  const count = (v: MtAttend) => members.filter((p) => p.att === v).length
  const unmarked = members.filter((p) => p.name.trim() && !p.att).length
  /** บันทึกรายชื่อหลัก (ใช้กับทุกการประชุม) + ปรับรายชื่อของการประชุมนี้ให้ตรง โดยคนเดิมคงสถานะ ร่วม/ลา/ขาด และหมายเหตุไว้ */
  const saveSetup = (rows: Row[]) => {
    const old = committee.list
    const next: CommitteeMember[] = rows.map((r, i) => ({ id: old.find((c) => c.name === r.name)?.id ?? newId('cm'), name: r.name, role: r.role, order: i, updated: Date.now() }))
    const gone = old.filter((c) => !next.some((n) => n.id === c.id)).map((c) => ({ ...c, deleted: true, updated: Date.now() }))
    if (!committee.put([...next, ...gone])) return false
    const keep = new Map(members.map((p) => [p.name.trim(), p]))
    const people = [...rows.map((r) => ({ ...(keep.get(r.name) ?? blankPerson('กรรมการ')), name: r.name, role: r.role || undefined })), ...m.people.filter((p) => p.kind !== 'กรรมการ')]
    save({ people })
    setSetup(false); setMsg(`บันทึกรายชื่อคณะกรรมการหลัก ${rows.length} คน — ใช้กับทุกการประชุมต่อไป`)
    return true
  }
  /** ย้าย/ลบในรายการตรง ๆ: ปรับรายชื่อหลัก (ใช้กับทุกการประชุม) และรายชื่อของการประชุมนี้พร้อมกัน — เลขลำดับเรียงใหม่อัตโนมัติ */
  const rowsNow: Row[] = members.filter((p) => p.name.trim()).map((p) => ({ id: p.id, role: p.role ?? '', name: p.name.trim() }))
  const moveRow = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rowsNow.length) return; const c = [...rowsNow]; [c[i], c[j]] = [c[j], c[i]]; saveSetup(c) }
  const delRow = (i: number) => { if (window.confirm(`ลบ “${rowsNow[i].name}” ออกจากรายชื่อคณะกรรมการหลัก ?\n(ใช้กับทุกการประชุมต่อไป)`)) saveSetup(rowsNow.filter((_, k) => k !== i)) }
  return (
    <>
      <section className="card" aria-labelledby="r1-a">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap', gap: 8 }}>
          <h2 id="r1-a" style={{ margin: 0 }}>ส่วนที่ 1 · ใบลงชื่อผู้ร่วมประชุม — คณะธรรมกิจ ({members.filter((p) => p.name.trim()).length} คน)</h2>
          <span className="row" style={{ flex: 'none', gap: 6, flexWrap: 'nowrap' }}>
            <button type="button" className="mini iconbtn" aria-label="เพิ่มกรรมการ" title="เพิ่มกรรมการ" onClick={() => setSetup('add')}>＋</button>
            <button type="button" className="mini iconbtn" aria-label="ตั้งค่ารายชื่อคณะกรรมการหลัก" title="ตั้งค่า / ลบกรรมการ" onClick={() => setSetup('edit')}>⚙️</button>
          </span>
        </div>
        <p className="small" role="status" style={{ margin: '0.4rem 0 0.5rem' }}>ร่วม {count('มา')} · ลา {count('ลา')} · ขาด {count('ไม่มา')} · ยังไม่ติ๊ก {unmarked}</p>
        {members.length === 0 && <p className="empty">ยังไม่มีรายชื่อคณะกรรมการ — กด ⚙️ มุมขวาบนเพื่อตั้งค่า</p>}
        <ol className="rosterlist" aria-label="รายชื่อคณะธรรมกิจ">
          {members.map((p, i) => (
            <li key={p.id} className="rosterrow">
              <span className="rosterrow__n">{i + 1}</span>
              <div className="rosterrow__f">
                <b style={{ flex: '1 1 100%' }}>{p.name}{p.role ? <span className="muted small"> · {p.role}</span> : null}</b>
                <TextField id={`rt-${p.id}`} label="หมายเหตุ" value={p.note} onCommit={(v) => setP(p.id, { note: v.trim() || undefined })} />
              </div>
              <div className="rosterrow__a" role="group" aria-label={`การมาของ ${p.name || `คนที่ ${i + 1}`}`}>
                {ATT.map((x) => <button key={x.v} type="button" className="wchip" aria-pressed={p.att === x.v} onClick={() => setP(p.id, { att: p.att === x.v ? undefined : x.v })}>{x.label}</button>)}
                <button type="button" className="mini" aria-label={`เลื่อน ${p.name} ขึ้น`} disabled={i === 0} onClick={() => moveRow(i, -1)}>↑</button>
                <button type="button" className="mini" aria-label={`เลื่อน ${p.name} ลง`} disabled={i === members.length - 1} onClick={() => moveRow(i, 1)}>↓</button>
                <button type="button" className="mini" aria-label={`แก้ไข ${p.name}`} onClick={() => setSetup('edit')}>✏️</button>
                <button type="button" className="mini" aria-label={`ลบ ${p.name}`} onClick={() => delRow(i)}>🗑️</button>
              </div>
            </li>
          ))}
        </ol>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="mini" onClick={() => save({ people: m.people.map((p) => (p.kind === 'กรรมการ' && p.name.trim() && !p.att ? { ...p, att: 'มา' } : p)) })}>ติ๊ก “ร่วม” ให้ทุกคนที่ยังไม่ติ๊ก</button>
        </div>
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
        <button type="button" className="btn btn--gold" disabled={members.filter((p) => p.name.trim()).length === 0 || unmarked > 0} onClick={onDone}>✅ บันทึกใบลงชื่อ — ไปส่วนที่ 2 (วาระ)</button>
        <p className="muted small" style={{ margin: '0.3rem 0 0' }}>{unmarked > 0 ? `ติ๊ก ร่วม / ลา / ขาด ให้ครบทุกคนก่อน (เหลือ ${unmarked} คน)` : 'ครบแล้ว กดเพื่อไปบันทึกวาระการประชุม'}</p>
      </section>
      {setup && <RosterSetup addBlank={setup === 'add'} initial={(committee.list.length ? committee.list : members).filter((x) => x.name.trim()).map((x) => ({ id: x.id, role: x.role ?? '', name: x.name }))} onClose={() => setSetup(false)} onSave={saveSetup} />}
    </>
  )
}
