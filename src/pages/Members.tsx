import { useMemo, useRef, useState, type ReactNode } from 'react'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import { can } from '../lib/access'
import { useAttendance, useChurchMembers, useSettings } from '../lib/data'
import { useRole } from '../lib/members'
import { dow, fmtDate, newId, todayISO, weekStart, yearOf } from '../lib/money'
import { ageText, bandLabel, bandOf, DEFAULT_CRITERIA, evaluate, matchNames, nameKey, serviceStats, statusLabel, OVERRIDE_TIER, parseAttendanceRows, parseMemberRows, summarize, TIER_LABEL, type Evaluated, type Tier } from '../lib/registry'
import { parseCSV } from '../lib/statement'
import { readXlsxRows } from '../lib/xlsx'
import type { Attendance, ChurchMember, MemberOverride } from '../lib/types'

type Tab = 'audit' | 'checkin' | 'roster' | 'stats'
const YEARS_BACK = 3 // โหลดบันทึกลงชื่อย้อนหลัง 4 ปี (ปีนี้ + 3 ปี) · ระดับ "ขาดเกิน N ปี" จึงนับได้ไม่เกินช่วงนี้
const TIER_BADGE: Record<Tier, string> = { 0: 'badge--good', 1: '', 2: '', 3: '', 4: 'badge--bad', 5: 'badge--gold', 6: '' }
const OVERRIDES: { key: MemberOverride; label: string }[] = [{ key: 'incomplete', label: 'คุณสมบัติไม่ครบ' }, { key: 'resigned', label: 'ลาออก' }, { key: 'deceased', label: 'เสียชีวิต' }, { key: 'removed', label: 'ปรับออก' }]
const lastSunday = () => { const t = todayISO(); return dow(t) === 0 ? t : weekStart(t) }

export default function Members() {
  const role = useRole()
  if (!can(role, 'detail')) return <NoAccess />
  return <MembersPage />
}

