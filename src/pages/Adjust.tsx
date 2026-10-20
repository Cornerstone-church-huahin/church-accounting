import { useMemo, useRef, useState } from 'react'
import ImageViewer from '../components/ImageViewer'
import MoneyInput from '../components/MoneyInput'
import Thumb from '../components/Thumb'
import { Link } from 'react-router-dom'
import WeekBar from '../components/WeekBar'
import { can } from '../lib/access'
import { useIncome, useIncomeTypes, usePassbook, usePassbookScans } from '../lib/data'
import { compressImage } from '../lib/image'
import { cacheImage } from '../lib/imageCache'
import { getSync, putBinary } from '../lib/sync'
import { removeMemberPhotoFile } from '../lib/memberPhoto'
import { ensureGemini, readPassbook } from '../lib/gemini'
import { useRole } from '../lib/members'
import { addDays, fmtBaht, fmtDate, newId, sheetSunday, sundaysOf, todayISO, weekRange, weekTitle } from '../lib/money'
import { adjReportText, adjOk, type AdjReport } from '../lib/adjustReport'
import { shareText } from '../lib/serviceReport'
import { fixKinds, chainGap, checkChain, classify, dedupeLines, lineWeek, matchBankIn, normalizeRows } from '../lib/passbook'
import { UNKNOWN_INCOME_LABEL, type PassbookLine, type PassbookScan } from '../lib/types'

interface Draft { date: string; code: string; desc: string; deposit: number | null; withdraw: number | null; balance: number | null }
const sameRow = (a: Draft, b: Draft) => a.date === b.date && a.deposit === b.deposit && a.withdraw === b.withdraw && a.balance === b.balance

