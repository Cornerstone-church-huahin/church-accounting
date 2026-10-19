import { useEffect, useMemo, useRef, useState } from 'react'
import MoneyInput from './MoneyInput'
import Sheet from './Sheet'
import { ensureGemini, readIncomePaper, readVoucherPaper, type IncomePaperRow, type VoucherPaperRow } from '../lib/gemini'
import { fmtBaht, fmtDate, newId, yearOf } from '../lib/money'
import { matchType } from '../pages/SheetFlow'
import type { ExpenseCat, ExpenseEntry, IncomeEntry, IncomeType } from '../lib/types'

type Stage = 'read' | 'review'

/** อ่านรูปใบกระดาษทีละรูป (หลายรูป = ใบเดียวกันหลายหน้า) แล้วต่อแถวเป็นรายการเดียว · แถวซ้ำกันข้ามรูปตัดให้ */
function useScan<R>(files: File[], read: (f: File) => Promise<R[]>) {
  const [stage, setStage] = useState<Stage>('read')
  const [rows, setRows] = useState<R[]>([])
  const [msg, setMsg] = useState('')
  const [progress, setProgress] = useState('')
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      if (!(await ensureGemini()).key) { setMsg('ยังไม่ได้ใส่รหัส Gemini — ให้แอดมินใส่ที่ ตั้งค่า › ตัวอ่านใบถวาย (Gemini) · ตอนนี้กรอกเองในหน้านี้ได้'); setStage('review'); return }
      let acc: R[] = []
      const errs: string[] = []
      for (let i = 0; i < files.length; i++) {
        setProgress(`กำลังอ่านรูป ${i + 1}/${files.length}…`)
        try {
          const got = await read(files[i])
          const seen = new Set(acc.map((x) => JSON.stringify(x)))
          acc = [...acc, ...got.filter((x) => !seen.has(JSON.stringify(x)))]
        } catch (e) { errs.push(e instanceof Error ? e.message : 'อ่านรูปไม่สำเร็จ') }
      }
      setRows(acc)
      setMsg(errs.length ? errs[0] : acc.length === 0 ? 'อ่านไม่เจอแถวที่มียอดเงิน — ลองถ่ายให้เห็นทั้งใบ ไม่เอียง หรือเพิ่มแถวเองด้านล่าง' : '')
      setStage('review')
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { stage, rows, msg, progress }
}

const Reading = ({ title, progress, onClose }: { title: string; progress: string; onClose: () => void }) => (
  <Sheet title={title} onClose={onClose}><div role="status" aria-live="polite"><p><b>{progress || 'กำลังอ่านใบ…'}</b></p><progress style={{ width: '100%' }} /><p className="muted small">ใช้เวลาประมาณ 5–15 วินาทีต่อรูป</p></div></Sheet>
)

// ---------------- ใบบันทึกการถวาย (รับ) ----------------
interface IncDraft { on: boolean; date: string; label: string; typeId: string; cashCount: string; cash: number | null; trCount: string; transfer: number | null; dup: boolean }

