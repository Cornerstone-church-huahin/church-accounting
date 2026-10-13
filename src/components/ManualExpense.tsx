import { useState } from 'react'
import MoneyInput from './MoneyInput'
import { fmtBaht, fmtDate, newId } from '../lib/money'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })
import type { ExpenseCat, ExpenseEntry } from '../lib/types'

const OTHER = '__other'

/** ช่อง 1 ของฝั่งจ่าย: แถวบันทึก 1 บรรทัดตามใบเบิก-จ่ายเงินสด (เลือกรายการจากรายชื่อ → จำนวนเงิน ผู้เบิก ผู้รับ) แล้วแสดงเป็นตารางด้านล่าง */
export default function ManualExpense({ cats, entries, defaultDate, canWrite, onNewItem, onAdd, onEdit, onDelete }: {
  /** รายการจ่าย (เลือกจากรายการนี้ · พิมพ์ชื่อใหม่เพื่อเพิ่ม) */
  cats: ExpenseCat[]; onNewItem: (name: string) => ExpenseCat | null; entries: ExpenseEntry[]; defaultDate: string; canWrite: boolean
  onAdd: (e: ExpenseEntry) => boolean; onEdit: (x: ExpenseEntry) => void; onDelete: (x: ExpenseEntry) => void
}) {
  const [date, setDate] = useState(defaultDate)
  const items = cats.filter((c) => c.active && c.kind === 'group')
  const [item, setItem] = useState(items[0]?.id ?? OTHER)
  const [custom, setCustom] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [requester, setRequester] = useState('')
  const [payee, setPayee] = useState('')
  const [err, setErr] = useState('')

  const save = () => {
    let q = items.find((x) => x.id === item)
    const desc = q ? q.name : custom.trim()
    if (!desc) return setErr('เลือกรายการ หรือพิมพ์ชื่อรายการ')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงิน')
    // พิมพ์ชื่อใหม่ → เก็บเป็นตัวเลือกถาวร ดึงมาใช้ครั้งหน้าได้
    if (!q) { const made = onNewItem(desc); if (!made) return setErr('สิทธิ์ของท่านเพิ่มรายการไม่ได้'); q = made }
    const ok = onAdd({ id: newId('ex'), updated: 0, channel: 'manual', date, amount, desc, catId: q.id, ...(payee.trim() ? { who: payee.trim() } : {}), ...(requester.trim() ? { requester: requester.trim() } : {}), status: 'paid', paidDate: date, method: 'cash' })
    if (!ok) return setErr('สิทธิ์ของท่านบันทึกไม่ได้')
    setErr(''); setAmount(null); setCustom(''); setItem(q.id)
  }
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const total = entries.reduce((s, x) => s + x.amount, 0)

  return (
    <div>
      {canWrite && (
        <div className="entryrow" role="group" aria-label="บันทึกรายจ่าย 1 บรรทัด">
          <div className="grid2">
            <div className="field"><label htmlFor="me-date">วันที่</label><input id="me-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label htmlFor="me-item">รายการ (เลือกตามรายชื่อ)</label>
              <select id="me-item" className="input" value={item} onChange={(e) => setItem(e.target.value)}>{items.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}<option value={OTHER}>＋ เพิ่มรายการใหม่ (พิมพ์เอง)</option></select></div>
          </div>
          {item === OTHER && (
            <div className="field"><label htmlFor="me-custom">ชื่อรายการใหม่ (เก็บไว้เป็นตัวเลือกครั้งหน้า)</label><input id="me-custom" className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="เช่น ค่าน้ำมันรถสีขาว" /></div>
          )}
          <div className="field"><label>จำนวนเงิน</label><MoneyInput value={amount} onChange={setAmount} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="me-req">ผู้เบิกเงิน</label><input id="me-req" className="input" value={requester} onChange={(e) => setRequester(e.target.value)} /></div>
            <div className="field"><label htmlFor="me-pay">ผู้รับเงิน</label><input id="me-pay" className="input" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <button type="button" className="btn btn--gold" onClick={save}>＋ เพิ่มลงตาราง</button>
        </div>
      )}

      {rows.length === 0 ? <p className="muted small">ยังไม่มีรายการ — เลือกรายการแล้วกรอกด้านบน รายการจะขึ้นเป็นตารางตรงนี้</p> : (
        <table className="tbl tbl--paper formtable" aria-label="ตารางใบเบิก-จ่ายเงินสด">
          <thead><tr><th>ลำดับ</th><th>รายการ</th><th className="num">จำนวนเงิน</th><th>ผู้เบิกเงิน</th><th>ผู้รับเงิน</th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td>{x.desc}<br /><span className="muted small">{fmtDate(x.date)}</span>{canWrite && <span className="acts"><button type="button" className="mini" aria-label="แก้ไขรายการนี้" onClick={() => onEdit(x)}>✎</button><button type="button" className="mini" aria-label="ลบรายการนี้" onClick={() => onDelete(x)}>🗑</button></span>}</td>
                <td className="num">{m(x.amount)}</td>
                <td>{x.requester ?? ''}</td>
                <td>{x.who ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2}>รวมจ่ายเป็นเงินทั้งสิ้น</td><td className="num">{m(total)}</td><td colSpan={2}>บาท</td></tr></tfoot>
        </table>
      )}
    </div>
  )
}
