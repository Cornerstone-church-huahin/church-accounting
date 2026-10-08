import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MoneyInput from '../components/MoneyInput'
import NoAccess from '../components/NoAccess'
import { can, isSolo, whoAmI } from '../lib/access'
import { useAccounts, useIncome, useIncomeTypes, useRounds } from '../lib/data'
import { DENOMS, denomTotal, entriesFromRound, roundId, roundTotal } from '../lib/ledger'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, fmtDateLong, isISO, yearOf } from '../lib/money'
import type { Round } from '../lib/types'

export default function RoundDetail() {
  const { date = '' } = useParams()
  const role = useRole()
  if (!can(role, 'detail')) return <NoAccess />
  if (!isISO(date)) return <p className="empty">วันที่ไม่ถูกต้อง</p>
  return <Detail key={date} date={date} />
}

function Detail({ date }: { date: string }) {
  const nav = useNavigate()
  const role = useRole()
  const year = yearOf(date)
  const rounds = useRounds(year)
  const income = useIncome(year)
  const types = useIncomeTypes()
  const accounts = useAccounts()
  const id = roundId(date)
  const saved = rounds.items.find((r) => r.id === id)
  const me = whoAmI()
  const [lines, setLines] = useState<Record<string, number>>(saved?.lines ?? {})
  const [denoms, setDenoms] = useState<Record<string, number>>(saved?.denoms ?? {})
  const [note, setNote] = useState(saved?.note ?? '')
  const [err, setErr] = useState('')
  const [dep, setDep] = useState({ date: saved?.deposit?.date ?? date, amount: saved?.deposit?.amount ?? null as number | null, accountId: saved?.deposit?.accountId ?? accounts.list[0]?.id ?? '', slip: saved?.deposit?.slip ?? '' })

  const status = saved?.status ?? 'counting'
  const locked = status === 'verified'
  const editable = can(role, 'count') && !locked
  const total = roundTotal({ lines })
  const dTotal = denomTotal(denoms)
  const diff = total - dTotal
  const hasDenoms = Object.values(denoms).some((n) => n > 0)
  const visibleTypes = types.list.filter((t) => t.active || (lines[t.id] ?? 0) > 0)

  const draft = (extra: Partial<Round> = {}): Round => ({
    id, date, lines: Object.fromEntries(Object.entries(lines).filter(([, v]) => v > 0)), denoms: Object.fromEntries(Object.entries(denoms).filter(([, v]) => v > 0)),
    status: saved?.status ?? 'counting', counter: saved?.counter ?? { id: me.id, name: me.name }, note: note.trim(), ...(saved?.verifier ? { verifier: saved.verifier } : {}), ...(saved?.deposit ? { deposit: saved.deposit } : {}), updated: 0, ...extra,
  })
  const saveCount = () => {
    if (total <= 0) return setErr('ใส่ยอดอย่างน้อย 1 ประเภท')
    if (hasDenoms && diff !== 0) return setErr(`ยอดตามประเภทถวายต่างจากยอดตามธนบัตร/เหรียญ ${fmtBaht(Math.abs(diff))} บาท — ตรวจอีกครั้ง`)
    setErr('')
    rounds.put([draft({ counter: { id: me.id, name: me.name } })])
  }
  const verify = () => {
    if (!saved) return
    if (saved.counter.id === me.id && !isSolo()) return setErr('ผู้ยืนยันต้องเป็นคนละคนกับผู้นับ')
    if (!hasDenoms) return setErr('ผู้นับยังไม่ได้กรอกจำนวนธนบัตร/เหรียญ — ให้ผู้นับกรอกก่อน เพื่อให้ตรวจยอดได้')
    if (diff !== 0) return setErr('ยอดตามประเภทถวายไม่ตรงกับยอดตามธนบัตร/เหรียญ')
    const r = draft({ status: 'verified', verifier: { id: me.id, name: me.name, at: Date.now() } })
    // ยืนยันแล้วจึงนับเป็นรายรับ (เงินสดตามประเภทถวาย)
    if (rounds.put([r])) income.put(entriesFromRound(r))
    setErr('')
  }
  const reopen = () => {
    if (!saved || !confirm('ปลดล็อกรอบนี้เพื่อแก้ไข? รายรับจากรอบนี้จะถูกถอนออกจนกว่าจะยืนยันใหม่ และต้องบันทึกการนำฝากใหม่')) return
    const r: Round = { ...saved, status: 'counting', verifier: undefined, deposit: undefined, updated: 0 }
    delete (r as Partial<Round>).verifier
    delete (r as Partial<Round>).deposit
    if (rounds.put([r])) income.put(entriesFromRound(saved).map((e) => ({ ...e, deleted: true })))
  }
  const saveDeposit = () => {
    if (!saved || !dep.amount || dep.amount <= 0) return setErr('ใส่ยอดที่นำฝาก')
    if (accounts.list.length > 0 && !dep.accountId) return setErr('เลือกบัญชีที่ฝาก')
    rounds.put([{ ...saved, deposit: { date: dep.date, amount: dep.amount, accountId: dep.accountId, slip: dep.slip.trim() }, updated: 0 }])
    setErr('')
  }

  const roundTotalSaved = saved ? roundTotal(saved) : 0
  const variance = saved?.deposit ? saved.deposit.amount - roundTotalSaved : 0
  return (
    <>
      <div className="page-head"><h1>นับเงิน {fmtDateLong(date)}</h1></div>

      <section className="card" aria-labelledby="h-count">
        <h2 id="h-count">① ยอดนับแยกตามประเภทถวาย (เงินสด)</h2>
        {visibleTypes.map((t) => (
          <div className="field" key={t.id}>
            <label htmlFor={`l-${t.id}`}>{t.name}</label>
            {editable ? <MoneyInput id={`l-${t.id}`} value={lines[t.id] || null} onChange={(v) => setLines({ ...lines, [t.id]: v ?? 0 })} /> : <div className="num money-big" style={{ fontSize: '1.1rem' }}>{fmtBaht(lines[t.id] ?? 0)}</div>}
          </div>
        ))}
        <div className="row row--between"><b>รวมเงินสดที่นับได้</b><span className="money-big">{fmtBaht(total)}</span></div>

        <details open={hasDenoms}>
          <summary>จำนวนธนบัตร/เหรียญ (ใช้ตรวจยอดกับผู้นับคนที่ 2)</summary>
          <div className="denoms" style={{ marginTop: 8 }}>
            {DENOMS.map((d) => (
              <div className="field" key={d}>
                <label htmlFor={`d-${d}`}>{d >= 20 ? `ธนบัตร ${d}` : `เหรียญ ${d}`}</label>
                <input id={`d-${d}`} className="input input--money" inputMode="numeric" disabled={!editable} value={denoms[d] ? String(denoms[d]) : ''} placeholder="0"
                  onChange={(e) => setDenoms({ ...denoms, [d]: Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0) })} />
              </div>
            ))}
          </div>
          <p className={diff === 0 || !hasDenoms ? 'muted small' : 'err'} role="status">
            ยอดตามธนบัตร/เหรียญ {fmtBaht(dTotal)} {hasDenoms ? (diff === 0 ? '✓ ตรงกับยอดตามประเภท' : `· ต่างจากยอดตามประเภท ${fmtBaht(diff, { sign: true })}`) : ''}
          </p>
        </details>

        <div className="field"><label htmlFor="r-note">หมายเหตุ</label><input id="r-note" className="input" disabled={!editable} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {editable && <button type="button" className="btn btn--gold" onClick={saveCount}>{saved ? 'บันทึกการแก้ไขยอดนับ' : 'บันทึกยอดนับ'}</button>}
      </section>

      {saved && (
        <section className="card" aria-labelledby="h-verify">
          <h2 id="h-verify">② ยืนยันยอดโดยผู้นับคนที่ 2</h2>
          <p>ผู้นับคนที่ 1: <b>{saved.counter.name}</b></p>
          {locked ? (
            <>
              <p className="ok">✓ ยืนยันแล้วโดย <b>{saved.verifier?.name}</b> · ยอด {fmtBaht(roundTotalSaved)} บาท นับเป็นรายรับแล้ว</p>
              {can(role, 'settings') && <button type="button" className="btn btn--ghost" onClick={reopen}>🔓 ปลดล็อกเพื่อแก้ไข (แอดมิน)</button>}
            </>
          ) : (
            <>
              <p className="muted small">ผู้นับคนที่ 2 (คนละคนกับผู้นับคนที่ 1) นับเงินซ้ำ กรอกจำนวนธนบัตร/เหรียญให้ตรงยอด แล้วกดยืนยัน — จึงจะนับเป็นรายรับ</p>
              {can(role, 'verifyCount') ? <button type="button" className="btn btn--gold" disabled={saved.counter.id === me.id && !isSolo()} onClick={verify}>✓ ฉันนับซ้ำแล้ว ยอดถูกต้อง</button> : <p className="note">สิทธิ์ของท่านยืนยันยอดนับไม่ได้</p>}
              {saved.counter.id === me.id && !isSolo() && <p className="muted small">ท่านเป็นผู้นับคนที่ 1 — ต้องให้อีกคนยืนยัน</p>}
            </>
          )}
        </section>
      )}

      {saved && locked && (
        <section className="card" aria-labelledby="h-dep">
          <h2 id="h-dep">③ นำฝากธนาคาร</h2>
          {saved.deposit ? (
            <>
              <p>ฝากเมื่อ <b>{fmtDate(saved.deposit.date)}</b> · ยอด <b>{fmtBaht(saved.deposit.amount)}</b> บาท{saved.deposit.slip ? ` · สลิปเลขที่ ${saved.deposit.slip}` : ''}</p>
              <p className={variance === 0 ? 'ok' : 'err'}>{variance === 0 ? '✓ ยอดฝากตรงกับยอดนับ' : `⚠️ ยอดฝากต่างจากยอดนับ ${fmtBaht(variance, { sign: true })} บาท — ตรวจและบันทึกหมายเหตุ`}</p>
              {can(role, 'deposit') && <button type="button" className="btn btn--ghost" onClick={() => rounds.put([{ ...saved, deposit: undefined, updated: 0 }])}>แก้ไขการนำฝาก</button>}
            </>
          ) : can(role, 'deposit') ? (
            <>
              <div className="field"><label htmlFor="d-date">วันที่ฝาก</label><input id="d-date" type="date" className="input" value={dep.date} onChange={(e) => setDep({ ...dep, date: e.target.value })} /></div>
              <div className="field"><label htmlFor="d-amt">ยอดที่ฝาก (บาท) — ยอดนับ {fmtBaht(roundTotalSaved)}</label><MoneyInput id="d-amt" value={dep.amount} onChange={(v) => setDep({ ...dep, amount: v })} /></div>
              <button type="button" className="mini" onClick={() => setDep({ ...dep, amount: roundTotalSaved })}>ใช้ยอดเท่ายอดนับ</button>
              {accounts.list.length > 0 && <div className="field"><label htmlFor="d-acc">เข้าบัญชี</label><select id="d-acc" className="input" value={dep.accountId} onChange={(e) => setDep({ ...dep, accountId: e.target.value })}>{accounts.list.map((a) => <option key={a.id} value={a.id}>{a.name} {a.last4 && `(${a.last4})`}</option>)}</select></div>}
              <div className="field"><label htmlFor="d-slip">เลขที่สลิปฝาก (ถ้ามี)</label><input id="d-slip" className="input" value={dep.slip} onChange={(e) => setDep({ ...dep, slip: e.target.value })} /></div>
              <button type="button" className="btn btn--gold" onClick={saveDeposit}>บันทึกการนำฝาก</button>
            </>
          ) : <p className="muted">ยังไม่ได้นำฝาก</p>}
        </section>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn btn--ghost" onClick={() => nav('/rounds')}>กลับรายการรอบอาทิตย์</button>
    </>
  )
}
