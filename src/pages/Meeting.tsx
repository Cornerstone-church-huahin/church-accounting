import { useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import Home, { type HomeTab } from './Home'
import Members from './Members'
import { IconNote } from '../components/Icons'
import WorkTeam from '../components/WorkTeam'
import MeetingCenter from './MeetingCenter'
import PastoralMembers from '../components/PastoralMembers'
import PastoralVisits from '../components/PastoralVisits'
import AnnualPlan from '../components/AnnualPlan'
import FoodRoster from '../components/FoodRoster'
import WorkCalendar from '../components/WorkCalendar'
import { can, myWorks } from '../lib/access'
import { useRole } from '../lib/members'
import { useYear } from '../lib/year'
import AccountLinks from '../components/AccountLinks'
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
  useRole() // สิทธิ์/งานที่รับผิดชอบเปลี่ยนเมื่อรายชื่อซิงก์ → วาดใหม่
  const to = workHomePath(myWorks())
  return (
    <>
      <div className="page-head no-print">
        <h1>{name}</h1>
        <WorkBell n={n} />
        {back ? <button type="button" className="mini" onClick={back} aria-label="ไปหน้าแรกของงาน">‹ {name}</button> : <Link to={to} state={{ home: Date.now() }} className="mini">‹ หน้าแรก</Link>}
      </div>
      <WorkTeam n={n} name={name} />
    </>
  )
}

/** รูปแบบมาตรฐานของงานที่ยังไม่มีข้อมูล: บนสุดปุ่ม 📅 ตารางงาน แล้วช่องแท็บ 1–6 — กดช่องไหนเปิดหน้าเต็มของแท็บนั้น (ว่างไว้ก่อน รอพัฒนา) */
const DEFAULT_LABELS = ['แท็บ 1', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6']
const TAB_ICONS = ['📋', '📝', '📂', '🗂️', '📌', '📎']
/** ไอคอนของแท็บที่ตั้งชื่อแล้ว */
const NAMED_ICONS: Record<string, string> = { 'สมาชิก': '👥', 'ตารางเยี่ยม': '🗓️', 'ตารางถวายอาหาร': '🍽️', 'แผนงานประจำปี': '📅' }
/** ชื่อแท็บของแต่ละงาน (ที่ยังไม่มีข้อมูล) — งานเลขา: การประชุม · งานอภิบาล: สมาชิก / ตารางเยี่ยม */
const WORK_LABELS: Record<number, string[]> = {
  1: ['การประชุม', 'แผนงานประจำปี', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
  4: ['สมาชิก', 'ตารางเยี่ยม', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
  14: ['ตารางถวายอาหาร', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
}
const labelsOf = (n: number) => WORK_LABELS[n] ?? DEFAULT_LABELS
const iconOf = (label: string, i: number) => NAMED_ICONS[label] ?? TAB_ICONS[i % TAB_ICONS.length]
const TILE_TONES = ['own', 'fund', 'total', 'indebt', 'debt', 'land'] as const

/** หน้าหลักของงาน: ปุ่มตารางงาน + ช่องแท็บ (ลิงก์ไปหน้าเต็มของแต่ละแท็บ ไม่มีเมนูรกบนหน้าลึก) */
function WorkMenu({ n, name }: { n: number; name: string }) {
  return (
    <>
      <WorkHead n={n} name={name} />
      <AccountLinks n={n} />
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

/** หน้าเต็มของแท็บหนึ่ง (ว่างไว้ก่อน รอพัฒนา) — ปุ่มบนขวากลับไปหน้าหลักของงาน */
function WorkPage({ n, name, k, s }: { n: number; name: string; k: number; s?: number }) {
  const label = labelsOf(n)[k - 1]
  // งานเลขา › การประชุม = ศูนย์จัดการประชุม (เมนู 10 ขั้น · มีหัวและปุ่มกลับของตัวเอง)
  if (n === 1 && k === 1) return <MeetingCenter step={s} />
  if (!label) return <><WorkHead n={n} name={name} /><p className="empty">ไม่พบแท็บนี้</p></>
  return (
    <>
      <div className={`page-head no-print${n === 4 && k === 1 ? ' page-head--tight' : ''}`}>
        <h1>{NAMED_ICONS[label] ? `${NAMED_ICONS[label]} ` : ''}{label}</h1>
        <Link to={`/meeting/${n}`} className="mini">‹ {name}</Link>
      </div>
      {!(n === 4 && k === 1) && <p className="muted small no-print" style={{ margin: '0 0 0.5rem' }}>{name}</p>}
      {n === 4 && k === 1 ? <PastoralMembers /> : n === 4 && k === 2 ? <PastoralVisits /> : n === 14 && k === 1 ? <FoodRoster /> : n === 1 && k === 2 ? <AnnualPlan /> : <section className="card" aria-label={`${name} ${label}`}><p className="empty">{label} — ยังว่าง (รอพัฒนา)</p></section>}
    </>
  )
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
  if (tab && (k === 'in' || k === 'out' || k === 'all')) return <AccountView n={tab.n} name={tab.name} kind={k} />
  if (tab?.n === 3) return <><WorkHead n={tab.n} name={tab.name} back={step ? () => setStep(null) : undefined} /><CalToggle n={3} /><Home tab={step} onTab={setStep} /></>
  if (tab?.n === 2) return <><WorkHead n={tab.n} name={tab.name} /><AccountLinks n={2} /><CalToggle n={2} /><Members /></>
  if (tab && k) return <WorkPage n={tab.n} name={tab.name} k={Number(k)} s={s === undefined ? undefined : Number(s)} />
  if (tab) return <WorkMenu n={tab.n} name={tab.name} />
  return <Hub />
}

/** หน้าเลือกงาน: แอดมินเห็นทุกงาน · ผู้รับผิดชอบงานเดียวถูกพาเข้าหน้าหลักของงานตนเลย */
function Hub({ home }: { home?: boolean }) {
  const role = useRole()
  const works = myWorks()
  if (works.length === 1 && !home) return <Navigate to={`/meeting/${works[0]}`} replace />
  return (
    <div className={home ? 'hubhome' : undefined}>
      <div className="page-head"><h1>🧑‍🤝‍🧑 ห้องทำงาน</h1>{can(role, 'settings') && <AnnounceAdmin />}<Link to="/meeting/notes" className="topbar__go" aria-label="บันทึกโน้ต" title="บันทึกโน้ต"><IconNote /></Link></div>
      {home && <BalanceStrip compact />}
      <p className="home-label">เลือกแท็บ <span>(ทุกงานมีปุ่ม “ตารางงาน” ไว้บนสุด · งานเหรัญญิกและงานทะเบียนพร้อมใช้ · งานอื่นมีแท็บ 1–6 รอพัฒนา)</span></p>
      <nav className={`balance-tiles${home ? ' hubgrid' : ''}`} aria-label="โหมดประชุม แท็บ 1 ถึง 18">
        {visibleWorks(works).map((t) => <Link key={t.n} to={`/meeting/${t.n}`} className={`btile btile--${TONE[(t.n - 1) % TONE.length]}`}><small>{t.n}</small><b>{t.name}</b></Link>)}
      </nav>
    </div>
  )
}

/** หน้าแรก = ห้องทำงาน (แท็บ 1–18) มีแถบเงินคริสตจักร 6 ช่องอยู่บนสุด · หน้าบัญชีเดิม (รับ จ่าย ปรับ สรุป เตรียมเบิก เตรียมนำฝาก) อยู่ที่ แท็บ 3 งานเหรัญญิก */
export function HomeHub() { return <Hub home /> }
