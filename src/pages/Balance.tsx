import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import LoansPanel from '../components/LoansPanel'
import DebtBanner from '../components/DebtBanner'
import { can } from '../lib/access'
import { useLoans } from '../lib/data'
import { loanBalance, repaidOf, summarizeLoans } from '../lib/loans'
import { useRole } from '../lib/members'
import { CumLine, Donut, GroupedBars, HBars, Legend } from '../components/StatCharts'
import { fmtBaht, fmtDate, addDays, todayISO } from '../lib/money'
import { computeSeries } from '../lib/seriesLedger'
import { useBalances } from '../lib/useBalances'
import { computeLedger, rangeOf } from '../lib/weekLedger'
import { useYear } from '../lib/year'

export type BalanceKind = 'own' | 'fund' | 'total' | 'debt'
const KINDS: { k: BalanceKind; icon: string; title: string }[] = [
  { k: 'own', icon: '🏠', title: 'หมุนเวียน' }, { k: 'fund', icon: '💰', title: 'กองทุน' }, { k: 'total', icon: '🧮', title: 'รวมเงินสด' }, { k: 'debt', icon: '🧾', title: 'หนี้ภายนอก' },
]
const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })

/** รายละเอียดเงินหมุนเวียน / กองทุน / รวม (เปิดจากแถบสามช่องใต้ชื่อบัญชีหน้าแรก) */
export default function BalancePage() {
  const { kind: raw } = useParams()
  const kind: BalanceKind = raw === 'fund' || raw === 'total' || raw === 'debt' ? raw : 'own'
  const { year } = useYear()
  const { balances: b, input, opening } = useBalances(year)
  const loans = useLoans()
  const role = useRole()
  const ext = loans.items.filter((l) => l.lender.kind === 'person')
  const debt = summarizeLoans(loans.items).external
  const types = input.types

  // รายเดือนของปีที่เลือก + ยอดสะสมต่อจากยอดตั้งต้น/ปีก่อน (เฉพาะรายรับ-รายจ่ายปกติ)
  const series = useMemo(() => {
    const yStart = `${year}-01-01`
    const from = opening?.date ? addDays(opening.date, 1) : '0000-01-01'
    const before = from < yStart ? computeLedger({ ...input, range: { from, to: addDays(yStart, -1) } }) : null
    const base = (opening?.own ?? 0) + (before ? before.inSum.cash + before.inSum.transfer - before.outSum.cash - before.outSum.transfer - before.outSum.pending : 0)
    const bs = computeSeries({ ...input, range: rangeOf('year', year) }, 'year')
    const first = bs.findIndex((x) => x.inTotal > 0 || x.outTotal > 0)
    const lastI = bs.length - 1 - [...bs].reverse().findIndex((x) => x.inTotal > 0 || x.outTotal > 0)
    const cut = first < 0 ? [] : bs.slice(first, lastI + 1)
    return cut.map((x) => ({ ...x, cum: x.cum + base }))
  }, [input, opening, year])
  const today = todayISO()

  return (
    <>
      <div className="page-head"><h1>เงินคริสตจักร</h1><Link to="/" className="mini">‹ หน้าแรก</Link></div>
      <div className="subtabs no-print" role="tablist" aria-label="เงินหมุนเวียน กองทุน รวม" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {KINDS.map((x) => <Link key={x.k} role="tab" aria-selected={kind === x.k} className={`subtab-link${kind === x.k ? ' on' : ''}`} to={`/balance/${x.k}`}>{x.icon} {x.title}</Link>)}
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>ยอด ณ {fmtDate(today)}{opening ? ` · นับต่อจากยอดตั้งต้น ${fmtDate(opening.date)}` : ' · ยังไม่ได้ตั้งยอดยกมา (ตั้งค่า › ยอดยกมา)'}</p>

      {kind === 'own' && (
        <section className="card" aria-label="เงินหมุนเวียน">
          <h2>🏠 เงินหมุนเวียนของคริสตจักร</h2>
          <p className="muted small" style={{ margin: 0 }}>เงินที่ใช้บริหารงานประจำสัปดาห์/เดือน — ไม่รวมกองทุน ไม่รวมเงินยืม</p>
          <DebtBanner loans={loans.items.filter((l) => l.borrower === 'own')} types={types} />
          <p className="bigfig">{fmtBaht(b.own.balance)} บาท</p>
          <table className="tbl tbl--paper" aria-label="ที่มาของเงินหมุนเวียน">
            <tbody>
              <tr><td>ยอดตั้งต้น</td><td className="num">{m(b.own.opening)}</td></tr>
              <tr><td>+ รายรับปกติ (ไม่รวมกองทุน)</td><td className="num">{m(b.own.moneyIn)}</td></tr>
              <tr><td>− รายจ่ายปกติ (จ่ายแล้ว)</td><td className="num">{m(b.own.moneyOut)}</td></tr>
            </tbody>
            <tfoot><tr><td>เงินหมุนเวียนคงเหลือ</td><td className="num">{m(b.own.balance)}</td></tr></tfoot>
          </table>
          {b.own.pending > 0 && <p className="small">ค้างจ่าย (วางบิล/สำรองจ่ายที่ยังไม่จ่าย) <b>{m(b.own.pending)}</b> บาท — ยังไม่หักจากยอดนี้ · หลังหักค้างจ่ายเหลือ <b>{m(b.own.balance - b.own.pending)}</b></p>}
          <div className="stat-title">รายรับ-รายจ่ายรายเดือน ปี {year + 543}</div>
          <Legend />
          <GroupedBars buckets={series} height={200} />
          <div className="stat-title">เงินหมุนเวียนคงเหลือสะสม</div>
          <CumLine buckets={series} height={150} />
          {series.length === 0 && <p className="muted small">ยังไม่มีรายการรับ-จ่ายปกติในปีนี้</p>}
        </section>
      )}

      {kind === 'fund' && (
        <section className="card" aria-label="เงินกองทุน">
          <h2>💰 เงินกองทุน</h2>
          <p className="bigfig">{fmtBaht(b.fundTotal)} บาท</p>
          <HBars rows={b.funds.map((f) => ({ label: f.name, value: Math.max(0, f.balance) }))} tone="in" />
          <table className="tbl tbl--paper" aria-label="ยอดแต่ละกองทุน">
            <thead><tr><th>กองทุน</th><th className="num">ตั้งต้น</th><th className="num">รับเข้า</th><th className="num">จ่ายออก</th><th className="num">คงเหลือ</th></tr></thead>
            <tbody>{b.funds.map((f) => <tr key={f.id}><td>{f.name}</td><td className="num">{m(f.opening)}</td><td className="num">{m(f.moneyIn)}</td><td className="num">{m(f.moneyOut)}</td><td className="num"><b>{m(f.balance)}</b></td></tr>)}</tbody>
            <tfoot><tr><td>รวมกองทุน</td><td className="num">{m(b.funds.reduce((s, f) => s + f.opening, 0))}</td><td className="num">{m(b.funds.reduce((s, f) => s + f.moneyIn, 0))}</td><td className="num">{m(b.funds.reduce((s, f) => s + f.moneyOut, 0))}</td><td className="num">{m(b.fundTotal)}</td></tr></tfoot>
          </table>
          <p className="small"><Link to="/funds">ดูความเคลื่อนไหวของแต่ละกองทุน ›</Link></p>
        </section>
      )}

      {kind === 'total' && (
        <section className="card" aria-label="รวมเงินทั้งหมด">
          <h2>🧮 รวมเงินคริสตจักร</h2>
          <p className="muted small" style={{ margin: 0 }}>เงินหมุนเวียน + เงินกองทุนทุกกอง</p>
          <p className="bigfig">{fmtBaht(b.total)} บาท</p>
          <table className="tbl tbl--paper" aria-label="รวมเงินทั้งหมด">
            <tbody>
              <tr><td>🏠 เงินหมุนเวียน</td><td className="num">{m(b.own.balance)}</td></tr>
              {b.funds.map((f) => <tr key={f.id}><td>💰 {f.name}</td><td className="num">{m(f.balance)}</td></tr>)}
            </tbody>
            <tfoot><tr><td>รวมทั้งหมด</td><td className="num">{m(b.total)}</td></tr></tfoot>
          </table>
          <div className="stat-title">สัดส่วนเงินทั้งหมด (บาท · %)</div>
          <Donut rows={[{ label: 'เงินหมุนเวียน', value: Math.max(0, b.own.balance) }, ...b.funds.map((f) => ({ label: f.name, value: Math.max(0, f.balance) }))].filter((r) => r.value > 0).sort((x, y) => y.value - x.value)} tone="in" />
          <p className="muted small">ยอดเหล่านี้คำนวณจากยอดตั้งต้น + รายการที่บันทึกในแอป ควรเทียบกับยอดในสมุดบัญชีธนาคารและเงินสดจริงที่ขั้น 3 ปรับ</p>
        </section>
      )}

      {kind === 'debt' && (
        <section className="card" aria-label="หนี้ภายนอก">
          <h2>🧾 หนี้ภายนอก</h2>
          <p className="muted small" style={{ margin: 0 }}>เงินที่ยืมจากบุคคลภายนอกและยังต้องคืน (ไม่รวมการยืมระหว่างกองทุนภายใน) — นับทุกปี ไม่ใช่เฉพาะปีนี้</p>
          <p className="bigfig">{fmtBaht(debt)} บาท</p>
          {ext.length === 0 ? <p className="muted">ยังไม่มีหนี้สินภายนอก</p> : (
            <table className="tbl tbl--paper" aria-label="รายการหนี้สินภายนอก">
              <thead><tr><th>วันที่ยืม</th><th>ผู้ให้ยืม → ผู้ยืม</th><th className="num">ยืม</th><th className="num">คืนแล้ว</th><th className="num">ค้างคืน</th></tr></thead>
              <tbody>{[...ext].sort((x, y) => x.date.localeCompare(y.date)).map((l) => <tr key={l.id}><td>{fmtDate(l.date)}</td><td>{l.lender.name || 'บุคคลภายนอก'}{l.borrower ? <> → <b>{l.borrower === 'own' ? 'เงินหมุนเวียน' : types.find((t) => t.id === l.borrower)?.name ?? '(ถูกลบ)'}</b></> : null}<br /><span className="muted small">{l.purpose}</span></td><td className="num">{m(l.principal)}</td><td className="num">{m(repaidOf(l))}</td><td className="num"><b>{m(loanBalance(l))}</b></td></tr>)}</tbody>
              <tfoot><tr><td colSpan={4}>รวมค้างคืน</td><td className="num">{m(debt)}</td></tr></tfoot>
            </table>
          )}
          {ext.some((l) => loanBalance(l) > 0) && <><div className="stat-title">ค้างคืนแยกตามผู้ให้ยืม (บาท)</div><HBars rows={ext.filter((l) => loanBalance(l) > 0).map((l) => ({ label: `${l.lender.name || 'บุคคลภายนอก'} · ${l.purpose}`, value: loanBalance(l) }))} tone="out" /></>}
          <LoansPanel store={loans} funds={types.filter((t) => t.active)} types={types} canWrite={can(role, 'statement')} only="person" title="เพิ่ม / บันทึกการคืน / แก้ไข" />
        </section>
      )}
    </>
  )
}