function MembersPage() {
  const role = useRole()
  const canEdit = can(role, 'registry')
  const thisYear = yearOf(todayISO())
  const people = useChurchMembers()
  const a0 = useAttendance(thisYear), a1 = useAttendance(thisYear - 1), a2 = useAttendance(thisYear - 2), a3 = useAttendance(thisYear - 3)
  const stores = [a3, a2, a1, a0] // ปีเก่า → ใหม่
  const attendance = useMemo(() => stores.flatMap((s) => s.items), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const { settings, save } = useSettings()
  const criteria = { minYears: settings.memberMinYears ?? DEFAULT_CRITERIA.minYears, absentMonths: settings.memberAbsentMonths ?? DEFAULT_CRITERIA.absentMonths }
  const today = todayISO()
  const result = useMemo(() => evaluate(people.items, attendance, criteria, today), [people.items, attendance, criteria.minYears, criteria.absentMonths, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>(() => (attendance.length === 0 ? 'roster' : 'audit'))
  const [detail, setDetail] = useState('')
  const byId = new Map(result.rows.map((r) => [r.member.id, r]))
  const shownDetail = detail ? byId.get(detail) : undefined
  const putAttendance = (items: Attendance[]) => {
    for (const s of stores) {
      const y = thisYear - (stores.length - 1 - stores.indexOf(s))
      const mine = items.filter((x) => yearOf(x.date) === y)
      if (mine.length && !s.put(mine)) return false
    }
    return true
  }
  const existing = (date: string) => stores.flatMap((s) => s.items).find((x) => x.date === date)
  return (
    <>
      <div className="page-head no-print"><h1>สมาชิก</h1></div>
      <div className="seg no-print" role="tablist" aria-label="หมวด">
        {([['audit', 'ตรวจสอบ'], ['stats', 'ยอดผู้มา'], ['checkin', 'ลงชื่อ'], ['roster', 'ทะเบียน']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'audit' && <Audit onOpen={setDetail} result={result} criteria={criteria} canEdit={canEdit} canTune={can(role, 'settings')} today={today} put={people.put} onCriteria={(p) => save(p)} />}
      {tab === 'stats' && <Stats attendance={attendance} members={people.items} onOpen={setDetail} />}
      {tab === 'checkin' && (canEdit ? <Checkin members={people.items} existing={existing} put={putAttendance} /> : <p className="empty">ลงชื่อนมัสการได้เฉพาะผู้บันทึกบัญชีและแอดมิน</p>)}
      {tab === 'roster' && <Roster rows={result.rows} onOpen={setDetail} members={people.items} canEdit={canEdit} put={people.put} remove={people.remove} putAttendance={putAttendance} existing={existing} />}
      {shownDetail && <Detail r={shownDetail} today={today} canEdit={canEdit} put={people.put} remove={people.remove} onClose={() => setDetail('')} />}
    </>
  )
}

function Audit({ onOpen, result, criteria, canEdit, canTune, today, put, onCriteria }: { onOpen: (id: string) => void; result: ReturnType<typeof evaluate>; criteria: { minYears: number; absentMonths: number }; canEdit: boolean; canTune: boolean; today: string; put: (x: ChurchMember[]) => boolean; onCriteria: (p: { memberMinYears: number; memberAbsentMonths: number }) => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [group, setGroup] = useState('')
  const [menu, setMenu] = useState('')
  const rows = result.rows
  const sum = summarize(rows)
  const groups = [...new Set(rows.map((r) => r.member.group).filter(Boolean))].sort() as string[]
  const rank = new Map(rows.map((r, i) => [r.member.id, i + 1]))
  const shown = rows.filter((r) => {
    if (filter.startsWith('band') ? !(r.tier === 5 && bandOf(r) === Number(filter.slice(4))) : filter !== 'all' && filter !== 'novisit' && r.tier !== Number(filter)) return false
    if (filter === 'novisit' && !r.noRecord) return false
    if (group && r.member.group !== group) return false
    const t = q.trim().toLowerCase()
    return !t || `${r.member.name} ${r.member.nick ?? ''} ${r.member.code ?? ''} ${r.member.note ?? ''}`.toLowerCase().includes(t)
  })
  const setOverride = (r: Evaluated, o: MemberOverride | undefined) => { setMenu(''); put([{ ...r.member, override: o }]) }
  if (rows.length === 0) return <p className="empty">ยังไม่มีสมาชิกในทะเบียน — ไปที่แท็บ “ทะเบียน” เพื่อเพิ่มหรือนำเข้าไฟล์ CSV</p>
  return (
    <>
      {!result.hasData && <p className="card small" role="note">ยังไม่มีบันทึกลงชื่อนมัสการ จึงยังตัดสินว่า “ขาดการนมัสการ” ไม่ได้ (ผู้ที่ยังมีชีวิตจะอยู่ใน “ยังไม่ครบเกณฑ์” ไปก่อน) — ไปแท็บ “ลงชื่อนมัสการ” หรือนำเข้าไฟล์ลงชื่อที่แท็บ “ทะเบียน”</p>}
      <div className="kpi">
        <div><span>รายชื่อทั้งหมด</span><b>{sum.total}</b></div>
        <div><span>สมบูรณ์ (1+2)</span><b>{sum.complete}</b></div>
        <div><span>สมบูรณ์ 1</span><b>{sum.byTier[0]}</b></div>
        <div><span>สมบูรณ์ 2 · ขาดเกิน {criteria.absentMonths} ด.</span><b>{sum.byTier[5]}</b></div>
        <div><span>ไม่ครบ / ยังไม่ครบเกณฑ์</span><b>{sum.byTier[1]} / {sum.byTier[6]}</b></div>
        <div><span>ลาออก · เสียชีวิต · ปรับออก</span><b>{sum.byTier[2]} · {sum.byTier[3]} · {sum.byTier[4]}</b></div>
      </div>
      <p className="small muted">เกณฑ์: เป็นสมาชิกครบ <b>{criteria.minYears} ปี</b> = สมาชิกสมบูรณ์ · ไม่มานมัสการเลยตั้งแต่ <b>{fmtDate(result.cutoff)}</b> (ย้อนหลัง {criteria.absentMonths} เดือน) = ขาดการนมัสการ · ข้อมูลลงชื่อ {result.services.length} ครั้ง{result.services.length ? ` (${fmtDate(result.services[0])} – ${fmtDate(result.services[result.services.length - 1])})` : ''}</p>
      {canTune && (
        <details className="no-print"><summary className="small">ปรับเกณฑ์ (แอดมิน)</summary>
          <div className="row">
            <label className="small">ครบกี่ปี <input className="input" type="number" min={0} max={10} step={0.5} defaultValue={criteria.minYears} onBlur={(e) => onCriteria({ memberMinYears: Math.max(0, Number(e.target.value) || 0), memberAbsentMonths: criteria.absentMonths })} /></label>
            <label className="small">ขาดเกินกี่เดือน <input className="input" type="number" min={1} max={60} defaultValue={criteria.absentMonths} onBlur={(e) => onCriteria({ memberMinYears: criteria.minYears, memberAbsentMonths: Math.max(1, Math.round(Number(e.target.value)) || 1) })} /></label>
          </div>
        </details>
      )}
      {sum.byTier[5] > 0 && (
        <div className="row no-print" aria-label="ระดับสมาชิกสมบูรณ์ 2">
          {sum.bands.map((n, b) => n > 0 && <button key={b} type="button" className={`mini${filter === `band${b}` ? ' on' : ''}`} onClick={() => setFilter(filter === `band${b}` ? 'all' : `band${b}`)}>{bandLabel(b, criteria.absentMonths).replace('ขาดการนมัสการ', '')} · {n}</button>)}
        </div>
      )}
      <div className="row no-print">
        <input className="input" style={{ flex: '1 1 100%' }} placeholder="ค้นหาชื่อ / ชื่อเล่น / รหัส / หมายเหตุ" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="กรองตามผลตรวจ" style={{ width: 'auto' }}>
          <option value="all">ทุกผลตรวจ</option>
          {([0, 5, 1, 6, 2, 3, 4] as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]} ({sum.byTier[t]})</option>)}
          <option value="novisit">ไม่มีบันทึกนมัสการ</option>
        </select>
        {groups.length > 0 && <select className="input" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="กรองตามกลุ่ม" style={{ width: 'auto' }}><option value="">ทุกกลุ่ม</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>}
        <button type="button" className="btn" onClick={() => window.print()}>พิมพ์ / PDF</button>
      </div>
      <p className="small"><b>{shown.length}</b> จาก {rows.length} รายชื่อ · พิมพ์ ณ {fmtDate(today)}</p>
      <section className="card" aria-label="ผลตรวจสมาชิก">
        <ul className="list">
          {shown.map((r) => (
            <li key={r.member.id} style={{ position: 'relative' }}>
              <div className="item">
                <span className="num muted" style={{ minWidth: '1.6rem', marginRight: '0.3rem' }}>{rank.get(r.member.id)}</span>
                <span className="grow"><button type="button" className="linklike" style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }} onClick={() => onOpen(r.member.id)} aria-label={`ดูข้อมูล ${r.member.name}`}>{r.member.name}</button>
                  <br /><span className="small muted">{[r.member.code && `#${r.member.code}`, r.member.nick, r.member.group, r.member.status].filter(Boolean).join(' · ')}</span>
                  <br /><span className="small muted">เป็นสมาชิก {r.member.since ? `${fmtDate(r.member.since)} (${r.tenureY.toFixed(1)} ปี)` : '—'} · มา {r.visits} ครั้ง ({Math.round(r.cont * 100)}%) · 12 ด. {r.recent} · ล่าสุด {r.last ? fmtDate(r.last) : '—'}</span>
                  {r.tier === 5 && <><br /><span className="small" style={{ color: 'var(--bad)', fontWeight: 600 }}>{bandLabel(bandOf(r), criteria.absentMonths)}{r.idleDays != null ? ` · จริง ${Math.floor(r.idleDays / 30.44)} เดือน` : ''}{r.noRecord ? ' (ไม่มีบันทึกลงชื่อ)' : ''}</span></>}
                </span>
                <span>
                  {canEdit
                    ? <button type="button" className={`badge ${TIER_BADGE[r.tier]}`} style={{ cursor: 'pointer' }} aria-haspopup="menu" aria-expanded={menu === r.member.id} onClick={() => setMenu(menu === r.member.id ? '' : r.member.id)}>{TIER_LABEL[r.tier]} ▾</button>
                    : <span className={`badge ${TIER_BADGE[r.tier]}`}>{TIER_LABEL[r.tier]}</span>}
                  {r.member.override && <><br /><span className="small muted">กำหนดเอง</span></>}
                </span>
              </div>
              {menu === r.member.id && (
                <div className="card no-print" role="menu" style={{ position: 'absolute', right: 0, zIndex: 5 }}>
                  <button type="button" role="menuitem" className="mini" onClick={() => setOverride(r, undefined)}>ตามการคำนวณ ({TIER_LABEL[r.baseTier]})</button>
                  {OVERRIDES.filter((o) => OVERRIDE_TIER[o.key] !== r.baseTier || r.member.override).map((o) => <button key={o.key} type="button" role="menuitem" className="mini" onClick={() => setOverride(r, o.key)}>{o.label}</button>)}
                </div>
              )}
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="empty">ไม่พบรายชื่อตามที่กรอง</p>}
      </section>
    </>
  )
}

function Checkin({ members, existing, put }: { members: ChurchMember[]; existing: (d: string) => Attendance | undefined; put: (x: Attendance[]) => boolean }) {
  const [date, setDate] = useState(lastSunday)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [msg, setMsg] = useState('')
  const rec = existing(date)
  const sel = picked ?? new Set(rec?.ids ?? [])
  const list = members.filter((m) => !/เสียชีวิต|สิ้นสภาพ/.test(m.status ?? '') && !m.override).sort((a, b) => a.name.localeCompare(b.name, 'th'))
  const t = q.trim().toLowerCase()
  const shown = t ? list.filter((m) => `${m.name} ${m.nick ?? ''} ${m.code ?? ''}`.toLowerCase().includes(t)) : list
  const toggle = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); setMsg('') }
  const save = () => {
    const known = new Set(members.map((m) => m.id))
    const ids = [...sel].filter((id) => known.has(id))
    if (put([{ id: date, date, ids, updated: 0, ...(rec ? { deleted: undefined } : {}) }])) { setMsg(`บันทึกแล้ว ${ids.length} คน`); setPicked(null) }
  }
  const tooOld = yearOf(date) < yearOf(todayISO()) - YEARS_BACK || yearOf(date) > yearOf(todayISO())
  return (
    <section className="card">
      <div className="row">
        <div className="field"><label htmlFor="ck-date">วันนมัสการ</label><input id="ck-date" className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setPicked(null); setMsg('') }} /></div>
        <input className="input grow" placeholder="ค้นหาชื่อ" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาชื่อ" />
      </div>
      {dow(date) !== 0 && <p className="small" style={{ color: 'var(--bad)' }}>วันที่นี้ไม่ใช่วันอาทิตย์ — ถ้าเป็นการนมัสการพิเศษก็บันทึกได้</p>}
      {tooOld && <p className="small" style={{ color: 'var(--bad)' }}>บันทึกได้เฉพาะ {yearOf(todayISO()) - YEARS_BACK + 543}–{yearOf(todayISO()) + 543} (ช่วงที่หน้าตรวจสอบอ่าน)</p>}
      {list.length === 0 ? <p className="empty">ยังไม่มีสมาชิกในทะเบียน</p> : (
        <ul className="list" style={{ maxHeight: '55vh', overflow: 'auto' }}>
          {shown.map((m) => <li key={m.id}><label className="item"><input type="checkbox" checked={sel.has(m.id)} onChange={() => toggle(m.id)} /><span className="grow"><b>{m.name}</b>{m.nick ? <span className="small muted"> · {m.nick}</span> : null}</span></label></li>)}
        </ul>
      )}
      <div className="row row--between">
        <span>มา <b>{sel.size}</b> คน{rec ? ` · เคยบันทึกไว้ ${rec.ids.length} คน` : ''}</span>
        <button type="button" className="btn btn--gold" disabled={tooOld || !date} onClick={save}>บันทึกการลงชื่อ</button>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
    </section>
  )
}

