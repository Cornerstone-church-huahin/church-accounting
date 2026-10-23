import { PrintFrame } from '../components/Credit'
import { cleanName, applyNameFix, planNameClean } from '../lib/nameClean'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import StoredImage from '../components/StoredImage'
import MemberAvatar from '../components/MemberAvatar'
import { removeMemberPhotoFile, uploadMemberPhoto } from '../lib/memberPhoto'
import { getSync } from '../lib/sync'
import { can } from '../lib/access'
import AccountLinks from '../components/AccountLinks'
import { useAttendance, useChurchMembers, useRecorders, useSettings } from '../lib/data'
import { useRole } from '../lib/members'
import { fmtDate, newId, todayISO, yearOf } from '../lib/money'
import { ageText, bandLabel, bandOf, DEFAULT_CRITERIA, evaluate, regLevel, matchNames, matchPhotoFile, NEW_PERSON_STATUS, nameKey, serviceStats, statusLabel, statusOptions, statusShort, toAttendance, checkInId, uniqueId, parseAttendanceRows, parseMemberRows, summarize, type Evaluated } from '../lib/registry'
import { parseCSV } from '../lib/statement'
import { readXlsxRows } from '../lib/xlsx'
import { useLocation, useSearchParams } from 'react-router-dom'
import TileTabs from '../components/TileTabs'
import { formatCoord, hasCoord, mapsLink, parseCoords, type Coord } from '../lib/geo'
const LeafletMap = lazy(() => import('../components/LeafletMap'))
import CheckinPanel, { RecorderChip } from '../components/CheckinPanel'
import BirthdayList from '../components/BirthdayList'
import GenderView from '../components/GenderView'
import type { Attendance, CheckIn, ChurchMember, Recorder } from '../lib/types'

type Tab = 'audit' | 'checkin' | 'roster' | 'stats' | 'birth' | 'gender'
const YEARS_BACK = 3 // โหลดบันทึกลงชื่อย้อนหลัง 4 ปี (ปีนี้ + 3 ปี) · ระดับ "ขาดเกิน N ปี" จึงนับได้ไม่เกินช่วงนี้

export default function Members() {
  const role = useRole()
  if (!can(role, 'detail') && !can(role, 'worship')) return <NoAccess />
  return <MembersPage />
}

