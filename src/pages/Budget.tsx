import { useState } from 'react'
import BudgetCandles from '../components/BudgetCandles'
import MoneyInput from '../components/MoneyInput'
import Sheet from '../components/Sheet'
import { can } from '../lib/access'
import { useBudgetAdjs, useBudgetEntries, useBudgetLines, useFunds, useIncome, useIncomeTypes, useVouchers } from '../lib/data'
import { budgetRows, CHURCH_SOURCE } from '../lib/ledger'
import { useRole } from '../lib/members'
import { be, fmtBaht, fmtDate, newId, todayISO, yearOf } from '../lib/money'
import type { AdjKind, BudgetAdj, BudgetEntry, BudgetLine } from '../lib/types'
import { useYear } from '../lib/year'
import FundsPage from './Funds'

/** รายการแนะนำ — ไม่เพิ่มให้เองเด็ดขาด ผู้ใช้ติ๊กเลือกเฉพาะที่ต้องการ */
const SUGGESTED: { name: string; link?: string[]; reserve?: boolean }[] = [
  { name: 'เงินเดือน/ค่าตอบแทน' }, { name: 'สาธารณูปโภค' }, { name: 'ซ่อมแซมและบำรุงอาคาร' }, { name: 'พันธกิจและมิชชั่น' },
  { name: 'กิจกรรมและการอบรม' }, { name: 'วัสดุอุปกรณ์สำนักงาน' }, { name: 'ช่วยเหลือสังคม' },
  { name: 'กองทุนเพื่อที่ดินคริสตจักร', link: ['tt4'] }, { name: 'กองทุนเพื่ออาหาร', link: ['tt5'] }, { name: 'งบฉุกเฉิน/สำรอง', reserve: true },
]
const KIND_LABEL: Record<AdjKind, string> = { adjust: 'ปรับงบ', emergency: 'งบฉุกเฉิน', transfer: 'โอนงบระหว่างหมวด' }
type Rows = ReturnType<typeof budgetRows>
type Sheets = 'adjust' | 'emergency' | 'transfer' | 'new' | 'suggest' | null

export default function Budget() {
  const { year } = useYear()
  const [mode, setMode] = useState<'budget' | 'fund'>(() => { try { return sessionStorage.getItem('acct.budgetMode') === 'fund' ? 'fund' : 'budget' } catch { return 'budget' } })
  const pick = (m: 'budget' | 'fund') => { setMode(m); try { sessionStorage.setItem('acct.budgetMode', m) } catch { /* ignore */ } }
  return (
    <>
      <div className="seg no-print" role="group" aria-label="งบประมาณหรือกองทุน">
        <button type="button" className={mode === 'budget' ? 'on' : ''} aria-pressed={mode === 'budget'} onClick={() => pick('budget')}>งบประมาณ (รายปี)</button>
        <button type="button" className={mode === 'fund' ? 'on' : ''} aria-pressed={mode === 'fund'} onClick={() => pick('fund')}>กองทุน (สะสม)</button>
      </div>
      {mode === 'budget' ? <Page key={year} year={year} /> : <FundsPage key={year} year={year} />}
    </>
  )
}

