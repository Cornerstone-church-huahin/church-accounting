import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ScaledPage from './ScaledPage'
import Sheet from './Sheet'
import logoUrl from '../assets/logo.png'
import { useDocCategories, useDocLibrary, useInviteLetter, useInviteSettings } from '../lib/data'
import { can } from '../lib/access'
import { nextDocNo } from '../lib/docLibrary'
import { lineExternalUrl } from '../lib/inapp'
import { cleanSignature } from '../lib/signature'
import { useRole } from '../lib/members'
import { cacheImage } from '../lib/imageCache'
import { letterDate } from '../lib/meetings'
import { fmtDate, newId, todayISO } from '../lib/money'
import { buildPageImage, buildPagePdf, saveBlob, shareBlob } from '../lib/pdf'
import { getSync, putBinary } from '../lib/sync'
import type { DocAccess, DocItem, InviteLetter as Letter, InviteSettings } from '../lib/types'

type Draft = Omit<Letter, 'id' | 'updated'>
type Cfg = Omit<InviteSettings, 'id' | 'updated'>
const BLANK: Draft = { toName: '', no: '', date: '', subject: '', to: '', attach: '', showAttach: false, body: '' }
/** ภาพรวมข้อความของหนังสือ ณ ตอนลงนาม (เทียบว่าแก้ไขหลังลงนามหรือไม่) */
const snapOf = (l: Draft, c: Cfg) => JSON.stringify([l.no, l.date, l.subject, l.to, l.attach, l.showAttach, l.body, c.proceed, c.bless, c.signName, c.signRole])
/** เลขลำดับในวงกลม: ซีดเมื่อยังไม่ได้ใส่ · เขียวเมื่อใส่แล้ว (ข้อความเลขแบบเต็มอยู่ให้โปรแกรมอ่านหน้าจอ) */
function No({ n, ok }: { n: string; ok: boolean }) {
  return <><span className={`il-no${ok ? ' il-no--ok' : ''}`} aria-hidden="true" data-n={n} /><span className="sr-only">{n}. </span></>
}
/** ชื่อสั้นของหนังสือ (รายการ/คลังเอกสาร): หนังสือเชิญร่วมงาน + ผู้รับ */
export const letterTitle = (x: { toName?: string }) => `หนังสือเชิญร่วมงาน${x.toName?.trim() ? ` ${x.toName.trim()}` : ''}`
/** สิ่งที่ส่งมาด้วยจะขึ้นบนหนังสือเมื่อเลือก “แสดง” และพิมพ์ข้อความแล้ว */
const attachOf = (l: Draft) => (l.showAttach && l.attach?.trim() ? l.attach.trim() : '')
/** ค่าตั้งต้น (ตามหนังสือจริงของคริสตจักร) — แก้ได้ที่ปุ่ม “แก้หัวจดหมาย · ลงนาม · ข้อมูลติดต่อ” */
export const DEFAULT_CFG: Cfg = {
  numPrefix: 'ศอช',
  thName: 'คริสตจักรศิลาเอก ภาค 7 สภาคริสตจักรในประเทศไทย',
  enName: 'Cornerstone Church 7th District, The Church of Christ in Thailand',
  addr: '23/490 ซ.หัวหิน 94 ต.หัวหิน อ.หัวหิน จ.ประจวบคีรีขันธ์ 77110 อีเมล : doothailand@gmail.com',
  proceed: 'จึงเรียนมาเพื่อโปรดพิจารณาและดำเนินการต่อไป',
  bless: 'ขอพระเจ้าโปรดอวยพรท่านและครอบครัว\nขอแสดงความนับถือในพระคริสต์',
  signName: 'มน.สมเจต เสมาทอง',
  signRole: 'ประธานคณะธรรมกิจคริสตจักรศิลาเอก',
  contact: 'ติดต่อ 080-582-0777 มน.สมเจต เสมาทอง ประธานธรรมกิจ, 095-779-9382 คศ.กฤตุ รุ่งโรจน์ร่มเย็น ศิษยาภิบาล,\n093-476-5585 คศ.พิชิต เผ่าดี ศิษยาภิบาลฝ่ายอภิบาลและพัฒนา,\n081-889-6490 อ.ดารา ผลจันทร์ คณะธรรมกิจ',
}
type Sec = 'head' | 'sign' | 'contact'
type TextKey = 'numPrefix' | 'thName' | 'enName' | 'addr' | 'proceed' | 'bless' | 'signName' | 'signRole' | 'contact'
/** 3 ส่วนที่แก้ได้ (ตามเลขลำดับบนหน้า): ช่องข้อความของแต่ละส่วน */
const SECTIONS: { sec: Sec; no: string; name: string; keys: TextKey[] }[] = [
  { sec: 'head', no: '2', name: 'หัวจดหมาย', keys: ['thName', 'enName', 'addr', 'numPrefix'] },
  { sec: 'sign', no: '8', name: 'ข้อความปิดท้าย · ลงนาม', keys: ['proceed', 'bless', 'signName', 'signRole'] },
  { sec: 'contact', no: '9', name: 'ข้อมูลติดต่อ', keys: ['contact'] },
]

