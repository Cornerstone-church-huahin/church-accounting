import { useState } from 'react'
import { fmtBaht, fmtDate, todayISO } from '../lib/money'
import { actDays, actEnded, addGoal, goalProgress, looksLikeActivity, toggleGoal, type WizRow } from '../lib/fundActs'
import type { ActEval, FundActivity } from '../lib/types'

const gaugeColor = (v: number) => (v < 40 ? '#c4332a' : v < 70 ? '#d9a21b' : '#1f8a4c')

/** ขีดแบบปรอท: แถบเติมตามค่า 0–100 (แดง ต่ำ · เหลือง กลาง · เขียว สูง) */
export function Gauge({ value, label, text }: { value: number; label: string; text?: string }) {
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={`${label} ${value} จาก 100`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 12, borderRadius: 999, background: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: gaugeColor(value), borderRadius: 999 }} />
      </div>
      <b style={{ minWidth: 56, textAlign: 'right' }}>{text ?? `${value}/100`}</b>
    </div>
  )
}

export interface ActStat { moneyIn: number; moneyOut: number; balance: number }

/** การ์ดกิจกรรม: ยาวบางเรียงลง · ฟ้า = กำลังดำเนินการ · เทา = ปิดกิจกรรมแล้ว · ขีดความพึงพอใจ 0–100 และความคืบหน้าเป้าหมาย ให้เห็นทันทีที่การ์ด */
export function ActivityCards({ acts, stat, onOpen }: { acts: FundActivity[]; stat: (a: FundActivity) => ActStat; onOpen: (id: string) => void }) {
  if (acts.length === 0) return <p className="empty no-print" role="status">ยังไม่มีกิจกรรม</p>
  return (
    <ul className="actlist no-print" aria-label="กิจกรรมของกองทุน">
      {acts.map((a) => {
        const st = stat(a), gp = goalProgress(a), ended = actEnded(a, todayISO()), end = a.endDate ?? a.date
        return (
          <li key={a.id}>
            <button type="button" className={`actcard ${ended ? 'actcard--closed' : 'actcard--open'}`} onClick={() => onOpen(a.id)} aria-label={`กิจกรรม ${a.name}${a.closed ? ' (ปิดแล้ว)' : ended ? ' (สิ้นสุดแล้ว)' : ''}`}>
              <span className="actcard__top"><b className="actcard__name">{a.name}</b><span className="actcard__date">{fmtDate(a.date)}{end !== a.date ? ` – ${fmtDate(end)}` : ''} · {actDays(a)} วัน</span></span>
              <span className="actcard__nums"><span>รับ {fmtBaht(st.moneyIn)}</span><span>จ่าย {fmtBaht(st.moneyOut)}</span><b>คงเหลือ {fmtBaht(st.balance)}</b></span>
              {gp.total > 0 && <span className="actcard__row"><span className="small">เป้าหมาย {gp.done}/{gp.total}</span><Gauge value={gp.pct} label="ความคืบหน้า" text={`${gp.pct}%`} /></span>}
              <span className="actcard__row"><span className="small">ประเมินความสำเร็จ</span>{a.eval ? <Gauge value={a.eval.score} label="ความพึงพอใจ" /> : <Gauge value={0} label="ความพึงพอใจ" text="ยังไม่ประเมิน" />}</span>
              {ended && <span className="small">{a.closed ? `ปิดกิจกรรมแล้ว ${fmtDate(a.closed.date)}` : 'สิ้นสุดแล้ว'}{a.eval?.summary ? ` · “${a.eval.summary}”` : ''}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** ฟอร์มเพิ่มกิจกรรมใหม่ (แอดมิน) — พับเก็บไว้ ให้การ์ดอยู่ด้านบน */
export function AddActivity({ onAdd }: { onAdd: (name: string, date: string, endDate: string) => string | null }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayISO())
  const [endDate, setEnd] = useState(todayISO())
  const [err, setErr] = useState('')
  return (
    <details className="card no-print" aria-label="เพิ่มกิจกรรม">
      <summary><b>＋ เพิ่มกิจกรรมใหม่</b></summary>
      <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
        <input className="input grow" aria-label="ชื่อกิจกรรมใหม่" placeholder="ชื่อกิจกรรม เช่น งานคริสต์มาส" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="small" style={{ display: 'grid', gap: 2 }}>วันเริ่ม<input className="input" type="date" aria-label="วันที่เริ่มกิจกรรม" value={date} onChange={(e) => { setDate(e.target.value); if (endDate < e.target.value) setEnd(e.target.value) }} /></label>
        <label className="small" style={{ display: 'grid', gap: 2 }}>วันสิ้นสุด<input className="input" type="date" aria-label="วันที่สิ้นสุดกิจกรรม" value={endDate} min={date} onChange={(e) => setEnd(e.target.value)} /></label>
        <button type="button" className="btn btn--gold" onClick={() => { const r = onAdd(name, date, endDate); if (r) setErr(r); else { setName(''); setErr('') } }}>เพิ่มกิจกรรม</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </details>
  )
}

/** ส่วนหัวของกิจกรรม: ชื่อ สถานะ วันที่เริ่ม */
export function ActHeader({ act, onReport }: { act: FundActivity; onReport?: () => void }) {
  const ended = actEnded(act, todayISO()), end = act.endDate ?? act.date
  return (
    <section className={`card actnote ${ended ? 'actnote--closed' : 'actnote--open'}`} aria-label={`กิจกรรม ${act.name}`} style={{ padding: '8px 14px' }}>
      <p style={{ margin: 0 }}><b style={{ fontSize: '1.15rem' }}>{act.name}</b> <span className="badge">{act.closed ? 'ปิดแล้ว' : ended ? 'สิ้นสุดแล้ว' : 'กำลังดำเนินการ'}</span></p>
      <p className="small" style={{ margin: '2px 0 0' }}>📅 เริ่มกิจกรรม {fmtDate(act.date)}{end !== act.date ? ` · สิ้นสุด ${fmtDate(end)}` : ''} · รวม {actDays(act)} วัน</p>
      {onReport && <button type="button" className="btn btn--ghost no-print" style={{ marginTop: 6 }} onClick={onReport}>🧾 รายงานสรุปกิจกรรม (พิมพ์ / PDF / แชร์)</button>}
    </section>
  )
}

/** แท็บ ความคืบหน้า: โน้ตกิจกรรม (เหตุผล อนุกรรมการ หมายเหตุ) + เป้าหมายของงาน ทำแล้ว/ยังไม่ทำ */
export function ActProgress({ act, canManage, locked, onSave, onGoals, onReport }: {
  act: FundActivity; canManage: boolean; locked: boolean; onReport?: () => void
  onSave: (patch: Partial<FundActivity>) => string | null
  onGoals: (goals: NonNullable<FundActivity['goals']>) => void
}) {
  const [edit, setEdit] = useState(false)
  const [d, setD] = useState({ name: act.name, date: act.date, endDate: act.endDate ?? act.date, purpose: act.purpose ?? '', committee: act.committee ?? '', note: act.note ?? '' })
  const [goal, setGoal] = useState('')
  const [err, setErr] = useState('')
  const gp = goalProgress(act)
  const can = canManage && !locked
  return (
    <>
      {onReport && <div className="no-print"><button type="button" className="btn btn--ghost" onClick={onReport}>🧾 รายงานความคืบหน้า (พิมพ์ / PDF / แชร์)</button></div>}
      <section className="card" aria-label="โน้ตกิจกรรม">
        {!edit ? (
          <>
            {act.purpose && <p style={{ margin: '0 0 4px', whiteSpace: 'pre-wrap' }}><b>เหตุผล / วัตถุประสงค์:</b> {act.purpose}</p>}
            {act.committee && <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}><b>อนุกรรมการกิจกรรม:</b> {act.committee}</p>}
            {act.note && <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}><b>หมายเหตุ:</b> {act.note}</p>}
            {!act.purpose && !act.committee && !act.note && <p className="muted small" style={{ margin: 0 }}>ยังไม่มีโน้ตของกิจกรรม{can ? ' — กด “แก้โน้ตกิจกรรม”' : ''}</p>}
            {can && <button type="button" className="btn btn--ghost no-print" style={{ marginTop: 8 }} onClick={() => setEdit(true)}>✏️ แก้โน้ตกิจกรรม</button>}
          </>
        ) : (
          <div className="no-print" role="group" aria-label="แก้โน้ตกิจกรรม">
            <div className="field"><label htmlFor="an-name">ชื่อกิจกรรม</label><input id="an-name" className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="an-date">วันที่เริ่มกิจกรรม</label><input id="an-date" className="input" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></div>
            <div className="field"><label htmlFor="an-end">วันสิ้นสุดกิจกรรม</label><input id="an-end" className="input" type="date" min={d.date} value={d.endDate} onChange={(e) => setD({ ...d, endDate: e.target.value })} /></div>
            <div className="field"><label htmlFor="an-purpose">เหตุผล / วัตถุประสงค์</label><textarea id="an-purpose" className="input" rows={2} value={d.purpose} onChange={(e) => setD({ ...d, purpose: e.target.value })} /></div>
            <div className="field"><label htmlFor="an-committee">อนุกรรมการกิจกรรม</label><textarea id="an-committee" className="input" rows={2} value={d.committee} placeholder="ชื่อผู้รับผิดชอบ / อนุกรรมการ" onChange={(e) => setD({ ...d, committee: e.target.value })} /></div>
            <div className="field"><label htmlFor="an-note">หมายเหตุ</label><textarea id="an-note" className="input" rows={2} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></div>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn--gold" onClick={() => { const r = onSave({ name: d.name.trim(), date: d.date, endDate: d.endDate && d.endDate !== d.date ? d.endDate : undefined, purpose: d.purpose.trim() || undefined, committee: d.committee.trim() || undefined, note: d.note.trim() || undefined }); if (r) setErr(r); else { setEdit(false); setErr('') } }}>บันทึก</button>
              <button type="button" className="btn btn--ghost" onClick={() => setEdit(false)}>ยกเลิก</button>
            </div>
          </div>
        )}
      </section>
      <section className="card" aria-label="เป้าหมายของงาน">
        <p style={{ margin: 0 }}><b>🎯 เป้าหมายของงาน</b> <span className="small muted">{gp.total ? `ทำแล้ว ${gp.done} จาก ${gp.total}` : 'ยังไม่มีเป้าหมาย'}</span></p>
        {gp.total > 0 && <Gauge value={gp.pct} label="ความคืบหน้า" text={`${gp.pct}%`} />}
        <ul className="list" style={{ marginTop: 6 }}>
          {(act.goals ?? []).map((g) => (
            <li key={g.id} style={{ alignItems: 'center' }}>
              <label className="grow" style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: g.done ? 0.65 : 1 }}>
                <input type="checkbox" checked={g.done} disabled={!can} onChange={() => onGoals(toggleGoal(act, g.id, todayISO()))} />
                <span style={{ textDecoration: g.done ? 'line-through' : 'none' }}>{g.text}{g.done && g.doneDate ? <span className="small muted"> · ทำแล้ว {fmtDate(g.doneDate)}</span> : null}</span>
              </label>
              {can && <button type="button" className="mini" aria-label={`ลบเป้าหมาย ${g.text}`} onClick={() => onGoals((act.goals ?? []).filter((x) => x.id !== g.id))}>🗑️</button>}
            </li>
          ))}
        </ul>
        {can && (
          <div className="row no-print" style={{ gap: 6 }}>
            <input className="input grow" aria-label="เป้าหมายใหม่" placeholder="เป้าหมาย/ขั้นตอน เช่น จองสถานที่" value={goal} onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.click() }} />
            <button type="button" className="btn btn--gold" onClick={() => { const r = addGoal(act, goal); if ('error' in r) setErr(r.error); else { onGoals(r); setGoal(''); setErr('') } }}>＋ เพิ่ม</button>
          </div>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </section>
    </>
  )
}

/** แท็บ การประเมินผล: ความพึงพอใจ 0–100 + ข้อดี/ข้อเสีย/สรุป · ปิด/เปิดกิจกรรม */
export function ActEvaluation({ act, canManage, onSaveEval, onClose, onReopen, onReport }: {
  act: FundActivity; canManage: boolean; onReport?: () => void
  onSaveEval: (e: ActEval) => void
  onClose: () => void
  onReopen: () => void
}) {
  const ev = act.eval
  const [score, setScore] = useState(ev?.score ?? 70)
  const [pros, setPros] = useState(ev?.pros ?? '')
  const [cons, setCons] = useState(ev?.cons ?? '')
  const [summary, setSummary] = useState(ev?.summary ?? '')
  const [saved, setSaved] = useState(false)
  return (
    <section className="card" aria-label="การประเมินผลกิจกรรม">
      {onReport && <div className="no-print" style={{ marginBottom: 6 }}><button type="button" className="btn btn--ghost" onClick={onReport}>🧾 รายงานการประเมินผล (พิมพ์ / PDF / แชร์)</button></div>}
      <p style={{ margin: 0 }}><b>⭐ การประเมินผล</b> <span className="small muted">ความพึงพอใจต่อกิจกรรม 0–100 (แสดงที่หน้าการ์ด)</span></p>
      {canManage ? (
        <>
          <label htmlFor="ev-score" style={{ display: 'block', marginTop: 6 }}><b>ความพึงพอใจ {score}/100</b></label>
          <input id="ev-score" type="range" min={0} max={100} step={1} value={score} onChange={(e) => { setScore(Number(e.target.value)); setSaved(false) }} style={{ width: '100%' }} />
          <Gauge value={score} label="ความพึงพอใจ" />
          <div className="field"><label htmlFor="ev-pros">ข้อดี / สิ่งที่ทำได้ดี</label><textarea id="ev-pros" className="input" rows={3} value={pros} onChange={(e) => { setPros(e.target.value); setSaved(false) }} placeholder="เช่น คนมาร่วมมาก อาหารพอดี" /></div>
          <div className="field"><label htmlFor="ev-cons">ข้อเสีย / ควรปรับปรุง</label><textarea id="ev-cons" className="input" rows={3} value={cons} onChange={(e) => { setCons(e.target.value); setSaved(false) }} placeholder="เช่น ที่จอดรถไม่พอ" /></div>
          <div className="field"><label htmlFor="ev-sum">สรุปสั้น ๆ (แสดงที่การ์ด)</label><input id="ev-sum" className="input" value={summary} onChange={(e) => { setSummary(e.target.value); setSaved(false) }} placeholder="เช่น คนมาร่วมมาก อาหารพอดี" /></div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--gold" onClick={() => { onSaveEval({ score, pros: pros.trim() || undefined, cons: cons.trim() || undefined, summary: summary.trim() || undefined }); setSaved(true) }}>บันทึกการประเมิน</button>
            {act.closed ? <button type="button" className="btn btn--ghost" onClick={onReopen}>↺ เปิดกิจกรรมอีกครั้ง</button> : <button type="button" className="btn btn--ghost" onClick={onClose}>✔ ปิดกิจกรรม</button>}
          </div>
          {saved && <p className="ok" role="status" style={{ margin: '4px 0 0' }}>บันทึกการประเมินแล้ว</p>}
          <p className="muted small" style={{ margin: '4px 0 0' }}>ปิดกิจกรรมแล้วจะบันทึกรับ-จ่ายของกิจกรรมนี้เพิ่มไม่ได้ และการ์ดเปลี่ยนเป็นสีเทา (เปิดอีกครั้งได้)</p>
        </>
      ) : ev ? (
        <>
          <Gauge value={ev.score} label="ความพึงพอใจ" />
          {ev.pros && <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}><b>ข้อดี:</b> {ev.pros}</p>}
          {ev.cons && <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}><b>ข้อเสีย / ควรปรับปรุง:</b> {ev.cons}</p>}
          {ev.summary && <p style={{ margin: '4px 0 0' }}><b>สรุป:</b> {ev.summary}</p>}
        </>
      ) : <p className="muted small">ยังไม่มีการประเมิน</p>}
    </section>
  )
}

