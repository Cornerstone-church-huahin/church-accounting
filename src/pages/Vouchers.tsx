import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MoneyInput from '../components/MoneyInput'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import { can, isSolo, whoAmI } from '../lib/access'
import { useBudgetAdjs, useBudgetLines, useSettings, useVouchers } from '../lib/data'
import { budgetRows, STAGE_LABEL, stageOf, tasksFor, weekSummary, type Stage } from '../lib/ledger'
import { useRole } from '../lib/members'
import { addDays, be, fmtBaht, fmtDate, todayISO, yearOf } from '../lib/money'
import type { Voucher } from '../lib/types'
import { useYear } from '../lib/year'

export const NO_BUDGET = '__none'
const WHO: Record<Stage, string> = {
  review: 'ผู้ตรวจสอบ/แอดมิน ตรวจและอนุมัติ', pay: 'ผู้บันทึกบัญชี/แอดมิน จ่ายเงินและบันทึกการจ่าย', receipt: 'ผู้ขอเบิก/ผู้บันทึกบัญชี แนบรูปใบเสร็จ', check: 'ผู้ตรวจสอบ/แอดมิน ตรวจและรับรองใบเสร็จ', done: '', rejected: '', void: '',
}

export default function Vouchers() {
  const role = useRole()
  const { year } = useYear()
  if (!can(role, 'detail')) return <NoAccess />
  return <List key={year} year={year} />
}

function List({ year }: { year: number }) {
  const role = useRole()
  const v = useVouchers(year)
  const lines = useBudgetLines(year)
  const { settings } = useSettings()
  const me = whoAmI()
  const [anchor, setAnchor] = useState(() => (yearOf(todayISO()) === year ? todayISO() : `${year}-12-31`))
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const sum = useMemo(() => weekSummary(v.items, anchor), [v.items, anchor])
  const mine = tasksFor(role, me.id, v.items, settings.twoStepOver, isSolo())
  const lineName = (id: string) => lines.items.find((l) => l.id === id)?.name ?? 'นอกงบประมาณ'
  const rows = v.items.filter((x) => stage === 'all' || stageOf(x) === stage).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.no.localeCompare(a.no)))
  return (
    <>
      <div className="page-head">
        <h1>ใบเบิกจ่าย</h1>
        {can(role, 'voucherCreate') && <button type="button" className="btn btn--gold" onClick={() => setCreating(true)}>＋ ทำใบเบิก</button>}
      </div>

      <section className="card" aria-labelledby="h-week">
        <div className="row row--between">
          <h2 id="h-week">สรุปสัปดาห์</h2>
          <span className="row no-print">
            <button type="button" className="mini" aria-label="สัปดาห์ก่อน" onClick={() => setAnchor(addDays(sum.from, -7))}>‹</button>
            <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => setAnchor(addDays(sum.from, 7))}>›</button>
          </span>
        </div>
        <p className="muted small">{fmtDate(sum.from)} – {fmtDate(sum.to)} (อาทิตย์–เสาร์)</p>
        <div className="kpi">
          <div><span>ยื่นเบิกสัปดาห์นี้</span><b>{fmtBaht(sum.filed.total)}</b><span>{sum.filed.count} ใบ</span></div>
          <div><span>จ่ายแล้ว (ของใบที่ยื่นสัปดาห์นี้)</span><b>{fmtBaht(sum.byStage.receipt.total + sum.byStage.check.total + sum.byStage.done.total)}</b></div>
        </div>
        <h3>ที่ค้างอยู่ทั้งหมด — ใครต้องทำอะไร</h3>
        {sum.open.every((o) => o.count === 0) ? <p className="ok">✓ ไม่มีใบเบิกค้าง</p> : (
          <ul className="list">
            {sum.open.filter((o) => o.count > 0).map((o) => (
              <li key={o.stage}><button type="button" className="item" style={{ all: 'unset', display: 'flex', width: '100%', gap: '0.6rem', alignItems: 'center', cursor: 'pointer' }} onClick={() => setStage(o.stage)}>
                <span className="grow"><b>{STAGE_LABEL[o.stage]}</b> · {o.count} ใบ<br /><span className="small muted">{WHO[o.stage]}</span></span><b className="num">{fmtBaht(o.total)}</b></button></li>
            ))}
          </ul>
        )}
      </section>

      {mine.length > 0 && (
        <section className="card" aria-labelledby="h-mine">
          <h2 id="h-mine">งานของท่าน ({mine.length})</h2>
          <ul className="list">{mine.map((t) => <li key={t.voucher.id}><Link className="item" to={`/vouchers/${t.voucher.id}`}><span className="grow"><b>{t.text}</b><br /><span className="small muted">{t.voucher.no} · {t.voucher.payee} · {t.voucher.purpose}</span></span><b className="num">{fmtBaht(t.voucher.amount)}</b></Link></li>)}</ul>
        </section>
      )}

      <div className="field no-print">
        <label htmlFor="st">แสดง</label>
        <select id="st" className="input" value={stage} onChange={(e) => setStage(e.target.value as Stage | 'all')}>
          <option value="all">ทุกใบ (ปี {be(year)})</option>
          {(Object.keys(STAGE_LABEL) as Stage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </div>
      <section className="card" aria-label="รายการใบเบิก">
        {rows.length === 0 ? <p className="empty">ไม่มีใบเบิก</p> : (
          <ul className="list">
            {rows.map((x) => (
              <li key={x.id}><Link className="item" to={`/vouchers/${x.id}`}>
                <span className="grow"><b>{x.payee}</b> <span className="small muted">· {x.no}</span><br /><span className="small muted">{fmtDate(x.date)} · {lineName(x.lineId)} · {x.purpose}</span></span>
                <span style={{ textAlign: 'right' }}><b className="num">{fmtBaht(x.amount)}</b><br /><span className={`badge ${stageOf(x) === 'done' ? 'badge--good' : stageOf(x) === 'rejected' ? 'badge--bad' : ''}`}>{STAGE_LABEL[stageOf(x)]}</span></span>
              </Link></li>
            ))}
          </ul>
        )}
      </section>
      {creating && <NewVoucher year={year} onClose={() => setCreating(false)} v={v} />}
    </>
  )
}

