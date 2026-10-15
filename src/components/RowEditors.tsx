import { useState } from 'react'
import PersonField from './PersonField'
import MoneyInput from './MoneyInput'
import Sheet from './Sheet'
import StoredImage from './StoredImage'
import CatalogManager, { type CatalogOps } from './CatalogManager'
import { newId } from '../lib/money'
import type { ExpenseCat, ExpenseEntry, IncomeEntry, IncomeType } from '../lib/types'

const intOrNull = (s: string) => { const n = parseInt(s.replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null }

/** แตะแถวในใบบันทึกการถวายเพื่อแก้ไข (หรือแตะแถวว่างเพื่อเพิ่ม) — ตารางในใบเปลี่ยนทันทีหลังบันทึก */
export function IncomeRowEditor({ entry, types, defaultDate, onSave, onDelete, onClose, onManage, noteMode }: {
  /** แอดมิน: เพิ่ม/แก้ชื่อ/ลบประเภทจากป๊อปอัพนี้ได้ (ข้อมูลชุดเดียวกับตั้งค่า) */ onManage?: CatalogOps
  /** หน้ากองทุน: ประเภทมีกองทุนเดียว ช่อง "รายการ" เป็นข้อความอธิบายของแถว (เก็บเป็นหมายเหตุ) ไม่สร้างประเภทใหม่ */ noteMode?: boolean
  entry: IncomeEntry | null; types: IncomeType[]; defaultDate: string; onSave: (e: IncomeEntry) => string | null; onDelete?: (e: IncomeEntry) => void; onClose: () => void
}) {
  const opts = types.filter((t) => t.active || t.id === entry?.typeId)
  const [date, setDate] = useState(entry?.date ?? defaultDate)
  const [typeId, setTypeId] = useState(entry?.typeId ?? opts[0]?.id ?? '')
  const nameOf = (id: string) => types.find((t) => t.id === id)?.name ?? ''
  const [label, setLabel] = useState(noteMode ? entry?.note ?? '' : nameOf(entry?.typeId ?? opts[0]?.id ?? ''))
  const [method, setMethod] = useState<'cash' | 'transfer'>(entry?.method ?? 'cash')
  const [count, setCount] = useState(entry?.count ? String(entry.count) : '')
  const [amount, setAmount] = useState<number | null>(entry?.amount ?? null)
  const [err, setErr] = useState('')
  const save = () => {
    if (!typeId && !label.trim()) return setErr('เลือกรายการหรือพิมพ์ชื่อรายการใหม่')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    // พิมพ์ชื่อที่ไม่มีในตัวเลือก (ไม่ได้ใช้บ่อย) → ใช้ประเภทที่ชื่อตรงกัน ไม่มีก็สร้างใหม่ในรายการปกติ (ขึ้นใน ตั้งค่า › รายการรับ ด้วย)
    let useType = typeId
    const typed = label.trim()
    if (!noteMode && typed && typed !== nameOf(typeId)) {
      const hit = types.find((t) => t.name === typed)
      if (hit) useType = hit.id
      else {
        if (!onManage) return setErr('สิทธิ์ของท่านเพิ่มรายการใหม่ไม่ได้ — เลือกจากตัวเลือกแทน')
        const r = onManage.add(typed)
        if ('error' in r) return setErr(r.error)
        useType = r.id
      }
    }
    const n = intOrNull(count)
    const { count: _c, note: _n, ...rest } = entry ?? ({} as IncomeEntry)
    void _c; void _n
    const e = { ...rest, id: entry?.id ?? newId('in'), updated: 0, date, typeId: useType, amount, method, source: entry?.source ?? 'manual', ...(n ? { count: n } : {}), ...(noteMode ? (typed ? { note: typed } : {}) : (entry?.note ? { note: entry.note } : {})) } as IncomeEntry
    const r = onSave(e)
    if (r) setErr(r); else onClose()
  }
  return (
    <Sheet title={entry ? 'แก้ไขรายการในใบบันทึกการถวาย' : 'เพิ่มรายการในใบบันทึกการถวาย'} onClose={onClose}>
      <div className="field"><label htmlFor="ire-date">วันที่</label><input id="ire-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="ire-type">รายการ</label><select id="ire-type" className="input" value={typeId} onChange={(e) => { setTypeId(e.target.value); setLabel(nameOf(e.target.value)) }}>{opts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        {onManage && <CatalogManager noun="รายการรับ" items={opts} ops={{ ...onManage, add: (n) => { const r = onManage.add(n); if (!('error' in r)) setLabel(n.trim()); return r } }} onAdded={setTypeId} />}</div>
      <div className="field"><label htmlFor="ire-label">{noteMode ? 'รายละเอียด (พิมพ์อะไรก็ได้ เช่น ยกยอดมา)' : 'ชื่อรายการ (แก้ข้อความได้ — พิมพ์ชื่อใหม่ถ้าไม่มีในตัวเลือก)'}</label><input id="ire-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={noteMode ? 'เช่น ยกยอดมา' : 'เช่น ถวายค่าไฟ'} /></div>
      <div className="seg" role="group" aria-label="ช่องทาง"><button type="button" className={method === 'cash' ? 'on' : ''} onClick={() => setMethod('cash')}>เงินสด (ตู้ถวาย)</button><button type="button" className={method === 'transfer' ? 'on' : ''} onClick={() => setMethod('transfer')}>โอน</button></div>
      <div className="field"><label htmlFor="ire-count">{method === 'cash' ? 'จำนวนซอง' : 'จำนวนโอน (ครั้ง)'}</label><input id="ire-count" className="input" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="0" /></div>
      <div className="field"><label>จำนวนเงิน (บาท)</label><MoneyInput value={amount} onChange={setAmount} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>{entry ? 'บันทึกการแก้ไข' : 'เพิ่มลงใบ'}</button>{entry && onDelete && <button type="button" className="btn btn--ghost" onClick={() => { onDelete(entry); onClose() }}>🗑 ลบ</button>}</div>
    </Sheet>
  )
}

/** แตะแถวในใบเบิก-จ่ายเงินสดเพื่อแก้ไข (หรือแตะแถวว่างเพื่อเพิ่ม) */
export function ExpenseRowEditor({ entry, cats, defaultDate, onSave, onDelete, onClose, onManage, onUpload }: {
  /** แนบรูปบิล/สลิปเป็นหลักฐาน (อัปโหลดแล้วคืนที่เก็บรูป) */ onUpload?: (f: File) => Promise<{ path: string; name: string }>
  /** แอดมิน: เพิ่ม/แก้ชื่อ/ลบรายการจ่ายจากป๊อปอัพนี้ได้ (ข้อมูลชุดเดียวกับตั้งค่า) */ onManage?: CatalogOps

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
  const [pic, setPic] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (!desc.trim()) return setErr('ใส่รายการ')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    let file = entry?.file
    if (pic && onUpload) { setBusy(true); try { file = await onUpload(pic) } catch (e) { setBusy(false); return setErr(e instanceof Error ? e.message : 'แนบรูปไม่สำเร็จ') } setBusy(false) }
    const { requester: _r, who: _w, catId: _c, biller: _b, ...rest } = entry ?? ({} as ExpenseEntry)
    void _r; void _w; void _c; void _b
    const e = { ...rest, id: entry?.id ?? newId('ex'), updated: 0, channel: entry?.channel ?? 'manual', date, amount, desc: desc.trim(), status: entry?.status ?? 'paid', paidDate: entry?.paidDate ?? date, method: entry?.method ?? 'cash',
      ...(catId ? { catId } : {}), ...(note.trim() ? { requester: note.trim() } : {}), ...(payee.trim() ? { who: payee.trim() } : {}), ...(biller ? { biller } : {}), ...(file ? { file } : {}) } as ExpenseEntry
    const r = onSave(e)
    if (r) setErr(r); else onClose()
  }
  return (
    <Sheet title={entry ? 'แก้ไขรายการในใบเบิก-จ่ายเงินสด' : 'เพิ่มรายการในใบเบิก-จ่ายเงินสด'} onClose={onClose}>
      <div className="field"><label htmlFor="ere-date">วันที่</label><input id="ere-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="ere-item">หมวด/รายการที่ตั้งไว้</label>
        <select id="ere-item" className="input" value={catId} onChange={(e) => { setCatId(e.target.value); const c = items.find((x) => x.id === e.target.value); if (c) setDesc(c.name) }}>
          <option value="">— ไม่ระบุหมวด —</option>{items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {onManage && <CatalogManager noun="รายการจ่าย" items={items} ops={{ ...onManage, add: (n) => { const r = onManage.add(n); if (!('error' in r)) setDesc(n.trim()); return r } }} onAdded={setCatId} />}</div>
      <div className="field"><label htmlFor="ere-desc">รายการ (แก้ข้อความได้)</label><input id="ere-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field"><label>จำนวนเงิน (บาท)</label><MoneyInput value={amount} onChange={setAmount} /></div>
      <div className="field"><label htmlFor="ere-note">หมายเหตุ</label><input id="ere-note" className="input" value={note} placeholder="พิมพ์อะไรก็ได้ เช่น มน.เสาวคน สำรองจ่าย" onChange={(e) => setNote(e.target.value)} /></div>
      {onUpload && <div className="field"><label htmlFor="ere-file">รูปบิล / สลิป / รูปสำรองจ่าย (แนบเป็นหลักฐาน){entry?.file && !pic ? ' — มีแล้ว เลือกใหม่เพื่อแทนที่' : ''}</label><input id="ere-file" className="input" type="file" accept="image/*" onChange={(e) => setPic(e.target.files?.[0] ?? null)} />{entry?.file && !pic && <StoredImage path={entry.file.path} alt="รูปที่แนบไว้" />}</div>}
      <PersonField id="ere-biller" value={biller} onChange={setBiller} />
      <div className="field"><label htmlFor="ere-pay">ผู้รับเงิน</label><input id="ere-pay" className="input" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" disabled={busy} onClick={() => void save()}>{busy ? 'กำลังอัปโหลด…' : entry ? 'บันทึกการแก้ไข' : 'เพิ่มลงใบ'}</button>{entry && onDelete && <button type="button" className="btn btn--ghost" onClick={() => { onDelete(entry); onClose() }}>🗑 ลบ</button>}</div>
    </Sheet>
  )
}
