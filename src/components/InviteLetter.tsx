import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import logoUrl from '../assets/logo.png'
import { useDocCategories, useDocLibrary, useInviteLetter, useInviteSettings } from '../lib/data'
import { cleanPrefix, nextDocNo, setPendingDoc, sortNewestFirst } from '../lib/docLibrary'
import { letterDate } from '../lib/meetings'
import { be, todayISO } from '../lib/money'
import { buildPagesPdf, downloadSheetPdf } from '../lib/pdf'
import type { InviteLetter as Letter, InviteSettings } from '../lib/types'

type Draft = Omit<Letter, 'id' | 'updated'>
type Cfg = Omit<InviteSettings, 'id' | 'updated'>
const BLANK: Draft = { no: '', date: '', subject: '', to: '', attach: '', body: '' }
/** ค่าตั้งต้น (ตามหนังสือจริงของคริสตจักร) — แก้ได้ที่ปุ่ม “แก้หัวจดหมาย · ลงนาม · ข้อมูลติดต่อ” */
export const DEFAULT_CFG: Cfg = {
  thName: 'คริสตจักรศิลาเอก ภาค 7 สภาคริสตจักรในประเทศไทย',
  enName: 'Cornerstone Church 7th District, The Church of Christ in Thailand',
  addr: '23/490 ซ.หัวหิน 94 ต.หัวหิน อ.หัวหิน จ.ประจวบคีรีขันธ์ 77110 อีเมล : doothailand@gmail.com',
  proceed: 'จึงเรียนมาเพื่อโปรดพิจารณาและดำเนินการต่อไป',
  bless: 'ขอพระเจ้าโปรดอวยพรท่านและครอบครัว\nขอแสดงความนับถือในพระคริสต์',
  signName: 'มน.สมเจต เสมาทอง',
  signRole: 'ประธานคณะธรรมกิจคริสตจักรศิลาเอก',
  contact: 'ติดต่อ 080-582-0777 มน.สมเจต เสมาทอง ประธานธรรมกิจ, 095-779-9382 คศ.กฤตุ รุ่งโรจน์ร่มเย็น ศิษยาภิบาล,\n093-476-5585 คศ.พิชิต เผ่าดี ศิษยาภิบาลฝ่ายอภิบาลและพัฒนา,\n081-889-6490 อ.ดารา ผลจันทร์ คณะธรรมกิจ',
}
const FILENAME = 'หนังสือเชิญร่วมงาน.pdf'
type Sec = 'head' | 'sign' | 'contact'
type TextKey = 'thName' | 'enName' | 'addr' | 'proceed' | 'bless' | 'signName' | 'signRole' | 'contact'
/** 3 ส่วนที่แก้ได้ (ตามเลขลำดับบนหน้า): ช่องข้อความของแต่ละส่วน */
const SECTIONS: { sec: Sec; no: string; name: string; keys: TextKey[] }[] = [
  { sec: 'head', no: '1', name: 'หัวจดหมาย', keys: ['thName', 'enName', 'addr'] },
  { sec: 'sign', no: '7', name: 'ข้อความปิดท้าย · ลงนาม', keys: ['proceed', 'bless', 'signName', 'signRole'] },
  { sec: 'contact', no: '8', name: 'ข้อมูลติดต่อ', keys: ['contact'] },
]

/** ข้อความล้วนของหนังสือ (คัดลอกไปวางในโปรแกรมอื่น) */
export function letterText(l: Draft, c: Cfg): string {
  return [
    c.thName, c.enName, c.addr, '',
    l.no ? `ที่ ${l.no}` : '', letterDate(l.date), '',
    `เรื่อง  ${l.subject}`, `เรียน  ${l.to}`, l.attach?.trim() ? `สิ่งที่ส่งมาด้วย  ${l.attach}` : '', '', l.body, '', c.proceed, '', c.bless, '', '', c.signName ? `(${c.signName})` : '', c.signRole, '', c.contact,
  ].filter((x, i, a) => !(x === '' && (a[i - 1] === '' || i === 0))).join('\n').trim()
}