function Page({ year }: { year: number }) {
  const role = useRole()
  const lines = useBudgetLines(year)
  const adjs = useBudgetAdjs(year)
  const entries = useBudgetEntries(year)
  const vs = useVouchers(year)
  const income = useIncome(year)
  const types = useIncomeTypes()
  const funds = useFunds()
  const fundTypeIds = funds.items.flatMap((f) => f.incomeTypeIds ?? [])
  const [sheet, setSheet] = useState<Sheets>(null)
  const [pickId, setPickId] = useState<string | undefined>()
  const [editNum, setEditNum] = useState<{ lineId: string; focus: 'name' | 'in' | 'budget' | 'out' } | null>(null)
  const [entry, setEntry] = useState<{ lineId: string; kind: 'in' | 'out'; edit?: BudgetEntry } | null>(null)
  const isAdmin = can(role, 'budget')
  const canEntry = can(role, 'income')
  const rows = budgetRows(lines.items, adjs.items, vs.items, income.items, entries.items, fundTypeIds)
  const yearIncome = income.items.reduce((s, x) => s + x.amount, 0)
  const tot = rows.reduce((a, r) => ({ current: a.current + r.current, spent: a.spent + r.spent, committed: a.committed + r.committed, remaining: a.remaining + (r.current > 0 ? r.remaining : 0) }), { current: 0, spent: 0, committed: 0, remaining: 0 })
  const lineName = (id: string) => lines.all.find((l) => l.id === id)?.name ?? '?'
  const deletedLines = lines.all.filter((l) => l.deleted)
  const used = (id: string) => ({
    vouchers: vs.items.filter((v) => (v.items?.length ? v.items : [{ lineId: v.lineId }]).some((i) => i.lineId === id)).length,
    entries: entries.items.filter((e) => e.lineId === id).length,
    adjs: adjs.items.filter((a) => a.lineId === id).length,
  })
  const del = (id: string) => {
    const l = lines.items.find((x) => x.id === id)
    if (!l) return
    const u = used(id)
    const has = u.vouchers + u.entries + u.adjs
    const msg = `ลบงบ “${l.name}” ออกจากหน้างบประมาณ?${has ? `\n\nงบนี้มีข้อมูลเกี่ยวข้อง: ใบเบิก ${u.vouchers} ใบ · บันทึกตรง ${u.entries} รายการ · ประวัติปรับงบ ${u.adjs} รายการ\nข้อมูลเหล่านี้ไม่หาย แต่จะไม่ถูกนับในงบนี้ (ใบเบิกจะแสดงว่า “ลบแล้ว”)` : ''}\n\nกู้คืนได้ที่ “งบที่ลบแล้ว” ด้านล่างหน้า`
    if (confirm(msg)) lines.remove(id)
  }
  /** ลบถาวร: เอางบนี้และประวัติปรับงบ/บันทึกตรงของมันออกจากไฟล์จริง (ใบเบิกที่อ้างถึงจะแสดง “นอกงบประมาณ”) */
  const purgeLine = async (id: string, name: string) => {
    if (!confirm(`ลบถาวรงบ “${name}”?\nเอาออกจากไฟล์จริงพร้อมประวัติปรับงบและบันทึกตรงของงบนี้ กู้คืนไม่ได้`)) return
    await Promise.all([lines.purge((x) => x.id === id), adjs.purge((a) => a.lineId === id), entries.purge((e) => e.lineId === id)])
  }
  const move = (id: string, dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.line.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= rows.length) return
    lines.put([{ ...rows[i].line, order: rows[j].line.order }, { ...rows[j].line, order: rows[i].line.order }])
  }
  const history = [...adjs.items].sort((a, b) => b.updated - a.updated)

  return (
    <>
      <div className="page-head"><h1>งบประมาณ ปี {be(year)}</h1></div>
      {isAdmin && <button type="button" className="btn btn--gold btn--block no-print" style={{ fontSize: '1.1rem' }} onClick={() => setSheet('new')}>＋ ตั้งงบใหม่</button>}

      {rows.length === 0 ? (
        <section className="card">
          <p className="empty">ยังไม่มีงบประมาณปี {be(year)} — กด “＋ ตั้งงบใหม่” ด้านบนเพื่อเริ่มทีละอัน</p>
          {isAdmin ? (
            <div className="row">
              <button type="button" className="btn btn--ghost" onClick={() => setSheet('suggest')}>เลือกจากรายการแนะนำ…</button>
              <CopyPrev year={year} lines={lines} />
            </div>
          ) : <p className="muted small">แอดมินเป็นผู้ตั้งงบประมาณ</p>}
          {isAdmin && deletedLines.length > 0 && <details><summary>งบที่ลบแล้ว ({deletedLines.length}) — กู้คืนได้</summary><ul className="list">{deletedLines.map((l) => <li key={l.id}><span className="grow">{l.name}</span><button type="button" className="mini" onClick={() => lines.put([{ ...l, deleted: false }])}>↩︎ กู้คืน</button><button type="button" className="mini" aria-label={`ลบถาวร ${l.name}`} onClick={() => purgeLine(l.id, l.name)}>ลบถาวร</button></li>)}</ul></details>}
        </section>
      ) : (
        <>
          {isAdmin && (
            <div className="row no-print">
              <button type="button" className="mini" onClick={() => { setPickId(undefined); setSheet('adjust') }}>± ปรับงบ</button>
              <button type="button" className="mini" onClick={() => setSheet('emergency')}>🚨 เพิ่มงบฉุกเฉิน</button>
              <button type="button" className="mini" onClick={() => setSheet('transfer')}>⇄ โอนงบระหว่างหมวด</button>
              <button type="button" className="mini" onClick={() => setSheet('suggest')}>＋ เลือกจากรายการแนะนำ</button>
            </div>
          )}
          <section className="card" aria-label="ภาพรวมทั้งปี">
            <h2>ภาพรวมทั้งปี</h2>
            <BudgetCandles title="ภาพรวมทั้งปี" income={yearIncome} budget={tot.current} spent={tot.spent} committed={tot.committed} />
            <p className="foot-note">ภาพรวม = ผลรวมของทุกงบ (แท่งเขียว = รายรับทุกประเภทตลอดปี) แก้ตัวเลขที่การ์ดของแต่ละงบด้านล่าง · เหลือรวม (หักที่ยื่นเบิกค้าง) {fmtBaht(tot.remaining, { dec: false })} บาท</p>
          </section>

          {rows.map((r) => (
            <section key={r.line.id} className="card" aria-label={`งบ ${r.line.name}`}>
              <div className="row row--between">
                <h2>{isAdmin ? <button type="button" style={{ all: 'unset', cursor: 'pointer' }} aria-label={`แก้ชื่องบ ${r.line.name}`} onClick={() => setEditNum({ lineId: r.line.id, focus: 'name' })}>{r.line.name} <span className="small muted no-print">✎</span></button> : r.line.name}{r.line.reserve && <span className="badge"> สำรอง</span>}</h2>
                <span className={r.remaining < 0 ? 'bad' : 'good'}><b>{r.current > 0 ? 'เหลืองบ' : 'คงเหลือ'} {fmtBaht(r.remaining, { dec: false })}</b></span>
              </div>
              <BudgetCandles title={r.line.name} income={r.income} budget={r.current} spent={r.spent} committed={r.committed} onEdit={isAdmin ? (bar) => setEditNum({ lineId: r.line.id, focus: bar }) : undefined} />
              <div className="row no-print">
                {canEntry && <button type="button" className="mini" style={{ borderColor: 'var(--series-1)' }} onClick={() => setEntry({ lineId: r.line.id, kind: 'in' })}>＋ เงินเข้า</button>}
                {canEntry && <button type="button" className="mini" style={{ borderColor: 'var(--series-2)' }} onClick={() => setEntry({ lineId: r.line.id, kind: 'out' })}>＋ ใช้จ่าย</button>}
                                {isAdmin && <button type="button" className="mini" onClick={() => setEditNum({ lineId: r.line.id, focus: 'name' })}>✎ แก้ไขงบ (ชื่อ / แหล่งที่มา)</button>}
                {isAdmin && <button type="button" className="mini" aria-label={`เลื่อน ${r.line.name} ขึ้น`} onClick={() => move(r.line.id, -1)}>▲</button>}
                {isAdmin && <button type="button" className="mini" aria-label={`เลื่อน ${r.line.name} ลง`} onClick={() => move(r.line.id, 1)}>▼</button>}
                {isAdmin && <button type="button" className="mini" aria-label={`ลบงบ ${r.line.name}`} onClick={() => del(r.line.id)}>🗑️ ลบงบนี้</button>}
              </div>
              <p className="small muted">
                เงินคงเหลือจริง (ได้รับ − จ่าย) <b className={r.balance < 0 ? 'bad' : ''}>{fmtBaht(r.balance, { dec: false })}</b> · งบเดิม {fmtBaht(r.base, { dec: false })}{r.adjust !== 0 && ` · ปรับ ${fmtBaht(r.adjust, { dec: false, sign: true })}`} ·{' '}
                {isAdmin ? (
                  <button type="button" className="mini no-print" style={{ textAlign: 'left' }} onClick={() => setEditNum({ lineId: r.line.id, focus: 'name' })}>
                    แหล่งที่มาของเงิน: <b>{r.line.incomeTypeIds?.length ? r.line.incomeTypeIds.map((id) => (id === CHURCH_SOURCE ? 'คริสตจักร' : types.byId(id)?.name ?? '?')).join(', ') : 'ยังไม่ได้เลือก'}</b> ✎
                  </button>
                ) : (r.line.incomeTypeIds?.length ? `แหล่งที่มาของเงิน: ${r.line.incomeTypeIds.map((id) => (id === CHURCH_SOURCE ? 'คริสตจักร' : types.byId(id)?.name ?? '?')).join(', ')}` : 'ยังไม่ได้เลือกแหล่งที่มาของเงิน')}
              </p>
              <EntryList rows={r} entries={entries.items.filter((e) => e.lineId === r.line.id)} canEdit={canEntry} onEdit={(e) => setEntry({ lineId: e.lineId, kind: e.kind, edit: e })} />
            </section>
          ))}

          {isAdmin && deletedLines.length > 0 && (
            <details className="card no-print">
              <summary><b>งบที่ลบแล้ว ({deletedLines.length})</b> — กู้คืนได้</summary>
              <ul className="list">{deletedLines.map((l) => <li key={l.id}><span className="grow">{l.name}</span><button type="button" className="mini" onClick={() => lines.put([{ ...l, deleted: false }])}>↩︎ กู้คืน</button><button type="button" className="mini" aria-label={`ลบถาวร ${l.name}`} onClick={() => purgeLine(l.id, l.name)}>ลบถาวร</button></li>)}</ul>
            </details>
          )}
          <section className="card" aria-labelledby="h-hist">
            <h2 id="h-hist">ประวัติการปรับงบ ({history.length})</h2>
            {history.length === 0 ? <p className="muted small">ยังไม่เคยปรับงบ</p> : (
              <ul className="list">{history.map((a) => (
                <li key={a.id}><span className="grow"><b>{lineName(a.lineId)}</b> <span className="badge">{KIND_LABEL[a.kind]}</span><br /><span className="small muted">{fmtDate(a.date)} · {a.reason}{a.by ? ` · โดย ${a.by}` : ''}</span></span><b className={`num ${a.delta >= 0 ? 'good' : 'bad'}`}>{fmtBaht(a.delta, { sign: true, dec: false })}</b></li>
              ))}</ul>
            )}
          </section>
        </>
      )}
      {sheet === 'suggest' && <SuggestSheet year={year} existing={lines.items.map((l) => l.name)} order={rows.length} lines={lines} onClose={() => setSheet(null)} />}
      {sheet === 'new' && <NewBudget year={year} order={rows.length} lines={lines} income={income.items} fundTypeIds={fundTypeIds} onClose={() => setSheet(null)} />}
      {entry && <EntrySheet year={year} lineName={lineName(entry.lineId)} entry={entry} entries={entries} onClose={() => setEntry(null)} />}
      {editNum && <EditBudget row={rows.find((r) => r.line.id === editNum.lineId)!} focus={editNum.focus} income={income.items} fundTypeIds={fundTypeIds} lines={lines} adjs={adjs} onClose={() => setEditNum(null)} />}
      {(sheet === 'adjust' || sheet === 'emergency' || sheet === 'transfer') && <BudgetSheet kind={sheet} year={year} pickId={pickId} onClose={() => setSheet(null)} lines={lines} adjs={adjs} rows={rows} />}
    </>
  )
}

