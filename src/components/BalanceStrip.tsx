import { Link } from 'react-router-dom'
import { can } from '../lib/access'
import { useLoans } from '../lib/data'
import { summarizeLoans } from '../lib/loans'
import { useRole } from '../lib/members'
import { fmtBaht } from '../lib/money'
import { useBalances } from '../lib/useBalances'
import { useYear } from '../lib/year'

/** แถบเงินคริสตจักร ณ วันนี้ 6 ช่อง (หมุนเวียน กองทุน รวมเงินสด หนี้ภายใน หนี้ภายนอก ภาระที่ดิน) — แตะเปิดรายละเอียด · เห็นเฉพาะผู้มีสิทธิ์ดูรายละเอียด */
export default function BalanceStrip({ compact }: { compact?: boolean }) {
  const { year } = useYear()
  const role = useRole()
  const { balances: b } = useBalances(year)
  const ls = summarizeLoans(useLoans().items)
  if (!can(role, 'detail')) return null
  return (
    <nav className={`balance-tiles no-print${compact ? ' balance-tiles--strip' : ''}`} aria-label="เงินคริสตจักร: หมุนเวียน กองทุน รวม">
      <Link to="/balance/own" className="btile btile--own"><small>🏠 หมุนเวียน</small><b>{fmtBaht(b.own.balance, { dec: false })}</b></Link>
      <Link to="/balance/fund" className="btile btile--fund"><small>💰 กองทุน</small><b>{fmtBaht(b.fundTotal, { dec: false })}</b></Link>
      <Link to="/balance/total" className="btile btile--total"><small>🧮 รวมเงินสด</small><b>{fmtBaht(b.total, { dec: false })}</b></Link>
      <Link to="/balance/indebt" className="btile btile--indebt"><small>🔁 หนี้ภายใน</small><b>{fmtBaht(ls.fromFunds, { dec: false })}</b></Link>
      <Link to="/balance/debt" className="btile btile--debt"><small>🧾 หนี้ภายนอก</small><b>{fmtBaht(ls.external, { dec: false })}</b></Link>
      <Link to="/land" className="btile btile--land"><small>🏞️ ภาระที่ดิน</small><b>6,000,000</b></Link>
    </nav>
  )
}
