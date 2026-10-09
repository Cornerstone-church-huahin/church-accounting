import { useState } from 'react'
import MoneyInput from './MoneyInput'
import { fmtBaht, fmtDate, newId, todayISO } from '../lib/money'
import { loanBalance, lenderLabel, repaidOf, summarizeLoans } from '../lib/loans'
import type { IncomeType, Loan } from '../lib/types'

type Store = { items: Loan[]; put: (x: Loan[]) => boolean; remove: (id: string) => boolean }
interface Draft { id?: string; kind: 'person' | 'fund'; name: string; fundId: string; purpose: string; date: string; principal: number | null; note: string }
const blank = (fundId: string): Draft => ({ kind: 'person', name: '', fundId, purpose: '', date: todayISO(), principal: null, note: '' })

/** ทะเบียนเงินยืม: เพิ่ม/แก้/ลบได้ทุกเมื่อ ไม่ต้องมีตัวเลขตั้งต้น · ยืมจากบุคคลภายนอก หรือจากกองทุนอื่น */
export default function LoansPanel({ store, funds, canWrite }: { store: Store; funds: IncomeType[]; canWrite: boolean }) {
  const [form, setForm] = useState<Draft | null>(null)
  const [pay, setPay] = useState<{ loanId: string; date: string; amount: number | null; note: string } | null>(null)
  const [err, setErr] = useState('')
  const fundName = (id?: string) => funds.find((f) => f.id === id)?.name ?? '(กองทุนที่ถูกลบ)'
  const sum = summarizeLoans(store.items)
  const live = [...store.items].sort((a, b) => a.date.localeCompare(b.date))

  const save = () => {
    if (!form) return
    if (!form.purpose.trim()) return setErr('ใส่ว่ายืมไปใช้ทำอะไร')
    if (form.kind === 'person' && !form.name.trim()) return setErr('ใส่ชื่อผู้ให้ยืม')
    if (form.kind === 'fund' && !form.fundId) return setErr('เลือกกองทุนที่ให้ยืม')
    if (!form.principal || form.principal <= 0) return setErr('ใส่จำนวนเงินที่ยืม')
    const old = form.id ? store.items.find((x) => x.id === form.id) : undefined
    store.put([{ id: form.id ?? newId('ln'), updated: 0, lender: form.kind === 'fund' ? { kind: 'fund', fundId: form.fundId } : { kind: 'person', name: form.name.trim() }, purpose: form.purpose.trim(), date: form.date, principal: form.principal, repayments: old?.repayments ?? [], ...(form.note.trim() ? { note: form.note.trim() } : {}) }])
    setForm(null); setErr('')
  }
  const edit = (l: Loan) => setForm({ id: l.id, kind: l.lender.kind, name: l.lender.name ?? '', fundId: l.lender.fundId ?? funds[0]?.id ?? '', purpose: l.purpose, date: l.date, principal: l.principal, note: l.note ?? '' })
  const savePay = () => {
    if (!pay) return
    const l = store.items.find((x) => x.id === pay.loanId)
    if (!l || !pay.amount || pay.amount <= 0) return setErr('ใส่จำนวนเงินที่คืน')
    store.put([{ ...l, repayments: [...l.repayments, { id: newId('rp'), date: pay.date, amount: pay.amount, ...(pay.note.trim() ? { note: pay.note.trim() } : {}) }] }])
    setPay(null); setErr('')
  }

  return (
    <section aria-label="เงินยืม">
      <h3 style={{ marginTop: 14 }}>เงินยืม (หนี้ที่ต้องคืน)</h3>
      <p className="muted small">เงินยืมไม่ใช่รายรับ และการคืนไม่ใช่รายจ่าย · เพิ่มได้ทุกเมื่อ ใส่ยอดที่ไม่แน่ใจไว้ก่อนแล้วแก้ภายหลังได้</p>
      {live.length === 0 && <p className="muted">ยังไม่มีรายการเงินยืม</p>}
      {live.map((l) => {
        const bal = loanBalance(l)
        return (
          <div key={l.id} className="pbdraft" style={bal === 0 ? { opacity: 0.6 } : undefined}>
            <div><b>{lenderLabel(l, fundName)}</b> · {l.purpose} <span className="muted small">({fmtDate(l.date)}){l.lender.kind === 'fund' ? ' · ยืมจากกองทุน' : ' · ภายนอก'}</span></div>
            <div className="small">ยืม {fmtBaht(l.principal)} · คืนแล้ว {fmtBaht(repaidOf(l))} · <b className={bal > 0 ? 'err' : 'ok'}>{bal > 0 ? `ค้างคืน ${fmtBaht(bal)}` : 'คืนครบแล้ว ✓'}</b></div>
            {l.repayments.length > 0 && <ul className="plain small">{l.repayments.map((r) => <li key={r.id}>คืน {fmtBaht(r.amount)} · {fmtDate(r.date)}{r.note ? ` · ${r.note}` : ''}{canWrite && <button type="button" className="mini" aria-label="ลบการคืนนี้" onClick={() => store.put([{ ...l, repayments: l.repayments.filter((x) => x.id !== r.id) }])}>×</button>}</li>)}</ul>}
            {l.note && <div className="muted small">{l.note}</div>}
            {canWrite && (pay?.loanId === l.id ? (
              <div>
                <div className="grid3"><label className="small">วันที่คืน<input className="input" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label><label className="small">จำนวนเงิน<MoneyInput value={pay.amount} onChange={(v) => setPay({ ...pay, amount: v })} /></label><label className="small">หมายเหตุ<input className="input" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></label></div>
                <div className="row"><button type="button" className="btn btn--gold" onClick={savePay}>บันทึกการคืน</button><button type="button" className="btn btn--ghost" onClick={() => { setPay(null); setErr('') }}>ยกเลิก</button></div>
              </div>
            ) : (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="mini" onClick={() => setPay({ loanId: l.id, date: todayISO(), amount: bal > 0 ? bal : null, note: '' })}>＋ บันทึกการคืน</button>
                <button type="button" className="mini" onClick={() => edit(l)}>แก้ไข</button>
                <button type="button" className="mini" aria-label="ลบรายการยืม" onClick={() => { if (confirm('ลบรายการเงินยืมนี้ (รวมประวัติการคืน)?')) store.remove(l.id) }}>🗑</button>
              </div>
            ))}
          </div>
        )
      })}
      {live.length > 0 && <p className="small">รวมค้างคืน <b>{fmtBaht(sum.total)}</b> (ภายนอก {fmtBaht(sum.external)} · ยืมจากกองทุนอื่น {fmtBaht(sum.fromFunds)})</p>}
      {Object.entries(sum.lentByFund).map(([id, v]) => <p key={id} className="small">กองทุน {fundName(id)} ถูกยืมไป <b>{fmtBaht(v)}</b> ยังไม่คืน</p>)}
      {err && <p className="err" role="alert">{err}</p>}
      {canWrite && (form ? (
        <div className="pbdraft">
          <div className="field"><label htmlFor="ln-kind">ยืมจาก</label>
            <select id="ln-kind" className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'person' | 'fund' })}><option value="person">บุคคลภายนอก (พี่น้อง)</option><option value="fund">กองทุนในคริสตจักร</option></select></div>
          {form.kind === 'person'
            ? <div className="field"><label htmlFor="ln-name">ชื่อผู้ให้ยืม</label><input id="ln-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            : <div className="field"><label htmlFor="ln-fund">กองทุนที่ให้ยืม</label><select id="ln-fund" className="input" value={form.fundId} onChange={(e) => setForm({ ...form, fundId: e.target.value })}>{funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
          <div className="field"><label htmlFor="ln-purpose">ยืมไปใช้ทำอะไร</label><input id="ln-purpose" className="input" value={form.purpose} placeholder="เช่น ทำสุสาน · สร้างห้องพัก" onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
          <div className="grid2"><div className="field"><label htmlFor="ln-date">วันที่ยืม (ประมาณได้)</label><input id="ln-date" className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field"><label>จำนวนเงินที่ยืม</label><MoneyInput value={form.principal} onChange={(v) => setForm({ ...form, principal: v })} /></div></div>
          <div className="field"><label htmlFor="ln-note">หมายเหตุ (ถ้ามี)</label><input id="ln-note" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>{form.id ? 'บันทึกการแก้ไข' : 'บันทึกเงินยืม'}</button><button type="button" className="btn btn--ghost" onClick={() => { setForm(null); setErr('') }}>ยกเลิก</button></div>
        </div>
      ) : <button type="button" className="btn btn--ghost" onClick={() => setForm(blank(funds[0]?.id ?? ''))}>＋ บันทึกเงินยืม</button>)}
    </section>
  )
}
