import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import { can, isSolo, whoAmI } from '../lib/access'
import { useBudgetLines, useSettings, useVouchers } from '../lib/data'
import { compressImage } from '../lib/image'
import { approveBlock, isFullyApproved, stageOf, STAGE_LABEL, stepsNeeded, voucherItems } from '../lib/ledger'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, fmtDateLong, todayISO } from '../lib/money'
import { getBinary, getSync, putBinary } from '../lib/sync'
import type { Attachment, Voucher } from '../lib/types'
import { METHOD_LABEL } from './Vouchers'

export default function VoucherDetail() {
  const { id = '' } = useParams()
  const role = useRole()
  const year = Number(id.split('-')[1])
  if (!can(role, 'detail')) return <NoAccess />
  if (!(year >= 2000)) return <p className="empty">ไม่พบใบเบิก</p>
  return <Detail key={id} id={id} year={year} />
}

function Detail({ id, year }: { id: string; year: number }) {
  const role = useRole()
  const vs = useVouchers(year)
  const lines = useBudgetLines(year)
  const { settings } = useSettings()
  const me = whoAmI()
  const v = vs.items.find((x) => x.id === id)
  const [paying, setPaying] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!v) return <p className="empty">ไม่พบใบเบิกนี้ (อาจยังซิงก์ไม่เสร็จ) <button type="button" className="mini" onClick={vs.syncNow}>🔄 ซิงก์</button></p>

  const actor = { id: me.id, name: me.name, role }
  const stage = stageOf(v)
  const block = approveBlock(v, actor, settings.twoStepOver, isSolo())
  const need = stepsNeeded(v.amount, settings.twoStepOver)
  const items = voucherItems(v)
  const lineName = (id: string) => { const l = lines.all.find((x) => x.id === id); return l ? (l.deleted ? `${l.name} (ลบแล้ว)` : l.name) : 'นอกงบประมาณ' }
  const save = (patch: Partial<Voucher>) => vs.put([{ ...v, ...patch }])

  const approve = () => {
    const note = prompt('หมายเหตุประกอบการอนุมัติ (ไม่ใส่ก็ได้)') ?? ''
    const approvals = [...v.approvals, { id: me.id, name: me.name, role: role === 'admin' ? 'admin' as const : 'auditor' as const, at: Date.now(), ...(note.trim() ? { note: note.trim() } : {}) }]
    const next = { ...v, approvals }
    save({ approvals, status: isFullyApproved(next, settings.twoStepOver) ? 'approved' : 'submitted' })
  }
  const reject = () => {
    const reason = prompt('เหตุผลที่ไม่อนุมัติ')?.trim()
    if (reason) save({ status: 'rejected', rejected: { name: me.name, reason, at: Date.now() } })
  }

  return (
    <>
      <div className="page-head no-print"><h1>ใบเบิก {v.no}</h1><span className={`badge ${stage === 'done' ? 'badge--good' : stage === 'rejected' ? 'badge--bad' : 'badge--gold'}`}>{STAGE_LABEL[stage]}</span></div>
      <section className="card no-print">
        <div className="money-big">{fmtBaht(v.amount)} <span className="small muted">บาท</span></div>
        <p className="small muted">ยื่นเมื่อ {fmtDate(v.date)} โดย {v.requester.name}{v.payee ? ` · ผู้รับเงิน ${v.payee}` : ''}{v.paid ? ` · จ่ายแล้ว ${fmtDate(v.paid.date)} โดย ${v.paid.by}` : ''}</p>
        <div className="scroll-x"><table className="tbl"><thead><tr><th>#</th><th>รายการ</th><th>หมวดงบ</th><th>จ่ายโดย</th><th className="num">บาท</th></tr></thead>
          <tbody>{items.map((it, n) => <tr key={n}><td>{n + 1}</td><td>{it.desc}{it.ref ? <><br /><span className="small muted">อ้างอิง {it.ref}</span></> : null}</td><td>{lineName(it.lineId)}</td><td>{METHOD_LABEL[it.method]}</td><td className="num">{fmtBaht(it.amount)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={4}>รวมจ่ายเป็นเงินทั้งสิ้น</td><td className="num">{fmtBaht(v.amount)}</td></tr></tfoot></table></div>
        {v.rejected && <p className="bad">ไม่อนุมัติโดย {v.rejected.name}: {v.rejected.reason}</p>}
        <button type="button" className="mini no-print" onClick={() => window.print()}>🖨️ พิมพ์ใบเบิก</button>
      </section>

      <PrintForm v={v} items={items} lineName={lineName} />

      <section className="card no-print" aria-labelledby="h-ap">
        <h2 id="h-ap">การอนุมัติ ({v.approvals.length}/{need})</h2>
        <p className="small muted">{need === 1 ? 'ใบเบิกนี้ไม่เกินเกณฑ์: ผู้ตรวจสอบหรือแอดมิน 1 คนอนุมัติ' : `ใบเบิกนี้เกิน ${fmtBaht(settings.twoStepOver, { dec: false })} บาท: ต้องอนุมัติ 2 คนต่างกัน และมีแอดมินอย่างน้อย 1 คน`}</p>
        <ul className="list">{v.approvals.map((a) => <li key={a.id}><span className="grow"><b>{a.name}</b> <span className="small muted">({a.role === 'admin' ? 'แอดมิน' : 'ผู้ตรวจสอบ'} · {new Date(a.at).toLocaleDateString('th-TH')})</span>{a.note && <><br /><span className="small">{a.note}</span></>}</span><span className="ok">✓</span></li>)}</ul>
        {v.status === 'submitted' && (
          <>
            {can(role, 'voucherReview') && (
              <div className="row">
                <button type="button" className="btn btn--gold" disabled={!!block} onClick={approve}>✓ อนุมัติ</button>
                <button type="button" className="btn btn--ghost" onClick={reject}>✕ ไม่อนุมัติ</button>
              </div>
            )}
            {can(role, 'voucherReview') && block && <p className="small muted">{block}</p>}
          </>
        )}
        {(v.status === 'submitted' || v.status === 'approved') && (v.requester.id === me.id || role === 'admin') && (
          <button type="button" className="mini" onClick={() => confirm('ยกเลิกใบเบิกนี้?') && save({ status: 'void' })}>ยกเลิกใบเบิก</button>
        )}
      </section>

      {v.status === 'approved' && can(role, 'voucherPay') && (
        <section className="card no-print"><h2>จ่ายเงิน</h2><p className="muted small">จ่ายเงินให้ผู้รับตามใบเบิกแล้ว กดบันทึกการจ่าย แล้วแนบใบเสร็จ</p><button type="button" className="btn btn--gold" onClick={() => setPaying(true)}>💸 บันทึกการจ่ายเงิน</button></section>
      )}

      <Attachments v={v} year={year} canAttach={can(role, 'attach') || v.requester.id === me.id} onChange={(attachments) => save({ attachments })} setMsg={setMsg} />

      {stage === 'check' && can(role, 'voucherReview') && (
        <section className="card no-print">
          <h2>รับรองใบเสร็จ</h2>
          <p className="muted small">ตรวจรูปใบเสร็จว่าตรงกับรายการและยอดเงิน {fmtBaht(v.amount)} บาท</p>
          <button type="button" className="btn btn--gold" disabled={v.paid?.by === me.name && !isSolo()} onClick={() => save({ receiptOk: { name: me.name, at: Date.now() } })}>✓ ใบเสร็จถูกต้องครบถ้วน</button>
          {v.paid?.by === me.name && !isSolo() && <p className="small muted">ผู้จ่ายเงินรับรองใบเสร็จของตัวเองไม่ได้</p>}
        </section>
      )}
      {v.receiptOk && <p className="ok no-print">✓ ใบเสร็จรับรองแล้วโดย {v.receiptOk.name}</p>}
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}
      {paying && <PayForm v={v} onClose={() => setPaying(false)} onPaid={(date, its) => { save({ status: 'paid', items: its, paid: { date, by: me.name } }); setPaying(false) }} />}
    </>
  )
}

function PayForm({ v, onClose, onPaid }: { v: Voucher; onClose: () => void; onPaid: (date: string, items: ReturnType<typeof voucherItems>) => void }) {
  const [date, setDate] = useState(todayISO())
  const [items, setItems] = useState(voucherItems(v))
  const go = () => onPaid(date, items)
  return (
    <Sheet title="บันทึกการจ่ายเงิน" onClose={onClose}>
      <p className="muted small">ยอดรวม {fmtBaht(v.amount)} บาท ตามใบเบิก — จ่ายครบทุกรายการแล้วจึงกดบันทึก</p>
      <div className="field"><label htmlFor="p-date">วันที่จ่าย</label><input id="p-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      {items.map((it, n) => it.method !== 'cash' && (
        <div className="field" key={n}>
          <label htmlFor={`p-r${n}`}>เลขอ้างอิงการโอน — {it.desc} ({fmtBaht(it.amount)})</label>
          <input id={`p-r${n}`} className="input" value={it.ref ?? ''} placeholder="จากสลิป" onChange={(e) => setItems(items.map((x, i) => (i === n ? { ...x, ref: e.target.value } : x)))} />
        </div>
      ))}
      <button type="button" className="btn btn--gold" onClick={go}>บันทึกการจ่าย</button>
    </Sheet>
  )
}