/** รายการที่บันทึกตรงในงบนี้ (เงินเข้า/ใช้จ่าย) แตะเพื่อแก้ไขหรือลบ */
export function EntryList({ rows, entries, canEdit, onEdit }: { rows: Rows[number]; entries: BudgetEntry[]; canEdit: boolean; onEdit: (e: BudgetEntry) => void }) {
  const list = entries.filter((e) => !e.deleted).sort((a, b) => (a.date < b.date ? 1 : -1))
  if (list.length === 0) return null
  return (
    <details className="no-print">
      <summary>รายการที่บันทึกตรงในงบ {rows.line.name} ({list.length})</summary>
      <ul className="list">
        {list.map((e) => (
          <li key={e.id}>
            <button type="button" style={{ all: 'unset', display: 'flex', gap: '0.6rem', alignItems: 'center', width: '100%', cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && onEdit(e)}>
              <span className="grow small"><b>{e.kind === 'in' ? 'เงินเข้า' : 'ใช้จ่าย'}</b> · {fmtDate(e.date)}{e.note ? ` · ${e.note}` : ''}</span>
              <b className={`num ${e.kind === 'in' ? 'good' : 'bad'}`}>{e.kind === 'in' ? '+' : '−'}{fmtBaht(e.amount)}</b>
            </button>
          </li>
        ))}
      </ul>
      <p className="foot-note">บันทึกตรงนับเป็นรายจ่ายในรายงานด้วย (เงินเข้าแบบบันทึกตรงแสดงเฉพาะในหน้างบ ไม่นับเป็นรายรับในรายงาน)</p>
    </details>
  )
}

/** บันทึก/แก้ไข/ลบ เงินเข้าหรือใช้จ่ายของงบ */
export function EntrySheet({ year, lineName, entry, entries, onClose }: { year: number; lineName: string; entry: { lineId: string; kind: 'in' | 'out'; edit?: BudgetEntry }; entries: ReturnType<typeof useBudgetEntries>; onClose: () => void }) {
  const [kind, setKind] = useState(entry.kind)
  const [amount, setAmount] = useState<number | null>(entry.edit?.amount ?? null)
  const [date, setDate] = useState(entry.edit?.date ?? (yearOf(todayISO()) === year ? todayISO() : `${year}-01-01`))
  const [note, setNote] = useState(entry.edit?.note ?? '')
  const [err, setErr] = useState('')
  const save = () => {
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${be(year)}`)
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    if (entries.put([{ id: entry.edit?.id ?? newId('be'), year, lineId: entry.lineId, kind, amount, date, note: note.trim(), updated: 0 }])) onClose()
  }
  return (
    <Sheet title={`${entry.edit ? 'แก้ไข' : 'บันทึก'} — ${lineName}`} onClose={onClose}>
      <div className="seg" role="group" aria-label="ชนิดรายการ">
        <button type="button" className={kind === 'in' ? 'on' : ''} onClick={() => setKind('in')}>＋ เงินเข้า (เขียว)</button>
        <button type="button" className={kind === 'out' ? 'on' : ''} onClick={() => setKind('out')}>＋ ใช้จ่าย (แดง)</button>
      </div>
      <div className="field"><label htmlFor="en-amt">จำนวนเงิน (บาท)</label><MoneyInput id="en-amt" value={amount} onChange={setAmount} autoFocus /></div>
      <div className="field"><label htmlFor="en-date">วันที่</label><input id="en-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="en-note">รายละเอียด</label><input id="en-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'out' ? 'เช่น ซื้อของขวัญผู้รับใช้' : 'เช่น เงินสนับสนุนจากกองทุน'} /></div>
      {kind === 'out' && <p className="note">ใช้จ่ายที่บันทึกตรงไม่ผ่านขั้นตอนอนุมัติของใบเบิก — ถ้าเป็นรายจ่ายที่ต้องมีผู้อนุมัติและใบเสร็จ ให้ทำที่เมนู “เบิกจ่าย” แทน</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row">
        <button type="button" className="btn btn--gold grow" onClick={save}>บันทึก</button>
        {entry.edit && <button type="button" className="btn btn--ghost" onClick={() => { if (confirm('ลบรายการนี้?') && entries.remove(entry.edit!.id)) onClose() }}>ลบ</button>}
      </div>
    </Sheet>
  )
}

function CopyPrev({ year, lines }: { year: number; lines: ReturnType<typeof useBudgetLines> }) {
  const prev = useBudgetLines(year - 1)
  const prevAdj = useBudgetAdjs(year - 1)
  if (prev.items.length === 0) return null
  const copy = () => {
    const cur = new Map(prevAdj.items.reduce((m, a) => m.set(a.lineId, (m.get(a.lineId) ?? 0) + a.delta), new Map<string, number>()))
    lines.put(prev.items.map((l, i) => ({ id: `bl-${year}-${i}`, year, name: l.name, base: l.base + (cur.get(l.id) ?? 0), order: l.order, ...(l.reserve ? { reserve: true } : {}), ...(l.incomeTypeIds?.length ? { incomeTypeIds: l.incomeTypeIds } : {}), updated: 0 })))
  }
  return <button type="button" className="btn btn--ghost" onClick={copy}>คัดลอกหมวดและยอดจากปี {be(year - 1)}</button>
}

function BudgetSheet({ kind, year, pickId, onClose, lines, adjs, rows }: { kind: 'adjust' | 'emergency' | 'transfer'; year: number; pickId?: string; onClose: () => void; lines: ReturnType<typeof useBudgetLines>; adjs: ReturnType<typeof useBudgetAdjs>; rows: Rows }) {
  const [lineId, setLineId] = useState(pickId ?? rows.find((r) => r.line.reserve)?.line.id ?? rows[0]?.line.id ?? '')
  const [toId, setToId] = useState(rows.find((r) => r.line.id !== lineId)?.line.id ?? '')
  const [sign, setSign] = useState<1 | -1>(1)
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(yearOf(todayISO()) === year ? todayISO() : `${year}-12-31`)
  const [newName, setNewName] = useState('')
  const [target, setTarget] = useState<'existing' | 'new'>('existing')
  const [err, setErr] = useState('')
  const row = (id: string) => rows.find((r) => r.line.id === id)

  const go = () => {
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${be(year)}`)
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    if (!reason.trim()) return setErr('ต้องใส่เหตุผลทุกครั้ง เพราะจะแสดงในประวัติ')
    const mk = (id: string, delta: number, k: AdjKind, group?: string): BudgetAdj => ({ id: newId('ba'), year, lineId: id, delta, kind: k, reason: reason.trim(), date, ...(group ? { group } : {}), updated: 0 })
    if (kind === 'transfer') {
      if (!toId || toId === lineId) return setErr('เลือกหมวดต้นทางและปลายทางให้ต่างกัน')
      const from = row(lineId)!
      if (amount > from.current - from.spent - from.committed) return setErr(`หมวด “${from.line.name}” มีงบเหลือไม่พอ (เหลือ ${fmtBaht(from.remaining)})`)
      const g = newId('g')
      if (adjs.put([mk(lineId, -amount, 'transfer', g), mk(toId, amount, 'transfer', g)])) onClose()
      return
    }
    if (kind === 'emergency') {
      let target_id = lineId
      if (target === 'new') {
        if (!newName.trim()) return setErr('ใส่ชื่อหมวดฉุกเฉินใหม่')
        target_id = newId('bl')
        lines.put([{ id: target_id, year, name: newName.trim(), base: 0, order: rows.length, updated: 0 } as BudgetLine])
      }
      if (adjs.put([mk(target_id, amount, 'emergency')])) onClose()
      return
    }
    const r = row(lineId)!
    const delta = sign * amount
    if (r.current + delta < r.spent + r.committed) return setErr(`ลดแล้วงบต่ำกว่ายอดที่จ่าย/ยื่นเบิกไปแล้ว (${fmtBaht(r.spent + r.committed)})`)
    if (adjs.put([mk(lineId, delta, 'adjust')])) onClose()
  }
  const title = { adjust: 'ปรับงบ (เพิ่ม/ลด)', emergency: 'เพิ่มงบฉุกเฉินระหว่างปี', transfer: 'โอนงบระหว่างหมวด' }[kind]
  const sel = (id: string, label: string, v: string, set: (s: string) => void) => (
    <div className="field"><label htmlFor={id}>{label}</label><select id={id} className="input" value={v} onChange={(e) => set(e.target.value)}>{rows.map((r) => <option key={r.line.id} value={r.line.id}>{r.line.name} (งบ {fmtBaht(r.current, { dec: false })})</option>)}</select></div>
  )
  return (
    <Sheet title={title} onClose={onClose}>
      {kind === 'adjust' && <>{sel('b-line', 'หมวด', lineId, setLineId)}<div className="seg" role="group" aria-label="เพิ่มหรือลด"><button type="button" className={sign === 1 ? 'on' : ''} onClick={() => setSign(1)}>เพิ่มงบ</button><button type="button" className={sign === -1 ? 'on' : ''} onClick={() => setSign(-1)}>ลดงบ</button></div></>}
      {kind === 'emergency' && (
        <>
          <div className="seg" role="group" aria-label="ปลายทาง"><button type="button" className={target === 'existing' ? 'on' : ''} onClick={() => setTarget('existing')}>เข้าหมวดที่มี</button><button type="button" className={target === 'new' ? 'on' : ''} onClick={() => setTarget('new')}>เปิดหมวดใหม่</button></div>
          {target === 'existing' ? sel('b-line', 'เข้าหมวด', lineId, setLineId) : <div className="field"><label htmlFor="b-name">ชื่อหมวดฉุกเฉินใหม่</label><input id="b-name" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น ซ่อมหลังคาฉุกเฉิน" /></div>}
        </>
      )}
      {kind === 'transfer' && <>{sel('b-from', 'จากหมวด', lineId, setLineId)}{sel('b-to', 'ไปหมวด', toId, setToId)}</>}
      <div className="field"><label htmlFor="b-amt">จำนวนเงิน (บาท)</label><MoneyInput id="b-amt" value={amount} onChange={setAmount} /></div>
      <div className="field"><label htmlFor="b-why">เหตุผล / ที่มาของเงิน (บันทึกในประวัติ)</label><textarea id="b-why" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'emergency' ? 'เช่น ที่ประชุมผู้ปกครอง 5 ต.ค. มีมติอนุมัติจากเงินสะสม' : ''} /></div>
      <div className="field"><label htmlFor="b-date">วันที่มีผล</label><input id="b-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={go}>บันทึก</button>
    </Sheet>
  )
}

