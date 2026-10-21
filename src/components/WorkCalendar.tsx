import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import { myRole, whoAmI } from '../lib/access'
import { canTouchEvent, dateRange, DAY_SHORT, describeDates, describeRepeat, kindLabel, kindOf, occurrences, presetRepeat, type RepeatKind } from '../lib/calendar'
import { useCalendar } from '../lib/data'
import { MEETING_TABS } from '../lib/workTabs'
import { addDays, be, daysInMonth, diffDays, dow, fmtDateLong, isISO, monthName, newId, todayISO, weekStart } from '../lib/money'
import type { CalEvent, Repeat } from '../lib/types'

/** สีของแต่ละงาน (0 = ทั่วไป) — ใช้ตัวอักษรขาวบนสีเข้ม */
const TAB_COLORS = ['#5f6b7a', '#1f6feb', '#8a5a00', '#1b7f4b', '#c2255c', '#7048e8', '#d9480f', '#0b7285', '#5c940d', '#a61e4d', '#364fc7', '#e67700', '#495057', '#2f9e44', '#9c36b5', '#0c8599']
const WEEKDAYS = DAY_SHORT
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
  const first = `${cur.y}-${pad(cur.m)}-01`
  const last = `${cur.y}-${pad(cur.m)}-${pad(daysInMonth(cur.y, cur.m))}`
  const start = weekStart(first)
  const weeks = Math.ceil((diffDays(last, start) + 1) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
  const go = (d: number) => setCur((c) => { const t = c.y * 12 + (c.m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 } })
  const gridEnd = cells[cells.length - 1]
  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of events) for (const d of occurrences(e, start, gridEnd)) m.set(d, [...(m.get(d) ?? []), e])
    for (const v of m.values()) v.sort(byTime)
    return m
  }, [events, start, gridEnd])
  const inMonth = events.filter((e) => occurrences(e, first, last).length > 0)
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
              {list.slice(0, MAX_CHIPS).map((e) => <span key={e.id} className="wcal__chip" style={{ background: TAB_COLORS[e.tab] ?? TAB_COLORS[0] }}>{e.time ? `${e.time} ` : ''}{e.title}</span>)}
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

const UNITS = [['day', 'วัน'], ['week', 'สัปดาห์'], ['month', 'เดือน'], ['year', 'ปี']] as const
const KINDS: RepeatKind[] = ['none', 'dates', 'daily', 'weekly', 'weekdays', 'monthly-date', 'monthly-nth', 'monthly-last', 'yearly', 'custom']

