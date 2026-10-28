import { useMemo, useState } from 'react'
import DocPreview from './meeting/DocPreview'
import { can, myWorks, whoAmI } from '../lib/access'
import { useDocLibrary } from '../lib/data'
import { ACCESS_LEVELS, canSeeDoc, categoriesOf, DOC_KINDS, filterDocs, nextDocNo, sortDocs, splitPages, TEMPLATES } from '../lib/docLibrary'
import { useRole } from '../lib/members'
import { be, fmtDate, newId, todayISO } from '../lib/money'
import type { DocAccess, DocItem } from '../lib/types'

/**
 * งานเลขา › คลังเอกสาร: ค้นหาเอกสารจากชื่อ/เลขที่/หมวด · แยกหมวด (เช่น ประชุมกรรมการ) · เรียงเก่า→ใหม่ตามวันที่และเลขที่
 * เปิดเอกสาร = 2 เมนู: ✏️ ร่าง (แก้ได้ มีแบบฟอร์มให้) · 📄 เอกสารจริง (ออกแล้วแก้ไม่ได้ เก็บเป็นหลักฐาน ออกฉบับใหม่ได้ ฉบับเก่าเก็บไว้)
 */
export default function DocLibrary() {
  const role = useRole()
  const admin = role === 'admin'
  const editor = admin || can(role, 'detail') || myWorks().includes(1)
  const lib = useDocLibrary()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const visible = useMemo(() => lib.list.filter((d) => canSeeDoc(d.access, { admin, editor })), [lib.list, admin, editor])
  const cats = categoriesOf(visible)
  const shown = sortDocs(filterDocs(visible, q, cat))
  const groups = useMemo(() => { const m = new Map<string, DocItem[]>(); for (const d of shown) { const k = d.category || 'ไม่ระบุหมวด'; m.set(k, [...(m.get(k) ?? []), d]) } return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th')) }, [shown])
  const open = visible.find((d) => d.id === openId)
  if (open) return <DocView doc={open} editor={editor} admin={admin} cats={cats.map((c) => c.name)} onClose={() => setOpenId(null)} lib={lib} />
  const add = () => {
    const y = be(Number(todayISO().slice(0, 4)))
    const d: DocItem = { id: newId('doc'), updated: 0, title: 'เอกสารใหม่', category: cat, kind: DOC_KINDS[0], no: nextDocNo(lib.list, y), date: todayISO(), access: 'ภายใน', draft: '' }
    if (lib.put([d])) setOpenId(d.id)
  }
  return (
    <div aria-label="คลังเอกสาร">
      <section className="card no-print" style={{ margin: '0 0 8px' }}>
        <div className="field"><label htmlFor="dl-q">🔎 ค้นหาเอกสาร</label><input id="dl-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อเอกสาร เลขที่ หมวด เช่น เชิญประชุม" /></div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="หมวดเอกสาร">
          <button type="button" className={`mini${cat === '' ? ' on' : ''}`} aria-pressed={cat === ''} onClick={() => setCat('')}>ทั้งหมด ({visible.length})</button>
          {cats.map((c) => <button key={c.name} type="button" className={`mini${cat === c.name ? ' on' : ''}`} aria-pressed={cat === c.name} onClick={() => setCat(c.name)}>{c.name} ({c.n})</button>)}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
          {editor && <button type="button" className="btn btn--gold" onClick={add}>➕ เอกสารใหม่</button>}
          <span className="small muted">{shown.length} เอกสาร · เรียงเก่า → ใหม่</span>
        </div>
      </section>
      {groups.length === 0 ? <p className="empty">{visible.length === 0 ? 'ยังไม่มีเอกสาร' : 'ไม่พบเอกสารที่ค้นหา'}{editor && visible.length === 0 ? ' — กด “เอกสารใหม่” เพื่อเริ่ม' : ''}</p> : groups.map(([name, items]) => (
        <section key={name} className="card" aria-label={`หมวด ${name}`} style={{ margin: '0 0 8px' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>📁 {name} <span className="small muted">({items.length})</span></h2>
          <ul className="list">
            {items.map((d) => {
              const f = d.finals?.[d.finals.length - 1]
              return (
                <li key={d.id}>
                  <button type="button" className="doclink" onClick={() => setOpenId(d.id)} aria-label={`เปิดเอกสาร ${d.title}`}>
                    <span className="small muted">{d.no} · {fmtDate(d.date)} · {d.kind}</span>
                    <b>{d.title}</b>
                    <span className="small">{f ? <span className="badge">📄 เอกสารจริง ฉบับที่ {f.v}</span> : <span className="muted">✏️ ร่าง</span>}{d.access !== 'ทั่วไป' ? ` · ${d.access === 'ลับ' ? '🔒' : '🔐'} ${d.access}` : ''}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function DocView({ doc, editor, admin, cats, onClose, lib }: { doc: DocItem; editor: boolean; admin: boolean; cats: string[]; onClose: () => void; lib: ReturnType<typeof useDocLibrary> }) {
  const [tab, setTab] = useState<'draft' | 'final'>(doc.finals?.length && !editor ? 'final' : 'draft')
  const [f, setF] = useState({ title: doc.title, category: doc.category, kind: doc.kind, no: doc.no, date: doc.date, access: doc.access, draft: doc.draft })
  const [msg, setMsg] = useState('')
  const [ver, setVer] = useState(0)
  const finals = doc.finals ?? []
  const cur = finals.find((x) => x.v === ver) ?? finals[finals.length - 1]
  const dirty = f.title !== doc.title || f.category !== doc.category || f.kind !== doc.kind || f.no !== doc.no || f.date !== doc.date || f.access !== doc.access || f.draft !== doc.draft
  const save = () => { if (!f.title.trim()) return setMsg('ใส่ชื่อเอกสารก่อน'); if (lib.put([{ ...doc, ...f, title: f.title.trim(), category: f.category.trim(), no: f.no.trim() }])) setMsg('บันทึกร่างแล้ว'); else setMsg('ไม่มีสิทธิ์บันทึก') }
  const issue = () => {
    if (!f.title.trim() || !f.draft.trim()) return setMsg('ต้องมีชื่อและเนื้อหาก่อนออกเป็นเอกสารจริง')
    const v = (finals[finals.length - 1]?.v ?? 0) + 1
    if (!window.confirm(`ออกเป็นเอกสารจริง ฉบับที่ ${v} ?\nออกแล้วแก้ไขฉบับนี้ไม่ได้ (ถ้าต้องแก้ ให้ออกฉบับใหม่ ฉบับเก่าเก็บไว้เป็นหลักฐาน)`)) return
    const fin = { v, at: Date.now(), by: whoAmI().name, no: f.no.trim(), date: f.date, title: f.title.trim(), body: f.draft }
    if (lib.put([{ ...doc, ...f, title: f.title.trim(), category: f.category.trim(), no: f.no.trim(), finals: [...finals, fin] }])) { setVer(0); setTab('final'); setMsg('') } else setMsg('ไม่มีสิทธิ์บันทึก')
  }
  const del = () => {
    if (finals.length && !admin) return setMsg('เอกสารที่ออกเป็นเอกสารจริงแล้วลบได้เฉพาะแอดมิน (เก็บเป็นหลักฐาน)')
    if (window.confirm(`ลบ “${doc.title}” ${finals.length ? `(รวมเอกสารจริง ${finals.length} ฉบับ) ` : ''}?`)) { lib.put([{ ...doc, deleted: true }]); onClose() }
  }
  const pages = cur ? splitPages(cur.body).map((body, i) => (
    <div key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 15 }}>
      {i === 0 && <div style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>ที่ {cur.no}</span><span>วันที่ {fmtDate(cur.date)}</span></div><div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, margin: '10px 0 8px' }}>{cur.title}</div></div>}
      {body}
    </div>
  )) : []
  return (
    <div aria-label={`เอกสาร ${doc.title}`}>
      <div className="row no-print" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <button type="button" className="mini" onClick={onClose}>‹ คลังเอกสาร</button>
        <b style={{ flex: 1, minWidth: 0 }}>{doc.title}</b>
      </div>
      <div className="subtabs no-print" role="tablist" aria-label="ร่างหรือเอกสารจริง" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <button type="button" role="tab" aria-selected={tab === 'draft'} className={`subtab${tab === 'draft' ? ' on' : ''}`} onClick={() => setTab('draft')}>✏️ ร่างเอกสาร</button>
        <button type="button" role="tab" aria-selected={tab === 'final'} className={`subtab${tab === 'final' ? ' on' : ''}`} onClick={() => setTab('final')}>📄 เอกสารจริง{finals.length ? ` (${finals.length})` : ''}</button>
      </div>
      {tab === 'draft' && (
        <section className="card no-print" aria-label="ร่างเอกสาร">
          {!editor ? <p className="muted small">ดูได้อย่างเดียว</p> : null}
          <div className="field"><label htmlFor="dd-title">ชื่อเอกสาร</label><input id="dd-title" className="input" disabled={!editor} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="field"><label htmlFor="dd-cat">หมวด (เลือกหรือพิมพ์ใหม่ เช่น ประชุมกรรมการ)</label><input id="dd-cat" className="input" disabled={!editor} maxLength={60} list="dd-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="dd-cats">{cats.filter((c) => c !== 'ไม่ระบุหมวด').map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="dd-kind">ประเภท</label><select id="dd-kind" className="input" disabled={!editor} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{[...new Set([...DOC_KINDS, f.kind])].map((k) => <option key={k}>{k}</option>)}</select></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="dd-no">เลขที่เอกสาร</label><input id="dd-no" className="input" disabled={!editor} value={f.no} onChange={(e) => setF({ ...f, no: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="dd-date">วันที่เอกสาร</label><input id="dd-date" type="date" className="input" disabled={!editor} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="dd-acc">ระดับ</label><select id="dd-acc" className="input" disabled={!editor} value={f.access} onChange={(e) => setF({ ...f, access: e.target.value as DocAccess })}>{ACCESS_LEVELS.map((a) => <option key={a}>{a}</option>)}</select></div>
          </div>
          <p className="small muted" style={{ margin: '0 0 6px' }}>ทั่วไป = ทุกคนเห็น · ภายใน = แอดมินและผู้ทำงานเลขา · ลับ = แอดมินเท่านั้น</p>
          <div className="field"><label htmlFor="dd-body">เนื้อหา (ร่าง)</label><textarea id="dd-body" className="input" rows={12} disabled={!editor} value={f.draft} onChange={(e) => setF({ ...f, draft: e.target.value })} placeholder="พิมพ์เนื้อหา หรือกด “ใส่แบบฟอร์ม” ด้านล่าง" /></div>
          {editor && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {TEMPLATES[f.kind] && <button type="button" className="btn btn--ghost" onClick={() => { if (!f.draft.trim() || window.confirm('แทนที่เนื้อหาร่างด้วยแบบฟอร์ม?')) setF({ ...f, draft: TEMPLATES[f.kind] }) }}>📋 ใส่แบบฟอร์ม “{f.kind}”</button>}
              <button type="button" className="btn btn--gold" onClick={save} disabled={!dirty}>💾 บันทึกร่าง</button>
              <button type="button" className="btn btn--gold" onClick={issue}>📄 ออกเป็นเอกสารจริง</button>
              <button type="button" className="btn btn--ghost" onClick={del}>🗑 ลบ</button>
            </div>
          )}
          {msg && <p className="note" role="status" style={{ margin: '6px 0 0' }}>{msg}</p>}
          {dirty && editor && <p className="small muted" style={{ margin: '4px 0 0' }}>มีการแก้ไขที่ยังไม่ได้บันทึก</p>}
        </section>
      )}
      {tab === 'final' && (
        <section aria-label="เอกสารจริง">
          {!cur ? <p className="empty">ยังไม่ได้ออกเป็นเอกสารจริง — ไปที่แท็บ “ร่างเอกสาร” แล้วกด “ออกเป็นเอกสารจริง”</p> : (
            <>
              <div className="card no-print" style={{ margin: '0 0 8px' }}>
                <p className="small" style={{ margin: 0 }}>ฉบับที่ <b>{cur.v}</b> · ออกเมื่อ {new Date(cur.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} โดย {cur.by} · <b>เก็บเป็นหลักฐาน แก้ไขไม่ได้</b></p>
                {finals.length > 1 && <div className="field"><label htmlFor="dd-ver">ดูฉบับ</label><select id="dd-ver" className="input" value={cur.v} onChange={(e) => setVer(Number(e.target.value))}>{[...finals].reverse().map((x) => <option key={x.v} value={x.v}>ฉบับที่ {x.v} · {new Date(x.at).toLocaleDateString('th-TH')}{x === finals[finals.length - 1] ? ' (ล่าสุด)' : ''}</option>)}</select></div>}
              </div>
              <DocPreview pages={pages} filename={`${cur.no.replace(/\//g, '-')}-${cur.title}-ฉบับ${cur.v}.pdf`} label="เอกสาร" />
            </>
          )}
        </section>
      )}
    </div>
  )
}