/**
 * ติ๊กแหล่งที่มาของเงิน = ประเภทที่สมาชิกถวายเข้ามา (สิบลด/กองทุนที่ดิน/อาหาร ฯลฯ) แท่งเขียวจะนับยอดถวายประเภทนั้นให้เอง
 * แอดมินเพิ่ม/แก้ชื่อ/ลบรายชื่อได้ตรงนี้เลย (ประเภทชุดเดียวกับที่ใช้บันทึกรายรับและใบถวาย)
 */
export function Sources({ totals, value, onChange, church }: { totals: Map<string, number>; value: string[]; onChange: (v: string[]) => void; church?: { total: number } }) {
  const types = useIncomeTypes()
  const role = useRole()
  const canManage = can(role, 'settings')
  const [name, setName] = useState('')
  const add = () => {
    const n = name.trim()
    if (!n) return
    if (types.list.some((t) => t.name === n)) return alert('มีรายชื่อนี้อยู่แล้ว')
    const id = newId('t')
    if (types.put([{ id, name: n, order: types.list.length, active: true, updated: 0 }])) { setName(''); onChange([...value, id]) }
  }
  const rename = (id: string, cur: string) => {
    const n = prompt('แก้ชื่อแหล่งที่มา', cur)?.trim()
    const t = types.byId(id)
    if (n && t && n !== cur) types.put([{ ...t, name: n }])
  }
  const remove = (id: string, cur: string) => {
    const t = types.byId(id)
    if (!t || !confirm(`ลบ “${cur}” ออกจากรายชื่อแหล่งที่มา?\n\nรายรับที่เคยบันทึกด้วยชื่อนี้ไม่หาย (ยังแสดงชื่อเดิม) แต่จะไม่มีให้เลือกใหม่ — มีผลกับทุกงบและหน้าบันทึกรายรับ`)) return
    if (types.put([{ ...t, deleted: true }])) onChange(value.filter((x) => x !== id))
  }
  return (
    <fieldset className="card card--flat" style={{ margin: 0 }}>
      <legend><b>แหล่งที่มาของเงินในงบนี้</b> <span className="small muted">(ที่สมาชิกถวายเข้ามา — ไม่บังคับ)</span></legend>
      {church && (
        <label className="row"><input type="checkbox" checked={value.includes(CHURCH_SOURCE)} onChange={(e) => onChange(e.target.checked ? [...value, CHURCH_SOURCE] : value.filter((x) => x !== CHURCH_SOURCE))} /> <span className="grow"><b>คริสตจักร</b> <span className="small muted">(รายรับทั่วไปที่ไม่ใช่เงินกองทุน)</span></span><span className="small muted">รับแล้ว {fmtBaht(church.total, { dec: false })}</span></label>
      )}
      {types.list.map((t) => (
        <div key={t.id} className="row">
          <label className="row grow"><input type="checkbox" checked={value.includes(t.id)} onChange={(e) => onChange(e.target.checked ? [...value, t.id] : value.filter((x) => x !== t.id))} /> <span className="grow">{t.name}</span><span className="small muted">รับแล้ว {fmtBaht(totals.get(t.id) ?? 0, { dec: false })}</span></label>
          {canManage && <button type="button" className="mini" aria-label={`แก้ชื่อ ${t.name}`} onClick={() => rename(t.id, t.name)}>✎</button>}
          {canManage && <button type="button" className="mini" aria-label={`ลบ ${t.name}`} onClick={() => remove(t.id, t.name)}>🗑️</button>}
        </div>
      ))}
      {canManage && (
        <div className="row">
          <input className="input grow" aria-label="ชื่อแหล่งที่มาใหม่" placeholder="เพิ่มแหล่งที่มาใหม่ เช่น ถวายสวัสดิการผู้รับใช้" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <button type="button" className="btn btn--gold" onClick={add}>＋ เพิ่ม</button>
        </div>
      )}
      <p className="foot-note">ติ๊กแล้วแท่งเขียว (ได้รับ) จะนับยอดถวายประเภทที่ติ๊กให้เองตลอดปี · เพิ่ม/แก้/ลบรายชื่อได้เฉพาะแอดมิน</p>
    </fieldset>
  )
}
export const sumByType = (income: { typeId: string; amount: number }[]) => income.reduce((m, x) => m.set(x.typeId, (m.get(x.typeId) ?? 0) + x.amount), new Map<string, number>())
export const linkedSum = (income: { typeId: string; amount: number }[], ids: string[], fundTypeIds: string[] = []) => income.filter((x) => ids.includes(x.typeId) || (ids.includes(CHURCH_SOURCE) && !fundTypeIds.includes(x.typeId))).reduce((s, x) => s + x.amount, 0)
export const churchSum = (income: { typeId: string; amount: number }[], fundTypeIds: string[]) => income.filter((x) => !fundTypeIds.includes(x.typeId)).reduce((s, x) => s + x.amount, 0)

