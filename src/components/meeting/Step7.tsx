import { useState } from 'react'
import type { StepProps } from './Step1'
import DocPreview from './DocPreview'
import { checkMinutes, minutesBlocks, minutesPlain, paginate } from './minutes'
import SignaturePad from '../SignaturePad'
import { chairReviewed, CHAIR_ROLE, letterDate, SECRETARY_ROLE } from '../../lib/meetings'

const fmt = (t: number) => letterDate(new Date(t).toISOString().slice(0, 10))

/** ลายเซ็นของบทบาทหนึ่ง (เก็บใน m.signs) */
export function signsWith(m: StepProps['m'], role: string, name: string, img?: string) {
  const base = m.signs?.length ? m.signs : [{ role: SECRETARY_ROLE, name: m.secretary }, { role: CHAIR_ROLE, name: m.chair }]
  return base.map((x) => (x.role === role ? { ...x, name, img } : x))
}

/** ขั้น 7: ส่งประธานตรวจ — ร่างรายงาน ตรวจความถูกต้อง ประวัติฉบับ ประธานตรวจและลงลายเซ็น */
export default function Step7({ m, save }: StepProps) {
  const [note, setNote] = useState('')
  const [pad, setPad] = useState<string>('')
  const chk = checkMinutes(m)
  const drafts = m.drafts ?? []
  const last = drafts[drafts.length - 1]
  const changed = !!last && last.text !== minutesPlain(m)
  const reviewed = chairReviewed(m) && !changed
  const pages = paginate(minutesBlocks(m, { draft: !reviewed })).map((bs, i) => <div key={i}>{bs.map((b) => <div key={b.key}>{b.node}</div>)}</div>)
  const sign = (role: string) => m.signs?.find((x) => x.role === role)
  const addDraft = (extra: Partial<StepProps['m']> = {}) => {
    const at = Date.now()
    save({ drafts: [...drafts, { at, by: m.secretary || 'เลขานุการ', note: note.trim() || (drafts.length ? 'แก้ไขตามที่ประธานแจ้ง' : 'ฉบับร่างแรก'), text: minutesPlain(m) }], chairOk: undefined, ...extra })
    setNote('')
  }
  const useSig = (role: string, name: string, img: string) => { save({ signs: signsWith(m, role, name, img) }); setPad('') }
  return (
    <>
      <section className="card" aria-label="7.1 ร่างรายงาน">
        <h2 style={{ margin: 0 }}>7.1 ร่างรายงานการประชุม</h2>
        <p className="muted small" style={{ margin: '0.2rem 0 0.4rem' }}>สร้างจากข้อมูลขั้น 1–6 โดยอัตโนมัติ · ต้องแก้เนื้อหา ให้กลับไปแก้ที่ขั้น 5–6 แล้วบันทึกเป็นฉบับใหม่ที่นี่</p>
        <DocPreview pages={pages} filename={`meeting-minutes-draft-${m.no}-${m.year}.pdf`} label="ร่างรายงาน" />
      </section>
      <section className="card" aria-label="7.2 ตรวจความถูกต้อง">
        <h2 style={{ margin: 0 }}>7.2 ตรวจความถูกต้อง</h2>
        <p className="small" style={{ margin: '0.3rem 0 0' }}><b>ชื่อและข้อมูลพื้นฐาน</b></p>
        <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>{chk.basics.map((c) => <li key={c.text}>{c.ok ? '✅' : '⚠️'} {c.text}</li>)}</ul>
        <p className="small" style={{ margin: '0.3rem 0 0' }}><b>ตัวเลขและมติ</b></p>
        <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>{chk.numbers.map((c) => <li key={c.text}>{c.ok ? '✅' : '⚠️'} {c.text}</li>)}</ul>
        <p role="status" className="small" style={{ margin: '0.3rem 0 0' }}>{chk.errors === 0 ? 'ตรวจผ่านทุกรายการ พร้อมส่งประธาน' : `ยังมี ${chk.errors} รายการที่ควรแก้ก่อนส่งประธาน`}</p>
      </section>
      <section className="card" aria-label="7.3 ส่งประธานตรวจ">
        <h2 style={{ margin: 0 }}>7.3 บันทึกฉบับและส่งประธาน</h2>
        <div className="field"><label htmlFor="s7-note">หมายเหตุของฉบับนี้ (ไม่บังคับ)</label><input id="s7-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น แก้ชื่อผู้ลา" /></div>
        {changed && <p className="error small" role="alert" style={{ margin: 0 }}>⚠️ เนื้อหารายงานเปลี่ยนไปจากฉบับล่าสุด — บันทึกเป็นฉบับใหม่เพื่อให้ประธานตรวจอีกครั้ง</p>}
        <div className="row">
          <button type="button" className="btn btn--gold" disabled={chk.errors > 0 || (!!last && !changed && !m.chairOk && !!m.toChair)} onClick={() => addDraft({ toChair: { at: Date.now() } })}>📨 บันทึกฉบับและส่งให้ประธานตรวจ</button>
          <button type="button" className="mini" onClick={() => addDraft({ toChair: m.toChair })}>บันทึกเป็นฉบับร่าง (ยังไม่ส่ง)</button>
        </div>
        {m.toChair && <p role="status" className="small" style={{ margin: 0 }}>ส่งให้ประธานแล้ว เมื่อ {fmt(m.toChair.at)}</p>}
      </section>
      <section className="card" aria-label="7.4 ประธานตรวจและลงนาม">
        <h2 style={{ margin: 0 }}>7.4 ประธานตรวจและลงลายเซ็น</h2>
        {reviewed
          ? <p role="status" style={{ margin: 0 }}>✅ ประธาน <b>{m.chairOk!.by}</b> ตรวจฉบับล่าสุดแล้ว เมื่อ {fmt(m.chairOk!.at)} <button type="button" className="mini" onClick={() => save({ chairOk: undefined })}>ยกเลิก</button></p>
          : <button type="button" className="btn" disabled={!last || changed || !m.toChair || !m.chair.trim()} onClick={() => save({ chairOk: { by: m.chair.trim(), at: Date.now(), draftAt: last!.at } })}>บันทึกว่าประธานตรวจฉบับนี้แล้ว</button>}
        {!reviewed && <p className="muted small" style={{ margin: 0 }}>ต้องส่งฉบับให้ประธานก่อน และเนื้อหาต้องตรงกับฉบับที่ส่ง</p>}
        {([[SECRETARY_ROLE, m.secretary], [CHAIR_ROLE, m.chair]] as const).map(([role, name]) => {
          const sg = sign(role), isChair = role === CHAIR_ROLE
          return (
            <div key={role} style={{ marginTop: '0.4rem' }}>
              <b className="small">{role}: {name || '—'}</b>
              {sg?.img && <div><img src={sg.img} alt={`ลายเซ็น ${name}`} style={{ maxHeight: 60, background: '#fff', border: '1px solid #ccc', borderRadius: 4 }} /></div>}
              {pad === role
                ? <SignaturePad label={name || role} onSave={(d) => useSig(role, name, d)} onCancel={() => setPad('')} />
                : <div className="row"><button type="button" className="btn btn--gold" disabled={!name.trim() || (isChair && !reviewed)} onClick={() => setPad(role)}>{sg?.img ? '✍️ เซ็นใหม่' : isChair ? '✍️ ประธานลงลายเซ็น' : '✍️ เลขานุการลงลายเซ็น'}</button>{sg?.img && <button type="button" className="mini" onClick={() => save({ signs: signsWith(m, role, name, undefined) })}>ลบลายเซ็น</button>}</div>}
            </div>
          )
        })}
      </section>
      <section className="card" aria-label="7.5 ประวัติฉบับ">
        <h2 style={{ margin: 0 }}>7.5 ประวัติการแก้ไข</h2>
        {drafts.length === 0 ? <p className="muted small" style={{ margin: 0 }}>ยังไม่มีฉบับที่บันทึก</p> : (
          <ol className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>{drafts.map((d, i) => <li key={d.at}>ฉบับที่ {i + 1} · {fmt(d.at)} · {d.by} · {d.note}{i === drafts.length - 1 ? ' (ล่าสุด)' : ''}</li>)}</ol>
        )}
      </section>
    </>
  )
}
