import { useState } from 'react'
import { Link } from 'react-router-dom'
import DebtBanner from '../components/DebtBanner'
import MoneyInput from '../components/MoneyInput'
import { can } from '../lib/access'
import { useLoans, useExpenses, useIncome, useIncomeTypes, useOpening, usePassbook, useRounds } from '../lib/data'
import { fundAccounts, withRunning, type FundAccount } from '../lib/fundAccounts'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, newId, todayISO, yearOf } from '../lib/money'
import type { ExpenseEntry } from '../lib/types'
import { useYear } from '../lib/year'

type ExpStore = ReturnType<typeof useExpenses>
const neg = (x: number) => (x < 0 ? { color: '#b3261e' } : undefined)

/** หน้า "กองทุน": แต่ละกองทุนพับ/ขยายได้ — เห็นรับเข้า (ถวาย/ยืมมา) และจ่ายออก พร้อมยอดคงเหลือ (ติดลบแสดงสีแดง) · บันทึกรายจ่ายของกองทุนได้ที่นี่ ไม่ปนเงินหมุนเวียน */
/** ข้อมูลกองทุนทั้งหมด (3 ปีล่าสุด) ใช้ร่วมกันทั้งหน้ารวมและหน้าแต่ละกองทุน */
export function useFundAccounts() {
  const { year } = useYear()
  const role = useRole()
  const types = useIncomeTypes()
  const opening = useOpening()
  const loans = useLoans()
  const ys = [year - 2, year - 1, year] // จำนวน hook คงที่
  const incs = ys.map((y) => useIncome(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const rds = ys.map((y) => useRounds(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const exps = ys.map((y) => useExpenses(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const pbs = ys.map((y) => usePassbook(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const allExp = exps.flatMap((s) => s.items)
  const rows = fundAccounts({ types: types.list.filter((t) => t.active), opening: opening.opening, income: incs.flatMap((s) => s.items), rounds: rds.flatMap((s) => s.items), expenses: allExp, passbook: pbs.flatMap((s) => s.items), loans: loans.items })
  const total = rows.reduce((s, r) => s + r.balance, 0)
  const canPay = can(role, 'voucherPay')
  const storeFor = (y: number): ExpStore | undefined => exps[ys.indexOf(y)]
  return { rows, total, canPay, storeFor, allExp, types, opening: opening.opening, loans: loans.items }
}

export default function FundAccountsPage() {
  const { rows, total, canPay, storeFor, allExp, types, opening, loans } = useFundAccounts()
  return (
    <>
      <div className="page-head"><h1>💰 กองทุน</h1></div>
      <section className="card" aria-label="รวมทุกกองทุน">
        <p className="muted small" style={{ margin: 0 }}>เงินกองทุนรวมทุกกอง{opening ? ` (นับจากยอดตั้งต้น ${fmtDate(opening.date)})` : ''}</p>
        <p style={{ fontSize: '1.7rem', fontWeight: 700, margin: '2px 0', ...neg(total) }}>{fmtBaht(total)} บาท</p>
        <p className="muted small" style={{ margin: 0 }}>แต่ละกองทุนแตะเพื่อขยาย: เห็นเงินที่เข้า (ถวาย/ยืมมา) เงินที่จ่ายออก และบันทึกรายจ่ายของกองทุนนั้นได้เลย · แถบแดงเตือนเงินยืม ไม่นำไปหักลบกับยอด</p>
      </section>
      {rows.length === 0 && <p className="empty">ยังไม่มีกองทุน — ตั้งกองทุนที่ <Link to="/settings">ตั้งค่า › ยอดยกมา</Link></p>}
      {rows.map((f) => (
        <details key={f.id} className="card fundcard">
          <summary style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}><b>{f.name}</b><b className="num" style={{ fontSize: '1.2rem', ...neg(f.balance) }}>{fmtBaht(f.balance)}{f.balance < 0 ? ' (ติดลบ)' : ''}</b></div>
            <DebtBanner loans={loans.filter((l) => l.borrower === f.id)} types={types.list} />
            <DebtBanner loans={loans.filter((l) => l.lender.kind === 'fund' && l.lender.fundId === f.id)} types={types.list} lent openingDate={opening?.date} />
          </summary>
          <p className="small" style={{ margin: '4px 0' }}><Link to={`/funds/${f.id}`}>เปิดหน้ากองทุนนี้เต็มหน้า ›</Link></p>
          <FundBody f={f} openingDate={opening?.date} canPay={canPay} allExp={allExp} storeFor={storeFor} />
        </details>
      ))}
      <p className="muted small">ตั้งต้นกองทุน เพิ่มกองใหม่ หรือแก้ชื่อ ที่ <Link to="/settings">ตั้งค่า › ยอดยกมา</Link> — ใช้เฉพาะตอนเริ่มระบบหรือเริ่มกองทุนใหม่เท่านั้น</p>
    </>
  )
}

export function FundBody({ f, openingDate, canPay, allExp, storeFor }: { f: FundAccount; openingDate?: string; canPay: boolean; allExp: ExpenseEntry[]; storeFor: (y: number) => ExpStore | undefined }) {
  const [form, setForm] = useState<{ id?: string; date: string; desc: string; amount: number | null; method: 'cash' | 'transfer'; note: string } | null>(null)
  const [err, setErr] = useState('')
  const run = withRunning(f)
  const ins = run.filter((m) => m.amount > 0), outs = run.filter((m) => m.amount < 0)
  const save = () => {
    if (!form) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setErr('เลือกวันที่')
    if (!form.desc.trim()) return setErr('ใส่รายละเอียดรายจ่าย')
    if (!form.amount || form.amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    const old = form.id ? allExp.find((x) => x.id === form.id) : undefined
    const entry: ExpenseEntry = { ...(old ?? {}), id: form.id ?? newId('ex'), updated: 0, channel: 'manual', date: form.date, amount: form.amount, desc: form.desc.trim(), fundId: f.id, status: 'paid', paidDate: form.date, method: form.method, ...(form.note.trim() ? { note: form.note.trim() } : {}) } as ExpenseEntry
    const st = storeFor(yearOf(form.date))
    if (!st) return setErr('วันที่ต้องอยู่ในช่วง 3 ปีล่าสุด (เปลี่ยนปีบัญชีที่มุมขวาบน)')
    if (old && yearOf(old.date) !== yearOf(form.date)) storeFor(yearOf(old.date))?.remove(old.id)
    if (!st.put([entry])) return setErr('สิทธิ์ของท่านบันทึกไม่ได้')
    setForm(null); setErr('')
  }
  const edit = (id: string) => { const x = allExp.find((e) => e.id === id); if (x) setForm({ id: x.id, date: x.date, desc: x.desc, amount: x.amount, method: x.method ?? 'cash', note: x.note ?? '' }) }
  const del = (id: string) => { const x = allExp.find((e) => e.id === id); if (x && confirm(`ลบรายจ่าย “${x.desc}” ออกจากกองทุนนี้?`)) storeFor(yearOf(x.date))?.remove(id) }
  const rowsOf = (list: typeof run, label: string, sumLabel: string) => (
    <table className="tbl tbl--paper" aria-label={label}>
      <thead><tr><th>วันที่</th><th>รายการ</th><th className="num">จำนวน</th></tr></thead>
      <tbody>{list.map((m) => (
        <tr key={m.key}><td>{fmtDate(m.date)}</td>
          <td>{m.label}{canPay && m.expenseId && <> <button type="button" className="mini" aria-label={`แก้ไข ${m.label}`} onClick={() => edit(m.expenseId as string)}>✎</button><button type="button" className="mini" aria-label={`ลบ ${m.label}`} onClick={() => del(m.expenseId as string)}>🗑</button></>}</td>
          <td className="num" style={neg(m.amount)}>{fmtBaht(Math.abs(m.amount))}</td></tr>
      ))}
      {list.length === 0 && <tr><td colSpan={3} className="muted" style={{ textAlign: 'center' }}>ยังไม่มีรายการ</td></tr>}</tbody>
      <tfoot><tr><td colSpan={2}>{sumLabel}</td><td className="num">{fmtBaht(Math.abs(list.reduce((a, m) => a + m.amount, 0)))}</td></tr></tfoot>
    </table>
  )
  return (
    <>
      <p className="small muted" style={{ margin: '4px 0' }}>ตั้งต้น {fmtBaht(f.opening)}{openingDate ? ` (${fmtDate(openingDate)})` : ''} + เข้า {fmtBaht(f.moneyIn)} − ออก {fmtBaht(f.moneyOut)} = <b style={neg(f.balance)}>{fmtBaht(f.balance)}</b></p>
      <div className="stat-title">เงินที่เข้า (ถวาย / ยืมมา / รับคืน)</div>
      {rowsOf(ins, `เงินเข้า ${f.name}`, 'รวมเงินที่เข้า')}
      <div className="stat-title">เงินที่จ่ายออก (รายจ่าย / ให้ยืม / คืนเงินยืม)</div>
      {rowsOf(outs, `เงินออก ${f.name}`, 'รวมเงินที่จ่ายออก')}
      {canPay && (form ? (
        <div className="pbdraft" role="group" aria-label={`บันทึกรายจ่าย ${f.name}`}>
          <div className="field"><label htmlFor={`fx-date-${f.id}`}>วันที่จ่าย</label><input id={`fx-date-${f.id}`} className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div className="field"><label htmlFor={`fx-desc-${f.id}`}>รายละเอียดรายจ่าย</label><input id={`fx-desc-${f.id}`} className="input" value={form.desc} placeholder="เช่น ค่าปูนซีเมนต์ · ค่าแรงช่าง" onChange={(e) => setForm({ ...form, desc: e.target.value })} /></div>
          <div className="field"><label>จำนวนเงิน (บาท)</label><MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></div>
          <div className="seg" role="group" aria-label="จ่ายด้วย"><button type="button" className={form.method === 'cash' ? 'on' : ''} onClick={() => setForm({ ...form, method: 'cash' })}>เงินสด</button><button type="button" className={form.method === 'transfer' ? 'on' : ''} onClick={() => setForm({ ...form, method: 'transfer' })}>โอนเงิน</button></div>
          <div className="field"><label htmlFor={`fx-note-${f.id}`}>หมายเหตุ (ไม่บังคับ)</label><input id={`fx-note-${f.id}`} className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>{form.id ? 'บันทึกการแก้ไข' : 'บันทึกรายจ่าย'}</button><button type="button" className="btn btn--ghost" onClick={() => { setForm(null); setErr('') }}>ยกเลิก</button></div>
        </div>
      ) : <button type="button" className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => setForm({ date: todayISO(), desc: '', amount: null, method: 'cash', note: '' })}>＋ บันทึกรายจ่ายของกองทุนนี้</button>)}
      <div className="fundfinal" role="status" aria-label={`ยอดคงเหลือสุดท้าย ${f.name}`} style={{ borderColor: f.balance < 0 ? '#b3261e' : '#1b8a4b' }}>
        <span>ยอดคงเหลือสุดท้ายของกองทุนนี้</span>
        <b className="num" style={neg(f.balance)}>{fmtBaht(f.balance)} บาท{f.balance < 0 ? ' (ติดลบ)' : ''}</b>
      </div>
      <p className="muted small">รายจ่ายของกองทุนหักเฉพาะกองทุนนี้ ไม่เกี่ยวกับเงินหมุนเวียน · ยอดนี้ไปแสดงที่ช่องกองทุนหน้าแรก และรวมกับเงินหมุนเวียนเป็น รวมเงินสด</p>
    </>
  )
}
