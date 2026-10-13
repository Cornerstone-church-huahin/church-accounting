import { Link } from 'react-router-dom'
import DebtBanner from '../components/DebtBanner'
import { useLoans, useExpenses, useIncome, useIncomeTypes, useOpening, usePassbook, useRounds } from '../lib/data'
import { fundAccounts, withRunning } from '../lib/fundAccounts'
import { fmtBaht, fmtDate } from '../lib/money'
import { useYear } from '../lib/year'

/** หน้า "กองทุน": ยอดแต่ละกองทุนรวมเงินที่ถวายเข้ามาและเงินที่จ่ายออกจากกองทุน — ตั้งต้นกองทุนที่ ตั้งค่า › ยอดยกมา (ทำครั้งแรกครั้งเดียว) */
export default function FundAccountsPage() {
  const { year } = useYear()
  const types = useIncomeTypes()
  const opening = useOpening()
  const loans = useLoans()
  const ys = [year - 2, year - 1, year] // จำนวน hook คงที่
  const incs = ys.map((y) => useIncome(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const rds = ys.map((y) => useRounds(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const exps = ys.map((y) => useExpenses(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const pbs = ys.map((y) => usePassbook(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const rows = fundAccounts({ types: types.list.filter((t) => t.active), opening: opening.opening, income: incs.flatMap((s) => s.items), rounds: rds.flatMap((s) => s.items), expenses: exps.flatMap((s) => s.items), passbook: pbs.flatMap((s) => s.items), loans: loans.items })
  const total = rows.reduce((s, r) => s + r.balance, 0)
  return (
    <>
      <div className="page-head"><h1>💰 กองทุน</h1></div>
      <section className="card" aria-label="รวมทุกกองทุน">
        <p className="muted small" style={{ margin: 0 }}>เงินกองทุนรวมทุกกอง{opening.opening ? ` (นับจากยอดตั้งต้น ${fmtDate(opening.opening.date)})` : ''}</p>
        <p style={{ fontSize: '1.7rem', fontWeight: 700, margin: '2px 0' }}>{fmtBaht(total)} บาท</p>
        <p className="muted small" style={{ margin: 0 }}>เงินถวายกองทุนเข้าที่นี่อัตโนมัติ ไม่ปนกับรายรับ-รายจ่ายปกติ · เมื่อจ่ายเงินจากกองทุน เลือก “จ่ายจาก” ตอนบันทึกรายจ่าย</p>
      </section>
      {rows.length === 0 && <p className="empty">ยังไม่มีกองทุน — ตั้งกองทุนที่ <Link to="/settings">ตั้งค่า › ยอดยกมา</Link></p>}
      {rows.map((f) => (
        <details key={f.id} className="card fundcard">
          <summary style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}><b>{f.name}</b><b className="num" style={{ fontSize: '1.2rem' }}>{fmtBaht(f.balance)}</b></div>
            <DebtBanner loans={loans.items.filter((l) => l.borrower === f.id)} types={types.list} />
            <DebtBanner loans={loans.items.filter((l) => l.lender.kind === 'fund' && l.lender.fundId === f.id)} types={types.list} lent openingDate={opening.opening?.date} />
          </summary>
          <p className="small muted" style={{ margin: '4px 0' }}>ตั้งต้น {fmtBaht(f.opening)} + รับเข้า {fmtBaht(f.moneyIn)} − จ่ายออก {fmtBaht(f.moneyOut)}</p>
          <table className="tbl tbl--paper" aria-label={`ความเคลื่อนไหว ${f.name}`}>
            <thead><tr><th>วันที่</th><th>รายการ</th><th className="num">เข้า / ออก</th><th className="num">คงเหลือ</th></tr></thead>
            <tbody>
              {withRunning(f).map((m) => <tr key={m.key}><td>{fmtDate(m.date)}</td><td>{m.label}</td><td className="num" style={{ color: m.amount < 0 ? '#b3261e' : undefined }}>{fmtBaht(m.amount, { sign: true })}</td><td className="num">{fmtBaht(m.balance)}</td></tr>)}
              <tr><td>{opening.opening ? fmtDate(opening.opening.date) : ''}</td><td>ยอดตั้งต้น</td><td className="num">{fmtBaht(f.opening)}</td><td className="num">{fmtBaht(f.opening)}</td></tr>
            </tbody>
          </table>
          {f.moves.length === 0 && <p className="muted small">ยังไม่มีความเคลื่อนไหวหลังวันตั้งต้น</p>}
        </details>
      ))}
      <p className="muted small">ตั้งต้นกองทุน เพิ่มกองใหม่ หรือแก้ชื่อ ที่ <Link to="/settings">ตั้งค่า › ยอดยกมา</Link> — ใช้เฉพาะตอนเริ่มระบบหรือเริ่มกองทุนใหม่เท่านั้น</p>
    </>
  )
}
