import { useState } from 'react'
import BudgetCandles from '../components/BudgetCandles'
import MoneyInput from '../components/MoneyInput'
import Sheet from '../components/Sheet'
import { can } from '../lib/access'
import { useBudgetAdjs, useBudgetEntries, useBudgetLines, useIncome, useIncomeTypes, useVouchers } from '../lib/data'
import { budgetRows } from '../lib/ledger'
import { useRole } from '../lib/members'
import { be, fmtBaht, fmtDate, newId, todayISO, yearOf } from '../lib/money'
import type { AdjKind, BudgetAdj, BudgetEntry, BudgetLine } from '../lib/types'
import { useYear } from '../lib/year'

const TEMPLATE = ['เงินเดือน/ค่าตอบแทน', 'สาธารณูปโภค', 'ซ่อมแซมและบำรุงอาคาร', 'พันธกิจและมิชชั่น', 'กิจกรรมและการอบรม', 'วัสดุอุปกรณ์สำนักงาน', 'ช่วยเหลือสังคม']
const KIND_LABEL: Record<AdjKind, string> = { adjust: 'ปรับงบ', emergency: 'งบฉุกเฉิน', transfer: 'โอนงบระหว่างหมวด' }
type Rows = ReturnType<typeof budgetRows>
type Sheets = 'adjust' | 'emergency' | 'transfer' | 'new' | null

export default function Budget() {
  const { year } = useYear()
  return <Page key={year} year={year} />
}

