import { useMemo, useState } from 'react'
import WeekBar from './WeekBar'
import { can } from '../lib/access'
import { useRole } from '../lib/members'
import { fmtBaht, sheetSunday, sundaysOf, todayISO, weekRange } from '../lib/money'
import { maskPending } from '../lib/maskPay'
import { useWeekWithdraw } from '../lib/useWeekWithdraw'

const KIND: Record<string, string> = { bill: 'วางบิล', advance: 'สำรองจ่าย', manual: 'รอจ่าย', loan: 'ให้ยืม' }

/** "เตรียมเบิก": ต้องเบิกเงินเท่าไรในสัปดาห์นี้ — แยกเงินหมุนเวียน / เงินกองทุน (เก็บไว้เตรียมนำฝาก) ชุดข้อมูลเดียวกับช่อง หมายเหตุ·ต้องเบิก ในใบเบิก-จ่าย */
export default function WithdrawPrep({ year }: { year: number }) {
  const role = useRole()
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => { const s = sheetSunday(todayISO()); return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0]) })
  const w = useWeekWithdraw(year, sunday)
  const circ = can(role, 'detail') ? w.circ : maskPending(w.circ)
  const [msg, setMsg] = useState('')
  const copy = async () => {
    const lines = [`ต้องเบิกประจำสัปดาห์ ${weekRange(sunday)}`, `■ เงินหมุนเวียน ${fmtBaht(w.totalC)} บาท`, ...circ.map((x) => `  - ${x.person ? `${x.person} — ` : ''}${x.desc} ${fmtBaht(x.amount)}`), ...(w.fund.length ? [`▲ เงินกองทุน (เตรียมนำฝาก) ${fmtBaht(w.totalF)} บาท`, ...w.fund.map((x) => `  - ${x.name} ${fmtBaht(x.amount)}`)] : []), `รวมต้องเบิก ${fmtBaht(w.total)} บาท`]
    try { await navigator.clipboard.writeText(lines.join('\n')); setMsg('คัดลอกแล้ว — นำไปวางใน LINE ได้เลย') } catch { setMsg('คัดลอกไม่สำเร็จ') }
  }
  return (
    <div aria-label="เตรียมเบิกประจำสัปดาห์">
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <div className="prep__hero" role="status" aria-label="รวมต้องเบิก">
        <span>รวมต้องเบิกสัปดาห์นี้</span>
        <b className="num">{fmtBaht(w.total)} <small>บาท</small></b>
        <div className="prep__split"><span className="prep__chip prep__chip--circ">■ หมุนเวียน {fmtBaht(w.totalC)}</span><span className="prep__chip prep__chip--fund">▲ กองทุน {fmtBaht(w.totalF)}</span></div>
      </div>
      <section className="prep__zone prep__zone--circ" aria-label="ต้องเบิก เงินหมุนเวียน">
        <h3>■ เงินหมุนเวียน <span className="num">รวม {fmtBaht(w.totalC)}</span></h3>
        <table className="sheetpaper prep__tbl"><thead><tr><th>ที่</th><th>รายการ</th><th>ประเภท</th><th>จำนวนเงิน</th></tr></thead>
          <tbody>
            {circ.map((x, i) => <tr key={i}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{x.person && <b>{x.person} — </b>}{x.desc}</td><td>{KIND[x.kind] ?? ''}</td><td className="num"><b>{fmtBaht(x.amount)}</b></td></tr>)}
            {circ.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center' }}>สัปดาห์นี้ไม่มีรายการเงินหมุนเวียนที่ต้องเบิก</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={3}>รวมเงินหมุนเวียน</td><td className="num">{fmtBaht(w.totalC)}</td></tr></tfoot>
        </table>
      </section>
      <section className="prep__zone prep__zone--fund" aria-label="ต้องเบิก เงินกองทุน">
        <h3>▲ เงินกองทุน — เตรียมนำฝากเข้าบัญชีกองทุน <span className="num">รวม {fmtBaht(w.totalF)}</span></h3>
        <table className="sheetpaper prep__tbl"><thead><tr><th>ที่</th><th>กองทุน</th><th>จำนวนเงิน</th></tr></thead>
          <tbody>
            {w.fund.map((x, i) => <tr key={i}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{x.name}</td><td className="num"><b>{fmtBaht(x.amount)}</b></td></tr>)}
            {w.fund.length === 0 && <tr><td colSpan={3} className="muted" style={{ textAlign: 'center' }}>สัปดาห์นี้ไม่มีเงินกองทุน</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={2}>รวมเงินกองทุน</td><td className="num">{fmtBaht(w.totalF)}</td></tr></tfoot>
        </table>
      </section>
      <button type="button" className="btn btn--gold" onClick={() => void copy()}>📋 คัดลอกยอดไปวางใน LINE</button>
      {msg && <p className="note" role="status">{msg}</p>}
      <p className="muted small">ตัวเลขชุดเดียวกับช่อง “หมายเหตุ · ต้องเบิก” ท้ายใบเบิก-จ่ายเงินสด · เงินกองทุนเก็บไว้เป็นเงินสด รอจนได้จำนวนเหมาะสมจึงนำเข้าบัญชี (ไปที่ 🧺 เตรียมนำฝาก)</p>
    </div>
  )
}
