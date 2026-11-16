import { useRef, useState } from 'react'
import FitBox from './FitBox'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import VisitorPick from './VisitorPick'
import { useActTables, useSettings } from '../lib/data'
import { DAILY_COLS, addNextDay, dateRowsFor, fitRows, moveAt, newRow, newTable } from '../lib/actTables'
import { newId } from '../lib/money'
import type { ActTable, FundActivity } from '../lib/types'

const NAVY = '#1a2b4c', GOLD = '#c99a14'
const KINDS: { k: ActTable['kind']; icon: string; name: string; hint: string }[] = [
  { k: 'daily', icon: '📅', name: 'ตารางรายวัน', hint: 'แถว = วันที่ของกิจกรรม · คอลัมน์ = ช่วงเช้า/บ่าย/ค่ำ (แบบไวท์บอร์ด)' },
  { k: 'stage', icon: '🎤', name: 'รายการบนเวที', hint: 'เวลา · รายการ · ผู้รับผิดชอบ' },
  { k: 'free', icon: '🗒️', name: 'ตารางว่าง', hint: 'ตั้งหัวคอลัมน์เอง เช่น ประสานงานวันที่ ...' },
]

/**
 * แท็บ “ตารางกำหนดการ” ของกิจกรรม: สร้างได้หลายตาราง (รายวัน · รายการบนเวที · ว่าง) แตะช่องเพื่อแก้
 * ส่งออก PDF/แชร์รูป/พิมพ์ A4 แนวนอนได้ทีละตาราง · แก้ได้เฉพาะแอดมิน/ผู้ดูแลกองทุน
 */
export default function ActSchedule({ act, canEdit }: { act: FundActivity; canEdit: boolean }) {
  const store = useActTables()
  const list = store.of(act.id)
  const [pick, setPick] = useState(false)
  const [edit, setEdit] = useState<ActTable | null>(null)
  const add = (kind: ActTable['kind']) => { const t = newTable(kind, act, (list[list.length - 1]?.order ?? 0) + 1, newId('tb')); setPick(false); if (store.put([t])) setEdit(t) }
  return (
    <section aria-label="ตารางกำหนดการ">
      {canEdit && <button type="button" className="btn btn--gold btn--block no-print" onClick={() => setPick(true)}>＋ เพิ่มตาราง</button>}
      {list.length === 0 && <p className="empty">ยังไม่มีตารางกำหนดการ{canEdit ? ' — กด “＋ เพิ่มตาราง” แล้วเลือกแบบ' : ''}</p>}
      {list.map((t) => <TableCard key={t.id} t={t} act={act} canEdit={canEdit} onEdit={() => setEdit(t)} onSaveCell={(ri, ci, v) => store.put([{ ...t, updated: 0, rows: t.rows.map((r, i) => (i === ri ? { ...r, cells: r.cells.map((c, j) => (j === ci ? v : c)) } : r)) }])}
        onDup={() => store.put([{ ...t, id: newId('tb'), title: `${t.title} (สำเนา)`, order: (list[list.length - 1]?.order ?? 0) + 1, updated: 0, rows: t.rows.map((r) => ({ ...r, id: newId('r') })) }])}
        onDelete={() => { if (confirm(`ลบตาราง “${t.title}” ?`)) store.remove(t.id) }} />)}
      {pick && (
        <Sheet title="＋ เพิ่มตาราง — เลือกแบบ" onClose={() => setPick(false)}>
          {KINDS.map((x) => <button key={x.k} type="button" className="btn btn--block" style={{ textAlign: 'left', marginBottom: 6 }} onClick={() => add(x.k)}><b>{x.icon} {x.name}</b><br /><small className="muted">{x.hint}</small></button>)}
        </Sheet>)}
      {edit && <EditSheet t={edit} act={act} onClose={() => setEdit(null)} onSave={(n) => { if (store.put([{ ...n, updated: 0 }])) setEdit(null) }} />}
    </section>
  )
}

