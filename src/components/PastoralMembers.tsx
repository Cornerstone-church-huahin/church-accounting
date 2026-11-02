import { lazy, Suspense, useMemo, useState } from 'react'
import { canRole, canWork } from '../lib/access'
import MultiPick from './MultiPick'
import { useAttendance, useChurchMembers } from '../lib/data'
import type { ChurchMember } from '../lib/types'
import { useRole } from '../lib/members'
import { hasCoord } from '../lib/geo'
import { todayISO } from '../lib/money'
import { ageBands, genderByStatus, genderSplit, groupCounts, headline, inGroup, isLive, joinYears, absence, attendanceInWindow, orderByFrequency, orderByTenure, PICK_STATUS_GROUPS, statusGroupLabel, REG_PERIODS, type RegPeriod, orderMembers, STATUS_GROUPS, tenureDays, tenureText, visitStats, type StatusGroup, type BaseGroup } from '../lib/pastoral'
import { DEFAULT_CRITERIA, evaluate, OFFICIAL_STATUSES, statusLabel, statusShort, toAttendance } from '../lib/registry'
import type { MapPin } from './LeafletMap'
import MemberAvatar from './MemberAvatar'
import QuickReports from './QuickReports'

const LeafletMap = lazy(() => import('./LeafletMap'))

type Ord = 'old' | 'new' | 'recent' | 'pct' | 'pctAsc' | 'name' | 'nameDesc'
/** 6 แท็บ (2 แถว): 1 เก่าแก่ → ใหม่ · 2 ความสม่ำเสมอในการมา · 3 สถานะ · 4 กลุ่ม · 5 อายุ · 6 เพศ */
const TABS = [{ n: 1, name: 'เก่าแก่' }, { n: 2, name: 'สม่ำเสมอ' }, { n: 3, name: 'สถานะ' }, { n: 4, name: 'กลุ่ม' }, { n: 5, name: 'อายุ' }, { n: 6, name: 'เพศ' }]
const ORDERS: Record<number, { k: Ord; t: string }[]> = {
  1: [{ k: 'old', t: 'เก่าแก่ → ใหม่' }, { k: 'new', t: 'ใหม่ → เก่าแก่' }, { k: 'name', t: 'ชื่อ ก → ฮ' }, { k: 'nameDesc', t: 'ชื่อ ฮ → ก' }],
  2: [{ k: 'pct', t: 'สม่ำเสมอสุด → น้อยสุด' }, { k: 'pctAsc', t: 'น้อยสุด → สม่ำเสมอสุด' }, { k: 'name', t: 'ชื่อ ก → ฮ' }, { k: 'nameDesc', t: 'ชื่อ ฮ → ก' }],
}
/** สีของหลอดความสม่ำเสมอ: เต็มปี = เขียวเข้ม · ลดลงเป็นเขียวอ่อน เหลือง ส้ม แดง */
const gaugeColor = (p: number) => (p >= 0.8 ? '#1b7f4b' : p >= 0.6 ? '#7aa63a' : p >= 0.4 ? '#d9a21b' : p >= 0.2 ? '#e0762a' : '#c0261b')
/** ชื่อกลุ่มของสมาชิก (ตัดเลขนำหน้า · ไม่มี = ไม่มีกลุ่ม) */
const grpName = (m: { group?: string }) => { const raw = (m.group ?? '').trim(); return !raw || /ไม่มีกลุ่ม/.test(raw) ? 'ไม่มีกลุ่ม' : raw }
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0)
const NAVY = '#1a2b4c', GOLD = '#c99a14', BLUE = '#1f5fbf', ROSE = '#c2255c', GRAY = '#9aa3b2'