/** id ใหม่ที่ไม่ซ้ำกับที่มีอยู่ (นำเข้าหลายร้อยคนในมิลลิวินาทีเดียว newId ชนกันได้) */
const uniqueId = (taken: Set<string>) => { let id = newId('cm'); while (taken.has(id)) id = newId('cm'); taken.add(id); return id }
const statusKey = (st?: string) => (st ?? '').trim() || '(ไม่ระบุ)'

function Roster({ rows, onOpen, members, canEdit, put, remove, putAttendance, existing }: { rows: Evaluated[]; onOpen: (id: string) => void; members: ChurchMember[]; canEdit: boolean; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean; putAttendance: (x: Attendance[]) => boolean; existing: (d: string) => Attendance | undefined }) {
  const [edit, setEdit] = useState<ChurchMember | 'new' | null>(null)
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [grp, setGrp] = useState('')
  const [sort, setSort] = useState<'code' | 'name' | 'visits' | 'last'>('code')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const memberFile = useRef<HTMLInputElement>(null)
  const attFile = useRef<HTMLInputElement>(null)
  const statuses = [...new Set(members.map((m) => statusKey(m.status)))].sort()
  const groups = [...new Set(members.map((m) => m.group).filter(Boolean))].sort() as string[]
  const count = (f: (m: ChurchMember) => boolean) => members.filter(f).length
  const t = q.trim().toLowerCase().replace(/\s+/g, '')
  const info = new Map(rows.map((r) => [r.member.id, r]))
  const order: Record<typeof sort, (a: ChurchMember, b: ChurchMember) => number> = {
    code: (a, b) => (Number(a.code) || 1e9) - (Number(b.code) || 1e9),
    name: () => 0,
    visits: (a, b) => (info.get(b.id)?.visits ?? 0) - (info.get(a.id)?.visits ?? 0),
    last: (a, b) => ((info.get(b.id)?.last ?? '') > (info.get(a.id)?.last ?? '') ? 1 : -1),
  }
  const list = [...members].sort((a, b) => order[sort](a, b) || a.name.localeCompare(b.name, 'th'))
    .filter((m) => (!st || statusKey(m.status) === st) && (!grp || m.group === grp))
    .filter((m) => !t || `${m.name}${m.nick ?? ''}${m.code ?? ''}${m.tel ?? ''}${m.note ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t))
  const tierOf = new Map(rows.map((r) => [r.member.id, r.tier]))
  const readCsv = async (f: File | undefined): Promise<string[][] | null> => {
    if (!f) return null
    try { return /\.xlsx$/i.test(f.name) ? await readXlsxRows(f) : parseCSV(await f.text()) } catch { setMsg('อ่านไฟล์ไม่ได้ — ใช้ไฟล์ .xlsx หรือ CSV'); return null }
  }
  const importMembers = async (f: File | undefined) => {
    setBusy(true)
    try {
      const rows = await readCsv(f)
      if (!rows) return
      const r = parseMemberRows(rows)
      if (!r) return setMsg('ไม่พบคอลัมน์ “ชื่อ” ในแถวแรกของไฟล์ (แถวแรกต้องเป็นหัวคอลัมน์ เช่น รหัส, ชื่อ สกุล, ชื่อเล่น, สถานะ, กลุ่ม, โทร, วันเกิด)')
      // จับคู่คนเดิม: รหัสตรงกัน (ถ้าซ้ำหลายคน เลือกคนที่ชื่อตรงก่อน) · ไม่มีรหัส: ชื่อตรงกัน · คนเดิมหนึ่งคนใช้ได้ครั้งเดียวต่อไฟล์ (ชื่อ/รหัสซ้ำในไฟล์ = คนละคน นำเข้าซ้ำจึงไม่เพิ่มคนซ้ำ)
      const key = (m: { name: string }) => m.name.replace(/\s+/g, '')
      const used = new Set<string>()
      const pick = (n: { name: string; code?: string }) => {
        const pool = members.filter((m) => !used.has(m.id) && (n.code ? m.code === n.code : key(m) === key(n)))
        return pool.find((m) => key(m) === key(n)) ?? pool[0]
      }
      let added = 0, updated = 0
      const batch: ChurchMember[] = []
      const taken = new Set(members.map((m) => m.id))
      const freshId = () => uniqueId(taken)
      for (const n of r.members) {
        const old = pick(n)
        if (old) { updated++; used.add(old.id) } else added++
        batch.push({ ...old, ...n, id: old?.id ?? freshId(), updated: 0 })
      }
      if (put(batch)) setMsg(`นำเข้าแล้ว ${batch.length} คน: เพิ่มใหม่ ${added} · อัปเดตคนเดิม ${updated}${r.skipped ? ` · ข้าม ${r.skipped} แถวที่ไม่มีชื่อ` : ''}`)
    } finally { setBusy(false) }
  }
  const importAttendance = async (f: File | undefined) => {
    setBusy(true)
    try {
      const rows = await readCsv(f)
      if (!rows) return
      const r = parseAttendanceRows(rows)
      if (!r) return setMsg('ไฟล์ลงชื่อต้องมีคอลัมน์ “วันที่” และ “ชื่อ-สกุล” (1 แถว = 1 คนที่มา)')
      const thisYear = yearOf(todayISO())
      const inRange = [...r.byDate].filter(([d]) => yearOf(d) >= thisYear - YEARS_BACK && yearOf(d) <= thisYear)
      const outOfRange = r.byDate.size - inRange.length
      // ชื่อที่ยังไม่อยู่ในทะเบียน: ถามก่อนเพิ่ม (ทะเบียนเป็นตัวหลัก ไม่เพิ่มเองเงียบ ๆ)
      const names = inRange.flatMap(([, n]) => n)
      const unknown = [...new Map(matchNames([...new Set(names)], members).unknown.map((n) => [nameKey(n), n])).values()]
      let added: ChurchMember[] = []
      if (unknown.length && confirm(`พบ ${unknown.length} ชื่อในไฟล์ที่ยังไม่อยู่ในทะเบียน (เช่น ${unknown.slice(0, 3).join(', ')})\n\nตกลง = เพิ่มเป็นสมาชิกใหม่แล้วนับการมาด้วย\nยกเลิก = ข้ามชื่อเหล่านี้`)) {
        const taken = new Set(members.map((m) => m.id))
        added = unknown.map((n) => { const i = r.info.get(nameKey(n)); return { id: uniqueId(taken), name: i?.name ?? n, ...(i?.nick ? { nick: i.nick } : {}), status: i?.status ?? '4.ผู้ร่วมนมัสการ', ...(i?.group ? { group: i.group } : {}), updated: 0 } })
        if (!put(added)) return
      }
      const pool = [...members, ...added]
      const batch: Attendance[] = []
      const still = new Set<string>(), ambiguous = new Set<string>()
      let visits = 0
      for (const [date, ns] of inRange) {
        const m = matchNames(ns, pool)
        m.unknown.forEach((x) => still.add(x)); m.ambiguous.forEach((x) => ambiguous.add(x))
        const old = existing(date)
        const ids = [...new Set([...(old?.ids ?? []), ...m.ids])] // รวมกับที่เคยลงชื่อไว้ ไม่ทับ
        visits += m.ids.length
        batch.push({ id: date, date, ids, updated: 0 })
      }
      if (putAttendance(batch)) setMsg(`นำเข้าลงชื่อ ${batch.length} ครั้ง (${visits.toLocaleString('th-TH')} การมา)${added.length ? ` · เพิ่มสมาชิกใหม่ ${added.length} คน` : ''}${outOfRange ? ` · ข้าม ${outOfRange} วันที่อยู่นอกช่วง ${thisYear - YEARS_BACK + 543}–${thisYear + 543}` : ''}${r.bad ? ` · ข้าม ${r.bad} แถวที่วันที่/ชื่อไม่ถูกต้อง` : ''}${still.size ? ` · ไม่ได้จับคู่ ${still.size} ชื่อ (เช่น ${[...still].slice(0, 3).join(', ')})` : ''}${ambiguous.size ? ` · ชื่อซ้ำหลายคน ไม่ได้เดา ${ambiguous.size} ชื่อ (${[...ambiguous].slice(0, 3).join(', ')})` : ''}`)
    } finally { setBusy(false) }
  }
  return (
    <>
      {canEdit && (
        <div className="row no-print">
          <button type="button" className="btn btn--gold" onClick={() => setEdit('new')}>＋ เพิ่มสมาชิก</button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => memberFile.current?.click()}>{busy ? 'กำลังนำเข้า…' : 'นำเข้ารายชื่อ (.xlsx / CSV)'}</button>
          <button type="button" className="btn btn--ghost" onClick={() => attFile.current?.click()}>นำเข้าลงชื่อ (.xlsx / CSV)</button>
          <input ref={memberFile} hidden type="file" aria-label="ไฟล์รายชื่อ" accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => { importMembers(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={attFile} hidden type="file" aria-label="ไฟล์ลงชื่อ" accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => { importAttendance(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      )}
      {msg && <p className="small" role="status">{msg}</p>}
      {statuses.length > 1 && (
        <div className="row no-print" aria-label="กรองตามสถานะ">
          <button type="button" className={`mini${st === '' ? ' on' : ''}`} onClick={() => setSt('')}>ทั้งหมด · {members.length}</button>
          {statuses.map((x) => <button key={x} type="button" className={`mini${st === x ? ' on' : ''}`} onClick={() => setSt(st === x ? '' : x)}>{x} · {count((m) => statusKey(m.status) === x)}</button>)}
        </div>
      )}
      <div className="row no-print">
        <input className="input grow" placeholder="ค้นหา ชื่อ / ชื่อเล่น / รหัส / โทร / หมายเหตุ" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="เรียงตาม"><option value="code">เรียงตามรหัส</option><option value="name">เรียงตามชื่อ</option><option value="visits">มานมัสการมากสุด</option><option value="last">มาล่าสุด</option></select>
        {groups.length > 0 && <select className="input" style={{ width: 'auto' }} value={grp} onChange={(e) => setGrp(e.target.value)} aria-label="กรองตามกลุ่ม"><option value="">ทุกกลุ่ม</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>}
      </div>
      <p className="small muted">แสดง {list.length} จาก {members.length} คน · แตะชื่อเพื่อดูข้อมูลครบทุกช่อง</p>
      <section className="card">
        {list.length === 0 ? <p className="empty">{members.length ? 'ไม่พบรายชื่อตามที่กรอง' : `ยังไม่มีสมาชิก${canEdit ? ' — เพิ่มทีละคน หรือนำเข้าไฟล์ .xlsx / CSV (หัวคอลัมน์: รหัส, ชื่อ สกุล, ชื่อเล่น, สถานะ, กลุ่ม, โทร, วันเกิด, หมายเหตุ, ว/ด/ป-เข้าร่วม)' : ''}`}</p> : (
          <ul className="list">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" className="item" style={{ all: 'unset', display: 'flex', gap: '0.6rem', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                  <span className="num muted" style={{ minWidth: '2.6rem' }}>{m.code ? `#${m.code}` : ''}</span>
                  <span className="grow"><b>{m.name}</b>{m.nick ? <span className="muted"> ({m.nick})</span> : null}<br /><span className="small muted">{[m.status, m.group, m.tel].filter(Boolean).join(' · ')}{info.get(m.id)?.visits ? ` · มา ${info.get(m.id)!.visits} ครั้ง` : ''}</span></span>
                  {tierOf.get(m.id) !== undefined && <span className={`badge ${TIER_BADGE[tierOf.get(m.id)!]}`}>{TIER_LABEL[tierOf.get(m.id)!]}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="small muted">ข้อมูลส่วนตัว (เบอร์โทร วันเกิด) เก็บใน repo ข้อมูล (Private) และเห็นได้เฉพาะผู้ใช้ที่มีสิทธิ์ดูรายการรายตัว</p>
      {edit && <MemberForm member={edit === 'new' ? null : edit} onClose={() => setEdit(null)} put={put} remove={remove} />}
    </>
  )
}

/** ข้อมูลรายคนครบทุกช่อง + ผลตรวจ + สถิติการมา */
function Detail({ r, today, canEdit, put, remove, onClose }: { r: Evaluated; today: string; canEdit: boolean; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean; onClose: () => void }) {
  const m = r.member
  const [editing, setEditing] = useState(false)
  if (editing) return <MemberForm member={m} onClose={() => { setEditing(false); onClose() }} put={put} remove={remove} />
  const age = ageText(m.birth, today)
  const rows: [string, ReactNode][] = [
    ['รหัสสมาชิก', m.code], ['ชื่อ-สกุล', m.name], ['ชื่อเล่น', m.nick], ['สถานะในทะเบียน', m.status], ['กลุ่ม', m.group],
    ['โทรศัพท์', m.tel && <a href={`tel:${m.tel}`}>{m.tel}</a>],
    ['วันเกิด', m.birth && `${fmtDate(m.birth)}${age ? ` (อายุ ${age})` : ''}`],
    ['วันที่เข้าร่วม', m.since && `${fmtDate(m.since)} (${r.tenureY.toFixed(1)} ปี)`],
    ['สมัครสมาชิก', m.applied ? 'สมัครแล้ว' : undefined], ['รูป', m.photo && <span className="small muted">{m.photo}</span>], ['หมายเหตุ', m.note],
  ]
  return (
    <Sheet title={m.name} onClose={onClose}>
      <dl style={{ margin: 0 }}>
        {rows.map(([k, v]) => (
          <div key={k} className="row row--between" style={{ borderBottom: '1px solid var(--line)', padding: '0.35rem 0', flexWrap: 'nowrap' }}>
            <dt className="muted small" style={{ flex: 'none', width: '8.5rem' }}>{k}</dt>
            <dd style={{ margin: 0, textAlign: 'right', wordBreak: 'break-word' }}>{v || <span className="muted">—</span>}</dd>
          </div>
        ))}
        <div className="row row--between" style={{ padding: '0.35rem 0', flexWrap: 'nowrap' }}>
          <dt className="muted small" style={{ flex: 'none', width: '8.5rem' }}>ผลตรวจ</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}><span className={`badge ${TIER_BADGE[r.tier]}`}>{TIER_LABEL[r.tier]}</span>{m.override ? <span className="small muted"> (กำหนดเอง)</span> : null}</dd>
        </div>
        <div className="row row--between" style={{ padding: '0.35rem 0', flexWrap: 'nowrap' }}>
          <dt className="muted small" style={{ flex: 'none', width: '8.5rem' }}>การมานมัสการ</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>{r.visits ? `${r.visits} ครั้ง · 12 เดือนล่าสุด ${r.recent} · ครั้งแรก ${fmtDate(r.firstAtt)} · ล่าสุด ${fmtDate(r.last)}` : <span className="muted">ยังไม่มีบันทึกลงชื่อ</span>}</dd>
        </div>
      </dl>
      {canEdit && <div className="row row--between"><span /><button type="button" className="btn" onClick={() => setEditing(true)}>แก้ไขข้อมูล</button></div>}
    </Sheet>
  )
}

