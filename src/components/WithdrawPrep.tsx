import { useMemo, useState } from 'react'
import WeekBar from './WeekBar'
import { can } from '../lib/access'
import { useExpenses, useFuelPaid } from '../lib/data'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, sheetSunday, sundaysOf, todayISO, weekRange } from '../lib/money'
import { maskPending } from '../lib/maskPay'
import { groupByPerson } from '../lib/groupPerson'
import { useWeekWithdraw, type WithdrawItem } from '../lib/useWeekWithdraw'

/** สีประจำคน (พื้นอ่อน + แถบซ้ายเข้ม) — คนที่มีหลายรายการ */
const TONES = [['#e7f0ff', '#2f6fdd'], ['#fff0dc', '#e08a1e'], ['#e6f6ea', '#2e9d52'], ['#f5e8fb', '#9b4fc7'], ['#fde8e8', '#d64545'], ['#e3f5f7', '#1a98a8']]
const KIND: Record<string, string> = { bill: 'วางบิล', advance: 'สำรองจ่าย', manual: 'ผู้วางบิลสำรองจ่าย', loan: 'ให้ยืม' }
const DONE_BG = '#e9f7ee'

/** "ต้องเบิก": ต้องเบิกเงินเท่าไรในสัปดาห์นี้ — แยกเงินหมุนเวียน / เงินกองทุน (เก็บไว้เตรียมนำฝาก) ชุดข้อมูลเดียวกับช่อง หมายเหตุ·ต้องเบิก ในใบเบิก-จ่าย
 *  รายการหมุนเวียนกด “✓ จ่ายแล้ว” ได้ (ติ๊กถูกเขียว ย้ายออกจากยอดคงค้าง) และ “↩ ยกเลิก” ได้ถ้ากดผิด */
