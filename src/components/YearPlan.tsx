import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FitBox from './FitBox'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import { useIsAdminZone } from './AdminVisitTools'
import { useSettings, useYearPlan } from '../lib/data'
import { paginate } from '../lib/paginate'
import { newId } from '../lib/money'
import { MONTH_TH, buildRows, headId, monthSpans, sumBudget, type PlanLine } from '../lib/yearPlan'
import type { YearPlanRow } from '../lib/types'

const NAVY = '#1a2b4c', LINE = '#8d9bbd', GOLD = '#dcecfb', GOLD_D = '#c99a14', BLUE_T = '#c9def5', GOLD_T = '#e6f1fc', DATE = '#2d4a8a', PER = 20
type Focus = 'text' | 'owner' | 'budget' | 'date'

/** ตารางแผนงานประจำปี (เหมือนป้าย “นิมิตประจำปี”): ทุกวันอาทิตย์ของปีมาให้แล้ว แตะช่องไหนก็พิมพ์ได้เลย · เพิ่ม/ลบ/แก้วันที่ได้ · พิมพ์/PDF A4 */
export default function YearPlan() {
  const canEdit = useIsAdminZone()
  const store = useYearPlan()
  const church = useSettings().settings.churchName.split(' ')[0]
  const [year, setYear] = useState(new Date().getFullYear() + 1)
  const [edit, setEdit] = useState<{ line: PlanLine; focus: Focus } | null>(null)
  const [headEdit, setHeadEdit] = useState(false)
  const pagesRef = useRef<HTMLDivElement[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  pagesRef.current = []
  const lines = useMemo(() => buildRows(year, store.items), [year, store.items])
  const head = store.items.find((x) => x.id === headId(year) && !x.deleted)
  const title = head?.text || `นิมิตปี ${year}`
  const sub = head?.owner ?? '“ก้าวต่อไปในนิมิต สู่ปีแห่งความบริบูรณ์”'
  const pages = paginate(lines, PER)
  const posterRows = useMemo(() => lines.filter((l) => l.text || l.owner || l.budget), [lines])
  const hidden = store.items.filter((x) => x.deleted && x.id.startsWith(`yp-${year}-`)).length
  const total = sumBudget(lines.map((l) => l.budget))

  const save = (l: PlanLine, p: Partial<YearPlanRow>): boolean => {
    const cur = store.items.find((x) => x.id === l.id)
    const row: YearPlanRow = { ...(cur ?? { id: l.id, year, date: l.date, seq: l.seq, updated: 0 }), ...p, year, updated: 0 }
    return store.put([row])
  }
  const addAfter = (l: PlanLine) => { const id = `yp-x-${newId('r')}`; return store.put([{ id, year, date: l.date, seq: Date.now() % 1e9, updated: 0 }]) }
  const del = (l: PlanLine) => (l.base ? store.put([{ ...(store.items.find((x) => x.id === l.id) ?? { id: l.id, year, date: l.date, seq: 0 }), deleted: true, updated: 0 }]) : store.remove(l.id))
  const restore = () => { const gone = store.items.filter((x) => x.deleted && x.id.startsWith(`yp-${year}-`)); if (gone.length && window.confirm(`คืนแถววันอาทิตย์ที่เคยลบ ${gone.length} แถว?`)) store.put(gone.map((x) => ({ ...x, deleted: false, updated: 0 }))) }

  return (
    <section aria-label="แผนงานประจำปี">
      <div className="page-head no-print"><h1>🗓️ แผนงานประจำปี</h1><Link to="/meeting/4" className="mini">‹ งานอภิบาล</Link></div>
      <div className="row row--between no-print" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <span className="row" style={{ gap: 6, alignItems: 'center' }}>
          <button type="button" className="mini" aria-label="ปีก่อนหน้า" onClick={() => setYear(year - 1)}>‹</button>
          <b>ปี {year + 543} ({year})</b>
          <button type="button" className="mini" aria-label="ปีถัดไป" onClick={() => setYear(year + 1)}>›</button>
        </span>
        {canEdit && <span className="row" style={{ gap: 6 }}><button type="button" className="mini" onClick={() => setHeadEdit(true)}>✎ แก้หัวตาราง</button>{hidden > 0 && <button type="button" className="mini" onClick={restore}>↺ คืนแถวที่ลบ ({hidden})</button>}</span>}
      </div>
      <p className="muted small no-print" style={{ margin: '0 0 6px' }}>{canEdit ? 'แตะช่องไหนก็พิมพ์ได้เลย (ผูกกับวัน-เดือน-ปีไว้ให้แล้ว) · แตะ “วัน/วันที่” เพื่อเปลี่ยนวัน ติ๊กทำแล้ว (ขีดฆ่า) เพิ่มแถว หรือลบแถว' : 'ดูได้อย่างเดียว'}</p>
      {pages.map((rows, pi) => {
        return (
          <div key={pi} style={{ marginBottom: 10 }}>
            <PdfTools compact mode="full" els={() => (pagesRef.current[pi] ? [pagesRef.current[pi]] : [])} file={`แผนงานประจำปี-${year + 543}${pages.length > 1 ? `-หน้า${pi + 1}` : ''}.pdf`} title={`${title} หน้า ${pi + 1}`} label={`แผนงานประจำปี หน้า ${pi + 1}`} />
            <ScaledPage ref={(el) => { if (el) pagesRef.current[pi] = el }}>
              <FitBox key={`${pi}|${rows.length}|${rows.reduce((n, r) => n + r.text.length + r.owner.length, 0)}`}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#111', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                  <div style={{ textAlign: 'center', background: GOLD, border: `2px solid ${GOLD_D}`, borderBottom: `5px solid ${GOLD_D}`, borderRadius: 10, padding: '6px 8px', color: NAVY, position: 'relative' }}>
                    <div style={{ fontSize: 13 }}>{church}</div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{'<<<'} {title} {'>>>'}</div>
                    {sub && <div style={{ fontSize: 16, fontWeight: 700 }}>{sub}</div>}
                    <span style={{ position: 'absolute', right: 8, top: 6, fontSize: 12, fontWeight: 700 }}>หน้าที่ {pi + 1}</span>
                  </div>
                  <Grid rows={rows} canEdit={canEdit} onCell={(l, f) => setEdit({ line: l, focus: f })} fill />
                  {pi === pages.length - 1 && total > 0 && <div style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 800, color: NAVY, border: `1.5px solid ${LINE}`, borderTop: 0 }}>รวมงบประมาณ {total.toLocaleString('th-TH')} บาท</div>}
                </div>
              </FitBox>
            </ScaledPage>
          </div>)
      })}
      <div className="no-print" style={{ margin: '14px 0 6px', padding: '10px 12px', borderRadius: 12, background: GOLD_T, border: `2px solid ${GOLD_D}`, color: NAVY }}>
        <b>📌 แผ่นสำหรับติดบอร์ด (A4 แผ่นเดียว)</b>
        <p className="muted small" style={{ margin: '2px 0 0' }}>สรุปรายการที่กรอกไว้ด้านบนทั้งปี ม.ค. – ธ.ค. ไว้ในแผ่นเดียว (แสดงเฉพาะแถวที่มีข้อมูล) · กรอก/แก้ที่ตารางด้านบน แผ่นนี้จะเปลี่ยนตามเอง · พิมพ์ หรือ PDF ไปติดบอร์ดได้เลย</p>
      </div>
      {(
        <div>
          <PdfTools compact mode="full" els={() => (boardRef.current ? [boardRef.current] : [])} file={`แผนงานประจำปี-${year + 543}-ติดบอร์ด.pdf`} title={title} label="แผนงานประจำปี แผ่นติดบอร์ด" />
          <ScaledPage ref={boardRef} noCredit>
            <FitBox key={`${posterRows.length}|${posterRows.reduce((n, r) => n + r.text.length + r.owner.length, 0)}`}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#111', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                <div style={{ textAlign: 'center', background: GOLD, border: `2px solid ${GOLD_D}`, borderBottom: `5px solid ${GOLD_D}`, borderRadius: 10, padding: '6px 8px', color: NAVY }}>
                  <div style={{ fontSize: 13 }}>{church}</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{'<<<'} {title} {'>>>'}</div>
                  {sub && <div style={{ fontSize: 17, fontWeight: 700 }}>{sub}</div>}
                </div>
                {posterRows.length === 0
                  ? <p style={{ textAlign: 'center', color: '#667', padding: 30 }}>ยังไม่มีรายการ — ไปที่แท็บ “กรอกข้อมูล” แล้วแตะช่องเพื่อพิมพ์</p>
                  : <Grid rows={posterRows} canEdit={canEdit} onCell={(l, f) => setEdit({ line: l, focus: f })} />}
                {total > 0 && <div style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 800, color: NAVY, border: `1.5px solid ${LINE}`, borderTop: 0 }}>รวมงบประมาณ {total.toLocaleString('th-TH')} บาท</div>}
              </div>
            </FitBox>
          </ScaledPage>
        </div>)}
      {edit && (
        <RowSheet key={edit.line.id} line={edit.line} focus={edit.focus} onClose={() => setEdit(null)}
          onSave={(p) => { if (save(edit.line, p)) setEdit(null) }}
          onAdd={() => { if (addAfter(edit.line)) setEdit(null) }}
          onDelete={() => { if (window.confirm(`ลบแถว ${edit.line.day} ${edit.line.dateTxt} ${MONTH_TH[edit.line.month]} ?`) && del(edit.line)) setEdit(null) }} />)}
      {headEdit && <HeadSheet title={head?.text ?? ''} sub={head?.owner ?? ''} def={`นิมิตปี ${year}`} onClose={() => setHeadEdit(false)} onSave={(t, s) => { if (store.put([{ ...(head ?? { id: headId(year), year, date: '', seq: 0 }), text: t, owner: s, updated: 0 }])) setHeadEdit(false) }} />}
    </section>
  )
}