function NewVoucher({ year, onClose, v }: { year: number; onClose: () => void; v: ReturnType<typeof useVouchers> }) {
  const lines = useBudgetLines(year)
  const adjs = useBudgetAdjs(year)
  const me = whoAmI()
  const [date, setDate] = useState(yearOf(todayISO()) === year ? todayISO() : `${year}-01-01`)
  const [payee, setPayee] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [lineId, setLineId] = useState(lines.items[0]?.id ?? NO_BUDGET)
  const [err, setErr] = useState('')
  const rows = budgetRows(lines.items, adjs.items, v.items)
  const row = rows.find((r) => r.line.id === lineId)
  const over = row && amount ? amount > row.remaining : false
  const save = () => {
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${be(year)} (เปลี่ยนปีบัญชีที่มุมขวาบนก่อน)`)
    if (!payee.trim() || !purpose.trim()) return setErr('ใส่ชื่อผู้รับเงิน/ร้านค้า และรายการที่เบิก')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    const n = Math.max(0, ...v.all.map((x) => parseInt(x.no.split('-')[1] ?? '0', 10) || 0)) + 1
    const rec: Voucher = {
      id: `vc-${year}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`, no: `${be(year)}-${String(n).padStart(3, '0')}`, date,
      requester: { id: me.id, name: me.name }, payee: payee.trim(), purpose: purpose.trim(), amount, lineId, status: 'submitted', approvals: [], attachments: [], updated: 0,
    }
    if (v.put([rec])) onClose()
  }
  return (
    <Sheet title="ทำใบเบิกจ่าย" onClose={onClose}>
      <div className="field"><label htmlFor="v-date">วันที่ยื่น</label><input id="v-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="v-payee">จ่ายให้ (ผู้รับเงิน/ร้านค้า)</label><input id="v-payee" className="input" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
      <div className="field"><label htmlFor="v-purpose">รายการที่เบิก</label><textarea id="v-purpose" className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
      <div className="field"><label htmlFor="v-amt">จำนวนเงิน (บาท)</label><MoneyInput id="v-amt" value={amount} onChange={setAmount} /></div>
      <div className="field">
        <label htmlFor="v-line">หมวดงบประมาณ</label>
        <select id="v-line" className="input" value={lineId} onChange={(e) => setLineId(e.target.value)}>
          {rows.map((r) => <option key={r.line.id} value={r.line.id}>{r.line.name} (เหลือ {fmtBaht(r.remaining, { dec: false })})</option>)}
          <option value={NO_BUDGET}>นอกงบประมาณ</option>
        </select>
      </div>
      {lineId === NO_BUDGET && <p className="note">รายการนอกงบประมาณ — ผู้อนุมัติจะเห็นข้อความนี้</p>}
      {over && <p className="note">⚠️ เกินงบคงเหลือของหมวดนี้ {fmtBaht((amount ?? 0) - row!.remaining)} บาท (ยังยื่นได้ แต่ผู้อนุมัติจะต้องพิจารณา หรือให้แอดมินปรับงบก่อน)</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>ยื่นใบเบิก</button>
      <p className="foot-note">แนบใบเสนอราคา/ใบเสร็จได้ที่หน้ารายละเอียดหลังยื่น</p>
    </Sheet>
  )
}
