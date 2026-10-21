import type { StepProps } from './Step1'
import { TextField } from './fields'
import { orderedAgenda } from './docs'
import { attendance } from './minutes'
import { minuteComplete } from '../../lib/meetings'
import type { MtAgenda, MtMinute, MtResult } from '../../lib/types'

const RESULTS: MtResult[] = ['เห็นชอบ', 'ไม่เห็นชอบ', 'เลื่อนพิจารณา', 'มีเงื่อนไข']

/** ขั้น 6: บันทึกประชุม — สาระ ข้อเสนอ มติ ผลลงคะแนน ผู้รับผิดชอบ/กำหนดเสร็จ ของทุกวาระ + เวลาเลิกและนัดครั้งต่อไป */
export default function Step6({ m, save }: StepProps) {
  const present = attendance(m).present.length
  const patch = (id: string, p: Partial<MtMinute>) => save({ agenda: m.agenda.map((a: MtAgenda) => (a.id === id ? { ...a, minute: { ...a.minute, ...p } } : a)) })
  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.floor(Number(v)) || 0))
  const items = orderedAgenda(m)
  const doneCount = items.filter((x) => minuteComplete(x.item)).length
  return (
    <>
      <p className="small" role="status" style={{ margin: '0 0 0.5rem' }}>บันทึกแล้ว {doneCount}/{items.length} วาระ · ผู้มีสิทธิ์ที่มาประชุม {present} คน{m.opened ? ` · เปิดประชุมเวลา ${m.opened.time} น.` : ' · ยังไม่ได้เปิดประชุมในขั้นที่ 5'}</p>
      {items.length === 0 && <p className="empty">ยังไม่มีวาระ — จัดวาระที่ขั้นที่ 2</p>}
      {items.map(({ n, item }) => {
        const mi = item.minute ?? {}
        const votes = (mi.yes ?? 0) + (mi.no ?? 0) + (mi.abstain ?? 0)
        return (
          <section key={item.id} className="card" aria-label={`วาระที่ ${n} ${item.title}`}>
            <h2 style={{ margin: 0 }}>วาระที่ {n} {item.title} {minuteComplete(item) && <span aria-label="บันทึกแล้ว" style={{ color: '#1b7f4b' }}>✓</span>}</h2>
            <p className="muted small" style={{ margin: '0.1rem 0 0.4rem' }}>{item.group} · เพื่อ{item.purpose}</p>
            <TextField id={`ms-${item.id}`} label="6.1 สาระสำคัญ" multiline rows={3} value={mi.summary} onCommit={(v) => patch(item.id, { summary: v.trim() || undefined })} placeholder="สรุปประเด็นที่เกี่ยวข้องกับการพิจารณา" />
            <TextField id={`mp-${item.id}`} label="6.2 ข้อเสนอให้พิจารณา" multiline rows={2} value={mi.proposal} onCommit={(v) => patch(item.id, { proposal: v.trim() || undefined })} />
            <div className="field"><label htmlFor={`mr-${item.id}`}>6.3 มติที่ประชุม</label>
              <select id={`mr-${item.id}`} className="input" value={mi.result ?? ''} onChange={(e) => patch(item.id, { result: (e.target.value || undefined) as MtResult | undefined })}>
                <option value="">— ยังไม่มีมติ —</option>{RESULTS.map((r) => <option key={r}>{r}</option>)}
              </select></div>
            {mi.result === 'มีเงื่อนไข' && <TextField id={`mc-${item.id}`} label="เงื่อนไข" value={mi.condition} onCommit={(v) => patch(item.id, { condition: v.trim() || undefined })} />}
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <TextField id={`my-${item.id}`} label="6.4 เห็นชอบ" type="number" narrow value={mi.yes} onCommit={(v) => patch(item.id, { yes: num(v) })} />
              <TextField id={`mn-${item.id}`} label="ไม่เห็นชอบ" type="number" narrow value={mi.no} onCommit={(v) => patch(item.id, { no: num(v) })} />
              <TextField id={`ma-${item.id}`} label="งดออกเสียง" type="number" narrow value={mi.abstain} onCommit={(v) => patch(item.id, { abstain: num(v) })} />
            </div>
            {votes > present && present > 0 && <p className="error small" role="alert" style={{ margin: 0 }}>⚠️ จำนวนคะแนนรวม {votes} มากกว่าผู้มีสิทธิ์ที่มาประชุม {present} คน — ตรวจตัวเลขอีกครั้ง</p>}
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <TextField id={`mo-${item.id}`} label="6.5 ผู้รับผิดชอบ" value={mi.assignee} onCommit={(v) => patch(item.id, { assignee: v.trim() || undefined })} />
              <TextField id={`md-${item.id}`} label="กำหนดเสร็จ" type="date" value={mi.due} onCommit={(v) => patch(item.id, { due: v || undefined })} />
            </div>
          </section>
        )
      })}
      <section className="card" aria-labelledby="s6-z">
        <h2 id="s6-z">6.6 เลิกประชุมและนัดครั้งถัดไป</h2>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="mt-close-time" label="เวลาเลิกประชุม" type="time" value={m.closed?.time} onCommit={(v) => save({ closed: v ? { ...m.closed, time: v } : undefined })} />
          <TextField id="mt-next" label="นัดประชุมครั้งต่อไป (ถ้ามี)" value={m.closed?.next} onCommit={(v) => m.closed?.time && save({ closed: { ...m.closed, next: v.trim() || undefined } })} placeholder="เช่น อาทิตย์ที่ 13 ธันวาคม 2026 เวลา 18.30 น." />
        </div>
        {!m.closed?.time && <p className="muted small" style={{ margin: 0 }}>กรอกเวลาเลิกประชุมก่อน จึงบันทึกการนัดครั้งถัดไปได้</p>}
      </section>
    </>
  )
}
