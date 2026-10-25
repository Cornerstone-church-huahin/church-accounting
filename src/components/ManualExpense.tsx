import { useState } from 'react'
import { Link } from 'react-router-dom'
import MoneyInput from './MoneyInput'
import PersonField from './PersonField'
import CatalogManager, { type CatalogOps } from './CatalogManager'
import { fmtBaht, fmtDate, newId } from '../lib/money'
import type { ExpenseCat, ExpenseEntry, FundSub } from '../lib/types'
import { SubField } from './RowEditors'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })

/** ช่อง 1 ของฝั่งจ่าย: แถวบันทึก 1 บรรทัดตามใบเบิก-จ่ายเงินสด (เลือกรายการที่ตั้งไว้ใน ตั้งค่า) → ขึ้นเป็นแผ่น A4 ใบเบิกด้านล่าง พร้อมยอดรวม */
export default function ManualExpense({ cats, onManage, entries, defaultDate, canWrite, onAdd, onEdit, onDelete, subs, subOps, defaultSub, subsOnly }: {
  subsOnly?: boolean;
  /** หน้ากองทุนที่มีหมวด: ช่องเลือกหมวดต่อจากช่องรายการ + เพิ่ม/ลบหมวด */ subs?: FundSub[]; subOps?: CatalogOps; defaultSub?: string
  cats: ExpenseCat[]; /** แอดมิน: เพิ่ม/แก้ชื่อ/ลบรายการจ่ายได้จากหน้านี้ */ onManage?: CatalogOps; entries: ExpenseEntry[]; defaultDate: string; canWrite: boolean
  onAdd: (e: ExpenseEntry) => boolean; onEdit: (x: ExpenseEntry) => void; onDelete: (x: ExpenseEntry) => void
}) {
  const items = cats.filter((c) => c.active && c.kind === 'group')
  const [date, setDate] = useState(defaultDate)
  const [item, setItem] = useState(items[0]?.id ?? '')
  const [amount, setAmount] = useState<number | null>(null)
  const [requester, setRequester] = useState('')
  const [payee, setPayee] = useState('')
  const [biller, setBiller] = useState('')
  const [subId, setSubId] = useState(defaultSub ?? '')
  const [err, setErr] = useState('')

  const save = () => {
    const q = items.find((x) => x.id === item)
    if (!q) return setErr('เลือกรายการ')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงิน')
    const ok = onAdd({ id: newId('ex'), updated: 0, channel: 'manual', date, amount, desc: q.name, catId: q.id, ...(subs?.length ? { subId } : {}), ...(payee.trim() ? { who: payee.trim() } : {}), ...(requester.trim() ? { requester: requester.trim() } : {}), ...(biller ? { biller } : {}), status: 'paid', paidDate: date, method: 'cash' })
    if (!ok) return setErr('สิทธิ์ของท่านบันทึกไม่ได้')
    setErr(''); setAmount(null); setBiller('')
  }
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)

  return (
    <div>
      {canWrite && (
        <div className="entryrow" role="group" aria-label="บันทึกรายจ่าย 1 บรรทัด">
          <div className="field"><label htmlFor="me-date">วันที่</label><input id="me-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="me-item">รายการ</label>
            <select id="me-item" className="input" value={item} onChange={(e) => setItem(e.target.value)}>{items.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select></div>
          {(subs?.length || subOps) && <SubField id="me-sub" subs={subs ?? []} value={subId} onChange={setSubId} ops={subOps} noCentral={subsOnly} />}
          <div className="field"><label>จำนวนเงิน (บาท)</label><MoneyInput value={amount} onChange={setAmount} /></div>
          <div className="entryrow__pair">
            <div className="field"><label htmlFor="me-req">หมายเหตุ</label><input id="me-req" className="input" value={requester} placeholder="พิมพ์อะไรก็ได้ เช่น มน.เสาวคน สำรองจ่าย" onChange={(e) => setRequester(e.target.value)} /></div>
            <div className="field"><label htmlFor="me-pay">ผู้รับเงิน</label><input id="me-pay" className="input" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
          </div>
          <PersonField id="me-biller" value={biller} onChange={setBiller} />
          {err && <p className="err" role="alert">{err}</p>}
          <button type="button" className="btn btn--gold" onClick={save}>＋ เพิ่มลงตาราง</button>
          {onManage && <CatalogManager noun="รายการจ่าย" items={items} ops={onManage} onAdded={setItem} />}
          <p className="muted small" style={{ margin: 0 }}>ไม่มีรายการที่ต้องการ? เพิ่มหรือลบที่ <Link to="/settings">ตั้งค่า › รายการจ่าย</Link></p>
        </div>
      )}


      {rows.length > 0 && canWrite && (
        <details className="editlist">
          <summary>แก้ไข / ลบรายการที่บันทึก ({rows.length})</summary>
          <ul className="list">
            {rows.map((x) => (
              <li key={x.id}>
                <span className="grow"><b>{x.desc}</b><br /><span className="small muted">{fmtDate(x.date)}{x.requester ? ` · หมายเหตุ ${x.requester}` : ''}{x.who ? ` · รับ ${x.who}` : ''}</span></span>
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
