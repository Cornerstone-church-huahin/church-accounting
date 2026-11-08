import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StepProps } from './Step1'
import LetterPage from '../LetterPage'
import PdfTools from '../PdfTools'
import RosterPaper from './RosterPaper'
import SignaturePad from '../SignaturePad'
import { TextField } from './fields'
import { checkMinutes, minutesBlocks, minutesPlain, paginate } from './minutes'
import { signsWith } from './Step7'
import { buildPagesPdf } from '../../lib/pdf'
import { CHAIR_ROLE, SECRETARY_ROLE, chairReviewed, letterDate, plainName, whenPatch, yearBE } from '../../lib/meetings'
import { useDocCategories, useDocLibrary, useLetters, useSettings } from '../../lib/data'
import { getSync, putBinary } from '../../lib/sync'
import { cacheImage } from '../../lib/imageCache'
import { newId, todayISO } from '../../lib/money'
import type { DocItem, MtApproval } from '../../lib/types'

const PARTS = ['ตรวจร่างและส่งประธาน', 'ประธานตรวจและเซ็น', 'รับรองในที่ประชุม', 'ฉบับสมบูรณ์ · เก็บเข้าแฟ้ม']
const OPTS: MtApproval[] = ['รับรองโดยไม่แก้ไข', 'รับรองโดยมีการแก้ไข', 'ยังไม่รับรอง']
const LIB_CAT_N = 'รายงานการประชุม', LIB_CAT_V = 'รายงานการประชุมวิสามัญ'
const fmt = (t: number) => letterDate(new Date(t).toISOString().slice(0, 10))

/**
 * ไอคอนที่ 3 รายงานการประชุม — 4 ส่วนตามลำดับ (แถบล่าง 1–4 เหมือนบันทึกการประชุม):
 * 1 ตรวจร่างและส่งประธาน → 2 ประธานตรวจและเซ็น → 3 รับรองในที่ประชุมครั้งถัดไป → 4 ฉบับสมบูรณ์ ลงนาม เก็บเข้าแฟ้ม/คลังเอกสาร
 * (รายละเอียดแต่ละส่วนจะต่อยอดภายหลัง — ตอนนี้วางระบบให้เดินครบจนเก็บเข้าแฟ้มได้)
 */
