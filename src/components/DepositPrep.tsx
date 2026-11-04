import { FundPendingBody } from './FundPendingPanel'
import { can } from '../lib/access'
import { useFundDeposits } from '../lib/data'
import { fundPending, fundSplit } from '../lib/fundPending'
import { useRole } from '../lib/members'
import { fmtBaht, weekRange } from '../lib/money'
import { useFundAccounts } from '../pages/FundAccounts'

/** "เตรียมนำฝาก": เงินกองทุนที่เบิกมาถือเป็นเงินสดแล้ว รอนำเข้าบัญชีกองทุน — แยกให้เห็น "ในบัญชี" กับ "เตรียมนำฝาก" · กด ฝากแล้ว ส่วนในบัญชีเพิ่ม ส่วนเตรียมนำฝากลด ยอดรวมกองทุนไม่เปลี่ยน */
export default function DepositPrep() {
  const role = useRole()
  const { rows } = useFundAccounts()
  const dep = useFundDeposits()
  const sum = fundPending(rows, dep.items)
  const split = fundSplit(rows, sum)
  const oldest = sum.waiting[0]
  return (
    <div aria-label="เตรียมนำฝากเข้าบัญชีกองทุน">
      <div className="prep__hero prep__hero--fund" role="status" aria-label="เงินที่ยังถืออยู่ รอนำฝาก">
        <span>{sum.waiting.length ? '🧺 ยังอยู่ระหว่างสะสม — รอนำฝาก' : '✅ ไม่มีเงินค้างรอนำฝาก'}</span>
        <b className="num">{fmtBaht(sum.waitingTotal)} <small>บาท</small></b>
        {oldest && <div className="small">สะสม {sum.waiting.length} รายการ · ตั้งแต่สัปดาห์ {weekRange(oldest.week)}</div>}
      </div>
      <table className="sheetpaper prep__tbl prep__tbl--split" aria-label="เงินกองทุน ในบัญชี ถอนแล้ว และยังไม่ถอน">
        <thead><tr><th>กองทุน</th><th>ในบัญชีกองทุน</th><th>ถอนแล้ว (รอนำฝาก)</th><th>ยังไม่ถอน</th><th>รวม</th></tr></thead>
        <tbody>
          {rows.map((f) => {
            const x = split.per.get(f.id)!
            return <tr key={f.id}><td>{f.name}</td><td className="num">{fmtBaht(x.acct)}</td><td className="num prep__wait">{x.w ? fmtBaht(x.w) : '—'}</td><td className="num fundpend__unw">{x.u ? fmtBaht(x.u) : '—'}</td><td className="num"><b>{fmtBaht(f.balance)}</b></td></tr>
          })}
        </tbody>
        <tfoot><tr><td>รวมทุกกองทุน</td><td className="num">{fmtBaht(split.acct)}</td><td className="num prep__wait">{fmtBaht(split.wait)}</td><td className="num fundpend__unw">{fmtBaht(split.unw)}</td><td className="num">{fmtBaht(split.total)}</td></tr></tfoot>
      </table>
      <FundPendingBody funds={rows} canWrite={can(role, 'statement')} />
    </div>
  )
}
