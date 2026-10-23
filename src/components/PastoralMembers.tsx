import { lazy, Suspense, useMemo, useState } from 'react'
import { can } from '../lib/access'
import { useChurchMembers } from '../lib/data'
import { useRole } from '../lib/members'
import { hasCoord } from '../lib/geo'
import { todayISO } from '../lib/money'
import { ageBands, genderSplit, groupCounts, headline, inGroup, joinYears, STATUS_GROUPS, type StatusGroup } from '../lib/pastoral'
import { statusShort } from '../lib/registry'
import type { MapPin } from './LeafletMap'
import MemberAvatar from './MemberAvatar'

const LeafletMap = lazy(() => import('./LeafletMap'))

const ORDERS = [{ k: 'default', t: 'ตามค่าเริ่มต้น' }, { k: 'desc', t: 'จำนวนมาก → น้อย' }, { k: 'asc', t: 'จำนวนน้อย → มาก' }, { k: 'name', t: 'ชื่อ ก → ฮ' }]
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
export default function PastoralMembers() {
  const role = useRole()
  const today = todayISO()
  const people = useChurchMembers()
  const [g, setG] = useState<StatusGroup>('all')
  const [tab, setTab] = useState(1)
  const [order, setOrder] = useState('default')
  const all = people.items
  const sel = useMemo(() => all.filter((m) => inGroup(m, g)), [all, g])
  const head = useMemo(() => headline(all), [all])
  const ages = useMemo(() => ageBands(sel, today), [sel, today])
  const sex = useMemo(() => genderSplit(sel), [sel])
  const groups = useMemo(() => groupCounts(sel), [sel])
  const joins = useMemo(() => joinYears(sel).slice(-6), [sel])
  const pins = useMemo<MapPin[]>(() => sel.filter(hasCoord).map((m) => ({ id: m.id, lat: m.lat as number, lng: m.lng as number, label: m.name, sub: statusShort(m.status) })), [sel])

  if (!can(role, 'detail')) return <p className="empty">ไม่มีสิทธิ์ดูข้อมูลสมาชิก</p>
  const gName = STATUS_GROUPS.find((x) => x.key === g)!.label

  const TONES = ['own', 'fund', 'total', 'indebt'] as const
  const orderName = ORDERS.find((o) => o.k === order)!.t
  // โซน 3: รูปสมาชิกตามตัวเลือก (ดูอย่างเดียว) · จำนวนมาก/น้อย = เรียงตามขนาดกลุ่มของสมาชิก
  const faces = useMemo(() => {
    const size = new Map(groupCounts(sel))
    const gk = (m: { group?: string }) => { const raw = (m.group ?? '').trim().replace(/^\d+\./, '').trim(); return !raw || /ไม่มีกลุ่ม/.test(raw) ? 'ไม่มีกลุ่ม' : raw === 'บรุษ' ? 'บุรุษ' : raw }
    const list = [...sel]
    if (order === 'name') list.sort((x, y) => x.name.localeCompare(y.name, 'th'))
    else if (order === 'desc' || order === 'asc') list.sort((x, y) => ((size.get(gk(y)) ?? 0) - (size.get(gk(x)) ?? 0)) * (order === 'desc' ? 1 : -1) || x.name.localeCompare(y.name, 'th'))
    return list
  }, [sel, order])
  const shortName = (n: string) => n.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/, '').trim() || n
  return (
    <div className="pastoral">
      {/* โซน 1: แท็บ 1–4 (แถบเตี้ย ชิดบนสุด) + ตัวเลือกค้นหา 2 ตัว */}
      <section className="pzone1 no-print" aria-label="เลือกแท็บและตัวเลือก">
        <nav className="ptabs" role="tablist" aria-label="แท็บสมาชิก">
          {TONES.map((t, i) => (
            <button key={t} type="button" role="tab" aria-selected={tab === i + 1} className={`ptab btile--${t}`} onClick={() => setTab(i + 1)}>
              <span aria-hidden="true">{i + 1}</span> แท็บ {i + 1}
            </button>
          ))}
        </nav>
        <div className="pfilters pfilters--slim">
          <div className="field"><label htmlFor="pf-status">สถานะ</label>
            <select id="pf-status" className="input" value={g} onChange={(e) => setG(e.target.value as StatusGroup)}>{STATUS_GROUPS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></div>
          <div className="field"><label htmlFor="pf-order">เรียงลำดับ</label>
            <select id="pf-order" className="input" value={order} onChange={(e) => setOrder(e.target.value)}>{ORDERS.map((o) => <option key={o.k} value={o.k}>{o.t}</option>)}</select></div>
        </div>
      </section>

      {/* โซน 2: ตัวเลขจำนวนเป็นตัวอักษร 2 แถว (ไม่ใช้การ์ด) */}
      <p className="pcounts" role="status" aria-label="จำนวนสมาชิก">
        <span>รายชื่อทั้งหมด <b>{head.total.toLocaleString('th-TH')}</b></span>
        <span>สมาชิกสมบูรณ์ (1+2) <b>{head.complete.toLocaleString('th-TH')}</b></span>
        <span>สมาชิกสำรอง <b>{head.reserve.toLocaleString('th-TH')}</b></span>
        <br />
        <span>ผู้ร่วมนมัสการ <b>{head.worship.toLocaleString('th-TH')}</b></span>
        <span>คนใหม่ <b>{head.newcomer.toLocaleString('th-TH')}</b></span>
        <span>สิ้นสภาพ/เสียชีวิต <b>{head.ended.toLocaleString('th-TH')}</b></span>
      </p>

      {/* โซน 3: รูปสมาชิกตามตัวเลือก — ดูอย่างเดียว กดเข้าไปดูรายละเอียดไม่ได้ */}
      <div className="pzone2" role="tabpanel" aria-label="พื้นที่แสดงผล">
      {tab !== 1 && (
        <section className="card pplace" aria-label={`แท็บ ${tab}`}>
          <h2 style={{ margin: 0 }}>แท็บ {tab}</h2>
          <p className="empty" style={{ margin: 0 }}>พื้นที่แสดงผล — รอใส่รายละเอียด</p>
          <p className="muted small" style={{ margin: 0 }}>ตัวเลือกที่เลือกไว้: สถานะ {gName} · เรียง {orderName}</p>
        </section>
      )}
      {tab === 1 && <>
      <section className="pfaces" aria-label={`รูปสมาชิก ${gName}`}>
        <p className="pfaces__n muted small">{gName} · แสดง {faces.length.toLocaleString('th-TH')} คน · เรียง {orderName}</p>
        {faces.length === 0 ? <p className="empty">ไม่มีสมาชิกในสถานะนี้</p> : (
          <ul className="pfaces__grid">
            {faces.map((m) => (
              <li key={m.id} className="pface" aria-label={m.name}>
                <MemberAvatar path={m.photoPath} name={shortName(m.name)} size={56} />
                <span>{shortName(m.nick?.trim() || m.name)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="pmore">
        <summary>รายละเอียดเพิ่มเติม (การ์ดสรุป)</summary>
      <section className="card" aria-labelledby="pm-2">
        <h2 id="pm-2">2 · สถานะสมาชิก <span className="muted small">(แตะเพื่อกรองส่วนที่ 3–5)</span></h2>
        {STATUS_GROUPS.filter((x) => x.key !== 'all').map((x) => <BarRow key={x.key} label={x.label} n={head[x.key as Exclude<StatusGroup, 'all'>]} total={head.total} color={g === x.key ? GOLD : NAVY} active={g === x.key} onClick={() => setG(g === x.key ? 'all' : x.key)} />)}
        <p className="small" role="status" style={{ margin: '0.5rem 0 0' }}>{g === 'all' ? 'กำลังดูทุกสถานะ' : <>กำลังดูเฉพาะ <b>{gName}</b> ({sel.length} คน) · <button type="button" className="mini" onClick={() => setG('all')}>ดูทุกสถานะ</button></>}</p>
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
      </details>
      </>}
      </div>
    </div>
  )
}
