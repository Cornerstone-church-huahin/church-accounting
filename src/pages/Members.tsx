import { useMemo, useRef, useState } from 'react'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import { can } from '../lib/access'
import { useAttendance, useChurchMembers, useSettings } from '../lib/data'
import { useRole } from '../lib/members'
import { dow, fmtDate, newId, todayISO, weekStart, yearOf } from '../lib/money'
import { bandLabel, bandOf, DEFAULT_CRITERIA, evaluate, matchNames, OVERRIDE_TIER, parseAttendanceRows, parseMemberRows, summarize, TIER_LABEL, type Evaluated, type Tier } from '../lib/registry'
import { parseCSV } from '../lib/statement'
import type { Attendance, ChurchMember, MemberOverride } from '../lib/types'

type Tab = 'audit' | 'checkin' | 'roster'
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
  const [tab, setTab] = useState<Tab>('audit')
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
      <div className="page-head no-print"><h1>ทะเบียนสมาชิก</h1></div>
      <div className="seg no-print" role="tablist" aria-label="หมวด">
        {([['audit', 'ตรวจสอบ'], ['checkin', 'ลงชื่อนมัสการ'], ['roster', 'ทะเบียน']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'audit' && <Audit result={result} criteria={criteria} canEdit={canEdit} canTune={can(role, 'settings')} today={today} put={people.put} onCriteria={(p) => save(p)} />}
      {tab === 'checkin' && (canEdit ? <Checkin members={people.items} existing={existing} put={putAttendance} /> : <p className="empty">ลงชื่อนมัสการได้เฉพาะผู้บันทึกบัญชีและแอดมิน</p>)}
      {tab === 'roster' && <Roster members={people.items} canEdit={canEdit} put={people.put} remove={people.remove} putAttendance={putAttendance} existing={existing} />}
    </>
  )
}

