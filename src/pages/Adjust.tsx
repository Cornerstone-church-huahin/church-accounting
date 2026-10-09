import { useMemo, useRef, useState } from 'react'
import CaptureBar from '../components/CaptureBar'
import MoneyInput from '../components/MoneyInput'
import Sheet from '../components/Sheet'
import WeekBar from '../components/WeekBar'
import { can } from '../lib/access'
import { useAccounts, useFundMoves, useOpening, useBudgetEntries, useBudgetLines, useExpenseCats, useExpenses, useFunds, useIncome, useIncomeTypes, usePassbook, useRounds, useVouchers, useWeekCloses } from '../lib/data'
import { ensureGemini, readPassbook } from '../lib/gemini'
import { useRole } from '../lib/members'
import { addDays, fmtBaht, fmtDate, newId, sheetSunday, sundaysOf, todayISO } from '../lib/money'
import { fundLedger, suggestMoves } from '../lib/funds'
import { CODE_LEGEND, typeFromNote, chainGap, checkChain, classify, dedupeLines, dupIndexes, lineWeek, normalizeRows, reconcileWeek } from '../lib/passbook'
import type { PassbookLine } from '../lib/types'
import { computeLedger, rangeOf } from '../lib/weekLedger'

type Sub = 'prep' | 'photo' | 'check' | 'close'
interface Draft { date: string; code: string; desc: string; deposit: number | null; withdraw: number | null; balance: number | null }
const KIND_LABEL: Record<PassbookLine['kind'], string> = { deposit: 'ฝากเงินสด', in: 'โอนเข้า', withdraw: 'ถอนเงินสด', out: 'โอนออก', other: 'ดอกเบี้ย/ค่าธรรมเนียม' }

