import { Link } from 'react-router-dom'
import { can, isSolo, ROLE_LABEL, whoAmI } from '../lib/access'
import { useBudgetAdjs, useBudgetLines, useIncome, useRounds, useSettings, useStatementLines, useVouchers } from '../lib/data'
import { budgetRows, roundTotal, tasksFor, weekTransfers } from '../lib/ledger'
import { useRole } from '../lib/members'
import { be, fmtBaht, fmtDate, fmtDateLong, inRange, monthName, monthOf, sundaysOf, todayISO, yearOf } from '../lib/money'
import { getSync } from '../lib/sync'
import { useYear } from '../lib/year'

export default function Home() {
  const { year } = useYear()
  return <Dashboard key={year} year={year} />
}

function Dashboard({ year }: { year: number }) {
  const role = useRole()
  const { settings } = useSettings()
  const income = useIncome(year)
  const vouchers = useVouchers(year)
  const rounds = useRounds(year)
  const lines = useBudgetLines(year)
  const adjs = useBudgetAdjs(year)
  const stmt = useStatementLines(year)
  const detail = can(role, 'detail')
  const today = todayISO()
  const thisYear = yearOf(today) === year
  const month = thisYear ? monthOf(today) : 12
  const sum = (xs: { date: string; amount: number }[], from: string, to: string) => xs.filter((x) => inRange(x.date, from, to)).reduce((s, x) => s + x.amount, 0)
  const mFrom = `${year}-${String(month).padStart(2, '0')}-01`, mTo = `${year}-${String(month).padStart(2, '0')}-31`
  const inMonth = sum(income.items, mFrom, mTo)
  const inYear = sum(income.items, `${year}-01-01`, `${year}-12-31`)
  const paidYear = vouchers.items.filter((v) => v.status === 'paid').reduce((s, v) => s + v.amount, 0)
  const rows = budgetRows(lines.items, adjs.items, vouchers.items)
  const budget = rows.reduce((s, r) => s + r.current, 0)
  const spent = rows.reduce((s, r) => s + r.spent, 0)
  const tasks = tasksFor(role, whoAmI().id, vouchers.items, settings.twoStepOver, isSolo())
  const lastSunday = sundaysOf(year).filter((d) => d <= today).pop()
  const round = rounds.items.find((r) => r.date === lastSunday)
  const waiting = rounds.items.filter((r) => r.status === 'counting').length
  const undeposited = rounds.items.filter((r) => r.status === 'verified' && !r.deposit).length
  const unmatched = stmt.items.filter((l) => !l.match).length
  const sync = income.sync

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{settings.churchName}</h1>
          <p className="muted small">ปีบัญชี {be(year)} · {getSync() ? `${whoAmI().name} (${role === 'pending' ? 'รออนุมัติ' : ROLE_LABEL[role]})` : 'โหมดทดลองในเครื่องนี้ — ยังไม่เชื่อมออนไลน์'}</p>
        </div>
      </div>
      {!getSync() && <Link to="/settings" className="note" style={{ textDecoration: 'none' }}>☁️ ข้อมูลตอนนี้อยู่ในเครื่องนี้เท่านั้น · กดเพื่อเชื่อมออนไลน์ให้ทุกคนเห็นข้อมูลชุดเดียวกัน</Link>}
      {sync.state === 'error' && <p className="note" role="alert">⚠️ ซิงก์ไม่สำเร็จ: {sync.message}</p>}

      <div className="kpi">
        <div><span>รายรับเดือน{monthName(month)}</span><b>{fmtBaht(inMonth, { dec: false })}</b></div>
        <div><span>รายรับทั้งปี</span><b>{fmtBaht(inYear, { dec: false })}</b></div>
        <div><span>จ่ายแล้วทั้งปี</span><b>{fmtBaht(paidYear, { dec: false })}</b></div>
      </div>

      <section className="card" aria-labelledby="h-bud">
        <div className="row row--between"><h2 id="h-bud">งบประมาณปีนี้</h2><Link to="/budget" className="mini">ดูรายหมวด ›</Link></div>
        {budget > 0 ? (
          <>
            <div className={`progress ${spent > budget ? 'over' : ''}`} role="img" aria-label={`ใช้แล้ว ${Math.round((spent / budget) * 100)}%`}><i style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} /></div>
            <p className="small">จ่ายแล้ว <b>{fmtBaht(spent, { dec: false })}</b> จากงบ <b>{fmtBaht(budget, { dec: false })}</b> ({Math.round((spent / budget) * 100)}%)</p>
          </>
        ) : <p className="muted small">ยังไม่ได้ตั้งงบประมาณปี {be(year)}</p>}
      </section>

      {detail && (
        <>
          <section className="card" aria-labelledby="h-sun">
            <h2 id="h-sun">รอบอาทิตย์ล่าสุด</h2>
            {lastSunday ? (
              <Link className="item" to={`/rounds/${lastSunday}`} style={{ textDecoration: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="grow"><b>{fmtDateLong(lastSunday)}</b><br /><span className="small muted">{!round ? 'ยังไม่ได้บันทึกยอดนับ' : round.status === 'counting' ? 'รอผู้นับคนที่ 2 ยืนยัน' : !round.deposit ? 'ยืนยันแล้ว รอนำฝาก' : 'ฝากธนาคารแล้ว'}</span></span>
                <b className="num">{round ? fmtBaht(roundTotal(round) + weekTransfers(income.items, lastSunday).total) : '＋ นับเงิน'}</b>
              </Link>
            ) : <p className="muted small">ยังไม่มีวันอาทิตย์ในปีนี้</p>}
          </section>

          <section className="card" aria-labelledby="h-todo">
            <h2 id="h-todo">สิ่งที่ต้องทำ</h2>
            {tasks.length + waiting + undeposited + unmatched === 0 ? <p className="ok">✓ ไม่มีงานค้างสำหรับท่าน</p> : (
              <ul className="list">
                {tasks.length > 0 && <li><Link className="item" to="/vouchers"><span className="grow">ใบเบิกที่ต้องดำเนินการ</span><span className="badge badge--gold">{tasks.length}</span></Link></li>}
                {waiting > 0 && <li><Link className="item" to="/rounds"><span className="grow">รอบนับที่รอผู้นับคนที่ 2 ยืนยัน</span><span className="badge badge--gold">{waiting}</span></Link></li>}
                {undeposited > 0 && <li><Link className="item" to="/rounds"><span className="grow">ยอดนับที่ยังไม่ได้นำฝาก</span><span className="badge badge--gold">{undeposited}</span></Link></li>}
                {unmatched > 0 && <li><Link className="item" to="/rounds/statement"><span className="grow">รายการธนาคารที่ยังไม่จับคู่</span><span className="badge badge--gold">{unmatched}</span></Link></li>}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="card" aria-label="ทางลัด">
        <div className="grid2">
          <Link className="btn btn--ghost" to="/reports">🖨️ รายงานพิมพ์</Link>
          {can(role, 'income') && <Link className="btn btn--ghost" to="/income">＋ รายรับ</Link>}
          {can(role, 'voucherCreate') && <Link className="btn btn--ghost" to="/vouchers">＋ ใบเบิก</Link>}
          <Link className="btn btn--ghost" to="/budget">📊 งบประมาณ</Link>
        </div>
      </section>
      <p className="foot-note">ข้อมูลล่าสุดถึง {sync.state === 'ok' ? `ซิงก์เมื่อ ${new Date(sync.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : fmtDate(today)}</p>
    </>
  )
}
