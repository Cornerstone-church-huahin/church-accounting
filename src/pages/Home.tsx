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
const STEPS: { k: Exclude<Tab, null>; n: number; icon: string; name: string; sub: string }[] = [
  { k: 'in', n: 1, icon: '💚', name: 'รับ', sub: 'ใบบันทึกการถวาย' },
  { k: 'out', n: 2, icon: '🔴', name: 'จ่าย', sub: 'ใบเบิก-จ่ายเงินสด' },
  { k: 'adj', n: 3, icon: '🏦', name: 'ปรับ', sub: 'ตรวจกับสมุดบัญชี' },
  { k: 'sum', n: 4, icon: '📊', name: 'สรุป', sub: 'ใบสรุปรายสัปดาห์' },
]

/** หน้าแรก 2 ส่วน: (1) ช่องเงินคริสตจักร 6 ช่อง (2) ปุ่มขั้นตอน 2×2 — กดขั้นตอนแล้วเปิดเต็มจอ (ซ่อนส่วนบน) เพื่อเห็นใบทันทีไม่ต้องเลื่อน · ‹ หน้าแรก กลับหน้าแรก */
export default function Home() {
  const { year } = useYear()
  const [tab, setTab] = useState<Tab>(null)
  const { balances: b } = useBalances(year)
  const ls = summarizeLoans(useLoans().items)
  const full = tab !== null
  return (
    <>
      {!full && (
        <>
          <div className="page-head no-print"><h1>บัญชีคริสตจักรศิลาเอก</h1></div>
          <p className="home-label no-print">เงินคริสตจักร ณ วันนี้ <span>(แตะดูรายละเอียด)</span></p>
          <nav className="balance-tiles no-print" aria-label="เงินคริสตจักร: หมุนเวียน กองทุน รวม">
            <Link to="/balance/own" className="btile btile--own"><small>🏠 หมุนเวียน</small><b>{fmtBaht(b.own.balance, { dec: false })}</b></Link>
            <Link to="/balance/fund" className="btile btile--fund"><small>💰 กองทุน</small><b>{fmtBaht(b.fundTotal, { dec: false })}</b></Link>
            <Link to="/balance/total" className="btile btile--total"><small>🧮 รวมเงินสด</small><b>{fmtBaht(b.total, { dec: false })}</b></Link>
            <Link to="/balance/indebt" className="btile btile--indebt"><small>🔁 หนี้ภายใน</small><b>{fmtBaht(ls.fromFunds, { dec: false })}</b></Link>
            <Link to="/balance/debt" className="btile btile--debt"><small>🧾 หนี้ภายนอก</small><b>{fmtBaht(ls.external, { dec: false })}</b></Link>
            <Link to="/balance/spare" className="btile btile--spare"><small>⬜ ไอคอน</small><b>—</b></Link>
          </nav>
          <p className="home-label home-label--steps no-print">ขั้นตอนทำบัญชีประจำสัปดาห์ <span>(แตะเพื่อเปิดเต็มจอ)</span></p>
          <div className="stepgrid no-print" role="tablist" aria-label="ขั้นตอน: รับ จ่าย ปรับ สรุป">
            {STEPS.map((x) => (
              <button key={x.k} type="button" role="tab" aria-selected={false} className={`stepbtn stepbtn--${x.k}`} onClick={() => setTab(x.k)}>
                <span className="stepbtn__top"><i className="hn">{x.n}</i><span>{x.icon} {x.name}</span></span>
                <small>{x.sub}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {full && (
        <div className="fullbar no-print">
          <button type="button" className="fullbar__back" onClick={() => setTab(null)} aria-label="กลับหน้าแรก">‹ หน้าแรก</button>
          <div className="home-tabs home-tabs--mini" role="tablist" aria-label="ขั้นตอน: รับ จ่าย ปรับ สรุป">
            {STEPS.map((x) => <button key={x.k} type="button" role="tab" aria-selected={tab === x.k} className={`home-tab home-tab--${x.k}${tab === x.k ? ' on' : ''}`} onClick={() => setTab(x.k)}><i className="hn">{x.n}</i><span>{x.icon} {x.name}</span></button>)}
          </div>
        </div>
      )}
      <div className={full ? 'fullmode' : undefined}>
      {tab === 'in' && <Receive key={year} year={year} />}
      {tab === 'adj' && <Adjust key={year} year={year} />}
      {tab === 'sum' && <Summary key={year} year={year} />}
      {tab === 'out' && <Pay key={year} year={year} />}
      </div>
    </>
  )
}
