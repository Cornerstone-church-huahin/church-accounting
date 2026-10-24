import { useMemo, useState } from 'react'
import MoneyInput from './MoneyInput'
import { advanceGroups, buildAdvance, checkAdvance, debtTotal, undoAdvance } from '../lib/advancePay'
import { fmtBaht, fmtDate, newId, todayISO, yearOf } from '../lib/money'
import { loanBalance } from '../lib/loans'
import type { ExpenseEntry, IncomeType, Loan } from '../lib/types'

type LoanStore = { items: Loan[]; put: (x: Loan[]) => boolean; remove: (id: string) => boolean }
type ExpStore = { items: ExpenseEntry[]; put: (x: ExpenseEntry[]) => boolean; remove: (id: string) => boolean }

/**
 * จ่ายสวัสดิการผ่านเงินยืม: กองทุน S (เช่น ผู้รับใช้) ถูกกองทุน R (เช่น ห้องพัก) ยืมเงินไปหมด แต่ต้องจ่ายตามวัตถุประสงค์
 * → R ยืมเงินหมุนเวียนมาจ่ายแทน ถือเป็นการคืนหนี้ให้ S · ทำ 3 รายการพร้อมกัน ยกเลิกทั้งชุดได้
 */
export default function AdvancePay({ loans, expenses, types, year, ownBalance, canWrite }: { loans: LoanStore; expenses: ExpStore; types: IncomeType[]; year: number; ownBalance: number; canWrite: boolean }) {
  const name = (id?: string) => types.find((t) => t.id === id)?.name ?? '(กองทุนที่ถูกลบ)'
  // กองทุนที่ถูกยืมไปและยังมีหนี้ค้าง
  const lenders = useMemo(() => [...new Set(loans.items.filter((l) => !l.deleted && l.lender.kind === 'fund' && loanBalance(l) > 0 && l.borrower && l.borrower !== 'own').map((l) => l.lender.fundId ?? ''))].filter(Boolean), [loans.items])
  const [open, setOpen] = useState(false)
  const [fundId, setFundId] = useState('')
  const [borrowerId, setBorrowerId] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')
  const sid = fundId || lenders[0] || ''
  const borrowers = [...new Set(loans.items.filter((l) => !l.deleted && l.lender.kind === 'fund' && l.lender.fundId === sid && loanBalance(l) > 0 && l.borrower && l.borrower !== 'own').map((l) => l.borrower as string))]
  const rid = borrowerId && borrowers.includes(borrowerId) ? borrowerId : borrowers[0] ?? ''
  const owed = debtTotal(loans.items, sid, rid)
  const groups = advanceGroups(loans.items)
  const sn = name(sid), rn = name(rid)
  const amt = amount ?? 0
  const save = () => {
    const input = { fundId: sid, borrowerId: rid, amount: amt, date, desc: desc || `สวัสดิการ${sn.replace(/^กองทุน-?/, '')}`, group: newId('adv') }
    const e = checkAdvance(loans.items, input) || (yearOf(date) !== year ? `วันที่ต้องอยู่ในปี ${year + 543} (เปลี่ยนปีบัญชีที่มุมขวาบนก่อน)` : '')
    if (e) return setErr(e)
    const plan = buildAdvance(loans.items, input, sn, rn)
    if (!loans.put([plan.newLoan, ...plan.updated])) return setErr('สิทธิ์ของท่านบันทึกเงินยืมไม่ได้')
    if (!expenses.put([plan.expense])) {
      const u = undoAdvance([...loans.items.filter((l) => !plan.updated.some((x) => x.id === l.id)), ...plan.updated, plan.newLoan], input.group)
      loans.put(u.put); u.removeLoanIds.forEach((id) => loans.remove(id))
      return setErr('สิทธิ์ของท่านบันทึกรายจ่ายไม่ได้ (ยกเลิกชุดนี้ให้แล้ว) — ต้องมีสิทธิ์จ่ายเงินด้วย')
    }
    setOpen(false); setErr(''); setAmount(null); setDesc('')
  }
  const undo = (group: string) => {
    if (!confirm('ยกเลิกทั้งชุด? (ลบเงินยืมหมุนเวียน · เอาการคืนหนี้ออก · ลบรายจ่ายของกองทุน)')) return
    const u = undoAdvance(loans.items, group)
    if (u.put.length) loans.put(u.put)
    u.removeLoanIds.forEach((id) => loans.remove(id))
    expenses.remove(u.removeExpenseId)
  }
  if (!canWrite && groups.length === 0) return null
  return (
    <section className="card" aria-label="จ่ายสวัสดิการผ่านเงินยืม">
      <h3 style={{ margin: 0 }}>🧾 จ่ายสวัสดิการผ่านเงินยืมหมุนเวียน</h3>
      <p className="muted small" style={{ margin: 0 }}>ใช้เมื่อกองทุนหนึ่งถูกกองทุนอื่นยืมเงินไปหมดแล้ว แต่ยังต้องจ่ายตามวัตถุประสงค์ (เช่น สวัสดิการผู้รับใช้) — กองทุนที่ยืมจะยืมเงินหมุนเวียนมาจ่ายแทน และนับเป็นการคืนหนี้ให้กองทุนนั้น</p>
      {groups.map((g) => (
        <div key={g.id} className="pbdraft">
          <div><b>{fmtBaht(g.principal)}</b> · {g.purpose} <span className="muted small">({fmtDate(g.date)})</span></div>
          <div className="small">{name(g.borrower)} ยืมเงินหมุนเวียน · <b className={loanBalance(g) > 0 ? 'err' : 'ok'}>{loanBalance(g) > 0 ? `ค้างคืนเงินหมุนเวียน ${fmtBaht(loanBalance(g))}` : 'คืนเงินหมุนเวียนครบแล้ว ✓'}</b></div>
          {canWrite && <button type="button" className="mini" onClick={() => undo(g.group!)}>ยกเลิกทั้งชุด</button>}
        </div>
      ))}
      {canWrite && (open ? (
        lenders.length === 0 ? <p className="muted small">ยังไม่มีกองทุนที่ถูกยืมเงินไปและมียอดค้างคืน — บันทึกเงินยืมระหว่างกองทุนก่อน</p> : (
          <div className="pbdraft">
            <div className="field"><label htmlFor="ap-fund">กองทุนที่ต้องจ่าย (ถูกยืมเงินไป)</label>
              <select id="ap-fund" className="input" value={sid} onChange={(e) => { setFundId(e.target.value); setBorrowerId('') }}>{lenders.map((id) => <option key={id} value={id}>{name(id)}</option>)}</select></div>
            <div className="field"><label htmlFor="ap-borrower">ผู้ที่ต้องคืนกองทุนนี้ (ยืมเงินไป)</label>
              <select id="ap-borrower" className="input" value={rid} onChange={(e) => setBorrowerId(e.target.value)}>{borrowers.map((id) => <option key={id} value={id}>{name(id)} · ค้าง {fmtBaht(debtTotal(loans.items, sid, id))}</option>)}</select></div>
            <div className="grid2">
              <div className="field"><label htmlFor="ap-date">วันที่จ่าย</label><input id="ap-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="field"><label>จำนวนเงิน</label><MoneyInput value={amount} onChange={setAmount} /></div>
            </div>
            <div className="field"><label htmlFor="ap-desc">จ่ายเรื่อง</label><input id="ap-desc" className="input" value={desc} placeholder={`เช่น สวัสดิการผู้รับใช้ เดือน ต.ค.`} onChange={(e) => setDesc(e.target.value)} /></div>
            {amt > 0 && rid && (
              <ol className="small" aria-label="ตัวอย่างรายการที่จะบันทึก" style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>เงินหมุนเวียนให้ {rn} ยืม <b>{fmtBaht(amt)}</b> (เงินหมุนเวียนเหลือ {fmtBaht(ownBalance - amt)})</li>
                <li>{rn} คืนหนี้ {sn} <b>{fmtBaht(amt)}</b> (ค้างคืน {sn} เหลือ {fmtBaht(Math.max(0, owed - amt))})</li>
                <li>{sn} จ่าย “{desc || '…'}” <b>{fmtBaht(amt)}</b> (ยอดสุทธิของ {sn} ไม่เปลี่ยน)</li>
              </ol>
            )}
            {amt > ownBalance && <p className="error small" role="alert" style={{ margin: 0 }}>⚠️ เงินหมุนเวียนมี {fmtBaht(ownBalance)} ไม่พอให้ยืม {fmtBaht(amt)}</p>}
            {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
            <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>ยืนยัน 3 รายการ</button><button type="button" className="btn btn--ghost" onClick={() => { setOpen(false); setErr('') }}>ยกเลิก</button></div>
          </div>
        )
      ) : <button type="button" className="btn btn--ghost" onClick={() => { setOpen(true); setErr('') }}>＋ จ่ายสวัสดิการผ่านเงินยืม</button>)}
    </section>
  )
}
