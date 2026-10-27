import { useState } from 'react'
import PersonField from './PersonField'
import MoneyInput from './MoneyInput'
import Sheet from './Sheet'
import StoredImage, { LocalImage } from './StoredImage'
import CatalogManager, { type CatalogOps } from './CatalogManager'
import { fmtDate, newId } from '../lib/money'
import type { ExpenseCat, ExpenseEntry, FundActivity, FundSub, IncomeEntry, IncomeType } from '../lib/types'

/**
 * ช่องเลือกหมวดของกองทุน (ต่อจากช่อง "รายการ") + เพิ่ม/แก้ชื่อ/ลบหมวดได้ในฟอร์ม — ว่าง = ส่วนกลาง
 * โหมดกิจกรรม (ส่ง acts มา): 2 ช่อง — เลือก กิจกรรม (ชื่อกิจกรรมของกองทุน ใหม่อยู่บน) แล้วเลือก หมวดของกิจกรรมนั้น · หมวดใหม่เพิ่มใต้กิจกรรมที่เลือก
 */
export function SubField({ id, subs, value, onChange, ops, noCentral, acts }: { id: string; subs: FundSub[]; value: string; onChange: (v: string) => void; ops?: CatalogOps; noCentral?: boolean; acts?: FundActivity[] }) {
  const cur = subs.find((q) => q.id === value)
  const [actSel, setActSel] = useState(cur?.actId ?? acts?.[0]?.id ?? '')
  if (acts?.length) {
    const inAct = subs.filter((q) => q.actId === actSel)
    const pickAct = (a: string) => { setActSel(a); onChange(subs.find((q) => q.actId === a)?.id ?? '') }
    return (
      <>
        <div className="field"><label htmlFor={`${id}-act`}>กิจกรรม</label>
          <select id={`${id}-act`} className="input" value={actSel} onChange={(e) => pickAct(e.target.value)}>{acts.map((a) => <option key={a.id} value={a.id}>{a.name} · {fmtDate(a.date)}</option>)}</select></div>
        <div className="field"><label htmlFor={id}>หมวดของกิจกรรม</label>
          <select id={id} className="input" value={inAct.some((q) => q.id === value) ? value : ''} onChange={(e) => onChange(e.target.value)}>
            {inAct.length === 0 ? <option value="">— กิจกรรมนี้ยังไม่มีหมวด —</option> : inAct.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          {inAct.length === 0 && <p className="small muted" style={{ margin: '2px 0' }}>เพิ่มหมวดให้กิจกรรมนี้ก่อน (ปุ่มด้านล่าง) จึงบันทึกได้</p>}
          {ops && <CatalogManager noun="หมวด" items={inAct} ops={ops} scope={actSel} onAdded={onChange} />}
        </div>
      </>
    )
  }
  return (
    <div className="field"><label htmlFor={id}>หมวดของกองทุน</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>{!noCentral && <option value="">ส่วนกลาง (ยังไม่ระบุหมวด)</option>}{subs.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select>
      {ops && <CatalogManager noun="หมวด" items={subs} ops={ops} onAdded={onChange} />}
    </div>
  )
}

const intOrNull = (s: string) => { const n = parseInt(s.replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null }

/** แตะแถวในใบบันทึกการถวายเพื่อแก้ไข (หรือแตะแถวว่างเพื่อเพิ่ม) — ตารางในใบเปลี่ยนทันทีหลังบันทึก */
export function IncomeRowEditor({ entry, types, defaultDate, onSave, onDelete, onClose, onManage, noteMode, onUpload, onDropPhoto, subs, defaultSub, subOps, subsOnly, acts }: {
  subsOnly?: boolean; /** โหมดกิจกรรม: เลือกกิจกรรม → หมวด */ acts?: FundActivity[]
  /** กองทุนที่มีหมวด: ตัวเลือกหมวด + หมวดเริ่มต้น + เพิ่ม/ลบหมวด */ subs?: FundSub[]; defaultSub?: string; subOps?: CatalogOps
  /** แนบรูปหลักฐานได้หลายรูป: อัปโหลดทีละรูปแล้วคืนที่อยู่ไฟล์ · onDropPhoto = ลบไฟล์ที่เอาออกจาก repo */ onUpload?: (f: File) => Promise<{ path: string; name: string }>; onDropPhoto?: (path: string) => void
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
  const [subId, setSubId] = useState(entry?.subId ?? defaultSub ?? '')
  const [kept, setKept] = useState(entry?.photos ?? [])
  const [picks, setPicks] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!typeId && !label.trim()) return setErr('เลือกรายการหรือพิมพ์ชื่อรายการใหม่')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (acts?.length && !subId) return setErr('เลือกกิจกรรมและหมวดของกิจกรรม (ถ้ากิจกรรมยังไม่มีหมวด ให้เพิ่มหมวดก่อน)')
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
    const { count: _c, note: _n, photos: _p, subId: _s, ...rest } = entry ?? ({} as IncomeEntry)
    void _c; void _n; void _p; void _s
    const photos = [...kept]
    if (picks.length && onUpload) {
      setBusy(true)
      try { for (const f of picks) photos.push(await onUpload(f)) } catch (x) { setBusy(false); return setErr(x instanceof Error ? x.message : 'แนบรูปไม่สำเร็จ') }
      setBusy(false)
    }
    const e = { ...rest, id: entry?.id ?? newId('in'), updated: 0, date, typeId: useType, amount, method, source: entry?.source ?? 'manual', ...(photos.length ? { photos } : {}), ...(subs?.length ? { subId } : {}), ...(n ? { count: n } : {}), ...(noteMode ? (typed ? { note: typed } : {}) : (entry?.note ? { note: entry.note } : {})) } as IncomeEntry
    const r = onSave(e)
    if (r) return setErr(r)
    for (const p of entry?.photos ?? []) if (!kept.some((k) => k.path === p.path)) onDropPhoto?.(p.path)
    onClose()
  }
  return (
    <Sheet title={entry ? 'แก้ไขรายการในใบบันทึกการถวาย' : 'เพิ่มรายการในใบบันทึกการถวาย'} onClose={onClose}>
      <div className="field"><label htmlFor="ire-date">วันที่</label><input id="ire-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="ire-type">รายการ</label><select id="ire-type" className="input" value={typeId} onChange={(e) => { setTypeId(e.target.value); setLabel(nameOf(e.target.value)) }}>{opts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        {onManage && <CatalogManager noun="รายการรับ" items={opts} ops={{ ...onManage, add: (n) => { const r = onManage.add(n); if (!('error' in r)) setLabel(n.trim()); return r } }} onAdded={setTypeId} />}</div>
      {(subs?.length || subOps) && <SubField id="ire-sub" subs={subs ?? []} value={subId} onChange={setSubId} ops={subOps} noCentral={subsOnly} acts={acts} />}
      <div className="field"><label htmlFor="ire-label">{noteMode ? 'รายละเอียด (พิมพ์อะไรก็ได้ เช่น ยกยอดมา)' : 'ชื่อรายการ (แก้ข้อความได้ — พิมพ์ชื่อใหม่ถ้าไม่มีในตัวเลือก)'}</label><input id="ire-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={noteMode ? 'เช่น ยกยอดมา' : 'เช่น ถวายค่าไฟ'} /></div>
      <div className="seg" role="group" aria-label="ช่องทาง"><button type="button" className={method === 'cash' ? 'on' : ''} onClick={() => setMethod('cash')}>เงินสด (ตู้ถวาย)</button><button type="button" className={method === 'transfer' ? 'on' : ''} onClick={() => setMethod('transfer')}>โอน</button></div>
      <div className="field"><label htmlFor="ire-count">{method === 'cash' ? 'จำนวนซอง' : 'จำนวนโอน (ครั้ง)'}</label><input id="ire-count" className="input" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="0" /></div>
      <div className="field"><label>จำนวนเงิน (บาท)</label><MoneyInput value={amount} onChange={setAmount} /></div>
      {onUpload && (
        <div className="field">
          <label htmlFor="ire-photos">รูปหลักฐาน (เลือกได้หลายรูป){kept.length + picks.length > 0 ? ` — ${kept.length + picks.length} รูป` : ''}</label>
          <input id="ire-photos" className="input" type="file" accept="image/*" multiple onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) setPicks((p) => [...p, ...fs]) }} />
          <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
            {kept.map((k) => <div key={k.path} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 6 }}><StoredImage path={k.path} alt={`รูปหลักฐาน ${k.name}`} /><button type="button" className="mini" onClick={() => setKept((a) => a.filter((x) => x.path !== k.path))}>✕ เอารูปนี้ออก</button></div>)}
            {picks.map((f, i) => <div key={`${f.name}${i}`} style={{ border: '1px dashed var(--line)', borderRadius: 8, padding: 6 }}><LocalImage file={f} alt={`รูปที่เลือก ${f.name}`} /><button type="button" className="mini" onClick={() => setPicks((a) => a.filter((_, j) => j !== i))}>✕ ไม่เอารูปนี้</button></div>)}
          </div>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" disabled={busy} onClick={() => void save()}>{busy ? 'กำลังอัปโหลด…' : entry ? 'บันทึกการแก้ไข' : 'เพิ่มลงใบ'}</button>{entry && onDelete && <button type="button" className="btn btn--ghost" onClick={() => { onDelete(entry); onClose() }}>🗑 ลบ</button>}</div>
    </Sheet>
  )
}