/** ขั้น "ปรับ": เลือกสัปดาห์ → ถ่าย/แนบรูปสมุดบัญชี (กี่รูปก็ได้ นับเป็นการสแกนครั้งเดียว) → จับคู่เงินโอนเข้ากับรายรับที่บันทึกไว้ */
export default function Adjust({ year }: { year: number }) {
  const role = useRole()
  const canWrite = can(role, 'statement')
  const pb = usePassbook(year)
  const income = useIncome(year)
  const types = useIncomeTypes()
  const scans = usePassbookScans(year)
  const [shots, setShots] = useState<{ path: string; name: string }[]>([]) // รูปที่อัปโหลดแล้ว รอกดบันทึก
  const [viewer, setViewer] = useState<PassbookScan | null>(null)
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => { const s = sheetSunday(todayISO()); return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0]) })
  const from = addDays(sunday, -6)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [pickType, setPickType] = useState<Record<string, string>>({})
  const token = useRef(0)
  const typeName = (id: string) => types.list.find((t) => t.id === id)?.name ?? 'ไม่ระบุประเภท'

  const weekLines = useMemo(() => fixKinds(pb.items).filter((l) => lineWeek(l) === sunday).sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated), [pb.items, sunday])
  const match = useMemo(() => matchBankIn(pb.items, income.items), [pb.items, income.items])
  const transfersIn = weekLines.filter((l) => l.kind === 'in')
  const matched = transfersIn.flatMap((l) => { const inc = income.items.find((x) => x.id === match.get(l.id)); return inc ? [{ line: l, inc }] : [] })
  const unknown = [...transfersIn.filter((l) => !match.has(l.id)), ...weekLines.filter((l) => l.kind === 'other' && l.dir === 'in')]
  const usedIds = new Set(match.values())
  const missing = income.items.filter((x) => !x.deleted && x.method === 'transfer' && x.date >= from && x.date <= sunday && !usedIds.has(x.id))
  const cash = weekLines.filter((l) => l.kind === 'deposit')
  const outs = weekLines.filter((l) => l.kind === 'withdraw' || l.kind === 'out' || (l.kind === 'other' && l.dir === 'out'))
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)

  /** เก็บรูปไว้ใน repo ข้อมูล (ย่อให้เล็กลง) — เก็บไม่ได้ก็ไม่ขวางการอ่านรูป */
  const keepShot = async (f: File) => {
    try {
      const { data, ext } = await compressImage(f, 1600, 0.72)
      const path = `attachments/passbook/${sunday}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${ext}`
      const cfg = getSync()
      if (cfg) await putBinary(cfg, path, data, 'รูปสมุดบัญชี')
      await cacheImage(path, data)
      setShots((xs) => [...xs, { path, name: f.name || `passbook.${ext}` }])
    } catch { /* ข้ามเงียบ ๆ */ }
  }
  /** อ่านทุกรูปที่เลือก (ทีละรูป) แล้วต่อเป็นรายการเดียว · รูปที่ซ้อนกันข้ามหน้าจะตัดบรรทัดซ้ำให้ */
  const readAll = async (files: File[]) => {
    const t = ++token.current
    setMsg(''); setBusy(`กำลังอ่านรูป 1/${files.length}…`)
    try {
      if (!(await ensureGemini()).key) { setMsg('ยังไม่ได้ใส่รหัส Gemini — ให้แอดมินใส่ที่ ตั้งค่า › ตัวอ่านใบถวาย (Gemini)'); setBusy(''); return }
      let acc: Draft[] = drafts ? [...drafts] : []
      let outside = 0, empty = 0
      for (let i = 0; i < files.length; i++) {
        setBusy(`กำลังอ่านรูป ${i + 1}/${files.length}…`)
        const r = await readPassbook(files[i])
        void keepShot(files[i])
        if (t !== token.current) return
        const rows = normalizeRows(r.rows).map((x) => ({ date: x.date ?? '', code: x.code ?? '', desc: x.desc ?? '', deposit: x.deposit ?? null, withdraw: x.withdraw ?? null, balance: x.balance ?? null }))
        if (rows.length === 0) empty++
        for (const d of rows) {
          if (d.date && (d.date < from || d.date > sunday)) { outside++; continue }
          if (acc.some((x) => sameRow(x, d))) continue // ซ้ำกับรูปก่อนหน้า
          acc = [...acc, d]
        }
      }
      setDrafts(acc)
      setMsg([`อ่านได้ ${acc.length} บรรทัดในสัปดาห์นี้`, outside ? `ข้าม ${outside} บรรทัดที่อยู่นอกช่วง ${fmtDate(from)}–${fmtDate(sunday)}` : '', empty ? `${empty} รูปอ่านไม่เจอรายการ (ถ่ายให้เห็นทั้งหน้า ไม่เอียง)` : ''].filter(Boolean).join(' · '))
    } catch (e) { if (t === token.current) setMsg(e instanceof Error ? e.message : 'อ่านรูปไม่สำเร็จ') }
    if (t === token.current) setBusy('')
  }
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) void readAll(fs) }

  const bad = drafts ? new Set(checkChain(drafts.map((d) => ({ deposit: d.deposit ?? 0, withdraw: d.withdraw ?? 0, balance: d.balance ?? undefined })))) : new Set<number>()
  const upd = (i: number, patch: Partial<Draft>) => setDrafts((xs) => xs && xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const save = () => {
    if (!drafts) return
    if (drafts.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.date))) return setMsg('ใส่วันที่ให้ครบทุกบรรทัด')
    const fresh: PassbookLine[] = drafts.filter((d) => (d.deposit ?? 0) > 0 || (d.withdraw ?? 0) > 0).map((d) => ({
      id: newId('pb'), updated: 0, date: d.date, kind: classify({ code: d.code, desc: d.desc, deposit: d.deposit ?? 0, withdraw: d.withdraw ?? 0 }), dir: (d.deposit ?? 0) > 0 ? 'in' : 'out',
      amount: (d.deposit ?? 0) > 0 ? (d.deposit as number) : (d.withdraw as number), ...(d.balance !== null ? { balance: d.balance } : {}), ...(d.desc ? { desc: d.desc } : {}),
    }))
    const add = dedupeLines(pb.items, fresh)
    if (add.length && !pb.put(add)) return setMsg('สิทธิ์ของท่านบันทึกไม่ได้')
    if (shots.length) scans.put(shots.map((x) => ({ id: newId('ps'), updated: 0, week: sunday, path: x.path, name: x.name })))
    setShots([])
    setDrafts(null); setMsg(add.length ? `บันทึก ${add.length} บรรทัดแล้ว — ดูผลจับคู่ด้านล่าง` : 'ทุกบรรทัดมีอยู่แล้ว ไม่ได้บันทึกซ้ำ')
  }
  const clearWeek = () => {
    if (weekLines.length === 0 || !window.confirm(`ลบรายการสมุดของสัปดาห์นี้ ${weekLines.length} บรรทัด เพื่อสแกนใหม่?`)) return
    pb.put(weekLines.map((l) => ({ ...l, deleted: true })))
    setMsg('ลบแล้ว — แนบรูปสมุดใหม่ได้เลย')
  }
  const toIncome = (l: PassbookLine) => {
    const typeId = pickType[l.id]
    if (!typeId) return setMsg('เลือกประเภทรายรับก่อน')
    const id = newId('in')
    income.put([{ id, updated: 0, date: l.date, typeId, amount: l.amount, method: 'transfer', note: 'ลงจากสมุดบัญชี (ไม่มีสลิป)', source: 'manual' }])
    pb.put([{ ...l, link: { kind: 'income', id } }])
  }
  const report: AdjReport = {
    title: weekTitle(sunday), range: weekRange(sunday),
    matched: matched.map(({ line, inc }) => ({ date: line.date, amount: line.amount, label: typeName(inc.typeId) })),
    unknown: unknown.map((l) => ({ date: l.date, amount: l.amount })),
    missing: missing.map((x) => ({ date: x.date, amount: x.amount, label: `${typeName(x.typeId)}${x.ref ? ` อ้างอิง ${x.ref}` : ''}${x.note ? ` · ${x.note}` : ''} (ไม่พบเงินเข้าในสมุด)` })),
    cash: sum(cash), out: sum(outs), ...(weekLines.length ? (() => { const b = [...weekLines].reverse().find((l) => l.balance !== undefined)?.balance; return b !== undefined ? { closing: b } : {} })() : {}),
  }
  const share = async () => { const r = await shareText('รายงานตรวจสมุดบัญชี', adjReportText(report)); if (r === 'copied') setMsg('คัดลอกรายงานแล้ว วางในแชต LINE ได้เลย'); else if (r === 'failed') setMsg('แชร์/คัดลอกไม่สำเร็จ') }
  const row = (l: PassbookLine) => `${fmtDate(l.date)} · ${l.desc ?? ''}`

  return (
    <div className="stack">
      <WeekBar sunday={sunday} sundays={sundays} onChange={(s) => { setSunday(s); setDrafts(null); setMsg('') }} />
      <p className="muted small">เลือกสัปดาห์ แล้วแนบรูปสมุดบัญชีที่ปิดหัวท้ายให้เหลือเฉพาะวันที่ {fmtDate(from)} – {fmtDate(sunday)} (ถ่ายหลายรูปได้ ระบบนับเป็นการสแกนครั้งเดียว)</p>

      {canWrite && (
        <section className="card no-print">
          <h2>📷 สแกนสมุดบัญชี</h2>
          <div className="capbar__row">
            <label className="act-btn"><span className="act-btn__ico" aria-hidden="true">📎</span><span>แนบรูป (เลือกได้หลายรูป)</span>
              <input type="file" accept="image/*" multiple aria-label="แนบรูปสมุดบัญชี" style={{ display: 'none' }} disabled={!!busy} onChange={pick} /></label>
            <label className="act-btn"><span className="act-btn__ico" aria-hidden="true">📷</span><span>ถ่ายรูปเพิ่ม</span>
              <input type="file" accept="image/*" capture="environment" aria-label="ถ่ายรูปสมุดบัญชี" style={{ display: 'none' }} disabled={!!busy} onChange={pick} /></label>
          </div>
          {busy && <p className="note" role="status">{busy}</p>}
          {msg && <p className="note" role="status">{msg}</p>}
          {drafts && (
            <>
              <p className="small">ตรวจให้ตรงกับสมุด · บรรทัดสีแดง = ยอดคงเหลือไม่ลงตัวกับบรรทัดก่อนหน้า (น่าจะอ่านผิดหรือตกหล่น) · จะถ่ายหน้าถัดไปเพิ่มก็ได้ ระบบต่อให้</p>
              {drafts.map((d, i) => (
                <div key={i} className="pbdraft" style={bad.has(i) ? { borderColor: 'var(--bad)' } : undefined}>
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
                    return gap !== 0 ? <p className="small err">ยอดคงเหลือต่างจากบรรทัดก่อน {fmtBaht(Math.abs(gap))} — ตรวจกับสมุด</p> : null
                  })()}
                </div>
              ))}
              {bad.size > 0 && <p className="err" role="alert">มี {bad.size} บรรทัดที่ยอดคงเหลือไม่ลงตัว — ตรวจกับสมุดก่อน (บันทึกต่อได้ถ้าสมุดพิมพ์เป็นอย่างนั้นจริง)</p>}
              <div className="row"><button type="button" className="btn btn--gold grow" onClick={save} disabled={drafts.length === 0}>บันทึกและจับคู่</button><button type="button" className="btn btn--ghost" onClick={() => { shots.forEach((x) => void removeMemberPhotoFile(x.path)); setShots([]); setDrafts(null); setMsg('') }}>ยกเลิก</button></div>
            </>
          )}
        </section>
      )}

      <section className="card" aria-label="ผลจับคู่สัปดาห์นี้">
        <h2>📄 รายงานตรวจสมุดบัญชี</h2>
        <p className="small" style={{ margin: 0 }}><b>{weekTitle(sunday)}</b> · ระหว่างวันที่ {weekRange(sunday)}</p>
        {weekLines.length === 0 ? <p className="muted">ยังไม่มีรายการจากสมุดในสัปดาห์นี้ — แนบรูปสมุดด้านบน</p> : (
          <>
            <p className={`adjverdict${adjOk(report) ? ' adjverdict--ok' : ''}`} role="status">{adjOk(report) ? '✅ ผลตรวจ: ตรงกันครบถ้วน' : '⚠️ ผลตรวจ: มีรายการที่ต้องตรวจ'}</p>
            <div className="adjsum">
              <div className="adjsum__ok"><b>✓ ตรงกัน {matched.length} รายการ</b><br />{fmtBaht(sum(matched.map((m) => m.line)))}</div>
              <div className="adjsum__unk"><b>❓ {UNKNOWN_INCOME_LABEL} {unknown.length} รายการ</b><br />{fmtBaht(sum(unknown))}</div>
              <div className="adjsum__miss"><b>⚠ ไม่พบเงินเข้า {missing.length} รายการ</b><br />{fmtBaht(sum(missing))}</div>
            </div>

            <h3>✓ ตรงกับที่บันทึกไว้</h3>
            {matched.length === 0 ? <p className="muted small">ไม่มี</p> : <ul className="list">{matched.map(({ line, inc }) => (
              <li key={line.id} className="row row--between"><span>{row(line)}<br /><span className="small muted">ตรงกับรายรับ “{typeName(inc.typeId)}” ที่บันทึก {fmtDate(inc.date)}{inc.note ? ` · ${inc.note}` : ''}</span></span><b>{fmtBaht(line.amount)}</b></li>
            ))}</ul>}

            <h3>❓ {UNKNOWN_INCOME_LABEL}</h3>
            <p className="small muted">มีเงินเข้าสมุด แต่ไม่มีรายรับที่บันทึกไว้ตรงกัน (ไม่ทราบที่มา/วัตถุประสงค์) — ระบุว่าเป็นรายรับอะไรได้</p>
            {unknown.length === 0 ? <p className="muted small">ไม่มี</p> : <ul className="list">{unknown.map((l) => (
              <li key={l.id}>
                <div className="row row--between"><span>{row(l)}</span><b>{fmtBaht(l.amount)}</b></div>
                {l.link ? <span className="badge">ลงเป็นรายรับแล้ว</span> : canWrite && (
                  <div className="row" style={{ gap: 6 }}>
                    <select className="input" aria-label="ประเภทรายรับ" value={pickType[l.id] ?? ''} onChange={(e) => setPickType({ ...pickType, [l.id]: e.target.value })}>
                      <option value="">เลือกประเภท…</option>
                      {types.list.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button type="button" className="mini" onClick={() => toIncome(l)}>ลงเป็นรายรับ</button>
                  </div>
                )}
              </li>
            ))}</ul>}

            <h3>⚠ บันทึกว่าโอนแล้ว แต่ไม่พบเงินเข้าในสมุด</h3>
            {missing.length === 0 ? <p className="muted small">ไม่มี — ทุกรายการโอนที่บันทึกไว้เจอเงินเข้าในสมุดครบ</p> : (
              <>
                <p className="err" role="alert">มี {missing.length} รายการที่บันทึกว่าโอนแล้ว ({fmtBaht(sum(missing))}) แต่สมุดบัญชีสัปดาห์นี้ไม่มีเงินเข้าตรงกัน — อาจเป็นสลิปที่ไม่มีการโอนจริง หรือบันทึกยอด/วันที่ผิด · ระบบไม่ลบให้ กดไปตรวจที่หน้ารายรับแล้วตัดสินใจเอง</p>
                <ul className="list">{missing.map((x) => (
                  <li key={x.id} className="adjmiss">
                    <div className="row row--between"><b>{typeName(x.typeId)}</b><b>{fmtBaht(x.amount)}</b></div>
                    <div className="small">วันที่ {fmtDate(x.date)}{x.time ? ` เวลา ${x.time}` : ''} · {x.slip ? '📎 มีสลิปแนบ' : 'ไม่มีสลิปแนบ'}{x.ref ? ` · อ้างอิง ${x.ref}` : ''}{x.memberNo ? ` · สมาชิก ${x.memberNo}` : ''}{x.note ? ` · ${x.note}` : ''}</div>
                    <Link className="mini" to={`/income?focus=${x.id}`}>🔎 ไปตรวจที่หน้ารายรับ</Link>
                  </li>
                ))}</ul>
              </>
            )}

            <details>
              <summary>รายการอื่นในสมุดสัปดาห์นี้ (ฝากเงินสด {fmtBaht(sum(cash))} · ออก {fmtBaht(sum(outs))})</summary>
              <ul className="list">{[...cash, ...outs].map((l) => <li key={l.id} className="row row--between"><span>{row(l)}</span><b>{l.kind === 'deposit' ? '+' : '−'}{fmtBaht(l.amount)}</b></li>)}</ul>
            </details>
            {report.closing !== undefined && <p className="small"><b>ยอดคงเหลือท้ายสัปดาห์ (ตามสมุด) {fmtBaht(report.closing)}</b></p>}
            <div className="row no-print"><button type="button" className="btn btn--gold grow" onClick={() => void share()}>📤 แชร์รายงาน</button><button type="button" className="btn btn--ghost" onClick={() => window.print()}>🖨 พิมพ์</button></div>
            {canWrite && <button type="button" className="btn btn--ghost no-print" onClick={clearWeek}>🗑 ลบรายการสมุดสัปดาห์นี้เพื่อสแกนใหม่</button>}
          </>
        )}
      </section>
      <section className="card no-print" aria-label="รูปสมุดบัญชีที่สแกนแล้ว">
        <h2>🖼 รูปสมุดบัญชีที่สแกนแล้ว</h2>
        {scans.items.length === 0 ? <p className="muted small">ยังไม่มีรูป — รูปที่สแกนจะมาเก็บที่นี่ ใหม่สุดอยู่บน เก่าสุดอยู่ล่าง</p> : (
          <ul className="scanlist">
            {[...scans.items].sort((a, b) => b.updated - a.updated).map((x) => (
              <li key={x.id}>
                <button type="button" className="scancard" onClick={() => setViewer(x)} aria-label={`เปิดรูปสมุด ${weekTitle(x.week)}`}>
                  <span className="scancard__img"><Thumb path={x.path} alt="รูปหน้าสมุดบัญชี" /></span>
                  <span className="scancard__txt"><b>{weekTitle(x.week)}</b><br /><span className="small muted">วันที่ {weekRange(x.week)} · สแกน {x.updated ? new Date(x.updated).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : 'เมื่อสักครู่'}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {viewer && <ImageViewer path={viewer.path} name={viewer.name} title={`สมุดบัญชี ${weekTitle(viewer.week)}`} onClose={() => setViewer(null)} />}
    </div>
  )
}
