import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import { myRole, whoAmI } from '../lib/access'
import { canTouchEvent } from '../lib/calendar'
import { useCalendar } from '../lib/data'
import { MEETING_TABS } from '../lib/workTabs'
import { addDays, be, daysInMonth, diffDays, fmtDateLong, monthName, newId, todayISO, weekStart } from '../lib/money'
import type { CalEvent } from '../lib/types'

/** สีของแต่ละงาน (0 = ทั่วไป) — ใช้ตัวอักษรขาวบนสีเข้ม */
const TAB_COLORS = ['#5f6b7a', '#1f6feb', '#8a5a00', '#1b7f4b', '#c2255c', '#7048e8', '#d9480f', '#0b7285', '#5c940d', '#a61e4d', '#364fc7', '#e67700', '#495057']
const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const MAX_CHIPS = 3
const tabName = (n: number) => (n === 0 ? 'ทั่วไป' : MEETING_TABS.find((t) => t.n === n)?.name ?? `แท็บ ${n}`)
const pad = (n: number) => String(n).padStart(2, '0')
const byTime = (a: CalEvent, b: CalEvent) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'th')

/** งานเลขาเป็นศูนย์กลางของตารางงาน: เห็นของทุกงาน · งานอื่นเห็นเฉพาะของตัวเองกับของงานเลขา */
const SECRETARY = 1
const canTouch = (e: CalEvent) => canTouchEvent(e, whoAmI().id, myRole() === 'admin')

/**
 * ปฏิทินงานแบบเดียวกับ Google Calendar: ดูเป็นเดือน เลื่อนย้อนหลัง/ไปข้างหน้าได้ไม่จำกัด แตะวันเพื่อดู/เพิ่ม/แก้/ลบกิจกรรม
 * ทุกงานบันทึกลงปฏิทินเดียวกัน แยกสีตามงาน: tab = งานที่เปิดอยู่ · งานเลขา (1) เห็นรวมทุกงาน ·
 * งานอื่นเห็นเฉพาะของตัวเองกับของงานเลขา (เห็นซึ่งกันและกัน บันทึกได้ทั้งสองทาง)
 */
export default function WorkCalendar({ tab }: { tab: number }) {
  const all = tab === SECRETARY
  const cal = useCalendar()
  const today = todayISO()
  const [cur, setCur] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }))
  const [jump, setJump] = useState(false)
  const [filter, setFilter] = useState<number | 'all'>('all')
  const [day, setDay] = useState<string | null>(null)

  const events = useMemo(() => cal.list.filter((e) => (all ? filter === 'all' || e.tab === filter : e.tab === tab || e.tab === SECRETARY)), [cal.list, all, tab, filter])
  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e])
    for (const v of m.values()) v.sort(byTime)
    return m
  }, [events])

  const first = `${cur.y}-${pad(cur.m)}-01`
  const last = `${cur.y}-${pad(cur.m)}-${pad(daysInMonth(cur.y, cur.m))}`
  const start = weekStart(first)
  const weeks = Math.ceil((diffDays(last, start) + 1) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
  const go = (d: number) => setCur((c) => { const t = c.y * 12 + (c.m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 } })
  const inMonth = events.filter((e) => e.date >= first && e.date <= last)
  const present = [...new Set(inMonth.map((e) => e.tab))].sort((a, b) => a - b)
  const years = Array.from({ length: 21 }, (_, i) => cur.y - 10 + i)

  return (
    <section className="wcal" aria-label="ปฏิทินงาน">
      <div className="wcal__bar no-print">
        <button type="button" className="mini" onClick={() => go(-1)} aria-label="เดือนก่อนหน้า">‹</button>
        <button type="button" className="wcal__title" onClick={() => setJump((j) => !j)} aria-expanded={jump} aria-label="เลือกเดือนและปี">{monthName(cur.m)} {be(cur.y)} ▾</button>
        <button type="button" className="mini" onClick={() => go(1)} aria-label="เดือนถัดไป">›</button>
        <span className="grow" />
        <button type="button" className="mini" onClick={() => setCur({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) })}>วันนี้</button>
      </div>
      {jump && (
        <div className="row no-print" style={{ margin: '0.3rem 0' }}>
          <select className="input" style={{ flex: 1 }} aria-label="เดือน" value={cur.m} onChange={(e) => setCur({ ...cur, m: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i + 1)}</option>)}</select>
          <select className="input" style={{ flex: 1 }} aria-label="ปี" value={cur.y} onChange={(e) => setCur({ ...cur, y: Number(e.target.value) })}>{years.map((y) => <option key={y} value={y}>{be(y)}</option>)}</select>
        </div>
      )}
      {all && (
        <div className="row no-print" style={{ margin: '0.3rem 0' }}>
          <label className="small muted" htmlFor="wcal-f">แสดง</label>
          <select id="wcal-f" className="input" style={{ flex: 1 }} value={filter} onChange={(e) => setFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">ทุกงาน</option>
            <option value={0}>ทั่วไป</option>
            {MEETING_TABS.map((t) => <option key={t.n} value={t.n}>{t.name}</option>)}
          </select>
        </div>
      )}

      <div className="wcal__grid" role="grid" aria-label={`${monthName(cur.m)} ${be(cur.y)}`}>
        {WEEKDAYS.map((w) => <div key={w} className="wcal__dow" role="columnheader">{w}</div>)}
        {cells.map((d) => {
          const list = byDate.get(d) ?? []
          const out = d < first || d > last
          return (
            <button key={d} type="button" role="gridcell" className={`wcal__day${out ? ' out' : ''}${d === today ? ' today' : ''}`} aria-label={`${fmtDateLong(d)}${list.length ? ` มี ${list.length} กิจกรรม` : ''}`} onClick={() => setDay(d)}>
              <span className="wcal__num">{Number(d.slice(8))}</span>
              {list.slice(0, MAX_CHIPS).map((e) => <span key={e.id} className="wcal__chip" style={{ background: TAB_COLORS[e.tab] ?? TAB_COLORS[0] }}>{e.title}</span>)}
              {list.length > MAX_CHIPS && <span className="wcal__more">+{list.length - MAX_CHIPS}</span>}
            </button>
          )
        })}
      </div>
      {present.length > 1 && (
        <p className="wcal__legend small no-print" aria-label="สีของแต่ละงาน">{present.map((n) => <span key={n}><i style={{ background: TAB_COLORS[n] ?? TAB_COLORS[0] }} />{tabName(n)}</span>)}</p>
      )}
      <p className="small muted no-print">แตะวันที่เพื่อดู/เพิ่มกิจกรรม · ทุกงานบันทึกลงปฏิทินเดียวกัน</p>
      {day && <DaySheet date={day} list={byDate.get(day) ?? []} tab={tab} all={all} onClose={() => setDay(null)} put={cal.put} remove={cal.remove} />}
    </section>
  )
}

