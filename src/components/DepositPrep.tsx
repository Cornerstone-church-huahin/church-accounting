import { FundPendingBody } from './FundPendingPanel'
import { can } from '../lib/access'
import { useFundDeposits } from '../lib/data'
import { fundPending } from '../lib/fundPending'
import { useRole } from '../lib/members'
import { fmtBaht, weekRange } from '../lib/money'
import { useFundAccounts } from '../pages/FundAccounts'

/** "เตรียมนำฝาก": เงินกองทุนที่เบิกมาถือเป็นเงินสดแล้ว รอนำเข้าบัญชีกองทุน — แยกให้เห็น "ในบัญชี" กับ "เตรียมนำฝาก" · กด ฝากแล้ว ส่วนในบัญชีเพิ่ม ส่วนเตรียมนำฝากลด ยอดรวมกองทุนไม่เปลี่ยน */
export default function DepositPrep() {
  const role = useRole()
  const { rows } = useFundAccounts()
  const dep = useFundDeposits()
  const sum = fundPending(rows, dep.items)
  const waitBy = new Map<string, number>()
  for (const r of sum.waiting) waitBy.set(r.fundId, (waitBy.get(r.fundId) ?? 0) + r.pending)
  const total = rows.reduce((s, f) => s + f.balance, 0)
  const oldest = sum.waiting[0]
  return (
    <div aria-label="เตรียมนำฝากเข้าบัญชีกองทุน">
      <div className="prep__hero prep__hero--fund" role="status" aria-label="เงินที่ยังถืออยู่ รอนำฝาก">
        <span>{sum.waiting.length ? '🧺 ยังอยู่ระหว่างสะสม — รอนำฝาก' : '✅ ไม่มีเงินค้างรอนำฝาก'}</span>
        <b className="num">{fmtBaht(sum.waitingTotal)} <small>บาท</small></b>
        {oldest && <div className="small">สะสม {sum.waiting.length} รายการ · ตั้งแต่สัปดาห์ {weekRange(oldest.week)}</div>}
      </div>
      <table className="sheetpaper prep__tbl prep__tbl--split" aria-label="เงินกองทุน ในบัญชี และเตรียมนำฝาก">
        <thead><tr><th>กองทุน</th><th>ในบัญชีกองทุน</th><th>เตรียมนำฝาก</th><th>รวม</th></tr></thead>
        <tbody>
          {rows.map((f) => { const w = Math.min(waitBy.get(f.id) ?? 0, Math.max(0, f.balance)); return <tr key={f.id}><td>{f.name}</td><td className="num">{fmtBaht(f.balance - w)}</td><td className="num prep__wait">{w ? fmtBaht(w) : '—'}</td><td className="num"><b>{fmtBaht(f.balance)}</b></td></tr> })}
        </tbody>
        <tfoot><tr><td>รวมทุกกองทุน</td><td className="num">{fmtBaht(total - sum.waitingTotal)}</td><td className="num prep__wait">{fmtBaht(sum.waitingTotal)}</td><td className="num">{fmtBaht(total)}</td></tr></tfoot>
      </table>
      <FundPendingBody funds={rows} canWrite={can(role, 'statement')} />
    </div>
  )
}
