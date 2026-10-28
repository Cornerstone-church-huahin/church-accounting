import { UNKNOWN_INCOME_LABEL } from '../lib/types'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import CatalogManager, { type CatalogOps } from './CatalogManager'
import MoneyInput from './MoneyInput'
import { fmtBaht, fmtDate, newId } from '../lib/money'
import type { FundActivity, FundSub, IncomeEntry, IncomeType } from '../lib/types'
import { SubField } from './RowEditors'

const intOrNull = (s: string) => { const n = parseInt(s.replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null }
const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })

/**
 * ช่อง 1 ของฝั่งรับ: แถวบันทึก 1 บรรทัด (เลือกประเภทจากรายชื่อที่ตั้งไว้ใน ตั้งค่า) → ขึ้นเป็นแผ่น A4 ใบบันทึกการถวายด้านล่าง พร้อมยอดรวม
 */
export default function ManualIncome({ types, entries, defaultDate, canWrite, onAdd, onEdit, onDelete, onManage, withNote, subs, subOps, defaultSub, subsOnly, acts }: {
  subsOnly?: boolean; /** โหมดกิจกรรม: เลือกกิจกรรม → หมวด */ acts?: FundActivity[];
  /** หน้ากองทุนที่มีหมวด: ช่องเลือกหมวดต่อจากช่องรายการ + เพิ่ม/ลบหมวด */ subs?: FundSub[]; subOps?: CatalogOps; defaultSub?: string
  /** หน้ากองทุน: มีช่อง "รายการ / รายละเอียด" (เก็บเป็นหมายเหตุของแถว) */ withNote?: boolean
  types: IncomeType[]; entries: IncomeEntry[]; defaultDate: string; canWrite: boolean
  /** แอดมินเท่านั้น: แก้ชื่อ/ลบประเภทได้จากหน้านี้เลย (ตัวเลือกแบบเลื่อนลงใส่ปุ่มลบไม่ได้) */
  onManage?: CatalogOps
  onAdd: (items: IncomeEntry[]) => boolean; onEdit: (x: IncomeEntry) => void; onDelete: (x: IncomeEntry) => void
}) {
  const active = types.filter((t) => t.active || types.length === 1)
  const [date, setDate] = useState(defaultDate)
  const [typeId, setTypeId] = useState(active[0]?.id ?? '')
  const [env, setEnv] = useState('')
  const [cash, setCash] = useState<number | null>(null)
  const [tcount, setTcount] = useState('')
  const [transfer, setTransfer] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [subId, setSubId] = useState(defaultSub ?? '')
  const [err, setErr] = useState('')
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? (id === '' ? UNKNOWN_INCOME_LABEL : '(รายการที่ถูกลบ)')

  const save = () => {
    const errs: string[] = []
    if (!typeId) errs.push('เลือกรายการ')
    if (acts?.length && !subId) errs.push('เลือกกิจกรรมและหมวดของกิจกรรม (ถ้ากิจกรรมยังไม่มีหมวด ให้เพิ่มหมวดก่อน)')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.push('เลือกวันที่')
    if (!(cash && cash > 0) && !(transfer && transfer > 0)) errs.push('ใส่จำนวนเงินสดหรือเงินโอนอย่างน้อยหนึ่งช่อง')
    if (errs.length) return setErr(errs.join('\n'))
    const out: IncomeEntry[] = []
    if (cash && cash > 0) out.push({ id: newId('in'), updated: 0, date, typeId, amount: cash, method: 'cash', source: 'manual', ...(subs?.length ? { subId } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(intOrNull(env) ? { count: intOrNull(env) as number } : {}) })
    if (transfer && transfer > 0) out.push({ id: newId('in'), updated: 0, date, typeId, amount: transfer, method: 'transfer', source: 'manual', ...(subs?.length ? { subId } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(intOrNull(tcount) ? { count: intOrNull(tcount) as number } : {}) })
    if (!onAdd(out)) return setErr('สิทธิ์ของท่านบันทึกไม่ได้')
    setErr(''); setNote(''); setEnv(''); setCash(null); setTcount(''); setTransfer(null)
  }
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)

  return (
    <div>
      {canWrite && (
        <div className="entryrow" role="group" aria-label="บันทึกรายรับ 1 บรรทัด">
          <div className="field"><label htmlFor="mi-date">วันที่</label><input id="mi-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="mi-type">รายการ</label>
            <select id="mi-type" className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>{active.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          {(subs?.length || subOps) && <SubField id="mi-sub" subs={subs ?? []} value={subId} onChange={setSubId} ops={subOps} noCentral={subsOnly} acts={acts} />}
          {withNote && <div className="field"><label htmlFor="mi-note">รายละเอียด (พิมพ์อะไรก็ได้ เช่น ยกยอดมา)</label><input id="mi-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>}
          <div className="entryrow__pair">
            <div className="field"><label htmlFor="mi-env">จำนวนซอง</label><input id="mi-env" className="input" inputMode="numeric" value={env} onChange={(e) => setEnv(e.target.value)} placeholder="0" /></div>
            <div className="field"><label>เงินสด (บาท)</label><MoneyInput value={cash} onChange={setCash} /></div>
          </div>
          <div className="entryrow__pair">
            <div className="field"><label htmlFor="mi-tc">จำนวนโอน</label><input id="mi-tc" className="input" inputMode="numeric" value={tcount} onChange={(e) => setTcount(e.target.value)} placeholder="0" /></div>
            <div className="field"><label>เงินโอน (บาท)</label><MoneyInput value={transfer} onChange={setTransfer} /></div>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <button type="button" className="btn btn--gold" onClick={save}>＋ เพิ่มลงตาราง</button>
          {onManage && <CatalogManager noun="รายการรับ" items={active} ops={onManage} onAdded={setTypeId} />}
          <p className="muted small" style={{ margin: 0 }}>ไม่มีรายการที่ต้องการ? เพิ่มหรือลบที่ <Link to="/settings">ตั้งค่า › รายการรับ</Link></p>
        </div>
      )}


      {rows.length > 0 && canWrite && (
        <details className="editlist">
          <summary>แก้ไข / ลบรายการที่บันทึก ({rows.length})</summary>
          <ul className="list">
            {rows.map((x) => (
              <li key={x.id}>
                <span className="grow"><b>{typeName(x.typeId)}</b> · {x.method === 'cash' ? 'เงินสด' : 'โอน'}{x.count ? ` ${x.count} ${x.method === 'cash' ? 'ซอง' : 'ครั้ง'}` : ''}<br /><span className="small muted">{fmtDate(x.date)}</span></span>
                <b className="num">{m(x.amount)}</b>
                <button type="button" className="mini" aria-label="แก้ไขรายการนี้" onClick={() => onEdit(x)}>✎</button>
                <button type="button" className="mini" aria-label="ลบรายการนี้" onClick={() => onDelete(x)}>🗑</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
