import { useState } from 'react'
import BudgetCandles from '../components/BudgetCandles'
import MoneyInput from '../components/MoneyInput'
import Sheet from '../components/Sheet'
import { can } from '../lib/access'
import { useBudgetEntries, useFunds, useIncome, useIncomeTypes, useVouchers } from '../lib/data'
import { budgetRows } from '../lib/ledger'
import { useRole } from '../lib/members'
import { be, fmtBaht, newId } from '../lib/money'
import type { BudgetEntry, BudgetLine } from '../lib/types'
import { EntryList, EntrySheet, linkedSum, Sources, sumByType } from './Budget'

const YEARS_BACK = 5 // รวมยอดย้อนหลัง 6 ปี (ปีที่เลือก + 5 ปีก่อนหน้า)

/**
 * กองทุน: ตั้งเป้าหมาย (แท่งเทา เช่น 6 ล้าน) · เงินถวายที่เข้ากองทุน (แท่งเขียว) · จ่ายออกจากกองทุน (แท่งแดง)
 * สะสมข้ามปี (ไม่แบ่งปีเหมือนงบ) · เพิ่ม/แก้/ลบได้ · เงินถวายเข้ากองทุนผ่านช่อง “ประเภทถวาย” ตอนบันทึกรายรับ
 */
export default function FundsPage({ year }: { year: number }) {
  const role = useRole()
  const funds = useFunds()
  const types = useIncomeTypes()
  const ys = Array.from({ length: YEARS_BACK + 1 }, (_, i) => year - YEARS_BACK + i)
  // จำนวน hook คงที่ทุกครั้ง (6 ปี) จึงเรียกซ้ำใน map ได้
  const incs = ys.map((y) => useIncome(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const vous = ys.map((y) => useVouchers(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const ents = ys.map((y) => useBudgetEntries(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const allIncome = incs.flatMap((s) => s.items)
  const rows = budgetRows(funds.items, [], vous.flatMap((s) => s.items), allIncome, ents.flatMap((s) => s.items))
    .sort((a, b) => a.line.order - b.line.order)
  const isAdmin = can(role, 'budget')
  const canEntry = can(role, 'income')
  const [sheet, setSheet] = useState<'new' | null>(null)
  const [edit, setEdit] = useState<{ id: string; focus: 'name' | 'in' | 'budget' | 'out' } | null>(null)
  const [entry, setEntry] = useState<{ lineId: string; kind: 'in' | 'out'; edit?: BudgetEntry } | null>(null)
  const deleted = funds.all.filter((f) => f.deleted)
  const storeOf = (y: number) => ents[Math.max(0, ys.indexOf(y))]
  const nameOf = (id: string) => funds.all.find((f) => f.id === id)?.name ?? '?'
  const sourceNames = (f: BudgetLine) => (f.incomeTypeIds ?? []).map((id) => types.byId(id)?.name ?? '?').join(', ')

  const del = (f: BudgetLine) => {
    if (!confirm(`ลบกองทุน “${f.name}”?\n\nข้อมูลที่บันทึกไว้ไม่หาย (กู้คืนได้ที่ “กองทุนที่ลบแล้ว”) ประเภทถวายที่สร้างให้ชื่อเดียวกันจะถูกซ่อนจากช่องเลือกด้วย`)) return
    funds.remove(f.id)
    if (f.ownTypeId) types.remove(f.ownTypeId)
  }
  const restore = (f: BudgetLine) => {
    funds.put([{ ...f, deleted: false }])
    const t = f.ownTypeId ? types.byId(f.ownTypeId) : undefined
    if (t?.deleted) types.put([{ ...t, deleted: false }])
  }
  const purge = async (f: BudgetLine) => {
    if (!confirm(`ลบถาวรกองทุน “${f.name}”?\nเอาออกจากไฟล์จริงพร้อมบันทึกตรงของกองทุนนี้ กู้คืนไม่ได้ (ใบเบิกที่อ้างถึงจะแสดง “นอกงบประมาณ”)`)) return
    await Promise.all([funds.purge((x) => x.id === f.id), ...ents.map((s) => s.purge((e) => e.lineId === f.id))])
  }
  const move = (id: string, dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.line.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= rows.length) return
    funds.put([{ ...rows[i].line, order: rows[j].line.order }, { ...rows[j].line, order: rows[i].line.order }])
  }

  return (
    <>
      <div className="page-head"><h1>กองทุน</h1></div>
      <p className="muted small">สะสมข้ามปี (รวมยอดตั้งแต่ปี {be(ys[0])} ถึง {be(year)}) · เงินถวายเข้ากองทุนโดยเลือก “ประเภทถวาย” ที่ชื่อตรงกับกองทุนตอนบันทึกรายรับ</p>
      {isAdmin && <button type="button" className="btn btn--gold btn--block no-print" style={{ fontSize: '1.1rem' }} onClick={() => setSheet('new')}>＋ ตั้งกองทุนใหม่</button>}

      {rows.length === 0 && <section className="card"><p className="empty">ยังไม่มีกองทุน{isAdmin ? ' — กด “＋ ตั้งกองทุนใหม่” เช่น กองทุนซื้อที่ดิน (เป้าหมาย 6,000,000) หรือกองทุนสร้างอาคาร' : ''}</p></section>}

      {rows.map((r) => {
        const f = r.line
        const gap = r.current - r.income
        return (
          <section key={f.id} className="card" aria-label={`กองทุน ${f.name}`}>
            <div className="row row--between">
              <h2>{isAdmin ? <button type="button" style={{ all: 'unset', cursor: 'pointer' }} aria-label={`แก้ชื่อกองทุน ${f.name}`} onClick={() => setEdit({ id: f.id, focus: 'name' })}>{f.name} <span className="small muted no-print">✎</span></button> : f.name}</h2>
              <span className={r.balance < 0 ? 'bad' : 'good'}><b>เงินในกองทุน {fmtBaht(r.balance, { dec: false })}</b></span>
            </div>
            <BudgetCandles fund title={f.name} income={r.income} budget={r.current} spent={r.spent} onEdit={isAdmin ? (bar) => setEdit({ id: f.id, focus: bar }) : undefined} />
            <div className="row no-print">
              {canEntry && <button type="button" className="mini" style={{ borderColor: 'var(--series-1)' }} onClick={() => setEntry({ lineId: f.id, kind: 'in' })}>＋ เงินเข้า</button>}
              {canEntry && <button type="button" className="mini" style={{ borderColor: 'var(--series-2)' }} onClick={() => setEntry({ lineId: f.id, kind: 'out' })}>＋ ใช้จ่าย</button>}
              {isAdmin && <button type="button" className="mini" onClick={() => setEdit({ id: f.id, focus: 'name' })}>✎ แก้ไขกองทุน (ชื่อ / แหล่งที่มา)</button>}
              {isAdmin && <button type="button" className="mini" aria-label={`เลื่อน ${f.name} ขึ้น`} onClick={() => move(f.id, -1)}>▲</button>}
              {isAdmin && <button type="button" className="mini" aria-label={`เลื่อน ${f.name} ลง`} onClick={() => move(f.id, 1)}>▼</button>}
              {isAdmin && <button type="button" className="mini" aria-label={`ลบกองทุน ${f.name}`} onClick={() => del(f)}>🗑️ ลบกองทุนนี้</button>}
            </div>
            <p className="small muted">
              {r.current > 0 ? (gap > 0 ? `ขาดอีก ${fmtBaht(gap, { dec: false })} ถึงเป้าหมาย` : `ครบเป้าหมายแล้ว ✓ (เกิน ${fmtBaht(-gap, { dec: false })})`) : 'ยังไม่ได้ตั้งเป้าหมาย'} · แหล่งที่มา:{' '}
              {isAdmin ? <button type="button" className="mini no-print" onClick={() => setEdit({ id: f.id, focus: 'name' })}><b>{sourceNames(f) || 'ยังไม่ได้เลือก'}</b> ✎</button> : sourceNames(f) || 'ยังไม่ได้เลือก'}
            </p>
            <EntryList rows={r} entries={ents.flatMap((s) => s.items).filter((e) => e.lineId === f.id)} canEdit={canEntry} onEdit={(e) => setEntry({ lineId: e.lineId, kind: e.kind, edit: e })} />
          </section>
        )
      })}

      {isAdmin && deleted.length > 0 && (
        <details className="card no-print">
          <summary><b>กองทุนที่ลบแล้ว ({deleted.length})</b> — กู้คืนได้</summary>
          <ul className="list">{deleted.map((f) => <li key={f.id}><span className="grow">{f.name}</span><button type="button" className="mini" onClick={() => restore(f)}>↩︎ กู้คืน</button><button type="button" className="mini" aria-label={`ลบถาวร ${f.name}`} onClick={() => purge(f)}>ลบถาวร</button></li>)}</ul>
        </details>
      )}

      {sheet === 'new' && <NewFund order={rows.length} funds={funds} types={types} income={allIncome} onClose={() => setSheet(null)} />}
      {edit && <EditFund row={rows.find((r) => r.line.id === edit.id)!} focus={edit.focus} income={allIncome} funds={funds} types={types} onClose={() => setEdit(null)} />}
      {entry && <EntrySheet year={entry.edit?.year ?? year} lineName={nameOf(entry.lineId)} entry={entry} entries={entry.edit ? storeOf(entry.edit.year) : storeOf(year)} onClose={() => setEntry(null)} />}
    </>
  )
}

type Types = ReturnType<typeof useIncomeTypes>

function NewFund({ order, funds, types, income, onClose }: { order: number; funds: ReturnType<typeof useFunds>; types: Types; income: { typeId: string; amount: number }[]; onClose: () => void }) {
  const [name, setName] = useState('')
  const [own, setOwn] = useState(true)
  const [link, setLink] = useState<string[]>([])
  const [target, setTarget] = useState<number | null>(null)
  const [got, setGot] = useState<number | null>(null)
  const [spent, setSpent] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const save = () => {
    const n = name.trim()
    if (!n) return setErr('ตั้งชื่อกองทุนก่อน เช่น กองทุนซื้อที่ดิน')
    let ids = [...link]
    let ownTypeId: string | undefined
    if (own) {
      const same = types.list.find((t) => t.name === n)
      if (same) { if (!ids.includes(same.id)) ids = [...ids, same.id] } else {
        ownTypeId = newId('t')
        if (!types.put([{ id: ownTypeId, name: n, order: types.list.length, active: true, updated: 0 }])) return
        ids = [...ids, ownTypeId]
      }
    }
    if (funds.put([{ id: newId('fd'), year: 0, name: n, base: target ?? 0, order, kind: 'fund', ...(got ? { openingIn: got } : {}), ...(spent ? { openingOut: spent } : {}), ...(ids.length ? { incomeTypeIds: ids } : {}), ...(ownTypeId ? { ownTypeId } : {}), updated: 0 } as BudgetLine])) onClose()
  }
  return (
    <Sheet title="ตั้งกองทุนใหม่" onClose={onClose}>
      <div className="field"><label htmlFor="nf-name">ชื่อกองทุน</label><input id="nf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น กองทุนซื้อที่ดิน / กองทุนสร้างอาคาร" autoFocus /></div>
      <label className="row"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} /> <span>สร้าง “ประเภทถวาย” ชื่อเดียวกับกองทุนนี้ให้ (ไว้เลือกตอนบันทึกรายรับ/ใบถวาย — เงินถวายประเภทนี้จะเข้ากองทุนนี้เอง)</span></label>
      <Sources totals={sumByType(income)} value={link} onChange={setLink} />
      <fieldset data-zone="numbers" className="card card--flat" style={{ margin: 0 }}>
        <legend className="small muted">ตัวเลขของ 3 แท่ง — เขียว → เทา → แดง</legend>
      <div className="field"><label htmlFor="nf-got" style={{ color: 'var(--series-1)' }}>① เก็บได้แล้ว (แท่งเขียว) — เงินที่มีอยู่แล้ว/ยกมา</label><MoneyInput id="nf-got" value={got} onChange={setGot} /></div>
      <div className="field"><label htmlFor="nf-target">② เป้าหมาย (แท่งเทา) — เช่น 6,000,000 ยังไม่ตั้งก็ปล่อยว่างได้</label><MoneyInput id="nf-target" value={target} onChange={setTarget} /></div>
      <div className="field"><label htmlFor="nf-sp" style={{ color: 'var(--series-2)' }}>③ จ่ายออกไปแล้ว (แท่งแดง) — ถ้ามี</label><MoneyInput id="nf-sp" value={spent} onChange={setSpent} /></div>
      </fieldset>
      <BudgetCandles fund title={name.trim() || 'กองทุนใหม่'} income={(got ?? 0) + linkedSum(income, link)} budget={target ?? 0} spent={spent ?? 0} compact />
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>บันทึกกองทุน</button>
    </Sheet>
  )
}

function EditFund({ row, focus, income, funds, types, onClose }: { row: ReturnType<typeof budgetRows>[number]; focus: 'name' | 'in' | 'budget' | 'out'; income: { typeId: string; amount: number }[]; funds: ReturnType<typeof useFunds>; types: Types; onClose: () => void }) {
  const [name, setName] = useState(row.line.name)
  const [link, setLink] = useState<string[]>(row.line.incomeTypeIds ?? [])
  const [openIn, setOpenIn] = useState<number | null>(row.inParts.opening)
  const [target, setTarget] = useState<number | null>(row.line.base)
  const [openOut, setOpenOut] = useState<number | null>(row.outParts.opening)
  const [err, setErr] = useState('')
  const save = () => {
    const n = name.trim()
    if (!n) return setErr('ชื่อกองทุนต้องไม่ว่าง')
    if ((openIn ?? 0) < 0 || (openOut ?? 0) < 0 || (target ?? 0) < 0) return setErr('ตัวเลขต้องไม่ติดลบ')
    if (!funds.put([{ ...row.line, name: n, base: target ?? 0, incomeTypeIds: link, openingIn: openIn ?? 0, openingOut: openOut ?? 0 }])) return
    const t = row.line.ownTypeId ? types.byId(row.line.ownTypeId) : undefined
    if (t && t.name !== n) types.put([{ ...t, name: n }]) // ประเภทถวายที่สร้างคู่กัน เปลี่ยนชื่อตามกองทุน
    onClose()
  }
  const liveIn = (openIn ?? 0) + linkedSum(income, link) + row.inParts.entries
  return (
    <Sheet title={`แก้ไขกองทุน — ${row.line.name}`} onClose={onClose}>
      <div className="field"><label htmlFor="ef-name">ชื่อกองทุน</label><input id="ef-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={focus === 'name'} /></div>
      <Sources totals={sumByType(income)} value={link} onChange={setLink} />
      <fieldset data-zone="numbers" className="card card--flat" style={{ margin: 0 }}>
        <legend className="small muted">ตัวเลขของ 3 แท่ง — เขียว → เทา → แดง</legend>
      <div className="field">
        <label htmlFor="ef-in" style={{ color: 'var(--series-1)' }}>① เก็บได้แล้ว (แท่งเขียว) — เงินยกมา/ที่มีอยู่แล้ว</label>
        <MoneyInput id="ef-in" value={openIn} onChange={setOpenIn} autoFocus={focus === 'in'} />
        <span className="foot-note">แท่งเขียวตอนนี้ {fmtBaht(liveIn)} = ยกมา {fmtBaht(openIn ?? 0)} + จากแหล่งที่ติ๊ก {fmtBaht(linkedSum(income, link))} + บันทึกตรง {fmtBaht(row.inParts.entries)}</span>
      </div>
      <div className="field"><label htmlFor="ef-target">② เป้าหมาย (แท่งเทา)</label><MoneyInput id="ef-target" value={target} onChange={setTarget} autoFocus={focus === 'budget'} /></div>
      <div className="field">
        <label htmlFor="ef-out" style={{ color: 'var(--series-2)' }}>③ จ่ายออกไปแล้วก่อนเริ่มใช้ระบบ (แท่งแดง)</label>
        <MoneyInput id="ef-out" value={openOut} onChange={setOpenOut} autoFocus={focus === 'out'} />
        <span className="foot-note">แท่งแดงตอนนี้ {fmtBaht((openOut ?? 0) + row.outParts.vouchers + row.outParts.entries)} = ตั้งต้น {fmtBaht(openOut ?? 0)} + จากใบเบิก {fmtBaht(row.outParts.vouchers)} + บันทึกตรง {fmtBaht(row.outParts.entries)}</span>
      </div>
      </fieldset>
      <BudgetCandles fund title={name.trim() || row.line.name} income={liveIn} budget={target ?? 0} spent={(openOut ?? 0) + row.outParts.vouchers + row.outParts.entries} compact />
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>
    </Sheet>
  )
}