/** หน้า A4: หัวจดหมาย (โลโก้ + ข้อความ) บน · เนื้อหากลาง · ลงนามขวา · ข้อมูลติดต่อล็อกท้ายกระดาษ */
function Paper({ l, c, paperRef }: { l: Draft; c: Cfg; paperRef: React.Ref<HTMLDivElement> }) {
  return (
    <ScaledPage ref={paperRef} className="a4page a4page--letter">
      <div className="il">
        <header className="il__head">
          <img src={logoUrl} alt="" className="il__logo" />
          <div className="il__heads">
            <div className="il__th">{c.thName}</div>
            <div className="il__en">{c.enName}</div>
            <div className="il__addr">{c.addr}</div>
          </div>
        </header>
        <div className="il__body">
          <div style={{ textAlign: 'right', marginBottom: 4 }}>ที่ {l.no || '………'}</div>
          <div style={{ textAlign: 'center', margin: '14px 0 22px' }}>{letterDate(l.date) || '………………'}</div>
          <div className="letter__row"><span>เรื่อง</span><span style={{ flex: 1 }}>{l.subject || '………'}</span></div>
          <div className="letter__row"><span>เรียน</span><span style={{ flex: 1 }}>{l.to || '………'}</span></div>
          {l.attach?.trim() && <div className="letter__row"><span>สิ่งที่ส่งมาด้วย</span><span style={{ flex: 1 }}>{l.attach}</span></div>}
          <div style={{ margin: '18px 0 8px', minHeight: 120 }}>{(l.body || '………').split(/\n/).filter((x) => x.trim()).map((p, i) => <p key={i} className="letter__p">{p}</p>)}</div>
          <p className="letter__p">{c.proceed}</p>
        </div>
        {/* ลงนาม + ข้อมูลติดต่อ: ตรึงไว้ท้ายกระดาษเสมอ (เนื้อหาใช้พื้นที่ตรงกลางที่เหลือ) */}
        <div className="il__bottom">
          <div className="letter__sign">
            {c.bless.split('\n').map((x, i) => <div key={i}>{x}</div>)}
            <div style={{ height: 62 }} />
            <div>{c.signName ? `(${c.signName})` : '(………………………)'}</div>
            <div>{c.signRole}</div>
          </div>
          <footer className="il__foot">{c.contact.split('\n').map((x, i) => <div key={i}>{x}</div>)}</footer>
        </div>
      </div>
    </ScaledPage>
  )
}

/** หนังสือเชิญร่วมงาน (หน้าเดียว): กรอกช่องที่ต่างกันในแต่ละฉบับ · หัวจดหมาย/ลงนาม/ข้อมูลติดต่อเป็นค่าตั้งต้นที่แก้ครั้งเดียวใช้ทุกฉบับ */
export default function InviteLetterPage() {
  const store = useInviteLetter()
  const cfgStore = useInviteSettings()
  const lib = useDocLibrary(), cats = useDocCategories()
  const navigate = useNavigate()
  const saved = store.items.find((x) => x.id === 'draft')
  const cfg: Cfg = { ...DEFAULT_CFG, ...(cfgStore.items.find((x) => x.id === 'settings') ?? {}) }
  const [l, setL] = useState<Draft>(() => ({ ...BLANK, ...(saved ?? {}), date: saved?.date || todayISO() }))
  const [pick, setPick] = useState(false)
  const [edit, setEdit] = useState<Sec | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const set = (patch: Partial<Draft>) => setL((p) => ({ ...p, ...patch }))
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
    const text = letterText(l, cfg)
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

  const putCfg = (c: Cfg) => cfgStore.put([{ ...c, id: 'settings', updated: Date.now() }])
  /** ➕ ใส่ข้อความ: ใส่ข้อความตั้งต้นของส่วนนั้น (ถ้ามีข้อความที่แก้ไว้ถามก่อนเขียนทับ) */
  const fill = (x: (typeof SECTIONS)[number]) => {
    const same = x.keys.every((k) => cfg[k] === DEFAULT_CFG[k])
    if (same) return setMsg(`${x.name} ใช้ข้อความตั้งต้นอยู่แล้ว — กด ✏️ เพื่อแก้ไข`)
    if (!window.confirm(`ใส่ข้อความตั้งต้นของ “${x.name}” ทับข้อความที่แก้ไว้ ?`)) return
    setMsg(putCfg({ ...cfg, ...Object.fromEntries(x.keys.map((k) => [k, DEFAULT_CFG[k]])) }) ? `ใส่ข้อความตั้งต้นของ “${x.name}” แล้ว` : 'ไม่มีสิทธิ์บันทึก')
  }
  const secRow = (x: (typeof SECTIONS)[number]) => (
    <div key={x.sec} className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'nowrap' }}>
      <span style={{ minWidth: 0 }}><b>{x.no}. {x.name}</b><br /><span className="small muted" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg[x.keys[0]].split('\n')[0]}</span></span>
      <span className="row" style={{ gap: 4, flex: 'none', flexWrap: 'nowrap' }}>
        <button type="button" className="mini" aria-label={`ใส่ข้อความ ${x.name}`} title="ใส่ข้อความตั้งต้น" onClick={() => fill(x)}>➕</button>
        <button type="button" className="mini" aria-label={`แก้ข้อความ ${x.name}`} title="แก้ข้อความ" onClick={() => setEdit(x.sec)}>✏️</button>
      </span>
    </div>
  )

  return (
    <>
      <div className="page-head no-print"><h1>✉️ หนังสือเชิญร่วมงาน</h1><Link to="/meeting/1/1" className="mini">‹ ลำดับงาน</Link></div>
      <p className="muted small no-print" style={{ margin: '0 0 0.5rem' }}>เชิญผู้ใหญ่ร่วมงานกิจกรรมของคริสตจักร · กรอกเรียงลงมา แล้วดูตัวอย่างบนกระดาษด้านล่าง · บันทึกอัตโนมัติ</p>
      <section className="card no-print" aria-label="กรอกหนังสือเชิญ">
        {SECTIONS.filter((x) => x.sec === 'head').map(secRow)}
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
        <div className="field"><label htmlFor="il-att">สิ่งที่ส่งมาด้วย (ถ้ามี)</label><input id="il-att" className="input" value={l.attach ?? ''} onChange={(e) => set({ attach: e.target.value })} placeholder="เช่น กำหนดการงาน" /></div>
        <div className="field"><label htmlFor="il-body">6. ข้อความในหนังสือ (เนื้อหาทั้งหมด · ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่)</label><textarea id="il-body" className="input" rows={9} value={l.body} onChange={(e) => set({ body: e.target.value })} placeholder="ชื่องาน วัน เวลา สถานที่ เหตุผลที่เชิญ และสิ่งที่ขอ" /></div>

        {SECTIONS.filter((x) => x.sec !== 'head').map(secRow)}

        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost" onClick={copy}>📋 9. คัดลอกข้อความทั้งหมด</button>
          <button type="button" className="btn" onClick={pdf}>⬇️ 10. ดาวน์โหลด PDF</button>
          <button type="button" className="mini" onClick={() => { if (window.confirm('เริ่มฉบับใหม่ (ล้างข้อความทุกช่อง) ?')) setL({ ...BLANK, date: todayISO() }) }}>↺ เริ่มฉบับใหม่</button>
        </div>
        {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
      </section>

      <div aria-label="ตัวอย่างหนังสือ"><Paper l={l} c={cfg} paperRef={ref} /></div>
      <p className="small muted no-print" style={{ margin: '0.3rem 0' }}>ตัวอย่างหน้ากระดาษ A4 หนึ่งหน้า — ถ้าเนื้อหายาวเกินหน้า ให้ย่อข้อความ</p>

      <section className="card no-print" aria-label="เก็บเข้าคลังเอกสาร">
        <button type="button" className="btn btn--gold" disabled={busy} onClick={toLibrary}>🗄️ 11. เก็บเข้าคลังเอกสาร</button>
        <span className="small muted"> สร้าง PDF จากหนังสือนี้ แล้วไปหน้าคลังเอกสารพร้อมเลขที่ วันที่ และไฟล์ กดบันทึกได้ทันที</span>
      </section>
      {edit && <CfgForm sec={edit} cfg={cfg} onClose={() => setEdit(null)} onSave={(c) => { const ok = putCfg(c); if (ok) setEdit(null); return ok }} />}
    </>
  )
}