/** ตัวช่วยแบ่งกองทุนเป็นกิจกรรม (แอดมิน): ตั้งกิจกรรม แล้วเลือกว่าหมวดเดิมแต่ละหมวดอยู่ในกิจกรรมไหน หรือเป็นตัวกิจกรรมเอง */
export function ActivityWizard({ cats, onApply, onCancel }: {
  cats: { id: string; name: string; defDate: string }[]
  onApply: (rows: WizRow[], map: Record<string, string>) => string | null
  onCancel: () => void
}) {
  const initRows = (): WizRow[] => {
    const own = cats.filter((c) => looksLikeActivity(c.name)).map((c) => ({ key: `s-${c.id}`, name: c.name, date: c.defDate, selfSub: c.id }))
    return own.length ? own : [{ key: 'r0', name: 'กิจกรรมแรก', date: cats[0]?.defDate ?? todayISO() }]
  }
  const [rows, setRows] = useState<WizRow[]>(initRows)
  const [map, setMap] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const others = cats.filter((c) => !rows.some((r) => r.selfSub === c.id))
  const upd = (key: string, patch: Partial<WizRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <section className="card no-print" role="group" aria-label="แบ่งกองทุนเป็นกิจกรรม">
      <b>🗓️ แบ่งกองทุนนี้เป็นกิจกรรม</b>
      <p className="small muted" style={{ margin: '4px 0' }}>เปิดแล้วหน้ากองทุนจะขึ้น “การ์ดกิจกรรม” ก่อน (ใหม่อยู่บนสุด) กดการ์ดเข้าไปจึงเห็นบัญชี ความคืบหน้า และประเมินผลของกิจกรรมนั้น · รายการรับ-จ่ายเดิมไม่หาย</p>
      {cats.some((c) => rows.some((r) => r.selfSub === c.id)) && <p className="small" style={{ margin: '4px 0' }}>หมวดที่ชื่อเป็นกิจกรรม (เช่น วันคริสต์มาส) ระบบแปลงให้เป็นกิจกรรมแล้ว — เงินเดิมของหมวดนั้นอยู่ในหมวด “รายการทั่วไป” ของกิจกรรม</p>}
      {rows.map((r, i) => (
        <div key={r.key} className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
          <input className="input grow" aria-label={`ชื่อกิจกรรมที่ ${i + 1}`} value={r.name} onChange={(e) => upd(r.key, { name: e.target.value })} />
          <label className="small" style={{ display: 'grid', gap: 2 }}>วันเริ่ม<input className="input" type="date" aria-label={`วันเริ่มกิจกรรมที่ ${i + 1}`} value={r.date} onChange={(e) => upd(r.key, { date: e.target.value })} /></label>
          <label className="small" style={{ display: 'grid', gap: 2 }}>วันสิ้นสุด<input className="input" type="date" aria-label={`วันสิ้นสุดกิจกรรมที่ ${i + 1}`} min={r.date} value={r.endDate ?? r.date} onChange={(e) => upd(r.key, { endDate: e.target.value })} /></label>
          {!r.selfSub && rows.length > 1 && <button type="button" className="mini" aria-label={`ลบกิจกรรมที่ ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>🗑️</button>}
        </div>
      ))}
      <button type="button" className="btn btn--ghost" onClick={() => setRows((rs) => [...rs, { key: `n${Date.now()}`, name: '', date: todayISO() }])}>＋ เพิ่มอีกกิจกรรม</button>
      {others.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <b className="small">หมวดเดิมอยู่ในกิจกรรมไหน</b>
          {others.map((c) => (
            <div key={c.id} className="row" style={{ gap: 6, alignItems: 'center', margin: '4px 0' }}>
              <span className="grow">{c.name}</span>
              <select className="input" style={{ maxWidth: '55%' }} aria-label={`กิจกรรมของหมวด ${c.name}`} value={map[c.id] ?? sorted[0]?.key} onChange={(e) => setMap({ ...map, [c.id]: e.target.value })}>
                {sorted.map((r) => <option key={r.key} value={r.key}>{r.name || '(ยังไม่ตั้งชื่อ)'}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <button type="button" className="btn btn--gold" onClick={() => { const m = { ...map }; for (const c of others) m[c.id] = m[c.id] ?? sorted[0]?.key; const r = onApply(rows, m); if (r) setErr(r) }}>เปิดโหมดกิจกรรม</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>ยกเลิก</button>
      </div>
    </section>
  )
}
