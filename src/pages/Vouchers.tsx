import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MoneyInput from '../components/MoneyInput'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import { can, isSolo, whoAmI } from '../lib/access'
import { useBudgetAdjs, useBudgetLines, useExpenseCats, useFunds, useSettings, useVouchers } from '../lib/data'
import { budgetRows, itemsTotal, STAGE_LABEL, stageOf, tasksFor, voucherTitle, weekSummary, type Stage } from '../lib/ledger'
import { useRole } from '../lib/members'
import { addDays, be, fmtBaht, fmtDate, todayISO, yearOf } from '../lib/money'
import type { PayMethod, Voucher, VoucherItem } from '../lib/types'
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
  const { settings } = useSettings()
  const me = whoAmI()
  const [anchor, setAnchor] = useState(() => (yearOf(todayISO()) === year ? todayISO() : `${year}-12-31`))
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const sum = useMemo(() => weekSummary(v.items, anchor), [v.items, anchor])
  const mine = tasksFor(role, me.id, v.items, settings.twoStepOver, isSolo())
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
          <ul className="list">{mine.map((t) => <li key={t.voucher.id}><Link className="item" to={`/vouchers/${t.voucher.id}`}><span className="grow"><b>{t.text}</b><br /><span className="small muted">{t.voucher.no} · {voucherTitle(t.voucher)}</span></span><b className="num">{fmtBaht(t.voucher.amount)}</b></Link></li>)}</ul>
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
                <span className="grow"><b>{x.no}</b> <span className="small muted">· {fmtDate(x.date)}</span><br /><span className="small muted">{voucherTitle(x)}{x.payee ? ` · ${x.payee}` : ''}</span></span>
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

const METHOD_LABEL: Record<PayMethod, string> = { cash: 'เงินสด', transfer: 'โอนจากบัญชีคริสตจักร', advance: 'สำรองจ่าย (เบิกคืน)' }
export { METHOD_LABEL }

