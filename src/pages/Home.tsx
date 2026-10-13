import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtBaht } from '../lib/money'
import { useLoans } from '../lib/data'
import { summarizeLoans } from '../lib/loans'
import { useBalances } from '../lib/useBalances'
import { useYear } from '../lib/year'
import Receive from './Receive'
import Summary from './Summary'
import Pay from './Pay'
import Adjust from './Adjust'

type Tab = 'in' | 'out' | 'adj' | 'sum' | null

/** หน้าแรก: ชื่อ + แท็บ รับ / จ่าย — กดแล้วมีหน้าใหม่ปรากฏด้านล่าง (เนื้อหาจะเพิ่มทีละส่วน) */
export default function Home() {
  const { year } = useYear()
  const [tab, setTab] = useState<Tab>(null)
  const { balances: b } = useBalances(year)
  const debt = summarizeLoans(useLoans().items).external
  return (
    <>
      <div className="page-head no-print"><h1>บัญชีคริสตจักรศิลาเอก</h1></div>
      <p className="home-label no-print">เงินคริสตจักร ณ วันนี้ <span>(แตะดูรายละเอียด)</span></p>
      <nav className="balance-tiles no-print" aria-label="เงินคริสตจักร: หมุนเวียน กองทุน รวม">
        <Link to="/balance/own" className="btile btile--own"><small>🏠 หมุนเวียน</small><b>{fmtBaht(b.own.balance, { dec: false })}</b></Link>
        <Link to="/balance/fund" className="btile btile--fund"><small>💰 กองทุน</small><b>{fmtBaht(b.fundTotal, { dec: false })}</b></Link>
        <Link to="/balance/total" className="btile btile--total"><small>🧮 รวม</small><b>{fmtBaht(b.total, { dec: false })}</b></Link>
        <Link to="/balance/debt" className="btile btile--debt"><small>🧾 หนี้สินภายนอก</small><b>{fmtBaht(debt, { dec: false })}</b></Link>
      </nav>
      <p className="home-label home-label--steps no-print">ขั้นตอนทำบัญชีประจำสัปดาห์</p>
      <div className="home-tabs no-print" role="tablist" aria-label="ขั้นตอน: รับ จ่าย ปรับ สรุป">
        <button type="button" role="tab" aria-selected={tab === 'in'} className={`home-tab home-tab--in${tab === 'in' ? ' on' : ''}`} onClick={() => setTab('in')}><i className="hn">1</i><span>💚 รับ</span></button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={`home-tab home-tab--out${tab === 'out' ? ' on' : ''}`} onClick={() => setTab('out')}><i className="hn">2</i><span>🔴 จ่าย</span></button>
        <button type="button" role="tab" aria-selected={tab === 'adj'} className={`home-tab home-tab--adj${tab === 'adj' ? ' on' : ''}`} onClick={() => setTab('adj')}><i className="hn">3</i><span>🏦 ปรับ</span></button>
        <button type="button" role="tab" aria-selected={tab === 'sum'} className={`home-tab home-tab--sum${tab === 'sum' ? ' on' : ''}`} onClick={() => setTab('sum')}><i className="hn">4</i><span>📊 สรุป</span></button>
      </div>
      {tab === 'in' && <Receive key={year} year={year} />}
      {tab === 'adj' && <Adjust key={year} year={year} />}
      {tab === 'sum' && <Summary key={year} year={year} />}
      {tab === 'out' && <Pay key={year} year={year} />}
    </>
  )
}