function TableCard({ t, act, canEdit, onEdit, onSaveCell, onDup, onDelete }: { t: ActTable; act: FundActivity; canEdit: boolean; onEdit: () => void; onSaveCell: (ri: number, ci: number, v: string) => void; onDup: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const church = useSettings().settings.churchName.split(' ')[0]
  const [cell, setCell] = useState<{ ri: number; ci: number } | null>(null)
  const w = t.cols.length > 1 ? `${(100 - (t.kind === 'stage' ? 14 : t.kind === 'daily' ? 12 : 0)) / (t.cols.length - (t.kind === 'free' ? 0 : 1))}%` : '100%'
  return (
    <div style={{ marginTop: 10 }}>
      <div className="row row--between no-print" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <b>{t.title}</b>
        {canEdit && <span className="row" style={{ gap: 6 }}><button type="button" className="mini" onClick={onEdit}>✎ แก้ตาราง</button><button type="button" className="mini" onClick={onDup}>⧉ ทำสำเนา</button><button type="button" className="mini" aria-label={`ลบตาราง ${t.title}`} onClick={onDelete}>🗑</button></span>}
      </div>
      <PdfTools compact mode="full" els={() => (ref.current ? [ref.current] : [])} file={`${t.title}.pdf`} title={t.title} label={t.title} />
      <ScaledPage ref={ref} landscape>
        <FitBox key={`${t.rows.length}|${t.cols.length}|${t.rows.reduce((n, r) => n + r.cells.join('').length, 0)}`}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#111', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
            <div style={{ textAlign: 'center', border: `2px solid ${GOLD}`, borderBottom: `5px solid ${GOLD}`, borderRadius: 12, padding: '8px 12px', color: NAVY }}>
              <div style={{ fontSize: 14 }}>{church} · ✝ {act.name}</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{t.title}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 8, flex: 1 }}>
              <colgroup>{t.cols.map((_, i) => <col key={i} style={{ width: i === 0 && t.kind !== 'free' ? (t.kind === 'stage' ? '14%' : '12%') : w }} />)}</colgroup>
              <thead><tr>{t.cols.map((c, i) => <th key={i} style={{ border: '1.5px solid #5a6a8c', background: '#e8edf7', color: NAVY, padding: '6px 4px', fontSize: 18 }}>{c}</th>)}</tr></thead>
              <tbody>
                {t.rows.map((r, ri) => (
                  <tr key={r.id}>
                    {t.cols.map((_, ci) => (
                      <td key={ci} onClick={() => canEdit && setCell({ ri, ci })} aria-label={`${t.cols[ci]} แถว ${ri + 1}`} style={{ border: '1.5px solid #5a6a8c', padding: '6px 8px', verticalAlign: 'top', whiteSpace: 'pre-line', fontSize: 17, lineHeight: 1.3, cursor: canEdit ? 'pointer' : undefined, fontWeight: ci === 0 && t.kind !== 'free' ? 800 : 500, textAlign: ci === 0 && t.kind !== 'free' ? 'center' : 'left', background: ci === 0 && t.kind !== 'free' ? '#f3f6fc' : '#fff', color: ci === 0 && t.kind === 'daily' ? '#a4262c' : undefined }}>
                        {r.cells[ci] || (canEdit ? <span className="no-print" style={{ color: '#9aa5bd', fontSize: 20 }}>＋</span> : '')}
                      </td>))}
                  </tr>))}
              </tbody>
            </table>
          </div>
        </FitBox>
      </ScaledPage>
      {cell && <CellSheet title={`${t.cols[cell.ci]} · ${t.rows[cell.ri].cells[0] && cell.ci !== 0 ? t.rows[cell.ri].cells[0] : `แถว ${cell.ri + 1}`}`} value={t.rows[cell.ri].cells[cell.ci] ?? ''} onClose={() => setCell(null)} onSave={(v) => { onSaveCell(cell.ri, cell.ci, v); setCell(null) }} />}
    </div>
  )
}

/** แก้ข้อความในช่อง + ใส่ชื่อผู้รับผิดชอบจากรายชื่อทีม/ทะเบียน */
function CellSheet({ title, value, onClose, onSave }: { title: string; value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  const [names, setNames] = useState<string[]>([])
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="field"><label htmlFor="ct-t">ข้อความในช่อง (หลายบรรทัดได้ เช่น เวลา · รายการ)</label><textarea id="ct-t" className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} autoFocus /></div>
      <div className="field"><label htmlFor="ct-n">👥 ใส่ชื่อผู้รับผิดชอบ (เลือกแล้วกด “ใส่ชื่อลงช่อง”)</label>
        <VisitorPick id="ct-n" title="ผู้รับผิดชอบ" value={names} onChange={setNames} empty="— เลือกชื่อ —" />
        {names.length > 0 && <button type="button" className="btn" style={{ marginTop: 6 }} onClick={() => { setText((t) => [t.trimEnd(), `👤 ${names.join(', ')}`].filter(Boolean).join('\n')); setNames([]) }}>＋ ใส่ชื่อลงช่อง ({names.length})</button>}</div>
      <div className="row" style={{ gap: 8 }}><button type="button" className="btn btn--gold grow" onClick={() => onSave(text.trim())}>✓ บันทึก</button>{value && <button type="button" className="btn btn--ghost" onClick={() => onSave('')}>ล้างช่อง</button>}</div>
    </Sheet>
  )
}

