import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import { can, whoAmI } from '../lib/access'
import { useAccounts, useIncome, useIncomeTypes, useRounds, useSettings, useStatementBatches, useStatementLines, useVouchers } from '../lib/data'
import { useRole } from '../lib/members'
import { fmtBaht, fmtDate, newId, yearOf } from '../lib/money'
import { guessMap, parseCSV, parseRows, suggest, type Candidate } from '../lib/statement'
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
  const me = whoAmI()
  const canEdit = can(role, 'statement')

  const matchedRefs = useMemo(() => new Set(lines.items.filter((l) => l.match).map((l) => `${l.match!.kind}:${l.match!.refId}`)), [lines.items])
  const cands: Candidate[] = useMemo(() => {
    const out: Candidate[] = []
    for (const r of rounds.items) if (r.deposit) out.push({ kind: 'deposit', refId: r.id, date: r.deposit.date, amount: r.deposit.amount, label: `ฝากเงินสด รอบ ${fmtDate(r.date)}` })
    for (const x of income.items) if (x.method === 'transfer') out.push({ kind: 'income', refId: x.id, date: x.date, amount: x.amount, ref: x.ref, label: `โอน ${types.byId(x.typeId)?.name ?? ''}${x.ref ? ` อ้างอิง ${x.ref}` : ''}` })
    for (const v of vouchers.items) if (v.status === 'paid' && v.paid && v.paid.method !== 'cash') out.push({ kind: 'voucher', refId: v.id, date: v.paid.date, amount: v.amount, label: `จ่าย ${v.no} ${v.payee}` })
    return out
  }, [rounds.items, income.items, vouchers.items, types])
  const open = cands.filter((c) => !matchedRefs.has(`${c.kind}:${c.refId}`))
  const sugg = useMemo(() => suggest(lines.items, open, settings.matchDays), [lines.items, open, settings.matchDays])
  const suggBy = new Map(sugg.map((s) => [s.lineId, s]))

  const link = (l: StatementLine, kind: MatchKind, refId: string, note = '') => lines.put([{ ...l, match: { kind, refId, note, by: me.name, at: Date.now() } }])
  const acceptAll = () => lines.put(sugg.flatMap((s) => { const l = lines.items.find((x) => x.id === s.lineId); return l ? [{ ...l, match: { kind: s.cand.kind as MatchKind, refId: s.cand.refId, by: me.name, at: Date.now() } }] : [] }))

  const shown = lines.items.filter((l) => filter === 'all' || !l.match).sort((a, b) => (a.date < b.date ? 1 : -1))
  const unmatchedCount = lines.items.filter((l) => !l.match).length
  const accName = (id: string) => accounts.list.find((a) => a.id === id)?.name ?? ''
  const labelOf = (m: NonNullable<StatementLine['match']>) => m.kind === 'other' ? `อื่น ๆ: ${m.note}` : cands.find((c) => c.kind === m.kind && c.refId === m.refId)?.label ?? 'จับคู่แล้ว (ไม่พบรายการ)'

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
          {canEdit && <button type="button" className="btn btn--gold" onClick={() => setUp(true)}>⬆️ อัปโหลดสเตตเมนต์</button>}

          {sugg.length > 0 && canEdit && (
            <div className="note" role="status">
              💡 พบคู่ที่ยอดตรงกันและวันที่ใกล้กัน {sugg.length} คู่ (ภายใน {settings.matchDays} วัน) <button type="button" className="mini" onClick={acceptAll}>ยอมรับทั้งหมด</button>
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
                        <span className="small muted">{fmtDate(l.date)} · {accName(l.accountId)}</span>
                        <b className={l.credit ? 'good num' : 'bad num'}>{l.credit ? `+${fmtBaht(l.credit)}` : `−${fmtBaht(l.debit)}`}</b>
                      </div>
                      <div className="small">{l.desc || '—'}</div>
                      {l.match ? (
                        <div className="row row--between"><span className="small ok">✓ {labelOf(l.match)}</span>{canEdit && <button type="button" className="mini" onClick={() => lines.put([{ ...l, match: undefined }])}>ยกเลิกจับคู่</button>}</div>
                      ) : canEdit && (
                        <div className="row">
                          {s && <button type="button" className="mini" onClick={() => link(l, s.cand.kind as MatchKind, s.cand.refId)}>💡 {s.cand.label}</button>}
                          <button type="button" className="mini" onClick={() => setPick(l)}>จับคู่เอง…</button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

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
