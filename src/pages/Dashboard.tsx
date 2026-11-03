import { useMemo } from 'react'
import { useBalances } from '../lib/useBalances'
import { computeLedger, rangeOf } from '../lib/weekLedger'
import { computeSeries } from '../lib/seriesLedger'
import { fmtBaht, fmtDate, monthOf, sheetSunday, todayISO } from '../lib/money'
import { GroupedBars, Legend } from '../components/StatCharts'

const m = (x: number) => fmtBaht(x, { dec: false })

/**
 * แดชบอร์ดเงินคริสตจักร: ยอดเงิน ณ วันนี้ · รับ-จ่าย-สุทธิ สัปดาห์นี้/เดือนนี้/ปีนี้ · กราฟรายรับ-รายจ่ายรายเดือน
 * ใช้ตัวคำนวณเดียวกับหน้า “สรุป” และ “เงินคริสตจักร” จึงตัวเลขตรงกัน (อ่านอย่างเดียว)
 */
export default function Dashboard({ year, onBack }: { year: number; onBack?: () => void }) {
  const { balances: b, input } = useBalances(year)
  const today = todayISO()
  const rows = useMemo(() => {
    const sunday = sheetSunday(today), month = monthOf(today)
    const tot = (range: { from: string; to: string }) => {
      const L = computeLedger({ ...input, range })
      const inn = L.inSum.cash + L.inSum.transfer, out = L.outSum.cash + L.outSum.transfer + L.outSum.pending
      return { inn, out, net: inn - out }
    }
    return [
      { k: 'สัปดาห์นี้', sub: `ถึง ${fmtDate(sunday)}`, ...tot(rangeOf('week', year, { sunday })) },
      { k: 'เดือนนี้', sub: '', ...tot(rangeOf('month', year, { month })) },
      { k: `ปี ${year + 543}`, sub: '', ...tot(rangeOf('year', year)) },
    ]
  }, [input, year, today])
  const series = useMemo(() => computeSeries({ ...input, range: rangeOf('year', year) }, 'year').filter((x) => x.inTotal > 0 || x.outTotal > 0), [input, year])
  return (
    <div className="dash">
      {onBack && <button type="button" className="mini no-print" onClick={onBack} aria-label="กลับหน้างานเหรัญญิก">‹ กลับ</button>}
      <h2 className="dash__h">📈 แดชบอร์ด</h2>
      <section className="card dash__bal" aria-label="ยอดเงิน ณ วันนี้">
        <div><span>🏠 หมุนเวียน</span><b>{m(b.own.balance)}</b></div>
        <div><span>💰 กองทุน</span><b>{m(b.total - b.own.balance)}</b></div>
        <div><span>รวมเงินสด</span><b>{m(b.total)}</b></div>
      </section>
      <section className="card" aria-label="รายรับ-รายจ่าย">
        <table className="tbl" style={{ width: '100%' }}>
          <thead><tr><th style={{ textAlign: 'left' }}>ช่วง</th><th className="num" style={{ color: '#1b8a4b' }}>รับ</th><th className="num" style={{ color: '#b3261e' }}>จ่าย</th><th className="num">สุทธิ</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}><td>{r.k}{r.sub && <><br /><small className="muted">{r.sub}</small></>}</td><td className="num" style={{ color: '#1b8a4b' }}>{m(r.inn)}</td><td className="num" style={{ color: '#b3261e' }}>{m(r.out)}</td><td className="num"><b style={{ color: r.net < 0 ? '#b3261e' : undefined }}>{m(r.net)}</b></td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ margin: '0.3rem 0 0' }}>รับ/จ่ายเฉพาะเงินหมุนเวียน นับตามใบรับ-จ่ายรายสัปดาห์เดียวกับหน้า “สรุป”</p>
      </section>
      <section className="card" aria-label="กราฟรายเดือน">
        <h3 style={{ margin: '0 0 0.3rem' }}>รายรับ-รายจ่ายรายเดือน ปี {year + 543}</h3>
        {series.length === 0 ? <p className="empty">ยังไม่มีรายการในปีนี้</p> : <><Legend /><GroupedBars buckets={series} height={220} /></>}
      </section>
    </div>
  )
}
