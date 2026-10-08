import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MoneyInput from '../components/MoneyInput'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import { can, whoAmI } from '../lib/access'
import { useAccounts, useIncome, useIncomeTypes, useRounds, useSettings, useStatementBatches, useStatementLines, useVouchers } from '../lib/data'
import { voucherItems } from '../lib/ledger'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, isISO, newId, sheetSunday, todayISO, yearOf } from '../lib/money'
import { guessMap, parseCSV, parseRows, suggest, suggestGroups, type Candidate } from '../lib/statement'
import { getSync, putBinary } from '../lib/sync'
import type { CsvMap, MatchKind, StatementLine } from '../lib/types'
import { useYear } from '../lib/year'
import { RoundTabs } from './Rounds'

export default function Statement() {
  const role = useRole()
  const { year } = useYear()
  if (!can(role, 'detail')) return <NoAccess />
  return <Page key={year} year={year} />
}

const FIELDS: { k: keyof CsvMap; label: string }[] = [
  { k: 'date', label: 'วันที่' }, { k: 'desc', label: 'รายละเอียด/รายการ' }, { k: 'credit', label: 'เงินเข้า (ฝาก)' },
  { k: 'debit', label: 'เงินออก (ถอน)' }, { k: 'amount', label: 'จำนวนเงินช่องเดียว (+เข้า/−ออก)' }, { k: 'balance', label: 'ยอดคงเหลือ' },
]

