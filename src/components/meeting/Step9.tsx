import { useState } from 'react'
import type { StepProps } from './Step1'
import DocPreview from './DocPreview'
import { minutesBlocks, paginate } from './minutes'
import { signsWith } from './Step7'
import { TextField } from './fields'
import SignaturePad from '../SignaturePad'
import { CHAIR_ROLE, SECRETARY_ROLE } from '../../lib/meetings'
import type { MtApproval } from '../../lib/types'

const OPTS: MtApproval[] = ['รับรองโดยไม่แก้ไข', 'รับรองโดยมีการแก้ไข', 'ยังไม่รับรอง']

/** ขั้น 9: รับรอง/ลงนาม — ผลรับรอง ฉบับสมบูรณ์พร้อมกล่องรับรอง ลายเซ็น และ PDF */
export default function Step9({ m, save }: StepProps) {
  const [pad, setPad] = useState('')
  const ap = m.approval
  const setAp = (p: Partial<NonNullable<typeof ap>>) => save({ approval: { result: 'รับรองโดยไม่แก้ไข', date: '', atNo: '', ...ap, ...p } })
  const okAp = !!ap && ap.result !== 'ยังไม่รับรอง'
  const pages = paginate(minutesBlocks(m, { final: okAp, draft: !okAp })).map((bs, i) => <div key={i}>{bs.map((b) => <div key={b.key}>{b.node}</div>)}</div>)
  return (
    <>
      <section className="card" aria-label="9.1 ผลการรับรอง">
        <h2 style={{ margin: 0 }}>9.1 ผลการรับรองของที่ประชุม</h2>
        <div className="field"><label htmlFor="s9-r">ผล</label>
          <select id="s9-r" className="input" value={ap?.result ?? ''} onChange={(e) => e.target.value && setAp({ result: e.target.value as MtApproval })}>
            <option value="">— เลือกผล —</option>{OPTS.map((o) => <option key={o}>{o}</option>)}
          </select></div>
        {ap && <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="s9-d" label="วันที่รับรอง" type="date" value={ap.date} onCommit={(v) => setAp({ date: v })} />
          <TextField id="s9-n" label="ในการประชุมครั้งที่" value={ap.atNo} onCommit={(v) => setAp({ atNo: v.trim() })} placeholder="เช่น 4/2026" />
        </div>}
        {ap?.result === 'รับรองโดยมีการแก้ไข' && <TextField id="s9-e" label="รายการที่แก้ไข" multiline rows={3} value={ap.edits} onCommit={(v) => setAp({ edits: v.trim() || undefined })} />}
        {ap?.result === 'รับรองโดยมีการแก้ไข' && !ap.edits && <p className="error small" role="alert" style={{ margin: 0 }}>ระบุรายการที่แก้ไข แล้วแก้เนื้อหาที่ขั้นที่ 6 และบันทึกฉบับใหม่ที่ขั้นที่ 7</p>}
        {ap?.result === 'ยังไม่รับรอง' && <p className="small" style={{ margin: 0 }}>ยังไม่รับรอง — คงสถานะรอรับรอง และยกไปวาระรับรองในครั้งต่อไป</p>}
      </section>
      <section className="card" aria-label="9.2 ลงนามฉบับสมบูรณ์">
        <h2 style={{ margin: 0 }}>9.2 ลงนามฉบับสมบูรณ์</h2>
        {([[SECRETARY_ROLE, m.secretary], [CHAIR_ROLE, m.chair]] as const).map(([role, name]) => {
          const sg = m.signs?.find((x) => x.role === role)
          return (
            <div key={role} style={{ marginTop: '0.3rem' }}>
              <b className="small">{role}: {name || '—'}</b>{sg?.img && <span role="status"> ✅ ลงลายเซ็นแล้ว</span>}
              {pad === role
                ? <SignaturePad label={name || role} onSave={(d) => { save({ signs: signsWith(m, role, name, d) }); setPad('') }} onCancel={() => setPad('')} />
                : <div><button type="button" className="btn btn--gold" disabled={!okAp || !name.trim()} onClick={() => setPad(role)}>{sg?.img ? '✍️ เซ็นใหม่' : `✍️ ${role === CHAIR_ROLE ? 'ประธาน' : 'เลขานุการ'}ลงลายเซ็น`}</button></div>}
            </div>
          )
        })}
        <label className="row" style={{ marginTop: '0.4rem' }}><input type="checkbox" checked={!!m.paperSigned} onChange={(e) => save({ paperSigned: e.target.checked })} /> ลงนามบนกระดาษแล้ว (ไม่ใช้ลายเซ็นในระบบ)</label>
        {!okAp && <p className="muted small" style={{ margin: 0 }}>เลือกผลรับรอง (ที่ไม่ใช่ “ยังไม่รับรอง”) ก่อนจึงลงนามได้</p>}
      </section>
      <section className="card" aria-label="9.3 ฉบับสมบูรณ์">
        <h2 style={{ margin: 0 }}>9.3 ฉบับสมบูรณ์ (PDF)</h2>
        <DocPreview pages={pages} filename={`meeting-minutes-final-${m.no}-${m.year}.pdf`} label={okAp ? 'ฉบับสมบูรณ์' : 'ร่างรายงาน'} />
      </section>
    </>
  )
}
