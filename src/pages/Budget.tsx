import { useState } from 'react'
import MoneyInput from '../components/MoneyInput'
import Sheet from '../components/Sheet'
import { can } from '../lib/access'
import BudgetCandles from '../components/BudgetCandles'
import { useBudgetAdjs, useBudgetLines, useIncome, useIncomeTypes, useVouchers } from '../lib/data'
import { budgetRows } from '../lib/ledger'
import { useRole } from '../lib/members'
import { be, fmtBaht, fmtDate, newId, todayISO, yearOf } from '../lib/money'
import type { AdjKind, BudgetAdj, BudgetLine } from '../lib/types'
import { useYear } from '../lib/year'

const TEMPLATE = ['เงินเดือน/ค่าตอบแทน', 'สาธารณูปโภค', 'ซ่อมแซมและบำรุงอาคาร', 'พันธกิจและมิชชั่น', 'กิจกรรมและการอบรม', 'วัสดุอุปกรณ์สำนักงาน', 'ช่วยเหลือสังคม']
const KIND_LABEL: Record<AdjKind, string> = { adjust: 'ปรับงบ', emergency: 'งบฉุกเฉิน', transfer: 'โอนงบระหว่างหมวด' }

export default function Budget() {
  const { year } = useYear()
  return <Page key={year} year={year} />
}