function Page({ year }: { year: number }) {
  const role = useRole()
  const accounts = useAccounts()
  const lines = useStatementLines(year)
  const batches = useStatementBatches()
  const rounds = useRounds(year)
  const income = useIncome(year)
  const vouchers = useVouchers(year)
  const types = useIncomeTypes()
  const { settings, save } = useSettings()
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [pick, setPick] = useState<StatementLine | null>(null)
  const [up, setUp] = useState(false)
  const [manual, setManual] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [groupSheet, setGroupSheet] = useState(false)
  const me = whoAmI()
  const canEdit = can(role, 'statement')

  const matchedRefs = useMemo(() => new Set(lines.items.filter((l) => l.match).map((l) => `${l.match!.kind}:${l.match!.refId}`)), [lines.items])
  const cands: Candidate[] = useMemo(() => {
    const out: Candidate[] = []
    for (const r of rounds.items) if (r.deposit) out.push({ kind: 'deposit', refId: r.id, date: r.deposit.date, amount: r.deposit.amount, label: `ฝากเงินสด รอบ ${fmtDate(r.date)}` })
    for (const x of income.items) if (x.method === 'transfer') out.push({ kind: 'income', refId: x.id, date: x.date, amount: x.amount, ref: x.ref, label: x.unknown ? 'ไม่ทราบที่มา (ไม่มีสลิป)' : `โอน ${types.byId(x.typeId)?.name ?? ''}${x.ref ? ` อ้างอิง ${x.ref}` : ''}` })
    for (const v of vouchers.items) if (v.status === 'paid' && v.paid) voucherItems(v).forEach((it, n) => { if (it.method === 'transfer') out.push({ kind: 'voucher', refId: `${v.id}#${n}`, date: v.paid!.date, amount: it.amount, ref: it.ref, label: `จ่าย ${v.no}: ${it.desc}` }) })
    return out
  }, [rounds.items, income.items, vouchers.items, types])
  const open = cands.filter((c) => !matchedRefs.has(`${c.kind}:${c.refId}`))
  const sugg = useMemo(() => suggest(lines.items, open, settings.matchDays), [lines.items, open, settings.matchDays])
  const suggBy = new Map(sugg.map((s) => [s.lineId, s]))
  // ยอดโอนรวมต่อสัปดาห์ (ตามใบบันทึกการถวาย) ↔ รายการเงินเข้าหลายรายการในสมุด
  const weeks = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of income.items) if (x.method === 'transfer') m.set(sheetSunday(x.date), (m.get(sheetSunday(x.date)) ?? 0) + x.amount)
    return [...m.entries()].map(([sunday, amount]) => {
      const matched = lines.items.filter((l) => l.match?.kind === 'week' && l.match.refId === sunday).reduce((a, l) => a + l.credit, 0)
      return { sunday, amount, matched }
    }).sort((a, b) => (a.sunday < b.sunday ? 1 : -1))
  }, [income.items, lines.items])
  const openWeeks = weeks.filter((w) => w.matched !== w.amount)
  const groups = useMemo(() => suggestGroups(lines.items, openWeeks.filter((w) => w.matched === 0), settings.matchDays), [lines.items, openWeeks, settings.matchDays])
  const selTotal = lines.items.filter((l) => sel.has(l.id)).reduce((a, l) => a + l.credit, 0)
  const linkGroup = (ids: string[], sunday: string) => lines.put(ids.flatMap((id) => { const l = lines.items.find((x) => x.id === id); return l ? [{ ...l, match: { kind: 'week' as MatchKind, refId: sunday, by: me.name, at: Date.now() } }] : [] }))

  const link = (l: StatementLine, kind: MatchKind, refId: string, note = '') => lines.put([{ ...l, match: { kind, refId, note, by: me.name, at: Date.now() } }])
  /** เงินเข้าบัญชีที่ไม่มีสลิป → รับเป็นรายรับ "ไม่ทราบที่มา" (ผู้บันทึกบัญชีระบุที่มาทีหลัง) และจับคู่กับรายการธนาคารให้ */
  const receiveUnknown = (ls: StatementLine[]) => {
    const credits = ls.filter((l) => l.credit > 0 && !l.match)
    if (credits.length === 0) return
    if (!income.put(credits.map((l) => ({ id: `unk-${l.id}`, date: l.date, typeId: '', amount: l.credit, method: 'transfer' as const, accountId: l.accountId, unknown: true, note: 'ไม่ทราบที่มา (ไม่มีสลิป)', updated: 0 })))) return
    lines.put(credits.map((l) => ({ ...l, match: { kind: 'income' as MatchKind, refId: `unk-${l.id}`, note: 'ไม่ทราบที่มา', by: me.name, at: Date.now() } })))
  }
  const acceptAll = () => lines.put(sugg.flatMap((s) => { const l = lines.items.find((x) => x.id === s.lineId); return l ? [{ ...l, match: { kind: s.cand.kind as MatchKind, refId: s.cand.refId, by: me.name, at: Date.now() } }] : [] }))

  const shown = lines.items.filter((l) => filter === 'all' || !l.match).sort((a, b) => (a.date < b.date ? 1 : -1))
  const unmatchedCount = lines.items.filter((l) => !l.match).length
  const unknownCredits = lines.items.filter((l) => !l.match && l.credit > 0)
  const accName = (id: string) => accounts.list.find((a) => a.id === id)?.name ?? ''
  const labelOf = (m: NonNullable<StatementLine['match']>) => m.kind === 'other' ? `อื่น ๆ: ${m.note}` : m.kind === 'week' ? `ยอดโอนรวมใบถวาย ${fmtDate(m.refId)}` : cands.find((c) => c.kind === m.kind && c.refId === m.refId)?.label ?? 'จับคู่แล้ว (ไม่พบรายการ)'

  return (
    <>
      <div className="page-head"><h1>รอบอาทิตย์</h1></div>
      <RoundTabs on="statement" />

      {accounts.list.length === 0 ? (
        <section className="card"><p>ยังไม่มีบัญชีธนาคารในระบบ</p>{can(role, 'settings') ? <Link className="btn btn--gold" to="/settings">ไปเพิ่มบัญชีที่ตั้งค่า</Link> : <p className="muted">ให้แอดมินเพิ่มบัญชีธนาคารที่ตั้งค่าก่อน</p>}</section>
      ) : (
        <>
          <div className="kpi">
            <div><span>รายการสเตตเมนต์ปีนี้</span><b>{lines.items.length}</b></div>
            <div><span>ยังไม่จับคู่</span><b className={unmatchedCount ? 'bad' : 'good'}>{unmatchedCount}</b></div>
            <div><span>ยอดฝาก/โอน/จ่ายที่ยังไม่พบในสเตตเมนต์</span><b className={open.length ? 'bad' : 'good'}>{open.length}</b></div>
          </div>
          {canEdit && <div className="row"><button type="button" className="btn btn--gold grow" onClick={() => setManual(true)}>✍️ พิมพ์รายการจากสมุด</button><button type="button" className="btn btn--ghost" onClick={() => setUp(true)}>⬆️ ไฟล์ CSV/รูป</button></div>}
          {groups.length > 0 && canEdit && (
            <div className="note" role="status">
              💡 รายการเงินเข้าในสมุดรวมกันได้เท่ากับยอดโอนรวมในใบถวาย {groups.length} สัปดาห์:
              {groups.map((g) => <div key={g.sunday}>อาทิตย์ {fmtDate(g.sunday)} · {g.lineIds.length} รายการ รวม {fmtBaht(g.total)} <button type="button" className="mini" onClick={() => linkGroup(g.lineIds, g.sunday)}>ยอมรับ</button></div>)}
            </div>
          )}

          {sugg.length > 0 && canEdit && (
            <div className="note" role="status">
              💡 พบคู่ที่ยอดตรงกันและวันที่ใกล้กัน {sugg.length} คู่ (ภายใน {settings.matchDays} วัน) <button type="button" className="mini" onClick={acceptAll}>ยอมรับทั้งหมด</button>
            </div>
          )}

          {canEdit && unknownCredits.length > 0 && (
            <div className="note" role="status">
              ❓ เงินเข้าในสมุด {unknownCredits.length} รายการ รวม {fmtBaht(unknownCredits.reduce((a, l) => a + l.credit, 0))} บาท ยังไม่มีสลิปหรือที่มา{' '}
              <button type="button" className="mini" onClick={() => receiveUnknown(unknownCredits)}>รับทั้งหมดเป็น “ไม่ทราบที่มา”</button>
              <div className="small">นับเป็นรายรับไว้ก่อนให้ยอดเงินรวมถูกต้อง แล้วไประบุที่มาทีหลังที่หน้ารายรับ</div>
            </div>
          )}
          <div className="seg" role="group" aria-label="กรองรายการ">
            <button type="button" className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>ยังไม่จับคู่</button>
            <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>ทั้งหมด</button>
          </div>
          <section className="card" aria-label="รายการสเตตเมนต์">
            {shown.length === 0 ? <p className="empty">{lines.items.length ? 'จับคู่ครบทุกรายการแล้ว ✓' : 'ยังไม่มีสเตตเมนต์ — อัปโหลดไฟล์ CSV จากธนาคาร'}</p> : (
              <ul className="list">
                {shown.map((l) => {
                  const s = suggBy.get(l.id)
                  return (
                    <li key={l.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                      <div className="row row--between">
                        <span className="small muted">{canEdit && !l.match && l.credit > 0 && <input type="checkbox" aria-label={`เลือกรายการ ${fmtDate(l.date)} ${fmtBaht(l.credit)}`} checked={sel.has(l.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(l.id); else n.delete(l.id); setSel(n) }} />} {fmtDate(l.date)} · {accName(l.accountId)}</span>
                        <b className={l.credit ? 'good num' : 'bad num'}>{l.credit ? `+${fmtBaht(l.credit)}` : `−${fmtBaht(l.debit)}`}</b>
                      </div>
                      <div className="small">{l.desc || '—'}</div>
                      {l.match ? (
                        <div className="row row--between"><span className="small ok">✓ {labelOf(l.match)}</span>{canEdit && <button type="button" className="mini" onClick={() => lines.put([{ ...l, match: undefined }])}>ยกเลิกจับคู่</button>}</div>
                      ) : canEdit && (
                        <div className="row">
                          {s && <button type="button" className="mini" onClick={() => link(l, s.cand.kind as MatchKind, s.cand.refId)}>💡 {s.cand.label}</button>}
                          <button type="button" className="mini" onClick={() => setPick(l)}>จับคู่เอง…</button>
                          {l.credit > 0 && <button type="button" className="mini" onClick={() => receiveUnknown([l])}>❓ รับเป็นไม่ทราบที่มา</button>}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {sel.size > 0 && (
            <div className="note row row--between" role="status" style={{ position: 'sticky', bottom: '4.2rem' }}>
              <span>เลือก {sel.size} รายการ รวม <b>{fmtBaht(selTotal)}</b></span>
              <span className="row"><button type="button" className="btn btn--gold" onClick={() => setGroupSheet(true)}>จับคู่กับยอดโอนรวมของสัปดาห์…</button><button type="button" className="mini" onClick={() => setSel(new Set())}>ล้าง</button></span>
            </div>
          )}

          {openWeeks.length > 0 && (
            <details className="card">
              <summary><b>ยอดโอนรวมใบถวายที่ยังจับคู่ไม่ครบ ({openWeeks.length})</b></summary>
              <ul className="list">{openWeeks.map((w) => <li key={w.sunday}><span className="grow small">อาทิตย์ {fmtDate(w.sunday)} · จับคู่แล้ว {fmtBaht(w.matched)}</span><b className="num">{fmtBaht(w.amount)}</b></li>)}</ul>
            </details>
          )}

          {open.length > 0 && (
            <details className="card">
              <summary><b>ยังไม่พบในสเตตเมนต์ ({open.length})</b> — ฝาก/โอน/จ่ายที่บันทึกไว้แต่ยังไม่มีรายการธนาคารคู่กัน</summary>
              <ul className="list">{open.sort((a, b) => (a.date < b.date ? 1 : -1)).map((c) => <li key={`${c.kind}${c.refId}`}><span className="grow small">{fmtDate(c.date)} · {c.label}</span><b className="num">{fmtBaht(c.amount)}</b></li>)}</ul>
            </details>
          )}
        </>
      )}

      {pick && (
        <Sheet title="จับคู่รายการธนาคาร" onClose={() => setPick(null)}>
          <p className="small">{fmtDate(pick.date)} · {pick.desc} · <b>{pick.credit ? `+${fmtBaht(pick.credit)}` : `−${fmtBaht(pick.debit)}`}</b></p>
          <ul className="list">
            {open.filter((c) => (pick.credit > 0) === (c.kind !== 'voucher')).sort((a, b) => Math.abs(a.amount - (pick.credit || pick.debit)) - Math.abs(b.amount - (pick.credit || pick.debit))).slice(0, 15).map((c) => (
              <li key={`${c.kind}${c.refId}`}><button type="button" className="mini grow" style={{ textAlign: 'left' }} onClick={() => { link(pick, c.kind as MatchKind, c.refId); setPick(null) }}>{fmtDate(c.date)} · {c.label} · <b>{fmtBaht(c.amount)}</b>{c.amount !== (pick.credit || pick.debit) && <span className="bad"> (ยอดต่างกัน)</span>}</button></li>
            ))}
          </ul>
          <OtherMatch onSave={(note) => { link(pick, 'other', 'other', note); setPick(null) }} />
        </Sheet>
      )}
      {groupSheet && (
        <Sheet title="จับคู่กับยอดโอนรวมของสัปดาห์" onClose={() => setGroupSheet(false)}>
          <p className="small">รายการที่เลือก {sel.size} รายการ รวม <b>{fmtBaht(selTotal)}</b> บาท</p>
          <ul className="list">
            {weeks.map((w) => (
              <li key={w.sunday}><button type="button" className="mini grow" style={{ textAlign: 'left' }} onClick={() => { linkGroup([...sel], w.sunday); setSel(new Set()); setGroupSheet(false) }}>
                อาทิตย์ {fmtDate(w.sunday)} · ยอดโอนรวม <b>{fmtBaht(w.amount)}</b>{w.matched > 0 && ` (จับคู่แล้ว ${fmtBaht(w.matched)})`} {w.amount === w.matched + selTotal ? <span className="ok"> ✓ ครบพอดี</span> : <span className="bad"> (ต่าง {fmtBaht(w.amount - w.matched - selTotal, { sign: true })})</span>}
              </button></li>
            ))}
          </ul>
          {weeks.length === 0 && <p className="muted">ยังไม่มีรายการเงินโอนในใบถวาย</p>}
        </Sheet>
      )}
      {manual && <ManualLines year={year} accounts={accounts.list} lines={lines} onClose={() => setManual(false)} />}
      {up && <Upload year={year} onClose={() => setUp(false)} lines={lines} batches={batches} accounts={accounts.list} csvMaps={settings.csvMaps} rememberMap={(accId, m) => { if (can(role, 'settings')) save({ csvMaps: { ...settings.csvMaps, [accId]: m } }) }} />}
    </>
  )
}

function OtherMatch({ onSave }: { onSave: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <div className="stack">
      <h3>ไม่ใช่รายการข้างบน (ค่าธรรมเนียม ดอกเบี้ย โอนระหว่างบัญชี ฯลฯ)</h3>
      <input className="input" aria-label="คำอธิบาย" placeholder="อธิบายรายการนี้ เช่น ดอกเบี้ยเงินฝาก" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn btn--ghost" disabled={!note.trim()} onClick={() => onSave(note.trim())}>บันทึกว่าเป็นรายการอื่น</button>
    </div>
  )
}

function Upload({ year, onClose, lines, batches, accounts, csvMaps, rememberMap }: {
  year: number; onClose: () => void; lines: ReturnType<typeof useStatementLines>; batches: ReturnType<typeof useStatementBatches>
  accounts: { id: string; name: string; last4: string }[]; csvMaps: Record<string, CsvMap>; rememberMap: (accId: string, m: CsvMap) => void
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<string[][] | null>(null)
  const [header, setHeader] = useState(true)
  const [map, setMap] = useState<CsvMap | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const isCsv = file ? /\.(csv|tsv|txt)$/i.test(file.name) : false

  const choose = async (f: File | null) => {
    setFile(f); setRows(null); setMap(null); setMsg(null)
    if (!f) return
    if (!/\.(csv|tsv|txt)$/i.test(f.name)) return setMsg({ ok: true, text: 'ไฟล์ชนิดนี้ (PDF/รูป/Excel) จะถูกเก็บไว้เป็นหลักฐานเท่านั้น ยังอ่านรายการอัตโนมัติไม่ได้ — ถ้าจะให้จับคู่ ให้ดาวน์โหลดแบบ CSV จากแอปธนาคาร หรือเปิด Excel แล้ว “บันทึกเป็น CSV”' })
    const r = parseCSV(await f.text())
    if (r.length < 2) return setMsg({ ok: false, text: 'อ่านไฟล์ไม่ได้หรือไม่มีรายการ' })
    setRows(r)
    setMap(csvMaps[accountId] ?? guessMap(r[0]))
  }
  const body = rows ? (header ? rows.slice(1) : rows) : []
  const parsed = rows && map ? parseRows(body, map, accountId) : null
  const inYear = parsed?.lines.filter((l) => yearOf(l.date) === year) ?? []
  const outYear = (parsed?.lines.length ?? 0) - inYear.length
  const existing = new Set(lines.all.map((l) => l.id))
  const fresh = inYear.filter((l) => !existing.has(l.id))
  const ready = !!parsed && inYear.length > 0 && (map!.date >= 0)

  const run = async () => {
    if (!file || !accountId) return
    setBusy(true); setMsg(null)
    const bid = newId('sb')
    let path: string | undefined
    const cfg = getSync()
    if (cfg) {
      try { path = `attachments/statements/${year}/${Date.now().toString(36)}-${file.name.replace(/[^\w.\-ก-๙]/g, '_')}`; await putBinary(cfg, path, await file.arrayBuffer(), 'สเตตเมนต์') } catch (e) { path = undefined; setMsg({ ok: false, text: `เก็บไฟล์ต้นฉบับไม่สำเร็จ (${e instanceof Error ? e.message : ''}) — นำเข้ารายการต่อไป` }) }
    }
    if (parsed && map) {
      lines.put(fresh.map((l) => ({ ...l, batchId: bid, accountId, updated: 0 })))
      rememberMap(accountId, map)
    }
    batches.put([{ id: bid, accountId, filename: file.name, from: parsed?.from ?? '', to: parsed?.to ?? '', count: parsed?.lines.length ?? 0, added: fresh.length, ...(path ? { path } : {}), updated: 0 }])
    setBusy(false)
    setMsg({ ok: true, text: parsed ? `นำเข้า ${fresh.length} รายการใหม่${inYear.length - fresh.length ? ` (ข้าม ${inYear.length - fresh.length} รายการที่เคยนำเข้าแล้ว)` : ''}${outYear ? ` · ไม่นำเข้า ${outYear} รายการที่อยู่นอกปี ${year + 543} (เปลี่ยนปีแล้วอัปโหลดซ้ำ)` : ''}` : 'เก็บไฟล์เป็นหลักฐานแล้ว' })
    setFile(null); setRows(null)
  }

  return (
    <Sheet title="อัปโหลดสเตตเมนต์" onClose={onClose}>
      <div className="field"><label htmlFor="u-acc">บัญชี</label><select id="u-acc" className="input" value={accountId} onChange={(e) => { setAccountId(e.target.value); if (rows) setMap(csvMaps[e.target.value] ?? guessMap(rows[0])) }}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {a.last4 && `(${a.last4})`}</option>)}</select></div>
      <div className="field"><label htmlFor="u-file">ไฟล์ (CSV จากธนาคาร · หรือ PDF/รูปเพื่อเก็บเป็นหลักฐาน)</label><input id="u-file" className="input" type="file" accept=".csv,.tsv,.txt,.pdf,image/*" onChange={(e) => choose(e.target.files?.[0] ?? null)} /></div>
      {rows && map && isCsv && (
        <>
          <label className="row"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> แถวแรกเป็นหัวตาราง</label>
          <p className="small muted">บอกแอปว่าคอลัมน์ไหนคืออะไร (เดาให้แล้ว ตรวจให้ถูกต้อง · จำไว้ใช้ครั้งหน้า)</p>
          {FIELDS.map((f) => (
            <div className="field" key={f.k}>
              <label htmlFor={`m-${f.k}`}>{f.label}</label>
              <select id={`m-${f.k}`} className="input" value={map[f.k]} onChange={(e) => setMap({ ...map, [f.k]: Number(e.target.value) })}>
                <option value={-1}>— ไม่มี —</option>
                {rows[0].map((h, i) => <option key={i} value={i}>{header ? h || `คอลัมน์ ${i + 1}` : `คอลัมน์ ${i + 1}: ${rows[0][i]}`}</option>)}
              </select>
            </div>
          ))}
          {parsed && (
            <div className="note" role="status">
              อ่านได้ {parsed.lines.length} รายการ{parsed.skipped ? ` · ข้าม ${parsed.skipped} แถวที่อ่านไม่ได้` : ''}{parsed.from && ` · ${fmtDate(parsed.from)} – ${fmtDate(parsed.to)}`}
              {parsed.lines[0] && <div className="small">ตัวอย่าง: {fmtDate(parsed.lines[0].date)} · {parsed.lines[0].desc || '—'} · {parsed.lines[0].credit ? `+${fmtBaht(parsed.lines[0].credit)}` : `−${fmtBaht(parsed.lines[0].debit)}`}</div>}
              {outYear > 0 && <div>⚠️ {outYear} รายการอยู่นอกปี {year + 543} จะไม่ถูกนำเข้าตอนนี้</div>}
            </div>
          )}
        </>
      )}
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}
      <button type="button" className="btn btn--gold" disabled={busy || !file || (isCsv && !ready)} onClick={run}>{busy ? 'กำลังนำเข้า…' : isCsv ? `นำเข้า ${fresh.length} รายการ` : 'เก็บไฟล์เป็นหลักฐาน'}</button>
    </Sheet>
  )
}

const CODES: { code: string; label: string; dir: 'in' | 'out'; auto?: string }[] = [
  { code: 'TN', label: 'TN โอนเข้า', dir: 'in' }, { code: 'DB', label: 'DB ฝากเงินสด', dir: 'in' }, { code: 'IN', label: 'IN ดอกเบี้ย', dir: 'in', auto: 'ดอกเบี้ยเงินฝาก' },
  { code: 'WB', label: 'WB ถอน', dir: 'out' }, { code: 'TX', label: 'TX ภาษีหัก ณ ที่จ่าย', dir: 'out', auto: 'ภาษีหัก ณ ที่จ่าย' },
  { code: 'INX', label: 'อื่น ๆ (เงินเข้า)', dir: 'in' }, { code: 'OUTX', label: 'อื่น ๆ (เงินออก)', dir: 'out' },
]

/** พิมพ์รายการจากสมุดคู่ฝาก/สเตตเมนต์ทีละบรรทัด — คงวันที่ไว้ให้พิมพ์ต่อเร็ว ๆ */
function ManualLines({ year, accounts, lines, onClose }: { year: number; accounts: { id: string; name: string; last4: string }[]; lines: ReturnType<typeof useStatementLines>; onClose: () => void }) {
  const me = whoAmI()
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [date, setDate] = useState(yearOf(todayISO()) === year ? todayISO() : `${year}-01-01`)
  const [code, setCode] = useState('TN')
  const [amount, setAmount] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [n, setN] = useState(0)
  const c = CODES.find((x) => x.code === code)!
  const add = () => {
    if (!isISO(date) || yearOf(date) !== year) return setMsg({ ok: false, text: `วันที่ต้องอยู่ในปี ${year + 543}` })
    if (!amount || amount <= 0) return setMsg({ ok: false, text: 'ใส่จำนวนเงิน' })
    const id = newId('sl')
    const rec: StatementLine = { id, batchId: 'manual', accountId, date, desc: `${c.code.length === 2 ? c.code + ' ' : ''}${note.trim()}`.trim(), credit: c.dir === 'in' ? amount : 0, debit: c.dir === 'out' ? amount : 0, ...(balance ? { balance } : {}), ...(c.auto ? { match: { kind: 'other' as MatchKind, refId: 'auto', note: c.auto, by: me.name, at: Date.now() } } : {}), updated: 0 }
    if (lines.put([rec])) { setN(n + 1); setAmount(null); setBalance(null); setNote(''); setMsg({ ok: true, text: `บันทึกแล้ว ✓ (${n + 1} รายการ) พิมพ์บรรทัดถัดไปได้เลย` }) }
  }
  return (
    <Sheet title="พิมพ์รายการจากสมุด" onClose={onClose}>
      {accounts.length > 1 && <div className="field"><label htmlFor="m-acc">บัญชี</label><select id="m-acc" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {a.last4 && `(${a.last4})`}</option>)}</select></div>}
      <div className="grid2">
        <div className="field"><label htmlFor="m-date">วันที่</label><input id="m-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label htmlFor="m-code">รายการ</label><select id="m-code" className="input" value={code} onChange={(e) => setCode(e.target.value)}>{CODES.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select></div>
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="m-amt">{c.dir === 'in' ? 'ฝาก/เข้า (บาท)' : 'ถอน/ออก (บาท)'}</label><MoneyInput id="m-amt" value={amount} onChange={setAmount} /></div>
        <div className="field"><label htmlFor="m-bal">คงเหลือ (ถ้าจะเทียบ)</label><MoneyInput id="m-bal" value={balance} onChange={setBalance} placeholder="ไม่บังคับ" /></div>
      </div>
      <div className="field"><label htmlFor="m-note">หมายเหตุ (ลายมือที่เขียนในสมุด)</label><input id="m-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น สิบลด / ถอนเตรียมจ่ายเงินสด" /></div>
      {c.auto && <p className="muted small">รายการชนิดนี้จะถูกจับคู่ให้อัตโนมัติว่าเป็น “{c.auto}”</p>}
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" onClick={add}>บันทึกรายการ</button><button type="button" className="btn btn--ghost" onClick={onClose}>เสร็จ</button></div>
    </Sheet>
  )
}