function DaySheet({ date, list, tab, all, onClose, put, remove }: { date: string; list: CalEvent[]; tab: number; all: boolean; onClose: () => void; put: (x: CalEvent[]) => boolean; remove: (id: string) => boolean }) {
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState(tab)
  const [when, setWhen] = useState(date)
  const [allDay, setAllDay] = useState(true)
  const [time, setTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [kind, setKind] = useState<RepeatKind>('none')
  const [every, setEvery] = useState(1)
  const [unit, setUnit] = useState<Repeat['freq']>('week')
  const [days, setDays] = useState<number[]>([])
  const [monthBy, setMonthBy] = useState<NonNullable<Repeat['by']>>('date')
  const [endType, setEndType] = useState<'never' | 'until' | 'count'>('never')
  const [until, setUntil] = useState('')
  const [count, setCount] = useState(10)
  const [picked, setPicked] = useState<string[]>([date])
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const reset = () => {
    setEditing(null); setTitle(''); setOwner(tab); setWhen(date); setAllDay(true); setTime('09:00'); setEndTime('10:00'); setKind('none')
    setEvery(1); setUnit('week'); setDays([]); setMonthBy('date'); setEndType('never'); setUntil(''); setCount(10); setNote(''); setPicked([date])
  }
  const edit = (e: CalEvent) => {
    const r = e.repeat
    setEditing(e); setTitle(e.title); setOwner(e.tab); setWhen(e.date); setAllDay(!e.time); setTime(e.time ?? '09:00'); setEndTime(e.end ?? '10:00'); setNote(e.note ?? ''); setMsg('')
    setPicked([e.date, ...(e.extra ?? [])]); setKind(e.extra?.length ? 'dates' : kindOf(r, e.date)); setEvery(r?.every ?? 1); setUnit(r?.freq ?? 'week'); setDays(r?.days ?? []); setMonthBy(r?.by ?? 'date')
    setEndType(r?.until ? 'until' : r?.count ? 'count' : 'never'); setUntil(r?.until ?? ''); setCount(r?.count ?? 10)
  }
  const buildRepeat = (): Repeat | undefined => {
    if (kind === 'none' || kind === 'dates') return undefined
    const base: Repeat = kind === 'custom'
      ? { freq: unit, every: Math.max(1, Math.floor(every) || 1), ...(unit === 'week' ? { days: days.length ? [...days].sort() : [dow(when)] } : {}), ...(unit === 'month' ? { by: monthBy } : {}) }
      : presetRepeat(kind, when)
    return { ...base, ...(endType === 'until' && until ? { until } : {}), ...(endType === 'count' ? { count: Math.max(1, Math.floor(count) || 1) } : {}) }
  }
  const save = () => {
    if (!title.trim()) return setMsg('ใส่ชื่อกิจกรรมก่อน')
    const dates = [...new Set(picked)].sort()
    if (kind === 'dates' ? dates.length === 0 : !isISO(when)) return setMsg(kind === 'dates' ? 'แตะเลือกวันที่อย่างน้อย 1 วัน' : 'เลือกวันที่ให้ถูกต้อง')
    if (!allDay && endTime && endTime < time) return setMsg('เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม')
    if (endType === 'until' && (!until || until < when)) return setMsg('วันสิ้นสุดการทำซ้ำต้องไม่ก่อนวันเริ่ม')
    const rep = buildRepeat()
    const ev: CalEvent = {
      ...(editing ?? { id: newId('cal'), updated: 0, recId: whoAmI().id, rec: whoAmI().name }),
      date: kind === 'dates' ? dates[0] : when, extra: kind === 'dates' && dates.length > 1 ? dates.slice(1) : undefined, title: title.trim(), tab: owner, note: note.trim() || undefined,
      time: allDay ? undefined : time, end: allDay || !endTime ? undefined : endTime, repeat: rep,
      exdates: rep || (kind === 'dates' && dates.length > 1) ? (editing?.exdates ?? []).filter((d) => kind === 'dates' ? dates.includes(d) : d >= when) : undefined,
    }
    if (!put([ev])) return setMsg('ไม่มีสิทธิ์บันทึกในปฏิทิน')
    reset(); setMsg('')
  }
  const toggleDay = (d: number) => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]))
  return (
    <Sheet title={fmtDateLong(date)} onClose={onClose}>
      {list.length === 0 && <p className="empty">ยังไม่มีกิจกรรมในวันนี้</p>}
      <ul className="list">
        {list.map((e) => (
          <li key={e.id} className="row row--between" style={{ borderLeft: `6px solid ${TAB_COLORS[e.tab] ?? TAB_COLORS[0]}`, paddingLeft: '0.6rem' }}>
            <span className="grow"><b>{e.title}</b><br /><span className="small muted">{[e.time ? `${e.time}${e.end ? `–${e.end}` : ''}` : 'ตลอดวัน', tabName(e.tab), describeRepeat(e.repeat, e.date), describeDates(e.date, e.extra), e.note, e.rec ? `บันทึกโดย ${e.rec}` : ''].filter(Boolean).join(' · ')}</span></span>
            {canTouch(e)
              ? <>
                <button type="button" className="mini" onClick={() => edit(e)} aria-label={`แก้ไข ${e.title}`}>{e.repeat || e.extra?.length ? 'แก้ไขทั้งชุด' : 'แก้ไข'}</button>
                {(e.repeat || e.extra?.length) && <button type="button" className="mini" onClick={() => { if (window.confirm(`ลบ “${e.title}” เฉพาะวันนี้ ?`) && !put([{ ...e, exdates: [...(e.exdates ?? []), date] }])) setMsg('ไม่มีสิทธิ์ลบ') }} aria-label={`ลบเฉพาะวันนี้ ${e.title}`}>ลบวันนี้</button>}
                <button type="button" className="mini" onClick={() => { if (window.confirm(e.repeat || e.extra?.length ? `ลบ “${e.title}” ทั้งชุด ?` : `ลบ “${e.title}” ?`) && !remove(e.id)) setMsg('ไม่มีสิทธิ์ลบ') }} aria-label={`ลบ ${e.title}`}>{e.repeat || e.extra?.length ? 'ลบทั้งชุด' : 'ลบ'}</button>
              </>
              : <span className="small muted">แก้ได้เฉพาะผู้บันทึก</span>}
          </li>
        ))}
      </ul>
      <h3 style={{ marginTop: '0.8rem' }}>{editing ? (editing.repeat || editing.extra?.length ? 'แก้ไขกิจกรรม (ทั้งชุด)' : 'แก้ไขกิจกรรม') : 'เพิ่มกิจกรรม'}</h3>
      <div className="field"><label htmlFor="ce-t">ชื่อกิจกรรม</label><input id="ce-t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ประชุมคณะกรรมการ" /></div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}><label htmlFor="ce-o">งาน</label>
          <select id="ce-o" className="input" value={owner} onChange={(e) => setOwner(Number(e.target.value))}>
            {all && <option value={0}>ทั่วไป</option>}
            {(all ? MEETING_TABS : MEETING_TABS.filter((t) => t.n === tab || t.n === SECRETARY)).map((t) => <option key={t.n} value={t.n}>{t.name}</option>)}
          </select></div>
        {kind !== 'dates' && <div className="field" style={{ flex: 1 }}><label htmlFor="ce-d">วันที่{editing?.repeat ? 'เริ่ม' : ''}</label><input id="ce-d" className="input" type="date" value={when} onChange={(e) => setWhen(e.target.value)} /></div>}
      </div>
      <label className="row" style={{ margin: '0.5rem 0' }}><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> <b>ตลอดวัน</b></label>
      {!allDay && (
        <div className="row">
          <div className="field" style={{ flex: 1 }}><label htmlFor="ce-h">เวลาเริ่ม</label><input id="ce-h" className="input" type="time" value={time} onChange={(e) => { const t = e.target.value; setTime(t); if (t && endTime <= t) { const [h, m] = t.split(':').map(Number); setEndTime(h >= 23 ? '23:59' : `${pad(h + 1)}:${pad(m)}`) } }} /></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="ce-e">เวลาสิ้นสุด</label><input id="ce-e" className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
        </div>
      )}
      <div className="field"><label htmlFor="ce-r">ทำซ้ำ</label>
        <select id="ce-r" className="input" value={kind} onChange={(e) => { const k = e.target.value as RepeatKind; setKind(k); if (k === 'custom' && !days.length) setDays([dow(when)]); if (k === 'dates' && !picked.length) setPicked([when]) }}>
          {KINDS.map((k) => <option key={k} value={k}>{kindLabel(k, isISO(when) ? when : date)}</option>)}
        </select></div>
      {kind === 'dates' && <DatesPicker picked={picked} onChange={(d) => { setPicked(d); if (d.length) setWhen([...d].sort()[0]) }} />}
      {kind === 'custom' && (
        <div className="card" style={{ margin: '0.4rem 0' }}>
          <div className="row">
            <span>ทุก</span>
            <input className="input" style={{ width: '4.5rem' }} type="number" min={1} max={99} aria-label="ทำซ้ำทุกกี่หน่วย" value={every} onChange={(e) => setEvery(Number(e.target.value))} />
            <select className="input" style={{ flex: 1 }} aria-label="หน่วยการทำซ้ำ" value={unit} onChange={(e) => setUnit(e.target.value as Repeat['freq'])}>{UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          {unit === 'week' && (
            <div className="row" role="group" aria-label="ทำซ้ำในวัน" style={{ marginTop: '0.4rem' }}>
              {WEEKDAYS.map((w, i) => <button key={w} type="button" className="wchip" aria-pressed={days.includes(i)} onClick={() => toggleDay(i)}>{w}</button>)}
            </div>
          )}
          {unit === 'month' && (
            <select className="input" style={{ marginTop: '0.4rem' }} aria-label="ทำซ้ำรายเดือนแบบ" value={monthBy} onChange={(e) => setMonthBy(e.target.value as NonNullable<Repeat['by']>)}>
              <option value="date">{kindLabel('monthly-date', when)}</option><option value="nth">{kindLabel('monthly-nth', when)}</option><option value="last">{kindLabel('monthly-last', when)}</option>
            </select>
          )}
        </div>
      )}
      {kind !== 'none' && kind !== 'dates' && (
        <div className="row" style={{ margin: '0.4rem 0' }}>
          <label htmlFor="ce-end">สิ้นสุด</label>
          <select id="ce-end" className="input" style={{ flex: 1 }} value={endType} onChange={(e) => setEndType(e.target.value as 'never' | 'until' | 'count')}><option value="never">ไม่สิ้นสุด</option><option value="until">ถึงวันที่</option><option value="count">ครบกี่ครั้ง</option></select>
          {endType === 'until' && <input className="input" style={{ flex: 1 }} type="date" aria-label="ซ้ำถึงวันที่" value={until} onChange={(e) => setUntil(e.target.value)} />}
          {endType === 'count' && <><input className="input" style={{ width: '4.5rem' }} type="number" min={1} aria-label="จำนวนครั้ง" value={count} onChange={(e) => setCount(Number(e.target.value))} /><span>ครั้ง</span></>}
        </div>
      )}
      <div className="field"><label htmlFor="ce-n">รายละเอียด (ไม่บังคับ)</label><textarea id="ce-n" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="btn btn--gold" onClick={save}>{editing ? 'บันทึกการแก้ไข' : '＋ เพิ่ม'}</button>
        {editing && <button type="button" className="btn" onClick={reset}>ยกเลิกแก้ไข</button>}
      </div>
    </Sheet>
  )
}