/** ตั้งงบใหม่: ชื่อ · แหล่งที่มา · 3 ช่องตัวเลข · แท่งขึ้นตามที่พิมพ์ทันที */
function NewBudget({ year, order, lines, income, fundTypeIds, onClose }: { year: number; order: number; lines: ReturnType<typeof useBudgetLines>; income: { typeId: string; amount: number }[]; fundTypeIds: string[]; onClose: () => void }) {
  const [name, setName] = useState('')
  const [link, setLink] = useState<string[]>([])
  const [got, setGot] = useState<number | null>(null)
  const [budget, setBudget] = useState<number | null>(null)
  const [spent, setSpent] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const save = () => {
    if (!name.trim()) return setErr('ตั้งชื่องบก่อน เช่น ค่าสวัสดิการผู้รับใช้')
    if (!budget && !got && !spent && link.length === 0) return setErr('ใส่ตัวเลขอย่างน้อย 1 ช่อง หรือเลือกแหล่งที่มาของเงิน')
    if (lines.put([{ id: newId('bl'), year, name: name.trim(), base: budget ?? 0, order, ...(got ? { openingIn: got } : {}), ...(spent ? { openingOut: spent } : {}), ...(link.length ? { incomeTypeIds: link } : {}), updated: 0 } as BudgetLine])) onClose()
  }
  return (
    <Sheet title="ตั้งงบใหม่" onClose={onClose}>
      <div className="field"><label htmlFor="nb-name">ชื่องบ</label><input id="nb-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ค่าสวัสดิการผู้รับใช้" autoFocus /></div>
      <Sources totals={sumByType(income)} value={link} onChange={setLink} church={{ total: churchSum(income, fundTypeIds) }} />
      <fieldset data-zone="numbers" className="card card--flat" style={{ margin: 0 }}>
        <legend className="small muted">ตัวเลขของ 3 แท่ง — เขียว → เทา → แดง</legend>
      <div className="field"><label htmlFor="nb-got" style={{ color: 'var(--series-1)' }}>① ได้รับ (แท่งเขียว) — เงินที่มีอยู่แล้ว/ยกมา (นอกเหนือจากแหล่งที่ติ๊ก)</label><MoneyInput id="nb-got" value={got} onChange={setGot} /></div>
      <div className="field"><label htmlFor="nb-bud">② งบที่ตั้ง (แท่งเทา) — ยังไม่ตั้งก็ปล่อยว่างได้ แท่งจะติดพื้น</label><MoneyInput id="nb-bud" value={budget} onChange={setBudget} /></div>
      <div className="field"><label htmlFor="nb-sp" style={{ color: 'var(--series-2)' }}>③ จ่ายแล้ว (แท่งแดง) — ถ้ามีใช้ไปแล้ว</label><MoneyInput id="nb-sp" value={spent} onChange={setSpent} /></div>
      </fieldset>
      <BudgetCandles title={name.trim() || 'งบใหม่'} income={(got ?? 0) + linkedSum(income, link, fundTypeIds)} budget={budget ?? 0} spent={spent ?? 0} compact />
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>บันทึกงบ</button>
      <p className="foot-note">แก้ชื่อ แหล่งที่มา หรือตัวเลขภายหลังได้ที่ปุ่ม “✎ แก้ไขงบ” ของงบนี้ · ใบเบิกที่เลือกงบนี้จะเพิ่มในแท่งแดงเองอัตโนมัติ</p>
    </Sheet>
  )
}

