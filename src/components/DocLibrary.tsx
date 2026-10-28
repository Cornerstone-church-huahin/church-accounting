import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sheet from './Sheet'
import { canRole, canWork } from '../lib/access'
import { cachedImage, cacheImage } from '../lib/imageCache'
import { useDocCategories, useDocLibrary } from '../lib/data'
import { takePendingDoc, ACCESS_LEVELS, canSeeDoc, categoriesOf, cleanPrefix, fileExt, filterDocs, fmtSize, MAX_DOC_BYTES, nextDocNo, NO_CATEGORY, renumberWithPrefix, snippetOf, sortNewestFirst, titleFromFile } from '../lib/docLibrary'
import { useRole } from '../lib/members'
import { be, fmtDate, newId, todayISO } from '../lib/money'
import { getBinary, getSync, putBinary } from '../lib/sync'
import type { DocAccess, DocItem } from '../lib/types'

const iconOf = (d: DocItem) => (!d.file ? '📄' : /pdf/i.test(d.file.type) || fileExt(d.file.name) === 'pdf' ? '📕' : /^image\//.test(d.file.type) ? '🖼️' : /word|doc/i.test(d.file.type + d.file.name) ? '📘' : /sheet|xls/i.test(d.file.type + d.file.name) ? '📗' : '📎')

async function loadFile(d: DocItem): Promise<File> {
  const f = d.file
  if (!f) throw new Error('เอกสารนี้ยังไม่มีไฟล์')
  const cfg = getSync()
  const b = cfg ? await getBinary(cfg, f.path) : await cachedImage(f.path)
  if (!b) throw new Error('เปิดไฟล์ไม่ได้ — ต้องออนไลน์ก่อน')
  return new File([b], f.name, { type: f.type || b.type || 'application/octet-stream' })
}
const saveToDevice = (file: File) => { const u = URL.createObjectURL(file); const a = document.createElement('a'); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30_000) }

/**
 * งานเลขา › คลังเอกสาร: เก็บไฟล์สำเร็จรูปที่เลขาทำมาแล้ว (PDF/รูป/เอกสาร) แยกตามหมวด · ค้นหา · เลือกหมวด (เพิ่ม/แก้ชื่อ/ลบได้)
 * แถบเอกสารเรียงใหม่สุดอยู่บน เก่าสุดอยู่ล่าง · แตะเอกสาร = เปิดดู ดาวน์โหลด แชร์ได้เลย (ไม่มีหน้าร่างเอกสารในแอป)
 */
