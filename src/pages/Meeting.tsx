import { useState } from 'react'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import Home from './Home'
import Members from './Members'
import { IconNote } from '../components/Icons'
import TileTabs from '../components/TileTabs'
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

/** รูปแบบมาตรฐานของงานที่ยังไม่มีข้อมูล: บนสุดปุ่ม 📅 ตารางงาน แล้วแท็บ 1–6 (ยังว่าง — พัฒนาทีละแท็บ) */
const DEFAULT_LABELS = ['แท็บ 1', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6']
const TAB_ICONS = ['📋', '📝', '📂', '🗂️', '📌', '📎']
/** ไอคอนของแท็บที่ตั้งชื่อแล้ว */
const NAMED_ICONS: Record<string, string> = { 'สมาชิก': '👥', 'ตารางเยี่ยม': '🗓️' }
const NUMBERED = ['1', '2', '3', '4', '5', '6']
/** งานเลขา: แท็บแรกตั้งชื่อ “การประชุม” ไว้แล้ว */
const SECRETARY_LABELS = ['การประชุม', 'แท็บ 2', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6']
/** งานอภิบาล: แท็บ 1 = สมาชิก · แท็บ 2 = ตารางเยี่ยม — แต่ละแท็บมีแท็บย่อย 1–6 ว่างไว้ก่อน */
const PASTORAL: { labels: string[]; subs: Record<number, string[]> } = {
  labels: ['สมาชิก', 'ตารางเยี่ยม', 'แท็บ 3', 'แท็บ 4', 'แท็บ 5', 'แท็บ 6'],
  subs: { 0: NUMBERED, 1: NUMBERED },
}
const iconOf = (label: string, i: number) => NAMED_ICONS[label] ?? TAB_ICONS[i % TAB_ICONS.length]

function WorkTabs({ n, name, labels = DEFAULT_LABELS, subs = {} }: { n: number; name: string; labels?: string[]; subs?: Record<number, string[]> }) {
  const [t, setT] = useState(0)
  const [sub, setSub] = useState(0)
  const cur = Math.min(t, labels.length - 1)
  const subLabels = subs[cur]
  const subCur = subLabels ? Math.min(sub, subLabels.length - 1) : 0
  return (
    <>
      <WorkHead n={n} name={name} />
      <CalToggle n={n} />
      <TileTabs label={`หมวด${name}`} value={String(cur)} onChange={(k) => { setT(Number(k)); setSub(0) }} items={labels.map((l, i) => ({ key: String(i), label: l, icon: iconOf(l, i) }))} />
      {subLabels && (
        <>
          <p className="home-label" style={{ margin: '0.2rem 0' }}>{labels[cur]} <span>› เลือกแท็บ</span></p>
          <TileTabs label={`หมวด${name} ${labels[cur]}`} value={String(subCur)} onChange={(k) => setSub(Number(k))} items={subLabels.map((l, i) => ({ key: String(i), label: l, icon: TAB_ICONS[i % TAB_ICONS.length] }))} />
        </>
      )}
      <section className="card" aria-label={`${name} ${labels[cur]}${subLabels ? ` ${subLabels[subCur]}` : ''}`}>
        <p className="empty">{labels[cur]}{subLabels ? ` › ${subLabels[subCur]}` : ''} — ยังว่าง (รอพัฒนา)</p>
      </section>
    </>
  )
}

const TONE = ['own', 'fund', 'total', 'indebt', 'debt', 'spare'] as const

/** กดปุ่ม 🏠 หน้างาน = เปลี่ยน key เพื่อเริ่มหน้าของงานนั้นใหม่ตั้งแต่ต้น */
export default function Meeting() {
  const { n } = useParams()
  const home = (useLocation().state as { home?: number } | null)?.home ?? 0
  return <MeetingRoom key={`${n ?? 'hub'}-${home}`} />
}

function MeetingRoom() {
  const { n } = useParams()
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
  if (tab?.n === 1) return <WorkTabs key={1} n={1} name={tab.name} labels={SECRETARY_LABELS} />
  if (tab?.n === 4) return <WorkTabs key={4} n={4} name={tab.name} labels={PASTORAL.labels} subs={PASTORAL.subs} />
  if (tab) return <WorkTabs key={tab.n} n={tab.n} name={tab.name} />
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