export default function ReportFlow({ m, save }: StepProps) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const church = settings.churchName.split(' ')[0]
  const lib = useDocLibrary(), cats = useDocCategories()
  const [sel, setSel] = useState<number | null>(null)
  const [pad, setPad] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const rosterEl = useRef<HTMLDivElement>(null)
  const pageEls = useRef<HTMLDivElement[]>([])

  const notices = useLetters('notice')
  const notice = m.noticeLetterId ? notices.items.find((x) => x.id === m.noticeLetterId && !x.deleted) : undefined
  // วัน-เวลา-สถานที่: ดึงจากหนังสือแจ้งประชุม (ที่ผู้ใช้แก้เองไม่แตะ)
  useEffect(() => {
    const d = new Date(), pad = (n: number) => String(n).padStart(2, '0')
    const patch = whenPatch(m, notice, todayISO(), `${pad(d.getHours())}:${pad(d.getMinutes())}`)
    if (patch) save(patch)
  }, [notice?.toName, notice?.body, m.date, m.time, m.place, m.whenSrc]) // eslint-disable-line react-hooks/exhaustive-deps

  const libCat = m.type === 'พิเศษ' ? LIB_CAT_V : LIB_CAT_N   // สามัญ/วิสามัญ แยกหมวดเก็บแฟ้ม
  const drafts = m.drafts ?? []
  const last = drafts[drafts.length - 1]
  const changed = !!last && last.text !== minutesPlain(m)
  const reviewed = chairReviewed(m) && !changed
  const sign = (role: string) => m.signs?.find((x) => x.role === role)
  const chairSigned = !!sign(CHAIR_ROLE)?.img || !!m.paperSigned
  const ap = m.approval
  const approved = !!ap && ap.result !== 'ยังไม่รับรอง'
  const chk = checkMinutes(m)

  const done = [!!m.toChair && !changed, reviewed && chairSigned, approved, !!m.archived]
  const current = done.findIndex((d) => !d) < 0 ? 3 : done.findIndex((d) => !d)
  const view = sel !== null && sel <= current ? sel : current

  const addDraft = (extra: Partial<StepProps['m']> = {}) => {
    save({ drafts: [...drafts, { at: Date.now(), by: m.secretary || 'เลขานุการ', note: note.trim() || (drafts.length ? 'แก้ไขตามที่ประธานแจ้ง' : 'ฉบับร่างแรก'), text: minutesPlain(m) }], chairOk: undefined, ...extra })
    setNote('')
  }
  const setAp = (p: Partial<NonNullable<typeof ap>>) => save({ approval: { result: 'รับรองโดยไม่แก้ไข', date: '', atNo: '', ...ap, ...p } })

  const finalMode = view === 3 && approved
  const pages = paginate(minutesBlocks(m, { final: finalMode, draft: !finalMode }))
  pageEls.current = []
  const sheetEls = () => [...(view === 3 ? [rosterEl.current] : []), ...pageEls.current].filter(Boolean) as HTMLDivElement[]
  const fileName = `รายงานการประชุม-${plainName(m.name) || 'ประชุม'}-ครั้งที่${m.no}-${yearBE(m.year)}${finalMode ? '' : '-ร่าง'}.pdf`

  const file = async () => {
    const els = sheetEls()
    const cfg = getSync()
    if (!cfg) return setMsg('ต้องเชื่อมต่อออนไลน์ก่อน จึงเก็บเข้าคลังเอกสารได้ (ไฟล์เก็บใน repo ข้อมูล)')
    if (!els.length) return
    setBusy(true); setMsg('')
    try {
      const pdf = await buildPagesPdf(els.map((el) => ({ el })))
      if (!pdf) throw new Error('สร้างไฟล์ไม่สำเร็จ')
      const data = pdf.output('arraybuffer') as ArrayBuffer
      const path = `attachments/docs/${new Date().getFullYear()}/doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.pdf`
      await putBinary(cfg, path, data, 'คลังเอกสาร')
      void cacheImage(path, data, 'application/pdf')
      if (!cats.items.some((c) => !c.deleted && c.name === libCat)) cats.put([{ id: newId('cat'), updated: Date.now(), name: libCat }])
      const docId = m.reportDocId && lib.list.some((d) => d.id === m.reportDocId) ? m.reportDocId : newId('doc')
      const d: DocItem = { id: docId, updated: Date.now(), title: `รายงานการประชุม${plainName(m.name) ? ` ${plainName(m.name)}` : ''} ครั้งที่ ${m.no}/${yearBE(m.year)}`, category: libCat, no: `${m.no}/${yearBE(m.year)}`, date: ap?.date || m.date || '', access: m.access ?? 'ภายใน', note: `ฉบับสมบูรณ์ · ${ap?.result ?? ''}`, file: { path, name: fileName, type: 'application/pdf', size: data.byteLength } }
      if (!lib.put([d])) throw new Error('ไม่มีสิทธิ์บันทึกลงคลังเอกสาร')
      save({ archived: { at: Date.now() }, reportDocId: docId })
      setMsg('')
    } catch (e) { setMsg(e instanceof Error ? e.message : 'เก็บเข้าคลังไม่สำเร็จ') }
    setBusy(false)
  }

  const signer = (role: string, name: string, needsReview: boolean) => {
    const sg = sign(role)
    return (
      <div key={role} style={{ marginTop: '0.4rem' }}>
        <b className="small">{role}: {name || '—'}</b>
        {sg?.img && <div><img src={sg.img} alt={`ลายเซ็น ${name}`} style={{ maxHeight: 60, background: '#fff', border: '1px solid #ccc', borderRadius: 4 }} /></div>}
        {pad === role
          ? <SignaturePad label={name || role} onSave={(d) => { save({ signs: signsWith(m, role, name, d) }); setPad('') }} onCancel={() => setPad('')} />
          : <div><button type="button" className="btn btn--gold" disabled={!name.trim() || (needsReview && !reviewed)} onClick={() => setPad(role)}>{sg?.img ? '✍️ เซ็นใหม่' : `✍️ ${role === CHAIR_ROLE ? 'ประธาน' : 'เลขานุการ'}ลงลายเซ็น`}</button></div>}
      </div>
    )
  }

  const doc = (
    <>
      {view === 3 && <RosterPaper ref={rosterEl} church={church} m={m} />}
      {pages.map((bs, i) => (
        <LetterPage key={i} ref={(el) => { if (el) pageEls.current[i] = el }}>{bs.map((b) => <div key={b.key}>{b.node}</div>)}</LetterPage>
      ))}
      <PdfTools compact els={sheetEls} file={fileName} title={`รายงานการประชุม ครั้งที่ ${m.no}/${yearBE(m.year)}`} label={finalMode ? 'รายงานฉบับสมบูรณ์' : 'ร่างรายงานการประชุม'} />
    </>
  )

  const bar = (
    <nav className="mcbar no-print" aria-label="ลำดับรายงานการประชุม">
      <div className="mcbar__dots" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {PARTS.map((t, i) => (
          <button key={t} type="button" disabled={i > current} onClick={() => setSel(i)} aria-label={`ส่วนที่ ${i + 1} ${t}${done[i] ? ' (เสร็จแล้ว)' : ''}`} aria-current={view === i ? 'step' : undefined}
            className={`mcbar__dot${done[i] ? ' mcbar__dot--done' : i === current ? ' mcbar__dot--partial' : ''}${view === i ? ' mcbar__dot--cur' : ''}`} style={{ cursor: i > current ? 'not-allowed' : 'pointer', opacity: i > current ? 0.5 : 1 }}>{done[i] ? '✓' : i + 1}</button>
        ))}
      </div>
      <div className="mcbar__cap">ครั้งที่ {m.no}/{yearBE(m.year)}{plainName(m.name) ? ` · ${plainName(m.name)}` : ''} · ส่วนที่ {view + 1}: {PARTS[view]}</div>
    </nav>
  )

  return (
    <>
      {view === 0 && (<>
        <section className="card" aria-label="ตรวจร่างรายงาน">
          <h2 style={{ marginTop: 0 }}>ส่วนที่ 1 · ตรวจร่างและส่งประธาน</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {[...chk.basics, ...chk.numbers].map((c) => <li key={c.text}>{c.ok ? '✅' : '⚠️'} {c.text}</li>)}
          </ul>
          <p className="muted small" style={{ margin: '0.3rem 0 0' }}>{chk.errors === 0 ? 'ตรวจผ่านทุกรายการ' : `มี ${chk.errors} รายการที่ควรตรวจ — ส่งต่อได้ แล้วค่อยแก้ที่บันทึกการประชุม`}</p>
          {doc}
        </section>
        <section className="card" aria-label="ส่งให้ประธานตรวจ">
          <TextField id="rf-note" label="หมายเหตุของฉบับนี้ (ไม่บังคับ)" value={note} onCommit={setNote} placeholder="เช่น แก้ตามที่ประธานแจ้ง" />
          {changed && <p className="error small" role="alert" style={{ margin: 0 }}>เนื้อหารายงานเปลี่ยนไปจากฉบับที่ส่งล่าสุด — ส่งเป็นฉบับใหม่</p>}
          <button type="button" className="btn btn--gold" onClick={() => { addDraft({ toChair: { at: Date.now() } }); setSel(null) }}>📨 บันทึกฉบับและส่งให้ประธานตรวจ</button>
          {m.toChair && !changed && <p role="status" className="small" style={{ margin: 0 }}>ส่งให้ประธานแล้ว เมื่อ {fmt(m.toChair.at)} · กดเลข 2 ด้านล่างเพื่อไปต่อ</p>}
        </section>
      </>)}

      {view === 1 && (<>
        <section className="card" aria-label="ประธานตรวจและเซ็น">
          <h2 style={{ marginTop: 0 }}>ส่วนที่ 2 · ประธานตรวจและเซ็น</h2>
          {reviewed
            ? <p role="status" style={{ margin: 0 }}>✅ ประธาน <b>{m.chairOk!.by}</b> ตรวจฉบับล่าสุดแล้ว เมื่อ {fmt(m.chairOk!.at)} <button type="button" className="mini" onClick={() => save({ chairOk: undefined })}>ยกเลิก</button></p>
            : <button type="button" className="btn" disabled={!last || changed || !m.toChair || !m.chair.trim()} onClick={() => save({ chairOk: { by: m.chair.trim(), at: Date.now(), draftAt: last!.at } })}>บันทึกว่าประธานตรวจฉบับนี้แล้ว</button>}
          {!m.chair.trim() && <p className="muted small" style={{ margin: 0 }}>ยังไม่ได้ตั้งชื่อประธาน (ตั้งที่ ✏️ แก้ข้อมูลการประชุม)</p>}
          {signer(SECRETARY_ROLE, m.secretary, false)}
          {signer(CHAIR_ROLE, m.chair, true)}
          <label className="row" style={{ marginTop: '0.4rem' }}><input type="checkbox" checked={!!m.paperSigned} onChange={(e) => save({ paperSigned: e.target.checked })} /> ลงนามบนกระดาษแล้ว (ไม่ใช้ลายเซ็นในระบบ)</label>
          {doc}
        </section>
      </>)}

      {view === 2 && (
        <section className="card" aria-label="รับรองในที่ประชุม">
          <h2 style={{ marginTop: 0 }}>ส่วนที่ 3 · รับรองในที่ประชุมครั้งถัดไป</h2>
          <label className="row"><input type="checkbox" checked={!!m.queuedNext} onChange={(e) => save({ queuedNext: e.target.checked })} /> <b>บรรจุวาระรับรองรายงานในการประชุมครั้งถัดไปแล้ว</b></label>
          <p className="muted small" style={{ margin: 0 }}>{m.closed?.next ? `ประชุมครั้งถัดไป: ${m.closed.next}` : 'ยังไม่ได้กำหนดนัดครั้งถัดไป'}</p>
          <div className="field"><label htmlFor="rf-r">ผลการรับรองของที่ประชุม</label>
            <select id="rf-r" className="input" value={ap?.result ?? ''} onChange={(e) => e.target.value && setAp({ result: e.target.value as MtApproval })}>
              <option value="">— เลือกผล —</option>{OPTS.map((o) => <option key={o}>{o}</option>)}
            </select></div>
          {ap && <div className="row" style={{ alignItems: 'flex-start' }}>
            <TextField id="rf-d" label="วันที่รับรอง" type="date" value={ap.date} onCommit={(v) => setAp({ date: v })} />
            <TextField id="rf-n" label="ในการประชุมครั้งที่" value={ap.atNo} onCommit={(v) => setAp({ atNo: v.trim() })} placeholder="เช่น 4/2026" />
          </div>}
          {ap?.result === 'รับรองโดยมีการแก้ไข' && <TextField id="rf-e" label="รายการที่แก้ไข" multiline rows={3} value={ap.edits} onCommit={(v) => setAp({ edits: v.trim() || undefined })} />}
          {ap?.result === 'ยังไม่รับรอง' && <p className="small" style={{ margin: 0 }}>ยังไม่รับรอง — ยกไปวาระรับรองในครั้งต่อไป</p>}
          {approved && <p role="status" className="small" style={{ margin: 0 }}>✅ บันทึกผลรับรองแล้ว · กดเลข 4 ด้านล่างเพื่อไปฉบับสมบูรณ์</p>}
        </section>
      )}

      {view === 3 && (<>
        <section className="card" aria-label="ฉบับสมบูรณ์">
          <h2 style={{ marginTop: 0 }}>ส่วนที่ 4 · ฉบับสมบูรณ์ ลงนาม และเก็บเข้าแฟ้ม</h2>
          <p className="muted small" style={{ margin: '0 0 0.3rem' }}>ฉบับสมบูรณ์มีบรรทัดการรับรองและลายเซ็นผู้จด/ประธาน พร้อมใบลงชื่อแนบหน้าแรก · เก็บเป็นไฟล์ PDF เข้าคลังเอกสาร หมวด “{libCat}”</p>
          {doc}
        </section>
        <section className="card" aria-label="เก็บเข้าแฟ้ม">
          {m.archived
            ? <p role="status" style={{ margin: 0 }}>✅ <b>เก็บเข้าแฟ้มแล้ว</b> เมื่อ {fmt(m.archived.at)} <button type="button" className="mini" onClick={() => save({ archived: undefined })}>เปิดแฟ้มอีกครั้ง</button></p>
            : <button type="button" className="btn btn--gold" disabled={busy || !approved} onClick={file}>{busy ? 'กำลังสร้างไฟล์…' : '🗄️ เก็บเข้าแฟ้ม และส่งเข้าคลังเอกสาร'}</button>}
          {m.archived && <button type="button" className="btn" onClick={() => navigate('/meeting/1/5')}>📂 ไปที่คลังเอกสาร</button>}
          {msg && <p className="error small" role="alert" style={{ margin: 0 }}>{msg}</p>}
        </section>
      </>)}
      {bar}
    </>
  )
}