/** หน้าตาตามใบเบิก-จ่ายเงินสดของคริสตจักร (ซ่อนบนจอ แสดงเฉพาะตอนพิมพ์) */
function PrintForm({ v, items, lineName }: { v: Voucher; items: ReturnType<typeof voucherItems>; lineName: (id: string) => string }) {
  const { settings } = useSettings()
  const rows = Math.max(items.length, 14)
  return (
    <section className="print-only" aria-hidden="true">
      <p style={{ textAlign: 'right' }}>{fmtDateLong(v.date)}</p>
      <h2 style={{ textAlign: 'center' }}>{settings.churchName}</h2>
      <h2 style={{ textAlign: 'center', textDecoration: 'underline' }}>ใบเบิก - จ่ายเงิน (เลขที่ {v.no})</h2>
      <table className="tbl" style={{ fontSize: '11pt' }}>
        <thead><tr><th>ลำดับที่</th><th>รายการ</th><th>หมวดงบ</th><th className="num">จำนวนเงิน</th><th>ผู้เบิกเงิน</th><th>ผู้รับเงิน</th></tr></thead>
        <tbody>{Array.from({ length: rows }, (_, n) => { const it = items[n]; return <tr key={n} style={{ height: '1.6rem' }}><td>{it ? n + 1 : ''}</td><td>{it?.desc}{it?.ref ? ` (อ้างอิง ${it.ref})` : ''}{it && it.method !== 'cash' ? ` [${METHOD_LABEL[it.method]}]` : ''}</td><td>{it ? lineName(it.lineId) : ''}</td><td className="num">{it ? fmtBaht(it.amount) : ''}</td><td /><td /></tr> })}</tbody>
        <tfoot><tr><td colSpan={3}>รวมจ่ายเป็นเงินทั้งสิ้น</td><td className="num">{fmtBaht(v.amount)}</td><td colSpan={2}>บาท</td></tr></tfoot>
      </table>
      <div className="sign" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div>ผู้อนุมัติ / ตรวจสอบ{v.approvals.length > 0 && <><br /><span className="small">{v.approvals.map((a) => a.name).join(', ')}</span></>}<br /><span className="small">วันที่ ........../........../..........</span></div>
        <div>ผู้จ่าย / ฝ่ายบัญชี{v.paid && <><br /><span className="small">{v.paid.by}</span></>}<br /><span className="small">วันที่ {v.paid ? fmtDate(v.paid.date) : '........../........../..........'}</span></div>
      </div>
    </section>
  )
}

