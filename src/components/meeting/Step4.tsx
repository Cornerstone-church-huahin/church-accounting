import { useState } from 'react'
import type { StepProps } from './Step1'
import DocPreview from './DocPreview'
import { AgendaBody, BallotBody, MinuteFormBody, SignInBody, signPages } from './docs'
import { minutesBlocks, paginate } from './minutes'
import { hasVoteItems, previousMeeting, prepKeys } from '../../lib/meetings'

/** ขั้น 4: เตรียมเอกสาร/พิมพ์ — ชุดเอกสารจริงทุกฉบับ (หัวจดหมาย A4) ดูตัวอย่าง/ดาวน์โหลด PDF และติ๊กว่าเตรียมแล้ว · ตรวจความครบถ้วน */
export default function Step4({ m, save, list }: StepProps) {
  const [open, setOpen] = useState('')
  const prep = m.prep ?? {}
  const tick = (k: string, v: boolean) => save({ prep: { ...prep, [k]: v } })
  const prev = previousMeeting(list, m)
  const voteItems = hasVoteItems(m)
  const keys = prepKeys(m, list)
  const sets = m.people.filter((p) => p.name.trim()).length + 2 // ผู้ประชุมทุกคน + ประธาน + เลขานุการ
  const docs: { k: string; no: string; title: string; desc: string; na?: string; pages: () => React.ReactNode[]; file: string }[] = [
    { k: 'sign', no: '4.1', title: 'ใบลงชื่อผู้ประชุม', desc: 'รายชื่อ ช่องลงชื่อ และจำนวนผู้มีสิทธิ์สำหรับตรวจองค์ประชุม', pages: () => Array.from({ length: signPages(m) }, (_, i) => <SignInBody key={i} m={m} page={i} />), file: `meeting-signin-${m.no}-${m.year}.pdf` },
    { k: 'agenda', no: '4.2', title: 'ชุดระเบียบวาระ', desc: `วาระสำหรับประธาน เลขานุการ และผู้ประชุม — ควรพิมพ์ ${sets} ชุด`, pages: () => [<AgendaBody key="a" m={m} />], file: `meeting-agenda-${m.no}-${m.year}.pdf` },
    { k: 'prev', no: '4.3', title: 'รายงานการประชุมครั้งก่อน', desc: prev ? `ฉบับที่จะนำเข้าวาระรับรอง: ${prev.name} ครั้งที่ ${prev.no}/${prev.year}` : 'ยังไม่มีรายงานการประชุมครั้งก่อนในระบบ (ถ้ามีฉบับกระดาษ ให้แนบเอง)', na: prev ? undefined : 'ไม่มีรายงานครั้งก่อนในระบบ', pages: () => (prev ? paginate(minutesBlocks(prev, { final: !!prev.approval, draft: !prev.approval })).map((bs, i) => <div key={i}>{bs.map((b) => <div key={b.key}>{b.node}</div>)}</div>) : []), file: `meeting-prev-minutes-${prev?.no ?? 0}-${prev?.year ?? 0}.pdf` },
    { k: 'form', no: '4.4', title: 'แบบบันทึกการประชุม', desc: 'พื้นที่บันทึกสาระสำคัญและมติแยกตามวาระ', pages: () => [<MinuteFormBody key="f" m={m} />], file: `meeting-minute-form-${m.no}-${m.year}.pdf` },
    { k: 'ballot', no: '4.5', title: 'บัตรลงคะแนนและแบบสรุปผล', desc: voteItems ? 'สำหรับวาระที่ขอมติ — ลงคะแนนโดยไม่ระบุชื่อเพื่อรักษาความลับ' : 'ไม่มีวาระที่ต้องลงคะแนน', na: voteItems ? undefined : 'ไม่มีวาระที่ขอมติ', pages: () => [<BallotBody key="b" m={m} />], file: `meeting-ballot-${m.no}-${m.year}.pdf` },
  ]
  return (
    <>
      <p className="small" role="status" style={{ margin: '0 0 0.5rem' }}>เตรียมแล้ว {keys.filter((k) => prep[k]).length}/{keys.length} รายการ · ติ๊ก “เตรียมแล้ว” ที่ละฉบับเมื่อพิมพ์/ตรวจเรียบร้อย</p>
      {docs.map((d) => (
        <section key={d.k} className="card" aria-label={`${d.no} ${d.title}`}>
          <h2 style={{ margin: 0 }}>{d.no} {d.title}</h2>
          <p className="muted small" style={{ margin: '0.2rem 0 0.4rem' }}>{d.desc}</p>
          {d.na
            ? <p className="small" role="status" style={{ margin: 0 }}>— {d.na} (ไม่ต้องเตรียม) —</p>
            : <>
                <label className="row" style={{ margin: '0.3rem 0' }}><input type="checkbox" checked={!!prep[d.k]} onChange={(e) => tick(d.k, e.target.checked)} /> <b>เตรียมแล้ว</b></label>
                <button type="button" className="mini" aria-expanded={open === d.k} onClick={() => setOpen(open === d.k ? '' : d.k)}>{open === d.k ? 'ซ่อนตัวอย่าง' : '👁️ ดูตัวอย่างและดาวน์โหลด PDF'}</button>
                {open === d.k && <DocPreview pages={d.pages()} filename={d.file} label={d.title} />}
              </>}
        </section>
      ))}
      <section className="card" aria-label="4.6 ตรวจความครบถ้วน">
        <h2 style={{ margin: 0 }}>4.6 ตรวจความครบถ้วน</h2>
        <p className="muted small" style={{ margin: '0.2rem 0 0.4rem' }}>ตรวจก่อนใช้งานจริง แล้วติ๊กทีละข้อ</p>
        {([['c_cnt', `จำนวนชุดครบ (ประมาณ ${sets} ชุด)`], ['c_names', 'ชื่อผู้ประชุมและชื่อประธาน/เลขานุการถูกต้อง'], ['c_date', 'วัน เวลา สถานที่ ครั้งที่ ถูกต้อง'], ['c_attach', 'เอกสารแนบประกอบวาระครบ']] as const).map(([k, t]) => (
          <label key={k} className="row" style={{ margin: '0.25rem 0' }}><input type="checkbox" checked={!!prep[k]} onChange={(e) => tick(k, e.target.checked)} /> {t}</label>
        ))}
      </section>
    </>
  )
}
