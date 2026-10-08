import { Link } from 'react-router-dom'
import NoAccess from '../components/NoAccess'
import { can } from '../lib/access'
import { useIncomeTypes, useRounds } from '../lib/data'
import { roundTotal } from '../lib/ledger'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, sundaysOf, todayISO, yearOf } from '../lib/money'
import { useYear } from '../lib/year'

export function RoundTabs({ on }: { on: 'rounds' | 'statement' }) {
  return (
    <nav className="seg no-print" aria-label="ส่วนของรอบอาทิตย์">
      <Link to="/rounds" aria-current={on === 'rounds' ? 'page' : undefined}>นับเงิน · นำฝาก</Link>
      <Link to="/rounds/statement" aria-current={on === 'statement' ? 'page' : undefined}>เทียบสเตตเมนต์</Link>
    </nav>
  )
}

export default function Rounds() {
  const role = useRole()
  const { year } = useYear()
  if (!can(role, 'detail')) return <NoAccess />
  return <RoundList key={year} year={year} />
}

function RoundList({ year }: { year: number }) {
  const rounds = useRounds(year)
  const types = useIncomeTypes()
  const today = todayISO()
  // อาทิตย์ที่ผ่านมาแล้ว (หรือวันนี้) ของปีนั้น เรียงล่าสุดก่อน · แสดง 12 ครั้งล่าสุด + รอบที่มีข้อมูลทั้งหมด
  const sundays = sundaysOf(year).filter((d) => d <= today).reverse()
  const byDate = new Map(rounds.items.map((r) => [r.date, r]))
  const extra = rounds.items.filter((r) => !sundays.includes(r.date)).map((r) => r.date)
  const dates = [...new Set([...sundays, ...extra])].sort().reverse()
  const nextSunday = yearOf(today) === year ? sundaysOf(year).find((d) => d >= today) : undefined
  const waiting = rounds.items.filter((r) => r.status === 'counting').length
  const undeposited = rounds.items.filter((r) => r.status === 'verified' && !r.deposit).length
  return (
    <>
      <div className="page-head"><h1>รอบอาทิตย์</h1></div>
      <RoundTabs on="rounds" />
      {(waiting > 0 || undeposited > 0) && (
        <div className="note" role="status">
          {waiting > 0 && <div>⏳ รอผู้นับคนที่ 2 ยืนยัน {waiting} รอบ</div>}
          {undeposited > 0 && <div>🏦 ยืนยันยอดแล้วแต่ยังไม่บันทึกการนำฝาก {undeposited} รอบ</div>}
        </div>
      )}
      <section className="card">
        <ul className="list">
          {nextSunday && !byDate.has(nextSunday) && nextSunday !== today && (
            <li><Link className="item" to={`/rounds/${nextSunday}`}><span className="grow"><b>{fmtDate(nextSunday)}</b> <span className="badge">ที่จะถึง</span></span><span aria-hidden>›</span></Link></li>
          )}
          {dates.slice(0, 60).map((d) => {
            const r = byDate.get(d)
            const label = !r ? <span className="badge">ยังไม่ได้นับ</span>
              : r.status === 'counting' ? <span className="badge badge--gold">รอยืนยัน</span>
              : !r.deposit ? <span className="badge badge--gold">รอนำฝาก</span> : <span className="badge badge--good">ฝากแล้ว</span>
            return (
              <li key={d}>
                <Link className="item" to={`/rounds/${d}`}>
                  <span className="grow"><b>{fmtDate(d)}</b><br /><span className="small muted">{r ? `${Object.keys(r.lines).filter((k) => r.lines[k] > 0).map((k) => types.byId(k)?.name).filter(Boolean).slice(0, 3).join(', ')}` : ''}</span></span>
                  <span className="num">{r ? <b>{fmtBaht(roundTotal(r))}</b> : ''}</span>
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
        {dates.length === 0 && <p className="empty">ยังไม่มีวันอาทิตย์ในปีนี้ที่ผ่านมาแล้ว</p>}
      </section>
    </>
  )
}
