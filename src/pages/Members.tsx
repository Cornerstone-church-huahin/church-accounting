import { PrintFrame } from '../components/Credit'
import { cleanName, applyNameFix, planNameClean } from '../lib/nameClean'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import NoAccess from '../components/NoAccess'
import Sheet from '../components/Sheet'
import StoredImage from '../components/StoredImage'
import MultiPick from '../components/MultiPick'
import MemberAvatar from '../components/MemberAvatar'
import PastoralMembers from '../components/PastoralMembers'
import { removeMemberPhotoFile, uploadMemberPhoto } from '../lib/memberPhoto'
import { getSync } from '../lib/sync'
import { can } from '../lib/access'
import { useAttendance, useChurchMembers, useRecorders, useSettings, useVisitPlans } from '../lib/data'
import { useRole } from '../lib/members'
import { fmtDate, newId, todayISO, yearOf } from '../lib/money'
import { BY_NAME, FORM_DAYS, NEW_MID, familyInvite, formUrl, generalFormUrl, groupInvite, parseReply, personalInvite } from '../lib/memberForm'
import { effectiveRules, needsGender, proposeRegroup, ruleWarnings, targetGroup } from '../lib/ageGroups'
import { DEFAULT_STATUS_RULES, applyStatusMoves, effectiveStatusRules, proposeStatusMoves, reviewAutoMoves, revertStatusMoves, statusRuleWarnings } from '../lib/statusRules'
import { AGE_BANDS, ageYears } from '../lib/pastoral'
import { applyAnswer, diffAnswer, findCandidates, nameVerdict, snapToWorshipDay, spanText, withNoteGuess, type FieldKey } from '../lib/memberImport'
import { ageText, bandLabel, bandOf, DEFAULT_CRITERIA, evaluate, regLevel, matchNames, matchPhotoFile, NEW_PERSON_STATUS, stripStatusNo, nameKey, serviceStats, statusLabel, statusOptions, statusShort, toAttendance, checkInId, uniqueId, parseAttendanceRows, parseMemberRows, summarize, type Evaluated } from '../lib/registry'
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

/** registry = เปิดจากห้องงานฝ่ายทะเบียน (เฉพาะที่นี่มีปุ่มคัดลอกลิงก์แบบกรอกข้อมูล) */
export default function Members({ registry, onMenu }: { registry?: boolean; onMenu?: (inMenu: boolean) => void } = {}) {
  const role = useRole()
  if (!can(role, 'detail') && !can(role, 'worship')) return <NoAccess />
  return <MembersPage registry={registry} onMenu={onMenu} />
}