function Page({ year }: { year: number }) {
  const role = useRole()
  const lines = useBudgetLines(year)
  const adjs = useBudgetAdjs(year)
  const vs = useVouchers(year)
  const income = useIncome(year)
  const types = useIncomeTypes()
  const [linkId, setLinkId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'adjust' | 'emergency' | 'transfer' | 'line' | null>(null)
  const [pickId, setPickId] = useState<string | undefined>()
  const isAdmin = can(role, 'budget')
  const rows = budgetRows(lines.items, adjs.items, vs.items, income.items)
  const yearIncome = income.items.reduce((s, x) => s + x.amount, 0)
  const tot = rows.reduce((a, r) => ({ base: a.base + r.base, current: a.current + r.current, spent: a.spent + r.spent, committed: a.committed + r.committed, remaining: a.remaining + r.remaining }), { base: 0, current: 0, spent: 0, committed: 0, remaining: 0 })
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
      {rows.length === 0 ? (
        <section className="card">
          <p className="empty">ยังไม่มีงบประมาณปี {be(year)}</p>
          {isAdmin ? <><button type="button" className="btn btn--gold" onClick={seed}>สร้างหมวดงบมาตรฐาน (แก้ได้)</button><CopyPrev year={year} lines={lines} /></> : <p className="muted small">แอดมินเป็นผู้ตั้งงบประมาณ</p>}
        </section>
      ) : (
        <>
          <section className="card" aria-label="ภาพรวมทั้งปี">
            <h2>ภาพรวมทั้งปี</h2>
            <BudgetCandles title="ภาพรวมทั้งปี" income={yearIncome} budget={tot.current} spent={tot.spent} committed={tot.committed} />
            <p className="foot-note">แท่งเขียวของภาพรวม = รายรับทุกประเภทตลอดปี</p>
          </section>
          <div className="kpi">
            <div><span>งบรวมปัจจุบัน</span><b>{fmtBaht(tot.current, { dec: false })}</b></div>
            <div><span>จ่ายจริงแล้ว</span><b>{fmtBaht(tot.spent, { dec: false })}</b></div>
            <div><span>เหลือ (หักที่ยื่นเบิกค้าง)</span><b className={tot.remaining < 0 ? 'bad' : ''}>{fmtBaht(tot.remaining, { dec: false })}</b></div>
          </div>
          {isAdmin && (
            <div className="row no-print">
              <button type="button" className="btn btn--ghost" onClick={() => { setPickId(undefined); setSheet('adjust') }}>± ปรับงบ</button>
              <button type="button" className="btn btn--gold" onClick={() => setSheet('emergency')}>🚨 เพิ่มงบฉุกเฉิน</button>
              <button type="button" className="btn btn--ghost" onClick={() => setSheet('transfer')}>⇄ โอนงบ</button>
              <button type="button" className="btn btn--ghost" onClick={() => setSheet('line')}>＋ หมวดใหม่</button>
            </div>
          )}
          <section className="card" aria-label="งบประมาณแยกหมวด">
            <ul className="list">
              {rows.map((r) => {
                const pct = r.current > 0 ? Math.min(100, (r.spent / r.current) * 100) : 0
                const pct2 = r.current > 0 ? Math.min(100 - pct, (r.committed / r.current) * 100) : 0
                return (
                  <li key={r.line.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                    <div className="row row--between">
                      <b>{r.line.name}{r.line.reserve && <span className="badge"> สำรอง</span>}</b>
                      {isAdmin && <span className="row no-print"><button type="button" className="mini" onClick={() => setLinkId(r.line.id)}>ผูกรายรับ</button><button type="button" className="mini" onClick={() => { setPickId(r.line.id); setSheet('adjust') }}>ปรับงบ</button></span>}
                    </div>
                    <BudgetCandles title={r.line.name} income={r.income} budget={r.current} spent={r.spent} committed={r.committed} />
                    <p className="small muted">{r.line.incomeTypeIds?.length ? `รายรับของงบนี้: ${r.line.incomeTypeIds.map((id) => types.byId(id)?.name ?? '?').join(', ')}` : 'ยังไม่ได้ผูกประเภทรายรับ — แท่งเขียวจะเป็น 0 จนกว่าจะผูก (ปุ่ม “ผูกรายรับ”)'}</p>
                    <div className={`progress ${r.remaining < 0 ? 'over' : ''}`} role="img" aria-label={`ใช้แล้ว ${Math.round(pct)}% ของงบ`}>
                      <i style={{ width: `${pct}%`, float: 'left' }} /><i style={{ width: `${pct2}%`, float: 'left', background: 'var(--ref)' }} />
                    </div>
                    <div className="row row--between small">
                      <span>งบ <b>{fmtBaht(r.current, { dec: false })}</b>{r.adjust !== 0 && <span className="muted"> (เดิม {fmtBaht(r.base, { dec: false })}, ปรับ {fmtBaht(r.adjust, { dec: false, sign: true })})</span>}</span>
                      <span>จ่าย {fmtBaht(r.spent, { dec: false })}{r.committed > 0 && ` · ค้างเบิก ${fmtBaht(r.committed, { dec: false })}`}</span>
                      <span className={r.remaining < 0 ? 'bad' : 'good'}><b>เหลือ {fmtBaht(r.remaining, { dec: false })}</b></span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
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
      {linkId && <LinkSheet line={lines.items.find((l) => l.id === linkId)!} types={types.list} onClose={() => setLinkId(null)} lines={lines} />}
      {sheet && <BudgetSheet kind={sheet} year={year} pickId={pickId} onClose={() => setSheet(null)} lines={lines} adjs={adjs} rows={rows} />}
    </>
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

function BudgetSheet({ kind, year, pickId, onClose, lines, adjs, rows }: { kind: 'adjust' | 'emergency' | 'transfer' | 'line'; year: number; pickId?: string; onClose: () => void; lines: ReturnType<typeof useBudgetLines>; adjs: ReturnType<typeof useBudgetAdjs>; rows: ReturnType<typeof budgetRows> }) {
  const [lineId, setLineId] = useState(pickId ?? rows.find((r) => r.line.reserve)?.line.id ?? rows[0]?.line.id ?? '')
  const [toId, setToId] = useState(rows.find((r) => r.line.id !== lineId)?.line.id ?? '')
  const [sign, setSign] = useState<1 | -1>(1)
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(yearOf(todayISO()) === year ? todayISO() : `${year}-12-31`)
  const [newName, setNewName] = useState('')
  const [target, setTarget] = useState<'existing' | 'new'>('existing')
  const [err, setErr] = useState('')
  const types = useIncomeTypes()
  const [link, setLink] = useState<string[]>([])
  const row = (id: string) => rows.find((r) => r.line.id === id)

  const go = () => {
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${be(year)}`)
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    if (kind === 'line') {
      if (!newName.trim()) return setErr('ใส่ชื่อหมวด')
      lines.put([{ id: newId('bl'), year, name: newName.trim(), base: amount, order: rows.length, ...(link.length ? { incomeTypeIds: link } : {}), updated: 0 } as BudgetLine])
      return onClose()
    }
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
  const title = { adjust: 'ปรับงบ (เพิ่ม/ลด)', emergency: 'เพิ่มงบฉุกเฉินระหว่างปี', transfer: 'โอนงบระหว่างหมวด', line: 'เพิ่มหมวดงบใหม่' }[kind]
  const sel = (id: string, label: string, v: string, set: (s: string) => void) => (
    <div className="field"><label htmlFor={id}>{label}</label><select id={id} className="input" value={v} onChange={(e) => set(e.target.value)}>{rows.map((r) => <option key={r.line.id} value={r.line.id}>{r.line.name} (งบ {fmtBaht(r.current, { dec: false })})</option>)}</select></div>
  )
  return (
    <Sheet title={title} onClose={onClose}>
      {kind === 'line' && <div className="field"><label htmlFor="b-name">ชื่อหมวด</label><input id="b-name" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>}
      {kind === 'line' && <TypeChecks types={types.list} value={link} onChange={setLink} />}
      {kind === 'adjust' && <>{sel("b-line", "หมวด", lineId, setLineId)}<div className="seg" role="group" aria-label="เพิ่มหรือลด"><button type="button" className={sign === 1 ? 'on' : ''} onClick={() => setSign(1)}>เพิ่มงบ</button><button type="button" className={sign === -1 ? 'on' : ''} onClick={() => setSign(-1)}>ลดงบ</button></div></>}
      {kind === 'emergency' && (
        <>
          <div className="seg" role="group" aria-label="ปลายทาง"><button type="button" className={target === 'existing' ? 'on' : ''} onClick={() => setTarget('existing')}>เข้าหมวดที่มี</button><button type="button" className={target === 'new' ? 'on' : ''} onClick={() => setTarget('new')}>เปิดหมวดใหม่</button></div>
          {target === 'existing' ? sel("b-line", "เข้าหมวด", lineId, setLineId) : <div className="field"><label htmlFor="b-name">ชื่อหมวดฉุกเฉินใหม่</label><input id="b-name" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น ซ่อมหลังคาฉุกเฉิน" /></div>}
        </>
      )}
      {kind === 'transfer' && <>{sel("b-from", "จากหมวด", lineId, setLineId)}{sel("b-to", "ไปหมวด", toId, setToId)}</>}
      <div className="field"><label htmlFor="b-amt">{kind === 'line' ? 'งบตั้งต้น (บาท)' : 'จำนวนเงิน (บาท)'}</label><MoneyInput id="b-amt" value={amount} onChange={setAmount} /></div>
      {kind !== 'line' && <div className="field"><label htmlFor="b-why">เหตุผล / ที่มาของเงิน (บันทึกในประวัติ)</label><textarea id="b-why" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'emergency' ? 'เช่น ที่ประชุมผู้ปกครอง 5 ต.ค. มีมติอนุมัติจากเงินสะสม' : ''} /></div>}
      {kind !== 'line' && <div className="field"><label htmlFor="b-date">วันที่มีผล</label><input id="b-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>}
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={go}>บันทึก</button>
    </Sheet>
  )
}

/** เลือกประเภทรายรับที่เป็นเงินของงบนี้ (ติ๊กได้หลายประเภท) */
function TypeChecks({ types, value, onChange }: { types: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="card card--flat" style={{ margin: 0 }}>
      <legend className="small muted">รายรับที่เป็นเงินของงบนี้ (ไม่บังคับ — ใช้แสดงแท่งเขียว “ได้รับ”)</legend>
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
    <Sheet title="ผูกรายรับกับงบ" onClose={onClose}>
      <div className="field"><label htmlFor="lk-name">ชื่อหมวดงบ</label><input id="lk-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <TypeChecks types={types} value={link} onChange={setLink} />
      <p className="foot-note">เช่น งบอาหาร ← กองทุนเพื่ออาหาร · ประเภทเดียวกันผูกกับหลายงบได้ แต่ยอดจะถูกนับซ้ำในแต่ละแท่ง</p>
      <button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>
    </Sheet>
  )
}
