import { fmtBaht } from '../lib/money'
import type { LRow } from '../lib/weekLedger'

/** ตารางรายรับ/รายจ่าย แบบใบบันทึกการถวาย: ซ้าย = เงินสด · เส้นหนา · ขวา = โอน · รวม — เติมแถวว่างให้ครบ 15 แถว */
export default function LedgerTable({ band, labels, rows, total, tone }: { band?: string; labels: [string, string, string]; rows: LRow[]; total: string; tone?: 'in' | 'out' }) {
  const n = Math.max(15, rows.length)
  const sum = (f: (r: LRow) => number) => rows.reduce((a, r) => a + f(r), 0)
  return (
    <div className={`ledger${tone ? ` ledger--${tone}` : ''}`} style={{ overflowX: 'auto' }}>
      {band && <div className="ledger__band">{band}</div>}
      <table className="tbl tbl--paper" aria-label={band ?? total} style={{ tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: '5%' }} /><col style={{ width: '31%' }} /><col style={{ width: '9%' }} /><col style={{ width: '13%' }} /><col style={{ width: '9%' }} /><col style={{ width: '13%' }} /><col style={{ width: '14%' }} /></colgroup>
        <thead><tr><th>No.</th><th>{labels[0]}</th><th className="num">{labels[1]}</th><th className="num">จำนวนเงิน</th><th className="num vthick">{labels[2]}</th><th className="num">จำนวนเงิน</th><th className="num">รวม</th></tr></thead>
        <tbody>
          {Array.from({ length: n }, (_, i) => {
            const r = rows[i]
            return (
              <tr key={i} className="paper__blank">
                <td>{i + 1}.</td><td>{r?.label ?? ''}</td>
                <td className="num">{r?.cash.n || ''}</td><td className="num">{r?.cash.amt ? fmtBaht(r.cash.amt) : ''}</td>
                <td className="num vthick">{r?.transfer.n || ''}</td><td className="num">{r?.transfer.amt ? fmtBaht(r.transfer.amt) : ''}</td>
                <td className="num"><b>{r && r.cash.amt + r.transfer.amt ? fmtBaht(r.cash.amt + r.transfer.amt) : ''}</b></td>
              </tr>
            )
          })}
        </tbody>
        <tfoot><tr>
          <td colSpan={2}>{total}</td>
          <td className="num">{sum((r) => r.cash.n)}</td><td className="num">{fmtBaht(sum((r) => r.cash.amt))}</td>
          <td className="num vthick">{sum((r) => r.transfer.n)}</td><td className="num">{fmtBaht(sum((r) => r.transfer.amt))}</td>
          <td className="num">{fmtBaht(sum((r) => r.cash.amt + r.transfer.amt))}</td>
        </tr></tfoot>
      </table>
    </div>
  )
}