function MemberForm({ member, onClose, put, remove }: { member: ChurchMember | null; onClose: () => void; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean }) {
  const [f, setF] = useState({ name: member?.name ?? '', nick: member?.nick ?? '', code: member?.code ?? '', tel: member?.tel ?? '', group: member?.group ?? '', status: member?.status ?? 'สมาชิกสมบูรณ์', since: member?.since ?? '', note: member?.note ?? '', birth: member?.birth ?? '' })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const save = () => {
    if (!f.name.trim()) return setErr('ใส่ชื่อ-สกุล')
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)) as Partial<typeof f>
    if (put([{ ...member, ...Object.fromEntries(Object.keys(f).map((k) => [k, undefined])), ...clean, name: f.name.trim(), id: member?.id ?? newId('cm'), updated: 0 }])) onClose()
  }
  const fields: [keyof typeof f, string, string?][] = [['name', 'ชื่อ-สกุล'], ['nick', 'ชื่อเล่น'], ['code', 'รหัสสมาชิก'], ['tel', 'โทรศัพท์', 'tel'], ['group', 'กลุ่ม'], ['status', 'สถานะ (เช่น สมาชิกสมบูรณ์ · เสียชีวิต · สิ้นสภาพ)'], ['since', 'วันที่เข้าเป็นสมาชิก', 'date'], ['birth', 'วันเกิด', 'date'], ['note', 'หมายเหตุ']]
  return (
    <Sheet title={member ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก'} onClose={onClose}>
      {fields.map(([k, l, type]) => <div className="field" key={k}><label htmlFor={`m-${k}`}>{l}</label><input id={`m-${k}`} className="input" type={type ?? 'text'} value={f[k]} onChange={set(k)} /></div>)}
      {err && <p role="alert" style={{ color: 'var(--bad)' }}>{err}</p>}
      <div className="row row--between">
        {member ? <button type="button" className="btn btn--danger" onClick={() => confirm(`ลบ ${member.name} ออกจากทะเบียน? (กู้คืนไม่ได้จากหน้านี้ แต่ประวัติลงชื่อเดิมไม่หาย)`) && remove(member.id) && onClose()}>ลบ</button> : <span />}
        <button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>
      </div>
    </Sheet>
  )
}

