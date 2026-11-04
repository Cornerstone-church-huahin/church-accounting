import { Fragment, useState } from 'react'
import Sheet from './Sheet'
import { useFundDeposits } from '../lib/data'
import type { FundAccount } from '../lib/fundAccounts'
import { fundPending, isWithdrawRec, wdBase, wdId, type PendingRow } from '../lib/fundPending'
import { fmtBaht, fmtDate, todayISO, weekRange } from '../lib/money'

/**
 * ปุ่ม "เตรียมนำฝาก" ที่มุมการ์ดเงินกองทุน: รวมเงินกองทุนที่ได้ในแต่ละสัปดาห์แต่ยังถืออยู่ ยังไม่ได้นำเข้าบัญชีกองทุน
 * เปิดมาเป็นแผ่นรายการเดียว เรียงเก่า→ใหม่ต่อเนื่อง · กด "ฝากแล้ว" ก็ติ๊กถูกและไม่ค้างอีก · มีเงินเข้าใหม่ก็ต่อแถวรอนำฝากให้เอง
 */
/** ตาราง "เตรียมนำฝาก" + ปุ่ม ฝากแล้ว / ถอนแล้ว — ใช้ทั้งในแผ่นที่มุมการ์ดเงินกองทุนและหน้า "เตรียมนำฝาก" */
export function FundPendingBody({ funds, canWrite }: { funds: FundAccount[]; canWrite: boolean }) {
  const store = useFundDeposits()
  const [msg, setMsg] = useState('')
  const [ask, setAsk] = useState<string | null>(null)   // แถว “ยังไม่ถอน” ที่กำลังถามวันที่ถอน
  const [askDate, setAskDate] = useState(todayISO())
  const sum = fundPending(funds, store.items)
  const depositRec = (r: { key: string; week: string; fundId: string; recorded: number }) => ({ id: r.key, updated: 0, week: r.week, fundId: r.fundId, amount: r.recorded, on: todayISO() })
  const mark = (r: { key: string; week: string; fundId: string; recorded: number }) => store.put([depositRec(r)])
  const undo = (key: string) => store.remove(key)
  const markAll = () => {
    if (!window.confirm(`ทำเครื่องหมายว่านำฝากแล้วทั้ง ${sum.waiting.length} รายการ (รวม ${fmtBaht(sum.waitingTotal)} บาท)?\nเฉพาะที่ถอนแล้ว — รายการ “ยังไม่ถอน” ไม่ถูกแตะ`)) return
    if (store.put(sum.waiting.map(depositRec))) setMsg('บันทึกแล้ว — ทุกรายการที่ถอนแล้วเป็น “ฝากแล้ว”')
  }
  const withdraw = (r: PendingRow) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(askDate)) { setMsg('เลือกวันที่ถอนก่อน'); return }
    const base = r.key.replace(/:u$/, '')
    if (store.put([{ id: wdId(base, askDate), updated: 0, week: r.week, fundId: r.fundId, amount: r.recorded, on: askDate }])) { setMsg(`บันทึกแล้ว — ถอน ${fmtBaht(r.recorded)} บาท วันที่ ${fmtDate(askDate)} (ไปอยู่ในช่อง “ต้องเบิก” ของใบเบิก-จ่ายสัปดาห์นั้น และรอนำฝากต่อ)`); setAsk(null) }
  }
  const undoWithdraw = (r: PendingRow) => {
    const rec = store.items.filter((d) => !d.deleted && isWithdrawRec(d) && wdBase(d.id) === r.key).sort((a, b) => a.on.localeCompare(b.on)).pop()
    if (rec && window.confirm(`ยกเลิกการถอน ${fmtBaht(rec.amount)} บาท (วันที่ ${fmtDate(rec.on)})? ยอดจะกลับเป็น “ยังไม่ถอน”`)) store.remove(rec.id)
  }
  const total = sum.waitingTotal + sum.unwithdrawnTotal
  return (
    <>
      <div className="fundpend__sum" role="status" aria-label="สรุปเงินกองทุนที่ถอนแล้วและยังไม่ถอน">
        <div className="fundpend__sum-i fundpend__sum-i--out"><span>ถอนแล้ว · เงินสดรอนำฝาก</span><b className="num">{fmtBaht(sum.waitingTotal)}</b></div>
        <div className="fundpend__sum-i fundpend__sum-i--no"><span>ยังไม่ถอน</span><b className="num">{fmtBaht(sum.unwithdrawnTotal)}</b></div>
        <div className="fundpend__sum-i fundpend__sum-i--all"><span>รวม</span><b className="num">{fmtBaht(total)}</b></div>
      </div>
      <p className="muted small" style={{ margin: '0 0 4px' }}>เก่าอยู่บน ใหม่ต่อท้าย · <b>ถอนแล้ว</b> = เบิกมาเป็นเงินสดแล้ว (เงินที่มากับรายรับสัปดาห์ เบิกพร้อมเงินหมุนเวียนให้อัตโนมัติ) รอนำเข้าบัญชีกองทุน · <b>ยังไม่ถอน</b> = เงินที่บันทึกในหน้ากองทุนโดยตรง (เช่น ค่าโต๊ะจีน) ยังอยู่ในบัญชีหลัก กด “ถอนแล้ว” เมื่อถอนจริง</p>
      {msg && <p className="note" role="status">{msg}</p>}
      <table className="sheetpaper fundpend__tbl" aria-label="เตรียมนำฝาก (ตาราง)">
        <colgroup><col style={{ width: '6%' }} /><col style={{ width: '27%' }} /><col style={{ width: '20%' }} /><col style={{ width: '19%' }} /><col style={{ width: '28%' }} /></colgroup>
        <thead><tr><th>ที่</th><th>สัปดาห์ · กองทุน</th><th>ถอนแล้ว<small className="fundpend__sub">เบิกแล้ว</small></th><th className="fundpend__th-no">ยังไม่ถอน</th><th>สถานะ</th></tr></thead>
        <tbody>
          {sum.rows.map((r, i) => {
            const un = r.kind === 'direct-unwithdrawn'
            const wait = r.pending > 0
            const cls = `fundpend__tog ${wait ? 'fundpend__tog--wait' : 'fundpend__tog--done'}`
            return (
              <Fragment key={r.key}>
                <tr className={un ? 'fundpend__tr--no' : wait ? 'fundpend__tr--wait' : 'fundpend__tr--done'}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td><div style={{ whiteSpace: 'nowrap' }}>{weekRange(r.week)}</div><div>{r.name}</div></td>
                  <td className="num">{un ? '—' : <><b>{fmtBaht(wait ? r.pending : r.recorded)}</b><small className="fundpend__sub">{r.kind === 'auto' ? 'เบิกอัตโนมัติ' : r.withdrawnOn ? `ถอน ${fmtDate(r.withdrawnOn)}` : ''}</small></>}</td>
                  <td className="num fundpend__unw">{un ? <b>{fmtBaht(r.recorded)}</b> : '—'}</td>
                  <td>
                    {un
                      ? (canWrite ? <button type="button" className="fundpend__tog fundpend__tog--no" onClick={() => { setAsk(ask === r.key ? null : r.key); setAskDate(todayISO()); setMsg('') }} aria-label={`ยังไม่ถอน ${r.name} สัปดาห์ ${weekRange(r.week)} — กดเมื่อถอนแล้ว`}>☐ ถอนแล้ว</button> : <span className="fundpend__tog fundpend__tog--no">ยังไม่ถอน</span>)
                      : canWrite
                        ? <button type="button" className={cls} onClick={() => (wait ? mark(r) : undo(r.key))} aria-label={wait ? `รอนำฝาก ${r.name} สัปดาห์ ${weekRange(r.week)} — กดเมื่อฝากแล้ว` : `ฝากแล้ว ${r.name} สัปดาห์ ${weekRange(r.week)} — กดเพื่อยกเลิก`}>{wait ? '⏳ รอนำฝาก' : '✅ ฝากแล้ว'}</button>
                        : <span className={cls}>{wait ? '⏳ รอนำฝาก' : '✅ ฝากแล้ว'}</span>}
                    {canWrite && r.kind === 'direct-wait' && wait && <button type="button" className="fundpend__undo" onClick={() => undoWithdraw(r)} aria-label={`ยกเลิกการถอน ${r.name} สัปดาห์ ${weekRange(r.week)}`}>↩ ยกเลิกถอน</button>}
                  </td>
                </tr>
                {un && ask === r.key && (
                  <tr className="fundpend__ask"><td colSpan={5}>
                    <label>วันที่ถอน <input type="date" className="input" value={askDate} onChange={(e) => setAskDate(e.target.value)} aria-label="วันที่ถอน" /></label>
                    <button type="button" className="btn btn--gold" onClick={() => withdraw(r)}>ยืนยันถอน {fmtBaht(r.recorded)}</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setAsk(null)}>ยกเลิก</button>
                  </td></tr>
                )}
              </Fragment>
            )
          })}
          {sum.rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }} className="muted">ยังไม่มีเงินกองทุนที่ได้รับ</td></tr>}
        </tbody>
        <tfoot>
          <tr><td colSpan={2}>{sum.waiting.length === 0 ? '✓ ไม่มีรายการค้างรอนำฝาก' : `รอนำฝาก ${sum.waiting.length} รายการ`}</td><td className="num"><b role="status">{fmtBaht(sum.waitingTotal)}</b></td><td className="num fundpend__unw"><b>{fmtBaht(sum.unwithdrawnTotal)}</b></td><td>บาท</td></tr>
        </tfoot>
      </table>
      {canWrite && sum.waiting.length > 1 && <button type="button" className="btn btn--gold" onClick={markAll}>✓ ฝากแล้วทั้งหมดที่รอ ({fmtBaht(sum.waitingTotal)})</button>}
      <p className="small muted">“ฝากแล้ว” และ “ถอนแล้ว” เป็นแค่การบันทึก ไม่เปลี่ยนยอดคงเหลือกองทุน · ยอดที่กด “ถอนแล้ว” จะไปอยู่ในช่อง “ต้องเบิก” ของใบเบิก-จ่ายสัปดาห์ที่ตรงกับวันที่ถอน · เงินเข้าใหม่จะต่อแถวให้เอง</p>
    </>
  )
}

export default function FundPendingPanel({ funds, canWrite }: { funds: FundAccount[]; canWrite: boolean }) {
  const store = useFundDeposits()
  const [open, setOpen] = useState(false)
  const sum = fundPending(funds, store.items)
  return (
    <>
      <button type="button" className="fundpend__btn" onClick={() => setOpen(true)} aria-label={`เตรียมนำฝาก ${sum.waiting.length} รายการ`}>
        <span aria-hidden="true">🧺</span> เตรียมนำฝาก
        {sum.waiting.length > 0 && <span className="fundpend__badge">{fmtBaht(sum.waitingTotal)}</span>}
      </button>
      {open && (
        <Sheet title="🧺 เตรียมนำฝาก — เงินกองทุนที่ยังไม่ได้นำเข้าบัญชี" onClose={() => setOpen(false)}>
          <FundPendingBody funds={funds} canWrite={canWrite} />
        </Sheet>
      )}
    </>
  )
}
