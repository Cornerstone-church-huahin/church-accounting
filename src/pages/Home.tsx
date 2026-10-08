import { useState } from 'react'
import { Link } from 'react-router-dom'
import { can, isSolo, ROLE_LABEL, whoAmI } from '../lib/access'
import { useBudgetAdjs, useBudgetLines, useIncome, useIncomeTypes, useRounds, useSettings, useStatementLines, useVouchers } from '../lib/data'
import { budgetRows, roundTotal, tasksFor, voucherTitle, weekTransfers } from '../lib/ledger'
import { useRole } from '../lib/members'
import { be, fmtBaht, fmtDate, fmtDateLong, inRange, monthName, monthOf, sundaysOf, todayISO, yearOf } from '../lib/money'
import InstallApp from '../components/InstallApp'
import { IncomeForm } from './Income'
import { NewVoucher } from './Vouchers'
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
  const rows = budgetRows(lines.items, adjs.items, vouchers.items, income.items)
  const budget = rows.reduce((s, r) => s + r.current, 0)
  const spent = rows.reduce((s, r) => s + r.spent, 0)
  const tasks = tasksFor(role, whoAmI().id, vouchers.items, settings.twoStepOver, isSolo())
  const lastSunday = sundaysOf(year).filter((d) => d <= today).pop()
  const round = rounds.items.find((r) => r.date === lastSunday)
  const waiting = rounds.items.filter((r) => r.status === 'counting').length
  const undeposited = rounds.items.filter((r) => r.status === 'verified' && !r.deposit).length
  const unmatched = stmt.items.filter((l) => !l.match).length
  const unknownIn = income.items.filter((x) => x.unknown).length
  const sync = income.sync
  const types = useIncomeTypes()
  const [tab, setTabState] = useState<'in' | 'out'>(() => { try { return sessionStorage.getItem('home.tab') === 'out' ? 'out' : 'in' } catch { return 'in' } })
  const setTab = (t: 'in' | 'out') => { setTabState(t); try { sessionStorage.setItem('home.tab', t) } catch { /* ignore */ } }
  const [addIn, setAddIn] = useState(false)
  const [addOut, setAddOut] = useState(false)
  const recentIn = [...income.items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updated - a.updated)).slice(0, 5)
  const recentOut = [...vouchers.items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.no.localeCompare(a.no))).slice(0, 5)
  const inTodo = waiting + undeposited + unknownIn + unmatched

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{settings.churchName}</h1>
          <p className="muted small">ปีบัญชี {be(year)} · {getSync() ? `${whoAmI().name} (${role === 'pending' ? 'รออนุมัติ' : ROLE_LABEL[role]})` : 'โหมดทดลองในเครื่องนี้ — ยังไม่เชื่อมออนไลน์'}</p>
        </div>
      </div>
      <InstallApp banner />
      {!getSync() && <Link to="/settings" className="note" style={{ textDecoration: 'none' }}>☁️ ข้อมูลตอนนี้อยู่ในเครื่องนี้เท่านั้น · กดเพื่อเชื่อมออนไลน์ให้ทุกคนเห็นข้อมูลชุดเดียวกัน</Link>}
      {sync.state === 'error' && <p className="note" role="alert">⚠️ ซิงก์ไม่สำเร็จ: {sync.message}</p>}

      <div className="seg home-tabs" role="tablist" aria-label="รับหรือจ่าย">
        <button type="button" role="tab" aria-selected={tab === 'in'} className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>💚 รับ</button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')}>🔴 จ่าย{tasks.length > 0 ? ` (${tasks.length})` : ''}</button>
      </div>

      {tab === 'in' ? (
        <div role="tabpanel" aria-label="รับ">
          <div className="kpi">
            <div><span>รายรับเดือน{monthName(month)}</span><b>{fmtBaht(inMonth, { dec: false })}</b></div>
            <div><span>รายรับทั้งปี</span><b>{fmtBaht(inYear, { dec: false })}</b></div>
          </div>
          {detail && (
            <section className="card" aria-label="ช่องทางรับเงิน">
              <div className="grid2">
                {can(role, 'income') && <button type="button" className="btn btn--gold" onClick={() => setAddIn(true)}>＋ บันทึกเงินเข้า</button>}
                <Link className="btn btn--ghost" to="/rounds">🗓️ นับเงินอาทิตย์</Link>
                {can(role, 'statement') && <Link className="btn btn--ghost" to="/rounds/statement">🏦 เทียบสเตตเมนต์</Link>}
                <Link className="btn btn--ghost" to="/income">📋 รายรับทั้งหมด</Link>
              </div>
            </section>
          )}
          {detail && (
            <section className="card" aria-labelledby="h-sun">
              <h2 id="h-sun">รอบอาทิตย์ล่าสุด</h2>
              {lastSunday ? (
                <Link className="item" to={`/rounds/${lastSunday}`} style={{ textDecoration: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="grow"><b>{fmtDateLong(lastSunday)}</b><br /><span className="small muted">{!round ? 'ยังไม่ได้บันทึกยอดนับ' : round.status === 'counting' ? 'รอผู้นับคนที่ 2 ยืนยัน' : !round.deposit ? 'ยืนยันแล้ว รอนำฝาก' : 'ฝากธนาคารแล้ว'}</span></span>
                  <b className="num">{round ? fmtBaht(roundTotal(round) + weekTransfers(income.items, lastSunday).total) : '＋ นับเงิน'}</b>
                </Link>
              ) : <p className="muted small">ยังไม่มีวันอาทิตย์ในปีนี้</p>}
            </section>
          )}
          {detail && (
            <section className="card" aria-labelledby="h-rin">
              <h2 id="h-rin">รับล่าสุด</h2>
              {recentIn.length === 0 ? <p className="muted small">ยังไม่มีรายรับ</p> : (
                <ul className="list">
                  {recentIn.map((x) => (
                    <li key={x.id}><Link className="item" to="/income"><span className="grow"><b>{x.typeId ? types.byId(x.typeId)?.name ?? '(ประเภทที่ถูกลบ)' : x.unknown ? '❓ ไม่ทราบที่มา' : 'โอน (ยังไม่แยกประเภท)'}</b><br /><span className="small muted">{fmtDate(x.date)} · {x.method === 'cash' ? 'เงินสด' : 'โอน'}</span></span><b className="num">{fmtBaht(x.amount)}</b></Link></li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {detail && (
            <section className="card" aria-labelledby="h-todo-in">
              <h2 id="h-todo-in">งานค้างฝั่งรับ</h2>
              {inTodo === 0 ? <p className="ok">✓ ไม่มีงานค้าง</p> : (
                <ul className="list">
                  {waiting > 0 && <li><Link className="item" to="/rounds"><span className="grow">รอบนับที่รอผู้นับคนที่ 2 ยืนยัน</span><span className="badge badge--gold">{waiting}</span></Link></li>}
                  {undeposited > 0 && <li><Link className="item" to="/rounds"><span className="grow">ยอดนับที่ยังไม่ได้นำฝาก</span><span className="badge badge--gold">{undeposited}</span></Link></li>}
                  {unknownIn > 0 && <li><Link className="item" to="/income"><span className="grow">เงินเข้าไม่ทราบที่มา — ระบุที่มา</span><span className="badge badge--gold">{unknownIn}</span></Link></li>}
                  {unmatched > 0 && <li><Link className="item" to="/rounds/statement"><span className="grow">รายการธนาคารที่ยังไม่จับคู่</span><span className="badge badge--gold">{unmatched}</span></Link></li>}
                </ul>
              )}
            </section>
          )}
        </div>
      ) : (
        <div role="tabpanel" aria-label="จ่าย">
          <div className="kpi">
            <div><span>จ่ายแล้วทั้งปี</span><b>{fmtBaht(paidYear, { dec: false })}</b></div>
            <div><span>ใบเบิกที่ท่านต้องทำ</span><b>{tasks.length}</b></div>
          </div>
          {detail && (
            <section className="card" aria-label="ช่องทางจ่ายเงิน">
              <div className="grid2">
                {can(role, 'voucherCreate') && <button type="button" className="btn btn--gold" onClick={() => setAddOut(true)}>＋ ทำใบเบิก</button>}
                <Link className="btn btn--ghost" to="/vouchers">📋 ใบเบิกทั้งหมด</Link>
              </div>
            </section>
          )}
          {detail && (
            <section className="card" aria-labelledby="h-todo-out">
              <h2 id="h-todo-out">งานค้างฝั่งจ่าย</h2>
              {tasks.length === 0 ? <p className="ok">✓ ไม่มีงานค้างสำหรับท่าน</p> : (
                <ul className="list"><li><Link className="item" to="/vouchers"><span className="grow">ใบเบิกที่ต้องดำเนินการ</span><span className="badge badge--gold">{tasks.length}</span></Link></li></ul>
              )}
            </section>
          )}
          {detail && (
            <section className="card" aria-labelledby="h-rout">
              <h2 id="h-rout">เบิกล่าสุด</h2>
              {recentOut.length === 0 ? <p className="muted small">ยังไม่มีใบเบิก</p> : (
                <ul className="list">
                  {recentOut.map((x) => (
                    <li key={x.id}><Link className="item" to={`/vouchers/${x.id}`}><span className="grow"><b>{voucherTitle(x)}</b><br /><span className="small muted">{x.no} · {fmtDate(x.date)} · {x.status === 'paid' ? 'จ่ายแล้ว' : 'อยู่ระหว่างดำเนินการ'}</span></span><b className="num">{fmtBaht(x.amount)}</b></Link></li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <section className="card" aria-labelledby="h-bud">
        <div className="row row--between"><h2 id="h-bud">งบประมาณปีนี้</h2><Link to="/budget" className="mini">ดูรายหมวด ›</Link></div>
        {budget > 0 ? (
          <>
            <div className={`progress ${spent > budget ? 'over' : ''}`} role="img" aria-label={`ใช้แล้ว ${Math.round((spent / budget) * 100)}%`}><i style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} /></div>
            <p className="small"><span style={{ color: 'var(--series-1)' }}>ได้รับ <b>{fmtBaht(rows.reduce((a, r) => a + r.income, 0), { dec: false })}</b></span> · งบ <b>{fmtBaht(budget, { dec: false })}</b> · <span style={{ color: 'var(--series-2)' }}>จ่ายแล้ว <b>{fmtBaht(spent, { dec: false })}</b></span> ({Math.round((spent / budget) * 100)}% ของงบ)</p>
          </>
        ) : <p className="muted small">ยังไม่ได้ตั้งงบประมาณปี {be(year)}</p>}
      </section>

      <section className="card" aria-label="ทางลัด">
        <div className="grid2">
          <Link className="btn btn--ghost" to="/reports">🖨️ รายงานพิมพ์</Link>
          <Link className="btn btn--ghost" to="/budget">📊 งบประมาณ</Link>
        </div>
      </section>
      {addIn && <IncomeForm year={year} entry={null} onClose={() => setAddIn(false)} inc={income} />}
      {addOut && <NewVoucher year={year} onClose={() => setAddOut(false)} v={vouchers} />}
      <p className="foot-note">ข้อมูลล่าสุดถึง {sync.state === 'ok' ? `ซิงก์เมื่อ ${new Date(sync.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : fmtDate(today)}</p>
    </>
  )
}
