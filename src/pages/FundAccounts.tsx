import { Link } from 'react-router-dom'
import DebtBanner from '../components/DebtBanner'
import { can } from '../lib/access'
import { useLoans, useExpenses, useIncome, useIncomeTypes, useOpening, usePassbook, useRounds } from '../lib/data'
import { fundAccounts } from '../lib/fundAccounts'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate } from '../lib/money'
import { useYear } from '../lib/year'

type ExpStore = ReturnType<typeof useExpenses>
type IncStore = ReturnType<typeof useIncome>
export type FundCtx = ReturnType<typeof useFundAccounts>
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
  const canIncome = can(role, 'income'), canLoan = can(role, 'statement')
  const incStoreFor = (y: number): IncStore | undefined => incs[ys.indexOf(y)]
  const allInc = incs.flatMap((s) => s.items)
  const deletedExp = exps.flatMap((s) => s.all.filter((x) => x.deleted && x.fundId))
  const deletedInc = incs.flatMap((s) => s.all.filter((x) => x.deleted && !x.roundId))
  return { rows, total, canPay, canIncome, canLoan, storeFor, incStoreFor, allExp, allInc, deletedExp, deletedInc, types, opening: opening.opening, loans: loans.items, loanStore: loans }
}

export default function FundAccountsPage() {
  const ctx = useFundAccounts()
  const { rows, total, types, opening, loans } = ctx
  return (
    <>
      <div className="page-head"><h1>💰 กองทุน</h1></div>
      <section className="card" aria-label="รวมทุกกองทุน">
        <p className="muted small" style={{ margin: 0 }}>เงินกองทุนรวมทุกกอง{opening ? ` (นับจากยอดตั้งต้น ${fmtDate(opening.date)})` : ''}</p>
        <p style={{ fontSize: '1.7rem', fontWeight: 700, margin: '2px 0', ...neg(total) }}>{fmtBaht(total)} บาท</p>
        <p className="muted small" style={{ margin: 0 }}>แต่ละกองทุนแตะเพื่อขยาย: บันทึกเงินเข้า รายจ่าย และเงินยืมของกองทุนนั้นได้เลย — แยกจากเงินหมุนเวียนโดยสิ้นเชิง · แถบแดงเตือนเงินยืม ไม่นำไปหักลบกับยอด</p>
      </section>
      {rows.length === 0 && <p className="empty">ยังไม่มีกองทุน — ตั้งกองทุนที่ <Link to="/settings">ตั้งค่า › ยอดยกมา</Link></p>}
      {rows.map((f) => (
        <details key={f.id} className="card fundcard">
          <summary style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}><b>{f.name}</b><b className="num" style={{ fontSize: '1.2rem', ...neg(f.balance) }}>{fmtBaht(f.balance)}{f.balance < 0 ? ' (ติดลบ)' : ''}</b></div>
            <DebtBanner loans={loans.filter((l) => l.borrower === f.id)} types={types.list} />
            <DebtBanner loans={loans.filter((l) => l.lender.kind === 'fund' && l.lender.fundId === f.id)} types={types.list} lent openingDate={opening?.date} />
          </summary>
          <p className="small" style={{ margin: '4px 0' }}><Link className="btn btn--gold" to={`/funds/${f.id}`}>เปิดรับ/จ่ายของกองทุนนี้ ›</Link></p>
        </details>
      ))}
      <p className="muted small">ตั้งต้นกองทุน เพิ่มกองใหม่ หรือแก้ชื่อ ที่ <Link to="/settings">ตั้งค่า › ยอดยกมา</Link> — ใช้เฉพาะตอนเริ่มระบบหรือเริ่มกองทุนใหม่เท่านั้น</p>
    </>
  )
}
