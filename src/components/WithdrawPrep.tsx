import { useMemo, useState } from 'react'
import WeekBar from './WeekBar'
import { can } from '../lib/access'
import { useRole } from '../lib/members'
import { fmtBaht, sheetSunday, sundaysOf, todayISO, weekRange } from '../lib/money'
import { maskPending } from '../lib/maskPay'
import { groupByPerson } from '../lib/groupPerson'
import { useWeekWithdraw } from '../lib/useWeekWithdraw'

/** สีประจำคน (พื้นอ่อน + แถบซ้ายเข้ม) — คนที่มีหลายรายการ */
const TONES = [['#e7f0ff', '#2f6fdd'], ['#fff0dc', '#e08a1e'], ['#e6f6ea', '#2e9d52'], ['#f5e8fb', '#9b4fc7'], ['#fde8e8', '#d64545'], ['#e3f5f7', '#1a98a8']]
const KIND: Record<string, string> = { bill: 'วางบิล', advance: 'สำรองจ่าย', manual: 'รอจ่าย', loan: 'ให้ยืม' }

/** "ต้องเบิก": ต้องเบิกเงินเท่าไรในสัปดาห์นี้ — แยกเงินหมุนเวียน / เงินกองทุน (เก็บไว้เตรียมนำฝาก) ชุดข้อมูลเดียวกับช่อง หมายเหตุ·ต้องเบิก ในใบเบิก-จ่าย */
export default function WithdrawPrep({ year }: { year: number }) {
  const role = useRole()
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => { const s = sheetSunday(todayISO()); return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0]) })
  const w = useWeekWithdraw(year, sunday)
  const circ = can(role, 'detail') ? w.circ : maskPending(w.circ)
  const rows = useMemo(() => groupByPerson(circ.map((x) => ({ ...x, person: x.person }))), [circ])
  const [msg, setMsg] = useState('')
  const copy = async () => {
    const lines = [`ต้องเบิกประจำสัปดาห์ ${weekRange(sunday)}`, `■ เงินหมุนเวียน ${fmtBaht(w.totalC)} บาท`, ...rows.flatMap((r, i) => [`  - ${r.item.person ? `${r.item.person} — ` : ''}${r.item.desc} ${fmtBaht(r.item.amount)}`, ...(r.multi && rows[i + 1]?.g !== r.g ? [`    = รวม ${r.item.person} ${fmtBaht(r.total)}`] : [])]), ...(w.fund.length ? [`▲ เงินกองทุน (เตรียมนำฝาก) ${fmtBaht(w.totalF)} บาท`, ...w.fund.map((x) => `  - ${x.name} ${fmtBaht(x.amount)}`)] : []), `รวมต้องเบิก ${fmtBaht(w.total)} บาท`]
    try { await navigator.clipboard.writeText(lines.join('\n')); setMsg('คัดลอกแล้ว — นำไปวางใน LINE ได้เลย') } catch { setMsg('คัดลอกไม่สำเร็จ') }
  }
  return (
    <div aria-label="ต้องเบิกประจำสัปดาห์">
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <div className="prep__hero" role="status" aria-label="รวมต้องเบิก">
        <span>รวมต้องเบิกสัปดาห์นี้</span>
        <b className="num">{fmtBaht(w.total)} <small>บาท</small></b>
        <div className="prep__split"><span className="prep__chip prep__chip--circ">■ หมุนเวียน {fmtBaht(w.totalC)}</span><span className="prep__chip prep__chip--fund">▲ กองทุน {fmtBaht(w.totalF)}</span></div>
      </div>
      <section className="prep__zone prep__zone--circ" aria-label="ต้องเบิก เงินหมุนเวียน">
        <h3>■ เงินหมุนเวียน <span className="num">รวม {fmtBaht(w.totalC)}</span></h3>
        <table className="sheetpaper prep__tbl" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup><col style={{ width: '9%' }} /><col style={{ width: '38%' }} /><col style={{ width: '15%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /></colgroup>
          <thead><tr><th>ที่</th><th>รายการ</th><th>ประเภท</th><th>จำนวนเงิน</th><th>รวมต่อคน</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const [bg, bar] = r.multi ? TONES[r.g % TONES.length] : ['', '']
              const st: React.CSSProperties = r.multi ? { background: bg } : {}
              return (
                <tr key={i} style={st}>
                  <td style={{ textAlign: 'center', ...(r.multi ? { borderLeft: `5px solid ${bar}` } : {}) }}>{i + 1}</td>
                  <td>{r.item.person && <b>{r.item.person} — </b>}{r.item.desc}</td><td>{KIND[r.item.kind] ?? ''}</td><td className="num"><b>{fmtBaht(r.item.amount)}</b></td>
                  {r.span > 0 && <td className="num" rowSpan={r.span} style={{ verticalAlign: 'middle', textAlign: 'center', ...(r.multi ? { background: bg, borderLeft: `3px solid ${bar}`, fontWeight: 800 } : {}) }}>{r.item.person ? <>{r.multi && <small style={{ display: 'block', fontWeight: 400 }}>{r.span} รายการ</small>}{fmtBaht(r.total)}</> : <span className="muted">—</span>}</td>}
                </tr>)
            })}
            {circ.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>สัปดาห์นี้ไม่มีรายการเงินหมุนเวียนที่ต้องเบิก</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={3}>รวมเงินหมุนเวียน</td><td className="num">{fmtBaht(w.totalC)}</td><td /></tr></tfoot>
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
