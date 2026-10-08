import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import MoneyInput from '../components/MoneyInput'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import { can, isSolo, whoAmI } from '../lib/access'
import { useAccounts, useBudgetLines, useSettings, useVouchers } from '../lib/data'
import { compressImage } from '../lib/image'
import { approveBlock, isFullyApproved, stageOf, STAGE_LABEL, stepsNeeded } from '../lib/ledger'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, todayISO } from '../lib/money'
import { getBinary, getSync, putBinary } from '../lib/sync'
import type { Attachment, Voucher } from '../lib/types'

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
  const accounts = useAccounts()
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
  const line = lines.items.find((l) => l.id === v.lineId)
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
      <div className="page-head"><h1>ใบเบิก {v.no}</h1><span className={`badge ${stage === 'done' ? 'badge--good' : stage === 'rejected' ? 'badge--bad' : 'badge--gold'}`}>{STAGE_LABEL[stage]}</span></div>
      <section className="card">
        <div className="money-big">{fmtBaht(v.amount)} <span className="small muted">บาท</span></div>
        <table className="tbl"><tbody>
          <tr><th>จ่ายให้</th><td>{v.payee}</td></tr>
          <tr><th>รายการ</th><td>{v.purpose}</td></tr>
          <tr><th>หมวดงบ</th><td>{line?.name ?? 'นอกงบประมาณ'}</td></tr>
          <tr><th>ยื่นเมื่อ</th><td>{fmtDate(v.date)} โดย {v.requester.name}</td></tr>
          {v.paid && <tr><th>จ่ายแล้ว</th><td>{fmtDate(v.paid.date)} · {{ cash: 'เงินสด', transfer: 'โอน', cheque: 'เช็ค' }[v.paid.method]}{v.paid.ref ? ` · อ้างอิง ${v.paid.ref}` : ''} · โดย {v.paid.by}</td></tr>}
          {v.rejected && <tr><th>ไม่อนุมัติ</th><td className="bad">{v.rejected.name}: {v.rejected.reason}</td></tr>}
        </tbody></table>
      </section>

      <section className="card" aria-labelledby="h-ap">
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
        <section className="card"><h2>จ่ายเงิน</h2><p className="muted small">จ่ายเงินให้ผู้รับตามใบเบิกแล้ว กดบันทึกการจ่าย แล้วแนบใบเสร็จ</p><button type="button" className="btn btn--gold" onClick={() => setPaying(true)}>💸 บันทึกการจ่ายเงิน</button></section>
      )}

      <Attachments v={v} year={year} canAttach={can(role, 'attach') || v.requester.id === me.id} onChange={(attachments) => save({ attachments })} setMsg={setMsg} />

      {stage === 'check' && can(role, 'voucherReview') && (
        <section className="card">
          <h2>รับรองใบเสร็จ</h2>
          <p className="muted small">ตรวจรูปใบเสร็จว่าตรงกับรายการและยอดเงิน {fmtBaht(v.amount)} บาท</p>
          <button type="button" className="btn btn--gold" disabled={v.paid?.by === me.name && !isSolo()} onClick={() => save({ receiptOk: { name: me.name, at: Date.now() } })}>✓ ใบเสร็จถูกต้องครบถ้วน</button>
          {v.paid?.by === me.name && !isSolo() && <p className="small muted">ผู้จ่ายเงินรับรองใบเสร็จของตัวเองไม่ได้</p>}
        </section>
      )}
      {v.receiptOk && <p className="ok">✓ ใบเสร็จรับรองแล้วโดย {v.receiptOk.name}</p>}
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}
      {paying && <PayForm v={v} accounts={accounts.list} onClose={() => setPaying(false)} onPaid={(paid) => { save({ status: 'paid', paid: { ...paid, by: me.name } }); setPaying(false) }} />}
    </>
  )
}

function PayForm({ v, accounts, onClose, onPaid }: { v: Voucher; accounts: { id: string; name: string; last4: string }[]; onClose: () => void; onPaid: (p: { date: string; method: 'cash' | 'transfer' | 'cheque'; ref?: string; accountId?: string }) => void }) {
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<'cash' | 'transfer' | 'cheque'>('cash')
  const [ref, setRef] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [amount, setAmount] = useState<number | null>(v.amount)
  const [err, setErr] = useState('')
  const go = () => {
    if (amount !== v.amount) return setErr(`ยอดที่จ่ายต้องเท่ากับยอดในใบเบิก ${fmtBaht(v.amount)} บาท (ถ้าจ่ายต่างไป ให้ยกเลิกใบนี้แล้วทำใบใหม่)`)
    onPaid({ date, method, ...(ref.trim() ? { ref: ref.trim() } : {}), ...(method !== 'cash' && accountId ? { accountId } : {}) })
  }
  return (
    <Sheet title="บันทึกการจ่ายเงิน" onClose={onClose}>
      <div className="field"><label htmlFor="p-date">วันที่จ่าย</label><input id="p-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="p-amt">ยอดที่จ่าย (บาท)</label><MoneyInput id="p-amt" value={amount} onChange={setAmount} /></div>
      <div className="seg" role="group" aria-label="วิธีจ่าย">{(['cash', 'transfer', 'cheque'] as const).map((m) => <button key={m} type="button" className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{{ cash: 'เงินสด', transfer: 'โอน', cheque: 'เช็ค' }[m]}</button>)}</div>
      {method !== 'cash' && (
        <>
          {accounts.length > 0 && <div className="field"><label htmlFor="p-acc">จากบัญชี</label><select id="p-acc" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {a.last4 && `(${a.last4})`}</option>)}</select></div>}
          <div className="field"><label htmlFor="p-ref">เลขอ้างอิงการโอน/เลขที่เช็ค</label><input id="p-ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        </>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={go}>บันทึกการจ่าย</button>
    </Sheet>
  )
}

function Attachments({ v, year, canAttach, onChange, setMsg }: { v: Voucher; year: number; canAttach: boolean; onChange: (a: Attachment[]) => void; setMsg: (m: { ok: boolean; text: string } | null) => void }) {
  const [kind, setKind] = useState<Attachment['kind']>(v.status === 'paid' ? 'receipt' : 'quote')
  const [busy, setBusy] = useState(false)
  const me = whoAmI()
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
    <section className="card" aria-labelledby="h-att">
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
