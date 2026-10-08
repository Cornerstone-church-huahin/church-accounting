import { useEffect, useMemo, useState } from 'react'
import MoneyInput from '../components/MoneyInput'
import Sheet from '../components/Sheet'
import { whoAmI } from '../lib/access'
import { getGemini, readSheet, saveGemini, type SheetRead } from '../lib/gemini'
import { compressImage } from '../lib/image'
import { entriesFromRound, roundId } from '../lib/ledger'
import { fmtBaht, fmtDate, newId, sheetSunday, todayISO, yearOf } from '../lib/money'
import { getBinary, getSync, putBinary } from '../lib/sync'
import type { IncomeType, Round, SheetFile, SheetRowRead } from '../lib/types'
import { useIncome, useIncomeTypes, useRounds, useSheetFiles } from '../lib/data'

type RowDraft = { label: string; typeId: string; envelopes: number | null; amount: number | null }

/** เดาประเภทถวายจากชื่อแถวที่อ่านได้ (ไม่ตรง → "รายได้อื่น" ให้ผู้ใช้เลือกแก้เอง) */
export function matchType(label: string, types: IncomeType[]): string {
  const l = label.replace(/\s+/g, '')
  const act = types.filter((t) => t.active)
  const hit = act.find((t) => { const n = t.name.replace(/\s+/g, '').replace(/\(.*\)/, ''); return n && (l.includes(n) || n.includes(l) || (l.length > 2 && l.includes(n.slice(0, 5)))) })
  return hit?.id ?? act.find((t) => t.id === 'tt6')?.id ?? act[0]?.id ?? ''
}