/** ตารางแผนงาน: fill = ยืดแถวเต็มหน้า (แผ่นกรอกข้อมูล) · ไม่ fill = แถวกระชับ (แผ่นติดบอร์ด) */
function Grid({ rows, canEdit, onCell, fill }: { rows: PlanLine[]; canEdit: boolean; onCell: (l: PlanLine, f: Focus) => void; fill?: boolean }) {
  const spans = monthSpans(rows)
  return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', flex: fill ? 1 : undefined, fontSize: fill ? 13.5 : 14.5 }}>
                    <colgroup><col style={{ width: '10%' }} /><col style={{ width: '8%' }} /><col style={{ width: '11%' }} /><col style={{ width: '40%' }} /><col style={{ width: '18%' }} /><col style={{ width: '13%' }} /></colgroup>
                    <thead><tr>{['วัน', 'วันที่', 'เดือน', 'รายละเอียด', 'ผู้รับผิดชอบ', 'งบประมาณ'].map((h) => <th key={h} style={{ border: `1.5px solid ${LINE}`, background: BLUE_T, color: NAVY, padding: '4px 2px', fontSize: 14 }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.map((l, ri) => {
                        const td = (f: Focus, content: string, extra?: React.CSSProperties) => (
                          <td onClick={() => canEdit && onCell(l, f)} aria-label={`${f} ${l.dateTxt} ${MONTH_TH[l.month]}`} style={{ border: `1px solid ${LINE}`, padding: '3px 5px', verticalAlign: 'middle', cursor: canEdit ? 'pointer' : undefined, whiteSpace: 'pre-line', lineHeight: 1.25, ...extra }}>
                            {content || (canEdit ? <span className="no-print" style={{ color: '#b3bbd6' }}>＋</span> : '')}
                          </td>)
                        const strike: React.CSSProperties = l.done ? { textDecoration: 'line-through', textDecorationColor: DATE, textDecorationThickness: 2 } : {}
                        return (
                          <tr key={l.id}>
                            {td('date', l.day, { textAlign: 'center', ...strike })}
                            {td('date', l.dateTxt, { textAlign: 'center', fontWeight: 800, color: DATE, ...strike })}
                            {spans[ri] > 0 && <td rowSpan={spans[ri]} style={{ border: `1.5px solid ${LINE}`, textAlign: 'center', background: GOLD_T, color: NAVY, fontWeight: 700, verticalAlign: 'middle' }}>{MONTH_TH[l.month]}</td>}
                            {td('text', l.text, { fontWeight: 600 })}
                            {td('owner', l.owner, { textAlign: 'center' })}
                            {td('budget', l.budget, { textAlign: 'right', fontWeight: 600 })}
                          </tr>)
                      })}
                    </tbody>
                  </table>
  )
}

function RowSheet({ line, focus, onClose, onSave, onAdd, onDelete }: { line: PlanLine; focus: Focus; onClose: () => void; onSave: (p: Partial<YearPlanRow>) => void; onAdd: () => void; onDelete: () => void }) {
  const [date, setDate] = useState(line.date)
  const [dayText, setDayText] = useState(line.day)
  const [dateText, setDateText] = useState(line.dateTxt)
  const [text, setText] = useState(line.text)
  const [owner, setOwner] = useState(line.owner)
  const [budget, setBudget] = useState(line.budget)
  const [done, setDone] = useState(line.done)
  const f = (k: Focus) => focus === k
  return (
    <Sheet title={`${line.day} ${line.dateTxt} ${MONTH_TH[line.month]}`} onClose={onClose}>
      <div className="field"><label htmlFor="yp-t">รายละเอียด (หลายบรรทัดได้)</label><textarea id="yp-t" className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus={f('text')} /></div>
      <div className="field"><label htmlFor="yp-o">ผู้รับผิดชอบ</label><input id="yp-o" className="input" value={owner} onChange={(e) => setOwner(e.target.value)} autoFocus={f('owner')} /></div>
      <div className="field"><label htmlFor="yp-b">งบประมาณ</label><input id="yp-b" className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} autoFocus={f('budget')} placeholder="เช่น 2,000" /></div>
      <label className="row" style={{ gap: 8, alignItems: 'center', margin: '4px 0 8px' }}><input type="checkbox" style={{ width: 24, height: 24 }} checked={done} onChange={(e) => setDone(e.target.checked)} /><span>✔ ทำแล้ว (ขีดฆ่าวัน/วันที่)</span></label>
      <details open={f('date')} style={{ marginBottom: 8 }}>
        <summary><b>📅 เปลี่ยนวันที่ / ข้อความวัน</b></summary>
        <div className="field"><label htmlFor="yp-d">วันที่จริง (ใช้เรียงลำดับและเลือกเดือน)</label><input id="yp-d" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label htmlFor="yp-dt">ข้อความช่อง “วัน” (เช่น เสาร์ - จันทร์)</label><input id="yp-dt" className="input" value={dayText} onChange={(e) => setDayText(e.target.value)} /></div>
        <div className="field"><label htmlFor="yp-dd">ข้อความช่อง “วันที่” (เช่น 05 - 07)</label><input id="yp-dd" className="input" value={dateText} onChange={(e) => setDateText(e.target.value)} /></div>
      </details>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--gold grow" onClick={() => onSave({ date: date || line.date, dayText: dayText.trim() === '' ? undefined : dayText.trim(), dateText: dateText.trim() === '' ? undefined : dateText.trim(), text: text.trim(), owner: owner.trim(), budget: budget.trim(), done })}>✓ บันทึก</button>
        <button type="button" className="btn" onClick={onAdd}>＋ เพิ่มแถวต่อท้ายวันนี้</button>
        <button type="button" className="btn btn--ghost" aria-label="ลบแถวนี้" onClick={onDelete}>🗑 ลบแถว</button>
      </div>
    </Sheet>
  )
}

function HeadSheet({ title, sub, def, onClose, onSave }: { title: string; sub: string; def: string; onClose: () => void; onSave: (t: string, s: string) => void }) {
  const [t, setT] = useState(title || def)
  const [s, setS] = useState(sub)
  return (
    <Sheet title="แก้หัวตาราง" onClose={onClose}>
      <div className="field"><label htmlFor="yh-t">ชื่อตาราง</label><input id="yh-t" className="input" value={t} onChange={(e) => setT(e.target.value)} autoFocus /></div>
      <div className="field"><label htmlFor="yh-s">คำบรรยายใต้ชื่อ</label><input id="yh-s" className="input" value={s} onChange={(e) => setS(e.target.value)} placeholder="เช่น “ก้าวต่อไปในนิมิต สู่ปีแห่งความบริบูรณ์”" /></div>
      <button type="button" className="btn btn--gold btn--block" onClick={() => onSave(t.trim(), s.trim())}>✓ บันทึก</button>
    </Sheet>
  )
}