export function IncomeScan({ files, from, to, sunday, year, types, existing, onSave, onClose }: { files: File[]; from: string; to: string; sunday: string; year: number; types: IncomeType[]; existing: IncomeEntry[]; onSave: (e: IncomeEntry[]) => boolean; onClose: () => void }) {
  const { stage, rows, msg, progress } = useScan<IncomePaperRow>(files, (f) => readIncomePaper(f, from, to))
  const [drafts, setDrafts] = useState<IncDraft[] | null>(null)
  const [err, setErr] = useState('')
  const isDup = (d: { date: string; typeId: string; cash: number | null; transfer: number | null }) => existing.some((x) => !x.deleted && x.date === d.date && x.typeId === d.typeId && ((x.method === 'cash' && d.cash === x.amount) || (x.method === 'transfer' && d.transfer === x.amount)))
  useEffect(() => {
    if (stage !== 'review' || drafts) return
    setDrafts(rows.map((r) => {
      const typeId = matchType(r.label, types)
      const d = { on: true, date: r.date ?? sunday, label: r.label, typeId, cashCount: r.cashCount ? String(r.cashCount) : '', cash: r.cash ?? null, trCount: r.transferCount ? String(r.transferCount) : '', transfer: r.transfer ?? null, dup: false }
      const dup = isDup(d)
      return { ...d, dup, on: !dup }
    }))
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = drafts ?? []
  const upd = (i: number, p: Partial<IncDraft>) => setDrafts((xs) => (xs ?? []).map((x, j) => (j === i ? { ...x, ...p } : x)))
  const total = useMemo(() => list.filter((d) => d.on).reduce((s, d) => s + (d.cash ?? 0) + (d.transfer ?? 0), 0), [list])
  const nameOf = (id: string) => types.find((t) => t.id === id)?.name ?? ''
  if (stage === 'read' || !drafts) return <Reading title="สแกนใบบันทึกการถวาย" progress={progress} onClose={onClose} />
  const save = () => {
    const out: IncomeEntry[] = []
    for (const d of list.filter((x) => x.on)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return setErr('ใส่วันที่ให้ครบทุกแถวที่เลือก')
      if (yearOf(d.date) !== year) return setErr(`วันที่ ${fmtDate(d.date)} ไม่อยู่ในปี ${year + 543}`)
      if (!d.typeId) return setErr('เลือกรายการให้ครบทุกแถวที่เลือก')
      const note = d.label.trim() && d.label.trim() !== nameOf(d.typeId) ? { note: d.label.trim() } : {}
      const n = (s: string) => { const v = Number(s.replace(/\D/g, '')); return v > 0 ? { count: v } : {} }
      if ((d.cash ?? 0) > 0) out.push({ id: newId('in'), updated: 0, date: d.date, typeId: d.typeId, amount: d.cash as number, method: 'cash', source: 'manual', ...n(d.cashCount), ...note })
      if ((d.transfer ?? 0) > 0) out.push({ id: newId('in'), updated: 0, date: d.date, typeId: d.typeId, amount: d.transfer as number, method: 'transfer', source: 'manual', ...n(d.trCount), ...note })
    }
    if (out.length === 0) return setErr('ยังไม่ได้เลือกแถวที่มียอดเงิน')
    if (!onSave(out)) return setErr('สิทธิ์ของท่านบันทึกไม่ได้')
    onClose()
  }
  return (
    <Sheet title="ตรวจใบบันทึกการถวายที่สแกน" onClose={onClose}>
      {msg && <p className="note" role="status">{msg}</p>}
      <p className="small muted">ระบบกรอกให้ตามตำแหน่งในใบ — ตรวจและแก้ได้ทุกช่อง แล้วกดเพิ่มลงใบ (แถวที่ติ๊กออก/ซ้ำกับที่บันทึกไว้แล้วจะไม่ถูกเพิ่ม)</p>
      {list.map((d, i) => (
        <div key={i} className="pbdraft" style={d.on ? undefined : { opacity: 0.55 }}>
          <div className="row" style={{ gap: 6 }}>
            <label className="small"><input type="checkbox" checked={d.on} onChange={(e) => upd(i, { on: e.target.checked })} aria-label={`เพิ่มแถว ${i + 1}`} /> แถว {i + 1}</label>
            {d.dup && <span className="badge">✓ มีอยู่แล้ว</span>}
            <input className="input" type="date" aria-label={`วันที่ แถว ${i + 1}`} value={d.date} onChange={(e) => upd(i, { date: e.target.value })} />
            <button type="button" className="mini" aria-label={`ลบแถว ${i + 1}`} onClick={() => setDrafts(list.filter((_, j) => j !== i))}>×</button>
          </div>
          <input className="input" aria-label={`ชื่อรายการ แถว ${i + 1}`} value={d.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="รายการ" />
          <select className="input" aria-label={`ประเภท แถว ${i + 1}`} value={d.typeId} onChange={(e) => upd(i, { typeId: e.target.value })}>
            {types.filter((t) => t.active || t.id === d.typeId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="grid2">
            <div><span className="small">เงินสด · ซอง</span><input className="input" inputMode="numeric" aria-label={`ซอง แถว ${i + 1}`} value={d.cashCount} onChange={(e) => upd(i, { cashCount: e.target.value })} /><MoneyInput value={d.cash} onChange={(v) => upd(i, { cash: v })} /></div>
            <div><span className="small">โอน · ครั้ง</span><input className="input" inputMode="numeric" aria-label={`ครั้งโอน แถว ${i + 1}`} value={d.trCount} onChange={(e) => upd(i, { trCount: e.target.value })} /><MoneyInput value={d.transfer} onChange={(v) => upd(i, { transfer: v })} /></div>
          </div>
          <p className="small" style={{ margin: 0 }}>รวมแถว <b>{fmtBaht((d.cash ?? 0) + (d.transfer ?? 0))}</b></p>
        </div>
      ))}
      <button type="button" className="mini" onClick={() => setDrafts([...list, { on: true, date: sunday, label: '', typeId: matchType('', types), cashCount: '', cash: null, trCount: '', transfer: null, dup: false }])}>＋ เพิ่มแถว</button>
      <p><b>รวมที่จะเพิ่ม {fmtBaht(total)}</b></p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>เพิ่มลงใบ</button><button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button></div>
    </Sheet>
  )
}

// ---------------- ใบเบิก-จ่ายเงินสด (จ่าย) ----------------
interface VoDraft { on: boolean; date: string; desc: string; amount: number | null; note: string; biller: string; who: string; dup: boolean }

export function VoucherScan({ files, from, to, sunday, year, cats, existing, fundId, onSave, onClose }: { files: File[]; from: string; to: string; sunday: string; year: number; cats: ExpenseCat[]; existing: ExpenseEntry[]; fundId?: string; onSave: (e: ExpenseEntry[]) => boolean; onClose: () => void }) {
  const { stage, rows, msg, progress } = useScan<VoucherPaperRow>(files, (f) => readVoucherPaper(f, from, to))
  const [drafts, setDrafts] = useState<VoDraft[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (stage !== 'review' || drafts) return
    setDrafts(rows.map((r) => {
      const date = r.date ?? sunday
      const dup = existing.some((x) => !x.deleted && x.date === date && x.amount === r.amount && x.desc.replace(/\s+/g, '') === r.desc.replace(/\s+/g, ''))
      return { on: !dup, date, desc: r.desc, amount: r.amount, note: r.note ?? '', biller: r.biller ?? '', who: r.who ?? '', dup }
    }))
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = drafts ?? []
  const upd = (i: number, p: Partial<VoDraft>) => setDrafts((xs) => (xs ?? []).map((x, j) => (j === i ? { ...x, ...p } : x)))
  const total = list.filter((d) => d.on).reduce((s, d) => s + (d.amount ?? 0), 0)
  if (stage === 'read' || !drafts) return <Reading title="สแกนใบเบิก-จ่ายเงินสด" progress={progress} onClose={onClose} />
  const save = () => {
    const out: ExpenseEntry[] = []
    for (const d of list.filter((x) => x.on)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return setErr('ใส่วันที่ให้ครบทุกแถวที่เลือก')
      if (yearOf(d.date) !== year) return setErr(`วันที่ ${fmtDate(d.date)} ไม่อยู่ในปี ${year + 543}`)
      if (!d.desc.trim()) return setErr('ใส่รายการให้ครบทุกแถวที่เลือก')
      if (!d.amount || d.amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0 ให้ครบทุกแถวที่เลือก')
      const cat = cats.find((c) => c.kind === 'group' && c.active && c.name.replace(/\s+/g, '') === d.desc.replace(/\s+/g, ''))
      out.push({ id: newId('ex'), updated: 0, channel: 'manual', date: d.date, amount: d.amount, desc: d.desc.trim(), status: 'paid', paidDate: d.date, method: 'cash', ...(cat ? { catId: cat.id } : {}), ...(d.note.trim() ? { requester: d.note.trim() } : {}), ...(d.biller.trim() ? { biller: d.biller.trim() } : {}), ...(d.who.trim() ? { who: d.who.trim() } : {}), ...(fundId ? { fundId } : {}) })
    }
    if (out.length === 0) return setErr('ยังไม่ได้เลือกแถวที่มียอดเงิน')
    if (!onSave(out)) return setErr('สิทธิ์ของท่านบันทึกไม่ได้')
    onClose()
  }
  return (
    <Sheet title="ตรวจใบเบิก-จ่ายเงินสดที่สแกน" onClose={onClose}>
      {msg && <p className="note" role="status">{msg}</p>}
      <p className="small muted">ระบบกรอกให้ตามตำแหน่งในใบ — ตรวจและแก้ได้ทุกช่อง แล้วกดเพิ่มลงใบ (แถวที่ติ๊กออก/ซ้ำกับที่บันทึกไว้แล้วจะไม่ถูกเพิ่ม)</p>
      {list.map((d, i) => (
        <div key={i} className="pbdraft" style={d.on ? undefined : { opacity: 0.55 }}>
          <div className="row" style={{ gap: 6 }}>
            <label className="small"><input type="checkbox" checked={d.on} onChange={(e) => upd(i, { on: e.target.checked })} aria-label={`เพิ่มแถว ${i + 1}`} /> แถว {i + 1}</label>
            {d.dup && <span className="badge">✓ มีอยู่แล้ว</span>}
            <input className="input" type="date" aria-label={`วันที่ แถว ${i + 1}`} value={d.date} onChange={(e) => upd(i, { date: e.target.value })} />
            <button type="button" className="mini" aria-label={`ลบแถว ${i + 1}`} onClick={() => setDrafts(list.filter((_, j) => j !== i))}>×</button>
          </div>
          <input className="input" aria-label={`รายการ แถว ${i + 1}`} value={d.desc} onChange={(e) => upd(i, { desc: e.target.value })} placeholder="รายการ" />
          <MoneyInput value={d.amount} onChange={(v) => upd(i, { amount: v })} />
          <input className="input" aria-label={`หมายเหตุ แถว ${i + 1}`} value={d.note} onChange={(e) => upd(i, { note: e.target.value })} placeholder="หมายเหตุ" />
          <div className="grid2">
            <input className="input" aria-label={`ผู้วางบิล แถว ${i + 1}`} value={d.biller} onChange={(e) => upd(i, { biller: e.target.value })} placeholder="ผู้วางบิล" />
            <input className="input" aria-label={`ผู้รับเงิน แถว ${i + 1}`} value={d.who} onChange={(e) => upd(i, { who: e.target.value })} placeholder="ผู้รับเงิน" />
          </div>
        </div>
      ))}
      <button type="button" className="mini" onClick={() => setDrafts([...list, { on: true, date: sunday, desc: '', amount: null, note: '', biller: '', who: '', dup: false }])}>＋ เพิ่มแถว</button>
      <p><b>รวมที่จะเพิ่ม {fmtBaht(total)}</b></p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" onClick={save}>เพิ่มลงใบ</button><button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button></div>
    </Sheet>
  )
}
