import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LetterheadSetup from './LetterheadSetup'
import LetterPage from './LetterPage'
import { can } from '../lib/access'
import { useContactPresets, useDocCategories, useDocLibrary, useInviteLetter } from '../lib/data'
import { cleanPrefix, nextDocNo, setPendingDoc, sortNewestFirst } from '../lib/docLibrary'
import { letterDate } from '../lib/meetings'
import { be, newId, todayISO } from '../lib/money'
import { useRole } from '../lib/members'
import { buildPagesPdf, downloadSheetPdf } from '../lib/pdf'
import type { InviteLetter as Letter } from '../lib/types'

const BLANK: Omit<Letter, 'id' | 'updated'> = {
  no: '', date: '', subject: '', to: '', body: '',
  closing: 'ขอพระเจ้าทรงอวยพรท่านและครอบครัวอย่างอุดม', signName: '', signRole: 'ประธานธรรมกิจ', contact: '',
}
const FILENAME = 'หนังสือเชิญร่วมงาน.pdf'

/** ข้อความล้วนของหนังสือ (คัดลอกไปวางในโปรแกรมอื่น) */
export function letterText(l: Omit<Letter, 'id' | 'updated'>): string {
  return [
    l.no ? `ที่ ${l.no}` : '', letterDate(l.date),
    `เรื่อง  ${l.subject}`, `เรียน  ${l.to}`, '', l.body, '', l.closing,
    '', '', l.signName ? `(${l.signName})` : '', l.signRole, '', l.contact ? `หมายเหตุ/ติดต่อสอบถาม\n${l.contact}` : '',
  ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n').trim()
}

/** เนื้อหาหนังสือเชิญร่วมงานบนหน้า A4 (ใส่ใน LetterPage) */
function LetterBody({ l }: { l: Omit<Letter, 'id' | 'updated'> }) {
  return (
    <>
      <div style={{ textAlign: 'right', fontWeight: 700, marginBottom: 6 }}>ที่ {l.no || '………'}</div>
      <div style={{ textAlign: 'center', margin: '0 0 12px' }}>{letterDate(l.date) || '………………'}</div>
      <div className="letter__row"><span>เรื่อง</span><span style={{ flex: 1 }}>{l.subject || '………'}</span></div>
      <div className="letter__row"><span>เรียน</span><span style={{ flex: 1 }}>{l.to || '………'}</span></div>
      <div style={{ margin: '12px 0', minHeight: 120 }}>{(l.body || '………').split(/\n\s*\n|\n/).map((p, i) => <p key={i} className="letter__p">{p}</p>)}</div>
      <div className="letter__sign">
        <div>{l.closing}</div>
        <div style={{ height: 54 }} />
        <div>({l.signName || '………………………'})</div>
        <div>{l.signRole}</div>
      </div>
      {l.contact.trim() && <div style={{ marginTop: 18, fontSize: 13.5, whiteSpace: 'pre-wrap', borderTop: '1px solid #999', paddingTop: 6 }}><b>หมายเหตุ</b> {l.contact}</div>}
    </>
  )
}

/** หนังสือเชิญร่วมงาน (หน้าเดียว): กรอกทุกช่อง → ดูตัวอย่างบนกระดาษ → คัดลอกข้อความ / PDF / เก็บเข้าคลังเอกสาร */
export default function InviteLetterPage() {
  const role = useRole()
  const store = useInviteLetter()
  const presets = useContactPresets()
  const lib = useDocLibrary(), cats = useDocCategories()
  const navigate = useNavigate()
  const saved = store.items.find((x) => x.id === 'draft')
  const [l, setL] = useState<Omit<Letter, 'id' | 'updated'>>(() => ({ ...BLANK, ...(saved ?? {}), date: saved?.date || todayISO() }))
  const [pick, setPick] = useState(false)
  const [setup, setSetup] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const set = (patch: Partial<typeof l>) => setL((p) => ({ ...p, ...patch }))
  // บันทึกอัตโนมัติ (หน่วงเล็กน้อย) — ร่วมกันทุกเครื่อง
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => { store.put([{ ...l, id: 'draft', updated: Date.now() }]) }, 700)
    return () => clearTimeout(t)
  }, [l]) // eslint-disable-line react-hooks/exhaustive-deps

  // เลขที่จากคลังเอกสาร: หมวดที่ชื่อมี “เชิญ” (ไม่มี = ทั้งคลัง)
  const cat = cats.list.find((c) => c.name.includes('เชิญ'))
  const pool = cat ? lib.list.filter((d) => d.category === cat.name) : lib.list
  const nextNo = nextDocNo(pool, cleanPrefix(cat?.prefix ?? '') || be(Number(todayISO().slice(0, 4))))
  const recent = sortNewestFirst(pool).filter((d) => d.no.trim()).slice(0, 6)

  const copy = async () => {
    const text = letterText(l)
    let ok = false
    try { await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(no, 1500))]); ok = true } catch { /* ลองวิธีสำรอง */ }
    if (!ok) { // วิธีสำรอง (เบราว์เซอร์ที่ไม่ให้สิทธิ์คลิปบอร์ด)
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      ta.remove()
    }
    setMsg(ok ? 'คัดลอกข้อความทั้งหมดแล้ว — นำไปวางในโปรแกรมอื่นได้' : 'คัดลอกไม่สำเร็จ — ลองกดค้างที่ข้อความแล้วเลือกคัดลอกเอง')
  }
  const pdf = async () => { if (ref.current) await downloadSheetPdf([ref.current], FILENAME, 'full') }
  /** เก็บเข้าคลังเอกสาร: สร้าง PDF จากหนังสือนี้ → ไปหน้าคลังพร้อมไฟล์ เลขที่ วันที่ ชื่อเรื่อง (กดบันทึกได้ทันที) */
  const toLibrary = async () => {
    if (!ref.current) return
    setBusy(true); setMsg('')
    try {
      const doc = await buildPagesPdf([{ el: ref.current }])
      if (!doc) throw new Error('สร้างไฟล์ไม่สำเร็จ')
      const file = new File([doc.output('blob')], `หนังสือเชิญ ${l.no ? l.no.replace(/[\\/:*?"<>|]/g, '-') : todayISO()}.pdf`, { type: 'application/pdf' })
      setPendingDoc({ title: l.subject ? `หนังสือเชิญ ${l.subject}` : 'หนังสือเชิญร่วมงาน', date: l.date, note: `เรียน ${l.to}`.trim(), no: l.no.trim() || undefined, category: cat?.name, file })
      navigate('/meeting/1/3')
    } catch (e) { setMsg(e instanceof Error ? e.message : 'สร้างไฟล์ไม่สำเร็จ') }
    setBusy(false)
  }
  const savePreset = () => {
    const text = l.contact.trim(); if (!text) return setMsg('พิมพ์ข้อมูลติดต่อก่อนบันทึกเป็นชุดสำเร็จรูป')
    const name = window.prompt('ตั้งชื่อชุดข้อมูลติดต่อ (เช่น เลขาคริสตจักร)', text.split('\n')[0].slice(0, 30)); if (!name?.trim()) return
    setMsg(presets.put([{ id: newId('cp'), name: name.trim(), text, updated: Date.now() }]) ? `บันทึกชุด “${name.trim()}” แล้ว` : 'ไม่มีสิทธิ์บันทึก')
  }
  const curPreset = presets.list.find((p) => p.text === l.contact)

  return (
    <>
      <div className="page-head no-print"><h1>✉️ หนังสือเชิญร่วมงาน</h1><Link to="/meeting/1/1" className="mini">‹ ลำดับงาน</Link></div>
      <p className="muted small no-print" style={{ margin: '0 0 0.5rem' }}>เชิญผู้ใหญ่ร่วมงานกิจกรรมของคริสตจักร · กรอกเรียงลงมา แล้วดูตัวอย่างบนกระดาษด้านล่าง · บันทึกอัตโนมัติ</p>
      <section className="card no-print" aria-label="กรอกหนังสือเชิญ">
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}><b>1. หัวจดหมาย</b>
          {can(role, 'settings') && <button type="button" className="mini" onClick={() => setSetup(true)}>⚙️ ตั้งค่าหัวจดหมาย</button>}</div>
        <p className="small muted" style={{ margin: '0 0 0.5rem' }}>แสดงบนตัวอย่างด้านล่าง (ถ้าไม่ตั้ง ใช้ชื่อคริสตจักรเป็นหัว)</p>

        <div className="field"><label htmlFor="il-no">2. เลขที่หนังสือ</label>
          <div className="row" style={{ gap: 6 }}>
            <input id="il-no" className="input" style={{ flex: 1 }} value={l.no} onChange={(e) => set({ no: e.target.value })} placeholder="เช่น ศอช.003" />
            <button type="button" className="btn btn--ghost" aria-expanded={pick} onClick={() => setPick(!pick)}>📚 ดึงเลขจากคลังเอกสาร</button>
          </div>
          {pick && (
            <div className="card" role="group" aria-label="เลขที่จากคลังเอกสาร" style={{ margin: '0.4rem 0 0' }}>
              <div className="small muted">{cat ? `หมวด “${cat.name}”` : 'ทั้งคลังเอกสาร'} · กดเพื่อใส่เลขที่</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <button type="button" className="btn btn--gold" onClick={() => { set({ no: nextNo }); setPick(false) }}>เลขถัดไป {nextNo}</button>
                {recent.map((d) => <button key={d.id} type="button" className="mini" title={d.title} onClick={() => { set({ no: d.no }); setPick(false) }}>{d.no} <span className="muted">· {d.title.slice(0, 18)}</span></button>)}
              </div>
              {recent.length === 0 && <div className="small muted">ยังไม่มีเอกสารในคลัง — ใช้เลขถัดไปได้เลย</div>}
            </div>
          )}
        </div>

        <div className="field"><label htmlFor="il-date">3. วันที่ (ตั้งต้นเป็นวันที่บันทึก)</label><input id="il-date" type="date" className="input" value={l.date} onChange={(e) => set({ date: e.target.value })} /></div>
        <div className="field"><label htmlFor="il-sub">4. เรื่อง</label><input id="il-sub" className="input" value={l.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="เช่น ขอเชิญร่วมงานคริสต์มาสคริสตจักร" /></div>
        <div className="field"><label htmlFor="il-to">5. เรียน</label><input id="il-to" className="input" value={l.to} onChange={(e) => set({ to: e.target.value })} placeholder="ชื่อ ตำแหน่ง ของผู้ใหญ่ที่เชิญ" /></div>
        <div className="field"><label htmlFor="il-body">6. ข้อความในหนังสือ (เนื้อหาทั้งหมด)</label><textarea id="il-body" className="input" rows={9} value={l.body} onChange={(e) => set({ body: e.target.value })} placeholder="ชื่องาน วัน เวลา สถานที่ เหตุผลที่เชิญ และสิ่งที่ขอ" /></div>

        <fieldset className="card" style={{ margin: 0 }}><legend><b>7. ข้อความปิดท้าย · ลงชื่อ</b></legend>
          <div className="field"><label htmlFor="il-close">ข้อความปิดท้าย</label><input id="il-close" className="input" value={l.closing} onChange={(e) => set({ closing: e.target.value })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="il-sn">ชื่อผู้ลงนาม</label><input id="il-sn" className="input" value={l.signName} onChange={(e) => set({ signName: e.target.value })} placeholder="ชื่อประธานธรรมกิจ" /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="il-sr">ตำแหน่ง</label><input id="il-sr" className="input" value={l.signRole} onChange={(e) => set({ signRole: e.target.value })} /></div>
          </div>
          <span className="small muted">เว้นที่ให้ลงนามบนกระดาษแล้ว</span>
        </fieldset>

        <div className="field"><label htmlFor="il-contact">8. ข้อมูลติดต่อ หากมีข้อสงสัย</label>
          <div className="row" style={{ gap: 6 }}>
            <select aria-label="ชุดข้อมูลติดต่อสำเร็จรูป" className="input" style={{ flex: 1 }} value={curPreset?.id ?? ''} onChange={(e) => { const p = presets.list.find((x) => x.id === e.target.value); if (p) set({ contact: p.text }) }}>
              <option value="">— ชุดสำเร็จรูป ({presets.list.length}) —</option>
              {presets.list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="mini" onClick={savePreset}>💾 บันทึกเป็นชุด</button>
            {curPreset && <button type="button" className="mini" aria-label={`ลบชุด ${curPreset.name}`} onClick={() => { if (window.confirm(`ลบชุด “${curPreset.name}” ?`)) presets.remove(curPreset.id) }}>🗑️</button>}
          </div>
          <textarea id="il-contact" className="input" rows={3} value={l.contact} onChange={(e) => set({ contact: e.target.value })} placeholder={'ชื่อผู้ประสานงาน โทร. 08x-xxx-xxxx\nLINE / อีเมล'} /></div>

        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost" onClick={copy}>📋 9. คัดลอกข้อความทั้งหมด</button>
          <button type="button" className="btn" onClick={pdf}>⬇️ 10. ดาวน์โหลด PDF</button>
          <button type="button" className="mini" onClick={() => { if (window.confirm('เริ่มฉบับใหม่ (ล้างข้อความทุกช่อง ยกเว้นข้อมูลติดต่อและผู้ลงนาม) ?')) setL({ ...BLANK, date: todayISO(), signName: l.signName, signRole: l.signRole, contact: l.contact }) }}>↺ เริ่มฉบับใหม่</button>
        </div>
        {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
      </section>

      <div aria-label="ตัวอย่างหนังสือ"><LetterPage ref={ref}><LetterBody l={l} /></LetterPage></div>
      <p className="small muted no-print" style={{ margin: '0.3rem 0' }}>ตัวอย่างหน้ากระดาษ A4 หนึ่งหน้า — ถ้าเนื้อหายาวเกินหน้า ให้ย่อข้อความ · ต่อไปจะใช้ฉบับนี้ออกหนังสือได้เลย</p>

      <section className="card no-print" aria-label="เก็บเข้าคลังเอกสาร">
        <button type="button" className="btn btn--gold" disabled={busy} onClick={toLibrary}>🗄️ 11. เก็บเข้าคลังเอกสาร</button>
        <span className="small muted"> สร้าง PDF จากหนังสือนี้ แล้วไปหน้าคลังเอกสารพร้อมเลขที่ วันที่ และไฟล์ กดบันทึกได้ทันที</span>
      </section>
      {setup && <LetterheadSetup onClose={() => setSetup(false)} />}
    </>
  )
}
