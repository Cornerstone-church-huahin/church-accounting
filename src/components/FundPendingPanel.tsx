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
          <p className="muted small">เงินกองทุนที่ได้รับในแต่ละสัปดาห์ รวมไว้ที่นี่ต่อเนื่องกันไป (เก่าอยู่บน ใหม่ต่อท้าย) — ถอนมาถือไว้ก่อนได้ เมื่อสะสมพอแล้วนำไปฝากเข้าบัญชีกองทุน แล้วกด “ฝากแล้ว” ที่รายการนั้น</p>
          <div className="fundpend__total" role="status">
            {sum.waiting.length === 0 ? '✓ ไม่มีเงินกองทุนค้างรอนำฝาก' : <>⏳ รอนำฝากรวม <b>{fmtBaht(sum.waitingTotal)}</b> บาท · {sum.waiting.length} รายการ</>}
          </div>
          {msg && <p className="note" role="status">{msg}</p>}
          {sum.rows.length === 0 ? <p className="muted">ยังไม่มีเงินกองทุนที่ได้รับ</p> : (
            <ol className="fundpend__list">
              {sum.rows.map((r, i) => (
                <li key={r.key} className={r.pending > 0 ? 'fundpend__row fundpend__row--wait' : 'fundpend__row fundpend__row--done'}>
                  <span className="fundpend__no">{i + 1}</span>
                  <div className="grow">
                    <b>{r.name}</b> <span className="small muted">· สัปดาห์ {weekRange(r.week)}</span>
                    {r.pending > 0
                      ? <div className="small fundpend__warn">⏳ รอนำฝาก — เตรียมนำฝากเข้าบัญชีกองทุน{r.deposited > 0 ? ` (ส่วนเพิ่มหลังฝากครั้งก่อน ${fmtBaht(r.pending)})` : ''}</div>
                      : <div className="small fundpend__ok">✅ ฝากแล้ว{r.depositedOn ? ` เมื่อ ${fmtDate(r.depositedOn)}` : ''}</div>}
                  </div>
                  <div className="fundpend__amt"><b>{fmtBaht(r.pending > 0 ? r.pending : r.recorded)}</b>
                    {canWrite && (r.pending > 0
                      ? <button type="button" className="mini fundpend__done" onClick={() => mark(r)}>✓ ฝากแล้ว</button>
                      : <button type="button" className="mini" onClick={() => undo(r.key)} aria-label="ยกเลิกการฝากรายการนี้">↩︎ ยกเลิก</button>)}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {canWrite && sum.waiting.length > 1 && <button type="button" className="btn btn--gold" onClick={markAll}>✓ ฝากแล้วทั้งหมดที่รอ ({fmtBaht(sum.waitingTotal)})</button>}
          <p className="small muted">“ฝากแล้ว” เป็นแค่บันทึกว่าเงินส่วนนี้ถูกนำเข้าบัญชีแล้ว ไม่ได้เปลี่ยนยอดคงเหลือของกองทุน (ยอดกองทุนนับตั้งแต่ได้รับเงินอยู่แล้ว)</p>
        </Sheet>
      )}
    </>
  )
}