export default function DocLibrary() {
  const role = useRole()
  const admin = role === 'admin'
  const editor = admin || canRole(role, 'detail') || canWork(1, 'edit')
  const lib = useDocLibrary()
  const catStore = useDocCategories()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const loc = useLocation(), navigate = useNavigate()
  /** ส่งต่อจากศูนย์จัดการประชุม (ขั้น 10): เปิดฟอร์มเพิ่มเอกสารพร้อมชื่อ/วันที่ของการประชุมให้เลย */
  const [preset] = useState(() => (loc.state as { importMeeting?: DocPreset } | null)?.importMeeting ?? takePendingDoc() ?? undefined)
  const [form, setForm] = useState<DocItem | 'new' | null>(preset ? 'new' : null)
  useEffect(() => { if (preset) navigate(loc.pathname, { replace: true, state: null }) }, [preset, navigate, loc.pathname])
  const [manage, setManage] = useState(false)
  const visible = useMemo(() => lib.list.filter((d) => canSeeDoc(d.access, { admin, editor })), [lib.list, admin, editor])
  const cats = categoriesOf(visible, catStore.list.map((c) => c.name))
  const shown = sortNewestFirst(filterDocs(visible, q, cat))
  const open = visible.find((d) => d.id === openId)
  const prefixOf = (c: string) => cleanPrefix(catStore.list.find((x) => x.name === c)?.prefix ?? '')
  const nextFor = (c: string, exclude?: string) => nextDocNo(lib.list.filter((d) => d.id !== exclude), prefixOf(c) || be(Number(todayISO().slice(0, 4))))
  return (
    <div aria-label="คลังเอกสาร">
      <section className="card no-print" style={{ margin: '0 0 8px' }}>
        <div className="field"><label htmlFor="dl-q">🔎 ค้นหาเอกสาร</label><input id="dl-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นจากชื่อ เลขที่ หมวด หมายเหตุ ชื่อไฟล์" /></div>
        <div className="row" style={{ gap: 8, alignItems: 'end' }}>
          <div className="field" style={{ flex: 1, margin: 0 }}><label htmlFor="dl-cat">📁 เลือกหมวดเอกสาร</label>
            <select id="dl-cat" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">ทุกหมวด ({visible.length})</option>
              {cats.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.n})</option>)}
            </select></div>
          {editor && <button type="button" className="btn btn--ghost" onClick={() => setManage(true)} aria-label="จัดการหมวดเอกสาร">⚙️ หมวด</button>}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
          {editor && <button type="button" className="btn btn--gold" onClick={() => setForm('new')}>➕ เพิ่มเอกสาร</button>}
          <span className="small muted">{shown.length} เอกสาร · ใหม่สุดอยู่บน</span>
        </div>
      </section>
      {shown.length === 0 ? <p className="empty">{visible.length === 0 ? 'ยังไม่มีเอกสาร' : 'ไม่พบเอกสาร'}{editor && visible.length === 0 ? ' — กด “เพิ่มเอกสาร” แล้วเลือกไฟล์สำเร็จรูป' : ''}</p> : (
        <ul className="doclist" aria-label="รายการเอกสาร">
          {shown.map((d) => (
            <li key={d.id}>
              <button type="button" className="docbar" onClick={() => setOpenId(d.id)} aria-label={`เปิดเอกสาร ${d.title}`}>
                <span className="docbar__ico" aria-hidden="true">{iconOf(d)}</span>
                <span className="docbar__txt">
                  <b>{d.title}</b>
                  <span className="small muted">{[d.no, fmtDate(d.date), !cat ? d.category || NO_CATEGORY : '', d.access !== 'ทั่วไป' ? `${d.access === 'ลับ' ? '🔒' : '🔐'}${d.access}` : ''].filter(Boolean).join(' · ')}</span>
                  {snippetOf(d, q) && <span className="small doclink__snip">“{snippetOf(d, q)}”</span>}
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !form && <DocSheet doc={open} editor={editor} admin={admin} onClose={() => setOpenId(null)} onEdit={() => setForm(open)} onDelete={() => { if (window.confirm(`ลบ “${open.title}” ?`)) { lib.put([{ ...open, deleted: true }]); setOpenId(null) } }} />}
      {form && <DocForm doc={form === 'new' ? null : form} preset={form === 'new' ? preset : undefined} cats={cats.map((c) => c.name).filter((c) => c !== NO_CATEGORY)} defCat={cat === NO_CATEGORY ? '' : cat} nextFor={nextFor} prefixOf={prefixOf} onClose={() => setForm(null)} onSave={(d) => { if (lib.put([d])) { setForm(null); setOpenId(d.id); return true } return false }} />}
      {manage && <CatManager cats={cats} onClose={() => setManage(false)} docs={lib.list} putDocs={lib.put} catStore={catStore} onRenamed={(a, b) => { if (cat === a) setCat(b) }} />}
    </div>
  )
}

function DocSheet({ doc, editor, admin, onClose, onEdit, onDelete }: { doc: DocItem; editor: boolean; admin: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const run = async (what: 'view' | 'download' | 'share') => {
    setBusy(what); setMsg('')
    try {
      const file = await loadFile(doc)
      if (what === 'download') saveToDevice(file)
      else if (what === 'share') {
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
        if (nav.share && nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: doc.title }) } catch { /* ยกเลิก */ } } else { saveToDevice(file); setMsg('เครื่องนี้แชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดให้แล้ว ส่งต่อจากไฟล์ที่ดาวน์โหลดได้เลย') }
      } else {
        const u = URL.createObjectURL(file)
        if (!window.open(u, '_blank')) { saveToDevice(file); setMsg('เปิดหน้าต่างใหม่ไม่ได้ — ดาวน์โหลดให้แล้ว') }
        setTimeout(() => URL.revokeObjectURL(u), 60_000)
      }
    } catch (e) { setMsg(e instanceof Error ? e.message : 'เปิดไฟล์ไม่ได้') }
    setBusy('')
  }
  return (
    <Sheet title={doc.title} onClose={onClose}>
      <p className="small muted" style={{ margin: '0 0 6px' }}>{[doc.no && `เลขที่ ${doc.no}`, fmtDate(doc.date), doc.category || NO_CATEGORY, doc.access].filter(Boolean).join(' · ')}</p>
      {doc.note && <p style={{ margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{doc.note}</p>}
      {doc.file ? (
        <>
          <p className="small" style={{ margin: '0 0 8px' }}>{iconOf(doc)} {doc.file.name} · {fmtSize(doc.file.size)}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--gold" disabled={!!busy} onClick={() => void run('view')}>{busy === 'view' ? 'กำลังโหลด…' : '👁 เปิดดู'}</button>
            <button type="button" className="btn btn--gold" disabled={!!busy} onClick={() => void run('download')}>{busy === 'download' ? 'กำลังโหลด…' : '⬇️ ดาวน์โหลด'}</button>
            <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={() => void run('share')}>{busy === 'share' ? 'กำลังโหลด…' : '📤 แชร์'}</button>
          </div>
        </>
      ) : <p className="muted">ยังไม่มีไฟล์ในเอกสารนี้{editor ? ' — กด “แก้ไขข้อมูล” แล้วแนบไฟล์' : ''}</p>}
      {msg && <p className="note" role="status" style={{ margin: '6px 0 0' }}>{msg}</p>}
      {editor && (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn--ghost" onClick={onEdit}>✏️ แก้ไขข้อมูล</button>
          {(admin || !doc.file) && <button type="button" className="btn btn--ghost" onClick={onDelete}>🗑 ลบ</button>}
        </div>
      )}
      {editor && !admin && doc.file && <p className="small muted" style={{ margin: '6px 0 0' }}>เอกสารที่มีไฟล์แล้ว ลบได้เฉพาะแอดมิน (เก็บเป็นหลักฐาน)</p>}
    </Sheet>
  )
}

export interface DocPreset { title: string; date: string; note: string; no?: string; category?: string; file?: File }

function DocForm({ doc, preset, cats, defCat, nextFor, prefixOf, onClose, onSave }: { doc: DocItem | null; preset?: DocPreset; cats: string[]; defCat: string; nextFor: (c: string, exclude?: string) => string; prefixOf: (c: string) => string; onClose: () => void; onSave: (d: DocItem) => boolean }) {
  const [file, setFile] = useState<File | null>(preset?.file ?? null)
  const [noTouched, setNoTouched] = useState(!!preset?.no)
  const [f, setF] = useState({ title: doc?.title ?? preset?.title ?? '', category: doc?.category ?? (preset?.category && cats.includes(preset.category) ? preset.category : defCat), no: doc?.no ?? preset?.no ?? (doc ? '' : nextFor(preset?.category && cats.includes(preset.category) ? preset.category : defCat)), date: doc?.date ?? preset?.date ?? todayISO(), access: (doc?.access ?? 'ภายใน') as DocAccess, note: doc?.note ?? preset?.note ?? '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const pick = (x: File | null) => { setFile(x); if (x && !f.title.trim()) setF((p) => ({ ...p, title: titleFromFile(x.name) })) }
  const save = async () => {
    const errs: string[] = []
    if (!f.title.trim()) errs.push('ใส่ชื่อเอกสาร')
    if (!doc && !file) errs.push('เลือกไฟล์เอกสารสำเร็จรูป')
    if (file && file.size > MAX_DOC_BYTES) errs.push(`ไฟล์เอกสารสำเร็จรูปใหญ่เกินไป (${fmtSize(file.size)}) — ไม่เกิน ${fmtSize(MAX_DOC_BYTES)}`)
    if (!f.no.trim()) errs.push('ใส่เลขที่เอกสาร')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) errs.push('เลือกวันที่เอกสาร')
    if (errs.length) return setMsg(errs.join('\n'))
    setBusy(true); setMsg('')
    try {
      let fileInfo = doc?.file
      if (file) {
        const cfg = getSync()
        if (!cfg) { setBusy(false); return setMsg('ต้องเชื่อมต่อออนไลน์ก่อนจึงแนบไฟล์ได้ (ไฟล์เก็บใน repo ข้อมูล)') }
        const data = await file.arrayBuffer()
        const path = `attachments/docs/${new Date().getFullYear()}/doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${fileExt(file.name)}`
        await putBinary(cfg, path, data, 'คลังเอกสาร')
        void cacheImage(path, data, file.type || 'application/octet-stream')
        fileInfo = { path, name: file.name, type: file.type, size: file.size }
      }
      const d: DocItem = { ...(doc ?? { id: newId('doc'), updated: 0 }), title: f.title.trim(), category: f.category.trim(), no: f.no.trim(), date: f.date, access: f.access, note: f.note.trim() || undefined, ...(fileInfo ? { file: fileInfo } : {}) }
      if (!onSave(d)) setMsg('ไม่มีสิทธิ์บันทึก')
    } catch (e) { setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ') }
    setBusy(false)
  }
  return (
    <Sheet title={doc ? 'แก้ไขข้อมูลเอกสาร' : 'เพิ่มเอกสาร'} onClose={onClose}>
      <div className="field"><label htmlFor="df-file">{doc?.file ? 'เปลี่ยนไฟล์ (ไม่บังคับ)' : 'ไฟล์เอกสารสำเร็จรูป (PDF รูป Word ฯลฯ)'}</label>
        <input id="df-file" type="file" className="input" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        {doc?.file && !file && <span className="small muted">ไฟล์ปัจจุบัน: {doc.file.name}</span>}{file && <span className="small muted">ไฟล์ที่เลือก: {file.name} ({fmtSize(file.size)})</span>}</div>
      <div className="field"><label htmlFor="df-title">ชื่อเอกสาร</label><input id="df-title" className="input" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="field"><label htmlFor="df-cat">หมวด</label>
        <select id="df-cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, ...(noTouched ? {} : { no: nextFor(e.target.value, doc?.id) }) })}>
          <option value="">{NO_CATEGORY}</option>
          {[...new Set([...cats, f.category].filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
        </select><span className="small muted">เพิ่มหมวดใหม่ได้ที่ปุ่ม ⚙️ หมวด หน้าคลัง</span></div>
      <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}><label htmlFor="df-no">ใส่/เช็ค เลขที่เอกสาร</label><input id="df-no" className="input" value={f.no} onChange={(e) => { setNoTouched(true); setF({ ...f, no: e.target.value }) }} /></div>
        <div className="field" style={{ flex: 1 }}><label htmlFor="df-date">วันที่เอกสาร/ตรงกับไฟล์</label><input id="df-date" type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      </div>
      {prefixOf(f.category) ? (
        <div style={{ margin: '0 0 8px' }}>
          {f.no.trim() !== nextFor(f.category, doc?.id) && <button type="button" className="btn btn--gold" style={{ width: '100%' }} onClick={() => { setNoTouched(false); setF({ ...f, no: nextFor(f.category, doc?.id) }) }}>🔢 ใช้เลขที่อัตโนมัติ {nextFor(f.category, doc?.id)}</button>}
          <p className="small muted" style={{ margin: '4px 0 0' }}>เลขที่เติมตามหมวดนี้ (ตัวย่อ {prefixOf(f.category)}) นับต่อจากฉบับล่าสุด · แก้เองได้</p>
        </div>
      ) : <p className="small muted" style={{ margin: '0 0 8px' }}>หมวดนี้ยังไม่ได้ตั้งตัวย่อเลขที่ — ตั้งได้ที่ปุ่ม ⚙️ หมวด หน้าคลัง</p>}
      <div className="field"><label htmlFor="df-acc">ระดับ</label><select id="df-acc" className="input" value={f.access} onChange={(e) => setF({ ...f, access: e.target.value as DocAccess })}>{ACCESS_LEVELS.map((a) => <option key={a}>{a}</option>)}</select>
        <span className="small muted">ทั่วไป = ทุกคนเห็น · ภายใน = แอดมินและผู้ทำงานเลขา · ลับ = แอดมินเท่านั้น</span></div>
      <div className="field"><label htmlFor="df-note">หมายเหตุ/คำค้น (ไม่บังคับ)</label><textarea id="df-note" className="input" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="เช่น เชิญวิทยากร · วาระที่ 1–3" /></div>
      <div className="row" style={{ gap: 8 }}><button type="button" className="btn btn--gold" disabled={busy} onClick={() => void save()}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button><button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button></div>
      {msg && <p className="err" role="alert" style={{ margin: '6px 0 0' }}>{msg}</p>}
    </Sheet>
  )
}

function CatManager({ cats, docs, putDocs, catStore, onClose, onRenamed }: { cats: { name: string; n: number }[]; docs: DocItem[]; putDocs: (xs: DocItem[]) => boolean; catStore: ReturnType<typeof useDocCategories>; onClose: () => void; onRenamed: (a: string, b: string) => void }) {
  const [name, setName] = useState('')
  const [prefix, setPrefix] = useState('')
  const [msg, setMsg] = useState('')
  const names = new Set(cats.map((c) => c.name))
  const ensure = (n: string, pre?: string) => { if (!catStore.list.some((c) => c.name === n)) catStore.put([{ id: newId('dcat'), updated: 0, name: n, ...(pre ? { prefix: pre } : {}) }]) }
  const prefixOf = (n: string) => cleanPrefix(catStore.list.find((c) => c.name === n)?.prefix ?? '')
  const prefixTaken = (pre: string, except?: string) => !!pre && catStore.list.some((c) => c.name !== except && cleanPrefix(c.prefix ?? '') === pre)
  const add = () => { const n = name.trim(); if (!n) return; if (names.has(n) || n === NO_CATEGORY) return setMsg('มีหมวดชื่อนี้แล้ว'); const pre = cleanPrefix(prefix); if (prefixTaken(pre)) return setMsg(`ตัวย่อ “${pre}” ถูกใช้โดยหมวดอื่นแล้ว`); ensure(n, pre); setName(''); setPrefix(''); setMsg(`เพิ่มหมวด “${n}” แล้ว${pre ? ` (เลขที่ ${pre}.001, ${pre}.002 …)` : ''}`) }
  const setPre = (c: string) => {
    const v = prompt(`ตัวย่อเลขที่ของหมวด “${c}” (เช่น ปศอ → ปศอ.001) · เว้นว่าง = ไม่ใช้ตัวย่อ`, prefixOf(c))
    if (v === null) return
    const pre = cleanPrefix(v)
    if (prefixTaken(pre, c)) return setMsg(`ตัวย่อ “${pre}” ถูกใช้โดยหมวดอื่นแล้ว`)
    const was = prefixOf(c)
    const item = catStore.list.find((x) => x.name === c)
    if (item) catStore.put([{ ...item, prefix: pre || undefined }]); else ensure(c, pre)
    // เปลี่ยนตัวย่อ: ถามว่าจะเปลี่ยนเลขที่ของเอกสารเดิมตามไปด้วยไหม
    const old = was && pre ? docs.filter((d) => d.category === c && renumberWithPrefix(d.no, was, pre) !== d.no) : []
    if (old.length && window.confirm(`เปลี่ยนเลขที่ของเอกสารเดิมในหมวดนี้ ${old.length} ฉบับตามไปด้วยไหม?\nเช่น ${old[0].no} → ${renumberWithPrefix(old[0].no, was, pre)}\n\nตกลง = เปลี่ยนตาม · ยกเลิก = คงเลขเดิมไว้`)) { putDocs(old.map((d) => ({ ...d, no: renumberWithPrefix(d.no, was, pre) }))); setMsg(`เปลี่ยนตัวย่อเป็น ${pre} และเปลี่ยนเลขที่เอกสารเดิม ${old.length} ฉบับแล้ว`); return }
    setMsg(pre ? `ตั้งตัวย่อหมวด “${c}” เป็น ${pre} แล้ว — เอกสารใหม่จะได้เลขที่ ${pre}.001 ต่อไป (เอกสารเดิมไม่เปลี่ยนเลข)` : `เลิกใช้ตัวย่อของหมวด “${c}” แล้ว`)
  }
  const rename = (old: string) => {
    const n = prompt('ชื่อหมวดใหม่', old)?.trim()
    if (!n || n === old) return
    if (names.has(n) || n === NO_CATEGORY) return setMsg('มีหมวดชื่อนี้แล้ว')
    const item = catStore.list.find((c) => c.name === old)
    if (item) catStore.put([{ ...item, name: n }]); else ensure(n)
    const moved = docs.filter((d) => d.category === old).map((d) => ({ ...d, category: n }))
    if (moved.length) putDocs(moved)
    onRenamed(old, n); setMsg(`เปลี่ยนชื่อเป็น “${n}” แล้ว (${moved.length} เอกสารตามไปด้วย)`)
  }
  const del = (c: { name: string; n: number }) => {
    if (!window.confirm(c.n ? `ลบหมวด “${c.name}” ? เอกสาร ${c.n} ฉบับจะย้ายไป “${NO_CATEGORY}” (ไม่ลบเอกสาร)` : `ลบหมวด “${c.name}” ?`)) return
    const item = catStore.list.find((x) => x.name === c.name)
    if (item) catStore.put([{ ...item, deleted: true }])
    const moved = docs.filter((d) => d.category === c.name).map((d) => ({ ...d, category: '' }))
    if (moved.length) putDocs(moved)
    onRenamed(c.name, ''); setMsg(`ลบหมวด “${c.name}” แล้ว`)
  }
  return (
    <Sheet title="จัดการหมวดเอกสาร" onClose={onClose}>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" style={{ flex: 1 }} aria-label="ชื่อหมวดใหม่" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="ชื่อหมวดใหม่ เช่น จดหมายเชิญ" />
        <input className="input" style={{ width: '7.5rem' }} aria-label="ตัวย่อเลขที่ของหมวดใหม่" maxLength={12} value={prefix} onChange={(e) => setPrefix(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="ตัวย่อ เช่น ปศอ" />
        <button type="button" className="btn btn--gold" onClick={add}>➕ เพิ่ม</button>
      </div>
      <ul className="list" aria-label="รายชื่อหมวด" style={{ marginTop: 8 }}>
        {cats.filter((c) => c.name !== NO_CATEGORY).map((c) => (
          <li key={c.name} className="row row--between" style={{ alignItems: 'center' }}>
            <span>📁 {c.name} <span className="small muted">({c.n}){prefixOf(c.name) ? ` · เลขที่ ${prefixOf(c.name)}.###` : ' · ยังไม่มีตัวย่อเลขที่'}</span></span>
            <span className="row" style={{ gap: 6 }}><button type="button" className="mini" aria-label={`ตั้งตัวย่อเลขที่ หมวด ${c.name}`} onClick={() => setPre(c.name)}>🔢 ตัวย่อ</button><button type="button" className="mini" aria-label={`แก้ชื่อหมวด ${c.name}`} onClick={() => rename(c.name)}>✏️ แก้ชื่อ</button><button type="button" className="mini" aria-label={`ลบหมวด ${c.name}`} onClick={() => del(c)}>🗑</button></span>
          </li>
        ))}
      </ul>
      {cats.filter((c) => c.name !== NO_CATEGORY).length === 0 && <p className="muted small">ยังไม่มีหมวด — เพิ่มหมวดแรกด้านบน</p>}
      {msg && <p className="note" role="status" style={{ margin: '6px 0 0' }}>{msg}</p>}
    </Sheet>
  )
}