/** แตะแถวในใบเบิก-จ่ายเงินสดเพื่อแก้ไข (หรือแตะแถวว่างเพื่อเพิ่ม) */
export function ExpenseRowEditor({ entry, cats, defaultDate, onSave, onDelete, onClose, onManage, onUpload, subs, defaultSub, subOps, subsOnly, acts }: {
  subsOnly?: boolean; /** โหมดกิจกรรม: เลือกกิจกรรม → หมวด */ acts?: FundActivity[]
  /** กองทุนที่มีหมวด: ตัวเลือกหมวด + หมวดเริ่มต้น + เพิ่ม/ลบหมวด */ subs?: FundSub[]; defaultSub?: string; subOps?: CatalogOps
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
  const [subId, setSubId] = useState(entry?.subId ?? defaultSub ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('เลือกวันที่')
    if (!desc.trim()) return setErr('ใส่รายการ')
    if (acts?.length && !subId) return setErr('เลือกกิจกรรมและหมวดของกิจกรรม (ถ้ากิจกรรมยังไม่มีหมวด ให้เพิ่มหมวดก่อน)')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    let file = entry?.file
    if (pic && onUpload) { setBusy(true); try { file = await onUpload(pic) } catch (e) { setBusy(false); return setErr(e instanceof Error ? e.message : 'แนบรูปไม่สำเร็จ') } setBusy(false) }
    const { requester: _r, who: _w, catId: _c, biller: _b, subId: _s, ...rest } = entry ?? ({} as ExpenseEntry)
    void _r; void _w; void _c; void _b; void _s
    const e = { ...rest, id: entry?.id ?? newId('ex'), updated: 0, channel: entry?.channel ?? 'manual', date, amount, desc: desc.trim(), status: entry?.status ?? 'paid', paidDate: entry?.paidDate ?? date, method: entry?.method ?? 'cash',
      ...(catId ? { catId } : {}), ...(note.trim() ? { requester: note.trim() } : {}), ...(payee.trim() ? { who: payee.trim() } : {}), ...(biller ? { biller } : {}), ...(file ? { file } : {}), ...(subs?.length ? { subId } : {}) } as ExpenseEntry
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
      {(subs?.length || subOps) && <SubField id="ere-sub" subs={subs ?? []} value={subId} onChange={setSubId} ops={subOps} noCentral={subsOnly} acts={acts} />}
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
