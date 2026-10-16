import { useEffect, useRef, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import Sheet from './Sheet'
import { dow, fmtDateLong, todayISO, yearOf } from '../lib/money'
import { ageText, checkInId, nameKey, NEW_PERSON_STATUS, similarNames, statusLabel, uniqueId } from '../lib/registry'
import { uploadMemberPhoto } from '../lib/memberPhoto'
import type { CheckIn, ChurchMember, Recorder } from '../lib/types'

const REC_KEY = 'acct.recorder'
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const getRec = () => { try { return localStorage.getItem(REC_KEY) ?? '' } catch { return '' } }

/**
 * หน้าลงชื่อนมัสการหน้างาน
 * - เลือก "ผู้บันทึกของเครื่องนี้" (รายชื่อที่แอดมินตั้งไว้) → ทุกรายการลงชื่อมีชื่อผู้บันทึกและเวลา
 * - แตะ "ลงชื่อ" = บันทึกคนนั้นทันที (1 คน × 1 วัน) · ถ้าลงไปแล้วโดยเครื่องอื่น: ขึ้นเตือนว่าใครลง กี่โมง และไม่ลงซ้ำ
 * - คนใหม่: รูป + ชื่อ-นามสกุล (+ กรอบข้อมูลเสริม) · ชื่อคล้ายกับที่มีอยู่ ถามก่อนว่าใช่คนเดิมไหม
 */
export default function CheckinPanel({ members, checkins, recorders, canManage, putCheckIns, syncNow, addMember, putRecorders, removeRecorder, onOpen, minYear }: {
  members: ChurchMember[]
  checkins: CheckIn[]
  recorders: Recorder[]
  canManage: boolean
  putCheckIns: (x: CheckIn[]) => boolean
  syncNow: () => Promise<void>
  addMember: (x: ChurchMember[]) => boolean
  putRecorders: (x: Recorder[]) => boolean
  removeRecorder: (id: string) => boolean
  onOpen: (id: string) => void
  minYear: number
}) {
  const [date, setDate] = useState(todayISO) // เปิดมาเป็นวันนี้ทันที · เลือกวันอื่นได้
  const [q, setQ] = useState('')
  const [rec, setRec] = useState(getRec) // รหัสผู้บันทึกที่เลือกไว้ (จำในเครื่องจนกว่าจะเปลี่ยนเอง) · ค่าเก่าที่เป็นชื่อก็อ่านได้
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<'' | 'done' | 'todo' | 'all'>('') // ว่าง = ค่าเริ่มต้น: เฉพาะคนที่ลงแล้วในวันที่เลือก
  const [manage, setManage] = useState(false)
  const latest = useRef(checkins)
  latest.current = checkins
  const picked = recorders.find((r) => r.id === rec) ?? recorders.find((r) => r.name === rec)
  const recorder = picked?.name ?? ''
  const pickRec = (id: string) => { setRec(id); try { localStorage.setItem(REC_KEY, id) } catch { /* ignore */ } }
  // มีผู้บันทึกคนเดียว = เลือกให้เลย · ไม่ล้างค่าที่เลือกไว้แม้รายชื่อกำลังโหลด/ซิงก์ (กันต้องเลือกใหม่ทุกครั้ง)
  useEffect(() => { if (!picked && recorders.length === 1) pickRec(recorders[0].id) }, [picked?.id, recorders.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayISO()
  const tooOld = yearOf(date) < minYear || yearOf(date) > yearOf(today)
  const of = (d: string) => new Map(latest.current.filter((c) => c.date === d && !c.deleted).map((c) => [c.mid, c]))
  const done = of(date)
  const living = members.filter((m) => !/เสียชีวิต|สิ้นสภาพ/.test(m.status ?? ''))
  const byId = new Map(members.map((m) => [m.id, m]))
  const doneMembers = [...done.keys()].map((id) => byId.get(id)).filter((m): m is ChurchMember => !!m) // คนที่ลงแล้ว (ไม่ว่าสถานะใด)
  const count = doneMembers.length
  const todoMembers = living.filter((m) => !done.has(m.id))
  const t = q.trim().toLowerCase().replace(/\s+/g, '')
  // ค้นหาชื่อ = ค้นทั้งทะเบียน (ไว้หาคนที่มาแล้วยังไม่ได้ลง) · ไม่ค้น = ตามตัวเลือกด้านบน (ค่าเริ่มต้น: แสดงเฉพาะคนที่มาในวันที่เลือก)
  const mode = t ? 'all' : view || 'done'
  const pool = mode === 'done' ? doneMembers : mode === 'todo' ? todoMembers : [...new Map([...doneMembers, ...living].map((m) => [m.id, m])).values()]
  const shown = (t ? pool.filter((m) => `${m.name}${m.nick ?? ''}${m.code ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t)) : pool).sort((a, b) => a.name.localeCompare(b.name, 'th'))
  /** ลงชื่อ 1 คน: ซิงก์ก่อน (เห็นรายการของเครื่องอื่น) แล้วเช็กซ้ำอีกครั้งก่อนเขียน */
  const record = async (mid: string, who = '') => {
    if (!recorder) return setMsg({ text: 'เลือก “ผู้บันทึกของเครื่องนี้” ก่อนลงชื่อ', bad: true })
    if (tooOld) return setMsg({ text: 'วันที่นี้อยู่นอกช่วงที่บันทึกได้', bad: true })
    const name = who || byId.get(mid)?.name || ''
    await syncNow()
    await new Promise((r) => setTimeout(r, 60)) // ให้ข้อมูลที่เพิ่งซิงก์เข้าหน้าจอก่อน
    const dup = of(date).get(mid)
    if (dup) return setMsg({ text: `“${name}” ลงชื่อแล้ว โดย ${dup.rec ?? 'ไม่ระบุผู้บันทึก'}${dup.tm ? ` เวลา ${dup.tm}` : ''} — ไม่ลงซ้ำ`, bad: true })
    if (putCheckIns([{ id: checkInId(date, mid), date, mid, tm: nowHM(), rec: recorder, updated: 0 }])) setMsg({ text: `ลงชื่อ “${name}” แล้ว` })
  }
  const cancel = (c: CheckIn) => {
    const name = byId.get(c.mid)?.name ?? ''
    if (!confirm(`ยกเลิกการลงชื่อของ ${name}?\n(ลงโดย ${c.rec ?? 'ไม่ระบุ'}${c.tm ? ` เวลา ${c.tm}` : ''} · จะบันทึกว่า ${recorder || 'ไม่ระบุ'} เป็นผู้ยกเลิก)`)) return
    if (putCheckIns([{ ...c, deleted: true, delBy: recorder || undefined }])) setMsg({ text: `ยกเลิกการลงชื่อของ “${name}” แล้ว` })
  }

  return (
    <section className="card">
      <div className="formgrid">
        <div className="field full" aria-label="ผู้บันทึก">
          <label htmlFor="ck-rec">ผู้บันทึกของเครื่องนี้ <span className="muted">· จำไว้จนกว่าจะเปลี่ยน</span></label>
          <div style={{ display: 'grid', gridTemplateColumns: canManage ? 'minmax(0, 1fr) auto' : '1fr', gap: '0.5rem' }}>
            <select id="ck-rec" className="input" value={picked?.id ?? ''} onChange={(e) => pickRec(e.target.value)}>
              <option value="">— เลือกผู้บันทึก —</option>
              {recorders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {canManage && <button type="button" className="mini" style={{ minHeight: 'var(--tap)' }} onClick={() => setManage(!manage)}>{manage ? 'ปิด' : 'จัดการ'}</button>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ck-date">วันนมัสการ</label>
          <input id="ck-date" className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setMsg(null); setView('') }} />
        </div>
        <div className="field">
          <label htmlFor="ck-q">ค้นหาชื่อ</label>
          <input id="ck-q" className="input" placeholder="ชื่อ / ชื่อเล่น / รหัส" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาชื่อ" />
        </div>
      </div>
      {recorders.length === 0 && <p className="small" role="note" style={{ color: 'var(--bad)', margin: 0 }}>ยังไม่มีรายชื่อผู้บันทึก — {canManage ? 'กด “จัดการ” เพื่อเพิ่มชื่อผู้ช่วยงานก่อนเริ่มลงชื่อ' : 'ให้แอดมินเพิ่มรายชื่อผู้บันทึกก่อน'}</p>}
      {manage && canManage && <RecorderManager recorders={recorders} put={putRecorders} remove={removeRecorder} />}

      <div className="row row--between" style={{ flexWrap: 'nowrap' }}>
        <b style={{ minWidth: 0 }}>{fmtDateLong(date)}</b>
        {date !== today && <button type="button" className="mini" onClick={() => { setDate(today); setMsg(null); setView('') }}>วันนี้</button>}
      </div>
      {dow(date) !== 0 && <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>ไม่ใช่วันอาทิตย์ — ถ้าเป็นการนมัสการพิเศษก็บันทึกได้</p>}
      {tooOld && <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>บันทึกได้เฉพาะปี {minYear + 543}–{yearOf(today) + 543}</p>}

      <div className="row row--between" style={{ flexWrap: 'nowrap' }}>
        <span>ลงชื่อแล้ว <b style={{ fontSize: '1.3rem' }}>{count}</b> คน</span>
        <button type="button" className="btn btn--gold" onClick={() => setAdding(true)} disabled={!recorder}>＋ คนใหม่</button>
      </div>
      <div className="seg seg--3 no-print" role="group" aria-label="ตัวเลือกรายชื่อ">
        {([['done', `ที่มา ${count}`, `ที่มาวันนี้ · ${count}`], ['todo', `ยังไม่ลง ${todoMembers.length}`, `ยังไม่ได้ลง · ${todoMembers.length}`], ['all', `ทั้งหมด ${new Set([...doneMembers, ...living].map((m) => m.id)).size}`, `ทั้งหมด · ${new Set([...doneMembers, ...living].map((m) => m.id)).size}`]] as const).map(([k, l, aria]) => <button key={k} type="button" className={mode === k ? 'on' : ''} aria-label={aria} aria-pressed={mode === k} onClick={() => { setView(k); setQ('') }}>{l}</button>)}
      </div>
      {t && <p className="pagehint">กำลังค้นหาทั้งทะเบียน — ล้างช่องค้นหาเพื่อกลับไปดูตามตัวเลือกด้านบน</p>}
      {msg && <p className="small" role="status" style={{ margin: 0, color: msg.bad ? 'var(--bad)' : undefined, fontWeight: msg.bad ? 700 : undefined }}>{msg.text}</p>}
      {living.length === 0 && count === 0 ? <p className="empty">ยังไม่มีสมาชิกในทะเบียน</p> : shown.length === 0 ? <p className="empty">{mode === 'done' ? 'ยังไม่มีใครลงชื่อในวันนี้ — ค้นหาชื่อ หรือกด “ทั้งหมด” เพื่อเริ่มลงชื่อ' : mode === 'todo' ? 'ทุกคนลงชื่อแล้ว' : 'ไม่พบรายชื่อ'}</p> : (
        <ul className="list" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          {shown.map((m) => {
            const c = done.get(m.id)
            return (
              <li key={m.id}>
                <div className="mrow">
                  <MemberAvatar path={m.photoPath} name={m.name} size={56} />
                  <button type="button" className="mrow__main" style={{ all: 'unset', cursor: 'pointer', minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.4 }} onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                    <span className="mrow__name">{m.name}</span>{m.nick ? <span className="muted"> ({m.nick})</span> : null}
                    <br /><span className="mrow__meta">{[statusLabel(m.status), m.gender, m.birth && ageText(m.birth, today)].filter(Boolean).join(' · ')}</span>
                    {c && <><br /><span className="mrow__ok">✓ ลงแล้ว · {c.rec ?? '—'}{c.tm ? ` · ${c.tm}` : ''}</span></>}
                  </button>
                  <div className="mrow__act">
                    {c
                      ? <button type="button" className="mini" onClick={() => cancel(c)}>ยกเลิก</button>
                      : <button type="button" className="btn" disabled={!recorder || tooOld} onClick={() => record(m.id)} aria-label={`ลงชื่อ ${m.name}`}>ลงชื่อ</button>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {adding && <NewPerson members={members} date={date} onClose={() => setAdding(false)} onSave={async (mem, fixName) => {
        const ok = mem ? addMember([mem]) : true
        if (!ok) return
        if (fixName) { const m0 = byId.get(fixName.id); if (m0) addMember([{ ...m0, name: fixName.name }]) }
        setAdding(false)
        await record(mem?.id ?? fixName!.id, mem?.name ?? fixName!.name)
      }} />}
    </section>
  )
}

function RecorderManager({ recorders, put, remove }: { recorders: Recorder[]; put: (x: Recorder[]) => boolean; remove: (id: string) => boolean }) {
  const [name, setName] = useState('')
  const add = () => { const n = name.trim().replace(/\s+/g, ' '); if (!n) return; if (recorders.some((r) => nameKey(r.name) === nameKey(n))) return setName(''); if (put([{ id: uniqueId(new Set(recorders.map((r) => r.id)), 'rc'), name: n, updated: 0 }])) setName('') }
  return (
    <div className="card" aria-label="จัดการผู้บันทึก">
      <p className="small muted" style={{ margin: 0 }}>ผู้ช่วยงานที่ลงชื่อได้ (ไม่ต้องมีบัญชีในแอป) · เพิ่ม แก้ชื่อ หรือลบได้ตลอด รายการที่ลงไปแล้วยังเก็บชื่อเดิมไว้</p>
      <ul className="list">
        {recorders.map((r) => (
          <li key={r.id}><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', width: '100%' }}>
            <input className="input" defaultValue={r.name} aria-label={`ชื่อผู้บันทึก ${r.name}`} onBlur={(e) => { const v = e.target.value.trim().replace(/\s+/g, ' '); if (v && v !== r.name) put([{ ...r, name: v }]); else e.target.value = r.name }} />
            <button type="button" className="mini" onClick={() => confirm(`ลบ “${r.name}” ออกจากรายชื่อผู้บันทึก?`) && remove(r.id)}>ลบ</button>
          </div></li>
        ))}
      </ul>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem' }}><input className="input" placeholder="ชื่อผู้บันทึกใหม่" value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อผู้บันทึกใหม่" onKeyDown={(e) => e.key === 'Enter' && add()} /><button type="button" className="btn btn--ghost" disabled={!name.trim()} onClick={add}>＋ เพิ่ม</button></div>
    </div>
  )
}

/** คนใหม่หน้างาน: รูป + ชื่อ-นามสกุล เป็นหลัก · กรอบข้อมูลเสริม · วันที่เริ่มมา/วันเกิดแก้ภายหลังได้ */
function NewPerson({ members, date, onClose, onSave }: {
  members: ChurchMember[]
  date: string
  onClose: () => void
  /** mem = สมาชิกใหม่ที่ต้องเพิ่ม (ว่างถ้าเลือกคนเดิม) · fixName = แก้ชื่อคนเดิมเป็นตัวสะกดที่เพิ่งพิมพ์ */
  onSave: (mem: ChurchMember | null, fixName?: { id: string; name: string }) => Promise<void>
}) {
  const [f, setF] = useState({ name: '', nick: '', gender: '', tel: '', birth: '', since: date, note: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const name = f.name.trim().replace(/\s+/g, ' ')
  const similar = similarNames(name, members)
  const exact = similar.find((s) => s.exact)
  const preview = photo ? URL.createObjectURL(photo) : ''
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const save = async () => {
    if (!name) return setErr('ใส่ชื่อ-นามสกุล')
    if (f.birth && f.birth > todayISO()) return setErr('วันเกิดต้องไม่เกินวันนี้')
    setBusy(true); setErr('')
    const id = uniqueId(new Set(members.map((m) => m.id)))
    let photoPath: string | undefined
    try { if (photo) photoPath = await uploadMemberPhoto(id, photo) } catch (e) { setBusy(false); return setErr(`${e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ'} — แก้ปัญหาแล้วลองใหม่ หรือกดบันทึกโดยไม่ใส่รูป (เพิ่มรูปภายหลังได้)`) }
    const mem: ChurchMember = { id, name, status: NEW_PERSON_STATUS, since: f.since || date, updated: 0, ...(f.nick.trim() ? { nick: f.nick.trim() } : {}), ...(f.gender === 'ชาย' || f.gender === 'หญิง' ? { gender: f.gender } : {}), ...(f.tel.trim() ? { tel: f.tel.trim() } : {}), ...(f.birth ? { birth: f.birth } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}), ...(photoPath ? { photoPath } : {}) }
    await onSave(mem)
    setBusy(false)
  }
  return (
    <Sheet title="คนใหม่ที่ยังไม่มีในทะเบียน" onClose={onClose}>
      <div className="avatar-pick">
        {preview ? <img src={preview} alt="รูปที่เลือก" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 14, flex: 'none' }} /> : <MemberAvatar name={f.name || '?'} size={72} />}
        <div style={{ minWidth: 0 }}>
          <label className="btn btn--ghost" style={{ cursor: 'pointer' }}>📷 {photo ? 'เปลี่ยนรูป' : 'ถ่าย / เลือกรูป'}<input hidden type="file" accept="image/*" capture="environment" aria-label="รูปคนใหม่" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
          <p className="pagehint" style={{ marginTop: 4 }}>รูปช่วยจำหน้า (ไม่บังคับ)</p>
        </div>
      </div>
      <div className="formgrid">
        <div className="field full"><label htmlFor="np-name">ชื่อ-นามสกุล (สำคัญที่สุด)</label><input id="np-name" className="input" value={f.name} onChange={set('name')} autoFocus /></div>
        {similar.length > 0 && (
          <div className="card full" role="alert" aria-label="ชื่อคล้ายกับที่มีอยู่">
            <p style={{ margin: 0, fontWeight: 700 }}>{exact ? 'มีชื่อนี้ในทะเบียนแล้ว' : 'มีชื่อคล้ายกันในทะเบียน'} — ใช่คนเดียวกันไหม?</p>
            <ul className="list">
              {similar.map(({ member: m }) => (
                <li key={m.id}><div className="mrow mrow--stack">
                  <MemberAvatar path={m.photoPath} name={m.name} size={52} />
                  <div className="mrow__main"><span className="mrow__name">{m.name}</span>{m.nick ? <span className="muted"> ({m.nick})</span> : null}<br /><span className="mrow__meta">{[m.code && `#${m.code}`, statusLabel(m.status)].filter(Boolean).join(' · ')}</span></div>
                  <div className="mrow__act">
                    <button type="button" className="mini" disabled={busy} onClick={async () => { setBusy(true); await onSave(null, { id: m.id, name: m.name }); setBusy(false) }}>ใช่ ลงชื่อให้คนนี้</button>
                    {nameKey(m.name) !== nameKey(name) && <button type="button" className="mini" disabled={busy} onClick={async () => { setBusy(true); await onSave(null, { id: m.id, name }); setBusy(false) }}>ใช่ และแก้ชื่อเป็น “{name}”</button>}
                  </div>
                </div></li>
              ))}
            </ul>
            <p className="pagehint">ถามเจ้าตัวว่าสะกดชื่อ-นามสกุลอย่างไร แล้วเลือกให้ตรง</p>
          </div>
        )}
        <div className="field"><label htmlFor="np-nick">ชื่อเล่น</label><input id="np-nick" className="input" value={f.nick} onChange={set('nick')} /></div>
        <div className="field"><label htmlFor="np-gender">เพศ</label><select id="np-gender" className="input" value={f.gender} onChange={set('gender')}><option value="">— ไม่ระบุ —</option><option>ชาย</option><option>หญิง</option></select></div>
        <div className="field"><label htmlFor="np-tel">โทรศัพท์</label><input id="np-tel" className="input" type="tel" value={f.tel} onChange={set('tel')} /></div>
        <div className="field"><label htmlFor="np-birth">วันเกิด{f.birth ? ` · อายุ ${ageText(f.birth, todayISO())}` : ''}</label><input id="np-birth" className="input" type="date" value={f.birth} onChange={set('birth')} /></div>
        <div className="field full"><label htmlFor="np-since">วันที่เริ่มมา (ครั้งแรกที่เข้าร่วม · แก้ภายหลังได้)</label><input id="np-since" className="input" type="date" value={f.since} onChange={set('since')} /></div>
        <div className="field full"><label htmlFor="np-note">หมายเหตุ</label><input id="np-note" className="input" value={f.note} onChange={set('note')} /></div>
      </div>
      {err && <p role="alert" style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>}
      <button type="button" className="btn btn--gold btn--block" disabled={busy || !name || !!exact} onClick={save}>{busy ? 'กำลังบันทึก…' : similar.length ? 'ไม่ใช่ — เพิ่มเป็นคนใหม่และลงชื่อ' : 'เพิ่มคนใหม่และลงชื่อ'}</button>
    </Sheet>
  )
}
