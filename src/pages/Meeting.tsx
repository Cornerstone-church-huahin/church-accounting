import { useState } from 'react'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import Home from './Home'
import Members from './Members'
import { IconNote } from '../components/Icons'
import WorkCalendar from '../components/WorkCalendar'
import { myWorks } from '../lib/access'
import { useRole } from '../lib/members'
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
 * หัวของทุกงาน: ชื่องาน + ปุ่ม ‹ ทุกแท็บ ตำแหน่งเดียวกันทุกงาน
 * แอดมิน → กลับหน้าเลือกงานทั้งหมด · ผู้รับผิดชอบงานเดียว (เลขา อนุชน ฯลฯ) → กลับหน้าหลักของงานตัวเอง (เริ่มใหม่ตั้งแต่ต้น)
 */
function WorkHead({ name }: { n: number; name: string }) {
  useRole() // สิทธิ์/งานที่รับผิดชอบเปลี่ยนเมื่อรายชื่อซิงก์ → วาดใหม่
  const to = workHomePath(myWorks())
  return (
    <div className="page-head no-print">
      <h1>{name}</h1>
      <Link to={to} state={{ home: Date.now() }} className="mini">‹ ทุกแท็บ</Link>
    </div>
  )
}

/** รูปแบบมาตรฐานของงานที่ยังไม่มีข้อมูล: บนสุดปุ่ม 📅 ตารางงาน แล้วช่องแท็บ 1–6 — กดช่องไหนเปิดหน้าเต็มของแท็บนั้น (ว่างไว้ก่อน รอพัฒนา) */
const DEFAULT_LABELS = ['แท็บ 1', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6']
const TAB_ICONS = ['📋', '📝', '📂', '🗂️', '📌', '📎']
/** ไอคอนของแท็บที่ตั้งชื่อแล้ว */
const NAMED_ICONS: Record<string, string> = { 'สมาชิก': '👥', 'ตารางเยี่ยม': '🗓️' }
/** ชื่อแท็บของแต่ละงาน (ที่ยังไม่มีข้อมูล) — งานเลขา: การประชุม · งานอภิบาล: สมาชิก / ตารางเยี่ยม */
const WORK_LABELS: Record<number, string[]> = {
  1: ['การประชุม', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
  4: ['สมาชิก', 'ตารางเยี่ยม', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
}
const labelsOf = (n: number) => WORK_LABELS[n] ?? DEFAULT_LABELS
const iconOf = (label: string, i: number) => NAMED_ICONS[label] ?? TAB_ICONS[i % TAB_ICONS.length]
const TILE_TONES = ['own', 'fund', 'total', 'indebt', 'debt', 'land'] as const

/** หน้าหลักของงาน: ปุ่มตารางงาน + ช่องแท็บ (ลิงก์ไปหน้าเต็มของแต่ละแท็บ ไม่มีเมนูรกบนหน้าลึก) */
function WorkMenu({ n, name }: { n: number; name: string }) {
  return (
    <>
      <WorkHead n={n} name={name} />
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
function WorkPage({ n, name, k }: { n: number; name: string; k: number }) {
  const label = labelsOf(n)[k - 1]
  if (!label) return <><WorkHead n={n} name={name} /><p className="empty">ไม่พบแท็บนี้</p></>
  return (
    <>
      <div className="page-head no-print">
        <h1>{NAMED_ICONS[label] ? `${NAMED_ICONS[label]} ` : ''}{label}</h1>
        <Link to={`/meeting/${n}`} className="mini">‹ {name}</Link>
      </div>
      <p className="muted small no-print" style={{ margin: '0 0 0.5rem' }}>{name}</p>
      <section className="card" aria-label={`${name} ${label}`}><p className="empty">{label} — ยังว่าง (รอพัฒนา)</p></section>
    </>
  )
}

const TONE = ['own', 'fund', 'total', 'indebt', 'debt', 'spare'] as const

/** กดปุ่ม 🏠 หน้างาน = เปลี่ยน key เพื่อเริ่มหน้าของงานนั้นใหม่ตั้งแต่ต้น */
export default function Meeting() {
  const { n } = useParams()
  const { k } = useParams()
  const home = (useLocation().state as { home?: number } | null)?.home ?? 0
  return <MeetingRoom key={`${n ?? 'hub'}-${k ?? ''}-${home}`} />
}

function MeetingRoom() {
  const { n, k } = useParams()
  const location = useLocation()
  const tab = MEETING_TABS.find((x) => String(x.n) === n)
  if (n && !tab) return <><div className="page-head"><h1>โหมดประชุม</h1><Link to="/meeting" className="mini">‹ โหมดประชุม</Link></div><p className="empty">ไม่พบแท็บนี้</p></>
  const [params] = useSearchParams()
  // งานเหรัญญิก = หน้าแรกบัญชีทั้งหมด (เงินคริสตจักร + ขั้นตอน รับ/จ่าย/ปรับ/สรุป) · งานทะเบียน = หน้าสมาชิกทั้งหมด (เปิดที่แท็บ ลงชื่อ)
  // งานเหรัญญิก = หน้าแรกบัญชีทั้งหมด (เหมือนเดิมทุกอย่าง) · งานทะเบียน = หน้าสมาชิกทั้งหมด (เปิดที่แท็บ ลงชื่อ) — ทุกหน้ามีปุ่ม 📅 ตารางงานไว้บนสุด
  if (tab?.n === 3) return <><WorkHead n={tab.n} name={tab.name} /><CalToggle n={3} /><Home /></>
  if (tab?.n === 2) {
    if (!params.get('tab')) return <Navigate to="/meeting/2?tab=checkin" replace state={location.state} />
    return <><WorkHead n={tab.n} name={tab.name} /><CalToggle n={2} /><Members /></>
  }
  if (tab && k) return <WorkPage n={tab.n} name={tab.name} k={Number(k)} />
  if (tab) return <WorkMenu n={tab.n} name={tab.name} />
  return <Hub />
}

/** หน้าเลือกงาน: แอดมินเห็นทุกงาน · ผู้รับผิดชอบงานเดียวถูกพาเข้าหน้าหลักของงานตนเลย */
function Hub() {
  useRole()
  const works = myWorks()
  if (works.length === 1) return <Navigate to={`/meeting/${works[0]}`} replace />
  return (
    <>
      <div className="page-head"><h1>🧑‍🤝‍🧑 ห้องทำงาน</h1><Link to="/meeting/notes" className="topbar__go" aria-label="บันทึกโน้ต" title="บันทึกโน้ต"><IconNote /></Link></div>
      <p className="home-label">เลือกแท็บ <span>(ทุกงานมีปุ่ม “ตารางงาน” ไว้บนสุด · งานเหรัญญิกและงานทะเบียนพร้อมใช้ · งานอื่นมีแท็บ 1–6 รอพัฒนา)</span></p>
      <nav className="balance-tiles" aria-label="โหมดประชุม แท็บ 1 ถึง 12">
        {visibleWorks(works).map((t) => <Link key={t.n} to={`/meeting/${t.n}`} className={`btile btile--${TONE[(t.n - 1) % TONE.length]}`}><small>{t.n}</small><b>{t.name}</b></Link>)}
      </nav>
    </>
  )
}
