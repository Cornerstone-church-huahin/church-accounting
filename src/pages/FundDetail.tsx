import { Link, useParams } from 'react-router-dom'
import DebtBanner from '../components/DebtBanner'
import { fmtBaht } from '../lib/money'
import { FundBody, useFundAccounts } from './FundAccounts'

/** หน้ากองทุนเดียว: รายรับ/ยืมมา → บันทึกรายจ่ายต่อได้ทันที → ยอดคงเหลือสุดท้าย (ติดลบหรือเหลือเท่าไร) */
export default function FundDetailPage() {
  const { id } = useParams()
  const ctx = useFundAccounts()
  const { rows, types, opening, loans } = ctx
  const f = rows.find((r) => r.id === id)
  if (!f) return <><div className="page-head"><h1>💰 กองทุน</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div><p className="empty">ไม่พบกองทุนนี้ (อาจถูกลบหรือเปลี่ยนชื่อ)</p></>
  return (
    <>
      <div className="page-head"><h1>💰 {f.name}</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div>
      <section className="card" aria-label={`กองทุน ${f.name}`}>
        <p className="muted small" style={{ margin: 0 }}>เงินคงเหลือ</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: '2px 0', color: f.balance < 0 ? '#b3261e' : undefined }}>{fmtBaht(f.balance)} บาท{f.balance < 0 ? ' (ติดลบ)' : ''}</p>
        <DebtBanner loans={loans.filter((l) => l.borrower === f.id)} types={types.list} />
        <DebtBanner loans={loans.filter((l) => l.lender.kind === 'fund' && l.lender.fundId === f.id)} types={types.list} lent openingDate={opening?.date} />
        <FundBody f={f} ctx={ctx} />
      </section>
    </>
  )
}