function MembersPage() {
  const role = useRole()
  const canEdit = can(role, 'registry')
  const canLog = can(role, 'worship')
  const inRoom = useLocation().pathname.startsWith('/meeting') // ในห้องทำงาน: เมนูแท็บเป็นช่องสีเหมือนหน้าแรก
  const startTab = useSearchParams()[0].get('tab') // ไอคอนลัดที่หัวแอปเปิดมาที่แท็บ ลงชื่อ ทันที
  /** ผู้บันทึกการนมัสการ: ไม่เห็นเบอร์โทร วันเกิด สถานะทะเบียน */
  const lite = role === 'worship'
  const thisYear = yearOf(todayISO())
  const people = useChurchMembers()
  const a0 = useAttendance(thisYear), a1 = useAttendance(thisYear - 1, false), a2 = useAttendance(thisYear - 2, false), a3 = useAttendance(thisYear - 3, false)
  const stores = [a3, a2, a1, a0] // ปีเก่า → ใหม่
  const rawItems = useMemo(() => stores.flatMap((st) => st.items), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const attendance = useMemo(() => toAttendance(rawItems), [rawItems])
  const checkins = useMemo(() => rawItems.filter((x): x is CheckIn => 'mid' in x), [rawItems])
  const recorders = useRecorders()
  const { settings, save } = useSettings()
  const criteria = { minYears: settings.memberMinYears ?? DEFAULT_CRITERIA.minYears, absentMonths: settings.memberAbsentMonths ?? DEFAULT_CRITERIA.absentMonths }
  const today = todayISO()
  const result = useMemo(() => evaluate(people.items, attendance, criteria, today), [people.items, attendance, criteria.minYears, criteria.absentMonths, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>(() => (startTab === 'checkin' && canLog ? 'checkin' : lite ? 'checkin' : attendance.length === 0 ? 'roster' : 'audit'))
  const [detail, setDetail] = useState('')
  // ในห้องทำงาน: เปิดมาเห็นเมนูช่องสี 6 ช่องอย่างเดียว · กดช่องไหน เมนูหายและหน้านั้นเต็มจอ · ‹ เมนูสมาชิก กลับมาเห็นช่องทั้งหก
  const [menu, setMenu] = useState(inRoom && !startTab)
  const [editId, setEditId] = useState('') // แก้ข้อมูลคนจากหน้าลงชื่อ (ไม่มีปุ่มลบสมาชิก)
  const editMember = editId ? people.items.find((m) => m.id === editId) : undefined
  useEffect(() => { if (startTab === 'checkin' && canLog) setTab('checkin') }, [startTab, canLog])
  const byId = new Map(result.rows.map((r) => [r.member.id, r]))
  const shownDetail = detail ? byId.get(detail) : undefined
  /** บันทึกรายการลงชื่อ (แยกไฟล์ตามปีของวันที่) */
  const putCheckIns = (items: CheckIn[]) => {
    for (const st of stores) {
      const y = thisYear - (stores.length - 1 - stores.indexOf(st))
      const mine = items.filter((x) => yearOf(x.date) === y)
      if (mine.length && !st.put(mine)) return false
    }
    return true
  }
  const tabItems = (lite ? [['checkin', 'ลงชื่อ', '✍️'], ['stats', 'ยอดผู้มา', '📊'], ['roster', 'ทะเบียน', '📒']] as const : [['audit', 'ตรวจสอบ', '🔍'], ['stats', 'ยอดผู้มา', '📊'], ['checkin', 'ลงชื่อ', '✍️'], ['roster', 'ทะเบียน', '📒'], ['birth', 'วันเกิด', '🎂'], ['gender', 'เพศ', '👫']] as const).map(([key, label, icon]) => ({ key, label, icon }))
  if (inRoom && menu) {
    return (
      <>
        <div className="page-head no-print"><h1>สมาชิก</h1><AccountLinks n={2} /></div>
        <TileTabs label="หมวด" value={'' as Tab} onChange={(k) => { setTab(k); setMenu(false) }} items={tabItems} />
      </>
    )
  }
  return (
    <>
      {inRoom && <div className="no-print" style={{ margin: '0 0 0.4rem' }}><button type="button" className="mini" onClick={() => setMenu(true)}>‹ เมนูสมาชิก</button></div>}
      <div className="page-head no-print"><h1>สมาชิก</h1>{canLog && tab === 'checkin' && <RecorderChip recorders={recorders.items} canManage={can(role, 'settings')} put={recorders.put} remove={recorders.remove} />}</div>
      {!inRoom && (
        <div className={`seg ${lite ? 'seg--3' : 'seg--6'} no-print`} role="tablist" aria-label="หมวด">
          {(lite ? [['checkin', 'ลงชื่อ'], ['stats', 'ยอดผู้มา'], ['roster', 'ทะเบียน']] as const : [['audit', 'ตรวจสอบ'], ['stats', 'ยอดผู้มา'], ['checkin', 'ลงชื่อ'], ['roster', 'ทะเบียน'], ['birth', 'วันเกิด'], ['gender', 'เพศ']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      )}
      {!lite && tab === 'audit' && <Audit onOpen={setDetail} result={result} criteria={criteria} canEdit={canEdit} canTune={can(role, 'settings')} today={today} put={people.put} onCriteria={(p) => save(p)} />}
      {!lite && tab === 'gender' && <GenderView members={people.items} canEdit={canEdit} put={people.put} onOpen={setDetail} />}
      {!lite && tab === 'birth' && <BirthdayList members={people.items} today={today} onOpen={setDetail} />}
      {tab === 'stats' && <Stats attendance={attendance} members={people.items} onOpen={setDetail} />}
      {tab === 'checkin' && (canLog ? <CheckinPanel lite={lite} members={people.items} checkins={checkins} recorders={recorders.items} putCheckIns={putCheckIns} syncNow={a0.syncNow} addMember={people.put} onOpen={setDetail} onEdit={setEditId} minYear={thisYear - YEARS_BACK} /> : <p className="empty">ลงชื่อนมัสการได้เฉพาะผู้บันทึกบัญชีและแอดมิน</p>)}
      {tab === 'roster' && <Roster lite={lite} canLog={canLog} rows={result.rows} onOpen={setDetail} members={people.items} canEdit={canEdit} put={people.put} remove={people.remove} putCheckIns={putCheckIns} checkins={checkins} recorders={recorders.items} putRecorders={recorders.put} canManage={can(role, 'settings')} />}
      {editMember && <MemberForm lite={lite} canDelete={false} member={editMember} statuses={statusOptions(people.items)} groups={groupOptions(people.items)} onClose={() => setEditId('')} put={people.put} remove={people.remove} />}
      {shownDetail && <Detail lite={lite} canLog={canLog} r={shownDetail} statuses={statusOptions(people.items)} groups={groupOptions(people.items)} today={today} canEdit={canEdit} put={people.put} remove={people.remove} onClose={() => setDetail('')} />}
    </>
  )
}

/** ปุ่มสถานะ (ตามทะเบียน) ใช้สีตามระดับ */
const statusBadge = (st?: string) => { const l = regLevel(st); return l === 1 ? 'badge--good' : l === 2 ? 'badge--gold' : /เสียชีวิต|สิ้นสภาพ/.test(st ?? '') ? 'badge--bad' : '' }

/**
 * หน้าตรวจสอบ: สถานะตามทะเบียนเป็นหลัก (จำนวนตรงกับทะเบียนเดิม) + ใช้การลงชื่อนมัสการเตือนว่าใครควรปรับสถานะ
 * (ทะเบียนว่า สมบูรณ์ 1 แต่ขาดนมัสการเกินเกณฑ์ → ควรเป็น สมบูรณ์ 2 · และกลับกัน)
 */
function Audit({ onOpen, result, criteria, canEdit, canTune, today, put, onCriteria }: { onOpen: (id: string) => void; result: ReturnType<typeof evaluate>; criteria: { minYears: number; absentMonths: number }; canEdit: boolean; canTune: boolean; today: string; put: (x: ChurchMember[]) => boolean; onCriteria: (p: { memberMinYears: number; memberAbsentMonths: number }) => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [group, setGroup] = useState('')
  const [menu, setMenu] = useState('')
  const rows = useMemo(() => [...result.rows].sort((a, b) => statusLabel(a.member.status).localeCompare(statusLabel(b.member.status), 'th')), [result.rows])
  const statuses = useMemo(() => { const m = new Map<string, number>(); for (const r of rows) m.set(statusLabel(r.member.status), (m.get(statusLabel(r.member.status)) ?? 0) + 1); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th')) }, [rows])
  const full = rows.filter((r) => regLevel(r.member.status))
  const sum = summarize(full)
  const bands = [0, 0, 0, 0, 0, 0]
  for (const r of full) if (r.tier === 5) bands[bandOf(r)]++
  const to2 = rows.filter((r) => r.suggest === 'to2').length, to1 = rows.filter((r) => r.suggest === 'to1').length
  const groups = [...new Set(rows.map((r) => r.member.group).filter(Boolean))].sort() as string[]
  const shown = rows.filter((r) => {
    if (filter.startsWith('st:') && statusLabel(r.member.status) !== filter.slice(3)) return false
    if (filter === 'to2' && r.suggest !== 'to2') return false
    if (filter === 'to1' && r.suggest !== 'to1') return false
    if (filter.startsWith('band') && !(r.tier === 5 && regLevel(r.member.status) && bandOf(r) === Number(filter.slice(4)))) return false
    if (filter === 'novisit' && !r.noRecord) return false
    if (group && r.member.group !== group) return false
    const t = q.trim().toLowerCase()
    return !t || `${r.member.name} ${r.member.nick ?? ''} ${r.member.code ?? ''} ${r.member.note ?? ''}`.toLowerCase().includes(t)
  })
  const setStatus = (r: Evaluated, st: string) => { setMenu(''); put([{ ...r.member, status: st === '(ไม่ระบุสถานะ)' ? undefined : st, override: undefined }]) }
  if (rows.length === 0) return <p className="empty">ยังไม่มีสมาชิกในทะเบียน — ไปที่แท็บ “ทะเบียน” เพื่อเพิ่มหรือนำเข้าไฟล์ .xlsx / CSV</p>
  const chip = (key: string, label: string, n: number) => <button key={key} type="button" className={`mini${filter === key ? ' on' : ''}`} onClick={() => setFilter(filter === key ? 'all' : key)}>{label} · {n}</button>
  return (
    <>
      <div className="kpi"><div><span>รายชื่อทั้งหมด</span><b>{rows.length}</b></div><div><span>สมาชิกสมบูรณ์ (1+2)</span><b>{full.length}</b></div></div>
      <p className="small muted" style={{ margin: '0.3rem 0' }}>จำนวนตามสถานะในทะเบียน (แตะเพื่อกรอง)</p>
      <div className="chips no-print" aria-label="จำนวนตามสถานะในทะเบียน">{statuses.map(([st, n]) => chip(`st:${st}`, st, n))}</div>
      {!result.hasData
        ? <p className="card small" role="note">ยังไม่มีบันทึกลงชื่อนมัสการ จึงยังตรวจเทียบกับสถานะในทะเบียนไม่ได้ — ไปแท็บ “ลงชื่อ” หรือนำเข้าไฟล์ลงชื่อที่แท็บ “ทะเบียน”</p>
        : (
          <section className="card" aria-label="ตรวจเทียบกับการลงชื่อนมัสการ">
            <h2>ตรวจเทียบกับการลงชื่อนมัสการ</h2>
            <p className="small muted" style={{ margin: 0 }}>เฉพาะสมาชิกสมบูรณ์ {full.length} คน · เกณฑ์: เป็นสมาชิกครบ <b>{criteria.minYears} ปี</b> และไม่มานมัสการเลยตั้งแต่ <b>{fmtDate(result.cutoff)}</b> (ย้อนหลัง {criteria.absentMonths} เดือน) = ขาดการนมัสการ · ข้อมูลลงชื่อ {result.services.length} ครั้ง ({fmtDate(result.services[0])} – {fmtDate(result.services[result.services.length - 1])})</p>
            <div className="kpi">
              <div><span>มานมัสการใน {criteria.absentMonths} เดือน</span><b>{sum.byTier[0]}</b></div>
              <div><span>ขาดเกิน {criteria.absentMonths} เดือน</span><b>{sum.byTier[5]}</b></div>
            </div>
            <div className="row no-print">
              {chip('to2', 'ทะเบียน “สมบูรณ์ 1” แต่ขาดนมัสการ → ควรเป็น สมบูรณ์ 2', to2)}
              {chip('to1', 'ทะเบียน “สมบูรณ์ 2” แต่กลับมานมัสการ → ควรเป็น สมบูรณ์ 1', to1)}
            </div>
            {sum.byTier[5] > 0 && <div className="chips no-print" aria-label="ระดับที่ขาดนมัสการ">{bands.map((n, bi) => n > 0 && chip(`band${bi}`, bandLabel(bi, criteria.absentMonths).replace('ขาดการนมัสการ', 'ขาด'), n))}</div>}
            {canTune && (
              <details className="no-print"><summary className="small">ปรับเกณฑ์ (แอดมิน)</summary>
                <div className="row">
                  <label className="small">ครบกี่ปี <input className="input" type="number" min={0} max={10} step={0.5} defaultValue={criteria.minYears} onBlur={(e) => onCriteria({ memberMinYears: Math.max(0, Number(e.target.value) || 0), memberAbsentMonths: criteria.absentMonths })} /></label>
                  <label className="small">ขาดเกินกี่เดือน <input className="input" type="number" min={1} max={60} defaultValue={criteria.absentMonths} onBlur={(e) => onCriteria({ memberMinYears: criteria.minYears, memberAbsentMonths: Math.max(1, Math.round(Number(e.target.value)) || 1) })} /></label>
                </div>
              </details>
            )}
          </section>
        )}
      <div className="toolbar no-print">
        <input className="input full" placeholder="ค้นหาชื่อ / ชื่อเล่น / รหัส / หมายเหตุ" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="กรอง">
          <option value="all">ทุกสถานะ</option>
          {statuses.map(([st, n]) => <option key={st} value={`st:${st}`}>{st} ({n})</option>)}
          <option value="to2">ควรปรับเป็น สมบูรณ์ 2 ({to2})</option>
          <option value="to1">ควรกลับเป็น สมบูรณ์ 1 ({to1})</option>
          <option value="novisit">ไม่มีบันทึกนมัสการ</option>
        </select>
        {groups.length > 0 && <select className="input" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="กรองตามกลุ่ม"><option value="">ทุกกลุ่ม</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>}
        <button type="button" className="btn btn--ghost full" onClick={() => window.print()}>พิมพ์ / PDF</button>
      </div>
      <p className="small"><b>{shown.length}</b> จาก {rows.length} รายชื่อ · พิมพ์ ณ {fmtDate(today)}</p>
      <section className="card" aria-label="รายชื่อตามสถานะ">
        <ul className="list list--tight">
          {shown.map((r) => (
            <li key={r.member.id}>
              <div className="mrow mrow--tight mrow--top">
                <MemberAvatar path={r.member.photoPath} name={r.member.name} size={56} />
                <div className="mrow__main">
                  <div className="mrow__top">
                    <button type="button" style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }} onClick={() => onOpen(r.member.id)} aria-label={`ดูข้อมูล ${r.member.name}`}>{r.member.name}</button>
                    {canEdit
                      ? <button type="button" className={`badge ${statusBadge(r.member.status)}`} style={{ cursor: 'pointer' }} aria-haspopup="dialog" aria-label={`สถานะ ${statusLabel(r.member.status)} — แตะเพื่อเปลี่ยน`} onClick={() => setMenu(r.member.id)}>{statusShort(r.member.status)} ▾</button>
                      : <span className={`badge ${statusBadge(r.member.status)}`}>{statusShort(r.member.status)}</span>}
                  </div>
                  <div className="mrow__meta">{[r.member.code && `#${r.member.code}`, r.member.nick, r.member.gender && r.member.gender, r.member.group, r.member.birth && `อายุ ${ageText(r.member.birth, today).replace(/ \d+ เดือน$/, '')}`].filter(Boolean).join(' · ')}</div>
                  <div className="mrow__meta">มา {r.visits} ครั้ง ({Math.round(r.cont * 100)}%) · ล่าสุด {r.last ? fmtDate(r.last) : '—'}</div>
                  {r.suggest === 'to2' && <div className="mrow__meta" style={{ color: 'var(--bad)', fontWeight: 600 }}>{bandLabel(bandOf(r), criteria.absentMonths)}{r.idleDays != null ? ` · จริง ${Math.floor(r.idleDays / 30.44)} เดือน` : ''} → ควรเป็น สมบูรณ์ 2</div>}
                  {r.suggest === 'to1' && <div className="mrow__meta" style={{ color: 'var(--good)', fontWeight: 600 }}>กลับมานมัสการแล้ว → ควรกลับเป็น สมบูรณ์ 1</div>}
                </div>
              </div>
              {menu === r.member.id && (
                <Sheet title={`เปลี่ยนสถานะ — ${r.member.name}`} onClose={() => setMenu('')}>
                  <p className="small muted" style={{ margin: 0 }}>เลือกสถานะในทะเบียน (แตะนอกกรอบหรือกด “ปิด” เพื่อยกเลิก)</p>
                  <div className="row" role="menu">
                    {statusOptions(rows.map((x) => x.member)).map((st) => <button key={st} type="button" role="menuitem" className="btn btn--ghost btn--block" disabled={st === statusLabel(r.member.status)} onClick={() => setStatus(r, st)}>{st}{st === statusLabel(r.member.status) ? ' (ปัจจุบัน)' : ''}</button>)}
                  </div>
                </Sheet>
              )}
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="empty">ไม่พบรายชื่อตามที่กรอง</p>}
      </section>
    </>
  )
}

const statusKey = statusLabel

function Roster({ lite, canLog, rows, onOpen, members, canEdit, put, remove, putCheckIns, checkins, recorders, putRecorders, canManage }: { rows: Evaluated[]; onOpen: (id: string) => void; members: ChurchMember[]; lite: boolean; canLog: boolean; canEdit: boolean; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean; putCheckIns: (x: CheckIn[]) => boolean; checkins: CheckIn[]; recorders: Recorder[]; putRecorders: (x: Recorder[]) => boolean; canManage: boolean }) {
  const [edit, setEdit] = useState<ChurchMember | 'new' | null>(null)
  const [nameClean, setNameClean] = useState(false)
  const namePlan = useMemo(() => planNameClean(members), [members])
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [grp, setGrp] = useState('')
  const [gen, setGen] = useState('')
  const [sort, setSort] = useState<'code' | 'name' | 'visits' | 'last'>('code')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const memberFile = useRef<HTMLInputElement>(null)
  const attFile = useRef<HTMLInputElement>(null)
  const photoFiles = useRef<HTMLInputElement>(null)
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
    .filter((m) => (!st || statusKey(m.status) === st) && (!grp || m.group === grp) && (!gen || (gen === 'none' ? !m.gender : m.gender === gen)))
    .filter((m) => !t || `${m.name}${m.nick ?? ''}${m.code ?? ''}${lite ? '' : m.tel ?? ''}${m.note ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t))
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
      for (const n0 of r.members) {
        const f0 = cleanName(n0) // ชื่อมีวงเล็บ: จัดแบบเดียวกับปุ่ม “จัดชื่อ-ชื่อเล่น” เพื่อให้นำเข้าไฟล์เดิมซ้ำแล้วชื่อไม่กลับไปมีวงเล็บ
        const n = f0.kind === 'fix' ? { ...n0, name: f0.name, ...(f0.nick !== undefined ? { nick: f0.nick } : {}), ...(f0.note !== undefined ? { note: f0.note } : {}) } : n0
        const old = pick(n)
        if (old) { updated++; used.add(old.id) } else added++
        batch.push({ ...old, ...n, id: old?.id ?? freshId(), updated: 0 })
      }
      if (put(batch)) setMsg(`นำเข้าแล้ว ${batch.length} คน: เพิ่มใหม่ ${added} · อัปเดตคนเดิม ${updated}${r.skipped ? ` · ข้าม ${r.skipped} แถวที่ไม่มีชื่อ` : ''}`)
    } finally { setBusy(false) }
  }
  /** นำเข้ารูปหลายไฟล์: จับคู่กับรายชื่อจากชื่อไฟล์ · ข้ามคนที่มีรูปแล้ว · อัปโหลดทีละรูป (รันซ้ำต่อจากที่ค้างได้) */
  const importPhotos = async (files: FileList | null) => {
    const imgs = [...(files ?? [])].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name))
    if (!imgs.length) return setMsg('ไม่พบไฟล์รูปที่เลือก')
    if (getSync() === null && !confirm('ยังไม่ได้เชื่อมต่อออนไลน์ — รูปจะเก็บไว้ในเครื่องนี้เท่านั้น (เครื่องอื่นไม่เห็น) ทำต่อไหม?')) return
    setBusy(true)
    try {
      const todo = new Map<string, { m: ChurchMember; f: File }>()
      const unmatched: string[] = []
      let had = 0
      for (const f of imgs) {
        const m = matchPhotoFile(f.name, members)
        if (!m) unmatched.push(f.name)
        else if (m.photoPath || todo.has(m.id)) had++
        else todo.set(m.id, { m, f })
      }
      let done = 0
      const failed: string[] = []
      let pending: ChurchMember[] = []
      const flush = () => { if (pending.length) { put(pending); pending = [] } }
      for (const { m, f } of todo.values()) {
        setMsg(`กำลังอัปโหลดรูป ${done + failed.length + 1}/${todo.size} …`)
        try { pending.push({ ...m, photoPath: await uploadMemberPhoto(m.id, f) }); done++ } catch (e) { failed.push(`${f.name}: ${e instanceof Error ? e.message : 'ไม่สำเร็จ'}`); if (failed.length >= 3 && done === 0) break }
        if (pending.length >= 10) flush()
      }
      flush()
      setMsg(`รูปที่เลือก ${imgs.length} ไฟล์: ใส่ให้สมาชิกแล้ว ${done} คน${had ? ` · ข้าม ${had} (มีรูปแล้ว/ซ้ำคนเดียวกัน)` : ''}${unmatched.length ? ` · จับคู่ชื่อไม่ได้ ${unmatched.length} ไฟล์ (เช่น ${unmatched.slice(0, 3).join(', ')})` : ''}${failed.length ? ` · อัปโหลดไม่สำเร็จ ${failed.length} (${failed[0]}) — กดนำเข้ารูปอีกครั้งเพื่อทำต่อ` : ''}`)
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
      // ลงชื่อ 1 คน × 1 วัน: คนเดียวกันซ้ำในวันเดียวกันนับครั้งเดียว (เก็บเวลาที่เร็วที่สุด) · ที่เคยลงชื่อแล้วไม่ทับ
      const have = new Set(checkins.filter((c) => !c.deleted).map((c) => c.id))
      const exactBy = new Map<string, ChurchMember | undefined>()
      const resolve = (name: string) => { if (!exactBy.has(name)) { const m = matchNames([name], pool); exactBy.set(name, m.ids.length ? pool.find((x) => x.id === m.ids[0]) : undefined); if (m.unknown.length) still.add(name); if (m.ambiguous.length) ambiguous.add(name) } return exactBy.get(name) }
      const still = new Set<string>(), ambiguous = new Set<string>()
      const batch = new Map<string, CheckIn>()
      let dup = 0, skippedExisting = 0
      const inRangeDates = new Set(inRange.map(([d]) => d))
      const recNames = new Set<string>()
      for (const row of r.rows.filter((x) => inRangeDates.has(x.date))) {
        const m = resolve(row.name)
        if (!m) continue
        const id = checkInId(row.date, m.id)
        if (have.has(id)) { skippedExisting++; continue }
        const prev = batch.get(id)
        if (prev) { dup++; if (row.tm && (!prev.tm || row.tm < prev.tm)) prev.tm = row.tm; continue }
        if (row.rec) recNames.add(row.rec)
        batch.set(id, { id, date: row.date, mid: m.id, ...(row.tm ? { tm: row.tm } : {}), ...(row.rec ? { rec: row.rec } : {}), updated: 0 })
      }
      // ผู้บันทึกในไฟล์ที่ยังไม่อยู่ในรายชื่อผู้บันทึก: แอดมินเพิ่มให้อัตโนมัติ (ผู้บันทึกบัญชีเพิ่มไม่ได้ ชื่อยังเก็บในรายการลงชื่อ)
      const newRecs = canManage ? [...recNames].filter((n) => !recorders.some((x) => nameKey(x.name) === nameKey(n))) : []
      if (newRecs.length) { const taken = new Set(recorders.map((x) => x.id)); putRecorders(newRecs.map((name) => ({ id: uniqueId(taken, 'rc'), name, updated: 0 }))) }
      if (putCheckIns([...batch.values()])) setMsg(`นำเข้าลงชื่อ ${new Set([...batch.values()].map((c) => c.date)).size} ครั้ง (${batch.size.toLocaleString('th-TH')} การมา)${dup ? ` · คนเดียวกันซ้ำในวันเดียวกัน ${dup} แถว นับครั้งเดียว` : ''}${skippedExisting ? ` · ข้าม ${skippedExisting} ที่เคยลงชื่อแล้ว` : ''}${newRecs.length ? ` · เพิ่มผู้บันทึก ${newRecs.length} คน` : ''}${added.length ? ` · เพิ่มสมาชิกใหม่ ${added.length} คน` : ''}${outOfRange ? ` · ข้าม ${outOfRange} วันที่อยู่นอกช่วง ${thisYear - YEARS_BACK + 543}–${thisYear + 543}` : ''}${r.bad ? ` · ข้าม ${r.bad} แถวที่วันที่/ชื่อไม่ถูกต้อง` : ''}${still.size ? ` · ไม่ได้จับคู่ ${still.size} ชื่อ (เช่น ${[...still].slice(0, 3).join(', ')})` : ''}${ambiguous.size ? ` · ชื่อซ้ำหลายคน ไม่ได้เดา ${ambiguous.size} ชื่อ (${[...ambiguous].slice(0, 3).join(', ')})` : ''}`)
    } finally { setBusy(false) }
  }
  return (
    <PrintFrame>
      {canLog && (
        <div className="toolbar no-print">
          <button type="button" className="btn btn--gold full" onClick={() => setEdit('new')}>＋ เพิ่มสมาชิก</button>
          {canEdit && <><button type="button" className="btn btn--ghost" disabled={busy} onClick={() => memberFile.current?.click()}>{busy ? 'กำลังนำเข้า…' : 'นำเข้ารายชื่อ'}</button>
          <button type="button" className="btn btn--ghost" onClick={() => attFile.current?.click()}>นำเข้าลงชื่อ</button>
          <button type="button" className="btn btn--ghost full" disabled={busy} onClick={() => photoFiles.current?.click()}>นำเข้ารูป (หลายไฟล์)</button>
          {namePlan.fixes.length + namePlan.review.length > 0 && <button type="button" className="btn btn--gold full" onClick={() => setNameClean(true)}>จัดชื่อ-ชื่อเล่น ({namePlan.fixes.length + namePlan.review.length} คน)</button>}
          <input ref={photoFiles} hidden multiple type="file" aria-label="ไฟล์รูป" accept="image/*" onChange={(e) => { importPhotos(e.target.files); e.target.value = '' }} />
          <input ref={memberFile} hidden type="file" aria-label="ไฟล์รายชื่อ" accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => { importMembers(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={attFile} hidden type="file" aria-label="ไฟล์ลงชื่อ" accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => { importAttendance(e.target.files?.[0]); e.target.value = '' }} /></>}
        </div>
      )}
      {msg && <p className="small" role="status">{msg}</p>}
      {!lite && statuses.length > 1 && (
        <div className="chips no-print" aria-label="กรองตามสถานะ">
          <button type="button" className={`mini${st === '' ? ' on' : ''}`} onClick={() => setSt('')}>ทั้งหมด · {members.length}</button>
          {statuses.map((x) => <button key={x} type="button" className={`mini${st === x ? ' on' : ''}`} onClick={() => setSt(st === x ? '' : x)}>{x} · {count((m) => statusKey(m.status) === x)}</button>)}
        </div>
      )}
      <div className="toolbar toolbar--3 no-print">
        <input className="input full" placeholder={lite ? 'ค้นหา ชื่อ / ชื่อเล่น / รหัส / หมายเหตุ' : 'ค้นหา ชื่อ / ชื่อเล่น / รหัส / โทร / หมายเหตุ'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        <select className="input" value={gen} onChange={(e) => setGen(e.target.value)} aria-label="กรองตามเพศ"><option value="">ทุกเพศ</option><option value="ชาย">ชาย ({count((m) => m.gender === 'ชาย')})</option><option value="หญิง">หญิง ({count((m) => m.gender === 'หญิง')})</option><option value="none">ไม่ระบุเพศ ({count((m) => !m.gender)})</option></select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="เรียงตาม"><option value="code">เรียงตามรหัส</option><option value="name">เรียงตามชื่อ</option><option value="visits">มานมัสการมากสุด</option><option value="last">มาล่าสุด</option></select>
        {groups.length > 0 && <select className="input" value={grp} onChange={(e) => setGrp(e.target.value)} aria-label="กรองตามกลุ่ม"><option value="">ทุกกลุ่ม</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>}
      </div>
      <p className="pagehint">แสดง {list.length} จาก {members.length} คน · มีรูป {count((m) => !!m.photoPath)} คน · แตะชื่อเพื่อดูข้อมูลครบทุกช่อง</p>
      <section className="card">
        {list.length === 0 ? <p className="empty">{members.length ? 'ไม่พบรายชื่อตามที่กรอง' : `ยังไม่มีสมาชิก${canEdit ? ' — เพิ่มทีละคน หรือนำเข้าไฟล์ .xlsx / CSV (หัวคอลัมน์: รหัส, ชื่อ สกุล, ชื่อเล่น, สถานะ, กลุ่ม, โทร, วันเกิด, หมายเหตุ, ว/ด/ป-เข้าร่วม)' : ''}`}</p> : (
          <ul className="list list--tight">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" className="mrow mrow--tight" onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                  <MemberAvatar path={m.photoPath} name={m.name} size={52} />
                  <span className="mrow__main">
                    <span className="mrow__top"><span><b>{m.name}</b>{m.nick ? <span className="muted"> ({m.nick})</span> : null}{m.code ? <span className="mrow__meta"> #{m.code}</span> : null}</span>{!lite && info.get(m.id)?.suggest && <span className="badge badge--gold" title="การลงชื่อไม่ตรงกับสถานะในทะเบียน">ควรปรับ</span>}</span>
                    <span className="mrow__meta" style={{ display: 'block' }}>{[lite ? undefined : statusShort(m.status), m.gender && m.gender, m.group, !lite && m.birth && `อายุ ${ageText(m.birth, todayISO()).replace(/ \d+ เดือน$/, '')}`, !lite && m.tel].filter(Boolean).join(' · ')}</span>
                    <span className="mrow__meta" style={{ display: 'block' }}>{info.get(m.id)?.visits ? `มา ${info.get(m.id)!.visits} ครั้ง` : 'ยังไม่มีบันทึกลงชื่อ'}{m.photoPath ? ' · 📷' : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!lite && <p className="small muted">ข้อมูลส่วนตัว (เบอร์โทร วันเกิด) เก็บใน repo ข้อมูล (Private) และเห็นได้เฉพาะผู้ใช้ที่มีสิทธิ์ดูรายการรายตัว</p>}
      {nameClean && (
        <Sheet title="จัดชื่อกับชื่อเล่น" onClose={() => setNameClean(false)}>
          <p className="pagehint" style={{ margin: 0 }}>ตัดวงเล็บออกจากชื่อ เหลือชื่อ-นามสกุล · วงเล็บที่เป็นชื่อเล่นไปช่องชื่อเล่น · วงเล็บที่เป็นคำอธิบาย (ลูก… เพื่อน… ภรรยา…) ไปช่องหมายเหตุ · เก็บชื่อเดิมไว้ในข้อมูลเผื่อกู้คืน</p>
          <p style={{ margin: 0 }}><b>จัดให้อัตโนมัติ {namePlan.fixes.length} คน</b> <span className="small muted">(ตัดวงเล็บซ้ำกับชื่อเล่น {namePlan.byHow.strip} · ย้ายไปชื่อเล่น {namePlan.byHow.nick} · ย้ายไปหมายเหตุ {namePlan.byHow.note})</span></p>
          {namePlan.fixes.length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', minHeight: 'var(--tap)', display: 'flex', alignItems: 'center' }}>ดูตัวอย่างก่อน → หลัง</summary>
              <ul className="list list--tight" style={{ maxHeight: '38vh', overflow: 'auto' }}>
                {namePlan.fixes.map(({ member: m, fix }) => (
                  <li key={m.id} style={{ display: 'block' }}>
                    <div className="small muted">{m.name}</div>
                    <div><b>{fix.name}</b>{fix.nick !== undefined && <span> · ชื่อเล่น <b>{fix.nick}</b></span>}{fix.note !== undefined && <span className="small"> · หมายเหตุ: {fix.note}</span>}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {namePlan.review.length > 0 && (
            <>
              <p style={{ margin: 0 }}><b>ให้ตรวจเอง {namePlan.review.length} คน</b> <span className="small muted">(ระบบไม่แน่ใจ ไม่แตะ · แตะชื่อเพื่อแก้เอง)</span></p>
              <ul className="list list--tight" style={{ maxHeight: '30vh', overflow: 'auto' }}>
                {namePlan.review.map(({ member: m, why }) => (
                  <li key={m.id} style={{ display: 'block' }}>
                    <button type="button" className="pick__main" onClick={() => { setNameClean(false); onOpen(m.id) }}><b>{m.name}</b>{m.nick ? <span className="muted"> (ชื่อเล่น {m.nick})</span> : null}<span className="mrow__meta" style={{ display: 'block' }}>{why}</span></button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="btn btn--gold bigbtn btn--block" disabled={namePlan.fixes.length === 0} onClick={() => { if (put(namePlan.fixes.map(({ member, fix }) => applyNameFix(member, fix)))) { setMsg(`จัดชื่อแล้ว ${namePlan.fixes.length} คน${namePlan.review.length ? ` · เหลือให้ตรวจเอง ${namePlan.review.length} คน` : ''}`); setNameClean(false) } }}>จัดให้ {namePlan.fixes.length} คน</button>
        </Sheet>
      )}
      {edit && <MemberForm lite={lite} canDelete={canEdit} member={edit === 'new' ? null : edit} statuses={statusOptions(members)} groups={groupOptions(members)} onClose={() => setEdit(null)} put={put} remove={remove} />}
    </PrintFrame>
  )
}

/** ข้อมูลรายคนครบทุกช่อง + ผลตรวจ + สถิติการมา */
function Detail({ lite, canLog, r, statuses, groups, today, canEdit, put, remove, onClose }: { r: Evaluated; statuses: string[]; groups: string[]; lite: boolean; canLog: boolean; today: string; canEdit: boolean; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean; onClose: () => void }) {
  const m = r.member
  const [editing, setEditing] = useState(false)
  const [photoErr, setPhotoErr] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropPhoto = () => { if (!m.photoPath || !confirm(`ลบรูปของ ${m.name}?`)) return; const old = m.photoPath; if (put([{ ...m, photoPath: undefined }])) void removeMemberPhotoFile(old) }
  const setPhoto = async (f: File | undefined) => {
    if (!f) return
    setBusy(true); setPhotoErr('')
    try { put([{ ...m, photoPath: await uploadMemberPhoto(m.id, f) }]) } catch (e) { setPhotoErr(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ') } finally { setBusy(false) }
  }
  if (editing) return <MemberForm lite={lite} canDelete={canEdit} member={m} statuses={statuses} groups={groups} onClose={() => { setEditing(false); onClose() }} put={put} remove={remove} />
  const age = ageText(m.birth, today)
  const rows: [string, ReactNode][] = [
    ['รหัสสมาชิก', m.code], ['ชื่อ-สกุล', m.name], ['ชื่อเล่น', m.nick], ...(lite ? [] : [['สถานะในทะเบียน', m.status] as [string, ReactNode]]), ['กลุ่ม', m.group],
    ...(lite ? [] : [['โทรศัพท์', m.tel && <a href={`tel:${m.tel}`}>{m.tel}</a>] as [string, ReactNode]]),
    ['เพศ', m.gender && m.gender],
    ...(lite ? [] : [['วันเกิด', m.birth && `${fmtDate(m.birth)}${age ? ` (อายุ ${age})` : ''}`] as [string, ReactNode]]),
    ['วันที่เริ่มมา', m.since && `${fmtDate(m.since)} (${r.tenureY.toFixed(1)} ปี)`],
    ...(lite ? [] : [['พิกัดบ้าน', hasCoord(m) && <a href={mapsLink({ lat: m.lat, lng: m.lng })} target="_blank" rel="noreferrer">{formatCoord({ lat: m.lat, lng: m.lng })} · เปิดแผนที่</a>] as [string, ReactNode]]),
    ['สมัครสมาชิก', m.applied ? 'สมัครแล้ว' : undefined], ['ไฟล์รูปในทะเบียนเดิม', !m.photoPath && m.photo && <span className="small muted">{m.photo.split('/').pop()}</span>], ['หมายเหตุ', m.note],
  ]
  return (
    <Sheet title={m.name} onClose={onClose}>
      {m.photoPath && <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}><StoredImage path={m.photoPath} alt={`รูป ${m.name}`} /></div>}
      {canLog && <div className="row no-print"><button type="button" className="mini" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'กำลังอัปโหลด…' : m.photoPath ? '📷 เปลี่ยนรูป' : '📷 เพิ่มรูป'}</button>{m.photoPath && <button type="button" className="mini" disabled={busy} onClick={dropPhoto}>ลบรูป</button>}<input ref={fileRef} hidden type="file" accept="image/*" aria-label="ไฟล์รูปสมาชิก" onChange={(e) => { setPhoto(e.target.files?.[0]); e.target.value = '' }} />{photoErr && <span role="alert" className="small" style={{ color: 'var(--bad)' }}>{photoErr}</span>}</div>}
      <dl style={{ margin: 0 }}>
        {rows.map(([k, v]) => (
          <div key={k} className="row row--between" style={{ borderBottom: '1px solid var(--line)', padding: '0.35rem 0', flexWrap: 'nowrap' }}>
            <dt className="muted small" style={{ flex: 'none', width: '8.5rem' }}>{k}</dt>
            <dd style={{ margin: 0, textAlign: 'right', wordBreak: 'break-word' }}>{v || <span className="muted">—</span>}</dd>
        </div>
        ))}
        {!lite && (
        <div className="row row--between" style={{ padding: '0.35rem 0', flexWrap: 'nowrap' }}>
          <dt className="muted small" style={{ flex: 'none', width: '8.5rem' }}>เทียบกับการลงชื่อ</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>{r.suggest === 'to2' ? <span style={{ color: 'var(--bad)' }}>ขาดนมัสการเกินเกณฑ์ → ควรเป็น สมบูรณ์ 2</span> : r.suggest === 'to1' ? <span style={{ color: 'var(--good)' }}>กลับมานมัสการ → ควรเป็น สมบูรณ์ 1</span> : regLevel(m.status) ? 'สอดคล้องกับสถานะในทะเบียน' : <span className="muted">ไม่อยู่ในเกณฑ์ตรวจ</span>}</dd>
        </div>
        )}
        <div className="row row--between" style={{ padding: '0.35rem 0', flexWrap: 'nowrap' }}>
          <dt className="muted small" style={{ flex: 'none', width: '8.5rem' }}>การมานมัสการ</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>{r.visits ? `${r.visits} ครั้ง · 12 เดือนล่าสุด ${r.recent} · ครั้งแรก ${fmtDate(r.firstAtt)} · ล่าสุด ${fmtDate(r.last)}` : <span className="muted">ยังไม่มีบันทึกลงชื่อ</span>}</dd>
        </div>
      </dl>
      {canLog && <div className="row row--between"><span /><button type="button" className="btn" onClick={() => setEditing(true)}>แก้ไขข้อมูล</button></div>}
    </Sheet>
  )
}

/** กลุ่มที่มีอยู่จริงในทะเบียน (ใช้เป็นตัวเลือก) */
const groupOptions = (ms: { group?: string }[]) => [...new Set(ms.map((m) => m.group?.trim()).filter(Boolean))] as string[]

function MemberForm({ lite, canDelete, member, statuses, groups, onClose, put, remove }: { lite: boolean; canDelete: boolean; member: ChurchMember | null; statuses: string[]; groups: string[]; onClose: () => void; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean }) {
  const [f, setF] = useState({ name: member?.name ?? '', nick: member?.nick ?? '', code: member?.code ?? '', tel: member?.tel ?? '', group: member?.group ?? '', status: member?.status ?? NEW_PERSON_STATUS, since: member?.since ?? '', note: member?.note ?? '', birth: member?.birth ?? '', gender: member?.gender ?? '' })
  const [err, setErr] = useState('')
  // พิกัดบ้าน: พิมพ์/วางลิงก์ Google Maps · ใช้ตำแหน่งปัจจุบัน · แตะ/ลากหมุดบนแผนที่
  const [coord, setCoord] = useState<Coord | null>(member && hasCoord(member) ? { lat: member.lat, lng: member.lng } : null)
  const [coordText, setCoordText] = useState(member && hasCoord(member) ? formatCoord({ lat: member.lat, lng: member.lng }) : '')
  const [mapOpen, setMapOpen] = useState(false)
  const pickCoord = (c: Coord | null) => { setCoord(c); setCoordText(c ? formatCoord(c) : ''); setErr('') }
  const onCoordText = (v: string) => { setCoordText(v); setCoord(parseCoords(v)) }
  const here = () => {
    if (!navigator.geolocation) return setErr('เครื่องนี้ไม่รองรับการหาตำแหน่ง')
    navigator.geolocation.getCurrentPosition((p) => pickCoord({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }), () => setErr('หาตำแหน่งไม่ได้ — อนุญาตการเข้าถึงตำแหน่ง หรือเลือกบนแผนที่แทน'), { enableHighAccuracy: true, timeout: 15000 })
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const save = () => {
    if (!f.name.trim()) return setErr('ใส่ชื่อ-สกุล')
    if (coordText.trim() && !coord) return setErr('พิกัดบ้านอ่านไม่ได้ — พิมพ์เช่น 12.5684, 99.9577 หรือวางลิงก์ Google Maps หรือเลือกบนแผนที่')
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)) as Partial<typeof f>
    if (put([{ ...member, ...Object.fromEntries(Object.keys(f).map((k) => [k, undefined])), ...clean, gender: f.gender === 'ชาย' || f.gender === 'หญิง' ? f.gender : undefined, genderGuess: f.gender === (member?.gender ?? '') ? member?.genderGuess : undefined, name: f.name.trim(), ...(lite ? {} : { lat: coord?.lat, lng: coord?.lng }), id: member?.id ?? newId('cm'), updated: 0 }])) onClose()
  }
  const text = (k: keyof typeof f, label: string, type = 'text', full = false) => <div className={`field${full ? ' full' : ''}`}><label htmlFor={`m-${k}`}>{label}</label><input id={`m-${k}`} className="input" type={type} value={f[k]} onChange={set(k)} /></div>
  return (
    <Sheet title={member ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก'} onClose={onClose}>
      <div className="formgrid">
        {text('name', 'ชื่อ-สกุล', 'text', true)}
        {text('nick', 'ชื่อเล่น')}
        {text('code', 'รหัสสมาชิก')}
        <div className="field"><label htmlFor="m-gender">เพศ</label>
          <select id="m-gender" className="input" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">— ไม่ระบุ —</option><option>ชาย</option><option>หญิง</option></select>
        </div>
        {!lite && text('tel', 'โทรศัพท์', 'tel')}
        {!lite && <div className="field full"><label htmlFor="m-status">สถานะ</label>
          <select id="m-status" className="input" value={statusLabel(f.status)} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {[...new Set([...statuses, statusLabel(f.status)])].sort((a, b) => a.localeCompare(b, 'th')).map((st) => <option key={st}>{st}</option>)}
          </select>
        </div>}
        <div className="field full"><label htmlFor="m-group">กลุ่ม</label>
          <select id="m-group" className="input" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
            <option value="">— ไม่ระบุ —</option>
            {[...new Set([...groups, f.group].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true })).map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        {!lite && text('birth', `วันเกิด${f.birth ? ` · อายุ ${ageText(f.birth, todayISO())}` : ''}`, 'date')}
        {text('since', 'วันที่เริ่มมา', 'date')}
        {text('note', 'หมายเหตุ', 'text', true)}
        {!lite && (
          <div className="field full">
            <label htmlFor="m-coord">พิกัดบ้าน <span className="muted small">(แสดงบนแผนที่ของงานอภิบาล)</span></label>
            <input id="m-coord" className="input" inputMode="decimal" value={coordText} onChange={(e) => onCoordText(e.target.value)} placeholder="เช่น 12.5684, 99.9577 หรือวางลิงก์ Google Maps" />
            <div className="row" style={{ marginTop: '0.3rem' }}>
              <button type="button" className="mini" onClick={here}>📍 ใช้ตำแหน่งปัจจุบัน</button>
              <button type="button" className="mini" aria-expanded={mapOpen} onClick={() => setMapOpen((v) => !v)}>🗺️ {mapOpen ? 'ซ่อนแผนที่' : 'เลือกบนแผนที่'}</button>
              {coordText && <button type="button" className="mini" onClick={() => pickCoord(null)}>ล้างพิกัด</button>}
              {coord && <a className="mini" href={mapsLink(coord)} target="_blank" rel="noreferrer">เปิดใน Google Maps</a>}
            </div>
            <p className="small muted" role="status" style={{ margin: '0.2rem 0 0' }}>{coord ? `บันทึกพิกัด ${formatCoord(coord)}` : coordText ? 'ยังอ่านพิกัดไม่ได้' : 'ยังไม่มีพิกัด'}</p>
            {mapOpen && <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap label="เลือกพิกัดบ้านบนแผนที่ (แตะหรือลากหมุด)" height={260} pick={coord} onPick={pickCoord} /></Suspense>}
          </div>
        )}
      </div>
      <p className="pagehint">วันที่เริ่มมาแก้ได้ถ้าคลาดเคลื่อน{lite ? '' : ' · อายุคำนวณจากวันเกิดให้ทุกวัน'}</p>
      {err && <p role="alert" style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>}
      <div className="row row--between">
        {member && canDelete ? <button type="button" className="btn btn--danger" onClick={() => confirm(`ลบ ${member.name} ออกจากทะเบียน? (รวมรูปด้วย · กู้คืนไม่ได้จากหน้านี้ แต่ประวัติลงชื่อเดิมไม่หาย)`) && remove(member.id) && (member.photoPath && void removeMemberPhotoFile(member.photoPath), onClose())}>ลบ</button> : <span />}
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
            <thead><tr><th style={{ textAlign: 'left' }}>วันที่ (แตะดูรายชื่อ)</th><th className="num">รวม</th><th className="num">สมาชิกสมบูรณ์</th><th className="num">อื่น ๆ</th><th className="num">ใหม่</th></tr></thead>
            <tbody>
              {stats.map((x) => (
                <>
                  <tr key={x.date} onClick={() => setOpen(open === x.date ? '' : x.date)} style={{ cursor: 'pointer' }} aria-expanded={open === x.date}>
                    <td>{open === x.date ? '▾' : '▸'} {fmtDate(x.date)}</td><td className="num"><b>{x.count}</b></td>
                    <td className="num">{complete(x)}</td><td className="num">{x.count - complete(x)}</td><td className="num">{x.people.some((p) => p.isNew) ? <b className="newcomer">{x.people.filter((p) => p.isNew).length}</b> : <span className="muted">0</span>}</td>
                  </tr>
                  {open === x.date && (
                    <tr key={`${x.date}-n`}>
                      <td colSpan={5} className="small">
                        <p className="muted" style={{ margin: '0 0 0.3rem' }}>{Object.entries(x.byStatus).sort().map(([st, n]) => `${statusLabel(st)} ${n}`).join(' · ')}</p>
                        {x.people.some((p) => p.isNew) && (
                          <p style={{ margin: '0 0 0.4rem' }}><b>คนมาใหม่ {x.people.filter((p) => p.isNew).length} คน:</b>{' '}
                            {x.people.filter((p) => p.isNew).map((p, i) => <span key={p.id}>{i ? ' · ' : ''}<button type="button" className="newcomer" onClick={() => onOpen(p.id)}>{p.name}</button></span>)}
                          </p>
                        )}
                        {x.people.filter((p) => !p.isNew).map((p, i) => <span key={p.id}>{i ? ' · ' : ''}<button type="button" style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onOpen(p.id)}>{p.name}</button></span>)}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
