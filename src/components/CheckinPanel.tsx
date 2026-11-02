import { useEffect, useMemo, useRef, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import WeekStrip from './WeekStrip'
import PhotoAvatar from './PhotoAvatar'
import { weekDates } from '../lib/attendanceWeeks'
import Sheet from './Sheet'
import { dow, fmtDateLong, todayISO, yearOf } from '../lib/money'
import { ageText, checkInId, isFirstTimer, nameKey, NEW_PERSON_STATUS, similarNames, statusLabel, uniqueId } from '../lib/registry'
import { uploadMemberPhoto } from '../lib/memberPhoto'
import { clearEtagCache, SYNC_EVENT } from '../lib/sync'
import { useGlobalSync } from '../lib/syncStatus'
import { OPEN_RECORDER, useRecorderPick } from '../lib/recorderPick'
import { serviceReport } from '../lib/serviceReport'
import ShareReportSheet from './ShareReportSheet'
import type { CheckIn, ChurchMember, Recorder } from '../lib/types'

const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/**
 * หน้าลงชื่อนมัสการหน้างาน
 * - เลือก "ผู้บันทึกของเครื่องนี้" (รายชื่อที่แอดมินตั้งไว้) → ทุกรายการลงชื่อมีชื่อผู้บันทึกและเวลา
 * - แตะ "ลงชื่อ" = บันทึกคนนั้นทันที (1 คน × 1 วัน) · ถ้าลงไปแล้วโดยเครื่องอื่น: ขึ้นเตือนว่าใครลง กี่โมง และไม่ลงซ้ำ
 * - คนใหม่: รูป + ชื่อ-นามสกุล (+ กรอบข้อมูลเสริม) · ชื่อคล้ายกับที่มีอยู่ ถามก่อนว่าใช่คนเดิมไหม
 */
export default function CheckinPanel({ lite, readOnly, canPhoto, showStatus, members, checkins, recorders, putCheckIns, syncNow, addMember, onOpen, onEdit, minYear }: {
  lite: boolean
  /** ผู้ช่วยฝ่ายทะเบียน: ลงชื่อ/ลบรายการลงชื่อ/เพิ่มคนที่มาครั้งแรกได้ แต่แก้ข้อมูลสมาชิกที่มีอยู่ไม่ได้ (ซ่อนปุ่มแก้ไข) */
  readOnly?: boolean
  showStatus?: boolean
  /** แตะที่รูปเพื่อเพิ่ม/เปลี่ยนรูปได้ */
  canPhoto?: boolean
  members: ChurchMember[]
  checkins: CheckIn[]
  recorders: Recorder[]
  putCheckIns: (x: CheckIn[]) => boolean
  syncNow: () => Promise<void>
  addMember: (x: ChurchMember[]) => boolean
  onOpen: (id: string) => void
  /** เปิดฟอร์มแก้ไขข้อมูลคนนั้น (แก้ชื่อ รูป เพศ ฯลฯ) */
  onEdit: (id: string) => void
  minYear: number
}) {
  const [date, setDate] = useState(todayISO) // เปิดมาเป็นวันนี้ทันที · เลือกวันอื่นได้
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [adding, setAdding] = useState(false)
  const [sharing, setSharing] = useState(false) // ป๊อปอัพตรวจข้อความก่อนแชร์
  const [askDel, setAskDel] = useState<CheckIn | null>(null) // การ์ดที่กำลังจะลบ (รอยืนยันในป๊อปอัพ)
  const [justId, setJustId] = useState('') // คนที่เพิ่งลงชื่อ: ไฮไลต์การ์ดสั้น ๆ ในรายการด้านล่าง
  const doneRef = useRef<HTMLUListElement>(null)
  const g = useGlobalSync()
  useEffect(() => { void syncNow() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- เปิดหน้าลงชื่อ = ดึงรายชื่อล่าสุดทันที
  const latest = useRef(checkins)
  latest.current = checkins
  const { picked } = useRecorderPick(recorders)
  const recorder = picked?.name ?? ''

  const today = todayISO()
  const tooOld = yearOf(date) < minYear || yearOf(date) > yearOf(today)
  const of = (d: string) => new Map(latest.current.filter((c) => c.date === d && !c.deleted).map((c) => [c.mid, c]))
  const done = of(date)
  const living = members.filter((m) => !/เสียชีวิต|สิ้นสภาพ/.test(m.status ?? ''))
  const byId = new Map(members.map((m) => [m.id, m]))
  const doneMembers = [...done.keys()].map((id) => byId.get(id)).filter((m): m is ChurchMember => !!m) // คนที่ลงแล้ว (ไม่ว่าสถานะใด)
  const t = q.trim().toLowerCase().replace(/\s+/g, '')
  // พิมพ์ค้นหา = ค้นทั้งทะเบียนทันที · ชื่อขึ้นต้นตรงกับที่พิมพ์มาก่อน แล้วค่อยตามตัวอักษร
  const key = (m: ChurchMember) => m.name.toLowerCase().replace(/\s+/g, '')
  const everyone = [...new Map([...doneMembers, ...living].map((m) => [m.id, m])).values()]
  const shown = (t ? everyone.filter((m) => `${m.name}${m.nick ?? ''}${m.code ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t)) : [])
    .sort((a, b) => Number(key(b).startsWith(t)) - Number(key(a).startsWith(t)) || a.name.localeCompare(b.name, 'th'))
  // คนที่ลงแล้ววันนี้ เรียงตามลำดับที่ลง (คนล่าสุดอยู่บน) · เลขลำดับ = ลำดับที่มา
  const stamp = (c: CheckIn) => c.updated || 0
  const doneRows = [...done.values()].filter((c) => byId.has(c.mid)).sort((a, b) => stamp(a) - stamp(b) || (a.tm ?? '').localeCompare(b.tm ?? ''))
  const doneNewestFirst = [...doneRows].reverse()
  const dayCounts = new Map<string, number>()
  for (const c of checkins) if (!c.deleted) dayCounts.set(c.date, (dayCounts.get(c.date) ?? 0) + 1)
  const weeks = weekDates([...dayCounts.keys()], today)
  /** ลงชื่อ 1 คน: ซิงก์ก่อน (เห็นรายการของเครื่องอื่น) แล้วเช็กซ้ำอีกครั้งก่อนเขียน · true = ลงสำเร็จ */
  const record = async (mid: string, who = ''): Promise<boolean> => {
    if (!recorder) { window.dispatchEvent(new Event(OPEN_RECORDER)); setMsg({ text: 'เลือกผู้บันทึกของเครื่องนี้ก่อนลงทะเบียน', bad: true }); return false }
    if (tooOld) { setMsg({ text: 'วันที่นี้อยู่นอกช่วงที่บันทึกได้', bad: true }); return false }
    const name = who || byId.get(mid)?.name || ''
    await syncNow()
    await new Promise((r) => setTimeout(r, 60)) // ให้ข้อมูลที่เพิ่งซิงก์เข้าหน้าจอก่อน
    const dup = of(date).get(mid)
    if (dup) { setMsg({ text: `“${name}” ลงชื่อแล้ว โดย ${dup.rec ?? 'ไม่ระบุผู้บันทึก'}${dup.tm ? ` เวลา ${dup.tm}` : ''} — ไม่ลงซ้ำ`, bad: true }); return false }
    if (putCheckIns([{ id: checkInId(date, mid), date, mid, tm: nowHM(), rec: recorder, updated: 0 }])) {
      setMsg({ text: `ลงชื่อ “${name}” แล้ว` })
      setJustId(mid)
      window.setTimeout(() => doneRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }), 80)   // พาไปเห็นการ์ดที่เพิ่งลงชื่อในรายการด้านล่าง (คนล่าสุดอยู่บน)
      window.setTimeout(() => setJustId(''), 2500)
      return true
    }
    setMsg({ text: `ลงชื่อ “${name}” ไม่สำเร็จ — ไม่มีสิทธิ์บันทึก หรือข้อมูลยังซิงก์ไม่เสร็จ ลองกด “กดรีเฟรชเพื่ออัปเดต” แล้วลงใหม่`, bad: true })
    return false
  }
  const doDelete = (c: CheckIn) => {
    const name = byId.get(c.mid)?.name ?? ''
    if (!recorder) { setAskDel(null); window.dispatchEvent(new Event(OPEN_RECORDER)); return }
    if (putCheckIns([{ ...c, deleted: true, delBy: recorder }])) setMsg({ text: `ลบการลงชื่อของ “${name}” แล้ว` })
    setAskDel(null)
  }
  /** สรุปผู้มาของวันที่เลือก: เปิดป๊อปอัพให้ตรวจข้อความก่อน แล้วค่อยกดแชร์ไป LINE/Messenger/Facebook */
  const report = serviceReport(checkins, members, date)
  // ลงชื่อครั้งแรกในระบบวันนี้ = คนใหม่ (นับแบบเดียวกับรายงานนมัสการ) → ป้าย NEW + ตัวเลขสีต่างจากคนอื่น
  const firstDay = useMemo(() => { const f = new Map<string, string>(); for (const c of checkins) if (!c.deleted && c.mid && (f.get(c.mid) ?? '9999') > c.date) f.set(c.mid, c.date); return f }, [checkins])
  const registerFrom = async (m: ChurchMember) => { if (await record(m.id) && t) setQ('') } // ลงแล้วล้างช่องค้นหา พร้อมคนถัดไป

  /** การ์ดผลค้นหา: รูป ชื่อ และปุ่มลงทะเบียน */
  const row = (m: ChurchMember) => {
    const c = done.get(m.id)
    return (
      <li key={m.id}>
        <div className="pick pick--card">
          <PhotoAvatar member={m} size={76} canPhoto={canPhoto} put={addMember} />
          <button type="button" className="pick__main" onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
            <span className="mrow__name">{m.name}</span>{m.nick ? <span className="muted"> ({m.nick})</span> : null}
            <span className="mrow__meta" style={{ display: 'block' }}>{[lite && !showStatus ? undefined : statusLabel(m.status), m.gender, m.group, !lite && m.birth && ageText(m.birth, today)].filter(Boolean).join(' · ')}</span>
            {c && <span className="mrow__ok" style={{ display: 'block' }}>✓ ลงแล้ว · {c.rec ?? '—'}{c.tm ? ` · ${c.tm}` : ''}</span>}
            {m.note?.trim() && <span className="cardNote">หมายเหตุ: {m.note.trim()}</span>}
          </button>
          {c
            ? <span className="pick__act mrow__ok" style={{ textAlign: 'center', minHeight: '3rem', display: 'grid', placeItems: 'center' }}>✓ ลงชื่อแล้ววันนี้</span>
            : <button type="button" className="btn btn--gold bigbtn pick__act" disabled={tooOld} onClick={() => registerFrom(m)} aria-label={`ลงทะเบียน ${m.name}`}>ลงทะเบียน</button>}
        </div>
      </li>
    )
  }

  return (
    <section className="card">
      {t && (
        <div className="found" role="region" aria-label="ผลค้นหา">
          {shown.length === 0 ? (
            <div className="found__none">
              <p style={{ margin: 0 }}><b>ไม่พบรายชื่อ “{q.trim()}”</b> ในทะเบียน</p>
              <button type="button" className="btn btn--gold bigbtn btn--block" onClick={() => setAdding(true)}>＋ เพิ่มใหม่ “{q.trim()}”</button>
            </div>
          ) : (
            <>
              <p className="pagehint" style={{ margin: 0 }}>พบ {shown.length} คน — เลือกคนที่ใช่ แล้วกด “ลงทะเบียน”</p>
              <ul className="list list--tight">{shown.slice(0, 20).map((m) => row(m))}</ul>
              <button type="button" className="btn btn--ghost bigbtn btn--block" onClick={() => setAdding(true)}>ไม่ใช่คนข้างบน — ＋ เพิ่มใหม่</button>
            </>
          )}
        </div>
      )}
      <WeekStrip dates={weeks} value={date} onPick={(d) => { setDate(d); setMsg(null) }} counts={dayCounts} today={today} />
      <div className="formgrid">
        <div className="field">
          <label htmlFor="ck-date">วันนมัสการ</label>
          <input id="ck-date" className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setMsg(null) }} />
        </div>
        <div className="field">
          <label htmlFor="ck-q">ค้นหาชื่อ</label>
          <input id="ck-q" className="input" type="search" autoComplete="off" placeholder="พิมพ์ชื่อ เช่น ดารา" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาชื่อ" />
        </div>
      </div>
      {recorders.length === 0 && <p className="small" role="note" style={{ color: 'var(--bad)', margin: 0 }}>ยังไม่มีรายชื่อผู้บันทึก — ให้แอดมินเพิ่มชื่อผู้ช่วยงานก่อน (กดที่ชื่อผู้บันทึกด้านบน)</p>}

      <div className="row row--between" style={{ flexWrap: 'nowrap' }}>
        <b style={{ minWidth: 0 }}>{fmtDateLong(date)}</b>
        {date !== today && <button type="button" className="mini" onClick={() => { setDate(today); setMsg(null) }}>วันนี้</button>}
      </div>
      {dow(date) !== 0 && <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>ไม่ใช่วันอาทิตย์ — ถ้าเป็นการนมัสการพิเศษก็บันทึกได้</p>}
      {tooOld && <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>บันทึกได้เฉพาะปี {minYear + 543}–{yearOf(today) + 543}</p>}

      {(!g.connected || g.errors.length > 0) && (
        <p role="alert" className="small" style={{ margin: 0, padding: '8px 10px', border: '2px solid var(--bad)', borderRadius: 8, fontWeight: 700 }}>
          {!g.connected ? 'เครื่องนี้ยังไม่ได้เชื่อมต่อออนไลน์ จึงไม่เห็นรายชื่อที่เครื่องอื่นลงไว้ — กดปุ่มรีเฟรชที่หัวแอปเพื่อเชื่อมต่อ' : `ยังดึงรายชื่อล่าสุดไม่ได้ จึงอาจเห็นผู้มาไม่ครบ: ${g.errors[0]}`}
          {g.connected && <> <button type="button" className="mini" onClick={() => { clearEtagCache(); window.dispatchEvent(new Event(SYNC_EVENT)) }}>🔄 ลองใหม่</button></>}
        </p>
      )}
      {msg && <p className="small" role="status" style={{ margin: 0, color: msg.bad ? 'var(--bad)' : undefined, fontWeight: 700 }}>{msg.text}</p>}
      <div className="row row--between" style={{ flexWrap: 'nowrap' }}>
        <span>ลงชื่อ{date === today ? 'วันนี้' : ''}แล้ว <b style={{ fontSize: '1.3rem' }}>{doneRows.length}</b> คน</span>
        <button type="button" className="btn btn--gold" onClick={() => setSharing(true)} disabled={doneRows.length === 0}>📤 แชร์</button>
      </div>
      {doneRows.length === 0
        ? <p className="empty">ยังไม่มีใครลงชื่อ{date === today ? 'วันนี้' : 'ในวันนี้'} — พิมพ์ค้นหาชื่อด้านบน แล้วกด “ลงทะเบียน”</p>
        : (
          <ul ref={doneRef} className="list list--tight doneList" aria-label="รายชื่อที่ลงแล้ว">
            {doneNewestFirst.map((c) => {
              const m = byId.get(c.mid)!
              const isNewC = (x: CheckIn) => isFirstTimer(byId.get(x.mid) ?? {}, date, firstDay.get(x.mid))
              return (
                <li key={c.id} className={justId === c.mid ? 'doneNew' : undefined}>
                  <div className="pick pick--done">
                    <span className="doneAv"><PhotoAvatar member={m} size={52} canPhoto={canPhoto} put={addMember} /><span className={`doneNo${isNewC(c) ? ' doneNo--new' : ''}`} aria-label={`ลำดับที่ ${doneRows.indexOf(c) + 1}${isNewC(c) ? ' คนใหม่' : ''}`}>{doneRows.indexOf(c) + 1}</span></span>
                    <button type="button" className="pick__main" onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                      <span className="mrow__name">{m.name}</span>{m.nick ? <span className="muted"> ({m.nick})</span> : null}{isNewC(c) && <span className="newTag" aria-label="คนใหม่">NEW</span>}
                      <span className="doneBy"><span className="doneBy__n">ผู้บันทึก {c.rec ?? '—'}</span>{c.tm && <span className="doneBy__t">{c.tm}</span>}</span>
                      {m.note?.trim() && <span className="cardNote">หมายเหตุ: {m.note.trim()}</span>}
                    </button>
                    <div className="pick__btns">
                      {!readOnly && <button type="button" className="mini pick__edit" onClick={() => onEdit(m.id)} aria-label={`แก้ไขข้อมูล ${m.name}`}>✎ แก้ไข</button>}
                      <button type="button" className="mini pick__del" onClick={() => setAskDel(c)} aria-label={`ลบการลงชื่อของ ${m.name}`}>🗑 ลบ</button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      {sharing && <ShareReportSheet report={report} onClose={() => setSharing(false)} onDone={(t) => setMsg({ text: t })} />}
      {askDel && (
        <Sheet title="ลบการลงชื่อนี้?" onClose={() => setAskDel(null)}>
          <p style={{ margin: 0 }}>ลบ <b>{byId.get(askDel.mid)?.name}</b> ออกจากการลงชื่อ{askDel.date === today ? 'วันนี้' : `วันที่ ${fmtDateLong(askDel.date)}`} ใช่ไหม?</p>
          <p className="pagehint" style={{ margin: 0 }}>ลงโดย {askDel.rec ?? 'ไม่ระบุ'}{askDel.tm ? ` เวลา ${askDel.tm}` : ''} · ใช้เมื่อลงซ้ำหรือลงผิดคน · ลบเฉพาะการมานมัสการวันนี้ รายชื่อสมาชิกยังอยู่ในฐานข้อมูลเหมือนเดิม</p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button type="button" className="btn btn--ghost bigbtn grow" onClick={() => setAskDel(null)}>ไม่ลบ</button>
            <button type="button" className="btn btn--danger bigbtn grow" onClick={() => doDelete(askDel)}>ลบ</button>
          </div>
        </Sheet>
      )}
      {adding && <NewPerson lite={lite} members={members} date={date} initialName={q.trim()} onClose={() => setAdding(false)} onSave={async (mem, fixName) => {
        const ok = mem ? addMember([mem]) : true
        if (!ok) return
        if (fixName) { const m0 = byId.get(fixName.id); if (m0) addMember([{ ...m0, name: fixName.name }]) }
        setAdding(false)
        setQ('')
        await record(mem?.id ?? fixName!.id, mem?.name ?? fixName!.name)
      }} />}
    </section>
  )
}

/** ชื่อผู้บันทึกที่หัวหน้าจอ: แตะเพื่อเลือก (เลือกครั้งเดียว จำไว้จนกว่าจะเปลี่ยน) */
export function RecorderChip({ recorders, canManage, put, remove }: { recorders: Recorder[]; canManage: boolean; put: (x: Recorder[]) => boolean; remove: (id: string) => boolean }) {
  const { picked, pick } = useRecorderPick(recorders)
  const [open, setOpen] = useState(false)
  const [manage, setManage] = useState(false)
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(OPEN_RECORDER, on)
    return () => window.removeEventListener(OPEN_RECORDER, on)
  }, [])
  return (
    <>
      <button type="button" className={`recchip${picked ? '' : ' recchip--none'}`} onClick={() => setOpen(true)} aria-label={picked ? `ผู้บันทึก ${picked.name} · แตะเพื่อเปลี่ยน` : 'เลือกผู้บันทึก'}>
        <span className="recchip__lbl">ผู้บันทึก</span><b>{picked?.name ?? 'แตะเพื่อเลือก'}</b><span aria-hidden="true">▾</span>
      </button>
      {open && (
        <Sheet title="ใครเป็นผู้บันทึกเครื่องนี้?" onClose={() => { setOpen(false); setManage(false) }}>
          <p className="pagehint" style={{ margin: 0 }}>เลือกครั้งเดียว เครื่องจำไว้จนกว่าจะเปลี่ยนเอง ทุกรายการที่ลงจะมีชื่อนี้กับเวลาบันทึกไว้</p>
          {recorders.length === 0 && <p className="empty">ยังไม่มีรายชื่อผู้บันทึก{canManage ? ' — เพิ่มด้านล่าง' : ' — ให้แอดมินเพิ่มให้'}</p>}
          <ul className="list">
            {recorders.map((r) => (
              <li key={r.id}><button type="button" className={`btn bigbtn btn--block${picked?.id === r.id ? ' btn--gold' : ' btn--ghost'}`} aria-pressed={picked?.id === r.id} onClick={() => { pick(r.id); setOpen(false); setManage(false) }}>{picked?.id === r.id ? '✓ ' : ''}{r.name}</button></li>
            ))}
          </ul>
          {canManage && <button type="button" className="mini" onClick={() => setManage(!manage)}>{manage ? 'ซ่อนการจัดการ' : 'จัดการรายชื่อผู้บันทึก'}</button>}
          {manage && canManage && <RecorderManager recorders={recorders} put={put} remove={remove} />}
        </Sheet>
      )}
    </>
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

/** คนใหม่หน้างาน: กรอกแค่ ชื่อ · นามสกุล · เพศ แล้วกด "ลงทะเบียน" → เข้าทะเบียนสมาชิกเป็น "5.คนใหม่" และลงชื่อวันนี้ทันที */
function NewPerson({ lite, members, date, initialName, onClose, onSave }: {
  lite: boolean
  members: ChurchMember[]
  date: string
  initialName: string
  onClose: () => void
  /** mem = สมาชิกใหม่ที่ต้องเพิ่ม (ว่างถ้าเลือกคนเดิม) · fixName = แก้ชื่อคนเดิมเป็นตัวสะกดที่เพิ่งพิมพ์ */
  onSave: (mem: ChurchMember | null, fixName?: { id: string; name: string }) => Promise<void>
}) {
  const parts = initialName.trim().split(/\s+/)
  const [f, setF] = useState({ first: parts[0] ?? '', last: parts.slice(1).join(' '), nick: '', gender: '', tel: '', birth: '', since: date, note: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const name = `${f.first.trim()} ${f.last.trim()}`.trim().replace(/\s+/g, ' ')
  const complete = !!f.first.trim() && !!f.last.trim() && (f.gender === 'ชาย' || f.gender === 'หญิง')
  const similar = similarNames(name, members)
  const exact = similar.find((s) => s.exact)
  const preview = photo ? URL.createObjectURL(photo) : ''
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const save = async () => {
    if (!complete) return setErr('ใส่ชื่อ นามสกุล และเลือกเพศให้ครบ')
    if (f.birth && f.birth > todayISO()) return setErr('วันเกิดต้องไม่เกินวันนี้')
    setBusy(true); setErr('')
    const id = uniqueId(new Set(members.map((m) => m.id)))
    let photoPath: string | undefined
    try { if (photo) photoPath = await uploadMemberPhoto(id, photo) } catch (e) { setBusy(false); return setErr(`${e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ'} — แก้ปัญหาแล้วลองใหม่ หรือลบรูปออกแล้วกดลงทะเบียน (เพิ่มรูปภายหลังได้)`) }
    const mem: ChurchMember = { id, name, status: NEW_PERSON_STATUS, gender: f.gender as 'ชาย' | 'หญิง', since: f.since || date, updated: 0, ...(f.nick.trim() ? { nick: f.nick.trim() } : {}), ...(f.tel.trim() ? { tel: f.tel.trim() } : {}), ...(f.birth ? { birth: f.birth } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}), ...(photoPath ? { photoPath } : {}) }
    await onSave(mem)
    setBusy(false)
  }
  return (
    <Sheet title="เพิ่มคนใหม่" onClose={onClose}>
      <div className="formgrid">
        <div className="field"><label htmlFor="np-first">ชื่อ</label><input id="np-first" className="input bigfield" value={f.first} onChange={set('first')} autoComplete="off" /></div>
        <div className="field"><label htmlFor="np-last">นามสกุล</label><input id="np-last" className="input bigfield" value={f.last} onChange={set('last')} autoComplete="off" /></div>
        <div className="field full"><label htmlFor="np-note">หมายเหตุ <span className="muted">· มาจากไหน / มากับใคร / จำได้อย่างไร (ไว้ติดตามภายหลัง)</span></label><input id="np-note" className="input" value={f.note} onChange={set('note')} autoComplete="off" placeholder="เช่น มากับคุณสมชาย · ญาติของ…" /></div>
        <div className="field full">
          <span id="np-gender-l" style={{ fontSize: '0.85rem' }}>เพศ</span>
          <div className="seg" role="group" aria-labelledby="np-gender-l">
            {(['ชาย', 'หญิง'] as const).map((g) => <button key={g} type="button" className={`bigbtn${f.gender === g ? ' on' : ''}`} aria-pressed={f.gender === g} onClick={() => setF({ ...f, gender: g })}>{g}</button>)}
          </div>
        </div>
        {similar.length > 0 && (
          <div className="card full" role="alert" aria-label="ชื่อคล้ายกับที่มีอยู่">
            <p style={{ margin: 0, fontWeight: 700 }}>{exact ? 'มีชื่อนี้ในทะเบียนแล้ว' : 'มีชื่อคล้ายกันในทะเบียน'} — ใช่คนเดียวกันไหม?</p>
            <ul className="list">
              {similar.map(({ member: m }) => (
                <li key={m.id}><div className="mrow mrow--stack">
                  <MemberAvatar path={m.photoPath} name={m.name} size={52} member={m} />
                  <div className="mrow__main"><span className="mrow__name">{m.name}</span>{m.nick ? <span className="muted"> ({m.nick})</span> : null}<br /><span className="mrow__meta">{[m.code && `#${m.code}`, lite ? undefined : statusLabel(m.status)].filter(Boolean).join(' · ')}</span></div>
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
      </div>
      <details>
        <summary style={{ cursor: 'pointer', minHeight: 'var(--tap)', display: 'flex', alignItems: 'center' }}>ข้อมูลเพิ่มเติม (ไม่บังคับ · แก้ภายหลังได้)</summary>
        <div className="avatar-pick">
          {preview ? <img src={preview} alt="รูปที่เลือก" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 14, flex: 'none' }} /> : <MemberAvatar name={name || '?'} size={72} />}
          <div style={{ minWidth: 0 }}>
            <label className="btn btn--ghost" style={{ cursor: 'pointer' }}>📷 {photo ? 'เปลี่ยนรูป' : 'ถ่าย / เลือกรูป'}<input hidden type="file" accept="image/*" capture="environment" aria-label="รูปคนใหม่" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
          </div>
        </div>
        <div className="formgrid">
          <div className="field"><label htmlFor="np-nick">ชื่อเล่น</label><input id="np-nick" className="input" value={f.nick} onChange={set('nick')} /></div>
          <div className="field"><label htmlFor="np-since">วันที่เริ่มมา</label><input id="np-since" className="input" type="date" value={f.since} onChange={set('since')} /></div>
          {!lite && <div className="field"><label htmlFor="np-tel">โทรศัพท์</label><input id="np-tel" className="input" type="tel" value={f.tel} onChange={set('tel')} /></div>}
          {!lite && <div className="field"><label htmlFor="np-birth">วันเกิด{f.birth ? ` · อายุ ${ageText(f.birth, todayISO())}` : ''}</label><input id="np-birth" className="input" type="date" value={f.birth} onChange={set('birth')} /></div>}
        </div>
      </details>
      {err && <p role="alert" style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>}
      <button type="button" className="btn btn--gold bigbtn btn--block" disabled={busy || !complete || !!exact} onClick={save}>{busy ? 'กำลังบันทึก…' : similar.length ? 'ไม่ใช่ — บันทึกเป็นคนใหม่' : 'บันทึก'}</button>
      {!complete && <p className="pagehint" style={{ margin: 0 }}>กรอก ชื่อ · นามสกุล · เพศ ให้ครบ ปุ่มบันทึกจึงกดได้ · บันทึกแล้วเข้าทะเบียนสมาชิกและลงชื่อนมัสการพร้อมกัน</p>}
    </Sheet>
  )
}
