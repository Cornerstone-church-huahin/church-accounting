import { useState } from 'react'
import Sheet from './Sheet'
import { useFundDeposits } from '../lib/data'
import type { FundAccount } from '../lib/fundAccounts'
import { fundPending } from '../lib/fundPending'
import { fmtBaht, fmtDate, todayISO, weekRange } from '../lib/money'

/**
 * ปุ่ม "เตรียมนำฝาก" ที่มุมการ์ดเงินกองทุน: รวมเงินกองทุนที่ได้ในแต่ละสัปดาห์แต่ยังถืออยู่ ยังไม่ได้นำเข้าบัญชีกองทุน
 * เปิดมาเป็นแผ่นรายการเดียว เรียงเก่า→ใหม่ต่อเนื่อง · กด "ฝากแล้ว" ก็ติ๊กถูกและไม่ค้างอีก · มีเงินเข้าใหม่ก็ต่อแถวรอนำฝากให้เอง
 */
export default function FundPendingPanel({ funds, canWrite }: { funds: FundAccount[]; canWrite: boolean }) {
  const store = useFundDeposits()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const sum = fundPending(funds, store.items)
  const mark = (r: { key: string; week: string; fundId: string; recorded: number }) => store.put([{ id: r.key, updated: 0, week: r.week, fundId: r.fundId, amount: r.recorded, on: todayISO() }])
  const undo = (key: string) => store.remove(key)
  const markAll = () => {
    if (!window.confirm(`ทำเครื่องหมายว่านำฝากแล้วทั้ง ${sum.waiting.length} รายการ (รวม ${fmtBaht(sum.waitingTotal)} บาท)?`)) return
    if (store.put(sum.waiting.map((r) => ({ id: r.key, updated: 0, week: r.week, fundId: r.fundId, amount: r.recorded, on: todayISO() })))) setMsg('บันทึกแล้ว — ทุกรายการเป็น “ฝากแล้ว”')
  }
  return (
    <>
      <button type="button" className="fundpend__btn" onClick={() => setOpen(true)} aria-label={`เตรียมนำฝาก ${sum.waiting.length} รายการ`}>
        <span aria-hidden="true">🧺</span> เตรียมนำฝาก
        {sum.waiting.length > 0 && <span className="fundpend__badge">{fmtBaht(sum.waitingTotal)}</span>}
      </button>
      {open && (
        <Sheet title="🧺 เตรียมนำฝาก — เงินกองทุนที่ยังไม่ได้นำเข้าบัญชี" onClose={() => setOpen(false)}>
          <p className="muted small" style={{ margin: '0 0 4px' }}>เงินกองทุนรายสัปดาห์ รวมเป็นตารางเดียวต่อเนื่อง (เก่าอยู่บน ใหม่ต่อท้าย) · นำไปฝากเข้าบัญชีกองทุนแล้วกด “ฝากแล้ว”</p>
          {msg && <p className="note" role="status">{msg}</p>}
          <table className="sheetpaper fundpend__tbl" aria-label="เตรียมนำฝาก (ตาราง)">
            <colgroup><col style={{ width: '6%' }} /><col style={{ width: '21%' }} /><col style={{ width: '25%' }} /><col style={{ width: '16%' }} /><col style={{ width: '32%' }} /></colgroup>
            <thead><tr><th>ที่</th><th>สัปดาห์</th><th>กองทุน</th><th>จำนวนเงิน</th><th>สถานะ</th></tr></thead>
            <tbody>
              {sum.rows.map((r, i) => (
                <tr key={r.key} className={r.pending > 0 ? 'fundpend__tr--wait' : 'fundpend__tr--done'}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{weekRange(r.week)}</td>
                  <td>{r.name}</td>
                  <td className="num"><b>{fmtBaht(r.pending > 0 ? r.pending : r.recorded)}</b></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {(() => {
                      const wait = r.pending > 0
                      const label = wait ? '⏳ รอนำฝาก' : '✅ ฝากแล้ว'
                      const cls = `fundpend__tog ${wait ? 'fundpend__tog--wait' : 'fundpend__tog--done'}`
                      return canWrite
                        ? <button type="button" className={cls} onClick={() => (wait ? mark(r) : undo(r.key))} aria-label={wait ? `รอนำฝาก ${r.name} สัปดาห์ ${weekRange(r.week)} — กดเมื่อฝากแล้ว` : `ฝากแล้ว ${r.name} สัปดาห์ ${weekRange(r.week)} — กดเพื่อยกเลิก`} title={wait ? 'กดเมื่อนำเงินไปฝากแล้ว' : `ฝากแล้ว${r.depositedOn ? ` เมื่อ ${fmtDate(r.depositedOn)}` : ''} — กดเพื่อยกเลิก`}>{label}</button>
                        : <span className={cls}>{label}</span>
                    })()}
                  </td>
                </tr>
              ))}
              {sum.rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }} className="muted">ยังไม่มีเงินกองทุนที่ได้รับ</td></tr>}
            </tbody>
            <tfoot>
              <tr><td colSpan={3}>{sum.waiting.length === 0 ? '✓ ไม่มีรายการค้างรอนำฝาก' : `รอนำฝากรวม ${sum.waiting.length} รายการ`}</td><td className="num"><b role="status">{fmtBaht(sum.waitingTotal)}</b></td><td>บาท</td></tr>
            </tfoot>
          </table>
          {canWrite && sum.waiting.length > 1 && <button type="button" className="btn btn--gold" onClick={markAll}>✓ ฝากแล้วทั้งหมดที่รอ ({fmtBaht(sum.waitingTotal)})</button>}
          <p className="small muted">“ฝากแล้ว” เป็นแค่บันทึกว่านำเงินเข้าบัญชีแล้ว ไม่เปลี่ยนยอดคงเหลือกองทุน · เงินเข้าใหม่จะต่อแถว “รอนำฝาก” ให้เอง</p>
        </Sheet>
      )}
    </>
  )
}