/** ช่อง 3: แนบรูปใบบันทึกการถวาย → Gemini อ่านแถวเงินสด → ตรวจ/แก้ → ยืนยัน → ใส่ในใบนับวันอาทิตย์ (แสดงในใบสรุปช่อง 4) */
export default function SheetFlow({ year, sunday, existing, onClose }: { year: number; sunday: string; existing: SheetFile | null; onClose: () => void }) {
  const types = useIncomeTypes()
  const files = useSheetFiles(year)
  const rounds = useRounds(year)
  const income = useIncome(year)
  const me = whoAmI()
  const [stage, setStage] = useState<'key' | 'pick' | 'read' | 'review'>(existing ? 'review' : getGemini().key ? 'pick' : 'key')
  const [keyIn, setKeyIn] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [date, setDate] = useState(existing?.date ?? sunday)
  const [rows, setRows] = useState<RowDraft[]>(() => (existing?.read?.rows ?? []).map((r) => ({ label: r.label, typeId: r.typeId, envelopes: r.envelopes ?? null, amount: r.amount })))
  const [written, setWritten] = useState<number | undefined>(existing?.read?.writtenCash)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (file) { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u) }
    const cfg = getSync()
    if (!existing?.file.path || !cfg) return
    let u = ''
    getBinary(cfg, existing.file.path).then((b) => { u = URL.createObjectURL(b); setUrl(u) }).catch(() => undefined)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [file, existing])

  const applyRead = (r: SheetRead) => {
    setRows(r.rows.map((x) => ({ label: x.label, typeId: matchType(x.label, types.list), envelopes: x.envelopes ?? null, amount: x.amount })))
    setWritten(r.writtenCash)
    if (r.date && sheetSunday(r.date) === r.date && yearOf(r.date) === year) setDate(r.date)
    setMsg(r.rows.length ? '' : 'ระบบอ่านแถวเงินสดไม่ได้ — กรอกเองได้ในตารางด้านล่าง')
  }
  const doRead = async (f: Blob) => {
    setStage('read'); setErr('')
    try { applyRead(await readSheet(f)) } catch (e) { setMsg(e instanceof Error ? e.message : 'อ่านใบถวายไม่สำเร็จ'); setRows([]) }
    setStage('review')
  }
  const reread = async () => {
    let f: Blob | null = file
    const cfg = getSync()
    if (!f && existing?.file.path && cfg) { try { f = await getBinary(cfg, existing.file.path) } catch { /* ignore */ } }
    if (!f) return setErr('ไม่มีรูปให้อ่านซ้ำ')
    void doRead(f)
  }

  const total = useMemo(() => rows.reduce((s, r) => s + (r.amount ?? 0), 0), [rows])
  const upd = (i: number, patch: Partial<RowDraft>) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const save = async () => {
    const clean = rows.filter((r) => (r.amount ?? 0) > 0)
    if (clean.length === 0) return setErr('ใส่ยอดอย่างน้อย 1 แถว')
    if (clean.some((r) => !r.typeId)) return setErr('เลือกประเภทถวายให้ครบทุกแถว')
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${year + 543}`)
    let f = existing?.file ?? { path: '', name: file?.name ?? 'ใบบันทึกการถวาย' }
    if (file) {
      const cfg = getSync()
      if (cfg) {
        setBusy(true)
        try {
          const { data, ext } = await compressImage(file)
          const path = `attachments/${year}/sheet-${Date.now().toString(36)}.${ext}`
          await putBinary(cfg, path, data, 'ใบบันทึกการถวาย')
          f = { path, name: file.name }
        } catch (e) { setBusy(false); return setErr(e instanceof Error ? e.message : 'แนบไฟล์ไม่สำเร็จ') }
        setBusy(false)
      } else f = { path: '', name: file.name }
    }
    const read: SheetRowRead[] = clean.map((r) => ({ label: r.label.trim() || (types.byId(r.typeId)?.name ?? ''), typeId: r.typeId, ...(r.envelopes ? { envelopes: r.envelopes } : {}), amount: r.amount ?? 0 }))
    const fid = existing?.id ?? newId('sf')
    // ยอดเงินสดต่อประเภท → ใบนับวันอาทิตย์
    const lines: Record<string, number> = {}, envelopes: Record<string, number> = {}
    for (const r of read) { lines[r.typeId] = (lines[r.typeId] ?? 0) + r.amount; if (r.envelopes) envelopes[r.typeId] = (envelopes[r.typeId] ?? 0) + r.envelopes }
    const old = rounds.items.find((x) => x.date === date)
    if (old && old.status === 'verified' && !confirm('ใบนับวันอาทิตย์นี้ยืนยันยอดแล้ว — จะแก้ยอดเงินสดตามใบที่อ่านนี้ ใช่ไหม?')) return
    const round: Round = old
      ? { ...old, lines, envelopes, sheetFileId: fid, updated: 0 }
      : { id: roundId(date), date, lines, envelopes, denoms: {}, status: 'counting', counter: { id: me.id, name: me.name }, sheetFileId: fid, updated: 0 }
    if (!files.put([{ id: fid, date, file: f, read: { rows: read, ...(written ? { writtenCash: written } : {}) }, updated: 0 }])) return
    if (rounds.put([round]) && round.status === 'verified') {
      const gone = Object.keys(old?.lines ?? {}).filter((k) => !(k in lines)).flatMap((k) => entriesFromRound({ ...(old as Round), lines: { [k]: 0 } }))
      income.put([...entriesFromRound(round), ...gone])
    }
    onClose()
  }

  if (stage === 'key') return (
    <Sheet title="ตั้งค่าตัวอ่านใบถวาย (Gemini)" onClose={onClose}>
      <p className="muted small">ให้ AI (Gemini ของ Google) อ่านรูปใบบันทึกการถวายให้ ต้องมีรหัส API ของท่านเอง (ฟรีตามโควตา) ขอที่ aistudio.google.com/apikey แล้ววางที่นี่ — เก็บในเครื่องนี้เครื่องเดียว ไม่ส่งขึ้นที่เก็บข้อมูล และไม่ต้องส่งให้ใครในแชต</p>
      <div className="field"><label htmlFor="g-key">รหัส Gemini API</label><input id="g-key" className="input" type="password" autoComplete="off" value={keyIn} onChange={(e) => setKeyIn(e.target.value)} /></div>
      <div className="row">
        <button type="button" className="btn btn--gold grow" disabled={!keyIn.trim()} onClick={() => { saveGemini(keyIn); setKeyIn(''); setStage('pick') }}>บันทึกรหัส</button>
        <button type="button" className="btn btn--ghost" onClick={() => setStage('pick')}>ข้าม (กรอกเอง)</button>
      </div>
    </Sheet>
  )
  if (stage === 'pick' || stage === 'read') return (
    <Sheet title="แนบไฟล์ใบบันทึกการถวาย" onClose={onClose}>
      {stage === 'pick' ? (
        <>
          <p className="muted small">ถ่ายรูปหรือเลือกรูปใบบันทึกการถวายวันอาทิตย์ ระบบจะอ่านแถวเงินสด (รวมแถวที่เขียนมือเพิ่ม) แล้วให้ท่านตรวจและยืนยัน</p>
          <label className="btn btn--gold" style={{ display: 'block', textAlign: 'center' }}>
            📷 เลือกรูปใบบันทึกการถวาย
            <input type="file" accept="image/*" aria-label="เลือกรูปใบบันทึกการถวาย" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setFile(f); if (getGemini().key) void doRead(f); else { setMsg('ยังไม่ได้ใส่รหัส Gemini — กรอกแถวเองได้'); setStage('review') } }} />
          </label>
          <button type="button" className="mini" onClick={() => setStage('key')} style={{ marginTop: 8 }}>🔑 ตั้งค่ารหัส Gemini</button>
        </>
      ) : (
        <div role="status" aria-live="polite"><p><b>กำลังอ่านใบบันทึกการถวาย…</b></p><progress style={{ width: '100%' }} /><p className="muted small">ใช้เวลาประมาณ 5–15 วินาที</p></div>
      )}
    </Sheet>
  )
  const diff = written !== undefined ? total - written : undefined
  return (
    <Sheet title={existing ? 'ใบบันทึกการถวาย — ตรวจ/แก้ไข' : 'ตรวจและยืนยันใบบันทึกการถวาย'} onClose={onClose}>
      {url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="ใบบันทึกการถวาย" style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 8 }} /></a>}
      {msg && <p className="note" role="status">{msg}</p>}
      <div className="field"><label htmlFor="sf-date">ประจำวันอาทิตย์ที่</label><input id="sf-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <table className="tbl" aria-label="แถวเงินสดในใบถวาย">
        <thead><tr><th>รายการ / ประเภท</th><th className="num">ซอง</th><th className="num">เงิน (บาท)</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <input className="input" aria-label={`ชื่อแถว ${i + 1}`} value={r.label} onChange={(e) => upd(i, { label: e.target.value })} />
                <select className="input" aria-label={`ประเภทแถว ${i + 1}`} value={r.typeId} onChange={(e) => upd(i, { typeId: e.target.value })}>
                  {types.list.filter((t) => t.active || t.id === r.typeId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </td>
              <td className="num"><input className="input" style={{ width: '3.4rem' }} inputMode="numeric" aria-label={`ซองแถว ${i + 1}`} value={r.envelopes ?? ''} onChange={(e) => upd(i, { envelopes: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} /></td>
              <td className="num"><MoneyInput id={`sr-amt-${i}`} value={r.amount} onChange={(v) => upd(i, { amount: v })} /></td>
              <td><button type="button" className="mini" aria-label={`ลบแถว ${i + 1}`} onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2}>รวมเงินสด</td><td className="num">{fmtBaht(total)}</td><td /></tr></tfoot>
      </table>
      <button type="button" className="mini" onClick={() => setRows((xs) => [...xs, { label: '', typeId: matchType('', types.list), envelopes: null, amount: null }])}>＋ เพิ่มแถว</button>
      {diff !== undefined && (diff === 0 ? <p className="ok">✓ ตรงกับยอด “รวมจากตู้ถวาย” ที่เขียนในใบ ({fmtBaht(written ?? 0)})</p> : <p className="err" role="alert">⚠️ ยอดรวมต่างจากที่เขียนในใบ ({fmtBaht(written ?? 0)}) อยู่ {fmtBaht(Math.abs(diff))} — ตรวจแถวที่อ่านผิด</p>)}
      <p className="muted small">ตารางนี้นับเฉพาะเงินสด · เงินโอนมาจากสลิป (ช่อง 2) · ใบวันที่ {fmtDate(date)}{date > todayISO() ? ' (ยังไม่ถึง)' : ''}</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row">
        <button type="button" className="btn btn--gold grow" disabled={busy} onClick={save}>{busy ? 'กำลังอัปโหลด…' : 'ยืนยันและบันทึก'}</button>
        {getGemini().key && <button type="button" className="btn btn--ghost" onClick={reread}>อ่านซ้ำ</button>}
      </div>
    </Sheet>
  )
}