/** แก้ไขงบ: ชื่อ · แหล่งที่มา · ตัวเลขทั้งสามแท่ง (ช่วงเริ่มต้น) — งบที่ตั้งที่แก้จะบันทึกลงประวัติให้เอง */
function EditBudget({ row, focus, income, fundTypeIds, lines, adjs, onClose }: { row: Rows[number]; focus: 'name' | 'in' | 'budget' | 'out'; income: { typeId: string; amount: number }[]; fundTypeIds: string[]; lines: ReturnType<typeof useBudgetLines>; adjs: ReturnType<typeof useBudgetAdjs>; onClose: () => void }) {
  const [name, setName] = useState(row.line.name)
  const [link, setLink] = useState<string[]>(row.line.incomeTypeIds ?? [])
  const [openIn, setOpenIn] = useState<number | null>(row.inParts.opening)
  const [budget, setBudget] = useState<number | null>(row.current)
  const [openOut, setOpenOut] = useState<number | null>(row.outParts.opening)
  const [err, setErr] = useState('')
  const save = () => {
    const oi = openIn ?? 0, oo = openOut ?? 0, b = budget ?? 0
    if (!name.trim()) return setErr('ชื่องบต้องไม่ว่าง')
    if (oi < 0 || oo < 0 || b < 0) return setErr('ตัวเลขต้องไม่ติดลบ')
    if (!lines.put([{ ...row.line, name: name.trim(), incomeTypeIds: link, openingIn: oi, openingOut: oo }])) return
    if (b !== row.current) {
      const y = row.line.year
      adjs.put([{ id: newId('ba'), year: y, lineId: row.line.id, delta: b - row.current, kind: 'adjust', reason: 'แก้ตัวเลขงบที่ตั้งโดยตรง (ช่วงตั้งต้น)', date: yearOf(todayISO()) === y ? todayISO() : `${y}-01-01`, updated: 0 } as BudgetAdj])
    }
    onClose()
  }
  const liveIn = (openIn ?? 0) + linkedSum(income, link, fundTypeIds) + row.inParts.entries
  return (
    <Sheet title={`แก้ไขงบ — ${row.line.name}`} onClose={onClose}>
      <div className="field"><label htmlFor="ed-name">ชื่องบ</label><input id="ed-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={focus === 'name'} /></div>
      <Sources totals={sumByType(income)} value={link} onChange={setLink} church={{ total: churchSum(income, fundTypeIds) }} />
      <fieldset data-zone="numbers" className="card card--flat" style={{ margin: 0 }}>
        <legend className="small muted">ตัวเลขของ 3 แท่ง — เขียว → เทา → แดง</legend>
      <div className="field">
        <label htmlFor="ed-in" style={{ color: 'var(--series-1)' }}>① ได้รับ (แท่งเขียว) — เงินยกมา/ที่มีอยู่แล้ว</label>
        <MoneyInput id="ed-in" value={openIn} onChange={setOpenIn} autoFocus={focus === 'in'} />
        <span className="foot-note">แท่งเขียวตอนนี้ {fmtBaht(liveIn)} = ยกมา {fmtBaht(openIn ?? 0)} + จากแหล่งที่ติ๊ก {fmtBaht(linkedSum(income, link, fundTypeIds))} + บันทึกตรง {fmtBaht(row.inParts.entries)} (รายการบันทึกตรงแก้ได้ในรายการใต้การ์ด)</span>
      </div>
      <div className="field">
        <label htmlFor="ed-bud">② งบที่ตั้ง (แท่งเทา)</label>
        <MoneyInput id="ed-bud" value={budget} onChange={setBudget} autoFocus={focus === 'budget'} />
        <span className="foot-note">ใส่ 0 ถ้ายังไม่ตั้งงบ (แท่งจะติดพื้น) · ที่แก้จะบันทึกในประวัติการปรับงบ</span>
      </div>
      <div className="field">
        <label htmlFor="ed-out" style={{ color: 'var(--series-2)' }}>③ จ่ายแล้วก่อนเริ่มใช้ระบบ (แท่งแดง)</label>
        <MoneyInput id="ed-out" value={openOut} onChange={setOpenOut} autoFocus={focus === 'out'} />
        <span className="foot-note">แท่งแดงตอนนี้ {fmtBaht((openOut ?? 0) + row.outParts.vouchers + row.outParts.entries)} = ตั้งต้น {fmtBaht(openOut ?? 0)} + จากใบเบิก {fmtBaht(row.outParts.vouchers)} + บันทึกตรง {fmtBaht(row.outParts.entries)} (ใบเบิกแก้ที่เมนู “เบิกจ่าย”)</span>
      </div>
      </fieldset>
      <BudgetCandles title={name.trim() || row.line.name} income={liveIn} budget={budget ?? 0} spent={(openOut ?? 0) + row.outParts.vouchers + row.outParts.entries} compact />
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>
    </Sheet>
  )
}