function MembersPage({ registry, onMenu }: { registry?: boolean; onMenu?: (inMenu: boolean) => void }) {
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
  const worshipDays = useMemo(() => attendance.filter((x) => x.ids.length > 0).map((x) => x.date).sort(), [attendance])   // วันที่มีบันทึกนมัสการในระบบ
  const checkins = useMemo(() => rawItems.filter((x): x is CheckIn => 'mid' in x), [rawItems])
  const recorders = useRecorders()
  const { settings, save } = useSettings()
  const criteria = { minYears: settings.memberMinYears ?? DEFAULT_CRITERIA.minYears, absentMonths: settings.memberAbsentMonths ?? DEFAULT_CRITERIA.absentMonths }
  const today = todayISO()
  const result = useMemo(() => evaluate(people.items, attendance, criteria, today), [people.items, attendance, criteria.minYears, criteria.absentMonths, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>(() => (startTab === 'checkin' && canLog ? 'checkin' : lite ? 'checkin' : attendance.length === 0 && !(registry && canEdit) ? 'roster' : 'audit'))
  const [detail, setDetail] = useState('')
  // ในห้องทำงาน: เปิดมาเห็นเมนูช่องสี 6 ช่องอย่างเดียว · กดช่องไหน เมนูหายและหน้านั้นเต็มจอ · ‹ เมนูสมาชิก กลับมาเห็นช่องทั้งหก
  const [menu, setMenu] = useState(inRoom && !startTab)
  useEffect(() => { onMenu?.(menu) }, [menu, onMenu])
  const [adding, setAdding] = useState(false)
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
  const merged = !!registry && canEdit && !lite // งานทะเบียน: หน้า “รวมสมาชิก” รวมของเดิมแท็บตรวจสอบ+ทะเบียนไว้หน้าเดียว
  const tabItems = (lite ? [['checkin', 'ลงชื่อ', '✍️'], ['stats', 'ยอดผู้มา', '📊'], ['roster', 'ทะเบียน', '📒']] as const : [['audit', registry && canEdit ? 'รวมสมาชิก' : 'ตรวจสอบ', '🔍'], ['stats', 'ยอดผู้มา', '📊'], ['checkin', 'ลงชื่อ', '✍️'], ['roster', 'ทะเบียน', '📒'], ['birth', 'วันเกิด', '🎂'], ['gender', 'เพศ', '👫']] as const).filter(([key]) => !(merged && key === 'roster')).map(([key, label, icon]) => ({ key, label, icon }))
  if (inRoom && menu) {
    return (
      <>
        <div className="page-head no-print"><h1>สมาชิก</h1></div>
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
          {(lite ? [['checkin', 'ลงชื่อ'], ['stats', 'ยอดผู้มา'], ['roster', 'ทะเบียน']] as const : [['audit', registry && canEdit ? 'รวมสมาชิก' : 'ตรวจสอบ'], ['stats', 'ยอดผู้มา'], ['checkin', 'ลงชื่อ'], ['roster', 'ทะเบียน'], ['birth', 'วันเกิด'], ['gender', 'เพศ']] as const).filter(([k]) => !(merged && k === 'roster')).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      )}
      {registry && canEdit && (tab === 'audit' || tab === 'roster') && (
        <><details className="regtools no-print">
          <summary>🛠 เครื่องมือทะเบียน</summary>
          <div className="regtools__grid">
            <button type="button" className="btn btn--gold" onClick={() => setAdding(true)}>＋ เพิ่มสมาชิก</button>
            <FormTools members={people.items} put={people.put} worshipDays={worshipDays} attendance={attendance} />
          </div>
        </details>
        {tab === 'audit' && <Roster toolsOnly attendance={attendance} worshipDays={worshipDays} registry canEdit lite={lite} canLog={canLog} rows={result.rows} onOpen={setDetail} members={people.items} put={people.put} remove={people.remove} putCheckIns={putCheckIns} checkins={checkins} recorders={recorders.items} putRecorders={recorders.put} canManage={can(role, 'settings')} />}</>
      )}
      {registry && canEdit && (tab === 'audit' || tab === 'roster') && <PastoralMembers work={2} onOpen={setDetail} />}
      {!lite && tab === 'audit' && <Audit registry={!!registry && canEdit} onOpen={setDetail} result={result} criteria={criteria} canEdit={canEdit} canTune={can(role, 'settings')} today={today} put={people.put} onCriteria={(p) => save(p)} />}
      {!lite && tab === 'gender' && <GenderView members={people.items} canEdit={canEdit} put={people.put} onOpen={setDetail} />}
      {!lite && tab === 'birth' && <BirthdayList members={people.items} today={today} onOpen={setDetail} />}
      {tab === 'stats' && <Stats attendance={attendance} members={people.items} onOpen={setDetail} />}
      {tab === 'checkin' && (canLog ? <CheckinPanel lite={lite} members={people.items} checkins={checkins} recorders={recorders.items} putCheckIns={putCheckIns} syncNow={a0.syncNow} addMember={people.put} onOpen={setDetail} onEdit={setEditId} minYear={thisYear - YEARS_BACK} /> : <p className="empty">ลงชื่อนมัสการได้เฉพาะผู้บันทึกบัญชีและแอดมิน</p>)}
      {tab === 'roster' && <Roster attendance={attendance} worshipDays={worshipDays} registry={!!registry && canEdit} lite={lite} canLog={canLog} rows={result.rows} onOpen={setDetail} members={people.items} canEdit={canEdit} put={people.put} remove={people.remove} putCheckIns={putCheckIns} checkins={checkins} recorders={recorders.items} putRecorders={recorders.put} canManage={can(role, 'settings')} />}
      {adding && <MemberForm lite={lite} canDelete={false} member={null} statuses={statusOptions(people.items)} groups={groupOptions(people.items)} onClose={() => setAdding(false)} put={people.put} remove={people.remove} />}
      {editMember && <MemberForm lite={lite} canDelete={false} member={editMember} statuses={statusOptions(people.items)} groups={groupOptions(people.items)} onClose={() => setEditId('')} put={people.put} remove={people.remove} />}
      {shownDetail && <Detail worshipDays={worshipDays} lite={lite} canLog={canLog} r={shownDetail} statuses={statusOptions(people.items)} groups={groupOptions(people.items)} today={today} canEdit={canEdit} formLink={!!registry && canEdit} sinceShared={shownDetail.member.since ? people.items.filter((x) => !x.deleted && x.since === shownDetail.member.since).length : 0} put={people.put} remove={people.remove} onClose={() => setDetail('')} />}
    </>
  )
}

/** ปุ่มสถานะ (ตามทะเบียน) ใช้สีตามระดับ */
const statusBadge = (st?: string) => { const l = regLevel(st); return l === 1 ? 'badge--good' : l === 2 ? 'badge--gold' : /เสียชีวิต|สิ้นสภาพ/.test(st ?? '') ? 'badge--bad' : '' }

/**
 * หน้าตรวจสอบ: สถานะตามทะเบียนเป็นหลัก (จำนวนตรงกับทะเบียนเดิม) + ใช้การลงชื่อนมัสการเตือนว่าใครควรปรับสถานะ
 * (ทะเบียนว่า สมบูรณ์ 1 แต่ขาดนมัสการเกินเกณฑ์ → ควรเป็น สมบูรณ์ 2 · และกลับกัน)
 */
function Audit({ registry, onOpen, result, criteria, canEdit, canTune, today, put, onCriteria }: { registry?: boolean; onOpen: (id: string) => void; result: ReturnType<typeof evaluate>; criteria: { minYears: number; absentMonths: number }; canEdit: boolean; canTune: boolean; today: string; put: (x: ChurchMember[]) => boolean; onCriteria: (p: { memberMinYears: number; memberAbsentMonths: number }) => void }) {
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<string[]>([]) // ตัวกรองสถานะ/ผลตรวจ เลือกได้หลายอัน (ตรงอย่างใดอย่างหนึ่ง · ว่าง = ทุกสถานะ)
  const [group, setGroup] = useState('')
  const [menu, setMenu] = useState('')
  const [gen, setGen] = useState('')
  const [upd, setUpd] = useState<'' | 'ok' | 'no'>('')
  const rows = useMemo(() => [...result.rows].sort((a, b) => statusLabel(a.member.status).localeCompare(statusLabel(b.member.status), 'th')), [result.rows])
  const statuses = useMemo(() => { const m = new Map<string, number>(); for (const r of rows) m.set(statusLabel(r.member.status), (m.get(statusLabel(r.member.status)) ?? 0) + 1); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th')) }, [rows])
  const full = rows.filter((r) => regLevel(r.member.status))
  const sum = summarize(full)
  const bands = [0, 0, 0, 0, 0, 0]
  for (const r of full) if (r.tier === 5) bands[bandOf(r)]++
  const to2 = rows.filter((r) => r.suggest === 'to2').length, to1 = rows.filter((r) => r.suggest === 'to1').length
  const groups = [...new Set(rows.map((r) => r.member.group).filter(Boolean))].sort() as string[]
  const matchFilter = (f: string, r: Evaluated) =>
    f.startsWith('st:') ? statusLabel(r.member.status) === f.slice(3)
      : f === 'to2' ? r.suggest === 'to2'
      : f === 'to1' ? r.suggest === 'to1'
      : f.startsWith('band') ? r.tier === 5 && !!regLevel(r.member.status) && bandOf(r) === Number(f.slice(4))
      : f === 'novisit' ? !!r.noRecord : true
  const shown = rows.filter((r) => {
    if (filters.length && !filters.some((f) => matchFilter(f, r))) return false
    if (group && r.member.group !== group) return false
    if (gen && (gen === 'none' ? !!r.member.gender : r.member.gender !== gen)) return false
    if (registry && upd && (upd === 'ok') !== !!r.member.formAt) return false
    const t = q.trim().toLowerCase()
    return !t || `${r.member.name} ${r.member.nick ?? ''} ${r.member.code ?? ''} ${r.member.note ?? ''}`.toLowerCase().includes(t)
  })
  const setStatus = (r: Evaluated, st: string) => { setMenu(''); put([{ ...r.member, status: st === '(ไม่ระบุสถานะ)' ? undefined : st, override: undefined }]) }
  if (rows.length === 0) return <p className="empty">ยังไม่มีสมาชิกในทะเบียน — ใช้ “เครื่องมือทะเบียน” เพื่อเพิ่มหรือนำเข้าไฟล์ .xlsx / CSV</p>
  const chip = (key: string, label: string, n: number) => <button key={key} type="button" className={`mini${filters.includes(key) ? ' on' : ''}`} aria-pressed={filters.includes(key)} onClick={() => setFilters((xs) => (xs.includes(key) ? xs.filter((x) => x !== key) : [...xs, key]))}>{label} · {n}</button>
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
        <MultiPick title="กรองสถานะ / ผลตรวจ" allLabel="ทุกสถานะ" empty="ทุกสถานะ" value={filters} onChange={setFilters}
          options={[...statuses.map(([st, n]) => ({ value: `st:${st}`, label: `${st} (${n})` })), { value: 'to2', label: `ควรปรับเป็น สมบูรณ์ 2 (${to2})` }, { value: 'to1', label: `ควรกลับเป็น สมบูรณ์ 1 (${to1})` }, { value: 'novisit', label: 'ไม่มีบันทึกนมัสการ' }]} />
        <select className="input" value={gen} onChange={(e) => setGen(e.target.value)} aria-label="กรองตามเพศ"><option value="">ทุกเพศ</option><option value="ชาย">ชาย</option><option value="หญิง">หญิง</option><option value="none">ไม่ระบุเพศ</option></select>
        {groups.length > 0 && <select className="input" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="กรองตามกลุ่ม"><option value="">ทุกกลุ่ม</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>}
        <button type="button" className="btn btn--ghost full" onClick={() => window.print()}>พิมพ์ / PDF</button>
      </div>
      <p className="small"><b>{shown.length}</b> จาก {rows.length} รายชื่อ · พิมพ์ ณ {fmtDate(today)}</p>
      {registry && (
        <div className="updleg no-print" role="group" aria-label="สถานะการอัปเดตข้อมูล">
          <button type="button" aria-pressed={upd === 'ok'} onClick={() => setUpd(upd === 'ok' ? '' : 'ok')}><span className="updot updot--ok" /> อัปเดตแล้ว {rows.filter((r) => r.member.formAt).length}</button>
          <button type="button" aria-pressed={upd === 'no'} onClick={() => setUpd(upd === 'no' ? '' : 'no')}><span className="updot updot--no" /> ยังไม่ได้อัปเดต {rows.filter((r) => !r.member.formAt).length}</button>
          <span className="small muted">จุดข้างรูป: เขียว = วางข้อมูลที่สมาชิกกรอกและอัปเดตแล้ว · แดง = ยังไม่ได้ทำ</span>
        </div>
      )}
      <section className="card" aria-label="รายชื่อตามสถานะ">
        <ul className="list list--tight">
          {shown.map((r) => (
            <li key={r.member.id}>
              <div className="mrow mrow--tight mrow--top">
                <MemberAvatar path={r.member.photoPath} name={r.member.name} size={56} member={r.member} />
                <div className="mrow__main">
                  <div className="mrow__top">
                    <button type="button" style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }} onClick={() => onOpen(r.member.id)} aria-label={`ดูข้อมูล ${r.member.name}`}>{r.member.name}</button>
                    {canEdit
                      ? <button type="button" className={`badge ${statusBadge(r.member.status)}`} style={{ cursor: 'pointer' }} aria-haspopup="dialog" aria-label={`สถานะ ${statusLabel(r.member.status)} — แตะเพื่อเปลี่ยน`} onClick={() => setMenu(r.member.id)}>{statusShort(r.member.status)} ▾</button>
                      : <span className={`badge ${statusBadge(r.member.status)}`}>{statusShort(r.member.status)}</span>}
                  </div>
                  <div className="mrow__meta">{[r.member.code && `#${r.member.code}`, r.member.nick, r.member.gender && r.member.gender, r.member.group, r.member.birth && `อายุ ${ageText(r.member.birth, today).replace(/ \d+ เดือน$/, '')}`].filter(Boolean).join(' · ')}</div>
                  <div className="mrow__meta">สม่ำเสมอ 1 ปีล่าสุด มา {r.recent} ครั้ง ({Math.round(r.yearPct * 100)}%) · ล่าสุด {r.last ? fmtDate(r.last) : '—'}</div>
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

function Roster({ toolsOnly, registry, lite, canLog, rows, onOpen, members, canEdit, put, remove, putCheckIns, checkins, recorders, putRecorders, canManage }: { toolsOnly?: boolean; attendance: Attendance[]; worshipDays: string[]; rows: Evaluated[]; registry?: boolean; onOpen: (id: string) => void; members: ChurchMember[]; lite: boolean; canLog: boolean; canEdit: boolean; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean; putCheckIns: (x: CheckIn[]) => boolean; checkins: CheckIn[]; recorders: Recorder[]; putRecorders: (x: Recorder[]) => boolean; canManage: boolean }) {
  const [edit, setEdit] = useState<ChurchMember | 'new' | null>(null)
  const [nameClean, setNameClean] = useState(false)
  const namePlan = useMemo(() => planNameClean(members), [members])
  const [q, setQ] = useState('')
  const [sts, setSts] = useState<string[]>([]) // สถานะที่เลือกกรอง (หลายสถานะได้ · ว่าง = ทั้งหมด)
  const [grp, setGrp] = useState('')
  const [gen, setGen] = useState('')
  const [upd, setUpd] = useState<'' | 'ok' | 'no'>('')   // ฝ่ายทะเบียน: กรองตามสถานะการอัปเดตข้อมูล
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
    .filter((m) => (sts.length === 0 || sts.includes(statusKey(m.status))) && (!grp || m.group === grp) && (!gen || (gen === 'none' ? !m.gender : m.gender === gen)))
    .filter((m) => !registry || !upd || (upd === 'ok') === !!m.formAt)
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
        added = unknown.map((n) => { const i = r.info.get(nameKey(n)); return { id: uniqueId(taken), name: i?.name ?? n, ...(i?.nick ? { nick: i.nick } : {}), status: stripStatusNo(i?.status) || 'ผู้ร่วมนมัสการ', ...(i?.group ? { group: i.group } : {}), updated: 0 } })
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
      {canLog && (() => { const tb = (
        <div className="toolbar toolbar--3 no-print">
          {!registry && <button type="button" className="btn btn--gold full" onClick={() => setEdit('new')}>＋ เพิ่มสมาชิก</button>}
          {canEdit && <><button type="button" className="btn btn--ghost" disabled={busy} onClick={() => memberFile.current?.click()}>{busy ? 'กำลังนำเข้า…' : 'นำเข้ารายชื่อ'}</button>
          <button type="button" className="btn btn--ghost" onClick={() => attFile.current?.click()}>นำเข้าลงชื่อ</button>
          <button type="button" className="btn btn--ghost full" disabled={busy} onClick={() => photoFiles.current?.click()}>นำเข้ารูป (หลายไฟล์)</button>
          {namePlan.fixes.length + namePlan.review.length > 0 && <button type="button" className="btn btn--gold full" onClick={() => setNameClean(true)}>จัดชื่อ-ชื่อเล่น ({namePlan.fixes.length + namePlan.review.length} คน)</button>}
          <input ref={photoFiles} hidden multiple type="file" aria-label="ไฟล์รูป" accept="image/*" onChange={(e) => { importPhotos(e.target.files); e.target.value = '' }} />
          <input ref={memberFile} hidden type="file" aria-label="ไฟล์รายชื่อ" accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => { importMembers(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={attFile} hidden type="file" aria-label="ไฟล์ลงชื่อ" accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => { importAttendance(e.target.files?.[0]); e.target.value = '' }} /></>}
        </div>
      ); return registry ? <details className="regtools no-print"><summary>📂 นำเข้า / จัดการข้อมูล</summary>{tb}</details> : tb })()}
      {msg && <p className="small" role="status">{msg}</p>}
      {!toolsOnly && <>
      {!lite && statuses.length > 1 && (
        <div className="no-print" aria-label="กรองตามสถานะ" style={{ margin: '0.3rem 0' }}>
          <MultiPick title="สถานะสมาชิก" allLabel="ทุกสถานะ" empty={`ทุกสถานะ · ${members.length}`} value={sts} onChange={setSts} options={statuses.map((x) => ({ value: x, label: `${x} (${count((m) => statusKey(m.status) === x)})` }))} />
        </div>
      )}
      <div className="toolbar toolbar--3 no-print">
        <input className="input full" placeholder={lite ? 'ค้นหา ชื่อ / ชื่อเล่น / รหัส / หมายเหตุ' : 'ค้นหา ชื่อ / ชื่อเล่น / รหัส / โทร / หมายเหตุ'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        <select className="input" value={gen} onChange={(e) => setGen(e.target.value)} aria-label="กรองตามเพศ"><option value="">ทุกเพศ</option><option value="ชาย">ชาย ({count((m) => m.gender === 'ชาย')})</option><option value="หญิง">หญิง ({count((m) => m.gender === 'หญิง')})</option><option value="none">ไม่ระบุเพศ ({count((m) => !m.gender)})</option></select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="เรียงตาม"><option value="code">เรียงตามรหัส</option><option value="name">เรียงตามชื่อ</option><option value="visits">มานมัสการมากสุด</option><option value="last">มาล่าสุด</option></select>
        {groups.length > 0 && <select className="input" value={grp} onChange={(e) => setGrp(e.target.value)} aria-label="กรองตามกลุ่ม"><option value="">ทุกกลุ่ม</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>}
      </div>
      {registry && (
        <div className="updleg no-print" role="group" aria-label="สถานะการอัปเดตข้อมูล">
          <button type="button" aria-pressed={upd === 'ok'} onClick={() => setUpd(upd === 'ok' ? '' : 'ok')}><span className="updot updot--ok" /> อัปเดตแล้ว {members.filter((m) => m.formAt).length}</button>
          <button type="button" aria-pressed={upd === 'no'} onClick={() => setUpd(upd === 'no' ? '' : 'no')}><span className="updot updot--no" /> ยังไม่ได้อัปเดต {members.filter((m) => !m.formAt).length}</button>
          <span className="small muted">จุดข้างรูป: เขียว = วางข้อมูลที่สมาชิกกรอกและอัปเดตแล้ว · แดง = ยังไม่ได้ทำ</span>
        </div>
      )}
      <p className="pagehint">แสดง {list.length} จาก {members.length} คน · มีรูป {count((m) => !!m.photoPath)} คน · แตะชื่อเพื่อดูข้อมูลครบทุกช่อง</p>
      <section className="card">
        {list.length === 0 ? <p className="empty">{members.length ? 'ไม่พบรายชื่อตามที่กรอง' : `ยังไม่มีสมาชิก${canEdit ? ' — เพิ่มทีละคน หรือนำเข้าไฟล์ .xlsx / CSV (หัวคอลัมน์: รหัส, ชื่อ สกุล, ชื่อเล่น, สถานะ, กลุ่ม, โทร, วันเกิด, หมายเหตุ, ว/ด/ป-เข้าร่วม)' : ''}`}</p> : (
          <ul className="list list--tight">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" className="mrow mrow--tight" onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                  <MemberAvatar path={m.photoPath} name={m.name} size={52} member={m} />
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
      </>}
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
function Detail({ worshipDays, lite, canLog, r, statuses, groups, today, canEdit, formLink, sinceShared = 0, put, remove, onClose }: { worshipDays: string[]; sinceShared?: number; formLink?: boolean; r: Evaluated; statuses: string[]; groups: string[]; lite: boolean; canLog: boolean; today: string; canEdit: boolean; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean; onClose: () => void }) {
  const m = r.member
  const { settings } = useSettings()
  const rules = effectiveRules(settings.ageRules, groups)
  const [lockOpen, setLockOpen] = useState(false)
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
  const ageY = ageYears(m.birth, today)
  const band = ageY == null ? undefined : AGE_BANDS.find((b) => ageY >= b.from && ageY <= b.to)?.label
  const tg = targetGroup(m, rules, today)
  const rows: [string, ReactNode][] = [
    ['รหัสสมาชิก', m.code], ['ชื่อ-สกุล', m.name], ['ชื่อเล่น', m.nick], ...(lite ? [] : [['สถานะในทะเบียน', <>{statusLabel(m.status)}{m.statusLock ? ' 🔒' : ''}</>] as [string, ReactNode]]), ['กลุ่ม', m.group],
    ...(lite ? [] : [['โทรศัพท์', m.tel && <a href={`tel:${m.tel}`}>{m.tel}</a>] as [string, ReactNode]]),
    ...(lite ? [] : [['LINE ID', m.lineId] as [string, ReactNode], ['Facebook', m.facebook] as [string, ReactNode], ['อาชีพ / ความสามารถ', m.skills] as [string, ReactNode], ['งานรับใช้ที่เต็มใจ', m.serve?.join(', ')] as [string, ReactNode], ['วันที่สะดวกรับใช้', m.serveDays?.join(', ')] as [string, ReactNode]]),
    ['เพศ', m.gender && m.gender],
    ...(lite ? [] : [['วันเกิด', m.birth && `${fmtDate(m.birth)}${age ? ` (อายุ ${age})` : ''}`] as [string, ReactNode]]),
    ...(lite ? [] : [['อายุ (อัปเดตเองทุกวัน)', ageY != null && <><b>{age}</b>{band ? ` · ${band}` : ''}</>] as [string, ReactNode]]),
    ...(!lite && (m.statusLock || canEdit) ? [['กรณีพิเศษ (สถานะ)', m.statusLock
      ? <span key="sl">🔒 กำหนดสถานะเอง{m.statusLock.why ? ` · ${m.statusLock.why}` : ''}{m.statusLock.skipAudit ? ' · ไม่ตรวจการนมัสการ' : ''}{canEdit && <> <button type="button" className="mini" onClick={() => setLockOpen(true)}>แก้ไข</button> <button type="button" className="mini" onClick={() => put([{ ...m, statusLock: undefined, updated: Date.now() }])}>ปลดล็อก</button></>}</span>
      : <button key="sl" type="button" className="mini" onClick={() => setLockOpen(true)}>🔒 กำหนดสถานะเอง</button>] as [string, ReactNode]] : []),
    ...(!lite && m.statusMoved && Date.now() - m.statusMoved.at < 365 * 86_400_000 ? [['เปลี่ยนสถานะอัตโนมัติ', <span key="sm">เมื่อ {new Date(m.statusMoved.at).toLocaleDateString('th-TH', { dateStyle: 'medium' })} จาก {m.statusMoved.from}<br /><span className="small muted">{m.statusMoved.why}</span>{canEdit && <> <button type="button" className="mini" onClick={() => put([{ ...m, status: m.statusMoved!.from, statusAt: undefined, statusMoved: undefined, statusLock: { why: 'คืนสถานะเดิมโดยผู้ดูแล' }, updated: Date.now() }])}>คืนสถานะเดิม + ล็อก</button></>}</span>] as [string, ReactNode]] : []),
    ...(!lite && m.groupMoved && Date.now() - m.groupMoved.at < 90 * 86_400_000 ? [['ย้ายกลุ่มอัตโนมัติ', <span key="gm">เมื่อ {new Date(m.groupMoved.at).toLocaleDateString('th-TH', { dateStyle: 'medium' })} (จาก {m.groupMoved.from || 'ไม่มีกลุ่ม'}){canEdit && <> <button type="button" className="mini" onClick={() => put([{ ...m, group: m.groupMoved!.from || undefined, groupMoved: undefined, groupLock: true, updated: Date.now() }])}>คืนกลุ่มเดิม + ล็อก</button></>}</span>] as [string, ReactNode]] : []),
    ...(!lite && canEdit && ageY != null ? [['ล็อกกลุ่ม', <label key="gl" className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><input type="checkbox" checked={!!m.groupLock} onChange={() => put([{ ...m, groupLock: !m.groupLock, updated: Date.now() }])} /> <span className="small">ไม่ให้ระบบย้ายกลุ่มตามอายุ</span></label>] as [string, ReactNode]] : []),
    ...(!lite && !tg && needsGender(m, rules, today) ? [['กลุ่มตามอายุ', <span key="ng" style={{ color: '#b45309' }}>⚠ อายุ {ageY} ปี — ยังไม่ทราบเพศ จึงจัดกลุ่มบุรุษ/สตรีให้ไม่ได้ (กรอกเพศก่อน)</span>] as [string, ReactNode]] : []),
    ...(!lite && tg && tg.group !== (m.group ?? '') ? [['กลุ่มตามอายุ', <span key="tg" style={{ color: '#b45309' }}>⚠ อายุ {tg.age} ปี{m.gender ? ` · ${m.gender}` : ''} ควรอยู่กลุ่ม <b>{tg.group}</b>{canEdit && <> <button type="button" className="mini" onClick={() => put([{ ...m, group: tg.group, updated: Date.now() }])}>ย้ายเลย</button></>}</span>] as [string, ReactNode]] : []),
    ['วันที่รับเป็นสมาชิก', m.since && <>{fmtDate(m.since)} ({spanText(m.since, today)}){sinceShared >= 5 && <span className="small" style={{ color: '#b45309' }}><br />⚠ หลายคน ({sinceShared}) ใช้วันนี้เหมือนกัน — อาจเป็นวันตั้งต้นของระบบเก่า ไม่ใช่วันจริง</span>}</>],
    ['มานมัสการครั้งแรก (ประมาณ)', m.firstWorship && `${fmtDate(m.firstWorship)} (${spanText(m.firstWorship, today)})`],
    ...(lite ? [] : [['พิกัดบ้าน', hasCoord(m) && <a href={mapsLink({ lat: m.lat, lng: m.lng })} target="_blank" rel="noreferrer">{formatCoord({ lat: m.lat, lng: m.lng })} · เปิดแผนที่</a>] as [string, ReactNode]]),
    ['สมัครสมาชิก', m.applied ? 'สมัครแล้ว' : undefined], ['ไฟล์รูปในทะเบียนเดิม', !m.photoPath && m.photo && <span className="small muted">{m.photo.split('/').pop()}</span>], ['หมายเหตุ', m.note],
  ]
  return (
    <Sheet title={m.name} onClose={onClose}>
      {m.photoPath && <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}><span style={{ position: 'relative', display: 'inline-block' }}><StoredImage path={m.photoPath} alt={`รูป ${m.name}`} /><span className={`updot updot--${m.formAt ? 'ok' : 'no'}`} role="img" aria-label={m.formAt ? 'อัปเดตข้อมูลแล้ว' : 'ยังไม่ได้อัปเดตข้อมูล'} /></span></div>}
      {canLog && <div className="row no-print"><button type="button" className="mini" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'กำลังอัปโหลด…' : m.photoPath ? '📷 เปลี่ยนรูป' : '📷 เพิ่มรูป'}</button>{m.photoPath && <button type="button" className="mini" disabled={busy} onClick={dropPhoto}>ลบรูป</button>}<input ref={fileRef} hidden type="file" accept="image/*" aria-label="ไฟล์รูปสมาชิก" onChange={(e) => { setPhoto(e.target.files?.[0]); e.target.value = '' }} />{photoErr && <span role="alert" className="small" style={{ color: 'var(--bad)' }}>{photoErr}</span>}</div>}
      <dl style={{ margin: 0 }}>
        {rows.map(([k, v]) => (
          <div key={k} className="row row--between" style={{ borderBottom: '1px solid var(--line)', padding: '0.35rem 0', flexWrap: 'nowrap' }}>
            <dt className="muted small" style={{ flex: 'none', width: '8.5rem' }}>{k}</dt>
            <dd style={{ margin: 0, textAlign: 'right', wordBreak: 'break-word' }}>{v || <span className="muted">—</span>}</dd>
        </div>
        ))}
        {!lite && (
        <div style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--line)' }}>
          <dt className="muted small">แผนที่บ้าน</dt>
          <dd style={{ margin: '0.25rem 0 0' }}>{hasCoord(m)
            ? <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={[{ id: m.id, lat: m.lat, lng: m.lng, label: m.name }]} height={170} label={`แผนที่บ้าน ${m.name}`} noLinks /></Suspense>
            : <span className="muted small">ยังไม่มีพิกัดบ้าน — แผนที่จะขึ้นเองเมื่อมีการเช็คอินเยี่ยมบ้านจากตารางเยี่ยม</span>}</dd>
        </div>
        )}
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
      {lockOpen && <StatusLockSheet m={m} put={put} onClose={() => setLockOpen(false)} />}
      {formLink && <FormLinkBox m={m} put={put} worshipDays={worshipDays} />}
      {canLog && <div className="row row--between"><span /><button type="button" className="btn" onClick={() => setEditing(true)}>แก้ไขข้อมูล</button></div>}
    </Sheet>
  )
}

/** ฝ่ายทะเบียน: คัดลอกลิงก์ให้สมาชิกคนนี้กรอกข้อมูลเอง (ไปวางในไลน์ของเขา) · ดูหน้าฟอร์มได้ */
function FormLinkBox({ m, put, worshipDays }: { m: ChurchMember; put: (x: ChurchMember[]) => boolean; worshipDays: string[] }) {
  const [msg, setMsg] = useState('')
  const [importing, setImporting] = useState(false)
  const [open, setOpen] = useState(false)
  const url = formUrl(m)
  const [text, setText] = useState(() => personalInvite(m, url))
  const copy = async (what: string, label: string) => { try { await navigator.clipboard.writeText(what); setMsg(`คัดลอก${label}แล้ว — นำไปวางในไลน์ของ ${m.nick || m.name} (ใช้ได้ ${FORM_DAYS} วัน)`) } catch { setMsg('คัดลอกไม่สำเร็จ — กด “ดูแบบฟอร์ม” แล้วคัดลอกลิงก์จากแถบที่อยู่') } }
  return (
    <div className="no-print" style={{ margin: '0.6rem 0', padding: '0.5rem 0.6rem', border: '1px dashed var(--line)', borderRadius: 12 }}>
      <b>📝 ให้ {m.nick || m.name} กรอกข้อมูลเอง</b>
      <p className="small muted" style={{ margin: '0.2rem 0 0' }}>ลิงก์เฉพาะของคนนี้ — คัดลอกเป็นข้อความพร้อมชื่อ แล้ววางในไลน์ของเขาได้เลย</p>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <button type="button" className="btn btn--gold" onClick={() => copy(text, 'ข้อความพร้อมลิงก์')}>📋 คัดลอกข้อความ + ลิงก์</button>
        <button type="button" className="btn btn--ghost" onClick={() => copy(url, 'ลิงก์')}>🔗 เฉพาะลิงก์</button>
        <a className="btn btn--ghost" href={url} target="_blank" rel="noreferrer">👁 ดูแบบฟอร์ม</a>
        <button type="button" className="btn btn--ghost" onClick={() => setImporting(true)}>📥 วางข้อมูลที่ได้รับ</button>
      </div>
      <button type="button" className="mini" style={{ marginTop: 6 }} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▲ ซ่อนข้อความ' : '▼ ดู/แก้ข้อความที่จะส่ง'}</button>
      {open && <textarea className="input" rows={12} aria-label="ข้อความที่จะส่ง" style={{ marginTop: 6 }} value={text} onChange={(e) => setText(e.target.value)} />}
      {m.formAt && <p className="small muted" style={{ margin: '0.3rem 0 0' }}>นำเข้าข้อมูลจากแบบฟอร์มล่าสุดเมื่อ {new Date(m.formAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</p>}
      {importing && <ImportSheet worshipDays={worshipDays} m={m} put={put} onClose={() => setImporting(false)} />}
      {msg && <p role="status" className="small" style={{ margin: '0.3rem 0 0' }}>{msg}</p>}
    </div>
  )
}

/** วางข้อความที่สมาชิกส่งกลับ → ตารางเทียบ เดิม → ใหม่ → ติ๊กช่องที่รับ → ยืนยันครั้งเดียว (ไม่เขียนทับอัตโนมัติ) */
function ImportSheet({ worshipDays, m, put, onClose, initial = '', asMid }: { worshipDays: string[]; m: ChurchMember; put: (x: ChurchMember[]) => boolean; onClose: () => void; initial?: string; asMid?: string }) {
  const people = useChurchMembers()
  const plans = useVisitPlans()
  const { settings } = useSettings()
  const [skipGroup, setSkipGroup] = useState(false)
  const [text, setText] = useState(initial)
  const [skip, setSkip] = useState<Set<FieldKey>>(new Set())
  const [err, setErr] = useState('')
  const a0 = text.trim() ? parseReply(text) : null
  const a = a0 && asMid ? { ...a0, mid: asMid } : a0   // ลิงก์ทั่วไป: ฝ่ายทะเบียนเลือกเองว่าเป็นสมาชิกคนไหน
  const owner = a && a.mid !== m.id ? people.items.find((x) => x.id === a.mid) : undefined
  const g0 = a && a.mid === m.id ? withNoteGuess(m, a) : null   // ถ้าสมาชิกไม่ได้กรอกวันมาครั้งแรก แต่หมายเหตุมีวันที่ → เสนอเป็นวันมาครั้งแรก
  // วันมาครั้งแรกที่เป็นค่าประมาณ → จับกับวันนมัสการที่มีบันทึกในระบบที่ใกล้ที่สุด (±3 วัน) · ไม่มีบันทึกใกล้เคียง = ตามที่สมาชิกเขียน
  const written = g0?.a.first
  const snapped = written && !g0?.guess?.yearOnly ? snapToWorshipDay(written, worshipDays) : null
  const g = g0 && { ...g0, a: snapped && snapped !== written ? { ...g0.a, first: snapped } : g0.a }
  const firstSource = g0 && written ? [
    g0.guess ? `อ่านจากหมายเหตุ “${g0.guess.text}”${g0.guess.yearOnly ? ' (ระบุเฉพาะปี → ใส่เป็น 1 ม.ค.)' : ''}` : '',
    snapped && snapped !== written ? `ปรับเป็นวันนมัสการที่มีบันทึกในระบบ ${fmtDate(snapped)} (สมาชิกเขียน ${fmtDate(written)})`
      : worshipDays.length === 0 ? '' : written < worshipDays[0] ? 'ก่อนที่ระบบจะเริ่มบันทึกนมัสการ — ใช้ตามที่สมาชิกเขียน'
      : snapped ? '' : g0.guess?.yearOnly ? '' : 'ไม่พบบันทึกนมัสการใกล้เคียง — ใช้ตามที่สมาชิกเขียน',
  ].filter(Boolean).join(' · ') : ''
  const diffs = g ? diffAnswer(m, g.a).map((d) => (d.key === 'firstWorship' && firstSource ? { ...d, source: firstSource } : d)) : []
  const changed = diffs.filter((d) => d.changed)
  const nv = a && a.mid === m.id ? nameVerdict(m.name, a.name) : null
  const birthGap = a?.birth && m.birth ? Math.abs(Number(a.birth.slice(0, 4)) - Number(m.birth.slice(0, 4))) : 0
  const keys = new Set(changed.filter((d) => !skip.has(d.key)).map((d) => d.key))
  // จัดกลุ่มตามอายุ+เพศหลังนำเข้า (ใช้วันเกิด/เพศใหม่ที่จะบันทึก)
  const projected = g ? applyAnswer(m, g.a, keys) : m
  const tgt = g ? targetGroup(projected, effectiveRules(settings.ageRules, [...new Set(people.items.map((x) => x.group).filter(Boolean) as string[])]), todayISO()) : null
  const groupChange = !!tgt && tgt.group !== (m.group ?? '')
  const total = keys.size + (groupChange && !skipGroup ? 1 : 0)
  const confirm = () => {
    if (!a) return
    const next = applyAnswer(m, g?.a ?? a, keys)
    if (groupChange && !skipGroup && tgt) next.group = tgt.group
    if (!put([next])) return setErr('ไม่มีสิทธิ์บันทึกทะเบียน')
    // ชื่อใหม่: ปรับสำเนาชื่อในแผนเยี่ยมให้ตรงกัน
    if (keys.has('name') && next.name !== m.name) {
      const hit = plans.items.filter((p) => !p.deleted && (p.items ?? []).some((x) => x.id === m.id))
      if (hit.length) plans.put(hit.map((p) => ({ ...p, items: p.items.map((x) => (x.id === m.id ? { ...x, name: next.name } : x)), updated: Date.now() })))
    }
    onClose()
  }
  return (
    <Sheet title={`วางข้อมูลของ ${m.nick || m.name}`} onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>คัดลอกข้อความที่สมาชิกส่งกลับทางไลน์ แล้ววางที่นี่ ระบบแสดงตารางเทียบให้ตรวจก่อน ยังไม่มีอะไรเปลี่ยนจนกว่าจะกดยืนยัน</p>
      <textarea className="input" rows={5} aria-label="วางข้อความที่ได้รับ" value={text} onChange={(e) => { setText(e.target.value); setSkip(new Set()); setErr('') }} placeholder="วางข้อความที่ขึ้นต้นว่า 📝 ข้อมูลสมาชิก…" />
      {text.trim() && !a && <p className="error" role="alert" style={{ margin: 0 }}>ไม่พบรหัสตรวจในข้อความ — คัดลอกให้ครบทั้งข้อความรวมบรรทัด “— รหัสตรวจ: …” ท้ายสุด</p>}
      {a && a.mid !== m.id && <p className="error" role="alert" style={{ margin: 0 }}>⚠️ ข้อความนี้เป็นของ {owner ? `“${owner.name}”` : 'สมาชิกอีกคนหนึ่ง'} ไม่ใช่ของ {m.name} — เปิดหน้าของคนนั้นแล้ววางใหม่ (ถ้าลูกหรือญาติกรอกแทน ให้ตรวจให้แน่ใจก่อน)</p>}
      {a && a.mid === m.id && (
        <>
          {a && a.at && <p className="small muted" style={{ margin: 0 }}>ข้อความนี้ส่งเมื่อ {new Date(a.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
          {a && a.at && m.formAt && a.at < m.formAt && <p role="alert" style={{ margin: 0, color: '#b45309', fontWeight: 700 }}>⚠️ ข้อความนี้ส่งก่อนข้อมูลที่นำเข้าไปครั้งล่าสุด — ถ้าสมาชิกส่งซ้ำหลายครั้ง ให้ใช้ข้อความล่าสุด</p>}
          {nv && nv.level === 'minor' && <p role="alert" style={{ margin: 0, color: '#b45309', fontWeight: 700 }}>⚠️ ชื่อต่างจากทะเบียนเล็กน้อย ({Math.round(nv.sim * 100)}% ใกล้เคียง) — ตรวจการสะกดให้ถูกต้องก่อนรับ</p>}
          {nv && nv.level === 'major' && <p className="error" role="alert" style={{ margin: 0 }}>🚨 ชื่อต่างจากทะเบียนมาก ({Math.round(nv.sim * 100)}% ใกล้เคียง) — ตรวจให้แน่ใจว่าเป็นคนเดียวกัน ก่อนรับชื่อใหม่</p>}
          {birthGap >= 5 && <p className="error" role="alert" style={{ margin: 0 }}>🚨 ปีเกิดต่างจากทะเบียน {birthGap} ปี — ตรวจให้แน่ใจว่าถูกคน</p>}
          {changed.length > 0 && (() => {
            const edits = changed.filter((d) => d.old).length
            return <p style={{ margin: 0 }} role="status"><b>พบการเปลี่ยนแปลง {changed.length} ช่อง</b> · แก้ค่าเดิม {edits} · เติมช่องว่าง {changed.length - edits} · ตรงกับทะเบียนอยู่แล้ว {diffs.length - changed.length} ช่อง</p>
          })()}
          {changed.length === 0 ? <p style={{ margin: 0 }}>✅ ข้อมูลตรงกับทะเบียนอยู่แล้ว ไม่มีช่องที่ต้องเปลี่ยน</p> : (
            <dl style={{ margin: 0 }} aria-label="เทียบข้อมูลเดิมกับข้อมูลใหม่">
              {changed.map((d) => (
                <div key={d.key} style={{ borderBottom: '1px solid var(--line)', padding: '0.4rem 0' }}>
                  <label className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={!skip.has(d.key)} onChange={() => setSkip((p) => { const n = new Set(p); if (n.has(d.key)) n.delete(d.key); else n.add(d.key); return n })} aria-label={`รับ ${d.label}`} />
                    <span style={{ minWidth: 0 }}><b>{d.label}</b>{!d.old ? <span className="imp-badge imp-badge--fill">เติมข้อมูลใหม่</span> : (d.key === 'birth' || d.key === 'since' || d.key === 'firstWorship') ? <span className="imp-badge imp-badge--date">⚠ วันที่เปลี่ยน — ตรวจกับข้อมูลที่ทราบ</span> : <span className="imp-badge imp-badge--edit">แก้ค่าเดิม</span>}<br /><span className="small muted">เดิม: {d.old || '—'}</span>{d.source && <><br /><span className="small" style={{ color: '#1d4ed8' }}>🔎 {d.source}</span></>}<br /><span style={{ background: '#fff3bf', padding: '0 4px', borderRadius: 4 }}>ใหม่: {d.next}</span></span>
                  </label>
                </div>
              ))}
            </dl>
          )}
          {groupChange && tgt && (
            <label className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start', borderTop: '1px solid var(--line)', paddingTop: '0.4rem' }}>
              <input type="checkbox" checked={!skipGroup} onChange={() => setSkipGroup(!skipGroup)} aria-label="รับ กลุ่ม" />
              <span style={{ minWidth: 0 }}><b>กลุ่ม</b><span className="imp-badge imp-badge--edit">ตามอายุ</span><br /><span className="small muted">เดิม: {m.group || '—'}</span><br /><span style={{ background: '#fff3bf', padding: '0 4px', borderRadius: 4 }}>ใหม่: {tgt.group}</span><br /><span className="small" style={{ color: '#1d4ed8' }}>🔎 อายุ {tgt.age} ปี{projected.gender ? ` · ${projected.gender}` : ''} (คำนวณจากวันเกิดที่รับ)</span></span>
            </label>
          )}
          {a.note && <p className="small" style={{ margin: 0 }}>💬 ข้อความจากสมาชิก: {a.note}</p>}
          {err && <p className="error" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button type="button" className="btn btn--gold bigbtn btn--block" onClick={confirm}>{total === 0 ? '✓ ยืนยัน — ข้อมูลตรงกับทะเบียน (ทำเครื่องหมายอัปเดตแล้ว)' : `✓ ยืนยันนำเข้า (${total} ช่อง)`}</button>
        </>
      )}
    </Sheet>
  )
}

/**
 * เครื่องมือฝ่ายทะเบียนบนหน้ารายชื่อ:
 * 🔗 ลิงก์กลุ่ม = ลิงก์เดียวสำหรับรายชื่อที่กรองอยู่ (ส่งทีเดียวในห้องแชต ทุกคนเลือกชื่อตัวเอง)
 * 📥 วางข้อมูลจากสมาชิก = วางข้อความที่ได้รับที่เดียว ระบบหาเองว่าเป็นของใคร (ไม่ต้องเปิดทีละคน)
 */
function FormTools({ members, put, worshipDays, attendance }: { members: ChurchMember[]; put: (x: ChurchMember[]) => boolean; worshipDays: string[]; attendance: Attendance[] }) {
  const [open, setOpen] = useState<'' | 'link' | 'paste' | 'age' | 'status'>('')
  const [text, setText] = useState('')
  const [pickId, setPickId] = useState<string | null>(null)   // ลิงก์ทั่วไป: สมาชิกที่ฝ่ายทะเบียนเลือกจับคู่
  const [asNew, setAsNew] = useState(false)
  const a = text.trim() ? parseReply(text) : null
  const target = a && a.mid !== NEW_MID && a.mid !== BY_NAME ? members.find((x) => x.id === a.mid) : undefined
  const cands = a && a.mid === BY_NAME ? findCandidates(a, members) : []
  const picked = pickId ? members.find((x) => x.id === pickId) : undefined
  const reset = () => { setOpen(''); setText(''); setPickId(null); setAsNew(false) }
  return (
    <>
      <button type="button" className="btn btn--ghost" onClick={() => setOpen('link')}>🔗 ส่งลิงก์แบบกลุ่ม</button>
      <button type="button" className="btn btn--ghost" onClick={() => { setOpen('paste'); setText(''); setPickId(null); setAsNew(false) }}>📥 วางข้อมูลจากสมาชิก</button>
      <button type="button" className="btn btn--ghost" onClick={() => setOpen('age')}>🎂 จัดกลุ่มตามอายุ</button>
      <button type="button" className="btn btn--ghost" onClick={() => setOpen('status')}>📊 เกณฑ์สถานะ</button>
      {open === 'status' && <StatusRulesSheet members={members} attendance={attendance} put={put} onClose={() => setOpen('')} />}
      {open === 'age' && <RegroupSheet members={members} put={put} onClose={() => setOpen('')} />}
      {open === 'link' && <FamilyLinksSheet members={members} onClose={() => setOpen('')} />}
      {open === 'paste' && (picked && a
        ? <ImportSheet worshipDays={worshipDays} m={picked} put={put} onClose={reset} initial={text} asMid={picked.id} />
        : target
          ? <ImportSheet worshipDays={worshipDays} m={target} put={put} onClose={reset} initial={text} />
          : a && (a.mid === NEW_MID || asNew)
            ? <NewMemberSheet a={a} put={put} onClose={reset} />
            : (
              <Sheet title="วางข้อมูลจากสมาชิก" onClose={reset}>
                <p className="small muted" style={{ margin: 0 }}>วางข้อความที่สมาชิกส่งกลับ — ถ้ามาจากลิงก์ทั่วไป ระบบจะหาชื่อที่ใกล้เคียงในทะเบียนให้เลือกยืนยัน</p>
                <textarea className="input" rows={6} aria-label="วางข้อความที่ได้รับ" value={text} onChange={(e) => setText(e.target.value)} placeholder="วางข้อความที่ขึ้นต้นว่า 📝 ข้อมูลสมาชิก…" />
                {text.trim() && !a && <p className="error" role="alert" style={{ margin: 0 }}>ไม่พบรหัสตรวจในข้อความ — คัดลอกให้ครบทั้งข้อความรวมบรรทัด “— รหัสตรวจ: …” ท้ายสุด</p>}
                {a && a.mid !== BY_NAME && !target && <p className="error" role="alert" style={{ margin: 0 }}>ไม่พบสมาชิกคนนี้ในทะเบียน (อาจถูกลบไปแล้ว)</p>}
                {a && a.mid === BY_NAME && (
                  <div role="group" aria-label="ชื่อที่ใกล้เคียงในทะเบียน">
                    <p style={{ margin: '0 0 0.3rem' }}>ข้อความนี้กรอกโดย <b>{a.name}</b> — ใช่คนไหนในทะเบียน?</p>
                    {cands.length === 0 && <p className="small muted" style={{ margin: 0 }}>ไม่พบชื่อที่ใกล้เคียงในทะเบียน</p>}
                    {cands.map((c) => (
                      <button key={c.m.id} type="button" className="btn btn--ghost btn--block" style={{ textAlign: 'left', marginBottom: 6 }} onClick={() => setPickId(c.m.id)}>
                        <b>{c.m.name}</b>{c.m.nick ? ` (${c.m.nick})` : ''}<br /><span className="small muted">{c.reasons.join(' · ')}</span>
                      </button>
                    ))}
                    <button type="button" className="btn btn--ghost btn--block" onClick={() => setAsNew(true)}>➕ ไม่ใช่คนในรายการ — เพิ่มเป็นสมาชิกใหม่</button>
                  </div>
                )}
              </Sheet>
            ))}
    </>
  )
}

/**
 * ส่งลิงก์แบบกลุ่ม (ป๊อปอัพเต็มหน้า): เลือกรายชื่อคล้ายตะกร้า → ได้ข้อความเดียวที่มีลิงก์แยกรายคนตามลำดับ (คนที่ 1, 2, …) คัดลอกไปวางทีเดียว
 * เหมาะกับบ้านหนึ่งหลัง: ส่งชุดเดียว ลูกกรอกให้พ่อแม่ได้ · ลิงก์สั้นลงได้ด้วยตัวเลือก “ไม่เติมข้อมูลเดิม”
 */
const FAMILY_MAX = 20
function FamilyLinksSheet({ members, onClose }: { members: ChurchMember[]; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [short, setShort] = useState(false)
  const [msg, setMsg] = useState('')
  const [showText, setShowText] = useState(false)
  const live = useMemo(() => members.filter((x) => !x.deleted).sort((a, b) => a.name.localeCompare(b.name, 'th')), [members])
  const t = q.trim().toLowerCase().replace(/\s+/g, '')
  const shown = t ? live.filter((x) => `${x.name}${x.nick ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t)) : live.slice(0, 60)
  const chosen = picked.map((id) => live.find((x) => x.id === id)).filter(Boolean) as ChurchMember[]
  const generated = useMemo(() => (chosen.length === 0 ? '' : familyInvite(chosen.map((m) => ({ name: m.name, nick: m.nick, url: formUrl(m, undefined, short) })))), [picked, short]) // eslint-disable-line react-hooks/exhaustive-deps
  const [text, setText] = useState('')
  useEffect(() => { setText(generated) }, [generated])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= FAMILY_MAX ? p : [...p, id]))
  const copy = async () => { try { await navigator.clipboard.writeText(text); setMsg(`คัดลอกข้อความพร้อม ${chosen.length} ลิงก์แล้ว — นำไปวางในไลน์ได้เลย`) } catch { setMsg('คัดลอกไม่สำเร็จ') } }
  const copyGeneral = async () => { try { await navigator.clipboard.writeText(groupInvite(generalFormUrl())); setMsg('คัดลอกข้อความ + ลิงก์ทั่วไป (ให้ทุกคนพิมพ์ชื่อเอง) แล้ว') } catch { setMsg('คัดลอกไม่สำเร็จ') } }
  return (
    <div className="sheet sheet--full no-print" role="dialog" aria-modal="true" aria-label="ส่งลิงก์แบบกลุ่ม">
      <div className="card">
        <div className="row row--between" style={{ flexWrap: 'nowrap' }}><h2 style={{ margin: 0 }}>🔗 ส่งลิงก์แบบกลุ่ม</h2><button type="button" className="mini" onClick={onClose}>ปิด</button></div>
        <p className="small muted" style={{ margin: 0 }}>เลือกรายชื่อ (เช่น คนในบ้านเดียวกัน) → ได้ข้อความเดียวที่มีลิงก์แยกรายคน คนที่ 1, 2, 3 … ส่งทีเดียว · ใครได้ข้อความนี้ช่วยกรอกให้คนอื่นในชุดได้</p>
        <div className="row" style={{ gap: 6, alignItems: 'center' }} aria-label="รายชื่อที่เลือก">
          <span className="fam-chip"><b>เลือกแล้ว {chosen.length}</b> / {FAMILY_MAX} คน</span>
          {chosen.map((m, i) => <span key={m.id} className="fam-chip">{i + 1}. {m.nick || m.name} <button type="button" className="mini" aria-label={`เอา ${m.name} ออก`} onClick={() => toggle(m.id)}>✕</button></span>)}
        </div>
        <input className="input" type="search" aria-label="ค้นหาสมาชิก" placeholder="🔎 พิมพ์ชื่อหรือชื่อเล่นเพื่อค้นหา แล้วติ๊กเลือก" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="fam-list" role="list" aria-label="รายชื่อสมาชิก">
          {shown.map((m) => (
            <label key={m.id} role="listitem" className="row" style={{ gap: 8, flexWrap: 'nowrap', padding: '0.25rem 0', borderBottom: '1px solid var(--line)' }}>
              <input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} aria-label={`เลือก ${m.name}`} />
              <span>{m.name}{m.nick ? <span className="muted small"> ({m.nick})</span> : null}{m.formAt ? <span className="small" style={{ color: '#1b6b2b' }}> ✓ อัปเดตแล้ว</span> : null}</span>
            </label>
          ))}
          {shown.length === 0 && <p className="muted small" style={{ margin: '0.5rem 0' }}>ไม่พบชื่อที่ค้นหา</p>}
          {!t && live.length > 60 && <p className="muted small" style={{ margin: '0.5rem 0' }}>แสดง 60 รายชื่อแรก — พิมพ์ค้นหาเพื่อหาคนอื่น</p>}
        </div>
        <label className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={short} onChange={() => setShort(!short)} aria-label="ลิงก์สั้น" />
          <span className="small"><b>ลิงก์สั้น</b> — ไม่เติมข้อมูลเดิมของแต่ละคนให้ในฟอร์ม (ลิงก์สั้นลงมาก เหมาะกับส่งหลายคนพร้อมกัน)</span>
        </label>
        {chosen.length > 0 && (
          <div>
            <button type="button" className="mini" aria-expanded={showText} onClick={() => setShowText(!showText)}>{showText ? '▲ ซ่อนข้อความ' : '▼ ดู/แก้ข้อความที่จะส่ง'}</button>
            {showText && <textarea className="input" rows={14} aria-label="ข้อความที่จะส่ง" style={{ marginTop: 6 }} value={text} onChange={(e) => setText(e.target.value)} />}
          </div>
        )}
        {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
        <button type="button" className="btn btn--gold bigbtn btn--block" disabled={chosen.length === 0} onClick={copy}>📋 คัดลอกข้อความ + {chosen.length} ลิงก์</button>
        <button type="button" className="btn btn--ghost btn--block" onClick={copyGeneral}>ลิงก์ทั่วไปให้ทุกคนพิมพ์ชื่อเอง (ลิงก์เดียว)</button>
      </div>
    </div>
  )
}

/** กำหนดสถานะเองรายบุคคล (ล็อก): เลือกสถานะ + เหตุผล (+ ไม่ตรวจการนมัสการ) → ระบบอัตโนมัติไม่เปลี่ยนสถานะคนนี้ */
function StatusLockSheet({ m, put, onClose }: { m: ChurchMember; put: (x: ChurchMember[]) => boolean; onClose: () => void }) {
  const people = useChurchMembers()
  const [status, setStatus] = useState(statusLabel(m.status))
  const [why, setWhy] = useState(m.statusLock?.why ?? '')
  const [skip, setSkip] = useState(!!m.statusLock?.skipAudit)
  const options = statusOptions(people.items)
  if (!options.includes(status)) options.push(status)
  const save = () => {
    const changed = statusLabel(m.status) !== status
    if (put([{ ...m, status, statusLock: { ...(why.trim() ? { why: why.trim() } : {}), ...(skip ? { skipAudit: true } : {}) }, ...(changed ? { statusAt: todayISO(), statusMoved: undefined } : {}), updated: Date.now() }])) onClose()
  }
  return (
    <Sheet title={`กำหนดสถานะเอง — ${m.nick || m.name}`} onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>ใช้กับกรณีพิเศษเฉพาะคน (เช่น ศิษยาภิบาล) ระบบอัตโนมัติจะไม่เปลี่ยนสถานะของคนนี้ จนกว่าจะปลดล็อก · แสดงผลเหมือนสถานะปกติ</p>
      <div className="field"><label htmlFor="sl-st">สถานะ</label>
        <select id="sl-st" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
      <div className="field"><label htmlFor="sl-why">เหตุผล (ไม่บังคับ)</label><input id="sl-why" className="input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="เช่น ศิษยาภิบาล · คณะธรรมกิจ" /></div>
      <label className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={skip} onChange={() => setSkip(!skip)} aria-label="ยกเว้นการตรวจการนมัสการ" />
        <span><b>ยกเว้นการตรวจการนมัสการ</b><br /><span className="small muted">ไม่ฟ้องว่า “ขาดนมัสการเกินเกณฑ์” เช่น คนที่มาทุกอาทิตย์แต่ไม่ถูกลงชื่อ</span></span>
      </label>
      <button type="button" className="btn btn--gold bigbtn btn--block" onClick={save}>🔒 บันทึก</button>
    </Sheet>
  )
}

/** เกณฑ์เปลี่ยนสถานะอัตโนมัติ (ความถี่การมานมัสการ): แก้ได้ → ดูตัวอย่างคนที่จะเปลี่ยน → บันทึกแล้วปรับทุกคนทันที */
function StatusRulesSheet({ members, attendance, put, onClose }: { members: ChurchMember[]; attendance: Attendance[]; put: (x: ChurchMember[]) => boolean; onClose: () => void }) {
  const { settings, save } = useSettings()
  const [cfg, setCfg] = useState(() => effectiveStatusRules(settings.statusRules))
  const [msg, setMsg] = useState('')
  const today = todayISO()
  const live = members.filter((x) => !x.deleted)
  const moves = proposeStatusMoves(live, attendance, today, cfg)
  const warns = statusRuleWarnings(cfg)
  const reviews = reviewAutoMoves(live, attendance, today, effectiveStatusRules(settings.statusRules))
  const [revertIds, setRevertIds] = useState<Set<string>>(() => new Set(reviewAutoMoves(live, attendance, today, effectiveStatusRules(settings.statusRules)).filter((r) => !r.fits).map((r) => r.m.id)))
  const locked = live.filter((x) => x.statusLock)
  const changed = JSON.stringify(cfg) !== JSON.stringify(effectiveStatusRules(settings.statusRules))
  const num = (k: keyof typeof cfg, label: string, unit: string) => (
    <label className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0' }}>
      <span>{label}</span>
      <span className="row" style={{ gap: 4, flexWrap: 'nowrap', alignItems: 'center' }}><input className="input" style={{ width: '4.5rem' }} type="number" min={0} aria-label={label} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: Math.max(0, Number(e.target.value)) })} /><span className="small muted">{unit}</span></span>
    </label>
  )
  const save1 = () => {
    if (!save({ statusRules: cfg })) return setMsg('ไม่มีสิทธิ์บันทึกเกณฑ์')
    if (moves.length === 0) return setMsg('บันทึกเกณฑ์แล้ว — ตอนนี้ยังไม่มีใครต้องเปลี่ยนสถานะ')
    if (settings.statusAuto === false) return setMsg(`บันทึกเกณฑ์แล้ว — มี ${moves.length} คนเข้าเกณฑ์ ปิดเปลี่ยนอัตโนมัติอยู่ กดปุ่ม “เปลี่ยนสถานะ” เพื่อปรับ`)
    setMsg(put(applyStatusMoves(moves, today, Date.now())) ? `บันทึกเกณฑ์แล้ว และเปลี่ยนสถานะ ${moves.length} คนให้ตรงเกณฑ์ใหม่ทันที` : 'บันทึกเกณฑ์แล้ว แต่เปลี่ยนสถานะไม่สำเร็จ (ไม่มีสิทธิ์แก้ทะเบียน)')
  }
  return (
    <Sheet title="เกณฑ์เปลี่ยนสถานะอัตโนมัติ" onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>วัดจากความถี่การมานมัสการที่ลงชื่อไว้ในระบบ (เดือนละหลายอาทิตย์ จึงนับ “มากี่ครั้ง” กับ “มาครบกี่เดือน” ควบคู่กัน) · ไม่ตัดสินคนที่ระบบยังมีข้อมูลลงชื่อไม่ครอบคลุมช่วงที่วัด</p>
      <label className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={settings.statusAuto !== false} onChange={() => setMsg(save({ statusAuto: settings.statusAuto === false }) ? (settings.statusAuto === false ? 'เปิดเปลี่ยนสถานะอัตโนมัติแล้ว' : 'ปิดเปลี่ยนสถานะอัตโนมัติแล้ว') : 'ไม่มีสิทธิ์บันทึก')} aria-label="เปลี่ยนสถานะอัตโนมัติ" />
        <span><b>เปลี่ยนสถานะอัตโนมัติ</b><br /><span className="small muted">ระบบเปลี่ยนให้เองเมื่อเปิดแอปด้วยบัญชีที่แก้ทะเบียนได้ และแจ้งรายการให้เห็น</span></span>
      </label>
      <b>คนใหม่ → ผู้ร่วมนมัสการ</b>
      {num('newMonths', 'มานมัสการมาแล้วอย่างน้อย', 'เดือน (นับจากครั้งแรก)')}
      {num('newVisits', 'มาอย่างน้อย', 'ครั้ง ในช่วงนั้น')}
      {num('newMonthsPresent', 'มาครบอย่างน้อย', 'เดือน (เดือนละ ≥ 1 ครั้ง)')}
      {num('newLastDays', 'ครั้งล่าสุดไม่เกิน', 'วันที่แล้ว')}
      <b>ผู้ร่วมนมัสการ → สมาชิกสำรอง</b>
      {num('workMonths', 'เป็นผู้ร่วมต่อเนื่องเกิน', 'เดือน')}
      {num('workVisits', 'มาอย่างน้อย', 'ครั้ง ในช่วงนั้น')}
      {num('workMonthsPresent', 'มาครบอย่างน้อย', 'เดือน (เดือนละ ≥ 1 ครั้ง)')}
      {num('workLastDays', 'ครั้งล่าสุดไม่เกิน', 'วันที่แล้ว')}
      <button type="button" className="mini" onClick={() => setCfg(DEFAULT_STATUS_RULES)}>↺ คืนค่าตั้งต้น</button>
      {warns.length > 0 && <ul role="alert" className="small" style={{ color: '#b45309', margin: 0, paddingLeft: '1.2rem' }}>{warns.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
      <p style={{ margin: 0 }}><b>เข้าเกณฑ์ตอนนี้ {moves.length} คน</b>{changed ? ` (ตามเกณฑ์ที่กำลังแก้ · ถ้าบันทึก จะเปลี่ยนสถานะ${settings.statusAuto === false ? 'เมื่อกดเอง' : 'ทันที'})` : ''}</p>
      {moves.length > 0 && (
        <div style={{ maxHeight: '28vh', overflow: 'auto' }} role="list" aria-label="คนที่เข้าเกณฑ์เปลี่ยนสถานะ">
          {moves.map((v) => <div key={v.m.id} role="listitem" style={{ borderBottom: '1px solid var(--line)', padding: '0.25rem 0' }}><b>{v.m.name}</b><br /><span className="small">{v.from} → <b>{v.to}</b></span><br /><span className="small muted">{v.why}</span></div>)}
        </div>
      )}
      <b>ตรวจรายการที่ระบบเปลี่ยนไปแล้ว</b>
      {reviews.length === 0 ? <p className="small muted" style={{ margin: 0 }}>ยังไม่มีรายการที่ระบบเปลี่ยนสถานะให้</p> : (
        <>
          <p className="small muted" style={{ margin: 0 }}>เทียบกับเกณฑ์ปัจจุบัน: ✅ ยังเข้าเกณฑ์ · ❌ ไม่เข้า (เปลี่ยนไปด้วยเกณฑ์รุ่นก่อนที่หลวมกว่า) — ติ๊กคนที่ต้องการคืนสถานะเดิม</p>
          <div style={{ maxHeight: '30vh', overflow: 'auto' }} role="list" aria-label="รายการที่ระบบเปลี่ยนสถานะไปแล้ว">
            {reviews.map((r) => (
              <label key={r.m.id} role="listitem" className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', padding: '0.25rem 0' }}>
                <input type="checkbox" checked={revertIds.has(r.m.id)} onChange={() => setRevertIds((q) => { const n = new Set(q); if (n.has(r.m.id)) n.delete(r.m.id); else n.add(r.m.id); return n })} aria-label={`คืนสถานะเดิม ${r.m.name}`} />
                <span style={{ minWidth: 0 }}>{r.fits ? '✅' : '❌'} <b>{r.m.name}</b><br /><span className="small">{r.from} → <b>{r.to}</b></span><br /><span className="small muted">{r.fits ? r.nowWhy : `ไม่เข้าเกณฑ์ปัจจุบัน (ตอนนั้น: ${r.why})`}</span></span>
              </label>
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn--block" disabled={revertIds.size === 0} onClick={() => { const rs = reviews.filter((r) => revertIds.has(r.m.id)); setMsg(put(revertStatusMoves(rs, Date.now())) ? `คืนสถานะเดิม ${rs.length} คนแล้ว` : 'ไม่มีสิทธิ์แก้ทะเบียน'); setRevertIds(new Set()) }}>↩︎ คืนสถานะเดิมที่เลือก ({revertIds.size} คน)</button>
        </>
      )}
      {locked.length > 0 && (
        <>
          <b>คนที่กำหนดสถานะเอง (ล็อก) {locked.length} คน</b>
          <div role="list" aria-label="คนที่ล็อกสถานะ">{locked.map((x) => <div key={x.id} role="listitem" className="row row--between" style={{ borderBottom: '1px solid var(--line)', padding: '0.25rem 0', flexWrap: 'nowrap' }}><span>🔒 <b>{x.name}</b> · {statusLabel(x.status)}{x.statusLock?.why ? ` · ${x.statusLock.why}` : ''}</span><button type="button" className="mini" onClick={() => put([{ ...x, statusLock: undefined, updated: Date.now() }])}>ปลดล็อก</button></div>)}</div>
        </>
      )}
      {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
      <button type="button" className="btn btn--gold bigbtn btn--block" onClick={save1}>💾 บันทึกเกณฑ์{settings.statusAuto === false ? '' : ' + เปลี่ยนสถานะทันที'}</button>
      {settings.statusAuto === false && moves.length > 0 && <button type="button" className="btn btn--ghost btn--block" onClick={() => setMsg(put(applyStatusMoves(moves, today, Date.now())) ? `เปลี่ยนสถานะ ${moves.length} คนแล้ว` : 'ไม่มีสิทธิ์แก้ทะเบียน')}>เปลี่ยนสถานะ ({moves.length} คน)</button>}
    </Sheet>
  )
}

/** จัดกลุ่มตามอายุ+เพศ: ตารางกติกา (แก้ได้) + รายชื่อที่กลุ่มไม่ตรงกับอายุ → ติ๊กตรวจแล้วย้ายทีเดียว */
function RegroupSheet({ members, put, onClose }: { members: ChurchMember[]; put: (x: ChurchMember[]) => boolean; onClose: () => void }) {
  const { settings, save } = useSettings()
  const live = members.filter((x) => !x.deleted)
  const groups = [...new Set(live.map((x) => x.group?.trim()).filter(Boolean) as string[])].sort()
  const [rules, setRules] = useState(() => effectiveRules(settings.ageRules, groups))
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [showRules, setShowRules] = useState(false)
  const [msg, setMsg] = useState('')
  const today = todayISO()
  const props = proposeRegroup(live, rules, today)
  const chosen = props.filter((p) => !skip.has(p.m.id))
  const noBirth = live.filter((x) => !x.birth).length
  const noGender = live.filter((x) => needsGender(x, rules, today)).length
  const setRule = (i: number, patch: Partial<(typeof rules)[number]>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const apply = () => { if (put(chosen.map((p) => ({ ...p.m, group: p.to, updated: Date.now() })))) { setMsg(`ย้ายกลุ่มแล้ว ${chosen.length} คน`); setSkip(new Set()) } else setMsg('ไม่มีสิทธิ์บันทึก') }
  // บันทึกกติกาแล้วปรับกลุ่มของทุกคนให้ตรงกติกาใหม่ทันที (เมื่อเปิดย้ายอัตโนมัติ) · ปิดอัตโนมัติ = บอกจำนวนที่ไม่ตรงให้กดย้ายเอง
  const saveRules = () => {
    if (!save({ ageRules: rules })) return setMsg('ไม่มีสิทธิ์บันทึกกติกา')
    const all = proposeRegroup(live, rules, today)
    if (all.length === 0) return setMsg('บันทึกกติกาแล้ว — ทุกคนอยู่ในกลุ่มที่ตรงกติกาอยู่แล้ว')
    if (settings.ageAuto === false) return setMsg(`บันทึกกติกาแล้ว — มี ${all.length} คนที่กลุ่มไม่ตรงกติกาใหม่ กด “ย้ายกลุ่ม” เพื่อปรับ`)
    const now = Date.now()
    setMsg(put(all.map((p) => ({ ...p.m, group: p.to, groupMoved: { from: p.from, at: now }, updated: now }))) ? `บันทึกกติกาแล้ว และย้ายกลุ่ม ${all.length} คนให้ตรงกติกาใหม่ทันที` : 'บันทึกกติกาแล้ว แต่ย้ายกลุ่มไม่สำเร็จ (ไม่มีสิทธิ์แก้ทะเบียน)')
  }
  const warns = ruleWarnings(rules)
  const saved = effectiveRules(settings.ageRules, groups)
  const changedRules = JSON.stringify(saved) !== JSON.stringify(rules)
  return (
    <Sheet title="จัดกลุ่มตามอายุ" onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>ระบบคำนวณอายุจากวันเกิดของวันนี้ แล้วเทียบกับกติกาของแต่ละกลุ่ม · เสนอเฉพาะคนที่กลุ่มไม่ตรง คุณตรวจแล้วกดย้ายทีเดียว · ไม่แตะคนที่ไม่มีวันเกิด ({noBirth} คน) คนที่อยู่กลุ่มพิเศษที่ไม่มีกติกา หรือคนที่ล็อกกลุ่มไว้{noGender > 0 ? ` · วัยบุรุษ/สตรีที่ยังไม่ทราบเพศ ${noGender} คน (ต้องกรอกเพศก่อนจึงจัดให้ได้)` : ''}</p>
      <label className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={settings.ageAuto !== false} onChange={() => setMsg(save({ ageAuto: settings.ageAuto === false }) ? (settings.ageAuto === false ? 'เปิดย้ายกลุ่มอัตโนมัติแล้ว' : 'ปิดย้ายกลุ่มอัตโนมัติแล้ว — ระบบจะเสนอให้กดเอง') : 'ไม่มีสิทธิ์บันทึก')} aria-label="ย้ายกลุ่มอัตโนมัติ" />
        <span><b>ย้ายกลุ่มอัตโนมัติเมื่อถึงช่วงวัย</b><br /><span className="small muted">ระบบย้ายให้เองเมื่อเปิดแอปด้วยบัญชีที่แก้ทะเบียนได้ และแจ้งรายการให้เห็น (คืนกลุ่มเดิมได้ที่หน้ารายละเอียดของแต่ละคน)</span></span>
      </label>
      <button type="button" className="mini" aria-expanded={showRules} onClick={() => setShowRules(!showRules)}>{showRules ? '▲ ซ่อนกติกา' : '▼ ดู/แก้กติกาของแต่ละกลุ่ม'}</button>
      {showRules && (
        <div aria-label="กติกาจัดกลุ่มตามอายุ">
          {rules.length === 0 && <p className="small muted" style={{ margin: 0 }}>ยังไม่มีกลุ่มที่ระบบเดากติกาได้จากชื่อ</p>}
          {rules.map((r, i) => (
            <div key={r.group} className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--line)', padding: '0.3rem 0' }}>
              <label className="row" style={{ gap: 6, flex: '1 1 8rem' }}><input type="checkbox" checked={r.on} onChange={() => setRule(i, { on: !r.on })} aria-label={`ใช้กติกา ${r.group}`} /><b>{r.group}</b></label>
              <input className="input" style={{ width: '4.2rem' }} type="number" min={0} aria-label={`${r.group} อายุตั้งแต่`} value={r.from} onChange={(e) => setRule(i, { from: Number(e.target.value) })} />
              <span>–</span>
              <input className="input" style={{ width: '4.2rem' }} type="number" min={0} aria-label={`${r.group} อายุถึง`} value={r.to} onChange={(e) => setRule(i, { to: Number(e.target.value) })} />
              <select className="input" style={{ width: '6.5rem' }} aria-label={`${r.group} เพศ`} value={r.gender ?? ''} onChange={(e) => setRule(i, { gender: (e.target.value || undefined) as 'ชาย' | 'หญิง' | undefined })}><option value="">ทุกเพศ</option><option value="ชาย">ชาย</option><option value="หญิง">หญิง</option></select>
            </div>
          ))}
          {warns.length > 0 && <ul role="alert" className="small" style={{ color: '#b45309', margin: '0.3rem 0 0', paddingLeft: '1.2rem' }}>{warns.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
          {changedRules && <p className="small" style={{ margin: '0.3rem 0 0' }}>ถ้าบันทึกกติกานี้ จะมี <b>{props.length} คน</b> ถูกย้ายกลุ่ม{settings.ageAuto === false ? ' (เมื่อกดย้ายเอง)' : 'ทันที'}</p>}
          <button type="button" className="btn btn--ghost" style={{ marginTop: 6 }} onClick={saveRules}>💾 บันทึกกติกา{settings.ageAuto === false ? '' : ' + ย้ายกลุ่มทันที'}</button>
        </div>
      )}
      <p style={{ margin: 0 }}><b>กลุ่มไม่ตรงกับอายุ {props.length} คน</b></p>
      {props.length === 0 ? <p style={{ margin: 0 }}>✅ ทุกคนที่มีวันเกิดอยู่ในกลุ่มที่ตรงกับอายุแล้ว</p> : (
        <div style={{ maxHeight: '40vh', overflow: 'auto' }} role="list" aria-label="คนที่กลุ่มไม่ตรงอายุ">
          {props.map((p) => (
            <label key={p.m.id} role="listitem" className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', padding: '0.3rem 0' }}>
              <input type="checkbox" checked={!skip.has(p.m.id)} onChange={() => setSkip((q) => { const n = new Set(q); if (n.has(p.m.id)) n.delete(p.m.id); else n.add(p.m.id); return n })} aria-label={`ย้าย ${p.m.name}`} />
              <span style={{ minWidth: 0 }}><b>{p.m.name}</b>{p.m.nick ? ` (${p.m.nick})` : ''} <span className="small muted">อายุ {p.age} ปี{p.m.gender ? ` · ${p.m.gender}` : ''}</span><br /><span className="small">{p.from || '(ไม่มีกลุ่ม)'} → <b>{p.to}</b></span></span>
            </label>
          ))}
        </div>
      )}
      {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
      <button type="button" className="btn btn--gold bigbtn btn--block" disabled={chosen.length === 0} onClick={apply}>✓ ย้ายกลุ่ม ({chosen.length} คน)</button>
    </Sheet>
  )
}

/** “ไม่พบชื่อของฉัน” — เพิ่มเป็นสมาชิกใหม่จากข้อมูลที่กรอก (ตรวจก่อนยืนยัน) */
function NewMemberSheet({ a, put, onClose }: { a: NonNullable<ReturnType<typeof parseReply>>; put: (x: ChurchMember[]) => boolean; onClose: () => void }) {
  const base = { id: newId('m'), updated: Date.now(), name: a.name, status: NEW_PERSON_STATUS } as ChurchMember
  const diffs = diffAnswer(base, a).filter((d) => d.changed && d.key !== 'name')
  const add = () => { if (put([applyAnswer(base, a, new Set(diffs.map((d) => d.key)))])) onClose() }
  return (
    <Sheet title="เพิ่มสมาชิกใหม่ (ไม่พบชื่อในรายการ)" onClose={onClose}>
      <p style={{ margin: 0 }}>🆕 <b>{a.name}</b></p>
      <p className="small muted" style={{ margin: 0 }}>ตรวจก่อนว่าไม่ใช่คนที่มีอยู่ในทะเบียนแล้วด้วยชื่ออื่น (ค้นหาชื่อในรายชื่อก่อนกดเพิ่ม)</p>
      <dl style={{ margin: 0 }}>{diffs.map((d) => <div key={d.key} style={{ borderBottom: '1px solid var(--line)', padding: '0.3rem 0' }}><b>{d.label}</b>: {d.next}</div>)}</dl>
      {a.note && <p className="small" style={{ margin: 0 }}>💬 {a.note}</p>}
      <button type="button" className="btn btn--gold bigbtn btn--block" onClick={add}>✓ เพิ่มเป็นสมาชิกใหม่</button>
    </Sheet>
  )
}

/** กลุ่มที่มีอยู่จริงในทะเบียน (ใช้เป็นตัวเลือก) */
const groupOptions = (ms: { group?: string }[]) => [...new Set(ms.map((m) => m.group?.trim()).filter(Boolean))] as string[]

function MemberForm({ lite, canDelete, member, statuses, groups, onClose, put, remove }: { lite: boolean; canDelete: boolean; member: ChurchMember | null; statuses: string[]; groups: string[]; onClose: () => void; put: (x: ChurchMember[]) => boolean; remove: (id: string) => boolean }) {
  const [f, setF] = useState({ name: member?.name ?? '', nick: member?.nick ?? '', code: member?.code ?? '', tel: member?.tel ?? '', group: member?.group ?? '', status: member?.status ? statusLabel(member.status) : NEW_PERSON_STATUS, since: member?.since ?? '', firstWorship: member?.firstWorship ?? '', note: member?.note ?? '', birth: member?.birth ?? '', gender: member?.gender ?? '' })
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
    if (put([{ ...member, ...Object.fromEntries(Object.keys(f).map((k) => [k, undefined])), ...clean, gender: f.gender === 'ชาย' || f.gender === 'หญิง' ? f.gender : undefined, genderGuess: f.gender === (member?.gender ?? '') ? member?.genderGuess : undefined, name: f.name.trim(), ...(lite ? {} : { lat: coord?.lat, lng: coord?.lng }), ...(!member || statusLabel(member.status) !== statusLabel(f.status) ? { statusAt: todayISO() } : {}), id: member?.id ?? newId('cm'), updated: 0 }])) onClose()
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
        {text('since', 'วันที่รับเป็นสมาชิก (วันที่เริ่มมา)', 'date')}
        {text('firstWorship', 'มานมัสการครั้งแรก (ประมาณ)', 'date')}
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