/** ข้อความล้วนของหนังสือ (คัดลอกไปวางในโปรแกรมอื่น) */
export function letterText(l: Draft, c: Cfg): string {
  return [
    c.thName, c.enName, c.addr, '',
    l.no ? `ที่ ${l.no}` : '', letterDate(l.date), '',
    `เรื่อง  ${l.subject}`, `เรียน  ${l.to}`, attachOf(l) ? `สิ่งที่ส่งมาด้วย  ${attachOf(l)}` : '', '', l.body, '', c.proceed, '', c.bless, '', '', c.signName ? `(${c.signName})` : '', c.signRole, '', c.contact,
  ].filter((x, i, a) => !(x === '' && (a[i - 1] === '' || i === 0))).join('\n').trim()
}

/** หน้า A4: หัวจดหมาย (โลโก้ + ข้อความ) บน · เนื้อหากลาง · ลงนามขวา · ข้อมูลติดต่อล็อกท้ายกระดาษ */
function Paper({ l, c, paperRef }: { l: Draft; c: Cfg; paperRef: React.Ref<HTMLDivElement> }) {
  const signed = !!l.signed && !!c.signImg
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
          {attachOf(l) && <div className="letter__row"><span>สิ่งที่ส่งมาด้วย</span><span style={{ flex: 1 }}>{attachOf(l)}</span></div>}
          <div style={{ margin: '18px 0 8px', minHeight: 120 }}>{(l.body || '………').split(/\n/).filter((x) => x.trim()).map((p, i) => <p key={i} className="letter__p">{p}</p>)}</div>
          <p className="letter__p">{c.proceed}</p>
        </div>
        {/* ลงนาม + ข้อมูลติดต่อ: ตรึงไว้ท้ายกระดาษเสมอ (เนื้อหาใช้พื้นที่ตรงกลางที่เหลือ) */}
        <div className="il__bottom">
          <div className="letter__sign">
            {c.bless.split('\n').map((x, i) => <div key={i}>{x}</div>)}
            <div style={{ height: 88, position: 'relative' }}>{signed && <img src={c.signImg} alt="ลายเซ็น" className="il__sign" />}</div>
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
export default function InviteLetterPage({ id }: { id: string }) {
  const store = useInviteLetter()
  const exists = store.items.some((x) => x.id === id)
  const { syncNow } = store
  // เปิดจากลิงก์ที่แชร์มา (เครื่องที่ยังไม่ได้ดึงข้อมูล): รอดึงหนังสือก่อน ห้ามสร้างฉบับเปล่าทับของจริง
  useEffect(() => { if (!exists) void syncNow() }, [exists]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!exists) {
    return (
      <>
        <div className="page-head no-print"><h1>✉️ หนังสือเชิญร่วมงาน</h1><Link to="/meeting/1/1/invite" className="mini">‹ รายการหนังสือ</Link></div>
        <section className="card"><p style={{ margin: 0 }}>⏳ กำลังดึงหนังสือจากระบบ…</p><p className="small muted" style={{ margin: '0.3rem 0 0' }}>ถ้าไม่ขึ้นภายในไม่กี่วินาที ให้กด “กดรีเฟรชเพื่ออัปเดต” ที่แถบด้านบน หรือตรวจว่าเข้าระบบด้วยบัญชีของคุณแล้ว (หนังสือฉบับนี้อาจถูกลบไปแล้ว)</p></section>
      </>
    )
  }
  return <InviteEditor key={id} id={id} />
}

function InviteEditor({ id }: { id: string }) {
  const store = useInviteLetter()
  const role = useRole()
  const cfgStore = useInviteSettings()
  const lib = useDocLibrary(), cats = useDocCategories()
  const saved = store.items.find((x) => x.id === id)
  const cfg: Cfg = { ...DEFAULT_CFG, ...(cfgStore.items.find((x) => x.id === 'settings') ?? {}) }
  const [l, setL] = useState<Draft>(() => ({ ...BLANK, ...(saved ?? {}), showAttach: saved?.showAttach ?? !!saved?.attach?.trim(), date: saved?.date || todayISO() }))
  const [editNo, setEditNo] = useState(false)
  const [signSetup, setSignSetup] = useState(false)
  const [copied, setCopied] = useState(false)
  const [menu, setMenu] = useState<'share' | 'download' | null>(null)
  /** ส่งเข้าคลังสำเร็จ: แสดงป๊อปอัพ แล้วพาไปหน้าคลังเอกสาร (เปิดรายการที่เพิ่งส่งให้เห็น) */
  const [done, setDone] = useState<{ id: string; title: string; no: string; again: boolean } | null>(null)
  const navigate = useNavigate()
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => navigate('/meeting/1/2', { state: { openDoc: done.id } }), 2200)
    return () => clearTimeout(t)
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps
  const [edit, setEdit] = useState<Sec | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const set = (patch: Partial<Draft>) => setL((p) => ({ ...p, ...patch }))
  // บันทึกอัตโนมัติ (หน่วงเล็กน้อย) — ร่วมกันทุกเครื่อง
  const dirty = useRef(false), latest = useRef(l), putRef = useRef(store.put)
  latest.current = l; putRef.current = store.put
  useEffect(() => {
    if (first.current) { first.current = false; return }
    dirty.current = true
    const t = setTimeout(() => { store.put([{ ...l, id, updated: Date.now() }]); dirty.current = false }, 700)
    return () => clearTimeout(t)
  }, [l]) // eslint-disable-line react-hooks/exhaustive-deps
  // ออกจากหน้าก่อนครบเวลาหน่วง: บันทึกที่ค้างทันที (กดปุ่มกลับ = บันทึกก่อนเปลี่ยนหน้า เพื่อให้รายการเห็นฉบับล่าสุด)
  const flush = () => { if (dirty.current) { putRef.current([{ ...latest.current, id, updated: Date.now() }]); dirty.current = false } }
  useEffect(() => () => flush(), []) // eslint-disable-line react-hooks/exhaustive-deps

  // เลขที่หนังสือรันอัตโนมัติ (ศอช.001, 002, …): เลขถัดไป = เลขสูงสุดของฉบับที่ยังอยู่ + 1 (ลบฉบับท้ายสุดแล้วเลขนั้นกลับมาใช้ใหม่)
  const prefix = (cfg.numPrefix ?? 'ศอช').trim() || 'ศอช'
  const others = store.items.filter((x) => x.id !== id)
  const nextNo = nextDocNo(others.map((x) => ({ no: x.no })), prefix)
  const dupNo = !!l.no.trim() && others.some((x) => x.no.trim() === l.no.trim())
  useEffect(() => { if (!l.no.trim()) set({ no: nextNo }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const cat = cats.list.find((c) => c.name.includes('เชิญ'))

  // ลงลายเซ็น (เฉพาะแอดมิน/ผู้ลงนาม): แก้หนังสือหลังลงนามแล้ว ลายเซ็นถูกถอน ต้องลงนามใหม่
  const canSign = can(role, 'settings')
  useEffect(() => {
    if (l.signed && l.signed.snap !== snapOf(l, cfg)) { set({ signed: undefined }); setMsg('ลายเซ็นถูกถอน เพราะมีการแก้ไขหนังสือหลังลงนาม — ตรวจแล้วกด ✍️ ลงลายเซ็นใหม่') }
  }, [l, cfg.proceed, cfg.bless, cfg.signName, cfg.signRole]) // eslint-disable-line react-hooks/exhaustive-deps
  const sign = () => {
    if (!ready()) return
    if (!cfg.signImg) return setSignSetup(true)   // ยังไม่มีรูปลายเซ็น: เปิดหน้าต่างให้เลือกรูปครั้งแรก แล้วลงนามต่อทันที
    set({ signed: { at: Date.now(), by: getSync()?.name || 'ผู้ลงนาม', snap: snapOf(l, cfg) } })
    setMsg('ลงลายเซ็นเรียบร้อย — แชร์ ดาวน์โหลด และส่งเข้าคลังเอกสาร จะมีลายเซ็นกำกับ')
  }

  const ready = () => { if (l.showAttach && !attachOf(l)) { setMsg('เลือกแสดงสิ่งที่ส่งมาด้วยแล้ว ต้องพิมพ์ข้อความก่อน (หรือกด “ไม่แสดง”)'); return false } return true }
  const copy = async () => {
    if (!ready()) return
    const text = letterText(l, cfg)
    let ok = false
    try { await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(no, 1500))]); ok = true } catch { /* ลองวิธีสำรอง */ }
    if (!ok) { // วิธีสำรอง (เบราว์เซอร์ที่ไม่ให้สิทธิ์คลิปบอร์ด)
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      ta.remove()
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2500) }
    setMsg(ok ? 'คัดลอกข้อความทั้งหมดแล้ว — นำไปวางในโปรแกรมอื่นได้' : 'คัดลอกไม่สำเร็จ — ลองกดค้างที่ข้อความแล้วเลือกคัดลอกเอง')
  }
  /** 10. แจ้งประธานตรวจสอบ: แชร์ข้อความ + ลิงก์ผ่านเมนูแชร์ของเครื่อง (LINE ฯลฯ) · ประธานกดลิงก์แล้วเข้าหน้านี้ทันที */
  const notify = async () => {
    if (!ready()) return
    const url = lineExternalUrl(`${window.location.origin}${window.location.pathname}#/meeting/1/1/invite-${id}`)
    const text = `เรียน ท่านประธาน\nขอให้ตรวจสอบ${letterTitle(l)}${l.no.trim() ? ` (เลขที่ ${l.no.trim()})` : ''} ที่จัดทำเรียบร้อยแล้ว รอการตรวจสอบและลงนาม\nเปิดดูหนังสือได้ที่ลิงก์นี้:\n${url}`
    let how: 'shared' | 'copied' | '' = ''
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'ขอให้ตรวจสอบหนังสือเชิญ', text }); how = 'shared' } catch (e) { if ((e as Error).name === 'AbortError') return }
    }
    if (!how) {
      let ok = false
      try { await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(no, 1500))]); ok = true } catch { /* ลองวิธีสำรอง */ }
      if (!ok) { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy') } catch { ok = false } ta.remove() }
      if (!ok) return setMsg('คัดลอกข้อความไม่สำเร็จ — ลองใหม่อีกครั้ง')
      how = 'copied'
    }
    set({ notified: { at: Date.now(), by: getSync()?.name || '' } })
    setMsg(how === 'shared' ? 'แจ้งประธานแล้ว' : 'คัดลอกข้อความแจ้งประธานแล้ว — นำไปวางส่งใน LINE หรือช่องทางอื่นได้เลย')
  }
  const baseName = `หนังสือเชิญ ${l.no.trim() ? l.no.trim().replace(/[\\/:*?"<>|]/g, '-') : todayISO()}`
  const makeFile = async (fmt: 'pdf' | 'png') => {
    if (!ref.current) throw new Error('ยังไม่พบหน้ากระดาษ')
    return fmt === 'pdf' ? { blob: await buildPagePdf(ref.current), name: `${baseName}.pdf` } : { blob: await buildPageImage(ref.current), name: `${baseName}.png` }
  }
  /** 📤 แชร์ · ⬇️ ดาวน์โหลด — เป็น PDF หรือรูปภาพ */
  const output = async (act: 'share' | 'download', fmt: 'pdf' | 'png') => {
    if (!ready()) return
    setMenu(null); setBusy(true); setMsg('')
    try {
      const { blob, name } = await makeFile(fmt)
      if (act === 'share') {
        const r = await shareBlob(blob, name, l.subject || 'หนังสือเชิญ')
        if (r === 'unsupported') { saveBlob(blob, name); setMsg('เครื่องนี้แชร์ไฟล์ตรงๆ ไม่ได้ — ดาวน์โหลดไฟล์ให้แทนแล้ว ส่งต่อจากไฟล์ที่ดาวน์โหลดได้เลย') } else if (r === 'shared') setMsg('แชร์แล้ว')
      } else { saveBlob(blob, name); setMsg(`ดาวน์โหลด ${name} แล้ว`) }
    } catch (e) { if ((e as Error).name !== 'AbortError') setMsg(e instanceof Error ? e.message : 'ทำไฟล์ไม่สำเร็จ') }
    setBusy(false)
  }
  /** 12. ส่งเข้าคลังเอกสาร (อัตโนมัติทั้งหมด): สร้าง PDF → อัปโหลด → สร้างรายการในคลัง · ส่งซ้ำ = ทับฉบับเดิมในคลัง */
  const sendToLibrary = async () => {
    if (!ready()) return
    if (!l.toName?.trim()) return setMsg('ใส่ชื่อในช่อง “1. ส่งถึง” ก่อน เพื่อตั้งชื่อหนังสือในคลังเอกสารให้ถูกต้อง')
    const cfgSync = getSync()
    if (!cfgSync) return setMsg('ต้องเชื่อมต่อออนไลน์ก่อน จึงส่งเข้าคลังเอกสารได้ (ไฟล์เก็บใน repo ข้อมูล)')
    setBusy(true); setMsg('')
    try {
      const { blob, name } = await makeFile('pdf')
      const data = await blob.arrayBuffer()
      const path = `attachments/docs/${new Date().getFullYear()}/doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.pdf`
      await putBinary(cfgSync, path, data, 'คลังเอกสาร')
      void cacheImage(path, data, 'application/pdf')
      const docId = l.docId && lib.list.some((d) => d.id === l.docId) ? l.docId : newId('doc')
      const d: DocItem = { id: docId, updated: Date.now(), title: letterTitle(l), category: cat?.name ?? '', no: l.no.trim(), date: l.date, access: l.access ?? 'ภายใน', note: l.to.trim() ? `เรียน ${l.to.trim()}` : undefined, file: { path, name, type: 'application/pdf', size: data.byteLength } }
      if (!lib.put([d])) throw new Error('ไม่มีสิทธิ์บันทึกลงคลังเอกสาร')
      set({ docId }); setDone({ id: docId, title: d.title, no: d.no, again: l.docId === docId })
    } catch (e) { setMsg(e instanceof Error ? e.message : 'ส่งเข้าคลังเอกสารไม่สำเร็จ') }
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
  const filled = (v?: string) => !!v?.trim()
  const okOf: Record<string, boolean> = {
    '1': filled(l.toName), '2': filled(cfg.thName) && filled(cfg.addr), '3': filled(l.no), '4': filled(l.date), '5': filled(l.subject), '6': filled(l.to),
    '6.1': !!l.showAttach && filled(l.attach), '7': filled(l.body), '8': filled(cfg.proceed) && filled(cfg.signName) && filled(cfg.signRole), '9': filled(cfg.contact),
    '10': !!l.notified, '11': !!l.signed, '12': !!l.docId && lib.list.some((d) => d.id === l.docId),
  }
  const secRow = (x: (typeof SECTIONS)[number]) => (
    <div key={x.sec} className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'nowrap' }}>
      <span style={{ minWidth: 0 }}><b><No n={x.no} ok={okOf[x.no]} />{x.name}</b><br /><span className="small muted" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(cfg[x.keys[0]] ?? '').split('\n')[0]}</span></span>
      <span className="row" style={{ gap: 4, flex: 'none', flexWrap: 'nowrap' }}>
        <button type="button" className="mini" aria-label={`ใส่ข้อความ ${x.name}`} title="ใส่ข้อความตั้งต้น" onClick={() => fill(x)}>➕</button>
        <button type="button" className="mini" aria-label={`แก้ข้อความ ${x.name}`} title="แก้ข้อความ" onClick={() => setEdit(x.sec)}>✏️</button>
      </span>
    </div>
  )

  return (
    <>
      <div className="page-head no-print"><h1>✉️ หนังสือเชิญร่วมงาน</h1><Link to="/meeting/1/1/invite" className="mini" onClick={flush}>‹ รายการหนังสือ</Link></div>
      <p className="muted small no-print" style={{ margin: '0 0 0.5rem' }}>เชิญผู้ใหญ่ร่วมงานกิจกรรมของคริสตจักร · กรอกเรียงลงมา แล้วดูตัวอย่างบนกระดาษด้านล่าง · บันทึกอัตโนมัติ</p>
      <section className="card no-print" aria-label="กรอกหนังสือเชิญ">
        <div className="field"><label htmlFor="il-tn"><No n="1" ok={okOf['1']} />ส่งถึง (ชื่อสั้น ใช้ตั้งชื่อในรายการและคลังเอกสาร)</label><input id="il-tn" className="input" value={l.toName ?? ''} onChange={(e) => set({ toName: e.target.value })} placeholder="เช่น นพพร" /></div>

        {SECTIONS.filter((x) => x.sec === 'head').map(secRow)}
        <div className="field"><label htmlFor="il-no"><No n="3" ok={okOf['3']} />เลขที่หนังสือ <span className="muted small">(รันอัตโนมัติ)</span></label>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            {editNo
              ? <input id="il-no" className="input" style={{ flex: 1 }} value={l.no} onChange={(e) => set({ no: e.target.value })} onBlur={() => setEditNo(false)} autoFocus />
              : <output id="il-no" className="il-numbadge" aria-label={`เลขที่หนังสือ ${l.no}`}>{l.no || '…'}</output>}
            <button type="button" className="mini" aria-label="แก้เลขที่หนังสือเอง" title="แก้เลขเอง" onClick={() => setEditNo(!editNo)}>{editNo ? '✓' : '✏️'}</button>
          </div>
          <span className="small muted">ฉบับถัดไปจะได้ {nextDocNo([...others.map((x) => ({ no: x.no })), { no: l.no }], prefix)} · ลบฉบับท้ายสุด เลขนั้นจะกลับมาใช้ใหม่</span>
          {dupNo && <span className="error" role="alert">เลขนี้ซ้ำกับหนังสือฉบับอื่น</span>}
        </div>

        <div className="field"><label htmlFor="il-date"><No n="4" ok={okOf['4']} />วันที่ (ตั้งต้นเป็นวันที่บันทึก)</label><input id="il-date" type="date" className="input" value={l.date} onChange={(e) => set({ date: e.target.value })} /></div>
        <div className="field"><label htmlFor="il-sub"><No n="5" ok={okOf['5']} />เรื่อง</label><input id="il-sub" className="input" value={l.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="เช่น ขอเชิญร่วมงานคริสต์มาสคริสตจักร" /></div>
        <div className="field"><label htmlFor="il-to"><No n="6" ok={okOf['6']} />เรียน</label><input id="il-to" className="input" value={l.to} onChange={(e) => set({ to: e.target.value })} placeholder="ชื่อ ตำแหน่ง ของผู้ใหญ่ที่เชิญ" /></div>
        <div className="field"><label htmlFor="il-att"><No n="6.1" ok={okOf['6.1']} />สิ่งที่ส่งมาด้วย</label>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button type="button" role="switch" aria-checked={!!l.showAttach} aria-label="แสดงสิ่งที่ส่งมาด้วยบนหนังสือ" className={l.showAttach ? 'btn btn--gold' : 'btn btn--ghost'} onClick={() => set({ showAttach: !l.showAttach })}>{l.showAttach ? '✅ แสดงบนหนังสือ' : '🚫 ไม่แสดง'}</button>
            <span className="small muted">{l.showAttach ? 'พิมพ์ข้อความด้านล่างเอง' : 'กด “แสดง” ถ้าหนังสือนี้มีสิ่งที่แนบ'}</span>
          </div>
          {l.showAttach && <input id="il-att" className="input" style={{ marginTop: 6 }} value={l.attach ?? ''} onChange={(e) => set({ attach: e.target.value })} placeholder="พิมพ์สิ่งที่แนบ เช่น กำหนดการงาน" aria-invalid={!attachOf(l)} />}
          {l.showAttach && !attachOf(l) && <span className="error" role="alert">เลือกแสดงสิ่งที่ส่งมาด้วยแล้ว ต้องพิมพ์ข้อความ</span>}
        </div>
        <div className="field"><label htmlFor="il-body"><No n="7" ok={okOf['7']} />ข้อความในหนังสือ (เนื้อหาทั้งหมด · ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่)</label><textarea id="il-body" className="input" rows={9} value={l.body} onChange={(e) => set({ body: e.target.value })} placeholder="ชื่องาน วัน เวลา สถานที่ เหตุผลที่เชิญ และสิ่งที่ขอ" /></div>

        {SECTIONS.filter((x) => x.sec !== 'head').map(secRow)}

      </section>

      <div className="row no-print" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 6, margin: '0.5rem 0 0.2rem' }}>
        <span><b>📄 ตัวอย่างเอกสาร</b><br /><span className="small muted">กระดาษด้านล่างคือหนังสือที่จะได้ — ตรวจให้ถูกต้องก่อนขั้นตอนถัดไป</span></span>
        <button type="button" className="mini" onClick={copy} aria-label="คัดลอกข้อความทั้งหมด">{copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกข้อความ'}</button>
      </div>
      <div aria-label="ตัวอย่างหนังสือ"><Paper l={l} c={cfg} paperRef={ref} /></div>
      <section className="card no-print" aria-label="ไฟล์หนังสือ">
        <button type="button" className="btn btn--ghost il-bar" onClick={notify}>📨 <No n="10" ok={okOf['10']} />แจ้งประธานตรวจสอบ</button>
        {l.notified && <p className="small muted" style={{ margin: 0 }}>แจ้งประธานแล้วเมื่อ {new Date(l.notified.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}{l.notified.by ? ` · โดย ${l.notified.by}` : ''}</p>}
        {l.signed && (
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span role="status">✅ <b>ลงนามแล้ว</b><br /><span className="small muted">{new Date(l.signed.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} · {l.signed.by}</span></span>
            {canSign && <button type="button" className="mini" onClick={() => { if (window.confirm('ยกเลิกลายเซ็นของหนังสือฉบับนี้ ?')) set({ signed: undefined }) }}>↩︎ ยกเลิกลายเซ็น</button>}
          </div>
        )}
        {/* ปุ่มลงลายเซ็น: เห็นและกดได้เฉพาะแอดมิน (ประธาน) เท่านั้น · ผู้ใช้อื่นไม่เห็นปุ่มและไม่มีข้อความเกี่ยวกับปุ่มนี้ */}
        {canSign && !l.signed && <button type="button" className="btn btn--gold il-bar" onClick={sign}>✍️ <No n="11" ok={okOf['11']} />ลงลายเซ็น</button>}
        <div className="field" style={{ margin: 0 }}><label htmlFor="il-acc">ใครเห็นในคลังเอกสาร</label>
          <select id="il-acc" className="input" value={l.access ?? 'ภายใน'} onChange={(e) => set({ access: e.target.value as DocAccess })}>
            <option value="ทั่วไป">ทั่วไป — ทุกคนที่เข้าระบบ</option>
            <option value="ภายใน">ภายใน — แอดมินและผู้ดูแลงานเลขา</option>
            <option value="ลับ">ลับ — แอดมินคนเดียว</option>
          </select></div>
        <button type="button" className="btn btn--gold" disabled={busy} onClick={sendToLibrary}>🗄️ <No n="12" ok={okOf['12']} />ส่งเข้าคลังเอกสาร</button>
        <span className="small muted">สร้าง PDF แล้วเก็บเข้าคลังเอกสารให้เองทั้งหมด (เลขที่ วันที่ ชื่อเรื่อง) ไม่ต้องกรอกอะไรเพิ่ม</span>
        <span className="small muted" style={{ marginTop: 4 }}>📤 สำหรับแชร์หรือดาวน์โหลดไฟล์เท่านั้น — ไม่ใช่ขั้นตอนที่ต้องทำ ใช้เมื่อต้องส่งต่อหรือเก็บไว้ในเครื่อง</span>
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          {([['share', '📤', 'แชร์'], ['download', '⬇️', 'ดาวน์โหลด']] as const).map(([act, ico, label]) => (
            <button key={act} type="button" className={menu === act ? 'btn btn--gold' : 'btn btn--ghost'} disabled={busy} aria-expanded={menu === act} aria-label={`${label} เป็น PDF หรือรูปภาพ`} onClick={() => setMenu(menu === act ? null : act)} style={{ flex: 1, minWidth: 0, padding: '0.4rem 0.3rem' }}>{ico}<br /><small>{label}</small></button>
          ))}
        </div>
        {menu && (
          <div className="row" role="group" aria-label={`เลือกชนิดไฟล์ที่จะ${menu === 'share' ? 'แชร์' : 'ดาวน์โหลด'}`} style={{ gap: 8, justifyContent: 'center' }}>
            <button type="button" className="btn" onClick={() => output(menu, 'pdf')}>📄 PDF</button>
            <button type="button" className="btn" onClick={() => output(menu, 'png')}>🖼️ รูปภาพ</button>
          </div>
        )}
        {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
      </section>
      {done && (
        <Sheet title="ส่งเข้าคลังเอกสารแล้ว" onClose={() => navigate('/meeting/1/2', { state: { openDoc: done.id } })}>
          <p style={{ margin: 0, fontSize: '1.1rem' }}>✅ <b>{done.title}</b><br /><span className="small">เลขที่ {done.no || '-'}{done.again ? ' · ทับฉบับเดิมของหนังสือนี้ในคลัง' : ''}</span></p>
          <p className="small muted" style={{ margin: 0 }}>บันทึกเข้าคลังเอกสารเรียบร้อย กำลังพาไปหน้าคลังเอกสารให้ดู…</p>
          <button type="button" className="btn btn--gold" onClick={() => navigate('/meeting/1/2', { state: { openDoc: done.id } })}>ไปที่คลังเอกสารเลย</button>
        </Sheet>
      )}
      {signSetup && (
        <SignFirstTime onClose={() => setSignSetup(false)} onUse={(img) => {
          if (!putCfg({ ...cfg, signImg: img })) return false
          set({ signed: { at: Date.now(), by: getSync()?.name || 'ผู้ลงนาม', snap: snapOf(l, cfg) } })
          setSignSetup(false); setMsg('ลงลายเซ็นเรียบร้อย — ครั้งต่อไปกด ✍️ ลงลายเซ็นได้ทันที ไม่ต้องเลือกรูปอีก'); return true
        }} />
      )}
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
        {f('thName', 'ชื่อคริสตจักร (ภาษาไทย)')}{f('enName', 'ชื่อ (ภาษาอังกฤษ)')}{f('addr', 'ที่อยู่ · อีเมล', 2)}{f('numPrefix', 'ตัวย่อเลขที่หนังสือ (เช่น ศอช → ศอช.001 รันต่อไปเอง)')}
      </>}
      {sec === 'sign' && <>
        <SignUpload value={c.signImg} onChange={(v) => setC({ ...c, signImg: v })} />
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

/** งานเลขา › ลำดับงาน › หนังสือเชิญร่วมงาน: โซน 1 ค้นหา/เพิ่มฉบับใหม่ · โซน 2 การ์ดหนังสือแต่ละฉบับ (วันที่ใหม่สุดอยู่บน) กดการ์ดเพื่อเข้าหน้ากรอก */
export function InviteLetterList() {
  const store = useInviteLetter()
  const cfgStore = useInviteSettings()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const empty = (x: Letter) => !(x.toName ?? '').trim() && !x.subject.trim() && !x.body.trim() && !x.to.trim() && !x.no.trim()
  const letters = store.items.filter((x) => !(x.id === 'draft' && empty(x)))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.updated - a.updated)
  const t = q.trim().toLowerCase()
  const shown = t ? letters.filter((x) => `${x.toName ?? ''} ${x.subject} ${x.to} ${x.no} ${x.date} ${x.body}`.toLowerCase().includes(t)) : letters
  const add = () => {
    const id = newId('letter')
    const pre = (cfgStore.items.find((x) => x.id === 'settings')?.numPrefix ?? DEFAULT_CFG.numPrefix ?? 'ศอช').trim() || 'ศอช'
    if (!store.put([{ ...BLANK, id, no: nextDocNo(store.items.map((x) => ({ no: x.no })), pre), date: todayISO(), updated: Date.now() }])) return setMsg('ไม่มีสิทธิ์สร้างหนังสือ')
    navigate(`/meeting/1/1/invite-${id}`)
  }
  const del = (x: Letter) => { if (window.confirm(`ลบ “${letterTitle(x)}” ?`)) setMsg(store.put([{ ...x, deleted: true, updated: Date.now() }]) ? '' : 'ไม่มีสิทธิ์ลบ') }
  return (
    <>
      <div className="page-head no-print"><h1>✉️ หนังสือเชิญร่วมงาน</h1><Link to="/meeting/1/1" className="mini">‹ ลำดับงาน</Link></div>
      <section className="card" aria-label="ค้นหาหรือเพิ่มหนังสือ">
        <div className="row" style={{ gap: 6, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, margin: 0 }}><label htmlFor="il-q">🔎 ค้นหาหนังสือ (ชื่อ เรื่อง เลขที่)</label><input id="il-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์เพื่อค้นหา" /></div>
          <button type="button" className="btn btn--gold" aria-label="เพิ่มหนังสือฉบับใหม่" title="เพิ่มหนังสือฉบับใหม่" onClick={add}>➕ ใหม่</button>
        </div>
      </section>
      {msg && <p className="error" role="alert">{msg}</p>}
      {shown.length === 0 ? <p className="empty">{letters.length === 0 ? 'ยังไม่มีหนังสือ — กด ➕ ใหม่ เพื่อสร้างฉบับแรก' : 'ไม่พบหนังสือที่ค้นหา'}</p> : (
        <ul className="wflist" aria-label="รายการหนังสือเชิญ">
          {shown.map((x) => (
            <li key={x.id} className="wfitem">
              <Link to={`/meeting/1/1/invite-${x.id}`} className="wfcard" aria-label={`เปิด ${letterTitle(x)}`}>
                <span className="wfcard__icon" aria-hidden="true">✉️</span>
                <span className="wfcard__t"><b>{letterTitle(x)}{x.signed ? ' ✅' : ''}</b><small>{[x.no, x.subject, x.date && fmtDate(x.date)].filter(Boolean).join(' · ') || 'ยังไม่กรอกรายละเอียด'}</small></span>
                <span aria-hidden="true">›</span>
              </Link>
              <span className="wfitem__act"><button type="button" className="mini" aria-label={`ลบ ${letterTitle(x)}`} onClick={() => del(x)}>🗑️</button></span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** อัปโหลดรูปลายเซ็น (เฉพาะแอดมิน): ถ่าย/เลือกรูปที่เซ็นบนกระดาษขาว ระบบลบพื้นให้โปร่งใสและตัดขอบอัตโนมัติ */
function SignUpload({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const role = useRole()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  if (!can(role, 'settings')) return null
  const pick = async (f: File | null) => {
    if (!f) return
    setBusy(true); setMsg('')
    try { onChange(await cleanSignature(f)); setMsg('ทำลายเซ็นโปร่งใสแล้ว — กด “บันทึก” เพื่อใช้งาน') } catch (e) { setMsg(e instanceof Error ? e.message : 'อ่านรูปไม่สำเร็จ') }
    setBusy(false)
  }
  return (
    <div className="field"><label htmlFor="cf-sign">ลายเซ็น (รูปเซ็นบนกระดาษขาว · ระบบลบพื้นให้เอง)</label>
      <input id="cf-sign" className="input" type="file" accept="image/*" disabled={busy} onChange={(e) => void pick(e.target.files?.[0] ?? null)} />
      {value && <div className="il-signprev"><img src={value} alt="ตัวอย่างลายเซ็น" /><button type="button" className="mini" onClick={() => onChange(undefined)}>🗑️ ลบลายเซ็น</button></div>}
      {msg && <span className="small" role="status">{msg}</span>}
      <span className="small muted">ลายเซ็นใช้ได้เฉพาะเมื่อแอดมินกด “✍️ ลงลายเซ็น” ที่หนังสือแต่ละฉบับ</span></div>
  )
}

/** ลงลายเซ็นครั้งแรก: เลือกรูปลายเซ็นจากเครื่อง → ลบพื้นให้โปร่งใส → ดูตัวอย่าง → ใช้แล้วลงนามทันที (ทำครั้งเดียว) */
function SignFirstTime({ onClose, onUse }: { onClose: () => void; onUse: (img: string) => boolean }) {
  const [img, setImg] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const pick = async (f: File | null) => {
    if (!f) return
    setBusy(true); setMsg('')
    try { setImg(await cleanSignature(f)) } catch (e) { setMsg(e instanceof Error ? e.message : 'อ่านรูปไม่สำเร็จ') }
    setBusy(false)
  }
  return (
    <Sheet title="ลงลายเซ็น — ใส่รูปลายเซ็นครั้งแรก" onClose={onClose}>
      <p style={{ margin: 0 }}>ยังไม่มีรูปลายเซ็นในระบบ เลือกรูปลายเซ็นของท่าน (รูปที่เซ็นบนกระดาษขาว) ระบบลบพื้นขาวให้โปร่งใสและวางในช่องลงนามให้ <b>ทำครั้งเดียว</b> ครั้งต่อไปกดลงลายเซ็นได้ทันที</p>
      <div className="field"><label htmlFor="sf-file">เลือกรูปลายเซ็นจากเครื่อง</label><input id="sf-file" className="input" type="file" accept="image/*" disabled={busy} onChange={(e) => void pick(e.target.files?.[0] ?? null)} /></div>
      {img && <div className="il-signprev"><img src={img} alt="ตัวอย่างลายเซ็น" /></div>}
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row">
        <button type="button" className="btn btn--gold" disabled={!img} onClick={() => { if (!onUse(img)) setMsg('ไม่มีสิทธิ์บันทึกลายเซ็น') }}>✍️ ใช้ลายเซ็นนี้และลงนาม</button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>ยกเลิก</button>
      </div>
    </Sheet>
  )
}
