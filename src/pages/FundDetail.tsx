import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fmtBaht, fmtDate } from '../lib/money'
import { useYear } from '../lib/year'
import DebtBanner from '../components/DebtBanner'
import { isLoanMove, type FundScope } from '../lib/fundScope'
import { useFundAccounts } from './FundAccounts'
import { FundSheetPaper } from '../components/PaperSheets'
import { fundSheets } from '../lib/fundSheet'
import { useSettings } from '../lib/data'
import Pay from './Pay'
import Receive from './Receive'

/**
 * หน้ากองทุนเดียว: มีแค่ 2 ฟังก์ชัน รับ · จ่าย — ใช้หน้าตา/ใบ A4/แนบบิลชุดเดียวกับ รับ-จ่ายหน้าแรกทุกประการ
 * แต่ข้อมูลเป็นของกองทุนนี้ล้วน (ไม่ปนบัญชีหมุนเวียน) · ยอดคงเหลือกองทุนไปรวมที่ช่อง “กองทุน” หน้าแรก · ลบกองทุน = หน้านี้หาย · สร้างกองทุนใหม่ = หน้านี้ขึ้นเอง
 */
export default function FundDetailPage() {
  const { id } = useParams()
  const { year } = useYear()
  const { rows, opening, loans, types } = useFundAccounts()
  const [tab, setTab] = useState<'in' | 'out' | 'sheet'>('in')
  const { settings } = useSettings()
  const f = rows.find((r) => r.id === id)
  if (!f) return <><div className="page-head"><h1>💰 กองทุน</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div><p className="empty">ไม่พบกองทุนนี้ (อาจถูกลบหรือเปลี่ยนชื่อ)</p></>
  const fund: FundScope = {
    id: f.id, name: f.name, balance: f.balance,
    loanMoves: f.moves.filter(isLoanMove),
  }
  return (
    <>
      <div className="page-head no-print"><h1>💰 {f.name}</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div>
      <section className="card no-print" role="status" aria-label={`ยอดคงเหลือ กองทุน ${f.name}`}>
        <p className="muted small" style={{ margin: 0 }}>เงินคงเหลือของกองทุนนี้</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: '2px 0', color: f.balance < 0 ? '#b3261e' : undefined }}>{fmtBaht(f.balance)} บาท{f.balance < 0 ? ' (ติดลบ)' : ''}</p>
        <p className="muted small" style={{ margin: 0 }}>ตั้งต้น {fmtBaht(f.opening)}{opening ? ` (${fmtDate(opening.date)})` : ''} + เข้า {fmtBaht(f.moneyIn)} − ออก {fmtBaht(f.moneyOut)} = <b>{fmtBaht(f.balance)}</b></p>
      </section>
      <DebtBanner loans={loans.filter((l) => l.borrower === f.id)} types={types.list} />
      <DebtBanner lent loans={loans.filter((l) => l.lender.kind === 'fund' && l.lender.fundId === f.id)} types={types.list} />
      <div className="home-tabs home-tabs--mini no-print" role="tablist" aria-label="กองทุนนี้: รับ จ่าย ใบกองทุน" style={{ margin: '6px 0', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button type="button" role="tab" aria-selected={tab === 'in'} className={`home-tab home-tab--in${tab === 'in' ? ' on' : ''}`} onClick={() => setTab('in')}><i className="hn">1</i><span>💚 รับ</span></button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={`home-tab home-tab--out${tab === 'out' ? ' on' : ''}`} onClick={() => setTab('out')}><i className="hn">2</i><span>🔴 จ่าย</span></button>
        <button type="button" role="tab" aria-selected={tab === 'sheet'} className={`home-tab home-tab--sum${tab === 'sheet' ? ' on' : ''}`} onClick={() => setTab('sheet')}><i className="hn">3</i><span>📄 ใบกองทุน</span></button>
      </div>
      <div className="fullmode">
        {tab === 'sheet' ? <FundSheetPaper church={settings.churchName.split(' ')[0]} fundName={f.name} sheets={fundSheets(f)} /> : tab === 'in' ? <Receive key={`${year}-${f.id}-in`} year={year} fund={fund} /> : <Pay key={`${year}-${f.id}-out`} year={year} fund={fund} />}
      </div>
    </>
  )
}
