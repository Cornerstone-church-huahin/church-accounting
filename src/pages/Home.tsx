import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fmtBaht, fmtDate } from '../lib/money'
import { useLoans } from '../lib/data'
import { summarizeLoans } from '../lib/loans'
import { useBalances } from '../lib/useBalances'
import { incomeBeforeCutoff } from '../lib/balances'
import { useOpening } from '../lib/data'
import { can } from '../lib/access'
import { useRole } from '../lib/members'
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
  { k: 'sum', n: 4, icon: '📊', name: 'สรุป', sub: 'สรุปและรายงาน' },
]

/** หน้าแรก 2 ส่วน: (1) ช่องเงินคริสตจักร 6 ช่อง (2) ปุ่มขั้นตอน 2×2 — กดขั้นตอนแล้วเปิดเต็มจอ (ซ่อนส่วนบน) เพื่อเห็นใบทันทีไม่ต้องเลื่อน · ‹ หน้าแรก กลับหน้าแรก */
export default function Home() {
  const { year } = useYear()
  const [tab, setTab] = useState<Tab>(null)
  const { balances: b, input, opening } = useBalances(year)
  const op = useOpening()
  const role = useRole()
  const skipped = incomeBeforeCutoff(input, opening)
  const [pick, setPick] = useState<number[]>([]) // รายการก่อนวันตัดยอดที่ผู้ใช้ติ๊กเลือกให้เป็นยอดยกมา (เริ่มต้นไม่เลือกอะไร)
  const DISMISS = 'acct.cutoff.dismissed'
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISS) } catch { return null } })
  const pickSum = pick.reduce((a, i) => a + (skipped.items[i]?.amount ?? 0), 0)
  const ls = summarizeLoans(useLoans().items)
  const full = tab !== null
  const inMeeting = useLocation().pathname.startsWith('/meeting') // ในห้องทำงานเองไม่ต้องมีปุ่มกลับเข้าห้องทำงาน
  return (
    <div className={inMeeting ? 'home--work' : undefined}>
      {!full && (
        <>
          {!inMeeting && <div className="page-head no-print"><h1>บัญชีคริสตจักรศิลาเอก</h1></div>}
          {!inMeeting && <Link to="/meeting" className="worknav no-print"><span aria-hidden="true">🧑‍🤝‍🧑</span><span className="grow"><b>ห้องทำงาน</b><br /><small>ตารางงาน · บันทึกโน้ต · งานเลขา · ทะเบียน · เหรัญญิก</small></span><span aria-hidden="true">›</span></Link>}
          {can(role, 'detail') && <>
          <p className="home-label no-print">เงินคริสตจักร ณ วันนี้ <span>(แตะดูรายละเอียด)</span></p>
          <nav className="balance-tiles no-print" aria-label="เงินคริสตจักร: หมุนเวียน กองทุน รวม">
            <Link to="/balance/own" className="btile btile--own"><small>🏠 หมุนเวียน</small><b>{fmtBaht(b.own.balance, { dec: false })}</b></Link>
            <Link to="/balance/fund" className="btile btile--fund"><small>💰 กองทุน</small><b>{fmtBaht(b.fundTotal, { dec: false })}</b></Link>
            <Link to="/balance/total" className="btile btile--total"><small>🧮 รวมเงินสด</small><b>{fmtBaht(b.total, { dec: false })}</b></Link>
            <Link to="/balance/indebt" className="btile btile--indebt"><small>🔁 หนี้ภายใน</small><b>{fmtBaht(ls.fromFunds, { dec: false })}</b></Link>
            <Link to="/balance/debt" className="btile btile--debt"><small>🧾 หนี้ภายนอก</small><b>{fmtBaht(ls.external, { dec: false })}</b></Link>
            <Link to="/land" className="btile btile--land"><small>🏞️ ภาระที่ดิน</small><b>6,000,000</b></Link>
          </nav>
          </>}
          {skipped.count > 0 && dismissed !== String(skipped.total) && (
            <div className="card no-print" role="alert" style={{ margin: '8px 0', borderColor: '#c0392b' }}>
              <p className="small" style={{ margin: 0 }}>⚠️ มีรายรับเงินหมุนเวียน <b>{skipped.count} รายการ รวม {fmtBaht(skipped.total)} บาท</b> ลงวันที่ก่อนวันตัดยอดยกมา ({opening ? fmtDate(opening.date) : ''}) จึง<b>ไม่ถูกนับ</b>ในช่อง “หมุนเวียน” (ระบบถือว่าอยู่ในยอดยกมาแล้ว แต่ยอดยกมาเงินหมุนเวียนตอนนี้คือ {fmtBaht(b.own.opening)})</p>
              <p className="small" style={{ margin: '6px 0 2px' }}>ติ๊กรายการที่เป็นเงินตั้งต้นจริง ๆ (ไม่ติ๊ก = ไม่ถูกนับ ไม่เปลี่ยนยอดใด ๆ):</p>
              <div className="small" role="group" aria-label="รายการก่อนวันตัดยอด">{skipped.items.map((x, i) => <label key={i} className="row" style={{ gap: 6, alignItems: 'center' }}><input type="checkbox" checked={pick.includes(i)} onChange={(e) => setPick(e.target.checked ? [...pick, i] : pick.filter((k) => k !== i))} /><span className="grow">{fmtDate(x.date)} · {x.label}</span><b className="num">{fmtBaht(x.amount)}</b></label>)}</div>
              {opening && can(role, 'settings') && <button type="button" className="btn btn--gold" style={{ marginTop: 6 }} disabled={pickSum <= 0} onClick={() => { if (confirm(`เพิ่ม ${fmtBaht(pickSum)} บาท เข้ายอดยกมาเงินหมุนเวียน?\n(ยอดยกมาจะเป็น ${fmtBaht((opening.own ?? 0) + pickSum)} บาท · แก้กลับได้ที่ ตั้งค่า › ยอดยกมา)`)) { op.save({ ...opening, own: (opening.own ?? 0) + pickSum }); setPick([]) } }}>ใช้ที่เลือกเป็นยอดยกมาเงินหมุนเวียน (+{fmtBaht(pickSum)})</button>}
              <button type="button" className="mini" style={{ marginTop: 6 }} onClick={() => { try { localStorage.setItem(DISMISS, String(skipped.total)) } catch { /* ignore */ } setDismissed(String(skipped.total)) }}>ไม่ต้องเตือนยอดนี้อีก</button>
              <p className="muted small" style={{ margin: '6px 0 0' }}>หรือแก้วันที่ของรายการนั้นให้เป็นวันหลังวันตัดยอด · หรือแก้ยอดยกมาเองที่ ตั้งค่า › ยอดยกมา</p>
            </div>
          )}
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
    </div>
  )
}
