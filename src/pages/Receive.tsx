import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { can } from '../lib/access'
import { useIncome, useIncomeTypes, useRounds, useSettings, useSheetFiles } from '../lib/data'
import { roundTotal } from '../lib/ledger'
import { useRole } from '../lib/members'
import Sheet from '../components/Sheet'
import { deleteFile, getSync, listDir } from '../lib/sync'
import { addDays, fmtBaht, fmtDate, fmtDateLong, sheetSunday, sundaysOf, todayISO, yearOf } from '../lib/money'
import { UNSORTED, type IncomeEntry, type SheetFile } from '../lib/types'
import { IncomeForm, type SlipInit } from './Income'
import SheetFlow from './SheetFlow'
import { readSlip } from '../lib/slipOcr'

type Sub = 'manual' | 'slip' | 'sheet' | 'total' | null

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
  const { settings } = useSettings()
  const files = useSheetFiles(year)
  const [pick, setPick] = useState(false)
  const [attach, setAttach] = useState<SheetFile | 'new' | null>(null)
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const s = sheetSunday(todayISO())
    return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0])
  })
  const [sub, setSub] = useState<Sub>(null)
  const [form, setForm] = useState<{ entry: IncomeEntry | null; preset: 'manual' | 'slip' } | null>(null)
  const canWrite = can(role, 'income')
  const idx = sundays.indexOf(sunday)

  const [allWeeks, setAllWeeks] = useState(true)
  const [repScope, setRepScope] = useState<'week' | 'year'>('year')
  const allEnt = useMemo(() => inc.items.filter((x) => !x.roundId).sort(byDateDesc), [inc.items])
  const week = useMemo(() => allEnt.filter((x) => sheetSunday(x.date) === sunday), [allEnt, sunday])
  const byDateF = (a: SheetFile, b: SheetFile) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updated - a.updated)
  const weekFiles = files.items.filter((f) => sheetSunday(f.date) === sunday).sort(byDateF)
  const allFiles = [...files.items].sort(byDateF)
  const round = rounds.items.find((r) => r.date === sunday)
  const cash = round ? roundTotal(round) : 0
  // รายการในการ์ดของช่อง 1–3: สัปดาห์ที่เลือก หรือ "ทุกสัปดาห์"
  const lst = allWeeks ? allEnt : week
  const manual = lst.filter((x) => kindOf(x) === 'manual')
  const slips = lst.filter((x) => kindOf(x) === 'slip' || kindOf(x) === 'unknown')
  const lstFiles = allWeeks ? allFiles : weekFiles
  const otherWeeks = (k: 'manual' | 'slip' | 'sheet') => (k === 'sheet' ? allFiles.length - weekFiles.length : allEnt.filter((x) => sheetSunday(x.date) !== sunday && (k === 'manual' ? kindOf(x) === 'manual' : kindOf(x) === 'slip' || kindOf(x) === 'unknown')).length)
  const sum = (xs: IncomeEntry[]) => xs.reduce((s, x) => s + x.amount, 0)
  // ใบสรุป (4): สัปดาห์ที่เลือก หรือ ทั้งปี
  const rep = repScope === 'year' ? allEnt : week
  const repRounds = repScope === 'year' ? rounds.items : round ? [round] : []
  const typeName = (id: string) => (id === UNSORTED ? 'โอน (ยังไม่แยกประเภท)' : types.byId(id)?.name ?? '(ประเภทที่ถูกลบ)')
  // แยกตามประเภทถวาย และตามที่มา: ตู้ถวาย (ใบถวาย) · โอน (สลิป) · เงินสดบันทึกมือ
  type Src = { n: number; amt: number }
  const perType = useMemo(() => {
    const m = new Map<string, { box: Src; transfer: Src; hand: Src }>()
    const at = (id: string) => { const c = m.get(id) ?? { box: { n: 0, amt: 0 }, transfer: { n: 0, amt: 0 }, hand: { n: 0, amt: 0 } }; m.set(id, c); return c }
    for (const r of repRounds) for (const [id, v] of Object.entries(r.lines)) if (v > 0) { const c = at(id).box; c.amt += v; c.n += r.envelopes?.[id] ?? 1 }
    for (const x of rep) { const c = at(x.unknown ? UNSORTED : x.typeId); const t = x.method === 'transfer' ? c.transfer : c.hand; t.amt += x.amount; t.n += 1 }
    return [...m.entries()]
  }, [repRounds, rep]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ลบรูปที่แนบออกจาก repo ข้อมูลด้วย (ถ้าทำไม่ได้ ไม่เป็นไร — รายการถูกลบแล้ว) */
  const dropFile = async (path?: string) => {
    const cfg = getSync()
    if (!path || !cfg) return
    try {
      const dir = path.slice(0, path.lastIndexOf('/'))
      const f = (await listDir(cfg, dir)).find((x) => x.path === path)
      if (f) await deleteFile(cfg, f.path, f.sha, 'สลิป/ใบถวายที่ลบ')
    } catch { /* ignore */ }
  }
  const delEntry = (x: IncomeEntry) => {
    if (!confirm(`ลบรายการ ${fmtBaht(x.amount)} (${fmtDate(x.date)}) พร้อมรูปสลิปที่แนบ?`)) return
    if (inc.remove(x.id)) void dropFile(x.slip?.path)
  }
  const delFile = (f: SheetFile) => {
    const rd = rounds.items.find((r) => r.sheetFileId === f.id)
    const extra = rd ? (rd.status === 'counting' ? '\nยอดเงินสดที่ระบบใส่ในใบนับจากไฟล์นี้จะถูกลบด้วย' : '\n(ใบนับวันอาทิตย์นี้ยืนยันยอดแล้ว จึงไม่ลบยอด — แก้ที่หน้านับเงิน)') : ''
    if (!confirm(`ลบไฟล์ ${f.file.name} (${fmtDate(f.date)})?${extra}`)) return
    if (files.remove(f.id)) {
      if (rd?.status === 'counting') rounds.remove(rd.id)
      void dropFile(f.file.path)
    }
  }
  const actions = (edit: () => void, del: () => void) => canWrite && (
    <span className="row" style={{ gap: 8, marginTop: 6 }}>
      <button type="button" className="mini" onClick={edit}>✎ แก้ไข</button>
      <button type="button" className="mini" onClick={del}>🗑️ ลบ</button>
    </span>
  )
  const row = (x: IncomeEntry, preset: 'manual' | 'slip') => (
    <li key={x.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span className="grow"><b>{typeName(x.typeId)}</b>{x.memberNo ? <span className="small muted"> · {x.memberNo}</span> : null}<br /><span className="small muted">บันทึกวันที่ {fmtDate(x.date)}{x.time ? ` ${x.time} น.` : ''}{allWeeks ? ` · ใบวันที่ ${fmtDate(sheetSunday(x.date))}` : ''}{x.ref ? ` · อ้างอิง ${x.ref}` : ''}{x.slip ? ' · 📎สลิป' : ''}{x.note && x.source !== 'slip' ? ` · ${x.note}` : ''}</span></span>
        <b className="num">{fmtBaht(x.amount)}</b>
      </div>
      {actions(() => setForm({ entry: x, preset }), () => delEntry(x))}
    </li>
  )

  // บันทึกแล้วสลับไปดูสัปดาห์ของรายการนั้นเลย (เห็นว่าเข้าใบสรุปไหน)
  const goWeek = (d: string) => { const w = sheetSunday(d); if (sundays.includes(w)) setSunday(w) }

  /** หัวการ์ด: จำนวนรายการ + รวม + สลับ "สัปดาห์นี้/ทุกสัปดาห์" */
  const scopeBar = (k: 'manual' | 'slip' | 'sheet', n: number, amt: number) => {
    const other = otherWeeks(k)
    return (
      <div className="row row--between" style={{ margin: '0.4rem 0' }}>
        <b>{n} รายการ · รวม {fmtBaht(amt)}</b>
        {(allWeeks || other > 0) && <button type="button" className="mini" onClick={() => setAllWeeks(!allWeeks)}>{allWeeks ? 'เฉพาะสัปดาห์นี้' : `ดูทุกสัปดาห์ (อีก ${other})`}</button>}
      </div>
    )
  }

  return (
    <>
      <div className="no-print" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" disabled={idx <= 0} onClick={() => setSunday(sundays[idx - 1])}>‹</button>
        <b style={{ textAlign: 'center' }}>{fmtDateLong(sunday)}</b>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" disabled={idx >= sundays.length - 1} onClick={() => setSunday(sundays[idx + 1])}>›</button>
      </div>
      <p className="muted small no-print" style={{ textAlign: 'center' }}>{fmtDate(addDays(sunday, -6))} – {fmtDate(sunday)}</p>

      <div className="subtabs no-print" role="tablist" aria-label="ช่องบันทึกเงินรับ">
        <button type="button" role="tab" aria-selected={sub === 'manual'} className={sub === 'manual' ? 'on' : ''} onClick={() => setSub('manual')}>1<span>บันทึกด้วยมือ{manual.length ? ` (${manual.length})` : ''}</span></button>
        <button type="button" role="tab" aria-selected={sub === 'slip'} className={sub === 'slip' ? 'on' : ''} onClick={() => setSub('slip')}>2<span>บันทึกสลิป{slips.length ? ` (${slips.length})` : ''}</span></button>
        <button type="button" role="tab" aria-selected={sub === 'sheet'} className={sub === 'sheet' ? 'on' : ''} onClick={() => setSub('sheet')}>3<span>ใบบันทึกการถวาย{lstFiles.length ? ` (${lstFiles.length})` : ''}</span></button>
              <button type="button" role="tab" aria-selected={sub === 'total'} className={sub === 'total' ? 'on' : ''} onClick={() => setSub('total')}>4<span>ผลรวม</span></button>
      </div>

      {sub === 'manual' && (
        <section className="card no-print" role="tabpanel" aria-label="บันทึกด้วยมือ">
          <div className="row row--between"><h2>1 · บันทึกด้วยมือ</h2>{canWrite && <button type="button" className="btn btn--gold" onClick={() => setForm({ entry: null, preset: 'manual' })}>＋ บันทึก</button>}</div>
          <p className="muted small">เงินที่ถวายเข้ามานอกใบถวาย เช่น ค่าเช่า ถวายพิเศษ — บันทึกได้ทุกวัน ระบุวันที่ของแต่ละรายการ</p>
          {scopeBar('manual', manual.length, sum(manual))}
          {manual.length === 0 ? <p className="muted small">ยังไม่มีรายการ{allWeeks ? '' : 'ในสัปดาห์นี้'}</p> : <ul className="list">{manual.map((x) => row(x, 'manual'))}</ul>}
        </section>
      )}
      {sub === 'slip' && (
        <section className="card no-print" role="tabpanel" aria-label="บันทึกสลิป">
          <div className="row row--between"><h2>2 · บันทึกสลิป</h2>{canWrite && <button type="button" className="btn btn--gold" onClick={() => setPick(true)}>＋ แนบสลิป</button>}</div>
          <p className="muted small">แนบรูปสลิปโอนเงินไปเรื่อย ๆ ระหว่างสัปดาห์ — ระบบอ่านวันที่ ยอด และเลขอ้างอิงจากสลิปให้ ท่านตรวจแล้วกดยืนยัน</p>
          {scopeBar('slip', slips.length, sum(slips))}
          {slips.length === 0 ? <p className="muted small">ยังไม่มีสลิป{allWeeks ? '' : 'ในสัปดาห์นี้'}</p> : <ul className="list">{slips.map((x) => row(x, 'slip'))}</ul>}
        </section>
      )}
      {sub === 'sheet' && (
        <section className="card no-print" role="tabpanel" aria-label="ใบบันทึกการถวาย">
          <div className="row row--between"><h2>3 · ใบบันทึกการถวาย</h2>{canWrite && <button type="button" className="btn btn--gold" onClick={() => setAttach('new')}>＋ แนบไฟล์</button>}</div>
          <p className="muted small">ถ่ายรูปใบบันทึกการถวายวันอาทิตย์แล้วแนบ — ระบบอ่านแถวเงินสดให้ ท่านตรวจแล้วกดยืนยัน ยอดจะเข้าใบสรุปช่อง 4</p>
          {scopeBar('sheet', lstFiles.length, lstFiles.reduce((a, f) => a + (f.read?.rows.reduce((q, r) => q + r.amount, 0) ?? 0), 0))}
          {lstFiles.length === 0 ? <p className="muted small">ยังไม่มีไฟล์{allWeeks ? '' : 'ในสัปดาห์นี้'}</p> : (
            <ul className="list">
              {lstFiles.map((f) => (
                <li key={f.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span className="grow"><b>📎 {f.file.name}</b><br /><span className="small muted">ใบวันอาทิตย์ที่ {fmtDate(f.date)}{f.read ? ` · อ่านแล้ว ${f.read.rows.length} แถว รวมเงินสด ${fmtBaht(f.read.rows.reduce((a, r) => a + r.amount, 0))}` : ' · ยังไม่ได้อ่านข้อมูล'}{f.file.path ? '' : ' · (โหมดทดลอง ไม่ได้เก็บรูป)'}</span></span>
                  {actions(() => setAttach(f), () => delFile(f))}
                </li>
              ))}
            </ul>
          )}
          <Link className="mini" to={`/rounds/${sunday}`} style={{ display: 'inline-block', marginTop: 8 }}>{!round ? 'กรอกยอดนับเอง ›' : `เปิดใบนับเงิน (${fmtBaht(cash)}) ›`}</Link>
        </section>
      )}

      {sub === 'total' && (
        <section className="card paper" role="tabpanel" aria-labelledby="h-rep">
          <div className="no-print" style={{ display: 'grid', gap: 8 }}>
            <div className="seg" role="group" aria-label="ช่วงของใบสรุป">
              <button type="button" className={repScope === 'week' ? 'on' : ''} onClick={() => setRepScope('week')}>สัปดาห์ที่เลือก</button>
              <button type="button" className={repScope === 'year' ? 'on' : ''} onClick={() => setRepScope('year')}>ทั้งปี {year + 543}</button>
            </div>
            <button type="button" className="btn btn--gold" onClick={() => window.print()}>🖨️ พิมพ์ / บันทึกเป็น PDF</button>
          </div>
          <header className="paper__head">
            <p className="muted small">{settings.churchName}</p>
            <h2 id="h-rep">ได้รับการถวายประจำสัปดาห์</h2>
            <p>{repScope === 'year' ? `ประจำปี ${year + 543} (รวมทุกสัปดาห์)` : `ประจำวันอาทิตย์ที่ ${fmtDateLong(sunday).replace('วันอาทิตย์ที่ ', '')}`}</p>
            {repScope === 'week' && <p className="muted small">รับระหว่างวันที่ {fmtDate(addDays(sunday, -6))} – {fmtDate(sunday)}</p>}
          </header>
          <table className="tbl tbl--paper" aria-label="ได้รับการถวายประจำสัปดาห์">
            <thead><tr><th>ประเภทถวาย (ที่มา)</th><th className="num">รายการ</th><th className="num">จำนวนเงิน</th></tr></thead>
            <tbody>
              {perType.length === 0 && <tr><td colSpan={3} className="muted">ยังไม่มีรายการ</td></tr>}
              {perType.map(([id, v]) => {
                const parts = ([['ตู้ถวาย', v.box], ['โอน', v.transfer], ['เงินสดบันทึกมือ', v.hand]] as [string, Src][]).filter(([, x]) => x.n > 0)
                const n = parts.reduce((a, [, x]) => a + x.n, 0), amt = parts.reduce((a, [, x]) => a + x.amt, 0)
                return (
                  <Fragment key={id}>
                    {parts.map(([label, x]) => <tr key={label}><td>{typeName(id)} ({label})</td><td className="num">{x.n}</td><td className="num">{fmtBaht(x.amt)}</td></tr>)}
                    {parts.length > 1 && <tr className="paper__sub"><td>รวม{typeName(id)}</td><td className="num">{n}</td><td className="num">{fmtBaht(amt)}</td></tr>}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot><tr>
              <td>รวมทั้งสิ้น</td>
              <td className="num">{perType.reduce((a, [, v]) => a + v.box.n + v.transfer.n + v.hand.n, 0)}</td>
              <td className="num">{fmtBaht(perType.reduce((a, [, v]) => a + v.box.amt + v.transfer.amt + v.hand.amt, 0))}</td>
            </tr></tfoot>
          </table>
          <div className="sign" style={{ display: 'grid' }}>
            <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br /><span className="small">วันที่ ........../........../..........</span></div>
            <div>ผู้ตรวจสอบ<br /><span className="small">วันที่ ........../........../..........</span></div>
            <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br /><span className="small">วันที่ ........../........../..........</span></div>
          </div>
        </section>
      )}

      {attach && <SheetFlow year={year} sunday={sunday} existing={attach === 'new' ? null : attach} onClose={() => setAttach(null)} onSaved={goWeek} />}
      {pick && <SlipFlow year={year} inc={inc} onClose={() => setPick(false)} onSaved={goWeek} />}
      {form && <IncomeForm year={year} entry={form.entry} preset={form.preset} onSaved={goWeek} defaultDate={yearOf(todayISO()) === year ? todayISO() : undefined} onClose={() => setForm(null)} inc={inc} />}
    </>
  )
}


/** แนบสลิป: เลือกรูป → ระบบอ่านในเครื่อง → ใส่ค่าให้ในฟอร์ม → ตรวจและยืนยัน */
function SlipFlow({ year, inc, onClose, onSaved }: { year: number; inc: ReturnType<typeof useIncome>; onClose: () => void; onSaved?: (date: string) => void }) {
  const types = useIncomeTypes()
  const [stage, setStage] = useState<'pick' | 'read' | 'confirm'>('pick')
  const [pct, setPct] = useState(0)
  const [init, setInit] = useState<SlipInit | null>(null)
  const [msg, setMsg] = useState('')
  const choose = async (file: File) => {
    setStage('read'); setPct(0); setMsg('')
    let r: Awaited<ReturnType<typeof readSlip>> | null = null
    try { r = await readSlip(file, setPct) } catch { setMsg('ระบบอ่านสลิปไม่สำเร็จ — กรอกข้อมูลเองได้ในขั้นต่อไป') }
    const memo = r?.memo ?? ''
    const hit = memo ? types.list.find((t) => t.active && memo.includes(t.name.split(' ')[0])) : undefined
    const missing = r ? [!r.date && 'วันที่', !r.amount && 'ยอดเงิน'].filter(Boolean) : []
    if (r && missing.length) setMsg(`อ่าน${missing.join('และ')}ไม่ได้ — กรุณากรอกเอง`)
    setInit({ file, date: r?.date, amount: r?.amount, ref: r?.ref, typeId: hit?.id, time: r?.time, note: memo })
    setStage('confirm')
  }
  if (stage === 'confirm' && init) return (
    <>
      {msg && <p className="role-toast" role="alert" style={{ position: 'fixed', top: 8, left: 8, right: 8, zIndex: 100 }}>{msg}</p>}
      <IncomeForm year={year} entry={null} preset="slip" init={init} inc={inc} onClose={onClose} onSaved={onSaved} />
    </>
  )
  return (
    <Sheet title="แนบสลิป" onClose={onClose}>
      {stage === 'pick' ? (
        <>
          <p className="muted small">เลือกรูปสลิปโอนเงิน ระบบจะอ่านวันที่ ยอดเงิน และเลขอ้างอิงให้เอง (อ่านในเครื่อง รูปไม่ถูกส่งไปที่อื่น)</p>
          <label className="btn btn--gold" style={{ display: 'block', textAlign: 'center' }}>
            📷 เลือกรูปสลิป
            <input type="file" accept="image/*" aria-label="เลือกรูปสลิป" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void choose(f) }} />
          </label>
        </>
      ) : (
        <div role="status" aria-live="polite">
          <p><b>กำลังอ่านสลิป…</b></p>
          <progress value={pct} max={1} style={{ width: '100%' }} />
          <p className="muted small">ครั้งแรกอาจนานขึ้นเล็กน้อยเพราะต้องโหลดตัวอ่านภาษาไทย</p>
        </div>
      )}
    </Sheet>
  )
}