function Page({ year }: { year: number }) {
  const role = useRole()
  const lines = useBudgetLines(year)
  const adjs = useBudgetAdjs(year)
  const entries = useBudgetEntries(year)
  const vs = useVouchers(year)
  const income = useIncome(year)
  const types = useIncomeTypes()
  const [sheet, setSheet] = useState<Sheets>(null)
  const [pickId, setPickId] = useState<string | undefined>()
  const [linkId, setLinkId] = useState<string | null>(null)
  const [editNum, setEditNum] = useState<{ lineId: string; focus: 'in' | 'budget' | 'out' } | null>(null)
  const [entry, setEntry] = useState<{ lineId: string; kind: 'in' | 'out'; edit?: BudgetEntry } | null>(null)
  const isAdmin = can(role, 'budget')
  const canEntry = can(role, 'income')
  const rows = budgetRows(lines.items, adjs.items, vs.items, income.items, entries.items)
  const yearIncome = income.items.reduce((s, x) => s + x.amount, 0)
  const tot = rows.reduce((a, r) => ({ current: a.current + r.current, spent: a.spent + r.spent, committed: a.committed + r.committed, remaining: a.remaining + (r.current > 0 ? r.remaining : 0) }), { current: 0, spent: 0, committed: 0, remaining: 0 })
  const lineName = (id: string) => lines.all.find((l) => l.id === id)?.name ?? '?'
  const history = [...adjs.items].sort((a, b) => b.updated - a.updated)

  const seed = () => lines.put([
    ...TEMPLATE.map((name) => ({ name, link: [] as string[] })),
    { name: 'กองทุนเพื่อที่ดินคริสตจักร', link: ['tt4'] },
    { name: 'กองทุนเพื่ออาหาร', link: ['tt5'] },
    { name: 'งบฉุกเฉิน/สำรอง', link: [] as string[] },
  ].map((x, i, all) => ({ id: `bl-${year}-${i}`, year, name: x.name, base: 0, order: i, reserve: i === all.length - 1, ...(x.link.length ? { incomeTypeIds: x.link } : {}), updated: 0 })))

  return (
    <>
      <div className="page-head"><h1>งบประมาณ ปี {be(year)}</h1></div>
      {isAdmin && <button type="button" className="btn btn--gold btn--block no-print" style={{ fontSize: '1.1rem' }} onClick={() => setSheet('new')}>＋ ตั้งงบใหม่</button>}

      {rows.length === 0 ? (
        <section className="card">
          <p className="empty">ยังไม่มีงบประมาณปี {be(year)}</p>
          {isAdmin ? (
            <><button type="button" className="btn btn--ghost" onClick={seed}>หรือสร้างหมวดงบมาตรฐานทั้งชุด (แก้ได้)</button><CopyPrev year={year} lines={lines} /></>
          ) : <p className="muted small">แอดมินเป็นผู้ตั้งงบประมาณ</p>}
        </section>
      ) : (
        <>
          {isAdmin && (
            <div className="row no-print">
              <button type="button" className="mini" onClick={() => { setPickId(undefined); setSheet('adjust') }}>± ปรับงบ</button>
              <button type="button" className="mini" onClick={() => setSheet('emergency')}>🚨 เพิ่มงบฉุกเฉิน</button>
              <button type="button" className="mini" onClick={() => setSheet('transfer')}>⇄ โอนงบระหว่างหมวด</button>
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
                <h2>{r.line.name}{r.line.reserve && <span className="badge"> สำรอง</span>}</h2>
                <span className={r.remaining < 0 ? 'bad' : 'good'}><b>{r.current > 0 ? 'เหลืองบ' : 'คงเหลือ'} {fmtBaht(r.remaining, { dec: false })}</b></span>
              </div>
              <BudgetCandles title={r.line.name} income={r.income} budget={r.current} spent={r.spent} committed={r.committed} onEdit={isAdmin ? (bar) => setEditNum({ lineId: r.line.id, focus: bar }) : undefined} />
              <div className="row no-print">
                {canEntry && <button type="button" className="mini" style={{ borderColor: 'var(--series-1)' }} onClick={() => setEntry({ lineId: r.line.id, kind: 'in' })}>＋ เงินเข้า</button>}
                {canEntry && <button type="button" className="mini" style={{ borderColor: 'var(--series-2)' }} onClick={() => setEntry({ lineId: r.line.id, kind: 'out' })}>＋ ใช้จ่าย</button>}
                {isAdmin && <button type="button" className="mini" onClick={() => { setPickId(r.line.id); setSheet('adjust') }}>{r.current > 0 ? 'แก้งบที่ตั้ง' : 'ตั้งงบ (แท่งกลาง)'}</button>}
                {isAdmin && <button type="button" className="mini" onClick={() => setLinkId(r.line.id)}>ผูกรายรับ / ชื่อ</button>}
              </div>
              <p className="small muted">
                เงินคงเหลือจริง (ได้รับ − จ่าย) <b className={r.balance < 0 ? 'bad' : ''}>{fmtBaht(r.balance, { dec: false })}</b> · งบเดิม {fmtBaht(r.base, { dec: false })}{r.adjust !== 0 && ` · ปรับ ${fmtBaht(r.adjust, { dec: false, sign: true })}`} ·{' '}
                {r.line.incomeTypeIds?.length ? `รายรับจากประเภท: ${r.line.incomeTypeIds.map((id) => types.byId(id)?.name ?? '?').join(', ')}` : 'ยังไม่ผูกประเภทรายรับ (กด “＋ เงินเข้า” เพื่อบันทึกตรงได้)'}
              </p>
              <EntryList rows={r} entries={entries.items.filter((e) => e.lineId === r.line.id)} canEdit={canEntry} onEdit={(e) => setEntry({ lineId: e.lineId, kind: e.kind, edit: e })} />
            </section>
          ))}

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
      {sheet === 'new' && <NewBudget year={year} order={rows.length} lines={lines} onClose={() => setSheet(null)} />}
      {entry && <EntrySheet year={year} lineName={lineName(entry.lineId)} entry={entry} entries={entries} onClose={() => setEntry(null)} />}
      {editNum && <EditNumbers row={rows.find((r) => r.line.id === editNum.lineId)!} focus={editNum.focus} lines={lines} adjs={adjs} onClose={() => setEditNum(null)} />}
      {linkId && <LinkSheet line={lines.items.find((l) => l.id === linkId)!} types={types.list} onClose={() => setLinkId(null)} lines={lines} />}
      {(sheet === 'adjust' || sheet === 'emergency' || sheet === 'transfer') && <BudgetSheet kind={sheet} year={year} pickId={pickId} onClose={() => setSheet(null)} lines={lines} adjs={adjs} rows={rows} />}
    </>
  )
}

/** รายการที่บันทึกตรงในงบนี้ (เงินเข้า/ใช้จ่าย) แตะเพื่อแก้ไขหรือลบ */
function EntryList({ rows, entries, canEdit, onEdit }: { rows: Rows[number]; entries: BudgetEntry[]; canEdit: boolean; onEdit: (e: BudgetEntry) => void }) {
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

/** ตั้งงบใหม่: ชื่อ + 3 ช่อง (ได้รับ/งบที่ตั้ง/จ่ายแล้ว) แท่งขึ้นตามที่พิมพ์ทันที */
function NewBudget({ year, order, lines, onClose }: { year: number; order: number; lines: ReturnType<typeof useBudgetLines>; onClose: () => void }) {
  const types = useIncomeTypes()
  const [name, setName] = useState('')
  const [got, setGot] = useState<number | null>(null)
  const [budget, setBudget] = useState<number | null>(null)
  const [spent, setSpent] = useState<number | null>(null)
  const [link, setLink] = useState<string[]>([])
  const [err, setErr] = useState('')
  const save = () => {
    if (!name.trim()) return setErr('ตั้งชื่องบก่อน เช่น ค่าสวัสดิการผู้รับใช้')
    if (!budget && !got && !spent) return setErr('ใส่ตัวเลขอย่างน้อย 1 ช่อง (ได้รับ / งบที่ตั้ง / จ่ายแล้ว)')
    if (lines.put([{ id: newId('bl'), year, name: name.trim(), base: budget ?? 0, order, ...(got ? { openingIn: got } : {}), ...(spent ? { openingOut: spent } : {}), ...(link.length ? { incomeTypeIds: link } : {}), updated: 0 } as BudgetLine])) onClose()
  }
  return (
    <Sheet title="ตั้งงบใหม่" onClose={onClose}>
      <div className="field"><label htmlFor="nb-name">ชื่องบ</label><input id="nb-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ค่าสวัสดิการผู้รับใช้" autoFocus /></div>
      <div className="field"><label htmlFor="nb-got" style={{ color: 'var(--series-1)' }}>① ได้รับ (แท่งเขียว) — เงินที่มีอยู่ในงบ/กองทุนนี้แล้ว</label><MoneyInput id="nb-got" value={got} onChange={setGot} /></div>
      <div className="field"><label htmlFor="nb-bud">② งบที่ตั้ง (แท่งกลาง) — ยังไม่ตั้งก็ปล่อยว่างได้ แท่งจะติดพื้น</label><MoneyInput id="nb-bud" value={budget} onChange={setBudget} /></div>
      <div className="field"><label htmlFor="nb-sp" style={{ color: 'var(--series-2)' }}>③ จ่ายแล้ว (แท่งแดง) — ถ้ามีใช้ไปแล้ว</label><MoneyInput id="nb-sp" value={spent} onChange={setSpent} /></div>
      <BudgetCandles title={name.trim() || 'งบใหม่'} income={got ?? 0} budget={budget ?? 0} spent={spent ?? 0} compact />
      <TypeChecks types={types.list} value={link} onChange={setLink} />
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>บันทึกงบ</button>
      <p className="foot-note">เพิ่มเงินเข้า/ใช้จ่าย แก้ไข หรือปรับงบภายหลังได้ที่การ์ดของงบนี้ · ใบเบิกจ่ายที่เลือกหมวดนี้จะเพิ่มในแท่งแดงเองอัตโนมัติ</p>
    </Sheet>
  )
}

/** บันทึก/แก้ไข/ลบ เงินเข้าหรือใช้จ่ายของงบ */
function EntrySheet({ year, lineName, entry, entries, onClose }: { year: number; lineName: string; entry: { lineId: string; kind: 'in' | 'out'; edit?: BudgetEntry }; entries: ReturnType<typeof useBudgetEntries>; onClose: () => void }) {
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

/** เลือกประเภทรายรับที่เป็นเงินของงบนี้ (ติ๊กได้หลายประเภท) */
function TypeChecks({ types, value, onChange }: { types: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="card card--flat" style={{ margin: 0 }}>
      <legend className="small muted">รายรับที่เป็นเงินของงบนี้ (ไม่บังคับ — ถ้าผูกไว้ แท่งเขียวจะนับรายรับประเภทนี้ให้เอง)</legend>
      {types.map((t) => (
        <label key={t.id} className="row"><input type="checkbox" checked={value.includes(t.id)} onChange={(e) => onChange(e.target.checked ? [...value, t.id] : value.filter((x) => x !== t.id))} /> {t.name}</label>
      ))}
    </fieldset>
  )
}

function LinkSheet({ line, types, onClose, lines }: { line: BudgetLine; types: { id: string; name: string }[]; onClose: () => void; lines: ReturnType<typeof useBudgetLines> }) {
  const [name, setName] = useState(line.name)
  const [link, setLink] = useState<string[]>(line.incomeTypeIds ?? [])
  const save = () => { if (lines.put([{ ...line, name: name.trim() || line.name, incomeTypeIds: link }])) onClose() }
  return (
    <Sheet title="แก้ชื่องบ / ผูกรายรับ" onClose={onClose}>
      <div className="field"><label htmlFor="lk-name">ชื่อหมวดงบ</label><input id="lk-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <TypeChecks types={types} value={link} onChange={setLink} />
      <p className="foot-note">เช่น งบอาหาร ← กองทุนเพื่ออาหาร · ประเภทเดียวกันผูกกับหลายงบได้ แต่ยอดจะถูกนับซ้ำในแต่ละแท่ง</p>
      <button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>
    </Sheet>
  )
}

/** แก้ตัวเลขทั้งสามแท่งในที่เดียว (ช่วงเริ่มต้น) — แสดงที่มาของตัวเลขแต่ละแท่ง งบที่ตั้งที่แก้จะบันทึกลงประวัติให้เอง */
function EditNumbers({ row, focus, lines, adjs, onClose }: { row: Rows[number]; focus: 'in' | 'budget' | 'out'; lines: ReturnType<typeof useBudgetLines>; adjs: ReturnType<typeof useBudgetAdjs>; onClose: () => void }) {
  const [openIn, setOpenIn] = useState<number | null>(row.inParts.opening)
  const [budget, setBudget] = useState<number | null>(row.current)
  const [openOut, setOpenOut] = useState<number | null>(row.outParts.opening)
  const [err, setErr] = useState('')
  const save = () => {
    const oi = openIn ?? 0, oo = openOut ?? 0, b = budget ?? 0
    if (oi < 0 || oo < 0 || b < 0) return setErr('ตัวเลขต้องไม่ติดลบ')
    const ok = lines.put([{ ...row.line, openingIn: oi, openingOut: oo }])
    if (!ok) return
    if (b !== row.current) {
      const y = row.line.year
      adjs.put([{ id: newId('ba'), year: y, lineId: row.line.id, delta: b - row.current, kind: 'adjust', reason: 'แก้ตัวเลขงบที่ตั้งโดยตรง (ช่วงตั้งต้น)', date: yearOf(todayISO()) === y ? todayISO() : `${y}-01-01`, updated: 0 } as BudgetAdj])
    }
    onClose()
  }
  const f = (b: 'in' | 'budget' | 'out') => focus === b
  return (
    <Sheet title={`แก้ตัวเลข — ${row.line.name}`} onClose={onClose}>
      <div className="field">
        <label htmlFor="ed-in" style={{ color: 'var(--series-1)' }}>① ได้รับ (แท่งเขียว) — เงินที่มีอยู่แล้ว/ยกมา</label>
        <MoneyInput id="ed-in" value={openIn} onChange={setOpenIn} autoFocus={f('in')} />
        <span className="foot-note">แท่งเขียวตอนนี้ {fmtBaht(row.income)} = ยกมา {fmtBaht(row.inParts.opening)} + จากรายรับที่ผูกไว้ {fmtBaht(row.inParts.linked)} + บันทึกตรง {fmtBaht(row.inParts.entries)} (รายการบันทึกตรงแก้ได้ในรายการใต้การ์ด)</span>
      </div>
      <div className="field">
        <label htmlFor="ed-bud">② งบที่ตั้ง (แท่งกลาง)</label>
        <MoneyInput id="ed-bud" value={budget} onChange={setBudget} autoFocus={f('budget')} />
        <span className="foot-note">ใส่ 0 ถ้ายังไม่ตั้งงบ (แท่งจะติดพื้น) · ที่แก้จะบันทึกในประวัติการปรับงบ</span>
      </div>
      <div className="field">
        <label htmlFor="ed-out" style={{ color: 'var(--series-2)' }}>③ จ่ายแล้วก่อนเริ่มใช้ระบบ (แท่งแดง)</label>
        <MoneyInput id="ed-out" value={openOut} onChange={setOpenOut} autoFocus={f('out')} />
        <span className="foot-note">แท่งแดงตอนนี้ {fmtBaht(row.spent)} = ตั้งต้น {fmtBaht(row.outParts.opening)} + จากใบเบิก {fmtBaht(row.outParts.vouchers)} + บันทึกตรง {fmtBaht(row.outParts.entries)} (ใบเบิกแก้ที่เมนู “เบิกจ่าย”)</span>
      </div>
      <BudgetCandles title={row.line.name} income={(openIn ?? 0) + row.inParts.linked + row.inParts.entries} budget={budget ?? 0} spent={(openOut ?? 0) + row.outParts.vouchers + row.outParts.entries} compact />
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>บันทึกตัวเลข</button>
    </Sheet>
  )
}