/** ขั้น "ปรับ": เตรียมเบิก → ถ่ายรูปสมุด → ตรวจจับคู่ → ปิดยอดสัปดาห์ */
export default function Adjust({ year }: { year: number }) {
  const role = useRole()
  const canWrite = can(role, 'statement')
  const pb = usePassbook(year)
  const closes = useWeekCloses(year)
  const income = useIncome(year)
  const exp = useExpenses(year)
  const rounds = useRounds(year)
  const vouchers = useVouchers(year)
  const lines = useBudgetLines(year)
  const funds = useFunds()
  const entries = useBudgetEntries(year)
  const types = useIncomeTypes()
  const cats = useExpenseCats()
  const accounts = useAccounts()
  const moves = useFundMoves(year)
  const openingStore = useOpening()
  const restrictedIds = useMemo(() => accounts.list.filter((a) => a.role === 'restricted').map((a) => a.id), [accounts.list])
  const [acctId, setAcctId] = useState('')
  const acctName = (id?: string) => { const a = accounts.list.find((x) => x.id === id); return a ? `${a.name}${a.last4 ? ` …${a.last4}` : ''}` : '' }
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => { const s = sheetSunday(todayISO()); return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0]) })
  const [sub, setSub] = useState<Sub>('prep')
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const readToken = useRef(0)
  const [msg, setMsg] = useState('')
  const [asIncome, setAsIncome] = useState<{ id: string; typeId: string } | null>(null)

  const pending = exp.items.filter((x) => x.status === 'open')
  const pendingSum = pending.reduce((s, x) => s + x.amount, 0)
  const rec = useMemo(() => reconcileWeek(sunday, pb.items, income.items, restrictedIds), [sunday, pb.items, income.items, restrictedIds])
  const L = useMemo(() => computeLedger({ range: rangeOf('week', year, { sunday }), income: income.items, rounds: rounds.items, vouchers: vouchers.items, lines: lines.items, funds: funds.items, entries: entries.items, types: types.list, cats: cats.list, expenses: exp.items, passbook: pb.items }), [sunday, year, income.items, rounds.items, vouchers.items, lines.items, funds.items, entries.items, types.list, cats.list, exp.items, pb.items])
  const byWeek = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of pb.items) { const w = lineWeek(l); m.set(w, (m.get(w) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [pb.items])
  const weeksNav = byWeek.length > 0 && (
    <div className="weekchips" aria-label="สัปดาห์ที่มีรายการจากสมุด">
      <span className="muted small">สัปดาห์ที่มีรายการจากสมุด:</span>
      {byWeek.map(([w, n]) => (
        <button key={w} type="button" className={`mini${w === sunday ? ' on' : ''}`} onClick={() => { if (sundays.includes(w)) { setSunday(w); setSub('check') } }}>
          {fmtDate(w)} · {n} บรรทัด{closes.items.some((c) => c.sunday === w) ? ' ✓' : ''}
        </button>
      ))}
    </div>
  )
  const closed = closes.items.find((c) => c.sunday === sunday)
  const weekLines = pb.items.filter((l) => lineWeek(l) === sunday).sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)

  const read = async (file: File) => {
    const token = ++readToken.current
    setBusy(true); setMsg('')
    try {
      if (!(await ensureGemini()).key) { setMsg('ยังไม่ได้ใส่รหัส Gemini — ให้แอดมินใส่ที่ ตั้งค่า › ตัวอ่านใบถวาย (Gemini)'); if (token === readToken.current) setBusy(false); return }
      const r = await readPassbook(file)
      if (token !== readToken.current) return // ผู้ใช้กดปิดระหว่างอ่าน
      if (r.rows.length === 0) setMsg('อ่านไม่เจอรายการในรูป — ลองถ่ายให้เห็นทั้งหน้า ไม่เอียง แล้วถ่ายใหม่')
      setDrafts(normalizeRows(r.rows).map((x) => ({ date: x.date ?? '', code: x.code ?? '', desc: x.desc ?? '', deposit: x.deposit ?? null, withdraw: x.withdraw ?? null, balance: x.balance ?? null })))
    } catch (e) { if (token === readToken.current) setMsg(e instanceof Error ? e.message : 'อ่านรูปไม่สำเร็จ') }
    if (token === readToken.current) setBusy(false)
  }
  const bad = drafts ? new Set(checkChain(drafts.map((d) => ({ deposit: d.deposit ?? 0, withdraw: d.withdraw ?? 0, balance: d.balance ?? undefined })))) : new Set<number>()
  const dupSet = useMemo(() => drafts ? dupIndexes(pb.items, drafts.map((d) => ({ date: d.date, amount: (d.deposit ?? 0) > 0 ? (d.deposit as number) : (d.withdraw ?? 0), ...(d.balance !== null ? { balance: d.balance } : {}) }))) : new Set<number>(), [drafts, pb.items])
  const upd = (i: number, patch: Partial<Draft>) => setDrafts((xs) => xs && xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const saveDrafts = () => {
    if (!drafts) return
    if (drafts.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.date))) return setMsg('ใส่วันที่ให้ครบทุกบรรทัด')
    const fresh: PassbookLine[] = drafts.filter((d) => (d.deposit ?? 0) > 0 || (d.withdraw ?? 0) > 0).map((d) => ({
      id: newId('pb'), updated: 0, date: d.date, kind: classify({ code: d.code, desc: d.desc, deposit: d.deposit ?? 0, withdraw: d.withdraw ?? 0 }), dir: (d.deposit ?? 0) > 0 ? 'in' : 'out', ...(acctId ? { accountId: acctId } : {}),
      amount: (d.deposit ?? 0) > 0 ? (d.deposit as number) : (d.withdraw as number), ...(d.balance !== null ? { balance: d.balance } : {}), ...(d.desc ? { desc: d.desc } : {}),
    }))
    const add = dedupeLines(pb.items, fresh)
    if (add.length === 0) { setDrafts(null); return setMsg(`ทุกบรรทัด (${fresh.length}) มีอยู่แล้ว ไม่มีรายการใหม่ ไม่ได้บันทึกซ้ำ`) }
    if (!pb.put(add)) return setMsg('สิทธิ์ของท่านบันทึกไม่ได้')
    // ทุกบรรทัดเข้าสัปดาห์ตามวันที่ของตัวเอง · เปิดสัปดาห์ล่าสุดที่ได้ข้อมูล แล้วดูสัปดาห์อื่นได้จากแถบสัปดาห์
    const weeks = [...new Set(add.map((l) => lineWeek(l)))].sort()
    const newest = [...weeks].reverse().find((w) => sundays.includes(w))
    if (newest) setSunday(newest)
    setDrafts(null); setMsg(`บันทึก ${add.length} บรรทัด แยกเข้า ${weeks.length} สัปดาห์ตามวันที่${fresh.length - add.length ? ` (ข้าม ${fresh.length - add.length} บรรทัดที่มีอยู่แล้ว)` : ''}`)
    setSub('check')
  }
  const toIncome = (l: PassbookLine, typeId: string) => {
    const id = newId('in')
    income.put([{ id, updated: 0, date: l.date, typeId, amount: l.amount, method: 'transfer', note: 'ลงจากสมุดบัญชี (ไม่มีสลิป)', source: 'manual' }])
    pb.put([{ ...l, link: { kind: 'income', id } }])
    setAsIncome(null)
  }
  const closing = rec.closing
  // ---- กองทุนวัตถุประสงค์: ค้างย้าย = ยอดยกมา + รายรับกองทุน (ตั้งแต่วันตัดยอด) − ที่ย้ายเข้าบัญชีวัตถุประสงค์แล้ว ----
  const opening = openingStore.opening
  const yStart = `${year}-01-01`
  const fundFrom = opening?.date && opening.date >= yStart && opening.date <= `${year}-12-31` ? addDays(opening.date, 1) : yStart
  const fundRecv = useMemo(() => {
    const Lf = computeLedger({ range: { from: fundFrom, to: `${year}-12-31` }, income: income.items, rounds: rounds.items, vouchers: [], lines: [], funds: [], entries: [], types: types.list, passbook: pb.items })
    return Object.fromEntries(Lf.incRows.map((r) => [r.key, r.cash.amt + r.transfer.amt])) as Record<string, number>
  }, [fundFrom, year, income.items, rounds.items, types.list, pb.items])
  const fundRows = useMemo(() => fundLedger(types.list, fundRecv, moves.items, opening), [types.list, fundRecv, moves.items, opening])
  const unmovedTotal = fundRows.reduce((s, r) => s + Math.max(0, r.unmoved), 0)
  const moveSugg = useMemo(() => suggestMoves(pb.items, accounts.list).filter((m) => lineWeek(m.out) === sunday || lineWeek(m.into) === sunday), [pb.items, accounts.list, sunday])
  const [alloc, setAlloc] = useState<{ outId: string; vals: Record<string, number | null> } | null>(null)
  const startAlloc = (outId: string, amount: number) => {
    let left = amount
    const vals: Record<string, number | null> = {}
    for (const r of fundRows) { const v = Math.min(Math.max(0, r.unmoved), left); vals[r.id] = v > 0 ? v : null; left -= v }
    setAlloc({ outId, vals })
  }
  const confirmMove = (m: { out: PassbookLine; into: PassbookLine }) => {
    if (!alloc) return
    const a = Object.fromEntries(Object.entries(alloc.vals).filter(([, v]) => v && v > 0)) as Record<string, number>
    const sum = Object.values(a).reduce((x, y) => x + y, 0)
    if (sum !== m.out.amount) return setMsg(`แบ่งเข้ากองทุนรวม ${fmtBaht(sum)} ต้องเท่ากับยอดย้าย ${fmtBaht(m.out.amount)}`)
    const id = newId('mv')
    moves.put([{ id, updated: 0, date: m.into.date, amount: m.out.amount, alloc: a, fromLineId: m.out.id, toLineId: m.into.id }])
    pb.put([{ ...m.out, link: { kind: 'move', id } }, { ...m.into, link: { kind: 'move', id } }])
    setAlloc(null); setMsg('บันทึกการย้ายเงินเข้ากองทุนแล้ว')
  }
  const cashIn = L.inSum.cash
  const depDiff = rec.depositSum - cashIn
  const tabBtn = (k: Sub, n: number, text: string) => <button type="button" role="tab" aria-selected={sub === k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}><i className="dot">{n}</i><span>{text}</span></button>
  const lineRow = (l: PassbookLine, extra?: React.ReactNode) => (
    <li key={l.id} className="pbline">
      <div><b>{fmtBaht(l.amount)}</b> <span className="badge">{KIND_LABEL[l.kind]}</span> <span className="muted small">{fmtDate(l.date)}{l.desc ? ` · ${l.desc}` : ''}</span></div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {extra}
        {(l.kind === 'out' || (l.kind === 'other' && l.dir === 'out')) && (l.link?.kind === 'park' ? <span className="badge">พักไว้</span> : <><span className="badge badge--warn">ไม่ทราบรายจ่าย</span>{canWrite && !closed && <button type="button" className="mini" onClick={() => pb.put([{ ...l, link: { kind: 'park' } }])}>พักไว้</button>}</>)}
        {canWrite && !closed && lineWeek(l) === sunday && <button type="button" className="mini" onClick={() => pb.put([{ ...l, week: addDays(sunday, -7) }])}>← ไปสัปดาห์ก่อน</button>}
        {canWrite && !closed && <button type="button" className="mini" aria-label="ลบบรรทัดนี้" onClick={() => { if (confirm('ลบบรรทัดนี้ออกจากสมุดที่บันทึกไว้?')) pb.remove(l.id) }}>🗑</button>}
      </div>
    </li>
  )

  return (
    <>
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <div className="subtabs subtabs--adj no-print" role="tablist" aria-label="ขั้นตอนปรับสมุดบัญชี">
        {tabBtn('prep', 1, 'ก่อนไปธนาคาร')}{tabBtn('photo', 2, 'ถ่ายรูปสมุด')}{tabBtn('check', 3, 'ตรวจจับคู่')}{tabBtn('close', 4, 'ปิดสัปดาห์')}
      </div>
      {weeksNav}
      {closed && <p className="badge badge--good" role="status">✓ สัปดาห์นี้ปิดยอดแล้ว{closed.bankBalance !== undefined ? ` · คงเหลือตามสมุด ${fmtBaht(closed.bankBalance)}` : ''}</p>}

      {busy && (
        <Sheet title="แนบรูปหน้าสมุดบัญชี" onClose={() => { readToken.current++; setBusy(false) }}>
          <div role="status" aria-live="polite"><p><b>กำลังอ่านสมุดบัญชี…</b></p><progress style={{ width: '100%' }} /><p className="muted small">ใช้เวลาประมาณ 5–20 วินาที (ถ้ารูปตะแคงอาจนานขึ้นเล็กน้อย)</p></div>
        </Sheet>
      )}
      {sub === 'prep' && (
        <section className="card no-print" role="tabpanel" aria-label="ก่อนไปธนาคาร">
          <h2>1 · ก่อนไปธนาคาร</h2>
          <p className="muted small">วันอาทิตย์ให้ฝากเงินสดตามยอดใบถวาย · วันจันทร์ถอนเงินตามยอดด้านล่าง แล้วปรับสมุดและถ่ายรูปหน้าสมุดในขั้นที่ 2</p>
          <p><b>ต้องเตรียมเบิก {fmtBaht(pendingSum)}</b> <span className="muted small">({pending.length} รายการ)</span></p>
          {pending.length === 0 ? <p className="muted">ไม่มีบิลค้างจ่ายหรือสำรองจ่ายที่รอคืนเงิน</p> : (
            <ul className="plain">{pending.map((x) => <li key={x.id}>{x.channel === 'bill' ? 'วางบิล' : 'สำรองจ่าย'} · {x.desc}{x.who ? ` · ${x.who}` : ''} · <b>{fmtBaht(x.amount)}</b></li>)}</ul>
          )}
          <p className="small">เงินสดรับสัปดาห์นี้ (ตามใบถวาย) ที่ควรฝาก: <b>{fmtBaht(cashIn)}</b></p>
          {fundRows.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>เงินวัตถุประสงค์ที่ยังอยู่ในบัญชีหมุนเวียน</h3>
              <table className="tbl tbl--paper" aria-label="ค้างย้ายเข้ากองทุน">
                <thead><tr><th>กองทุน</th><th className="num">รับ</th><th className="num">ย้ายแล้ว</th><th className="num">ค้างย้าย</th></tr></thead>
                <tbody>{fundRows.map((r) => <tr key={r.id}><td>{r.name}</td><td className="num">{fmtBaht(r.received)}</td><td className="num">{fmtBaht(r.moved)}</td><td className="num"><b>{fmtBaht(r.unmoved)}</b></td></tr>)}</tbody>
                <tfoot><tr><td colSpan={3}>รวมค้างย้าย (ยังไม่ใช่เงินหมุนเวียน)</td><td className="num">{fmtBaht(unmovedTotal)}</td></tr></tfoot>
              </table>
              {closing !== undefined && <p className="small">ยอดคงเหลือบัญชีหมุนเวียนตามสมุด {fmtBaht(closing)} − ค้างย้าย {fmtBaht(unmovedTotal)} = <b>เงินหมุนเวียนที่ใช้ได้จริง {fmtBaht(closing - unmovedTotal)}</b></p>}
              <p className="muted small">นับจาก{opening ? `ยอดยกมา ${fmtDate(opening.date)}` : ' 1 ม.ค.'} · ตอนย้ายเงินเข้าบัญชีวัตถุประสงค์ ให้ไปที่ช่อง 3 เพื่อบันทึกการย้าย</p>
            </>
          )}
        </section>
      )}

      {sub === 'photo' && (
        <section className="card no-print" role="tabpanel" aria-label="ถ่ายรูปสมุด">
          <h2>2 · ถ่ายรูปหน้าสมุดบัญชี</h2>
          <p className="muted small">ปรับสมุดแล้วถ่ายหน้าที่เพิ่งพิมพ์ให้เห็นทั้งหน้า ระบบอ่านให้ แล้วตรวจยอดคงเหลือทีละบรรทัด (ถ่ายแนวตั้งหรือแนวนอนก็ได้) อย่าให้เห็นเลขบัญชีในรูป</p>
          {canWrite && !drafts && (
            <div className="field">
              <label htmlFor="pb-acct">สมุดบัญชีเล่มไหน</label>
              <select id="pb-acct" className="input" value={acctId} onChange={(e) => setAcctId(e.target.value)}>
                <option value="">ไม่ระบุ</option>
                {accounts.list.map((a) => <option key={a.id} value={a.id}>{acctName(a.id)}{a.role === 'operating' ? ' · หมุนเวียน' : a.role === 'restricted' ? ' · วัตถุประสงค์' : ''}</option>)}
              </select>
              {accounts.list.length === 0 && <p className="muted small">ยังไม่มีบัญชี — เพิ่มที่ ตั้งค่า › บัญชีธนาคาร (ตั้งประเภท หมุนเวียน/วัตถุประสงค์) เพื่อแยกสมุดแต่ละเล่ม</p>}
            </div>
          )}
          {canWrite && !drafts && <CaptureBar noun="หน้าสมุด" onFile={(f) => void read(f)} busy={busy} />}
          {msg && <p className="note" role="status">{msg}</p>}
          {drafts && (
            <>
              {dupSet.size > 0 && <p className="note" role="status">{dupSet.size} จาก {drafts.length} บรรทัดมีอยู่แล้ว (ถ่ายหน้าเดิมทับกัน) — ระบบจะข้ามให้ บันทึกเฉพาะ {drafts.length - dupSet.size} บรรทัดใหม่</p>}
              <p className="small">ตรวจให้ตรงกับสมุด · บรรทัดสีแดง = ยอดคงเหลือไม่ลงตัวกับบรรทัดก่อนหน้า (น่าจะอ่านผิด) แก้แล้วจึงบันทึก</p>
              {drafts.map((d, i) => (
                <div key={i} className="pbdraft" style={{ ...(bad.has(i) ? { borderColor: 'var(--bad)' } : {}), ...(dupSet.has(i) ? { opacity: 0.55 } : {}) }}>
                  {dupSet.has(i) && <p className="small"><span className="badge">✓ มีอยู่แล้ว — จะไม่บันทึกซ้ำ</span></p>}
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input" type="date" aria-label={`วันที่ บรรทัด ${i + 1}`} value={d.date} onChange={(e) => upd(i, { date: e.target.value })} />
                    <input className="input" aria-label={`รายการ บรรทัด ${i + 1}`} value={d.desc} placeholder="รายการ" onChange={(e) => upd(i, { desc: e.target.value })} />
                    <button type="button" className="mini" aria-label="ลบบรรทัด" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>×</button>
                  </div>
                  <div className="grid3">
                    <label className="small">ฝาก<MoneyInput value={d.deposit} onChange={(v) => upd(i, { deposit: v })} /></label>
                    <label className="small">ถอน<MoneyInput value={d.withdraw} onChange={(v) => upd(i, { withdraw: v })} /></label>
                    <label className="small">คงเหลือ<MoneyInput value={d.balance} onChange={(v) => upd(i, { balance: v })} /></label>
                  </div>
                  {bad.has(i) && (() => {
                    const gap = chainGap(drafts.map((x) => ({ deposit: x.deposit ?? 0, withdraw: x.withdraw ?? 0, balance: x.balance ?? undefined })), i)
                    const prev = drafts[i - 1]?.balance
                    return gap !== 0 && prev !== null && prev !== undefined ? (
                      <p className="small err">ยอดคงเหลือต่างจากบรรทัดก่อน {fmtBaht(Math.abs(gap))} ({gap > 0 ? 'เงินเข้า' : 'เงินออก'}) — อาจมีบรรทัดตกหล่น หรืออ่านตัวเลขผิด{' '}
                        <button type="button" className="mini" onClick={() => setDrafts((xs) => xs && [...xs.slice(0, i), { date: d.date, code: '', desc: '', deposit: gap > 0 ? gap : null, withdraw: gap < 0 ? -gap : null, balance: prev + gap }, ...xs.slice(i)])}>＋ เพิ่มบรรทัดที่ตกหล่น</button></p>
                    ) : null
                  })()}
                </div>
              ))}
              {bad.size > 0 && <p className="err" role="alert">มี {bad.size} บรรทัดที่ยอดคงเหลือไม่ลงตัว — ตรวจกับสมุดก่อน (บันทึกต่อได้ถ้าสมุดพิมพ์เป็นอย่างนั้นจริง)</p>}
              <div className="row"><button type="button" className="btn btn--gold grow" onClick={saveDrafts}>บันทึกและไปตรวจจับคู่</button><button type="button" className="btn btn--ghost" onClick={() => setDrafts(null)}>ยกเลิก</button></div>
            </>
          )}
        </section>
      )}

      {sub === 'check' && (
        <section className="card no-print" role="tabpanel" aria-label="ตรวจจับคู่">
          <h2>3 · ตรวจจับคู่ — สัปดาห์นี้</h2>
          {weekLines.length === 0 ? <p className="muted">ยังไม่มีบรรทัดจากสมุดในสัปดาห์นี้ — ถ่ายรูปสมุดในขั้นที่ 2 ก่อน</p> : (
            <>
              <div className="stats">
                <p>ฝากเงินสดในสมุด <b>{fmtBaht(rec.depositSum)}</b> · เงินสดตามใบถวาย <b>{fmtBaht(cashIn)}</b> · {depDiff === 0 ? <span className="ok">ตรงกัน ✓</span> : <span className="err">ต่างกัน {fmtBaht(Math.abs(depDiff))} ({depDiff > 0 ? 'ฝากมากกว่า' : 'ฝากน้อยกว่า'}ใบถวาย)</span>}</p>
                <p>โอนเข้า: จับคู่กับสลิปแล้ว <b>{rec.matchedIn.length}</b> · ไม่มีสลิป (นับในใบสรุปเป็น “ไม่ทราบที่มา”) <b className={rec.unmatchedIn.length ? 'err' : ''}>{rec.unmatchedIn.length}</b>{rec.unmatchedSlips.length > 0 && <> · สลิปที่ยังไม่เห็นในสมุด <b>{rec.unmatchedSlips.length}</b> ({fmtBaht(rec.unmatchedSlips.reduce((s, x) => s + x.amount, 0))})</>}</p>
                <p>ถอนเงินสดสัปดาห์นี้ <b>{fmtBaht(rec.withdrawSum)}</b> · รายจ่ายเงินสดที่จ่ายแล้ว <b>{fmtBaht(L.outSum.cash)}</b></p>
                <p>ยอดคงเหลือตามสมุด ณ สิ้นสัปดาห์: <b>{closing !== undefined ? fmtBaht(closing) : '—'}</b></p>
                {Object.keys(rec.closingBy).length > 1 || (Object.keys(rec.closingBy)[0] ?? '') !== '' ? <p className="small">{Object.entries(rec.closingBy).map(([id, v]) => `${acctName(id) || 'ไม่ระบุบัญชี'}: ${fmtBaht(v)}`).join(' · ')}</p> : null}
              </div>
              {moveSugg.length > 0 && (
                <div className="note" role="region" aria-label="ย้ายเงินเข้ากองทุน">
                  <b>พบการย้ายเงินระหว่างบัญชี (ถอนจากหมุนเวียน → ฝากเข้าวัตถุประสงค์)</b>
                  {moveSugg.map((m) => (
                    <div key={m.out.id} style={{ marginTop: 6 }}>
                      <p className="small">ถอน {fmtBaht(m.out.amount)} ({acctName(m.out.accountId)} · {fmtDate(m.out.date)}) → ฝาก ({acctName(m.into.accountId)} · {fmtDate(m.into.date)})</p>
                      {alloc?.outId === m.out.id ? (
                        <>
                          {fundRows.map((r) => <div className="field" key={r.id}><label>{r.name} (ค้างย้าย {fmtBaht(r.unmoved)})</label><MoneyInput value={alloc.vals[r.id] ?? null} onChange={(v) => setAlloc({ ...alloc, vals: { ...alloc.vals, [r.id]: v } })} /></div>)}
                          <div className="row"><button type="button" className="btn btn--gold" onClick={() => confirmMove(m)}>ยืนยันย้ายเข้ากองทุน</button><button type="button" className="btn btn--ghost" onClick={() => setAlloc(null)}>ยกเลิก</button></div>
                        </>
                      ) : canWrite && !closed ? <button type="button" className="mini" onClick={() => startAlloc(m.out.id, m.out.amount)}>แบ่งเข้ากองทุน…</button> : null}
                    </div>
                  ))}
                  <p className="muted small">การย้ายไม่นับเป็นรายรับหรือรายจ่าย</p>
                </div>
              )}
              <p className="muted small">รหัสในสมุด: {CODE_LEGEND}</p>
              <ul className="plain">
                {weekLines.map((l) => lineRow(l, l.kind === 'in' && (rec.matchedIn.find((m) => m.line.id === l.id)
                  ? <span className="badge badge--good">✓ ตรงสลิป</span>
                  : l.link?.kind === 'park' ? <span className="badge">พักไว้</span>
                  : canWrite && !closed ? (asIncome?.id === l.id ? (
                    <span className="row" style={{ gap: 6 }}>
                      <select className="input" aria-label="ประเภทถวาย" value={asIncome.typeId} onChange={(e) => setAsIncome({ id: l.id, typeId: e.target.value })}>{types.list.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                      <button type="button" className="mini" onClick={() => toIncome(l, asIncome.typeId)}>ลงรายรับ</button>
                    </span>
                  ) : <>
                    {(() => { const tid = typeFromNote(l.desc, types.list); const tn = tid ? types.list.find((t) => t.id === tid)?.name : undefined; return tn ? <span className="badge badge--good">นับเป็น {tn} (ตามหมายเหตุ)</span> : <span className="badge badge--warn">ไม่ทราบที่มา</span> })()}
                    <button type="button" className="mini" onClick={() => setAsIncome({ id: l.id, typeId: types.list.find((t) => t.active)?.id ?? '' })}>ลงเป็นรายรับ</button>
                    <button type="button" className="mini" onClick={() => pb.put([{ ...l, link: { kind: 'park' } }])}>พักไว้</button>
                  </>) : <span className="badge">ไม่มีสลิป</span>)))}
              </ul>
            </>
          )}
        </section>
      )}

      {sub === 'close' && (
        <section className="card no-print" role="tabpanel" aria-label="ปิดสัปดาห์">
          <h2>4 · ปิดสัปดาห์</h2>
          <ul className="plain">
            <li>{weekLines.length > 0 ? '✓' : '✗'} มีบรรทัดจากสมุดในสัปดาห์นี้ ({weekLines.length})</li>
            <li>{depDiff === 0 && rec.deposits.length > 0 ? '✓' : '△'} ฝากเงินสดตรงกับใบถวาย{rec.deposits.length === 0 ? ' (ยังไม่มีรายการฝาก)' : depDiff === 0 ? '' : ` (ต่างกัน ${fmtBaht(Math.abs(depDiff))})`}</li>
            <li>{rec.unmatchedIn.filter((l) => !l.link).length === 0 ? '✓' : '△'} โอนเข้าทุกรายการมีสลิปหรือจัดการแล้ว (เหลือ {rec.unmatchedIn.filter((l) => !l.link).length})</li>
            <li>ยอดคงเหลือตามสมุด: <b>{closing !== undefined ? fmtBaht(closing) : '—'}</b></li>
          </ul>
          <p className="muted small">ปิดสัปดาห์ได้แม้ยังมีรายการค้าง (△) — ใบสรุปจะแสดงว่าตรวจกับสมุดแล้ว พร้อมยอดคงเหลือตามสมุด</p>
          {canWrite && (closed
            ? <button type="button" className="btn btn--ghost" onClick={() => closes.remove(closed.id)}>เปิดสัปดาห์นี้ใหม่</button>
            : <button type="button" className="btn btn--gold" disabled={weekLines.length === 0} onClick={() => closes.put([{ id: `wc-${sunday}`, updated: 0, sunday, ...(closing !== undefined ? { bankBalance: closing } : {}) }])}>✓ ยืนยันปิดสัปดาห์</button>)}
          <p className="small" style={{ marginTop: 8 }}>เสร็จแล้วไปแท็บ 📊 สรุป เพื่อดาวน์โหลดหรือพิมพ์ใบสรุปไปแปะประกาศ</p>
        </section>
      )}
    </>
  )
}