function Attachments({ v, year, canAttach, onChange, setMsg }: { v: Voucher; year: number; canAttach: boolean; onChange: (a: Attachment[]) => void; setMsg: (m: { ok: boolean; text: string } | null) => void }) {
  const [kind, setKind] = useState<Attachment['kind']>(v.status === 'paid' ? 'receipt' : 'quote')
  const [busy, setBusy] = useState(false)
  const me = whoAmI()
  useEffect(() => { if (v.status === 'paid') setKind('receipt') }, [v.status])
  const add = async (f: File | null) => {
    if (!f) return
    const cfg = getSync()
    if (!cfg) return setMsg({ ok: false, text: 'ต้องเชื่อมต่อออนไลน์ก่อนจึงแนบรูปได้ (ที่ตั้งค่า › เชื่อมต่อออนไลน์) เพราะรูปเก็บใน repo ข้อมูล' })
    setBusy(true); setMsg(null)
    try {
      const { data, ext } = await compressImage(f)
      if (data.byteLength > 6 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 6 MB')
      const path = `attachments/${year}/${v.id}-${Date.now().toString(36)}.${ext}`
      await putBinary(cfg, path, data, `ใบเบิก ${v.no}`)
      onChange([...v.attachments, { path, name: f.name, kind, at: Date.now(), by: me.name }])
      setMsg({ ok: true, text: 'แนบไฟล์แล้ว ✓' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'แนบไฟล์ไม่สำเร็จ' })
    } finally { setBusy(false) }
  }
  return (
    <section className="card no-print" aria-labelledby="h-att">
      <h2 id="h-att">รูปใบเสร็จและเอกสาร ({v.attachments.length})</h2>
      <div className="thumbs">{v.attachments.map((a) => <Thumb key={a.path} a={a} />)}</div>
      {v.attachments.length === 0 && <p className="muted small">ยังไม่มีไฟล์แนบ{v.status === 'paid' ? ' — ต้องแนบใบเสร็จ' : ''}</p>}
      {canAttach && v.status !== 'void' && v.status !== 'rejected' && (
        <>
          <div className="seg" role="group" aria-label="ชนิดเอกสาร">{([['receipt', 'ใบเสร็จ'], ['quote', 'ใบเสนอราคา'], ['other', 'อื่น ๆ']] as const).map(([k, l]) => <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
          <label className="btn btn--ghost" style={{ cursor: 'pointer' }}>{busy ? 'กำลังอัปโหลด…' : '📷 ถ่ายรูป / เลือกรูป'}<input type="file" accept="image/*,application/pdf" capture={undefined} hidden disabled={busy} onChange={(e) => { add(e.target.files?.[0] ?? null); e.target.value = '' }} /></label>
        </>
      )}
    </section>
  )
}

function Thumb({ a }: { a: Attachment }) {
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    let u = ''
    const cfg = getSync()
    if (!cfg) return setErr('ออฟไลน์')
    getBinary(cfg, a.path).then((b) => { u = URL.createObjectURL(b); setUrl(u) }).catch((e: Error) => setErr(e.message))
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [a.path])
  const label = { receipt: 'ใบเสร็จ', quote: 'ใบเสนอราคา', other: 'เอกสาร' }[a.kind]
  return (
    <figure style={{ margin: 0 }}>
      {url ? (/\.pdf$/i.test(a.path) ? <a href={url} target="_blank" rel="noreferrer">📄 เปิด PDF</a> : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${label} โดย ${a.by}`} /></a>) : <div className="badge">{err || 'กำลังโหลด…'}</div>}
      <figcaption className="small muted">{label}</figcaption>
    </figure>
  )
}