/** แก้ข้อความของส่วนเดียว (หัวจดหมาย / ปิดท้าย·ลงนาม / ข้อมูลติดต่อ) — บันทึกแล้วใช้กับหนังสือทุกฉบับทันที */
function CfgForm({ sec, cfg, onClose, onSave }: { sec: Sec; cfg: Cfg; onClose: () => void; onSave: (c: Cfg) => boolean }) {
  const def = SECTIONS.find((x) => x.sec === sec)!
  const [c, setC] = useState<Cfg>(cfg)
  const [msg, setMsg] = useState('')
  const f = (k: TextKey, label: string, rows?: number) => (
    <div className="field"><label htmlFor={`cf-${k}`}>{label}</label>
      {rows ? <textarea id={`cf-${k}`} className="input" rows={rows} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} /> : <input id={`cf-${k}`} className="input" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />}</div>
  )
  return (
    <Sheet title={`แก้ข้อความ: ${def.name}`} onClose={onClose}>
      {sec === 'head' && <>
        <p className="small muted" style={{ margin: 0 }}>โลโก้คริสตจักรใส่ให้ที่หัวจดหมายแล้ว</p>
        {f('thName', 'ชื่อคริสตจักร (ภาษาไทย)')}{f('enName', 'ชื่อ (ภาษาอังกฤษ)')}{f('addr', 'ที่อยู่ · อีเมล', 2)}
      </>}
      {sec === 'sign' && <>
        {f('proceed', 'ประโยคปิดเรื่อง (ชิดซ้าย)')}{f('bless', 'คำอวยพร/ลงท้าย (กึ่งกลาง · ขึ้นบรรทัดใหม่ได้)', 3)}{f('signName', 'ชื่อผู้ลงนาม (ไม่ต้องใส่วงเล็บ)')}{f('signRole', 'ตำแหน่ง')}
      </>}
      {sec === 'contact' && f('contact', 'ข้อมูลติดต่อ หากมีข้อสงสัย (บรรทัดละหนึ่งชุด)', 5)}
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row">
        <button type="button" className="btn btn--gold" onClick={() => { if (!onSave(c)) setMsg('ไม่มีสิทธิ์บันทึก') }}>บันทึก</button>
        <button type="button" className="btn btn--ghost" onClick={() => { if (window.confirm('คืนข้อความตั้งต้นของส่วนนี้ ?')) setC({ ...c, ...Object.fromEntries(def.keys.map((k) => [k, DEFAULT_CFG[k]])) }) }}>↺ คืนค่าตั้งต้น</button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button>
      </div>
    </Sheet>
  )
}
