import { SelectField, TextField } from './fields'
import { blankPerson, KINDS } from '../../lib/meetings'
import type { Meeting, MtPerson } from '../../lib/types'

export interface StepProps { m: Meeting; save: (patch: Partial<Meeting>) => void; list: Meeting[] }

/** ขั้น 1: สร้างการประชุม — ข้อมูลพื้นฐานและรายชื่อผู้มีสิทธิ์ประชุม (ใช้จริงในทุกขั้นถัดไป) */
export default function Step1({ m, save }: StepProps) {
  const setPerson = (id: string, p: Partial<MtPerson>) => save({ people: m.people.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const add = (kind: MtPerson['kind']) => save({ people: [...m.people, blankPerson(kind)] })
  const count = (k: MtPerson['kind']) => m.people.filter((p) => p.kind === k && p.name.trim()).length
  const names = m.people.filter((p) => p.name.trim()).map((p) => p.name.trim())
  return (
    <>
      <section className="card" aria-labelledby="s1-a">
        <h2 id="s1-a">ข้อมูลพื้นฐาน</h2>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="mt-name" label="ชื่อการประชุม" value={m.name} onCommit={(v) => save({ name: v.trim() })} placeholder="เช่น การประชุมคณะธรรมกิจ" />
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="mt-no" label="ครั้งที่" type="number" narrow value={m.no} onCommit={(v) => save({ no: Math.max(0, Math.floor(Number(v)) || 0) })} />
          <TextField id="mt-year" label="ปี (ค.ศ.)" type="number" narrow value={m.year} onCommit={(v) => save({ year: Math.floor(Number(v)) || m.year })} />
          <SelectField id="mt-type" label="ประเภท" value={m.type} options={['ปกติ', 'พิเศษ'] as const} onChange={(v) => save({ type: v })} />
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="mt-date" label="วันประชุม" type="date" value={m.date} onCommit={(v) => save({ date: v })} />
          <TextField id="mt-time" label="เวลาเริ่ม" type="time" value={m.time} onCommit={(v) => save({ time: v })} />
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="mt-place" label="สถานที่ หรือช่องทางประชุมออนไลน์" value={m.place} onCommit={(v) => save({ place: v.trim() })} placeholder="เช่น ห้องประชุมคริสตจักร / Zoom" />
        </div>
        <datalist id="mt-names">{[...new Set(names)].map((n) => <option key={n} value={n} />)}</datalist>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <TextField id="mt-chair" label="ประธาน" value={m.chair} list="mt-names" onCommit={(v) => save({ chair: v.trim() })} />
          <TextField id="mt-sec" label="เลขานุการ (ผู้บันทึก)" value={m.secretary} list="mt-names" onCommit={(v) => save({ secretary: v.trim() })} />
        </div>
        <p className="muted small" style={{ margin: '0.2rem 0 0' }}>ครั้งที่และปีใช้เป็นเลขที่หนังสือ เช่น “ศอ {m.no || 'x'}/{m.year}”</p>
      </section>

      <section className="card" aria-labelledby="s1-b">
        <h2 id="s1-b">รายชื่อผู้มีสิทธิ์ประชุม</h2>
        <p className="small" role="status" style={{ margin: '0 0 0.5rem' }}>กรรมการ {count('กรรมการ')} · ผู้มีสิทธิ์ลงคะแนน {count('ผู้มีสิทธิ์ลงคะแนน')} · ผู้เข้าร่วมอื่น {count('ผู้เข้าร่วมอื่น')}</p>
        {KINDS.map((k) => (
          <div key={k} style={{ margin: '0.5rem 0' }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem' }}>{k}</h3>
            {m.people.filter((p) => p.kind === k).map((p) => (
              <div key={p.id} className="row" style={{ gap: '0.4rem', flexWrap: 'nowrap', marginBottom: '0.3rem' }}>
                <TextField id={`pn-${p.id}`} label="ชื่อ" value={p.name} onCommit={(v) => setPerson(p.id, { name: v.trim() })} placeholder={`ชื่อ${k}`} />
                <SelectField id={`pk-${p.id}`} label="ประเภท" value={p.kind} options={KINDS} onChange={(v) => setPerson(p.id, { kind: v })} />
                <button type="button" className="mini" style={{ alignSelf: 'flex-end' }} onClick={() => save({ people: m.people.filter((x) => x.id !== p.id) })} aria-label={`ลบ ${p.name || k}`}>🗑️</button>
              </div>
            ))}
            <button type="button" className="mini" onClick={() => add(k)}>＋ เพิ่ม{k}</button>
          </div>
        ))}
      </section>
    </>
  )
}
