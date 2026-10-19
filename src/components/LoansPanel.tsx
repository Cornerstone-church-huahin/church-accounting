import { useState } from 'react'
import MoneyInput from './MoneyInput'
import { fmtBaht, fmtDate, newId, todayISO } from '../lib/money'
import { loanBalance, lenderLabel, repaidOf, summarizeLoans } from '../lib/loans'
import { isFundType } from '../lib/funds'
import type { IncomeType, Loan } from '../lib/types'

type Store = { items: Loan[]; put: (x: Loan[]) => boolean; remove: (id: string) => boolean }
interface Repay { lender: string; borrower: string; date: string; amount: number | null; note: string }
interface Draft { id?: string; borrower: string; kind: 'person' | 'fund'; name: string; fundId: string; purpose: string; date: string; principal: number | null; note: string }
const blank = (fundId: string): Draft => ({ borrower: '', kind: 'person', name: '', fundId, purpose: '', date: todayISO(), principal: null, note: '' })

/** ทะเบียนเงินยืม: เพิ่ม/แก้/ลบได้ทุกเมื่อ ไม่ต้องมีตัวเลขตั้งต้น · ยืมจากบุคคลภายนอก หรือจากกองทุนอื่น */
export default function LoansPanel({ store, funds, canWrite, only, title, types, scope }: { store: Store; funds: IncomeType[]; canWrite: boolean; /** แสดงเฉพาะเงินยืมที่เกี่ยวกับกองทุนนี้ (ยืมเข้า/ให้ยืม) และมีปุ่มเพิ่มแยกสองแบบ */ scope?: { fundId: string }; /** ตัวเลือก "ผู้ยืม" (ประเภทรับทั้งหมดในระบบ) */ types?: IncomeType[]; /** แสดง/เพิ่มเฉพาะเงินยืมประเภทนี้ (person = หนี้สินภายนอก) */ only?: 'person' | 'fund'; title?: string }) {
  const [form, setForm] = useState<Draft | null>(null)
  const [mode, setMode] = useState<'borrow' | 'repay'>('borrow') // โหมดของฟอร์มเพิ่ม: ยืมเพิ่ม / ใช้คืน
  const [rp, setRp] = useState<Repay>({ lender: '', borrower: '', date: todayISO(), amount: null, note: '' })
  const [pay, setPay] = useState<{ loanId: string; date: string; amount: number | null; note: string } | null>(null)
  const [err, setErr] = useState('')
  const borrowers = (types ?? funds).filter((t) => t.active)
  const borrowerName = (id?: string) => (!id ? '' : id === 'own' ? 'เงินหมุนเวียนของคริสตจักร' : (types ?? funds).find((t) => t.id === id)?.name ?? '(ถูกลบ)')
  const fundName = (id?: string) => funds.find((f) => f.id === id)?.name ?? '(กองทุนที่ถูกลบ)'
  const base = only ? store.items.filter((l) => l.lender.kind === only) : store.items
  const shown = scope ? base.filter((l) => !l.deleted && (l.borrower === scope.fundId || (l.lender.kind === 'fund' && l.lender.fundId === scope.fundId))) : base
  const sum = summarizeLoans(shown)
  const live = [...shown].sort((a, b) => a.date.localeCompare(b.date))
  // ---- โหมดใช้คืน: เลือกจากชื่อที่ยังมียอดค้างคืนเท่านั้น ----
  const open = live.filter((l) => !l.deleted && loanBalance(l) > 0)
  const keyOf = (l: Loan) => (l.lender.kind === 'fund' ? `f:${l.lender.fundId ?? ''}` : `p:${(l.lender.name ?? '').trim()}`)
  const lenders = [...new Map(open.map((l) => [keyOf(l), lenderLabel(l, fundName)])).entries()]
  const ofLender = open.filter((l) => keyOf(l) === rp.lender)
  const borrowersOf = [...new Set(ofLender.map((l) => l.borrower ?? ''))]
  const pair = ofLender.filter((l) => (l.borrower ?? '') === rp.borrower)
  const pairBal = pair.reduce((a, l) => a + loanBalance(l), 0)
  const pickLender = (k: string) => { const bs = [...new Set(open.filter((l) => keyOf(l) === k).map((l) => l.borrower ?? ''))]; const b = bs.length === 1 ? bs[0] : ''; const bal = open.filter((l) => keyOf(l) === k && (l.borrower ?? '') === b).reduce((a, l) => a + loanBalance(l), 0); setRp({ ...rp, lender: k, borrower: b, amount: b ? bal : null }) }
  const pickBorrower = (b: string) => setRp({ ...rp, borrower: b, amount: ofLender.filter((l) => (l.borrower ?? '') === b).reduce((a, l) => a + loanBalance(l), 0) || null })
  const saveRepay = () => {
    if (!rp.lender) return setErr(only === 'fund' ? 'เลือกกองทุนที่ได้รับเงินคืน' : 'เลือกชื่อผู้ที่เรายืมมา')
    if (pair.length === 0) return setErr(only === 'fund' ? 'เลือกกองทุนที่เป็นผู้คืน' : 'เลือกผู้ที่ยืม')
    if (!rp.amount || rp.amount <= 0) return setErr('ใส่จำนวนเงินที่คืน')
    if (rp.amount > pairBal) return setErr(`คืนเกินยอดค้าง — ค้างอยู่ ${fmtBaht(pairBal)}`)
    let left = rp.amount
    const out: Loan[] = []
    for (const l of [...pair].sort((a, b) => a.date.localeCompare(b.date))) { // หักจากรายการที่ยืมเก่าสุดก่อน
      if (left <= 0) break
      const take = Math.min(left, loanBalance(l))
      left -= take
      out.push({ ...l, repayments: [...l.repayments, { id: newId('rp'), date: rp.date, amount: take, ...(rp.note.trim() ? { note: rp.note.trim() } : {}) }] })
    }
    store.put(out)
    setForm(null); setErr(''); setMode('borrow'); setRp({ lender: '', borrower: '', date: todayISO(), amount: null, note: '' })
  }

  const save = () => {
    if (!form) return
    if (!form.borrower) return setErr('เลือกผู้ที่ยืม')
    if (form.kind === 'person' && !form.name.trim()) return setErr('ใส่ชื่อผู้ให้ยืม')
    if (form.kind === 'fund' && !form.fundId) return setErr('เลือกกองทุนที่ให้ยืม')
    if (!form.principal || form.principal <= 0) return setErr('ใส่จำนวนเงินที่ยืม')
    const old = form.id ? store.items.find((x) => x.id === form.id) : undefined
    store.put([{ id: form.id ?? newId('ln'), updated: 0, lender: form.kind === 'fund' ? { kind: 'fund', fundId: form.fundId } : { kind: 'person', name: form.name.trim() }, purpose: form.purpose.trim(), ...(form.borrower ? { borrower: form.borrower } : {}), date: form.date, principal: form.principal, repayments: old?.repayments ?? [], ...(old?.note ? { note: old.note } : {}) }])
    setForm(null); setErr('')
  }
  const edit = (l: Loan) => setForm({ id: l.id, borrower: l.borrower ?? '', kind: l.lender.kind, name: l.lender.name ?? '', fundId: l.lender.fundId ?? funds[0]?.id ?? '', purpose: l.purpose, date: l.date, principal: l.principal, note: l.note ?? '' })
  const savePay = () => {
    if (!pay) return
    const l = store.items.find((x) => x.id === pay.loanId)
    if (!l || !pay.amount || pay.amount <= 0) return setErr('ใส่จำนวนเงินที่คืน')
    store.put([{ ...l, repayments: [...l.repayments, { id: newId('rp'), date: pay.date, amount: pay.amount, ...(pay.note.trim() ? { note: pay.note.trim() } : {}) }] }])
    setPay(null); setErr('')
  }

  return (
    <section aria-label="เงินยืม">
      <h3 style={{ marginTop: 14 }}>{title ?? 'เงินยืม (หนี้ที่ต้องคืน)'}</h3>
      <p className="muted small">เงินยืมไม่ใช่รายรับ และการคืนไม่ใช่รายจ่าย · เพิ่มได้ทุกเมื่อ ใส่ยอดที่ไม่แน่ใจไว้ก่อนแล้วแก้ภายหลังได้</p>
      {live.length === 0 && <p className="muted">ยังไม่มีรายการเงินยืม</p>}
      {live.map((l) => {
        const bal = loanBalance(l)
        return (
          <div key={l.id} className="pbdraft" style={bal === 0 ? { opacity: 0.6 } : undefined}>
            <div><b>{lenderLabel(l, fundName)}</b> · {l.purpose || ''} <span className="muted small">({fmtDate(l.date)}){l.lender.kind === 'fund' ? ' · ยืมจากกองทุน' : ' · ภายนอก'}</span></div>
            {l.borrower && <div className="small">ผู้ยืม: <b>{borrowerName(l.borrower)}</b></div>}
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
          {!form.id && (
            <div className="seg" role="group" aria-label="ประเภทรายการ" style={{ marginBottom: 8 }}>
              <button type="button" className={mode === 'borrow' ? 'on' : ''} onClick={() => { setMode('borrow'); setErr('') }}>💸 ยืมเงิน</button>
              <button type="button" className={mode === 'repay' ? 'on' : ''} onClick={() => { setMode('repay'); setErr('') }}>↩️ ใช้คืน</button>
            </div>
          )}
          {!form.id && mode === 'repay' ? (
            <>
              {open.length === 0 ? <p className="muted">ไม่มีรายการที่ค้างคืน</p> : (
                <>
                  <div className="field"><label htmlFor="rp-lender">{only === 'fund' ? 'กองทุนที่ได้รับเงินคืน' : 'คืนให้ใคร (ผู้ให้ยืม)'}</label>
                    <select id="rp-lender" className="input" value={rp.lender} onChange={(e) => pickLender(e.target.value)}>
                      <option value="">— เลือก —</option>
                      {lenders.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                    </select></div>
                  {rp.lender && (
                    <div className="field"><label htmlFor="rp-borrower">{only === 'fund' ? 'กองทุน/ส่วนที่เป็นผู้คืน' : 'ผู้ที่ยืม (ผู้คืนเงิน)'}</label>
                      <select id="rp-borrower" className="input" value={rp.borrower} onChange={(e) => pickBorrower(e.target.value)}>
                        <option value="">— เลือก —</option>
                        {borrowersOf.map((b) => <option key={b} value={b}>{b ? borrowerName(b) : 'ไม่ระบุผู้ยืม'} · ค้าง {fmtBaht(ofLender.filter((l) => (l.borrower ?? '') === b).reduce((a, l) => a + loanBalance(l), 0))}</option>)}
                      </select></div>
                  )}
                  {pair.length > 0 && <p className="small">ค้างคืน <b>{fmtBaht(pairBal)}</b>{rp.amount ? <> → หลังคืนเหลือ <b>{fmtBaht(Math.max(0, pairBal - rp.amount))}</b></> : null}</p>}
                  <div className="grid2"><div className="field"><label htmlFor="rp-date">วันที่คืน</label><input id="rp-date" className="input" type="date" value={rp.date} onChange={(e) => setRp({ ...rp, date: e.target.value })} /></div>
                    <div className="field"><label>จำนวนเงินที่คืน</label><MoneyInput value={rp.amount} onChange={(v) => setRp({ ...rp, amount: v })} /></div></div>
                  <div className="field"><label htmlFor="rp-note">หมายเหตุ (ไม่บังคับ)</label><input id="rp-note" className="input" value={rp.note} onChange={(e) => setRp({ ...rp, note: e.target.value })} /></div>
                </>
              )}
              <div className="row"><button type="button" className="btn btn--gold grow" disabled={open.length === 0} onClick={saveRepay}>บันทึกการใช้คืน</button><button type="button" className="btn btn--ghost" onClick={() => { setForm(null); setErr(''); setMode('borrow') }}>ยกเลิก</button></div>
            </>
          ) : (<>
          {!only && <div className="field"><label htmlFor="ln-kind">ยืมจาก</label>
            <select id="ln-kind" className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'person' | 'fund' })}><option value="person">บุคคลภายนอก (พี่น้อง)</option><option value="fund">กองทุนในคริสตจักร</option></select></div>}
          {form.kind === 'person'
            ? <div className="field"><label htmlFor="ln-name">ชื่อผู้ให้ยืม</label><input id="ln-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            : <div className="field"><label htmlFor="ln-fund">กองทุนที่ให้ยืม</label><select id="ln-fund" className="input" value={form.fundId} onChange={(e) => setForm({ ...form, fundId: e.target.value })}>{funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
          <div className="field"><label htmlFor="ln-borrower">ผู้ที่ยืม (เลือกจากรายการในระบบ)</label>
            <select id="ln-borrower" className="input" value={form.borrower} onChange={(e) => setForm({ ...form, borrower: e.target.value })}>
              <option value="">— เลือกผู้ที่ยืม —</option>
              <option value="own">🏠 เงินหมุนเวียนของคริสตจักร</option>
              {borrowers.map((t) => <option key={t.id} value={t.id}>{isFundType(t) ? '💰 ' : ''}{t.name}</option>)}
            </select></div>
          <div className="grid2"><div className="field"><label htmlFor="ln-date">วันที่ยืม (ประมาณได้)</label><input id="ln-date" className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field"><label>จำนวนเงินที่ยืม</label><MoneyInput value={form.principal} onChange={(v) => setForm({ ...form, principal: v })} /></div></div>
          <div className="field"><label htmlFor="ln-purpose">ใช้ทำอะไร / หมายเหตุ (ไม่บังคับ)</label><input id="ln-purpose" className="input" value={form.purpose} placeholder="เช่น ทำหลุมสุสาน" onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
          <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>{form.id ? 'บันทึกการแก้ไข' : 'บันทึกเงินยืม'}</button><button type="button" className="btn btn--ghost" onClick={() => { setForm(null); setErr('') }}>ยกเลิก</button></div>
          </>)}
        </div>
      ) : scope ? (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--ghost grow" onClick={() => setForm({ ...blank(scope.fundId), borrower: scope.fundId })}>＋ ยืมเข้ากองทุนนี้</button>
          <button type="button" className="btn btn--ghost grow" onClick={() => setForm({ ...blank(scope.fundId), kind: 'fund', fundId: scope.fundId })}>＋ ให้ยืมจากกองทุนนี้</button>
        </div>
      ) : <button type="button" className="btn btn--ghost" onClick={() => setForm({ ...blank(funds[0]?.id ?? ''), ...(only ? { kind: only } : {}) })}>{only === 'person' ? '＋ บันทึกหนี้สินใหม่' : '＋ บันทึกเงินยืม'}</button>)}
    </section>
  )
}