/** ติ๊กเลือกหมวดจากรายการแนะนำ — เพิ่มเฉพาะที่เลือก (ตัวเลขเป็น 0 แก้ภายหลังได้) */
function SuggestSheet({ year, existing, order, lines, onClose }: { year: number; existing: string[]; order: number; lines: ReturnType<typeof useBudgetLines>; onClose: () => void }) {
  const left = SUGGESTED.filter((x) => !existing.includes(x.name))
  const [pick, setPick] = useState<string[]>([])
  const add = () => {
    const chosen = left.filter((x) => pick.includes(x.name))
    if (chosen.length === 0) return onClose()
    if (lines.put(chosen.map((x, i) => ({ id: newId('bl'), year, name: x.name, base: 0, order: order + i, ...(x.reserve ? { reserve: true } : {}), ...(x.link ? { incomeTypeIds: x.link } : {}), updated: 0 } as BudgetLine)))) onClose()
  }
  return (
    <Sheet title="เลือกจากรายการแนะนำ" onClose={onClose}>
      {left.length === 0 ? <p className="muted">เพิ่มครบทุกรายการแนะนำแล้ว</p> : (
        <>
          <p className="muted small">ติ๊กเฉพาะหมวดที่อยากได้ — เพิ่มเข้าไปเป็นการ์ดเปล่า (ตัวเลข 0) แล้วค่อยแตะแท่งเพื่อใส่ตัวเลขทีหลัง ลบหรือเพิ่มเมื่อไรก็ได้</p>
          {left.map((x) => <label key={x.name} className="row"><input type="checkbox" checked={pick.includes(x.name)} onChange={(e) => setPick(e.target.checked ? [...pick, x.name] : pick.filter((n) => n !== x.name))} /> {x.name}</label>)}
        </>
      )}
      <button type="button" className="btn btn--gold" onClick={add}>{pick.length ? `เพิ่ม ${pick.length} หมวดที่เลือก` : 'ปิด'}</button>
    </Sheet>
  )
}
