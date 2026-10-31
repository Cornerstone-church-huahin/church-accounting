import { useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import Home, { type HomeTab } from './Home'
import Members from './Members'
import { IconNote } from '../components/Icons'
import WorkTeam from '../components/WorkTeam'
import WorkTerm from '../components/WorkTerm'
import MeetingCenter from './MeetingCenter'
import PastoralMembers from '../components/PastoralMembers'
import PastoralVisits from '../components/PastoralVisits'
import VisitReports from '../components/VisitReports'
import VisitRecord from '../components/VisitRecord'
import { VisitGroupsAuto } from '../components/VisitGroups'
import { useVisitPlans } from '../lib/data'
import { todayISO } from '../lib/money'
import AnnualPlan from '../components/AnnualPlan'
import InviteLetterPage, { InviteLetterList } from '../components/InviteLetter'
import AdminNotes from '../components/AdminNotes'
import { FlowPage, WorkflowMenu } from '../components/WorkFlow'
import DocLibrary from '../components/DocLibrary'
import FoodRoster from '../components/FoodRoster'
import WorkCalendar from '../components/WorkCalendar'
import { can, isRegistryHelper, myWorks } from '../lib/access'
import { useRole } from '../lib/members'
import { useYear } from '../lib/year'
import AccountTabs from '../components/AccountTabs'
import ChurchHealth, { HealthButton } from '../components/ChurchHealth'
import WorkBell from '../components/WorkBell'
import AnnounceAdmin from '../components/AnnounceAdmin'
import BalanceStrip from '../components/BalanceStrip'
import Receive from './Receive'
import Pay from './Pay'
import OverviewView from '../components/OverviewView'
import { MEETING_TABS, visibleWorks, workHomePath } from '../lib/workTabs'

/** ปุ่มเปิด/ปิดตารางงานไว้บนสุดของแต่ละหน้า — เปิดดูได้โดยไม่ไปแตะข้อมูล/หน้าเดิมของงานนั้น */
function CalToggle({ n, defaultOpen = false }: { n: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="caltoggle no-print">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>📅 ตารางงาน {open ? '▴' : '▾'}</button>
      {open && <WorkCalendar tab={n} />}
    </div>
  )
}

/**
 * หัวของทุกงาน: ชื่องาน + ปุ่ม ‹ หน้าแรก ตำแหน่งเดียวกันทุกงาน (กลับหน้าแรก = ห้องทำงาน)
 * แอดมิน → กลับหน้าเลือกงานทั้งหมด · ผู้รับผิดชอบงานเดียว (เลขา อนุชน ฯลฯ) → กลับหน้าหลักของงานตัวเอง (เริ่มใหม่ตั้งแต่ต้น)
 */
function WorkHead({ n, name, back }: { n: number; name: string; /** เปิดขั้นตอนอยู่ในงาน: ปุ่มกลับเป็น หน้าแรกของงาน (ปิดขั้นตอน) แทนหน้าแรกของแอป */ back?: () => void }) {
  const role = useRole() // สิทธิ์/งานที่รับผิดชอบเปลี่ยนเมื่อรายชื่อซิงก์ → วาดใหม่
  const to = workHomePath(myWorks())
  return (
    <>
      <div className="page-head no-print">
        <h1>{name}</h1>
        {can(role, 'settings') && <Link to={`/meeting/${n}/admin`} className="topbar__go" aria-label="สมุดส่วนตัวแอดมิน" title="สมุดส่วนตัวแอดมิน (เห็นเฉพาะแอดมิน)">📔</Link>}
        <WorkBell n={n} />
        {back ? <button type="button" className="mini" onClick={back} aria-label="ไปหน้าแรกของงาน">‹ {name}</button> : myWorks().length === 1 ? null : <Link to={to} state={{ home: Date.now() }} className="mini">‹ หน้าแรก</Link>}
      </div>
      <WorkTeam n={n} name={name} />
      <WorkTerm n={n} name={name} />
    </>
  )
}

/** รูปแบบมาตรฐานของงานที่ยังไม่มีข้อมูล: บนสุดปุ่ม 📅 ตารางงาน แล้วช่องแท็บ 1–6 — กดช่องไหนเปิดหน้าเต็มของแท็บนั้น (ว่างไว้ก่อน รอพัฒนา) */
const DEFAULT_LABELS = ['แท็บ 1', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6']
const TAB_ICONS = ['📋', '📝', '📂', '🗂️', '📌', '📎']
/** ไอคอนของแท็บที่ตั้งชื่อแล้ว */
const NAMED_ICONS: Record<string, string> = { 'สมาชิก': '👥', 'รวมสมาชิก': '👥', 'วางแผนเยี่ยม': '🗓️', 'บันทึกเยี่ยม': '📝', 'รายงานเยี่ยม': '📊', 'ตารางถวายอาหาร': '🍽️', 'แผนประจำปี': '📅', 'คลังเอกสาร': '🗄️', 'ลำดับงาน': '📋' }
/** ชื่อแท็บของแต่ละงาน (ที่ยังไม่มีข้อมูล) — งานเลขา: การประชุม · งานอภิบาล: สมาชิก / ตารางเยี่ยม */
const WORK_LABELS: Record<number, string[]> = {
  1: ['สร้างเอกสาร', 'คลังเอกสาร', 'แผนประจำปี', 'รวมสมาชิก', 'แท็บ 5', 'แท็บ 6'],
  4: ['รวมสมาชิก', 'วางแผนเยี่ยม', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
  9: ['รวมสมาชิก', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
  14: ['ตารางถวายอาหาร', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
}
/** ความคืบหน้าการพัฒนา: จำนวนแท็บ (จาก 6) ที่ตั้งชื่อ/มีหน้าใช้งานแล้ว — งานที่มีหน้าพิเศษระบุเองตรงนี้ */
const DEV_FIXED: Record<number, number> = { 2: 1, 3: 6 }
export const devDone = (n: number) => DEV_FIXED[n] ?? (WORK_LABELS[n] ?? DEFAULT_LABELS).filter((l) => !/^แท็บ \d+$/.test(l)).length
const labelsOf = (n: number) => WORK_LABELS[n] ?? DEFAULT_LABELS
const iconOf = (label: string, i: number) => NAMED_ICONS[label] ?? TAB_ICONS[i % TAB_ICONS.length]
const TILE_TONES = ['own', 'fund', 'total', 'indebt', 'debt', 'land'] as const

/** หน้าหลักของงาน: ปุ่มตารางงาน + ช่องแท็บ (ลิงก์ไปหน้าเต็มของแต่ละแท็บ ไม่มีเมนูรกบนหน้าลึก) */
function WorkMenu({ n, name }: { n: number; name: string }) {
  return (
    <>
      <WorkHead n={n} name={name} />
      <HealthButton n={n} />
      <CalToggle n={n} />
      <nav className="balance-tiles tiletabs no-print" aria-label={`หมวด${name}`}>
        {labelsOf(n).map((l, i) => (
          <Link key={l} to={`/meeting/${n}/${i + 1}`} className={`btile btile--${TILE_TONES[i % TILE_TONES.length]}`}>
            <small aria-hidden="true">{iconOf(l, i)}</small><b>{l}</b>
          </Link>
        ))}
      </nav>
    </>
  )
}

/** แถบไอคอนเล็กเลขแท็บ (วางไว้แทนบรรทัดชื่องานใต้หัวข้อ ไม่กินพื้นที่เพิ่ม): กดสลับไปแท็บอื่นของงานเดียวกันได้ทันที */
function TabIcons({ n, active, upTo, text = false }: { n: number; active: number; upTo: number; text?: boolean }) {
  const labels = labelsOf(n)
  return (
    <nav className={`tabicons no-print${text ? ' tabicons--txt' : ''}`} aria-label="ทางลัดแท็บของงานนี้">
      {labels.slice(0, upTo).map((l, i) => (
        <Link key={l} to={`/meeting/${n}/${i + 1}`} replace className={`tabicons__i${i + 1 === active ? ' on' : ''}`} aria-label={`${i + 1} ${l}`} aria-current={i + 1 === active ? 'page' : undefined} title={l}>
          <i aria-hidden="true">{i + 1}</i><span aria-hidden="true">{iconOf(l, i)}</span>{text && <em aria-hidden="true">{l}</em>}
        </Link>
      ))}
    </nav>
  )
}

/** งานอภิบาล: ทางลัด 3 หน้าที่เกี่ยวกับการเยี่ยม (วางแผน → บันทึก → รายงาน) แสดงเป็นแถบยาวมีข้อความ ใช้สลับหน้ากันเอง ไม่ต้องกลับเมนูหน้าแรก */
const PASTORAL_PAGES = [
  { id: 'plan', to: '/meeting/4/2', label: 'วางแผน', title: 'วางแผนเยี่ยม', icon: '🗓️' },
  { id: 'group', to: '/meeting/4/group', label: 'จัดกลุ่ม', title: 'จัดกลุ่มเยี่ยม', icon: '🧺' },
  { id: 'record', to: '/meeting/4/record', label: 'บันทึก', title: 'บันทึกเยี่ยม', icon: '📝' },
  { id: 'report', to: '/meeting/4/report', label: 'รายงาน', title: 'รายงานเยี่ยม', icon: '📊' },
] as const
type PastoralStep = (typeof PASTORAL_PAGES)[number]['id']
function PastoralBar({ active }: { active: PastoralStep }) {
  const n = useVisitPlans().of(todayISO()).items.length // จำนวนคนในตะกร้า (ตัวเลขเดียวกัน) ขึ้นที่ขั้นจัดกลุ่มและขั้นบันทึกทุกหน้า
  return (
    <nav className="tabicons tabicons--txt tabicons--arrow tabicons--four no-print" aria-label="ทำตามลำดับ 1 วางแผน 2 จัดกลุ่ม 3 บันทึก 4 รายงาน">
      {PASTORAL_PAGES.map((x, i) => (
        <Link key={x.id} to={x.to} replace className={`tabicons__i${x.id === active ? ' on' : ''}`} aria-label={x.id === 'group' || x.id === 'record' ? `${x.label} ${n} คน` : x.label} aria-current={x.id === active ? 'page' : undefined}>
          <i aria-hidden="true">{i + 1}</i><span aria-hidden="true">{x.icon}</span><em aria-hidden="true">{x.label}</em>
          {(x.id === 'group' || x.id === 'record') && n > 0 && <b className="tabicons__n" aria-hidden="true"><u>👤</u>{n}</b>}
        </Link>
      ))}
    </nav>
  )
}
/** หน้าจัดกลุ่ม / บันทึก / รายงาน (ไม่อยู่ในเมนูหน้าแรกของงาน เข้าจากแถบขั้นตอนในหน้าวางแผนเยี่ยม) */
function PastoralSub({ name, which }: { name: string; which: 'group' | 'record' | 'report' }) {
  const p = PASTORAL_PAGES.find((x) => x.id === which)!
  return (
    <>
      <div className="page-head no-print"><h1>{p.icon} {p.title}</h1><Link to="/meeting/4" className="mini">‹ {name}</Link></div>
      <PastoralBar active={which} />
      {which === 'group' ? <VisitGroupsAuto /> : which === 'record' ? <VisitRecord /> : <VisitReports />}
    </>
  )
}

/** หน้าเต็มของแท็บหนึ่ง (ว่างไว้ก่อน รอพัฒนา) — ปุ่มบนขวากลับไปหน้าหลักของงาน */
function WorkPage({ n, name, k, s, raw }: { n: number; name: string; k: number; s?: number; raw?: string }) {
  const label = labelsOf(n)[k - 1]
  // งานเลขา › การประชุม = ศูนย์จัดการประชุม (เมนู 10 ขั้น · มีหัวและปุ่มกลับของตัวเอง)
  if (n === 1 && k === 1) return raw === 'invite' ? <InviteLetterList /> : raw === 'notice' ? <InviteLetterList kind="notice" /> : raw?.startsWith('cat-') ? <InviteLetterList key={raw} kind="doc" cat={raw.slice(4)} /> : raw?.startsWith('dl-') ? <InviteLetterPage key={raw} id={raw.slice(3)} kind="doc" /> : raw?.startsWith('notice-') ? <InviteLetterPage key={raw} id={raw.slice(7)} kind="notice" /> : raw?.startsWith('invite-') ? <InviteLetterPage key={raw} id={raw.slice(7)} /> : raw?.startsWith('f-') ? <FlowPage id={raw.slice(2)} /> : raw === undefined ? <WorkflowMenu /> : <MeetingCenter step={raw === 'meeting' ? undefined : s} />
  if (!label) return <><WorkHead n={n} name={name} /><p className="empty">ไม่พบแท็บนี้</p></>
  const isMembers = ((n === 4 || n === 9) && k === 1) || (n === 1 && k === 4) // หน้า “รวมสมาชิก” ใช้ร่วมกัน: งานเลขา (แท็บ 4) · งานอภิบาล · งานอนุชน // หน้า “สมาชิก” (งานอภิบาลและงานอนุชนใช้หน้าเดียวกัน)
  return (
    <>
      <div className={`page-head no-print${isMembers ? ' page-head--tight' : ''}`}>
        <h1>{NAMED_ICONS[label] ? `${NAMED_ICONS[label]} ` : ''}{label}</h1>
        <Link to={`/meeting/${n}`} className="mini">‹ {name}</Link>
      </div>
      {n === 4 ? (k === 2 ? <PastoralBar active="plan" /> : null) : <TabIcons n={n} active={k} upTo={6} />}
      {isMembers ? <PastoralMembers work={n} /> : n === 4 && k === 2 ? <PastoralVisits plan /> : n === 14 && k === 1 ? <FoodRoster /> : n === 1 && k === 3 ? <AnnualPlan /> : n === 1 && k === 2 ? <DocLibrary /> : <section className="card" aria-label={`${name} ${label}`}><p className="empty">{label} — ยังว่าง (รอพัฒนา)</p></section>}
    </>
  )
}

/** งานทะเบียน: แถบการเงิน/ตารางงานอยู่เฉพาะหน้าเมนูสมาชิก · เข้าไปในตรวจสอบ/ทะเบียนแล้วซ่อนเพื่อให้มีที่แสดงรายชื่อ */
function RegistryBody() {
  const [inMenu, setInMenu] = useState(true)
  return <>{inMenu && <><HealthButton n={2} /><CalToggle n={2} /></>}<Members registry onMenu={setInMenu} /></>
}

const TONE = ['own', 'fund', 'total', 'indebt', 'debt', 'spare'] as const

/** กดปุ่ม 🏠 หน้างาน = เปลี่ยน key เพื่อเริ่มหน้าของงานนั้นใหม่ตั้งแต่ต้น */
export default function Meeting() {
  const { n } = useParams()
  const { k, s } = useParams()
  const home = (useLocation().state as { home?: number } | null)?.home ?? 0
  return <MeetingRoom key={`${n ?? 'hub'}-${k ?? ''}-${s ?? ''}-${home}`} />
}

/** บัญชีรับ / บัญชีจ่ายของทุกงาน: ดูใบรายสัปดาห์ได้ ย้อนสัปดาห์ได้ แต่แก้ไขไม่ได้และไม่มีทางไปโหมดอื่น */
function AccountView({ n, name, kind }: { n: number; name: string; kind: 'in' | 'out' | 'all' }) {
  const { year } = useYear()
  if (kind === 'all') {
    return (
      <>
        <AccountTabs n={n} active="all" />
        <div className="page-head no-print">
          <h1>📊 ภาพรวมรายรับ-รายจ่าย</h1>
          <Link to={`/meeting/${n}`} className="mini">‹ {name}</Link>
        </div>
        <OverviewView key={year} year={year} />
      </>
    )
  }
  return (
    <>
      <AccountTabs n={n} active={kind} />
      <div className="page-head no-print">
        <h1>{kind === 'in' ? '💚 บัญชีรับ' : '🔴 บัญชีจ่าย'}</h1>
        <Link to={`/meeting/${n}`} className="mini">‹ {name}</Link>
      </div>
      <p className="muted small no-print" style={{ margin: '0 0 0.2rem' }}>ดูอย่างเดียว · ย้อนดูแต่ละสัปดาห์ได้ด้วยลูกศร</p>
      {kind === 'in' ? <Receive key={year} year={year} view /> : <Pay key={year} year={year} view />}
    </>
  )
}

function MeetingRoom() {
  const { n, k, s } = useParams()
  const [step, setStep] = useState<HomeTab>(null) // งานเหรัญญิก: ขั้นตอนที่เปิดอยู่ (รับ จ่าย ปรับ …)
  const tab = MEETING_TABS.find((x) => String(x.n) === n)
  if (n && !tab) return <><div className="page-head"><h1>โหมดประชุม</h1><Link to="/meeting" className="mini">‹ โหมดประชุม</Link></div><p className="empty">ไม่พบแท็บนี้</p></>
  // งานเหรัญญิก = หน้าแรกบัญชีทั้งหมด (เงินคริสตจักร + ขั้นตอน รับ/จ่าย/ปรับ/สรุป) · งานทะเบียน = หน้าสมาชิกทั้งหมด (เปิดที่แท็บ ลงชื่อ)
  // งานเหรัญญิก = หน้าแรกบัญชีทั้งหมด (เหมือนเดิมทุกอย่าง) · งานทะเบียน = หน้าสมาชิกทั้งหมด (เปิดที่แท็บ ลงชื่อ) — ทุกหน้ามีปุ่ม 📅 ตารางงานไว้บนสุด
  if (tab && k === 'admin') return <AdminNotes n={tab.n} name={tab.name} />
  if (tab && k === 'health') return <ChurchHealth n={tab.n} name={tab.name} />
  if (tab && (k === 'in' || k === 'out' || k === 'all')) return <AccountView n={tab.n} name={tab.name} kind={k} />
  if (tab?.n === 3) return <><WorkHead n={tab.n} name={tab.name} back={step ? () => setStep(null) : undefined} /><CalToggle n={3} /><Home tab={step} onTab={setStep} /></>
  if (tab?.n === 2) return isRegistryHelper() ? <Members registry /> : <><WorkHead n={tab.n} name={tab.name} /><RegistryBody /></>
  if (tab?.n === 4 && (k === 'group' || k === 'record' || k === 'report')) return <PastoralSub name={tab.name} which={k} />
  if (tab && k) return <WorkPage n={tab.n} name={tab.name} k={Number(k)} s={s === undefined ? undefined : Number(s)} raw={s} />
  if (tab) return <WorkMenu n={tab.n} name={tab.name} />
  return <Hub />
}

/** หน้าเลือกงาน: แอดมินเห็นทุกงาน · ผู้รับผิดชอบงานเดียวถูกพาเข้าหน้าหลักของงานตนเลย */
function Hub({ home }: { home?: boolean }) {
  const role = useRole()
  const works = myWorks()
  // ผู้ดูแลงานเดียว: เข้าหน้าแรกแล้วเข้าห้องงานของตัวเองทันที (ไม่ผ่านหน้า "ห้องทำงานคริสตจักร" ที่เป็นของแอดมิน/หลายงาน)
  const shown = visibleWorks(works, { all: role === 'admin' || can(role, 'detail'), admin: role === 'admin' })
  if (works.length === 1 && shown.length === 1) return <Navigate to={`/meeting/${works[0]}`} replace />
  return (
    <div className={home ? `hubhome${can(role, 'settings') ? ' hubhome--cal' : ''}` : undefined}>
      <div className="page-head"><h1>🧑‍🤝‍🧑 ห้องทำงานคริสตจักร</h1>{can(role, 'settings') && <AnnounceAdmin />}<Link to="/meeting/notes" className="topbar__go" aria-label="บันทึกโน้ต" title="บันทึกโน้ต"><IconNote /></Link></div>
      {home && can(role, 'settings') && <CalToggle n={1} />}
      {home && <BalanceStrip compact />}
      <p className="home-label">เลือกแท็บ <span>(ทุกงานมีปุ่ม “ตารางงาน” ไว้บนสุด · งานเหรัญญิกและงานทะเบียนพร้อมใช้ · งานอื่นมีแท็บ 1–6 รอพัฒนา)</span></p>
      <nav className={`balance-tiles${home ? ' hubgrid' : ''}`} aria-label="โหมดประชุม แท็บ 1 ถึง 18">
        {shown.map((t) => {
          const d = devDone(t.n)
          return (
            <Link key={t.n} to={`/meeting/${t.n}`} className={`btile btile--${TONE[(t.n - 1) % TONE.length]}`} aria-label={`${t.n} ${t.name} · พัฒนาแล้ว ${d} จาก 6 แท็บ`}>
              <span className="btile__top"><small>{t.n}</small><b>{t.name}</b></span>
              <span className="btile__prog" aria-hidden="true"><span className="btile__meter"><i style={{ width: `${(d / 6) * 100}%` }} /></span><span className="btile__pct">{Math.round((d / 6) * 100)}%</span></span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

/** หน้าแรก = ห้องทำงาน (แท็บ 1–18) มีแถบเงินคริสตจักร 6 ช่องอยู่บนสุด · หน้าบัญชีเดิม (รับ จ่าย ปรับ สรุป เตรียมเบิก เตรียมนำฝาก) อยู่ที่ แท็บ 3 งานเหรัญญิก */
export function HomeHub() { return <Hub home /> }
