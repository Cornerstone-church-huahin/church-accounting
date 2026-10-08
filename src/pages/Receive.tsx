import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { can } from '../lib/access'
import { useIncome, useIncomeTypes, useRounds, useSheetFiles } from '../lib/data'
import { roundTotal } from '../lib/ledger'
import { useRole } from '../lib/members'
import { compressImage } from '../lib/image'
import Sheet from '../components/Sheet'
import { deleteFile, getBinary, getSync, listDir, putBinary } from '../lib/sync'
import { addDays, newId, fmtBaht, fmtDate, fmtDateLong, sheetSunday, sundaysOf, todayISO, yearOf } from '../lib/money'
import { UNSORTED, type IncomeEntry, type SheetFile } from '../lib/types'
import { IncomeForm, type SlipInit } from './Income'
import { readSlip } from '../lib/slipOcr'

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

  const week = useMemo(() => inc.items.filter((x) => sheetSunday(x.date) === sunday && !x.roundId).sort(byDateDesc), [inc.items, sunday])
  const manual = week.filter((x) => kindOf(x) === 'manual')
  const slips = week.filter((x) => kindOf(x) === 'slip')
  const unknown = week.filter((x) => kindOf(x) === 'unknown')
  const weekFiles = files.items.filter((f) => sheetSunday(f.date) === sunday).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updated - a.updated))
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
    if (!confirm(`ลบไฟล์ ${f.file.name} (${fmtDate(f.date)})?`)) return
    if (files.remove(f.id)) void dropFile(f.file.path)
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
        <span className="grow"><b>{typeName(x.typeId)}</b>{x.memberNo ? <span className="small muted"> · {x.memberNo}</span> : null}<br /><span className="small muted">บันทึกวันที่ {fmtDate(x.date)}{x.time ? ` ${x.time} น.` : ''}{x.ref ? ` · อ้างอิง ${x.ref}` : ''}{x.slip ? ' · 📎สลิป' : ''}{x.note && x.source !== 'slip' ? ` · ${x.note}` : ''}</span></span>
        <b className="num">{fmtBaht(x.amount)}</b>
      </div>
      {actions(() => setForm({ entry: x, preset }), () => delEntry(x))}
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
          <div className="row row--between"><h2>2 · บันทึกสลิป</h2>{canWrite && <button type="button" className="btn btn--gold" onClick={() => setPick(true)}>＋ แนบสลิป</button>}</div>
          <p className="muted small">แนบรูปสลิปโอนเงินไปเรื่อย ๆ ระหว่างสัปดาห์ — ระบบอ่านวันที่ ยอด และเลขอ้างอิงจากสลิปให้ ท่านตรวจแล้วกดยืนยัน</p>
          {slips.length + unknown.length === 0 ? <p className="muted small">ยังไม่มีสลิปในสัปดาห์นี้</p> : <ul className="list">{[...slips, ...unknown].map((x) => row(x, 'slip'))}</ul>}
        </section>
      )}
      {sub === 'sheet' && (
        <section className="card no-print" role="tabpanel" aria-label="ใบบันทึกการถวาย">
          <div className="row row--between"><h2>3 · ใบบันทึกการถวาย</h2>{canWrite && <button type="button" className="btn btn--gold" onClick={() => setAttach('new')}>＋ แนบไฟล์</button>}</div>
          <p className="muted small">ถ่ายรูปใบบันทึกการถวายวันอาทิตย์แล้วแนบ — ระบุวันที่ของแต่ละไฟล์</p>
          {weekFiles.length === 0 ? <p className="muted small">ยังไม่มีไฟล์ในสัปดาห์นี้</p> : (
            <ul className="list">
              {weekFiles.map((f) => (
                <li key={f.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span className="grow"><b>📎 {f.file.name}</b><br /><span className="small muted">บันทึกวันที่ {fmtDate(f.date)}{f.note ? ` · ${f.note}` : ''}</span></span>
                  {actions(() => setAttach(f), () => delFile(f))}
                </li>
              ))}
            </ul>
          )}
          <Link className="mini" to={`/rounds/${sunday}`} style={{ display: 'inline-block', marginTop: 8 }}>{!round ? 'กรอกยอดนับเอง ›' : `เปิดใบนับเงิน (${fmtBaht(cash)}) ›`}</Link>
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

      {attach && <AttachSheet year={year} entry={attach === 'new' ? null : attach} defaultDate={yearOf(todayISO()) === year ? todayISO() : sunday} files={files} onClose={() => setAttach(null)} />}
      {pick && <SlipFlow year={year} inc={inc} onClose={() => setPick(false)} />}
      {form && <IncomeForm year={year} entry={form.entry} preset={form.preset} defaultDate={yearOf(todayISO()) === year ? todayISO() : undefined} onClose={() => setForm(null)} inc={inc} />}
    </>
  )
}

/** แนบไฟล์ (รูป/PDF) ใบบันทึกการถวาย: อัปโหลดเข้า repo ข้อมูลเหมือนสลิป */
function AttachSheet({ year, entry, defaultDate, files, onClose }: { year: number; entry: SheetFile | null; defaultDate: string; files: ReturnType<typeof useSheetFiles>; onClose: () => void }) {
  const [date, setDate] = useState(entry?.date ?? defaultDate)
  const [note, setNote] = useState(entry?.note ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [url, setUrl] = useState('')
  useEffect(() => {
    const cfg = getSync()
    if (!entry || !cfg) return
    let u = ''
    getBinary(cfg, entry.file.path).then((b) => { u = URL.createObjectURL(b); setUrl(u) }).catch(() => undefined)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [entry])
  const save = async () => {
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${year + 543} (เปลี่ยนปีบัญชีที่มุมขวาบนก่อน)`)
    if (!entry && !file) return setErr('เลือกรูปหรือไฟล์ก่อน')
    let f = entry?.file
    if (file) {
      const cfg = getSync()
      if (!cfg) return setErr('ต้องเชื่อมต่อออนไลน์ก่อนจึงแนบไฟล์ได้ (ไฟล์เก็บใน repo ข้อมูล)')
      setBusy(true)
      try {
        const { data, ext } = await compressImage(file)
        const path = `attachments/${year}/sheet-${Date.now().toString(36)}.${ext}`
        await putBinary(cfg, path, data, 'ใบบันทึกการถวาย')
        f = { path, name: file.name }
      } catch (e) { setBusy(false); return setErr(e instanceof Error ? e.message : 'แนบไฟล์ไม่สำเร็จ') }
      setBusy(false)
    }
    if (!f) return
    if (files.put([{ id: entry?.id ?? newId('sf'), date, file: f, note: note.trim(), updated: 0 }])) onClose()
  }
  return (
    <Sheet title={entry ? 'ไฟล์ใบบันทึกการถวาย' : 'แนบไฟล์ใบบันทึกการถวาย'} onClose={onClose}>
      <div className="field"><label htmlFor="sf-date">วันที่</label><input id="sf-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="sf-file">รูปหรือไฟล์ {entry ? '(มีแล้ว — เลือกใหม่เพื่อแทนที่)' : ''}</label><input id="sf-file" className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      {url && (/\.pdf$/i.test(entry?.file.path ?? '') ? <a href={url} target="_blank" rel="noreferrer">📄 เปิด PDF</a> : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="ใบบันทึกการถวาย" style={{ maxWidth: '100%' }} /></a>)}
      <div className="field"><label htmlFor="sf-note">หมายเหตุ (ไม่บังคับ)</label><input id="sf-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row">
        <button type="button" className="btn btn--gold grow" disabled={busy} onClick={save}>{busy ? 'กำลังอัปโหลด…' : 'บันทึก'}</button>
        {entry && <button type="button" className="btn btn--ghost" onClick={() => { if (confirm('ลบไฟล์นี้?') && files.remove(entry.id)) onClose() }}>ลบ</button>}
      </div>
    </Sheet>
  )
}

/** แนบสลิป: เลือกรูป → ระบบอ่านในเครื่อง → ใส่ค่าให้ในฟอร์ม → ตรวจและยืนยัน */
function SlipFlow({ year, inc, onClose }: { year: number; inc: ReturnType<typeof useIncome>; onClose: () => void }) {
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
      <IncomeForm year={year} entry={null} preset="slip" init={init} inc={inc} onClose={onClose} />
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