export default function WithdrawPrep({ year }: { year: number }) {
  const role = useRole()
  const canPay = can(role, 'voucherPay')
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => { const s = sheetSunday(todayISO()); return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0]) })
  const w = useWeekWithdraw(year, sunday)
  const exp = useExpenses(year)
  const fuelPaid = useFuelPaid()
  const detail = can(role, 'detail')
  const circ = detail ? w.circ : maskPending(w.circ)
  const done = detail ? w.paid : maskPending(w.paid)
  const rows = useMemo(() => groupByPerson([...circ, ...done].map((x) => ({ ...x, person: x.person }))), [circ, done])
  const [msg, setMsg] = useState('')

  const setPaid = (it: WithdrawItem, paid: boolean) => {
    if (!it.id) return
    const today = todayISO()
    let ok = false
    if (it.fuel) ok = fuelPaid.put([{ id: it.id, paidDate: paid ? today : '', deleted: !paid, updated: 0 }])
    else {
      const e = exp.items.find((x) => x.id === it.id)
      if (!e) { setMsg('ไม่พบรายการนี้ในปีบัญชีที่เลือก'); return }
      ok = it.kind === 'manual'
        ? exp.put([{ ...e, reimbursed: paid ? today : undefined, updated: 0 }])
        : exp.put([paid ? { ...e, status: 'paid', paidDate: today, method: e.method ?? 'cash', updated: 0 } : { ...e, status: 'open', paidDate: undefined, updated: 0 }])
    }
    setMsg(ok ? (paid ? `✓ บันทึกว่าจ่ายแล้ว: ${it.person ? `${it.person} — ` : ''}${it.desc}` : `↩ ยกเลิกแล้ว: ${it.desc} กลับเป็นรอจ่าย`) : 'บันทึกไม่ได้ (ไม่มีสิทธิ์จ่ายเงิน)')
  }
  const copy = async () => {
    const lines = [`ฝาก/เบิกประจำสัปดาห์ ${weekRange(sunday)}`, `💚 ต้องฝาก ${fmtBaht(w.depositTotal)} บาท (หมุนเวียน ${fmtBaht(w.depositCirc)} + กองทุน ${fmtBaht(w.depositFund)})`, `📋 ต้องเบิก`, `■ เงินหมุนเวียน (ยังไม่จ่าย) ${fmtBaht(w.totalC)} บาท`, ...rows.flatMap((r, i) => [`  ${r.item.done ? '✅' : '⏳'} ${r.item.person ? `${r.item.person} — ` : ''}${r.item.desc} ${fmtBaht(r.item.amount)}`, ...(r.multi && rows[i + 1]?.g !== r.g ? [`    = รวม ${r.item.person} ${fmtBaht(r.total)}`] : [])]), ...(w.fund.length ? [`▲ เงินกองทุน (เตรียมนำฝาก) ${fmtBaht(w.totalF)} บาท`, ...w.fund.map((x) => `  - ${x.name} ${fmtBaht(x.amount)}`)] : []), `รวมต้องเบิก (ยังไม่จ่าย) ${fmtBaht(w.total)} บาท${w.totalPaid > 0 ? ` · จ่ายแล้ว ${fmtBaht(w.totalPaid)} บาท` : ''}`]
    try { await navigator.clipboard.writeText(lines.join('\n')); setMsg('คัดลอกแล้ว — นำไปวางใน LINE ได้เลย') } catch { setMsg('คัดลอกไม่สำเร็จ') }
  }
  const nDone = done.length, nAll = circ.filter((x) => x.kind !== 'loan').length + nDone
  return (
    <div aria-label="ต้องเบิกประจำสัปดาห์">
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <div className="prep__hero" role="status" aria-label="ต้องฝาก" style={{ background: '#1f6b4a' }}>
        <span>💚 ต้องฝากสัปดาห์นี้ (เงินสดรายรับ)</span>
        <b className="num">{fmtBaht(w.depositTotal)} <small>บาท</small></b>
        <div className="prep__split"><span className="prep__chip prep__chip--circ">■ หมุนเวียน {fmtBaht(w.depositCirc)}</span><span className="prep__chip prep__chip--fund">▲ กองทุน {fmtBaht(w.depositFund)}</span></div>
        <span className="small">เงินโอนเข้าบัญชีแล้ว ไม่ต้องฝาก</span>
      </div>
      <div className="prep__hero" role="status" aria-label="รวมต้องเบิก">
        <span>📋 ยังต้องเบิกสัปดาห์นี้ (ยังไม่จ่าย)</span>
        <b className="num">{fmtBaht(w.total)} <small>บาท</small></b>
        <div className="prep__split"><span className="prep__chip prep__chip--circ">■ หมุนเวียน {fmtBaht(w.totalC)}</span><span className="prep__chip prep__chip--fund">▲ กองทุน {fmtBaht(w.totalF)}</span>{w.totalPaid > 0 && <span className="prep__chip" style={{ background: '#dff3e6', color: '#1b6b3a' }}>✅ จ่ายแล้ว {fmtBaht(w.totalPaid)}</span>}</div>
        {nAll > 0 && <span className="small">จ่ายแล้ว {nDone} จาก {nAll} รายการ</span>}
      </div>
      <section className="prep__zone prep__zone--circ" aria-label="ต้องเบิก เงินหมุนเวียน">
        <h3>■ เงินหมุนเวียน <span className="num">ยังไม่จ่าย {fmtBaht(w.totalC)}</span></h3>
        <table className="sheetpaper prep__tbl" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup><col style={{ width: '6%' }} /><col style={{ width: '30%' }} /><col style={{ width: '26%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /></colgroup>
          <thead><tr><th>ที่</th><th>รายการ</th><th>สถานะ</th><th>จำนวนเงิน</th><th>รวมต่อคน</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const it = r.item
              const [bg, bar] = r.multi ? TONES[r.g % TONES.length] : ['', '']
              const st: React.CSSProperties = it.done ? { background: DONE_BG } : r.multi ? { background: bg } : { background: '#fff' }
              const canMark = canPay && !!it.id && it.kind !== 'loan'
              return (
                <tr key={i} style={st} data-done={it.done ? '1' : undefined}>
                  <td style={{ textAlign: 'center', ...(r.multi ? { borderLeft: `5px solid ${bar}` } : {}) }}>{i + 1}</td>
                  <td>{it.person && <b>{it.person} — </b>}{it.desc}<br /><small className="muted">{KIND[it.kind] ?? ''}</small></td>
                  <td style={{ textAlign: 'center' }}>
                    {it.kind === 'loan' ? <span className="muted">ให้ยืม</span> : it.done
                      ? <><b style={{ color: '#1b6b3a' }}>✅ จ่ายแล้ว</b>{it.paidDate && <><br /><small className="muted">{fmtDate(it.paidDate)}</small></>}{canMark && <><br /><button type="button" className="mini" style={{ whiteSpace: 'nowrap', minHeight: 0 }} aria-label={`ยกเลิกจ่ายแล้ว ${it.desc}`} onClick={() => setPaid(it, false)}>↩ ยกเลิก</button></>}</>
                      : <><b style={{ color: '#b25e00' }}>⏳ รอจ่าย</b>{canMark && <><br /><button type="button" className="btn btn--gold" style={{ padding: '1px 6px', fontSize: 12, marginTop: 2, maxWidth: '100%', minHeight: 0, lineHeight: 1.3, whiteSpace: 'nowrap' }} aria-label={`จ่ายแล้ว ${it.desc}`} onClick={() => setPaid(it, true)}>✓ จ่ายแล้ว</button></>}</>}
                  </td>
                  <td className="num" style={it.done ? { color: '#1b6b3a' } : undefined}><b>{fmtBaht(it.amount)}</b>{it.done && <> ✓</>}</td>
                  {r.span > 0 && <td className="num" rowSpan={r.span} style={{ verticalAlign: 'middle', textAlign: 'center', ...(r.multi ? { background: bg, borderLeft: `3px solid ${bar}`, fontWeight: 800 } : {}) }}>{it.person ? <>{r.multi && <small style={{ display: 'block', fontWeight: 400 }}>{r.span} รายการ</small>}{fmtBaht(r.total)}</> : <span className="muted">—</span>}</td>}
                </tr>)
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>สัปดาห์นี้ไม่มีรายการเงินหมุนเวียนที่ต้องเบิก</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>⏳ ยังไม่จ่าย</td><td className="num">{fmtBaht(w.totalC)}</td><td /></tr>
            {w.totalPaid > 0 && <tr><td colSpan={3} style={{ color: '#1b6b3a' }}>✅ จ่ายแล้ว</td><td className="num" style={{ color: '#1b6b3a' }}>{fmtBaht(w.totalPaid)}</td><td /></tr>}
            {w.totalPaid > 0 && <tr><td colSpan={3}>รวมเงินหมุนเวียนทั้งสัปดาห์</td><td className="num">{fmtBaht(w.totalC + w.totalPaid)}</td><td /></tr>}
          </tfoot>
        </table>
        {!canPay && <p className="muted small" style={{ margin: '4px 0 0' }}>ผู้บันทึกบัญชี/แอดมินกดบันทึก “จ่ายแล้ว” ได้ · ท่านดูได้อย่างเดียว</p>}
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
      <p className="muted small">ตัวเลขชุดเดียวกับช่อง “หมายเหตุ · ต้องเบิก” ท้ายใบเบิก-จ่ายเงินสด · กด “✓ จ่ายแล้ว” เมื่อจ่ายเงินให้คนนั้นแล้ว (กดผิดกด “↩ ยกเลิก” ได้) · เงินกองทุนเก็บไว้เป็นเงินสด รอจนได้จำนวนเหมาะสมจึงนำเข้าบัญชี (ไปที่ 🧺 เตรียมนำฝาก)</p>
    </div>
  )
}
