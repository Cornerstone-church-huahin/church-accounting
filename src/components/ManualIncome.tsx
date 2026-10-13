import { useState } from 'react'
import MoneyInput from './MoneyInput'
import { fmtBaht, fmtDate, newId } from '../lib/money'

/** ตัวเลขในตารางแคบ: ไม่ใส่ .00 ถ้าไม่มีสตางค์ */
const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })
import type { IncomeEntry, IncomeType } from '../lib/types'

const NEW = '__new'
const intOrNull = (s: string) => { const n = parseInt(s.replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null }

/**
 * ช่อง 1 ของฝั่งรับ: แถวบันทึก 1 บรรทัด (เลือกประเภทตามรายชื่อในใบบันทึกการถวาย → ซอง/เงินสด/โอน) แล้วแสดงผลด้านล่างเป็นตารางเหมือนใบบันทึกการถวาย
 */
export default function ManualIncome({ types, entries, defaultDate, canWrite, onNewType, onAdd, onEdit, onDelete }: {
  types: IncomeType[]; onNewType: (name: string, fund: boolean) => string | null; entries: IncomeEntry[]; defaultDate: string; canWrite: boolean
  onAdd: (items: IncomeEntry[]) => boolean; onEdit: (x: IncomeEntry) => void; onDelete: (x: IncomeEntry) => void
}) {
  const active = types.filter((t) => t.active)
  const [date, setDate] = useState(defaultDate)
  const [typeId, setTypeId] = useState(active[0]?.id ?? '')
  const [env, setEnv] = useState('')
  const [cash, setCash] = useState<number | null>(null)
  const [tcount, setTcount] = useState('')
  const [transfer, setTransfer] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [newFund, setNewFund] = useState(false)
  const [err, setErr] = useState('')
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? (id === '' ? 'โอน (ยังไม่แยกประเภท)' : '(ประเภทที่ถูกลบ)')

  const save = () => {
    let tid = typeId
    if (typeId === NEW) {
      const n = newName.trim()
      if (!n) return setErr('พิมพ์ชื่อประเภทใหม่')
      const exist = active.find((t) => t.name === n)
      const id = exist ? exist.id : onNewType(n, newFund)
      if (!id) return setErr('สิทธิ์ของท่านเพิ่มประเภทไม่ได้')
      tid = id
    }
    if (!tid) return setErr('เลือกประเภท')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (!(cash && cash > 0) && !(transfer && transfer > 0)) return setErr('ใส่จำนวนเงินสดหรือเงินโอนอย่างน้อยหนึ่งช่อง')
    const out: IncomeEntry[] = []
    if (cash && cash > 0) out.push({ id: newId('in'), updated: 0, date, typeId: tid, amount: cash, method: 'cash', source: 'manual', ...(intOrNull(env) ? { count: intOrNull(env) as number } : {}) })
    if (transfer && transfer > 0) out.push({ id: newId('in'), updated: 0, date, typeId: tid, amount: transfer, method: 'transfer', source: 'manual', ...(intOrNull(tcount) ? { count: intOrNull(tcount) as number } : {}) })
    if (!onAdd(out)) return setErr('สิทธิ์ของท่านบันทึกไม่ได้')
    setErr(''); setEnv(''); setCash(null); setTcount(''); setTransfer(null); if (typeId === NEW) { setTypeId(tid); setNewName(''); setNewFund(false) }
  }

  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const sum = (m: 'cash' | 'transfer') => entries.filter((x) => x.method === m).reduce((s, x) => s + x.amount, 0)
  const cnt = (m: 'cash' | 'transfer') => entries.filter((x) => x.method === m).reduce((s, x) => s + (x.count ?? 1), 0)

  return (
    <div>
      {canWrite && (
        <div className="entryrow" role="group" aria-label="บันทึกรายรับ 1 บรรทัด">
          <div className="grid2">
            <div className="field"><label htmlFor="mi-date">วันที่</label><input id="mi-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label htmlFor="mi-type">ประเภท (เลือกตามรายชื่อ)</label>
              <select id="mi-type" className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>{active.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}<option value={NEW}>＋ เพิ่มประเภทใหม่ (พิมพ์เอง)</option></select></div>
          </div>
          {typeId === NEW && (
            <div className="grid2">
              <div className="field"><label htmlFor="mi-new">ชื่อประเภทใหม่ (เก็บไว้เป็นตัวเลือกครั้งหน้า)</label><input id="mi-new" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น ถวายพิเศษ" /></div>
              <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={newFund} onChange={(e) => setNewFund(e.target.checked)} />เป็นกองทุนวัตถุประสงค์</label>
            </div>
          )}
          <div className="grid2">
            <div className="field"><label htmlFor="mi-env">จำนวนซอง</label><input id="mi-env" className="input" inputMode="numeric" value={env} onChange={(e) => setEnv(e.target.value)} placeholder="0" /></div>
            <div className="field"><label>จำนวนเงิน (เงินสด)</label><MoneyInput value={cash} onChange={setCash} /></div>
          </div>
          <div className="grid2">
            <div className="field"><label htmlFor="mi-tc">จำนวนโอน (ครั้ง)</label><input id="mi-tc" className="input" inputMode="numeric" value={tcount} onChange={(e) => setTcount(e.target.value)} placeholder="0" /></div>
            <div className="field"><label>จำนวนเงิน (โอน)</label><MoneyInput value={transfer} onChange={setTransfer} /></div>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <button type="button" className="btn btn--gold" onClick={save}>＋ เพิ่มลงตาราง</button>
        </div>
      )}

      {rows.length === 0 ? <p className="muted small">ยังไม่มีรายการ — เลือกประเภทแล้วกรอกด้านบน รายการจะขึ้นเป็นตารางตรงนี้</p> : (
        <table className="tbl tbl--paper formtable" aria-label="ตารางบันทึกรายรับ">
          <thead><tr><th>No.</th><th>ประเภท</th><th className="num">ซอง</th><th className="num">เงินสด</th><th className="num">โอน (ครั้ง)</th><th className="num">เงินโอน</th><th className="num">รวม</th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}.</td>
                <td>{typeName(x.typeId)}<br /><span className="muted small">{fmtDate(x.date)}</span>{canWrite && <span className="acts"><button type="button" className="mini" aria-label="แก้ไขรายการนี้" onClick={() => onEdit(x)}>✎</button><button type="button" className="mini" aria-label="ลบรายการนี้" onClick={() => onDelete(x)}>🗑</button></span>}</td>
                <td className="num">{x.method === 'cash' ? x.count ?? 1 : ''}</td>
                <td className="num">{x.method === 'cash' ? m(x.amount) : ''}</td>
                <td className="num">{x.method === 'transfer' ? x.count ?? 1 : ''}</td>
                <td className="num">{x.method === 'transfer' ? m(x.amount) : ''}</td>
                <td className="num"><b>{m(x.amount)}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2}>รวมทั้งสิ้น</td><td className="num">{cnt('cash')}</td><td className="num">{m(sum('cash'))}</td><td className="num">{cnt('transfer')}</td><td className="num">{m(sum('transfer'))}</td><td className="num">{m(sum('cash') + sum('transfer'))}</td></tr></tfoot>
        </table>
      )}
    </div>
  )
}