function DaySheet({ date, list, tab, all, onClose, put, remove }: { date: string; list: CalEvent[]; tab: number; all: boolean; onClose: () => void; put: (x: CalEvent[]) => boolean; remove: (id: string) => boolean }) {
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState(tab)
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const reset = () => { setEditing(null); setTitle(''); setOwner(tab); setTime(''); setNote('') }
  const edit = (e: CalEvent) => { setEditing(e); setTitle(e.title); setOwner(e.tab); setTime(e.time ?? ''); setNote(e.note ?? ''); setMsg('') }
  const save = () => {
    if (!title.trim()) return setMsg('ใส่ชื่อกิจกรรมก่อน')
    const ev: CalEvent = { ...(editing ?? { id: newId('cal'), updated: 0, recId: whoAmI().id, rec: whoAmI().name }), date, title: title.trim(), tab: owner, ...(time ? { time } : { time: undefined }), ...(note.trim() ? { note: note.trim() } : { note: undefined }) }
    if (!put([ev])) return setMsg('ไม่มีสิทธิ์บันทึกในปฏิทิน')
    reset(); setMsg('')
  }
  return (
    <Sheet title={fmtDateLong(date)} onClose={onClose}>
      {list.length === 0 && <p className="empty">ยังไม่มีกิจกรรมในวันนี้</p>}
      <ul className="list">
        {list.map((e) => (
          <li key={e.id} className="row row--between" style={{ borderLeft: `6px solid ${TAB_COLORS[e.tab] ?? TAB_COLORS[0]}`, paddingLeft: '0.6rem' }}>
            <span className="grow"><b>{e.title}</b><br /><span className="small muted">{[e.time, tabName(e.tab), e.note, e.rec ? `บันทึกโดย ${e.rec}` : ''].filter(Boolean).join(' · ')}</span></span>
            {canTouch(e)
              ? <>
                <button type="button" className="mini" onClick={() => edit(e)} aria-label={`แก้ไข ${e.title}`}>แก้ไข</button>
                <button type="button" className="mini" onClick={() => { if (window.confirm(`ลบ “${e.title}” ?`)) { if (!remove(e.id)) setMsg('ไม่มีสิทธิ์ลบ') } }} aria-label={`ลบ ${e.title}`}>ลบ</button>
              </>
              : <span className="small muted">แก้ได้เฉพาะผู้บันทึก</span>}
          </li>
        ))}
      </ul>
      <h3 style={{ marginTop: '0.8rem' }}>{editing ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'}</h3>
      <div className="field"><label htmlFor="ce-t">ชื่อกิจกรรม</label><input id="ce-t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ประชุมคณะกรรมการ" /></div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}><label htmlFor="ce-o">งาน</label>
          <select id="ce-o" className="input" value={owner} onChange={(e) => setOwner(Number(e.target.value))}>
            {all && <option value={0}>ทั่วไป</option>}
            {(all ? MEETING_TABS : MEETING_TABS.filter((t) => t.n === tab || t.n === SECRETARY)).map((t) => <option key={t.n} value={t.n}>{t.name}</option>)}
          </select></div>
        <div className="field" style={{ flex: 1 }}><label htmlFor="ce-h">เวลา (ไม่บังคับ)</label><input id="ce-h" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="ce-n">รายละเอียด (ไม่บังคับ)</label><textarea id="ce-n" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="btn btn--gold" onClick={save}>{editing ? 'บันทึกการแก้ไข' : '＋ เพิ่ม'}</button>
        {editing && <button type="button" className="btn" onClick={reset}>ยกเลิกแก้ไข</button>}
      </div>
    </Sheet>
  )
}
