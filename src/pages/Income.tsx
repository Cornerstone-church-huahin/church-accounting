import { useState } from 'react'
import { Link } from 'react-router-dom'
import NoAccess from '../components/NoAccess'
import MoneyInput from '../components/MoneyInput'
import Sheet from '../components/Sheet'
import { can } from '../lib/access'
import { useAccounts, useIncome, useIncomeTypes } from '../lib/data'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, monthName, monthOf, newId, todayISO, yearOf } from '../lib/money'
import { UNSORTED, type IncomeEntry, type Method } from '../lib/types'
import { compressImage } from '../lib/image'
import { getSync, putBinary } from '../lib/sync'
import { useYear } from '../lib/year'

export default function Income() {
  const role = useRole()
  const { year } = useYear()
  if (!can(role, 'detail')) return <NoAccess />
  return <IncomeList key={year} year={year} />
}

function IncomeList({ year }: { year: number }) {
  const role = useRole()
  const inc = useIncome(year)
  const types = useIncomeTypes()
  const [month, setMonth] = useState(() => (yearOf(todayISO()) === year ? monthOf(todayISO()) : 0))
  const [edit, setEdit] = useState<IncomeEntry | 'new' | null>(null)
  const rows = inc.items.filter((x) => !month || monthOf(x.date) === month).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updated - a.updated))
  const total = rows.reduce((s, x) => s + x.amount, 0)
  const typeName = (id: string) => (id === UNSORTED ? 'โอน (ยังไม่แยกประเภท)' : types.byId(id)?.name ?? '(ประเภทที่ถูกลบ)')
  const canWrite = can(role, 'income')
  return (
    <>
      <div className="page-head">
        <h1>รายรับ</h1>
        {canWrite && <button type="button" className="btn btn--gold" onClick={() => setEdit('new')}>＋ บันทึกรายรับ</button>}
      </div>
      <div className="field">
        <label htmlFor="mon">เดือน</label>
        <select id="mon" className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          <option value={0}>ทั้งปี</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i + 1)}</option>)}
        </select>
      </div>
      <div className="kpi"><div><span>รวม{month ? `เดือน${monthName(month)}` : 'ทั้งปี'}</span><b>{fmtBaht(total)}</b></div><div><span>จำนวนรายการ</span><b>{rows.length}</b></div></div>
      <section className="card" aria-label="รายการรายรับ">
        {rows.length === 0 ? <p className="empty">ยังไม่มีรายรับ{canWrite ? ' — กด “บันทึกรายรับ” เพื่อเริ่ม' : ''}</p> : (
          <ul className="list">
            {rows.map((x) => {
              const body = (
                <>
                  <span className="grow"><b>{typeName(x.typeId)}</b><br />
                    <span className="small muted">{fmtDate(x.date)} · {x.method === 'cash' ? 'เงินสด' : 'โอน'}{x.ref ? ` · อ้างอิง ${x.ref}` : ''}{x.memberNo ? ` · สมาชิก ${x.memberNo}` : ''}{x.slip ? ' · 📎สลิป' : ''}{x.unknown ? ' · ❓ไม่ทราบที่มา — แตะเพื่อระบุที่มา' : ''}{x.note ? ` · ${x.note}` : ''}</span>
                  </span>
                  <span className="num"><b>{fmtBaht(x.amount)}</b></span>
                </>
              )
              return (
                <li key={x.id}>
                  {x.roundId ? <Link className="item" to={`/rounds/${x.date}`} aria-label="เปิดรอบนับเงินนี้">{body}<span className="badge">รอบนับ</span></Link>
                    : <button type="button" className="item" style={{ all: 'unset', display: 'flex', gap: '0.6rem', alignItems: 'center', width: '100%', cursor: canWrite ? 'pointer' : 'default' }} onClick={() => canWrite && setEdit(x)}>{body}</button>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {edit && <IncomeForm year={year} entry={edit === 'new' ? null : edit} onClose={() => setEdit(null)} inc={inc} />}
    </>
  )
}

export function IncomeForm({ year, entry, onClose, inc, defaultDate, preset }: { year: number; entry: IncomeEntry | null; onClose: () => void; inc: ReturnType<typeof useIncome>; defaultDate?: string; preset?: 'manual' | 'slip' }) {
  const types = useIncomeTypes()
  const accounts = useAccounts()
  const active = types.list.filter((t) => t.active || t.id === entry?.typeId)
  const [date, setDate] = useState(entry?.date ?? defaultDate ?? (yearOf(todayISO()) === year ? todayISO() : `${year}-01-01`))
  const [typeId, setTypeId] = useState(entry ? entry.typeId : preset === 'slip' ? UNSORTED : (active[0]?.id ?? ''))
  const [memberNo, setMemberNo] = useState(entry?.memberNo ?? '')
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useState<number | null>(entry?.amount ?? null)
  const [method, setMethod] = useState<Method>(entry?.method ?? (preset === 'manual' ? 'cash' : 'transfer'))
  const [ref, setRef] = useState(entry?.ref ?? '')
  const [accountId, setAccountId] = useState(entry?.accountId ?? accounts.list[0]?.id ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [err, setErr] = useState('')
  const save = async () => {
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${year + 543} (เปลี่ยนปีบัญชีที่มุมขวาบนก่อน)`)
    if (typeId === UNSORTED && method === 'cash') return setErr('เงินสดต้องเลือกประเภทถวาย (เลือก “ยังไม่แยกประเภท” ได้เฉพาะเงินโอน)')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    if (method === 'transfer' && ref.trim()) {
      const dup = inc.items.find((x) => x.id !== entry?.id && x.method === 'transfer' && x.ref === ref.trim())
      if (dup && !confirm(`เลขอ้างอิง ${ref.trim()} ถูกบันทึกแล้วเมื่อ ${fmtDate(dup.date)} (${fmtBaht(dup.amount)}) — ซ้ำใช่ไหม? กด ตกลง เพื่อบันทึกต่อ`)) return
    }
    let slip = entry?.slip
    if (slipFile && method === 'transfer') {
      const cfg = getSync()
      if (!cfg) return setErr('ต้องเชื่อมต่อออนไลน์ก่อนจึงแนบรูปสลิปได้ (รูปเก็บใน repo ข้อมูล)')
      setBusy(true)
      try {
        const { data, ext } = await compressImage(slipFile)
        const path = `attachments/${year}/slip-${Date.now().toString(36)}.${ext}`
        await putBinary(cfg, path, data, 'สลิปโอน')
        slip = { path, name: slipFile.name }
      } catch (e) { setBusy(false); return setErr(e instanceof Error ? e.message : 'แนบสลิปไม่สำเร็จ') }
      setBusy(false)
    }
    const ok = inc.put([{ id: entry?.id ?? newId('in'), date, typeId, amount, method, ...(method === 'transfer' ? { ref: ref.trim(), accountId, ...(memberNo.trim() ? { memberNo: memberNo.trim() } : {}), ...(slip ? { slip } : {}) } : {}), ...(entry?.unknown && typeId === UNSORTED ? { unknown: true } : {}), note: note.trim(), ...((entry?.source ?? preset) ? { source: entry?.source ?? preset } : {}), updated: 0 }])
    if (ok) onClose()
  }
  return (
    <Sheet title={entry ? 'แก้ไขรายรับ' : 'บันทึกรายรับ'} onClose={onClose}>
      <div className="field"><label htmlFor="i-date">วันที่</label><input id="i-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="i-type">ประเภทถวาย</label><select id="i-type" className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>{active.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}{method === 'transfer' && <option value={UNSORTED}>โอน (ยังไม่แยกประเภท)</option>}</select></div>
      <div className="field"><label htmlFor="i-amt">จำนวนเงิน (บาท)</label><MoneyInput id="i-amt" value={amount} onChange={setAmount} /></div>
      <div className="seg" role="group" aria-label="วิธีรับ">
        <button type="button" className={method === 'transfer' ? 'on' : ''} onClick={() => setMethod('transfer')}>โอนเงิน</button>
        <button type="button" className={method === 'cash' ? 'on' : ''} onClick={() => setMethod('cash')}>เงินสด</button>
      </div>
      {method === 'transfer' && (
        <>
          <div className="field"><label htmlFor="i-ref">เลขอ้างอิงการโอน</label><input id="i-ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="จากสลิป/แอปธนาคาร" /></div>
          <div className="field"><label htmlFor="i-mem">เลขสมาชิกผู้ถวาย (ไม่ต้องใส่ชื่อ)</label><input id="i-mem" className="input" inputMode="numeric" value={memberNo} onChange={(e) => setMemberNo(e.target.value)} /></div>
          <div className="field"><label htmlFor="i-slip">รูปสลิป {entry?.slip ? '(มีแล้ว — เลือกใหม่เพื่อแทนที่)' : '(ไม่บังคับ)'}</label><input id="i-slip" className="input" type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)} /></div>
          {accounts.list.length > 0 && <div className="field"><label htmlFor="i-acc">เข้าบัญชี</label><select id="i-acc" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.list.map((a) => <option key={a.id} value={a.id}>{a.name} {a.last4 && `(${a.last4})`}</option>)}</select></div>}
        </>
      )}
      <div className="field"><label htmlFor="i-note">หมายเหตุ (ไม่ต้องใส่ชื่อผู้ถวาย)</label><input id="i-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row">
        <button type="button" className="btn btn--gold grow" disabled={busy} onClick={save}>{busy ? 'กำลังอัปโหลดสลิป…' : 'บันทึก'}</button>
        {entry && <button type="button" className="btn btn--ghost" onClick={() => { if (confirm('ลบรายการนี้?') && inc.remove(entry.id)) onClose() }}>ลบ</button>}
      </div>
    </Sheet>
  )
}