/** แถบแนวนอน: ป้าย · แถบสัดส่วน · จำนวน */
function BarRow({ label, n, total, color = NAVY, onClick, active }: { label: string; n: number; total: number; color?: string; onClick?: () => void; active?: boolean }) {
  const body = (
    <>
      <span className="pbar__label">{label}</span>
      <span className="pbar__track" aria-hidden="true"><span style={{ width: `${Math.max(pct(n, total), n ? 2 : 0)}%`, background: color }} /></span>
      <b className="pbar__n">{n.toLocaleString('th-TH')}</b>
    </>
  )
  return onClick
    ? <button type="button" className={`pbar pbar--btn${active ? ' on' : ''}`} aria-pressed={active} onClick={onClick}>{body}</button>
    : <div className="pbar" role="img" aria-label={`${label} ${n} คน (${pct(n, total)}%)`}>{body}</div>
}

/** แผนภูมิแท่งแนวตั้ง */
function Columns({ data, label, color = BLUE }: { data: { key: string; value: number; sub?: string }[]; label: string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="pcols" role="img" aria-label={`${label}: ${data.map((d) => `${d.key} ${d.value}`).join(', ')}`}>
      {data.map((d) => (
        <div key={d.key} className="pcols__col">
          <b>{d.value}</b>
          <span className="pcols__bar" style={{ height: `${Math.max((d.value / max) * 100, d.value ? 4 : 0)}%`, background: color }} />
          <small>{d.key}</small>{d.sub && <small className="muted">{d.sub}</small>}
        </div>
      ))}
    </div>
  )
}

/**
 * หน้า “สมาชิก” ของงานอภิบาล (อ่านอย่างเดียว · ฐานข้อมูลหลักของสมาชิก): ตัวเลขสำคัญ · สถานะ (แตะเพื่อกรองส่วนอื่น) · ช่วงวัยและเพศ · กลุ่มและปีที่เข้าเป็นสมาชิก · แผนที่บ้านสมาชิก
 * อ่านจากทะเบียนจริง ไม่แก้ข้อมูลใด · พิกัดบ้านบันทึกที่งานทะเบียน (แอดมิน/ผู้บันทึกทะเบียน) · การติดตามจะแยกเป็นไอคอนต่อไป
 */