function Audit({ result, criteria, canEdit, canTune, today, put, onCriteria }: { result: ReturnType<typeof evaluate>; criteria: { minYears: number; absentMonths: number }; canEdit: boolean; canTune: boolean; today: string; put: (x: ChurchMember[]) => boolean; onCriteria: (p: { memberMinYears: number; memberAbsentMonths: number }) => void }) {
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
                <span className="grow"><b>{r.member.name}</b>
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

function Roster({ members, canEdit, put, remove, putAttendance, existing }: { members: ChurchMember[]; canEdit: boolean; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean; putAttendance: (x: Attendance[]) => boolean; existing: (d: string) => Attendance | undefined }) {
  const [edit, setEdit] = useState<ChurchMember | 'new' | null>(null)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const memberFile = useRef<HTMLInputElement>(null)
  const attFile = useRef<HTMLInputElement>(null)
  const t = q.trim().toLowerCase()
  const list = [...members].sort((a, b) => a.name.localeCompare(b.name, 'th')).filter((m) => !t || `${m.name} ${m.nick ?? ''} ${m.code ?? ''}`.toLowerCase().includes(t))
  const readCsv = async (f: File | undefined) => (f ? parseCSV(await f.text()) : null)
  const importMembers = async (f: File | undefined) => {
    const rows = await readCsv(f)
    if (!rows) return
    const r = parseMemberRows(rows)
    if (!r) return setMsg('ไม่พบคอลัมน์ “ชื่อ” ในแถวแรกของไฟล์ (แถวแรกต้องเป็นหัวคอลัมน์ เช่น ชื่อ-สกุล, ชื่อเล่น, รหัส, กลุ่ม, สถานะ, เข้าเป็นสมาชิก)')
    // ชื่อ/รหัสตรงกับคนเดิม = อัปเดตคนเดิม (นำเข้าซ้ำไม่เกิดรายชื่อซ้ำ)
    const key = (m: { name: string }) => m.name.replace(/\s+/g, '')
    const byName = new Map(members.map((m) => [key(m), m])), byCode = new Map(members.filter((m) => m.code).map((m) => [m.code, m]))
    let added = 0, updated = 0
    const batch = new Map<string, ChurchMember>()
    for (const n of r.members) {
      const old = (n.code && byCode.get(n.code)) || byName.get(key(n))
      if (old) updated++; else added++
      const id = old?.id ?? newId('cm')
      batch.set(id, { ...(batch.get(id) ?? old), ...n, id, updated: 0 })
    }
    if (put([...batch.values()])) setMsg(`นำเข้าแล้ว: เพิ่มใหม่ ${added} · อัปเดต ${updated}${r.skipped ? ` · ข้าม ${r.skipped} แถวที่ไม่มีชื่อ` : ''}`)
  }
  const importAttendance = async (f: File | undefined) => {
    const rows = await readCsv(f)
    if (!rows) return
    const r = parseAttendanceRows(rows)
    if (!r) return setMsg('ไฟล์ลงชื่อต้องมีคอลัมน์ “วันที่” และ “ชื่อ-สกุล” (1 แถว = 1 คนที่มา)')
    const batch: Attendance[] = []
    const unknown = new Set<string>(), ambiguous = new Set<string>()
    for (const [date, names] of r.byDate) {
      const m = matchNames(names, members)
      m.unknown.forEach((x) => unknown.add(x)); m.ambiguous.forEach((x) => ambiguous.add(x))
      const old = existing(date)
      batch.push({ id: date, date, ids: [...new Set([...(old?.ids ?? []), ...m.ids])], updated: 0 }) // รวมกับที่เคยลงชื่อไว้ ไม่ทับ
    }
    if (putAttendance(batch)) setMsg(`นำเข้าลงชื่อ ${batch.length} วัน${r.bad ? ` · ข้าม ${r.bad} แถวที่วันที่/ชื่อไม่ถูกต้อง` : ''}${unknown.size ? ` · ไม่พบในทะเบียน ${unknown.size} ชื่อ (เช่น ${[...unknown].slice(0, 3).join(', ')})` : ''}${ambiguous.size ? ` · ชื่อซ้ำหลายคน ไม่ได้เดา ${ambiguous.size} ชื่อ (${[...ambiguous].slice(0, 3).join(', ')})` : ''}`)
  }
  return (
    <>
      {canEdit && (
        <div className="row no-print">
          <button type="button" className="btn btn--gold" onClick={() => setEdit('new')}>＋ เพิ่มสมาชิก</button>
          <button type="button" className="btn btn--ghost" onClick={() => memberFile.current?.click()}>นำเข้ารายชื่อ CSV</button>
          <button type="button" className="btn btn--ghost" onClick={() => attFile.current?.click()}>นำเข้าลงชื่อ CSV</button>
          <input ref={memberFile} hidden type="file" accept=".csv,.tsv,.txt" onChange={(e) => { importMembers(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={attFile} hidden type="file" accept=".csv,.tsv,.txt" onChange={(e) => { importAttendance(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      )}
      {msg && <p className="small" role="status">{msg}</p>}
      <input className="input" placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
      <section className="card">
        {list.length === 0 ? <p className="empty">ยังไม่มีสมาชิก{canEdit ? ' — เพิ่มทีละคน หรือนำเข้า CSV (หัวคอลัมน์: ชื่อ-สกุล, ชื่อเล่น, รหัส, โทร, กลุ่ม, สถานะ, เข้าเป็นสมาชิก, หมายเหตุ)' : ''}</p> : (
          <ul className="list">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" className="item" style={{ all: 'unset', display: 'flex', gap: '0.6rem', alignItems: 'center', width: '100%', cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && setEdit(m)}>
                  <span className="grow"><b>{m.name}</b><br /><span className="small muted">{[m.code && `#${m.code}`, m.nick, m.group, m.status, m.since && `เข้า ${fmtDate(m.since)}`].filter(Boolean).join(' · ')}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="small muted">{members.length} คน · เบอร์โทรและข้อมูลส่วนตัวเก็บใน repo ข้อมูล (Private) และเห็นได้เฉพาะผู้ใช้ที่มีสิทธิ์ดูรายการรายตัว</p>
      {edit && <MemberForm member={edit === 'new' ? null : edit} onClose={() => setEdit(null)} put={put} remove={remove} />}
    </>
  )
}

function MemberForm({ member, onClose, put, remove }: { member: ChurchMember | null; onClose: () => void; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean }) {
  const [f, setF] = useState({ name: member?.name ?? '', nick: member?.nick ?? '', code: member?.code ?? '', tel: member?.tel ?? '', group: member?.group ?? '', status: member?.status ?? 'สมาชิกสมบูรณ์', since: member?.since ?? '', note: member?.note ?? '' })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const save = () => {
    if (!f.name.trim()) return setErr('ใส่ชื่อ-สกุล')
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)) as Partial<typeof f>
    if (put([{ ...member, ...Object.fromEntries(Object.keys(f).map((k) => [k, undefined])), ...clean, name: f.name.trim(), id: member?.id ?? newId('cm'), updated: 0 }])) onClose()
  }
  const fields: [keyof typeof f, string, string?][] = [['name', 'ชื่อ-สกุล'], ['nick', 'ชื่อเล่น'], ['code', 'รหัสสมาชิก'], ['tel', 'โทรศัพท์', 'tel'], ['group', 'กลุ่ม'], ['status', 'สถานะ (เช่น สมาชิกสมบูรณ์ · เสียชีวิต · สิ้นสภาพ)'], ['since', 'วันที่เข้าเป็นสมาชิก', 'date'], ['note', 'หมายเหตุ']]
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