/** ใบเบิก-จ่ายเงินสด: 1 ใบมีหลายรายการ แต่ละรายการมีจำนวนเงินและหมวดงบของตัวเอง */
export function NewVoucher({ year, onClose, v }: { year: number; onClose: () => void; v: ReturnType<typeof useVouchers> }) {
  const lines = useBudgetLines(year)
  const adjs = useBudgetAdjs(year)
  const funds = useFunds()
  const cats = useExpenseCats()
  const me = whoAmI()
  const [date, setDate] = useState(yearOf(todayISO()) === year ? todayISO() : `${year}-01-01`)
  const [payee, setPayee] = useState('')
  const blank = (): { desc: string; amount: number | null; lineId: string; method: PayMethod; catId: string } => ({ desc: '', amount: null, lineId: lines.items[0]?.id ?? NO_BUDGET, method: 'cash', catId: '' })
  const [items, setItems] = useState([blank()])
  const [err, setErr] = useState('')
  const rows = budgetRows(lines.items, adjs.items, v.items)
  const total = items.reduce((s, i) => s + (i.amount ?? 0), 0)
  const set = (n: number, patch: Partial<ReturnType<typeof blank>>) => setItems(items.map((it, i) => (i === n ? { ...it, ...patch } : it)))
  // เทียบงบคงเหลือรวมต่อหมวดของทุกรายการในใบนี้
  const overs = rows.filter((r) => items.filter((i) => i.lineId === r.line.id).reduce((s, i) => s + (i.amount ?? 0), 0) > r.remaining)
  const save = () => {
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${be(year)} (เปลี่ยนปีบัญชีที่มุมขวาบนก่อน)`)
    const ok = items.filter((i) => i.desc.trim() || i.amount)
    if (ok.length === 0) return setErr('ใส่อย่างน้อย 1 รายการ')
    if (ok.some((i) => !i.desc.trim() || !i.amount || i.amount <= 0)) return setErr('ทุกรายการต้องมีชื่อรายการและจำนวนเงินมากกว่า 0')
    const list: VoucherItem[] = ok.map((i) => ({ desc: i.desc.trim(), amount: i.amount!, lineId: i.lineId, method: i.method, ...(i.catId ? { catId: i.catId } : {}) }))
    const n = Math.max(0, ...v.all.map((x) => parseInt(x.no.split('-')[1] ?? '0', 10) || 0)) + 1
    const rec: Voucher = {
      id: `vc-${year}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`, no: `${be(year)}-${String(n).padStart(3, '0')}`, date,
      requester: { id: me.id, name: me.name }, payee: payee.trim(), purpose: '', amount: itemsTotal(list), lineId: list[0].lineId, items: list, status: 'submitted', approvals: [], attachments: [], updated: 0,
    }
    if (v.put([rec])) onClose()
  }
  return (
    <Sheet title="ใบเบิก-จ่ายเงิน" onClose={onClose}>
      <div className="field"><label htmlFor="v-date">วันที่ยื่น</label><input id="v-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="v-payee">ผู้รับเงิน/ร้านค้า (ถ้าทั้งใบจ่ายให้คนเดียว ไม่ใส่ก็ได้)</label><input id="v-payee" className="input" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
      {items.map((it, n) => (
        <fieldset key={n} className="card card--flat" style={{ margin: 0 }}>
          <legend className="small muted">รายการที่ {n + 1}</legend>
          <div className="field"><label htmlFor={`v-c${n}`}>หมวดรายจ่าย (เลือกจากรายการ)</label>
            <select id={`v-c${n}`} className="input" value={it.catId} onChange={(e) => { const c = cats.byId(e.target.value); set(n, { catId: e.target.value, ...(c && !it.desc.trim() ? { desc: c.name } : {}) }) }}>
              <option value="">— ยังไม่ระบุหมวด —</option>
              {cats.groups.filter((g) => g.active).map((g) => <optgroup key={g.id} label={`${g.code}. ${g.name}`}>{cats.itemsOf(g.id).filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}</optgroup>)}
            </select>
          </div>
          <div className="field"><label htmlFor={`v-d${n}`}>รายการ</label><input id={`v-d${n}`} className="input" value={it.desc} onChange={(e) => set(n, { desc: e.target.value })} placeholder="เช่น ค่าน้ำมันรถ / ค่าอินเตอร์เน็ต (บิล 27-9-69)" /></div>
          <div className="grid2">
            <div className="field"><label htmlFor={`v-a${n}`}>จำนวนเงิน (บาท)</label><MoneyInput id={`v-a${n}`} value={it.amount} onChange={(a) => set(n, { amount: a })} /></div>
            <div className="field"><label htmlFor={`v-m${n}`}>จ่ายโดย</label><select id={`v-m${n}`} className="input" value={it.method} onChange={(e) => set(n, { method: e.target.value as PayMethod })}>{(Object.keys(METHOD_LABEL) as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></div>
          </div>
          <div className="field"><label htmlFor={`v-l${n}`}>หมวดงบประมาณ</label>
            <select id={`v-l${n}`} className="input" value={it.lineId} onChange={(e) => set(n, { lineId: e.target.value })}>
              {rows.map((r) => <option key={r.line.id} value={r.line.id}>{r.line.name} ({r.line.base + r.adjust > 0 ? 'เหลืองบ' : 'เงินคงเหลือ'} {fmtBaht(r.remaining, { dec: false })})</option>)}
              {funds.items.length > 0 && <optgroup label="กองทุน">{funds.items.map((f) => <option key={f.id} value={f.id}>{f.name} (กองทุน)</option>)}</optgroup>}
              <option value={NO_BUDGET}>นอกงบประมาณ</option>
            </select>
          </div>
          {items.length > 1 && <button type="button" className="mini" onClick={() => setItems(items.filter((_, i) => i !== n))}>ลบรายการนี้</button>}
        </fieldset>
      ))}
      <button type="button" className="btn btn--ghost" onClick={() => setItems([...items, { ...blank(), lineId: items[items.length - 1].lineId }])}>＋ เพิ่มรายการ</button>
      <div className="row row--between"><b>รวมจ่ายเป็นเงินทั้งสิ้น</b><span className="money-big">{fmtBaht(total)}</span></div>
      {items.some((i) => i.lineId === NO_BUDGET) && <p className="note">มีรายการนอกงบประมาณ — ผู้อนุมัติจะเห็นข้อความนี้</p>}
      {overs.map((r) => <p key={r.line.id} className="note">⚠️ หมวด “{r.line.name}” เกินงบคงเหลือ (ยังยื่นได้ แต่ผู้อนุมัติต้องพิจารณา หรือให้แอดมินปรับงบก่อน)</p>)}
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>ยื่นใบเบิก</button>
      <p className="foot-note">แนบใบเสร็จ/สลิปได้ที่หน้ารายละเอียดหลังยื่น</p>
    </Sheet>
  )
}