const MAX_BARS = 26

/** ยอดผู้เข้าร่วมแต่ละครั้ง: กราฟ + ตาราง (แตะแถวดูรายชื่อคนที่มา) */
function Stats({ attendance, members, onOpen }: { attendance: Attendance[]; members: ChurchMember[]; onOpen: (id: string) => void }) {
  const stats = useMemo(() => serviceStats(attendance, members), [attendance, members])
  const [open, setOpen] = useState('')
  const byName = useMemo(() => new Map(members.map((m) => [m.name, m.id])), [members])
  if (stats.length === 0) return <p className="empty">ยังไม่มีบันทึกลงชื่อนมัสการ — นำเข้าไฟล์ลงชื่อที่แท็บ “ทะเบียน” หรือลงชื่อทีละครั้งที่แท็บ “ลงชื่อ”</p>
  const total = stats.reduce((a, x) => a + x.count, 0)
  const recent = stats.slice(0, MAX_BARS).reverse()
  const max = Math.max(1, ...recent.map((x) => x.count))
  const peak = stats.reduce((a, x) => (x.count > a.count ? x : a), stats[0])
  const last12 = stats.filter((x) => x.date >= `${yearOf(stats[0].date) - 1}${stats[0].date.slice(4)}`)
  const avg = (xs: typeof stats) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.count, 0) / xs.length) : 0)
  const complete = (x: (typeof stats)[number]) => Object.entries(x.byStatus).filter(([st]) => /สมบูรณ์/.test(st)).reduce((a, [, n]) => a + n, 0)
  const W = 360, H = 130, bw = W / recent.length
  return (
    <>
      <div className="kpi">
        <div><span>จำนวนครั้งที่มีบันทึก</span><b>{stats.length}</b></div>
        <div><span>เฉลี่ยต่อครั้ง (ทั้งหมด)</span><b>{avg(stats)}</b></div>
        <div><span>เฉลี่ยต่อครั้ง (12 เดือนล่าสุด)</span><b>{avg(last12)}</b></div>
        <div><span>ล่าสุด {fmtDate(stats[0].date)}</span><b>{stats[0].count}</b></div>
        <div><span>สูงสุด {fmtDate(peak.date)}</span><b>{peak.count}</b></div>
        <div><span>รวมการมาทั้งหมด</span><b>{total.toLocaleString('th-TH')}</b></div>
      </div>
      <section className="card">
        <h2>ผู้เข้าร่วมแต่ละครั้ง (ล่าสุด {recent.length} ครั้ง)</h2>
        <figure className="chart" style={{ margin: 0 }} aria-label="จำนวนผู้เข้าร่วมนมัสการแต่ละครั้ง">
          <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`จำนวนผู้เข้าร่วม ${recent.map((x) => `${fmtDate(x.date)} ${x.count} คน`).join(', ')}`}>
            <line className="grid" x1={0} x2={W} y1={H} y2={H} />
            {recent.map((x, i) => {
              const h = Math.max(2, (x.count / max) * (H - 16))
              return (
                <g key={x.date}>
                  <rect className="s1" x={i * bw + 1.5} y={H - h} width={Math.max(2, bw - 3)} height={h} rx={2}><title>{`${fmtDate(x.date)} · ${x.count} คน`}</title></rect>
                  {(recent.length <= 13 || i % 2 === 0) && <text className="val" x={i * bw + bw / 2} y={H - h - 3} textAnchor="middle" fontSize="8">{x.count}</text>}
                </g>
              )
            })}
            <text x={0} y={H + 13} fontSize="9">{fmtDate(recent[0].date)}</text>
            <text x={W} y={H + 13} fontSize="9" textAnchor="end">{fmtDate(recent[recent.length - 1].date)}</text>
          </svg>
        </figure>
      </section>
      <section className="card" aria-label="ตารางผู้เข้าร่วมแต่ละครั้ง">
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>วันที่ (แตะดูรายชื่อ)</th><th className="num">รวม</th><th className="num">สมาชิกสมบูรณ์</th><th className="num">อื่น ๆ</th></tr></thead>
            <tbody>
              {stats.map((x) => (
                <>
                  <tr key={x.date} onClick={() => setOpen(open === x.date ? '' : x.date)} style={{ cursor: 'pointer' }} aria-expanded={open === x.date}>
                    <td>{open === x.date ? '▾' : '▸'} {fmtDate(x.date)}</td><td className="num"><b>{x.count}</b></td>
                    <td className="num">{complete(x)}</td><td className="num">{x.count - complete(x)}</td>
                  </tr>
                  {open === x.date && <tr key={`${x.date}-n`}><td colSpan={4} className="small"><p className="muted" style={{ margin: '0 0 0.3rem' }}>{Object.entries(x.byStatus).sort().map(([st, n]) => `${statusLabel(st)} ${n}`).join(' · ')}</p>{x.names.map((n, i) => <span key={n + i}>{i ? ' · ' : ''}<button type="button" style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => byName.get(n) && onOpen(byName.get(n)!)}>{n}</button></span>)}</td></tr>}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
