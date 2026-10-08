import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { can } from '../lib/access'
import { useIncome, useIncomeTypes, useRounds } from '../lib/data'
import { roundTotal } from '../lib/ledger'
import { useRole } from '../lib/members'
import { addDays, fmtBaht, fmtDate, fmtDateLong, sheetSunday, sundaysOf, todayISO, yearOf } from '../lib/money'
import { UNSORTED, type IncomeEntry } from '../lib/types'
import { IncomeForm } from './Income'

type Sub = 'manual' | 'slip' | 'sheet' | null

/** แต่ละรายการอยู่ช่องไหน: ใบถวาย (มาจากรอบนับ) · สลิป · ไม่ทราบที่มา · บันทึกด้วยมือ */
const kindOf = (x: IncomeEntry): 'sheet' | 'slip' | 'unknown' | 'manual' =>
  x.roundId ? 'sheet' : x.unknown ? 'unknown' : x.source === 'slip' || (!x.source && (x.slip || x.method === 'transfer')) ? 'slip' : 'manual'

const byDateDesc = (a: IncomeEntry, b: IncomeEntry) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updated - a.updated)

/** โหมด "รับ": ช่อง 1 บันทึกด้วยมือ · 2 บันทึกสลิป · 3 ใบบันทึกการถวาย → รวมเป็นใบสรุปรายสัปดาห์ (4) ใบเดียว */
export default function Receive({ year }: { year: number }) {
  const role = useRole()
  const inc = useIncome(year)
  const rounds = useRounds(year)
  const types = useIncomeTypes()
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const s = sheetSunday(todayISO())
    return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0])
  })
  const [sub, setSub] = useState<Sub>(null)
  const [form, setForm] = useState<{ entry: IncomeEntry | null; preset: 'manual' | 'slip' } | null>(null)
  const canWrite = can(role, 'income')
  const idx = sundays.indexOf(sunday)

  const week = useMemo(() => inc.items.filter((x) => sheetSunday(x.date) === sunday && !x.roundId).sort(byDateDesc), [inc.items, sunday])
  const manual = week.filter((x) => kindOf(x) === 'manual')
  const slips = week.filter((x) => kindOf(x) === 'slip')
  const unknown = week.filter((x) => kindOf(x) === 'unknown')
  const round = rounds.items.find((r) => r.date === sunday)
  const sum = (xs: IncomeEntry[]) => xs.reduce((s, x) => s + x.amount, 0)
  const cash = round ? roundTotal(round) : 0
  const total = cash + sum(week)
  const typeName = (id: string) => (id === UNSORTED ? 'โอน (ยังไม่แยกประเภท)' : types.byId(id)?.name ?? '(ประเภทที่ถูกลบ)')
  const perType = useMemo(() => {
    const m = new Map<string, { cash: number; transfer: number }>()
    const add = (id: string, k: 'cash' | 'transfer', v: number) => { const c = m.get(id) ?? { cash: 0, transfer: 0 }; c[k] += v; m.set(id, c) }
    if (round) for (const [id, v] of Object.entries(round.lines)) if (v > 0) add(id, 'cash', v)
    for (const x of week) add(x.unknown ? UNSORTED : x.typeId, x.method === 'cash' ? 'cash' : 'transfer', x.amount)
    return [...m.entries()]
  }, [round, week])

  const row = (x: IncomeEntry, preset: 'manual' | 'slip') => (
    <li key={x.id}>
      <button type="button" className="item" style={{ width: '100%', textAlign: 'left' }} disabled={!canWrite} onClick={() => setForm({ entry: x, preset })}>
        <span className="grow"><b>{typeName(x.typeId)}</b><br /><span className="small muted">บันทึกวันที่ {fmtDate(x.date)}{x.ref ? ` · อ้างอิง ${x.ref}` : ''}{x.slip ? ' · 📎สลิป' : ''}{x.note ? ` · ${x.note}` : ''}</span></span>
        <b className="num">{fmtBaht(x.amount)}</b>
      </button>
    </li>
  )

  return (
    <>
      <div className="no-print" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" disabled={idx <= 0} onClick={() => setSunday(sundays[idx - 1])}>‹</button>
        <b style={{ textAlign: 'center' }}>{fmtDateLong(sunday)}</b>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" disabled={idx >= sundays.length - 1} onClick={() => setSunday(sundays[idx + 1])}>›</button>
      </div>
      <p className="muted small no-print" style={{ textAlign: 'center' }}>{fmtDate(addDays(sunday, -6))} – {fmtDate(sunday)}</p>

      <div className="subtabs no-print" role="tablist" aria-label="ช่องบันทึกเงินรับ">
        <button type="button" role="tab" aria-selected={sub === 'manual'} className={sub === 'manual' ? 'on' : ''} onClick={() => setSub(sub === 'manual' ? null : 'manual')}>1<span>บันทึกด้วยมือ</span></button>
        <button type="button" role="tab" aria-selected={sub === 'slip'} className={sub === 'slip' ? 'on' : ''} onClick={() => setSub(sub === 'slip' ? null : 'slip')}>2<span>บันทึกสลิป</span></button>
        <button type="button" role="tab" aria-selected={sub === 'sheet'} className={sub === 'sheet' ? 'on' : ''} onClick={() => setSub(sub === 'sheet' ? null : 'sheet')}>3<span>ใบบันทึกการถวาย</span></button>
      </div>

      {sub === 'manual' && (
        <section className="card no-print" role="tabpanel" aria-label="บันทึกด้วยมือ">
          <div className="row row--between"><h2>1 · บันทึกด้วยมือ</h2>{canWrite && <button type="button" className="btn btn--gold" onClick={() => setForm({ entry: null, preset: 'manual' })}>＋ บันทึก</button>}</div>
          <p className="muted small">เงินที่ถวายเข้ามานอกใบถวาย เช่น ค่าเช่า ถวายพิเศษ — บันทึกได้ทุกวัน ระบุวันที่ของแต่ละรายการ</p>
          {manual.length === 0 ? <p className="muted small">ยังไม่มีรายการในสัปดาห์นี้</p> : <ul className="list">{manual.map((x) => row(x, 'manual'))}</ul>}
        </section>
      )}
      {sub === 'slip' && (
        <section className="card no-print" role="tabpanel" aria-label="บันทึกสลิป">
          <div className="row row--between"><h2>2 · บันทึกสลิป</h2>{canWrite && <button type="button" className="btn btn--gold" onClick={() => setForm({ entry: null, preset: 'slip' })}>＋ แนบสลิป</button>}</div>
          <p className="muted small">สลิปโอนเงิน — แนบไปเรื่อย ๆ ระหว่างสัปดาห์ ระบุวันที่ของแต่ละสลิป</p>
          {slips.length + unknown.length === 0 ? <p className="muted small">ยังไม่มีสลิปในสัปดาห์นี้</p> : <ul className="list">{[...slips, ...unknown].map((x) => row(x, 'slip'))}</ul>}
        </section>
      )}
      {sub === 'sheet' && (
        <section className="card no-print" role="tabpanel" aria-label="ใบบันทึกการถวาย">
          <h2>3 · ใบบันทึกการถวาย</h2>
          <p className="muted small">กรอกวันอาทิตย์หลังนับซองและนับเงิน</p>
          <Link className="item" to={`/rounds/${sunday}`} style={{ textDecoration: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="grow"><b>{fmtDateLong(sunday)}</b><br /><span className="small muted">{!round ? 'ยังไม่ได้บันทึกยอดนับ — แตะเพื่อเริ่ม' : round.status === 'counting' ? 'รอผู้นับคนที่ 2 ยืนยัน' : !round.deposit ? 'ยืนยันแล้ว รอนำฝาก' : 'ฝากธนาคารแล้ว'}</span></span>
            <b className="num">{round ? fmtBaht(cash) : '＋'}</b>
          </Link>
        </section>
      )}

      <section className="card" aria-labelledby="h-rep">
        <div className="row row--between">
          <h2 id="h-rep">4 · ใบสรุปเงินรับ</h2>
          <button type="button" className="mini no-print" onClick={() => window.print()}>🖨️ พิมพ์</button>
        </div>
        <p className="muted small">สัปดาห์ {fmtDate(addDays(sunday, -6))} – {fmtDate(sunday)} (ใบถวายวันอาทิตย์ที่ {fmtDate(sunday)})</p>
        <table className="tbl">
          <thead><tr><th>ที่มา</th><th className="num">รายการ</th><th className="num">จำนวนเงิน</th></tr></thead>
          <tbody>
            <tr><td>3 · ใบบันทึกการถวาย (เงินสด){round?.status === 'counting' ? ' — รอยืนยัน' : ''}</td><td className="num">{round ? 1 : 0}</td><td className="num">{fmtBaht(cash)}</td></tr>
            <tr><td>1 · บันทึกด้วยมือ</td><td className="num">{manual.length}</td><td className="num">{fmtBaht(sum(manual))}</td></tr>
            <tr><td>2 · สลิปโอน</td><td className="num">{slips.length}</td><td className="num">{fmtBaht(sum(slips))}</td></tr>
            {unknown.length > 0 && <tr><td>❓ เงินเข้าไม่ทราบที่มา</td><td className="num">{unknown.length}</td><td className="num">{fmtBaht(sum(unknown))}</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={2}>รวมรายรับทั้งสัปดาห์</td><td className="num">{fmtBaht(total)}</td></tr></tfoot>
        </table>

        {perType.length > 0 && (
          <>
            <h3>แยกตามประเภทถวาย</h3>
            <table className="tbl">
              <thead><tr><th>ประเภท</th><th className="num">เงินสด</th><th className="num">เงินโอน</th><th className="num">รวม</th></tr></thead>
              <tbody>{perType.map(([id, v]) => <tr key={id}><td>{typeName(id)}</td><td className="num">{fmtBaht(v.cash)}</td><td className="num">{fmtBaht(v.transfer)}</td><td className="num">{fmtBaht(v.cash + v.transfer)}</td></tr>)}</tbody>
            </table>
          </>
        )}
        {week.length > 0 && (
          <>
            <h3>รายการที่บันทึกในสัปดาห์ (ตามวันที่)</h3>
            <table className="tbl">
              <thead><tr><th>วันที่</th><th>รายการ</th><th className="num">จำนวนเงิน</th></tr></thead>
              <tbody>{[...week].reverse().map((x) => <tr key={x.id}><td>{fmtDate(x.date)}</td><td>{typeName(x.typeId)} · {kindOf(x) === 'manual' ? 'มือ' : kindOf(x) === 'unknown' ? 'ไม่ทราบที่มา' : 'สลิป'}</td><td className="num">{fmtBaht(x.amount)}</td></tr>)}</tbody>
            </table>
          </>
        )}
        <div className="sign print-only">
          <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br /><span className="small">วันที่ ........../........../..........</span></div>
          <div>ผู้ตรวจสอบ<br /><span className="small">วันที่ ........../........../..........</span></div>
          <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br /><span className="small">วันที่ ........../........../..........</span></div>
        </div>
      </section>

      {form && <IncomeForm year={year} entry={form.entry} preset={form.preset} defaultDate={yearOf(todayISO()) === year ? todayISO() : undefined} onClose={() => setForm(null)} inc={inc} />}
    </>
  )
}