/** เลือกวันที่เองหลายวัน: แตะวันในปฏิทินย่อเพื่อเลือก/เอาออก หรือกรอก “ถึงวันที่” เพื่อเลือกต่อเนื่อง (เช่น 23–26) */
function DatesPicker({ picked, onChange }: { picked: string[]; onChange: (d: string[]) => void }) {
  const sorted = [...new Set(picked)].sort()
  const seed = sorted[0] ?? todayISO()
  const [cur, setCur] = useState({ y: Number(seed.slice(0, 4)), m: Number(seed.slice(5, 7)) })
  const first = `${cur.y}-${pad(cur.m)}-01`
  const start = weekStart(first)
  const weeks = Math.ceil((diffDays(`${cur.y}-${pad(cur.m)}-${pad(daysInMonth(cur.y, cur.m))}`, start) + 1) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
  const go = (d: number) => setCur((c) => { const t = c.y * 12 + (c.m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 } })
  const toggle = (d: string) => onChange(sorted.includes(d) ? sorted.filter((x) => x !== d) : [...sorted, d].sort())
  return (
    <div className="card" style={{ margin: '0.4rem 0' }} aria-label="เลือกวันที่เอง">
      <div className="row row--between">
        <button type="button" className="mini" onClick={() => go(-1)} aria-label="ปฏิทินย่อ เดือนก่อนหน้า">‹</button>
        <b>{monthName(cur.m)} {be(cur.y)}</b>
        <button type="button" className="mini" onClick={() => go(1)} aria-label="ปฏิทินย่อ เดือนถัดไป">›</button>
      </div>
      <div className="wcal__grid" style={{ marginTop: '0.3rem' }}>
        {WEEKDAYS.map((w) => <div key={w} className="wcal__dow">{w}</div>)}
        {cells.map((d) => {
          const on = sorted.includes(d)
          return <button key={d} type="button" className={`wpick${d.slice(0, 7) !== first.slice(0, 7) ? ' out' : ''}`} aria-pressed={on} aria-label={`เลือก ${fmtDateLong(d)}`} onClick={() => toggle(d)}>{Number(d.slice(8))}</button>
        })}
      </div>
      <div className="row" style={{ marginTop: '0.4rem' }}>
        <label htmlFor="ce-to" className="small">เลือกต่อเนื่องถึงวันที่</label>
        <input id="ce-to" className="input" style={{ flex: 1 }} type="date" onChange={(e) => { const to = e.target.value; if (isISO(to) && sorted[0] && to >= sorted[0]) onChange(dateRange(sorted[0], to)) }} />
      </div>
      <p className="small muted" style={{ margin: '0.3rem 0 0' }}>{sorted.length ? `เลือกแล้ว ${sorted.length} วัน: ${describeDates(sorted[0], sorted.slice(1)) || fmtDateLong(sorted[0])}` : 'แตะวันที่ที่ต้องการ'}</p>
    </div>
  )
}