/** แก้โครงตาราง: ชื่อ · คอลัมน์ · แถว (เพิ่ม ลบ เรียง) · สร้างแถววันที่จากกิจกรรม (ตารางรายวัน) */
function EditSheet({ t, act, onClose, onSave }: { t: ActTable; act: FundActivity; onClose: () => void; onSave: (t: ActTable) => void }) {
  const [title, setTitle] = useState(t.title)
  const [cols, setCols] = useState(t.cols)
  const [rows, setRows] = useState(t.rows)
  const [err, setErr] = useState('')
  const [from, setFrom] = useState(act.date)
  const [to, setTo] = useState(act.endDate && act.endDate >= act.date ? act.endDate : act.date)
  const save = () => { if (!title.trim()) return setErr('ใส่ชื่อตาราง'); if (!cols.length) return setErr('ต้องมีอย่างน้อย 1 คอลัมน์'); onSave({ ...t, title: title.trim(), cols: cols.map((c) => c.trim() || '—'), rows: fitRows(rows, cols.length) }) }
  const setCol = (i: number, v: string) => setCols(cols.map((c, j) => (j === i ? v : c)))
  const moveCol = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= cols.length) return; setCols(moveAt(cols, i, d)); setRows(rows.map((r) => ({ ...r, cells: moveAt(fitRows([r], cols.length)[0].cells, i, d) }))) }
  const delCol = (i: number) => { if (cols.length <= 1) return; setCols(cols.filter((_, j) => j !== i)); setRows(rows.map((r) => ({ ...r, cells: r.cells.filter((_, j) => j !== i) }))) }
  return (
    <Sheet title="✎ แก้ตาราง" onClose={onClose}>
      <div className="field"><label htmlFor="et-t">ชื่อตาราง</label><input id="et-t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label>คอลัมน์ (หัวตาราง){t.kind === 'daily' ? ' — คอลัมน์คือ “ช่วงเวลา” (เช้า/บ่าย/ค่ำ) ไม่ใช่วันที่ · วันที่อยู่ที่ “แถว” ด้านล่าง' : ''}</label>
        {cols.map((c, i) => (
          <div key={i} className="row" style={{ gap: 6, marginBottom: 4 }}>
            <input className="input grow" aria-label={`คอลัมน์ ${i + 1}`} value={c} onChange={(e) => setCol(i, e.target.value)} />
            <button type="button" className="mini" aria-label="เลื่อนซ้าย" onClick={() => moveCol(i, -1)}>▲</button>
            <button type="button" className="mini" aria-label="เลื่อนขวา" onClick={() => moveCol(i, 1)}>▼</button>
            <button type="button" className="mini" aria-label="ลบคอลัมน์" onClick={() => delCol(i)}>✕</button>
          </div>))}
        {t.kind === 'daily' && <button type="button" className="btn" style={{ marginRight: 6 }} onClick={() => { if (confirm('คืนคอลัมน์เป็น วัน/วันที่ · ช่วงเช้า · ช่วงบ่าย · ช่วงค่ำ ? (ข้อความช่องที่เกินจะถูกตัด)')) { setCols(DAILY_COLS); setRows(fitRows(rows, DAILY_COLS.length)) } }}>↺ คืนคอลัมน์ เช้า/บ่าย/ค่ำ</button>}
        <button type="button" className="btn" onClick={() => { setCols([...cols, `หัวข้อ ${cols.length + 1}`]); setRows(rows.map((r) => ({ ...r, cells: [...fitRows([r], cols.length)[0].cells, ''] }))) }}>＋ เพิ่มคอลัมน์</button></div>
      <div className="field"><label>แถว ({rows.length})</label>
        {t.kind === 'daily' && (
          <div style={{ border: '1.5px solid #d6dbe8', borderRadius: 10, padding: 8, marginBottom: 8 }}>
            <b className="small">📅 วันที่ในตาราง</b>
            <div className="row" style={{ gap: 6, marginTop: 4, alignItems: 'end' }}>
              <div className="field grow"><label htmlFor="et-f" className="small">ตั้งแต่วันที่</label><input id="et-f" type="date" className="input" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></div>
              <div className="field grow"><label htmlFor="et-to" className="small">ถึงวันที่</label><input id="et-to" type="date" className="input" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>
            </div>
            <button type="button" className="btn btn--block" style={{ marginTop: 6 }} onClick={() => { if (to < from) return setErr('วันสุดท้ายต้องไม่ก่อนวันเริ่ม'); setErr(''); setRows(dateRowsFor(act, rows, cols.length, from, to)) }}>📅 สร้างแถววันที่ตามช่วงนี้ (เช่น 21–25)</button>
            <button type="button" className="btn btn--block" style={{ marginTop: 6 }} onClick={() => setRows(addNextDay(act, rows, cols.length))}>＋ เพิ่มวันถัดไป</button>
          </div>)}
        {rows.map((r, i) => (
          <div key={r.id} className="row" style={{ gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <span className="small" style={{ width: 22 }}>{i + 1}.</span>
            <input className="input grow" aria-label={`ชื่อแถว ${i + 1}`} placeholder="ป้ายแถว เช่น พ. 23" value={r.cells[0] ?? ''} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, cells: x.cells.map((c, k) => (k === 0 ? e.target.value : c)) } : x)))} />
            <button type="button" className="mini" aria-label="เลื่อนขึ้น" onClick={() => setRows(moveAt(rows, i, -1))}>▲</button>
            <button type="button" className="mini" aria-label="เลื่อนลง" onClick={() => setRows(moveAt(rows, i, 1))}>▼</button>
            <button type="button" className="mini" aria-label="ลบแถว" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
          </div>))}
        <button type="button" className="btn" onClick={() => setRows([...rows, newRow(cols.length)])}>＋ เพิ่มแถว</button></div>
      {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button type="button" className="btn btn--gold btn--block" onClick={save}>✓ บันทึกตาราง</button>
    </Sheet>
  )
}
