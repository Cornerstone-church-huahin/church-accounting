import { useState } from 'react'
import PersonField from './PersonField'
import MoneyInput from './MoneyInput'
import Sheet from './Sheet'
import { newId } from '../lib/money'
import type { ExpenseCat, ExpenseEntry, IncomeEntry, IncomeType } from '../lib/types'

const intOrNull = (s: string) => { const n = parseInt(s.replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null }

/** แตะแถวในใบบันทึกการถวายเพื่อแก้ไข (หรือแตะแถวว่างเพื่อเพิ่ม) — ตารางในใบเปลี่ยนทันทีหลังบันทึก */
export function IncomeRowEditor({ entry, types, defaultDate, onSave, onDelete, onClose }: {
  entry: IncomeEntry | null; types: IncomeType[]; defaultDate: string; onSave: (e: IncomeEntry) => string | null; onDelete?: (e: IncomeEntry) => void; onClose: () => void
}) {
  const opts = types.filter((t) => t.active || t.id === entry?.typeId)
  const [date, setDate] = useState(entry?.date ?? defaultDate)
  const [typeId, setTypeId] = useState(entry?.typeId ?? opts[0]?.id ?? '')
  const [method, setMethod] = useState<'cash' | 'transfer'>(entry?.method ?? 'cash')
  const [count, setCount] = useState(entry?.count ? String(entry.count) : '')
  const [amount, setAmount] = useState<number | null>(entry?.amount ?? null)
  const [err, setErr] = useState('')
  const save = () => {
    if (!typeId) return setErr('เลือกประเภท')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    const n = intOrNull(count)
    const { count: _c, ...rest } = entry ?? ({} as IncomeEntry)
    void _c
    const e = { ...rest, id: entry?.id ?? newId('in'), updated: 0, date, typeId, amount, method, source: entry?.source ?? 'manual', ...(n ? { count: n } : {}) } as IncomeEntry
    const r = onSave(e)
    if (r) setErr(r); else onClose()
  }
  return (
    <Sheet title={entry ? 'แก้ไขรายการในใบบันทึกการถวาย' : 'เพิ่มรายการในใบบันทึกการถวาย'} onClose={onClose}>
      <div className="field"><label htmlFor="ire-date">วันที่</label><input id="ire-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="ire-type">ประเภท</label><select id="ire-type" className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>{opts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div className="seg" role="group" aria-label="ช่องทาง"><button type="button" className={method === 'cash' ? 'on' : ''} onClick={() => setMethod('cash')}>เงินสด (ตู้ถวาย)</button><button type="button" className={method === 'transfer' ? 'on' : ''} onClick={() => setMethod('transfer')}>โอน</button></div>
      <div className="field"><label htmlFor="ire-count">{method === 'cash' ? 'จำนวนซอง' : 'จำนวนโอน (ครั้ง)'}</label><input id="ire-count" className="input" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="0" /></div>
      <div className="field"><label>จำนวนเงิน (บาท)</label><MoneyInput value={amount} onChange={setAmount} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>{entry ? 'บันทึกการแก้ไข' : 'เพิ่มลงใบ'}</button>{entry && onDelete && <button type="button" className="btn btn--ghost" onClick={() => { onDelete(entry); onClose() }}>🗑 ลบ</button>}</div>
    </Sheet>
  )
}

/** แตะแถวในใบเบิก-จ่ายเงินสดเพื่อแก้ไข (หรือแตะแถวว่างเพื่อเพิ่ม) */
export function ExpenseRowEditor({ entry, cats, defaultDate, onSave, onDelete, onClose }: {
  entry: ExpenseEntry | null; cats: ExpenseCat[]; defaultDate: string; onSave: (e: ExpenseEntry) => string | null; onDelete?: (e: ExpenseEntry) => void; onClose: () => void
}) {
  const items = cats.filter((c) => c.kind === 'group' && (c.active || c.id === entry?.catId))
  const [date, setDate] = useState(entry?.date ?? defaultDate)
  const [catId, setCatId] = useState(entry?.catId ?? (entry ? '' : items[0]?.id ?? ''))
  const [desc, setDesc] = useState(entry?.desc ?? items[0]?.name ?? '')
  const [amount, setAmount] = useState<number | null>(entry?.amount ?? null)
  const [note, setNote] = useState(entry?.requester ?? entry?.note ?? '')
  const [payee, setPayee] = useState(entry?.who ?? '')
  const [biller, setBiller] = useState(entry?.biller ?? '')
  const [err, setErr] = useState('')
  const save = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (!desc.trim()) return setErr('ใส่รายการ')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    const { requester: _r, who: _w, catId: _c, biller: _b, ...rest } = entry ?? ({} as ExpenseEntry)
    void _r; void _w; void _c; void _b
    const e = { ...rest, id: entry?.id ?? newId('ex'), updated: 0, channel: entry?.channel ?? 'manual', date, amount, desc: desc.trim(), status: entry?.status ?? 'paid', paidDate: entry?.paidDate ?? date, method: entry?.method ?? 'cash',
      ...(catId ? { catId } : {}), ...(note.trim() ? { requester: note.trim() } : {}), ...(payee.trim() ? { who: payee.trim() } : {}), ...(biller ? { biller } : {}) } as ExpenseEntry
    const r = onSave(e)
    if (r) setErr(r); else onClose()
  }
  return (
    <Sheet title={entry ? 'แก้ไขรายการในใบเบิก-จ่ายเงินสด' : 'เพิ่มรายการในใบเบิก-จ่ายเงินสด'} onClose={onClose}>
      <div className="field"><label htmlFor="ere-date">วันที่</label><input id="ere-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="ere-item">หมวด/รายการที่ตั้งไว้</label>
        <select id="ere-item" className="input" value={catId} onChange={(e) => { setCatId(e.target.value); const c = items.find((x) => x.id === e.target.value); if (c) setDesc(c.name) }}>
          <option value="">— ไม่ระบุหมวด —</option>{items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="ere-desc">รายการ (แก้ข้อความได้)</label><input id="ere-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field"><label>จำนวนเงิน (บาท)</label><MoneyInput value={amount} onChange={setAmount} /></div>
      <div className="field"><label htmlFor="ere-note">หมายเหตุ</label><input id="ere-note" className="input" value={note} placeholder="พิมพ์อะไรก็ได้ เช่น มน.เสาวคน สำรองจ่าย" onChange={(e) => setNote(e.target.value)} /></div>
      <PersonField id="ere-biller" value={biller} onChange={setBiller} />
      <div className="field"><label htmlFor="ere-pay">ผู้รับเงิน</label><input id="ere-pay" className="input" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>{entry ? 'บันทึกการแก้ไข' : 'เพิ่มลงใบ'}</button>{entry && onDelete && <button type="button" className="btn btn--ghost" onClick={() => { onDelete(entry); onClose() }}>🗑 ลบ</button>}</div>
    </Sheet>
  )
}
