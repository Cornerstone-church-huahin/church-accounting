import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MoneyInput from '../components/MoneyInput'
import NoAccess from '../components/NoAccess'
import { can, isSolo, whoAmI } from '../lib/access'
import { useAccounts, useIncome, useIncomeTypes, useRounds, useSettings } from '../lib/data'
import { DENOMS, denomTotal, entriesFromRound, envelopeTotal, roundId, roundTotal, weekTransfers } from '../lib/ledger'
import { useRole } from '../lib/members'
import { addDays, fmtBaht, fmtDate, fmtDateLong, isISO, monthName, monthOf, yearOf, be } from '../lib/money'
import { UNSORTED, type Round } from '../lib/types'
import { IncomeForm } from './Income'

export default function RoundDetail() {
  const { date = '' } = useParams()
  const role = useRole()
  if (!can(role, 'detail')) return <NoAccess />
  if (!isISO(date)) return <p className="empty">วันที่ไม่ถูกต้อง</p>
  return <Detail key={date} date={date} />
}

/** ใบบันทึกการถวายประจำวันอาทิตย์ — หน้าตาและลำดับตามใบกระดาษของคริสตจักร */
function Detail({ date }: { date: string }) {
  const nav = useNavigate()
  const role = useRole()
  const year = yearOf(date)
  const rounds = useRounds(year)
  const income = useIncome(year)
  const types = useIncomeTypes()
  const accounts = useAccounts()
  const { settings } = useSettings()
  const id = roundId(date)
  const saved = rounds.items.find((r) => r.id === id)
  const me = whoAmI()
  const [lines, setLines] = useState<Record<string, number>>(saved?.lines ?? {})
  const [envelopes, setEnvelopes] = useState<Record<string, number>>(saved?.envelopes ?? {})
  const [denoms, setDenoms] = useState<Record<string, number>>(saved?.denoms ?? {})
  const [note, setNote] = useState(saved?.note ?? '')
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [dep, setDep] = useState({ date: saved?.deposit?.date ?? date, amount: saved?.deposit?.amount ?? (null as number | null), accountId: saved?.deposit?.accountId ?? accounts.list[0]?.id ?? '', slip: saved?.deposit?.slip ?? '' })

  const status = saved?.status ?? 'counting'
  const locked = status === 'verified'
  const editable = can(role, 'count') && !locked
  const total = roundTotal({ lines })
  const dTotal = denomTotal(denoms)
  const diff = total - dTotal
  const hasDenoms = Object.values(denoms).some((n) => n > 0)
  const visibleTypes = types.list.filter((t) => t.active || (lines[t.id] ?? 0) > 0)
  const wk = weekTransfers(income.items, date)
  const grand = total + wk.total
  const wkFrom = addDays(date, -6)

  const draft = (extra: Partial<Round> = {}): Round => ({
    id, date, lines: Object.fromEntries(Object.entries(lines).filter(([, v]) => v > 0)), envelopes: Object.fromEntries(Object.entries(envelopes).filter(([, v]) => v > 0)),
    denoms: Object.fromEntries(Object.entries(denoms).filter(([, v]) => v > 0)),
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
    if (saved.counter.id === me.id && !isSolo()) return setErr('ผู้ตรวจนับคนที่ 2 ต้องเป็นคนละคนกับคนที่ 1')
    if (hasDenoms && diff !== 0) return setErr('ยอดตามประเภทถวายไม่ตรงกับยอดตามธนบัตร/เหรียญ')
    const r = draft({ status: 'verified', verifier: { id: me.id, name: me.name, at: Date.now() } })
    // ผู้ตรวจนับคนที่ 2 ยืนยันแล้วจึงนับเงินสดในตู้เป็นรายรับ
    if (rounds.put([r])) income.put(entriesFromRound(r))
    setErr('')
  }
  const reopen = () => {
    if (!saved || !confirm('ปลดล็อกรอบนี้เพื่อแก้ไข? รายรับเงินสดจากรอบนี้จะถูกถอนออกจนกว่าจะยืนยันใหม่')) return
    const r: Round = { ...saved, status: 'counting', updated: 0 }
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
  const typeName = (t: string) => (t === UNSORTED ? 'โอน (ยังไม่แยกประเภท)' : types.byId(t)?.name ?? '?')

  return (
    <>
      <div className="page-head no-print"><h1>ใบบันทึกการถวาย {fmtDateLong(date)}</h1><button type="button" className="mini" onClick={() => window.print()}>🖨️ พิมพ์ใบบันทึก</button></div>

      <section className="card no-print" aria-labelledby="h-count">
        <h2 id="h-count">① ตู้ถวาย (เงินสด) — จำนวนซอง และจำนวนเงิน</h2>
        {visibleTypes.map((t) => (
          <div className="grid2" key={t.id} style={{ alignItems: 'end' }}>
            <div className="field"><label htmlFor={`e-${t.id}`}>{t.name} · ซอง</label>
              <input id={`e-${t.id}`} className="input input--money" inputMode="numeric" disabled={!editable} placeholder="0" value={envelopes[t.id] ? String(envelopes[t.id]) : ''} onChange={(e) => setEnvelopes({ ...envelopes, [t.id]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })} /></div>
            <div className="field"><label htmlFor={`l-${t.id}`}>บาท</label>
              {editable ? <MoneyInput id={`l-${t.id}`} value={lines[t.id] || null} onChange={(v) => setLines({ ...lines, [t.id]: v ?? 0 })} /> : <div className="num money-big" style={{ fontSize: '1.1rem' }}>{fmtBaht(lines[t.id] ?? 0)}</div>}</div>
          </div>
        ))}
        <div className="row row--between"><b>รวมจากตู้ถวาย ({envelopeTotal({ envelopes })} ซอง)</b><span className="money-big">{fmtBaht(total)}</span></div>

        <details open={hasDenoms}>
          <summary>จำนวนธนบัตร/เหรียญ (ไม่บังคับ — ใช้ตรวจยอดเพิ่มเติม)</summary>
          <div className="denoms" style={{ marginTop: 8 }}>
            {DENOMS.map((d) => (
              <div className="field" key={d}>
                <label htmlFor={`d-${d}`}>{d >= 20 ? `ธนบัตร ${d}` : `เหรียญ ${d}`}</label>
                <input id={`d-${d}`} className="input input--money" inputMode="numeric" disabled={!editable} value={denoms[d] ? String(denoms[d]) : ''} placeholder="0"
                  onChange={(e) => setDenoms({ ...denoms, [d]: Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0) })} />
              </div>
            ))}
          </div>
          <p className={diff === 0 || !hasDenoms ? 'muted small' : 'err'} role="status">ยอดตามธนบัตร/เหรียญ {fmtBaht(dTotal)} {hasDenoms ? (diff === 0 ? '✓ ตรงกับยอดตามประเภท' : `· ต่างจากยอดตามประเภท ${fmtBaht(diff, { sign: true })}`) : ''}</p>
        </details>

        <div className="field"><label htmlFor="r-note">หมายเหตุ</label><input id="r-note" className="input" disabled={!editable} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {editable && <button type="button" className="btn btn--gold" onClick={saveCount}>{saved ? 'บันทึกการแก้ไขยอดนับ' : 'บันทึกยอดตู้ถวาย'}</button>}
      </section>

      <section className="card no-print" aria-labelledby="h-tr">
        <h2 id="h-tr">② เงินโอน ({fmtDate(wkFrom)} – {fmtDate(date)})</h2>
        <p className="muted small">รวมเงินโอนที่เข้าตั้งแต่วันจันทร์ถึงวันอาทิตย์นี้ — บันทึกรายการโอนแต่ละสลิปที่นี่หรือที่หน้ารายรับ</p>
        {wk.entries.length === 0 ? <p className="muted small">ยังไม่มีรายการโอนในสัปดาห์นี้</p> : (
          <ul className="list">{wk.entries.sort((a, b) => (a.date < b.date ? -1 : 1)).map((x) => <li key={x.id}><span className="grow small">{fmtDate(x.date)} · {typeName(x.typeId)}{x.memberNo ? ` · สมาชิก ${x.memberNo}` : ''}{x.ref ? ` · ${x.ref}` : ''}</span><b className="num">{fmtBaht(x.amount)}</b></li>)}</ul>
        )}
        <div className="row row--between"><b>รวมจากการโอน ({wk.entries.length} รายการ)</b><span className="money-big">{fmtBaht(wk.total)}</span></div>
        {can(role, 'income') && <button type="button" className="btn btn--ghost" onClick={() => setAdding(true)}>＋ บันทึกรายการโอน</button>}
        <div className="row row--between"><b>รวมทั้งสิ้น (ตู้ + โอน)</b><span className="money-big">{fmtBaht(grand)}</span></div>
      </section>
      {adding && <IncomeForm year={year} entry={null} inc={income} defaultDate={date} onClose={() => setAdding(false)} />}

      {saved && (
        <section className="card no-print" aria-labelledby="h-verify">
          <h2 id="h-verify">③ ผู้ตรวจนับคนที่ 2 ยืนยันยอดตู้ถวาย</h2>
          <p>ผู้ตรวจนับคนที่ 1: <b>{saved.counter.name}</b></p>
          {locked ? (
            <>
              <p className="ok">✓ ยืนยันแล้วโดย <b>{saved.verifier?.name}</b> · เงินสดในตู้ {fmtBaht(roundTotalSaved)} บาท นับเป็นรายรับแล้ว</p>
              {can(role, 'settings') && <button type="button" className="btn btn--ghost" onClick={reopen}>🔓 ปลดล็อกเพื่อแก้ไข (แอดมิน)</button>}
            </>
          ) : (
            <>
              <p className="muted small">ผู้ตรวจนับคนที่ 2 (คนละคนกับคนที่ 1) นับซ้ำ ตรวจยอดแต่ละประเภทให้ตรง แล้วกดยืนยัน — จึงจะนับเงินสดเป็นรายรับ</p>
              {can(role, 'verifyCount') ? <button type="button" className="btn btn--gold" disabled={saved.counter.id === me.id && !isSolo()} onClick={verify}>✓ ฉันนับซ้ำแล้ว ยอดถูกต้อง</button> : <p className="note">สิทธิ์ของท่านยืนยันยอดนับไม่ได้</p>}
              {saved.counter.id === me.id && !isSolo() && <p className="muted small">ท่านเป็นผู้ตรวจนับคนที่ 1 — ต้องให้อีกคนยืนยัน</p>}
            </>
          )}
        </section>
      )}

      {saved && locked && (
        <section className="card no-print" aria-labelledby="h-dep">
          <h2 id="h-dep">④ นำเงินสดฝากธนาคาร (ถ้ามี)</h2>
          {saved.deposit ? (
            <>
              <p>ฝากเมื่อ <b>{fmtDate(saved.deposit.date)}</b> · ยอด <b>{fmtBaht(saved.deposit.amount)}</b> บาท{saved.deposit.slip ? ` · สลิปเลขที่ ${saved.deposit.slip}` : ''}</p>
              <p className={variance === 0 ? 'ok' : 'err'}>{variance === 0 ? '✓ ยอดฝากตรงกับยอดตู้ถวาย' : `ยอดฝากต่างจากยอดตู้ถวาย ${fmtBaht(variance, { sign: true })} บาท — ถ้าแบ่งไปใช้จ่าย ให้บันทึกหมายเหตุ`}</p>
              {can(role, 'deposit') && <button type="button" className="btn btn--ghost" onClick={() => rounds.put([{ ...saved, deposit: undefined, updated: 0 }])}>แก้ไขการนำฝาก</button>}
            </>
          ) : can(role, 'deposit') ? (
            <>
              <p className="muted small">ถ้าไม่ได้ฝากเงินสดรอบนี้ (เช่น เก็บไว้จ่าย) ข้ามขั้นนี้ได้</p>
              <div className="field"><label htmlFor="d-date">วันที่ฝาก</label><input id="d-date" type="date" className="input" value={dep.date} onChange={(e) => setDep({ ...dep, date: e.target.value })} /></div>
              <div className="field"><label htmlFor="d-amt">ยอดที่ฝาก (บาท) — ยอดตู้ถวาย {fmtBaht(roundTotalSaved)}</label><MoneyInput id="d-amt" value={dep.amount} onChange={(v) => setDep({ ...dep, amount: v })} /></div>
              <button type="button" className="mini" onClick={() => setDep({ ...dep, amount: roundTotalSaved })}>ใช้ยอดเท่ายอดตู้ถวาย</button>
              {accounts.list.length > 0 && <div className="field"><label htmlFor="d-acc">เข้าบัญชี</label><select id="d-acc" className="input" value={dep.accountId} onChange={(e) => setDep({ ...dep, accountId: e.target.value })}>{accounts.list.map((a) => <option key={a.id} value={a.id}>{a.name} {a.last4 && `(${a.last4})`}</option>)}</select></div>}
              <div className="field"><label htmlFor="d-slip">เลขที่สลิปฝาก (ถ้ามี)</label><input id="d-slip" className="input" value={dep.slip} onChange={(e) => setDep({ ...dep, slip: e.target.value })} /></div>
              <button type="button" className="btn btn--gold" onClick={saveDeposit}>บันทึกการนำฝาก</button>
            </>
          ) : <p className="muted">ยังไม่ได้นำฝาก</p>}
        </section>
      )}
      {err && <p className="err no-print" role="alert">{err}</p>}
      <button type="button" className="btn btn--ghost no-print" onClick={() => nav('/rounds')}>กลับรายการรอบอาทิตย์</button>

      {/* ---- ใบบันทึกการถวาย (พิมพ์) ---- */}
      <section className="print-only" aria-hidden="true">
        <h2 style={{ textAlign: 'center' }}>ใบบันทึกการถวาย {settings.churchName}</h2>
        <p style={{ textAlign: 'center' }}>ประจำวันอาทิตย์ ที่ {Number(date.slice(8))} เดือน {monthName(monthOf(date))} พ.ศ. {be(year)}</p>
        <table className="tbl" style={{ fontSize: '10.5pt' }}>
          <thead><tr><th>No.</th><th>ประเภท</th><th className="num">จำนวนซอง</th><th className="num">จำนวนเงิน</th><th className="num">จำนวนผู้โอน</th><th className="num">จำนวนเงิน</th><th className="num">รวม</th></tr></thead>
          <tbody>
            {[...types.list.filter((t) => t.active || lines[t.id] || wk.entries.some((x) => x.typeId === t.id)).map((t) => t.id), ...(wk.entries.some((x) => x.typeId === UNSORTED) ? [UNSORTED] : [])].map((tid, n) => {
              const tr = wk.entries.filter((x) => x.typeId === tid)
              const cash = lines[tid] ?? 0, tsum = tr.reduce((s, x) => s + x.amount, 0)
              return <tr key={tid || 'u'} style={{ height: '1.6rem' }}><td>{n + 1}</td><td>{typeName(tid)}</td><td className="num">{envelopes[tid] || ''}</td><td className="num">{cash ? fmtBaht(cash) : ''}</td><td className="num">{tr.length || ''}</td><td className="num">{tsum ? fmtBaht(tsum) : ''}</td><td className="num">{cash + tsum ? fmtBaht(cash + tsum) : ''}</td></tr>
            })}
          </tbody>
        </table>
        <p style={{ marginTop: 12 }}>รวมจากตู้ถวาย <b>{fmtBaht(total)}</b> &nbsp; รวมจากการโอน <b>{fmtBaht(wk.total)}</b> &nbsp; รวมทั้งสิ้น <b>{fmtBaht(grand)}</b> บาท</p>
        {note && <p className="small">หมายเหตุ: {note}</p>}
        <div className="sign" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>ลงชื่อผู้ตรวจนับ 1{saved && <><br /><span className="small">{saved.counter.name}</span></>}</div>
          <div>ลงชื่อผู้ตรวจนับ 2{saved?.verifier && <><br /><span className="small">{saved.verifier.name}</span></>}</div>
        </div>
      </section>
    </>
  )
}