/** work = ห้องงานที่เปิดหน้านี้ (ใช้ตรวจสิทธิ์ดู): งานอภิบาล (4) และงานอนุชน (9) ใช้หน้าเดียวกัน ข้อมูลสมาชิกชุดเดียวกัน */
/** query: คำค้นชื่อ/นามสกุล/ชื่อเล่น/รหัส/เบอร์/หมายเหตุ (ใช้ในหน้ารวมสมาชิกของงานทะเบียน) · onOpen: ใส่เมื่อใช้ในงานทะเบียน (แอดมิน) — แตะการ์ดเพื่อเปิดรายละเอียดและแก้ไขได้ */
export default function PastoralMembers({ work = 4, onOpen, query = '', slot, idFilter, cardExtra, hideMap }: { /** ซ่อนแผนที่บ้านสมาชิก (ผู้ช่วยฝ่ายทะเบียน) */ hideMap?: boolean; work?: number; onOpen?: (id: string) => void; query?: string; slot?: React.ReactNode; /** กรองเพิ่ม (งานทะเบียน): แสดงเฉพาะรหัสที่อยู่ในชุดนี้ */ idFilter?: Set<string> | null; /** ข้อความ/ปุ่มเสริมใต้การ์ดแต่ละคน (งานทะเบียน) */ cardExtra?: (m: ChurchMember) => React.ReactNode } = {}) {
  const role = useRole()
  const today = todayISO()
  const people = useChurchMembers()
  const [gs, setGs] = useState<Exclude<StatusGroup, 'all'>[]>([]) // สถานะที่เลือกกรอง (หลายสถานะได้ · ว่าง = ทุกสถานะ)
  const toggleG = (k: Exclude<StatusGroup, 'all'>) => setGs((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]))
  const [tab, setTab] = useState(1)
  const [order, setOrder] = useState<Ord>('old')
  const [grpSel, setGrpSel] = useState<string[]>([]) // แท็บกลุ่ม: กลุ่มที่เลือกดูรายบุคคล (ว่าง = ดูภาพรวมทุกกลุ่ม)
  const [period, setPeriod] = useState<RegPeriod>('1y') // ช่วงเวลาที่ใช้วัดความสม่ำเสมอ
  const changeTab = (n: number) => { setTab(n); setOrder(n === 2 ? 'pct' : 'old') }
  const a0 = useAttendance(new Date().getFullYear()), a1 = useAttendance(new Date().getFullYear() - 1, false), a2 = useAttendance(new Date().getFullYear() - 2, false), a3 = useAttendance(new Date().getFullYear() - 3, false)
  const att = useMemo(() => toAttendance([a3, a2, a1, a0].flatMap((st) => st.items)), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => visitStats(att, todayISO()), [att])
  const all = people.items
  const qn = query.trim().toLowerCase().replace(/\s+/g, '')
  const sel = useMemo(() => all.filter((m) => (gs.length === 0 || gs.some((x) => inGroup(m, x))) && (!idFilter || idFilter.has(m.id)) && (!qn || `${m.name}${m.nick ?? ''}${m.code ?? ''}${m.tel ?? ''}${m.note ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(qn))), [all, gs, qn, idFilter])
  const ev = useMemo(() => { const r = evaluate(all, att, DEFAULT_CRITERIA, todayISO()); return { map: new Map(r.rows.map((x) => [x.member.id, x])), hasData: r.hasData, yearServices: r.yearServices } }, [all, att])
  const head = useMemo(() => headline(all), [all])
  const ages = useMemo(() => ageBands(sel, today), [sel, today])
  const sex = useMemo(() => genderSplit(sel), [sel])
  const groups = useMemo(() => groupCounts(sel), [sel])
  const joins = useMemo(() => joinYears(sel).slice(-6), [sel])
  const pins = useMemo<MapPin[]>(() => sel.filter(hasCoord).map((m) => ({ id: m.id, lat: m.lat as number, lng: m.lng as number, label: m.name, sub: statusShort(m.status) })), [sel])

  const quick = !onOpen && !idFilter ? <QuickReports members={all} attendance={att} /> : null // หน้ารวมสมาชิกของห้องงาน: ทางลัดวันเกิด/รายงานนมัสการ (ดูอย่างเดียว ทุกระดับ)
  if (!canRole(role, 'detail') && !canWork(work, 'view')) return <>{quick}<p className="empty">ไม่มีสิทธิ์ดูข้อมูลสมาชิก</p></>
  const gName = gs.length === 0 ? 'ทุกสถานะ' : PICK_STATUS_GROUPS.filter((x) => gs.includes(x.key)).concat(gs.filter((k) => !PICK_STATUS_GROUPS.some((x) => x.key === k)).map((k) => ({ key: k as never, label: statusGroupLabel(k) }))).map((x) => x.label).join(' + ')

  const TONES = ['own', 'fund', 'total', 'indebt', 'debt', 'land'] as const
  const orderName = ORDERS[tab]?.find((o) => o.k === order)?.t ?? ''
  // โซน 3: การ์ดสมาชิก 1 คน 1 การ์ด (ดูอย่างเดียว) · เริ่มต้นเรียงคนที่มานมัสการบ่อยที่สุดก่อน แล้วตามสถานะ 1,2,3…
  const tenureMap = useMemo(() => new Map(all.map((m) => [m.id, tenureDays(m.since, ev.map.get(m.id)?.firstAtt, today)])), [all, ev, today])
  const per = REG_PERIODS.find((x) => x.k === period) ?? REG_PERIODS[2]
  const winP = useMemo(() => attendanceInWindow(att, today, per.days), [att, today, per.days])
  const winY = useMemo(() => attendanceInWindow(att, today, 365), [att, today])
  const byGroup = tab === 4 // แท็บกลุ่ม: วัดความสม่ำเสมอ 1 ปีล่าสุดเสมอ
  const win = byGroup ? winY : winP
  const curPer = byGroup ? REG_PERIODS[2] : per
  const timesOf = (id: string) => (ev.hasData ? win.times.get(id) ?? 0 : 0) // จำนวนครั้งที่มาในช่วงที่เลือก
  const pctIn = (id: string) => Math.min(1, timesOf(id) / Math.max(1, win.services))
  // แท็บสถานะ: นับการมาทั้งหมดตั้งแต่เริ่มมีบันทึก ไม่จำกัดช่วงปี (มาครบ = ทุกครั้งที่มีบันทึกตั้งแต่เป็นสมาชิก)
  const lifeTimes = (id: string) => (ev.hasData ? ev.map.get(id)?.visits ?? 0 : 0)
  const cs = (id: string) => ({ t: timesOf(id), n: win.services, p: pctIn(id) })
  // แท็บสถานะ: แยกเป็นชุดตามสถานะ (สมบูรณ์ 1 → 2 → … ) ในแต่ละชุดเรียงคนที่มามากที่สุดก่อน · เลือกเฉพาะสถานะ = เหลือเฉพาะชุดนั้น
  const statusSections = useMemo(() => {
    const labels = [...OFFICIAL_STATUSES, ...new Set(sel.map((m) => statusLabel(m.status)).filter((l) => !OFFICIAL_STATUSES.includes(l)))]
    return labels.map((label) => ({ label, members: orderByFrequency(sel.filter((m) => statusLabel(m.status) === label), lifeTimes, true) })).filter((x) => x.members.length > 0)
  }, [sel, ev]) // eslint-disable-line react-hooks/exhaustive-deps
  const faces = useMemo(() => {
    const byName = () => { const xs = orderMembers(sel, 'name', stats, today); return order === 'nameDesc' ? xs.reverse() : xs }
    if (order === 'name' || order === 'nameDesc') return byName()
    if (tab === 4) return orderByFrequency(sel.filter((m) => grpSel.includes(grpName(m))), timesOf, true)
    if (tab === 2) return orderByFrequency(sel, timesOf, order !== 'pctAsc')
    if (order === 'old' || order === 'new') return orderByTenure(sel, (id) => tenureMap.get(id) ?? null, order === 'old')
    return orderMembers(sel, 'default', stats, today)
  }, [sel, order, tab, stats, today, ev, tenureMap, win, grpSel])
  const grp = grpName
  const sexRows = useMemo(() => genderByStatus(sel), [sel])
  const absLabel = (m: { id: string; status?: string }) => (!isLive(m) ? '' : absence(stats.get(m.id)?.last, today).label)
  const shortName = (n: string) => n.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/, '').trim() || n
  return (
    <div className="pastoral">
      {quick}
      {/* โซน 1: แท็บ 1–4 (แถบเตี้ย ชิดบนสุด) + ตัวเลือกค้นหา 2 ตัว */}
      <section className="pzone1 no-print" aria-label="เลือกแท็บและตัวเลือก">
        <nav className="ptabs" role="tablist" aria-label="แท็บสมาชิก">
          {TONES.map((t, i) => (
            <button key={t} type="button" role="tab" aria-selected={tab === i + 1} className={`ptab btile--${t}`} onClick={() => changeTab(i + 1)}>
              <span aria-hidden="true">{i + 1}</span> {TABS[i].name}
            </button>
          ))}
        </nav>
        {slot}
        <div className="pfilters pfilters--slim">
          <div className="field"><label htmlFor="pf-status">สถานะ</label>
            <MultiPick id="pf-status" title="สถานะ" allLabel="ทุกสถานะ" options={PICK_STATUS_GROUPS.map((x) => ({ value: x.key, label: x.label }))} value={gs} onChange={(v) => setGs(v as Exclude<StatusGroup, 'all'>[])} empty="ทุกสถานะ" /></div>
          {tab === 1 && <div className="field"><label htmlFor="pf-order">เรียงลำดับ</label>
            <select id="pf-order" className="input" value={order} onChange={(e) => setOrder(e.target.value as Ord)}>{ORDERS[tab].map((o) => <option key={o.k} value={o.k}>{o.t}</option>)}</select></div>}
          {tab === 4 && <div className="field"><label htmlFor="pf-group">กลุ่ม</label>
            <MultiPick id="pf-group" title="กลุ่ม" options={groups.map(([k, n]) => ({ value: k, label: `${k} (${n})` }))} value={grpSel} onChange={setGrpSel} empty="ทุกกลุ่ม" /></div>}
          {tab === 2 && <div className="field"><label htmlFor="pf-period">สม่ำเสมอภายใน</label>
            <select id="pf-period" className="input" value={period} onChange={(e) => setPeriod(e.target.value as RegPeriod)}>{REG_PERIODS.map((x) => <option key={x.k} value={x.k}>{x.t.replace('สม่ำเสมอภายใน', '')}</option>)}</select></div>}
        </div>
      </section>

      {/* โซน 2: ตัวเลขจำนวนเป็นตัวอักษร 2 แถว (ไม่ใช้การ์ด) */}
      <p className="pcounts" role="status" aria-label="จำนวนสมาชิก">
        <span>รายชื่อทั้งหมด <b>{head.total.toLocaleString('th-TH')}</b></span>
        <span>สมาชิกสมบูรณ์ (1+2) <b>{head.complete.toLocaleString('th-TH')}</b></span>
        <span>สมาชิกสำรอง <b>{head.reserve.toLocaleString('th-TH')}</b></span>
        <br />
        <span>คนใหม่ <b>{head.newcomer.toLocaleString('th-TH')}</b></span>
        <span>ผู้ร่วมนมัสการ <b>{head.worship.toLocaleString('th-TH')}</b></span>
        <span>สิ้นสภาพสมาชิก <b>{head.resigned.toLocaleString('th-TH')}</b></span>
        <span>เสียชีวิต <b>{head.deceased.toLocaleString('th-TH')}</b></span>
      </p>

      {/* โซน 3: รูปสมาชิกตามตัวเลือก — ดูอย่างเดียว กดเข้าไปดูรายละเอียดไม่ได้ */}
      <div className="pzone2" role="tabpanel" aria-label="พื้นที่แสดงผล">
      {tab === 3 && (
        <section className="pfaces" aria-label={`สมาชิกตามสถานะ ${gName}`}>
          <p className="pfaces__n muted small">{gName} · แสดง {sel.length.toLocaleString('th-TH')} คน · เรียงตามสถานะ (สมบูรณ์ 1 ก่อน) แล้วคนที่มามากที่สุดก่อน</p>
          {statusSections.length === 0 ? <p className="empty">ไม่มีสมาชิกในสถานะนี้</p> : statusSections.map((sec) => (
            <section key={sec.label} className="pstat__sec" aria-label={sec.label}>
              <h3 className="pstat__h"><b>{sec.label}</b> · {sec.members.length.toLocaleString('th-TH')} คน</h3>
              <ul className="pcards">
                {sec.members.map((m) => (
                  <li key={m.id} className={`pcard${onOpen ? ' pcard--tap' : ''}${/เสียชีวิต/.test(m.status ?? '') ? ' pcard--gone' : ''}`} aria-label={m.name} {...(onOpen ? { role: 'button', tabIndex: 0, onClick: () => onOpen(m.id), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(m.id) } } } : {})}>
                    <MemberAvatar path={m.photoPath} name={shortName(m.name)} size={48} member={m} />
                    <div className="pcard__body">
                      <span className="pcard__l1"><b className="pcard__name">{m.name}{m.nick?.trim() ? <span className="pcard__nick"> ({m.nick.trim()})</span> : null}</b>{absLabel(m) && <b className="pcard__abs">{absLabel(m)}</b>}</span>
                      <span className="pcard__l2">{ev.hasData ? <>มาทั้งหมด <b>{lifeTimes(m.id).toLocaleString('th-TH')}</b> ครั้ง · </> : null}กลุ่ม {grp(m)}</span>
                      {cardExtra?.(m)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      )}
      {tab === 4 && grpSel.length === 0 && (
        <section className="card" aria-label="กลุ่มสมาชิก">
          <h2 style={{ margin: 0 }}>กลุ่มและปีที่เข้าเป็นสมาชิก <span className="muted small">({gName})</span></h2>
          {groups.map(([k, n]) => <BarRow key={k} label={k} n={n} total={sel.length} color={k === 'ไม่มีกลุ่ม' ? GRAY : NAVY} />)}
          <p className="home-label" style={{ margin: '0.8rem 0 0.2rem' }}>เข้าเป็นสมาชิกตามปี</p>
          {joins.length === 0 ? <p className="empty">ไม่มีข้อมูลวันที่เข้า</p> : <Columns label="เข้าเป็นสมาชิกตามปี" data={joins.map((j) => ({ key: String(j.year + 543), value: j.count }))} color={GOLD} />}
        </section>
      )}
      {tab === 5 && (
        <section className="card" aria-label="อายุสมาชิก">
          <h2 style={{ margin: 0 }}>อายุสมาชิก <span className="muted small">({gName})</span></h2>
          {ages.known === 0 ? <p className="empty">ยังไม่มีวันเกิดในทะเบียน</p> : ages.bands.map((b) => <BarRow key={b.key} label={b.label} n={b.count} total={ages.known} color={BLUE} />)}
          <p className="muted small" style={{ margin: '0.3rem 0 0' }}>ทราบวันเกิด {ages.known.toLocaleString('th-TH')} จาก {sel.length.toLocaleString('th-TH')} คน ({pct(ages.known, sel.length)}%) · ไม่ทราบวันเกิด {ages.unknown.toLocaleString('th-TH')} คน — ยิ่งเก็บวันเกิดครบ ภาพรวมยิ่งตรง</p>
        </section>
      )}
      {tab === 6 && (
        <section className="card" aria-label="เพศสมาชิก">
          <h2 style={{ margin: 0 }}>เพศสมาชิก <span className="muted small">({gName})</span></h2>
          <div className="psexbig" role="group" aria-label="จำนวนตามเพศ">
            <div className="psexbig__c" style={{ borderColor: BLUE }}><span>ชาย</span><b style={{ color: BLUE }}>{sex.ชาย.toLocaleString('th-TH')}</b><small>{pct(sex.ชาย, sel.length)}%</small></div>
            <div className="psexbig__c" style={{ borderColor: ROSE }}><span>หญิง</span><b style={{ color: ROSE }}>{sex.หญิง.toLocaleString('th-TH')}</b><small>{pct(sex.หญิง, sel.length)}%</small></div>
            <div className="psexbig__c" style={{ borderColor: GRAY }}><span>ไม่ระบุ</span><b style={{ color: GRAY }}>{sex.ไม่ระบุ.toLocaleString('th-TH')}</b><small>{pct(sex.ไม่ระบุ, sel.length)}%</small></div>
          </div>
          <div className="psex" role="img" aria-label={`ชาย ${sex.ชาย} หญิง ${sex.หญิง} ไม่ระบุ ${sex.ไม่ระบุ}`}>
            {([['ชาย', sex.ชาย, BLUE], ['หญิง', sex.หญิง, ROSE], ['ไม่ระบุ', sex.ไม่ระบุ, GRAY]] as const).map(([k, v, c]) => v > 0 && <span key={k} style={{ width: `${pct(v, sel.length)}%`, background: c }} />)}
          </div>
          <p className="small" role="status" style={{ margin: 0 }}>รวม {sel.length.toLocaleString('th-TH')} คน · “ไม่ระบุ” = ทะเบียนยังไม่ได้กรอกเพศ</p>
          <div className="rtblwrap"><table className="tbl rtbl" aria-label="เพศแยกตามสถานะ">
            <thead><tr><th>สถานะ</th><th className="num">ชาย</th><th className="num">หญิง</th><th className="num">ไม่ระบุ</th></tr></thead>
            <tbody>{sexRows.map((r) => <tr key={r.label}><td>{r.label}</td><td className="num">{r.ชาย}</td><td className="num">{r.หญิง}</td><td className="num">{r.ไม่ระบุ}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
      {(tab === 1 || tab === 2 || (tab === 4 && grpSel.length > 0)) && <>
      <section className="pfaces" aria-label={`รูปสมาชิก ${gName}`}>
        <p className="pfaces__n muted small">{gName}{tab === 4 ? ` · กลุ่ม ${grpSel.join(', ')}` : ''} · แสดง {faces.length.toLocaleString('th-TH')} คน · เรียง {tab === 4 ? 'สม่ำเสมอสุด → น้อยสุด' : orderName}</p>
        {((tab === 2 && order !== 'name' && order !== 'nameDesc') || tab === 4) && <p className="pfaces__n small" style={{ margin: '0 0 0.4rem' }}><b>{curPer.t}</b> · นับจำนวนครั้งที่มานมัสการใน{curPer.short} ยิ่งมากยิ่งอยู่บน (เต็มหลอด = มาครบทุกครั้งที่มีบันทึก)</p>}
        {faces.length === 0 ? <p className="empty">ไม่มีสมาชิกในสถานะนี้</p> : (
          <ul className="pcards">
            {faces.map((m) => (
              <li key={m.id} className={`pcard${onOpen ? ' pcard--tap' : ''}${/เสียชีวิต/.test(m.status ?? '') ? ' pcard--gone' : ''}`} aria-label={m.name} {...(onOpen ? { role: 'button', tabIndex: 0, onClick: () => onOpen(m.id), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(m.id) } } } : {})}>
                <MemberAvatar path={m.photoPath} name={shortName(m.name)} size={52} member={m} />
                <div className="pcard__body">
                  <span className="pcard__l1"><b className="pcard__name">{m.name}{m.nick?.trim() ? <span className="pcard__nick"> ({m.nick.trim()})</span> : null}</b>{absLabel(m) && <b className="pcard__abs">{absLabel(m)}</b>}</span>
                  {tab === 1
                    ? <span className="pcard__l2">สมาชิกมา <b>{tenureText(tenureMap.get(m.id) ?? null)}</b> · {statusShort(m.status)} · กลุ่ม {grp(m)}</span>
                    : ev.hasData
                      ? (
                        <>
                          <span className="pcard__l2">มา <b>{cs(m.id).t}</b>/{cs(m.id).n} ครั้ง · <b className="pcard__pct">{Math.round(cs(m.id).p * 100)}%</b> · {statusShort(m.status)}</span>
                          <span className="pcard__gauge" role="img" aria-label={`${curPer.t} ${Math.round(cs(m.id).p * 100)}%`}><i style={{ width: `${Math.round(cs(m.id).p * 100)}%`, background: gaugeColor(cs(m.id).p) }} /></span>
                        </>
                      )
                      : <span className="pcard__l2">ยังไม่มีบันทึกลงชื่อนมัสการ</span>}
                  {cardExtra?.(m)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tab === 1 && !hideMap && <details className="pmore">
        <summary>รายละเอียดเพิ่มเติม (การ์ดสรุป)</summary>
      <section className="card" aria-labelledby="pm-2">
        <h2 id="pm-2">2 · สถานะสมาชิก <span className="muted small">(แตะเพื่อกรองส่วนที่ 3–5)</span></h2>
        {STATUS_GROUPS.filter((x) => x.key !== 'all').map((x) => <BarRow key={x.key} label={x.label} n={head[x.key as BaseGroup]} total={head.total} color={gs.includes(x.key as Exclude<StatusGroup, 'all'>) ? GOLD : NAVY} active={gs.includes(x.key as Exclude<StatusGroup, 'all'>)} onClick={() => toggleG(x.key as Exclude<StatusGroup, 'all'>)} />)}
        <p className="small" role="status" style={{ margin: '0.5rem 0 0' }}>{gs.length === 0 ? 'กำลังดูทุกสถานะ' : <>กำลังดูเฉพาะ <b>{gName}</b> ({sel.length} คน) · <button type="button" className="mini" onClick={() => setGs([])}>ดูทุกสถานะ</button></>}</p>
      </section>

      <section className="card" aria-labelledby="pm-3">
        <h2 id="pm-3">3 · ช่วงวัยและเพศ <span className="muted small">({gName})</span></h2>
        {ages.known === 0 ? <p className="empty">ยังไม่มีวันเกิดในทะเบียน</p> : ages.bands.map((b) => <BarRow key={b.key} label={b.label} n={b.count} total={ages.known} color={BLUE} />)}
        <p className="muted small" style={{ margin: '0.3rem 0 0.6rem' }}>ทราบวันเกิด {ages.known} จาก {sel.length} คน ({pct(ages.known, sel.length)}%) — ยิ่งเก็บวันเกิดครบ ภาพรวมยิ่งแม่นยำ</p>
        <div className="psex" role="img" aria-label={`ชาย ${sex.ชาย} หญิง ${sex.หญิง} ไม่ระบุ ${sex.ไม่ระบุ}`}>
          {([['ชาย', sex.ชาย, BLUE], ['หญิง', sex.หญิง, ROSE], ['ไม่ระบุ', sex.ไม่ระบุ, GRAY]] as const).map(([k, v, c]) => v > 0 && <span key={k} style={{ width: `${pct(v, sel.length)}%`, background: c }}>{pct(v, sel.length) >= 8 ? `${k} ${v}` : ''}</span>)}
        </div>
        <p className="small" style={{ margin: '0.3rem 0 0' }}>ชาย {sex.ชาย} · หญิง {sex.หญิง} · ไม่ระบุ {sex.ไม่ระบุ}</p>
      </section>

      <section className="card" aria-labelledby="pm-4">
        <h2 id="pm-4">4 · กลุ่มและปีที่เข้าเป็นสมาชิก <span className="muted small">({gName})</span></h2>
        {groups.map(([k, n]) => <BarRow key={k} label={k} n={n} total={sel.length} color={k === 'ไม่มีกลุ่ม' ? GRAY : NAVY} />)}
        <p className="home-label" style={{ margin: '0.8rem 0 0.2rem' }}>เข้าเป็นสมาชิกตามปี</p>
        {joins.length === 0 ? <p className="empty">ไม่มีข้อมูลวันที่เข้า</p> : <Columns label="เข้าเป็นสมาชิกตามปี" data={joins.map((j) => ({ key: String(j.year + 543), value: j.count }))} color={GOLD} />}
      </section>

      <section className="card" aria-labelledby="pm-5">
        <h2 id="pm-5">5 · แผนที่บ้านสมาชิก <span className="muted small">({gName})</span></h2>
        <p className="small" role="status" style={{ margin: '0 0 0.5rem' }}>บันทึกพิกัดบ้านแล้ว <b>{pins.length}</b> จาก {sel.length} คน ({pct(pins.length, sel.length)}%) · แตะหมุดเพื่อดูชื่อ</p>
        {pins.length === 0
          ? <p className="empty">ยังไม่มีพิกัดบ้านของสมาชิก — ผู้ดูแลทะเบียนเป็นผู้บันทึกข้อมูลนี้</p>
          : <Suspense fallback={<p className="muted small">กำลังโหลดแผนที่…</p>}><LeafletMap pins={pins} height={340} label="แผนที่บ้านสมาชิก" noLinks /></Suspense>}
        <p className="muted small" style={{ margin: '0.4rem 0 0' }}>แผนที่ © OpenStreetMap · พิกัดบ้านเป็นข้อมูลส่วนบุคคล เห็นได้เฉพาะผู้มีสิทธิ์ดูรายละเอียดสมาชิก</p>
      </section>
      </details>}
      </>}
      </div>
    </div>
  )
}
