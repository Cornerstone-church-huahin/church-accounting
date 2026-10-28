import { AppCredit } from './Credit'
import { MEETING_TABS } from '../lib/workTabs'
import { Navigate, NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { can, isSolo, myFunds, READONLY_EVENT, whoAmI } from '../lib/access'
import { useMembership, useRole } from '../lib/members'
import { useIncomeTypes, useSettings, useVouchers } from '../lib/data'
import { tasksFor } from '../lib/ledger'
import { be, todayISO, yearOf } from '../lib/money'
import { refreshSharedGemini } from '../lib/gemini'
import { installFieldErrors } from '../lib/fieldErrors'
import { SYNC_EVENT } from '../lib/sync'
import { initialYear, saveYear, YearContext } from '../lib/year'
import OpenInChrome from './OpenInChrome'
import SyncButton from './SyncButton'
import { IconBack, IconCalendar, IconChart, IconCoins, IconHome, IconMore, IconPeople, IconReceipt, IconWallet, Logo } from './Icons'

const FULL = [
  { to: '/', label: 'หน้าแรก', Icon: IconHome, end: true },
  { to: '/income', label: 'รายรับ', Icon: IconCoins, end: false },
  { to: '/rounds', label: 'อาทิตย์', Icon: IconCalendar, end: false },
  { to: '/vouchers', label: 'เบิกจ่าย', Icon: IconReceipt, end: false },
  { to: '/members', label: 'สมาชิก', Icon: IconPeople, end: false },
  { to: '/more', label: 'เพิ่มเติม', Icon: IconMore, end: false },
]
/** ผู้บันทึกการนมัสการ: เห็นเมนูเดียว */
const WORSHIP = [{ to: '/members', label: 'สมาชิก', Icon: IconPeople, end: false }]
const VIEW = [
  { to: '/', label: 'หน้าแรก', Icon: IconHome, end: true },
  { to: '/budget', label: 'งบประมาณ', Icon: IconWallet, end: false },
  { to: '/reports', label: 'รายงาน', Icon: IconChart, end: false },
  { to: '/more', label: 'เพิ่มเติม', Icon: IconMore, end: false },
]
const ROOTS = ['/', '/income', '/rounds', '/vouchers', '/members', '/more', '/budget', '/reports']

export default function AppShell() {
  const { pathname } = useLocation()
  // งานที่กำลังใช้อยู่: จำไว้เมื่อเปิดหน้างาน (/meeting/N) แล้วคงไว้ตอนเข้าหน้ารายละเอียดนอกห้องทำงาน (เช่น กองทุน/ยอดเงิน) เพื่อมีปุ่มกลับหน้างาน · ล้างเมื่อกลับหน้าห้องทำงานหรือหน้าหลักของแอป
  const workCtx = useRef<number | null>(null)
  const wm = pathname.match(/^\/meeting\/(\d+)$/)
  if (wm) workCtx.current = Number(wm[1])
  else if (pathname.startsWith('/meeting') || ROOTS.includes(pathname)) workCtx.current = null
  const workBack = workCtx.current !== null && !pathname.startsWith('/meeting') ? MEETING_TABS.find((t) => t.n === workCtx.current) : undefined
  const navigate = useNavigate()
  const role = useRole()
  const ms = useMembership()
  const [year, setYearState] = useState(initialYear)
  const setYear = (y: number) => { setYearState(y); saveYear(y) }
  const [roToast, setRoToast] = useState(false)
  const full = can(role, 'detail')
  // ผู้ดูแลกองทุน: เห็นเมนูเดียวคือกองทุนที่ได้รับมอบหมาย (เข้าหน้ากองทุนนั้นทันที ไม่เห็นกองทุนอื่น/หน้าอื่น)
  const fk = role === 'fundkeeper' ? myFunds() ?? [] : null
  const fundNames = useIncomeTypes().list
  // ผู้ที่มีไอคอนลงชื่อที่หัวแอปอยู่แล้ว (แอดมิน/ผู้บันทึกบัญชี) ไม่ต้องมีเมนูสมาชิกซ้ำที่แถบล่าง
  const FUNDTABS = (fk ?? []).map((f) => ({ to: `/funds/${f.id}`, label: fundNames.find((t) => t.id === f.id)?.name.replace(/^กองทุน-?/, '') || 'กองทุน', Icon: IconWallet, end: false }))
  const TABS = fk ? FUNDTABS : role === 'worship' ? WORSHIP : full ? (can(role, 'registry') ? FULL.filter((t) => t.to !== '/members') : FULL) : VIEW

  useEffect(() => { document.documentElement.dataset.role = role }, [role])
  useEffect(() => {
    let t = 0
    const on = () => { setRoToast(true); window.clearTimeout(t); t = window.setTimeout(() => setRoToast(false), 3500) }
    window.addEventListener(READONLY_EVENT, on)
    return () => { window.removeEventListener(READONLY_EVENT, on); window.clearTimeout(t) }
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => { installFieldErrors() }, [])
  // ผู้ใช้ที่อนุมัติแล้ว (ไม่ใช่ผู้ดูอย่างเดียว/รออนุมัติ) ดึงรหัส Gemini ร่วมที่แอดมินแชร์ไว้
  const canRead = can(role, 'income') || can(role, 'voucherPay')
  useEffect(() => {
    if (!canRead) return
    const go = () => { void refreshSharedGemini() }
    go()
    window.addEventListener(SYNC_EVENT, go)
    window.addEventListener('online', go)
    return () => { window.removeEventListener(SYNC_EVENT, go); window.removeEventListener('online', go) }
  }, [canRead])

  const years = useMemo(() => { const y = yearOf(todayISO()); return [y + 1, y, y - 1, y - 2, y - 3, y - 4] }, [])
  if (!years.includes(year)) years.push(year)

  if (role === 'worship' && pathname !== '/members' && pathname !== '/join') return <Navigate to="/members" replace />
  if (fk) {
    const fid = pathname.match(/^\/funds\/([^/]+)$/)?.[1]
    const allowed = (fid && fk.some((f) => f.id === fid)) || pathname === '/join'
    if (!allowed && fk.length > 0) return <Navigate to={`/funds/${fk[0].id}`} replace />
    if (!allowed) return <p className="empty" role="status" style={{ margin: '2rem 1rem' }}>ยังไม่ได้รับมอบหมายกองทุน — แจ้งแอดมินให้กำหนดกองทุนที่ท่านดูแล แล้วเปิดแอปใหม่</p>
  }
  return (
    <YearContext.Provider value={{ year, setYear }}>
      <div className="app">
        <header className="topbar">
          {ROOTS.includes(pathname) ? (
            <Link to="/" className="topbar__logo" aria-label="หน้าแรก บัญชีคริสตจักร"><Logo /></Link>
          ) : (
            <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="ย้อนกลับ"><IconBack /></button>
          )}
          <SyncButton />
          <span className="grow" />
          <label className="sr-only" htmlFor="year-sel">ปีบัญชี</label>
          <select id="year-sel" className="topbar__year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[...years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>ปี {be(y)}</option>)}
          </select>
        </header>

        <OpenInChrome />
        {isSolo() && <p className="role-bar" role="status">🧪 โหมดทดลองคนเดียว — ข้อมูลอยู่ในเครื่องนี้ และข้ามกฎ “ต้องเป็นคนละคน” ให้ลองครบทุกขั้นตอน</p>}
        {role === 'viewer' && ms.myName && <p className="role-bar" role="status">👁️ สิทธิ์ของท่าน: <b>ดูอย่างเดียว</b> — เห็นรายงานและงบประมาณ</p>}
        {ms.needAdmin && (
          <section className="card role-first" role="alertdialog" aria-label="ตั้งแอดมินคนแรก">
            <h2>ยังไม่มีแอดมินของการใช้ร่วมกัน</h2>
            <p>เครื่องนี้คือ <b>เจ้าของ/แอดมินคนแรก</b> ใช่ไหม? แอดมินเชิญคน อนุมัติ กำหนดสิทธิ์ และลบคนได้ (เพิ่มแอดมินร่วมได้ภายหลัง)</p>
            <button type="button" className="btn btn--gold" onClick={ms.becomeAdmin}>✓ ใช่ ฉันเป็นแอดมิน</button>
          </section>
        )}
        {ms.noAdminYet && (
          <section className="card role-first" role="alert">
            <h2>ระบบยังไม่พร้อมรับคำขอ</h2>
            <p>ยังไม่มีแอดมินตั้งค่าระบบ แจ้งผู้ที่ส่งลิงก์ให้ตั้งค่าแอดมินคนแรกก่อน แล้วเปิดลิงก์อีกครั้ง</p>
            <button type="button" className="btn btn--ghost" onClick={ms.cancelRequest}>ยกเลิก</button>
          </section>
        )}
        {ms.removed && (
          <section className="card role-first" role="alert">
            <h2>คำขอไม่ได้รับอนุมัติ หรือท่านถูกนำออกจากการใช้ร่วมกัน</h2>
            <p>เครื่องนี้หยุดใช้ร่วมกับคนอื่น ถ้าต้องการกลับมา ให้ขอลิงก์เชิญใหม่จากแอดมิน</p>
            <button type="button" className="btn btn--ghost" onClick={ms.dismissRemoved}>รับทราบ</button>
          </section>
        )}
        {role === 'admin' && ms.pendingCount > 0 && <Link to="/settings" className="role-bar role-bar--req" role="status">🔔 มีผู้ขอร่วมใช้ <b>{ms.pendingCount} คน</b> รอคุณอนุมัติ — กดเพื่อดูชื่อและให้สิทธิ์</Link>}
        {roToast && <p className="role-toast" role="alert">🔒 สิทธิ์ของท่านทำรายการนี้ไม่ได้</p>}

        {role === 'paused' ? (
          <main className="main">
            <section className="card" role="alert">
              <h2>⏸ สิทธิ์ของท่านถูกพักไว้ชั่วคราว</h2>
              <p><b>ติดต่อแอดมิน</b> เพื่อเปิดสิทธิ์ให้ใช้งานอีกครั้ง (แอปตรวจให้อัตโนมัติ หรือกดปุ่มด้านล่าง)</p>
              <button type="button" className="btn btn--gold" onClick={ms.syncNow}>🔄 ตรวจว่าเปิดสิทธิ์แล้วหรือยัง</button>
            </section>
            <AppCredit />
          </main>
        ) : role === 'pending' ? (
          <main className="main">
            <section className="card" role="status" aria-live="polite">
              <h2>⏳ ส่งคำขอร่วมใช้แล้ว — รอแอดมินอนุมัติ</h2>
              <p>ชื่อที่ส่ง: <b>{ms.myName || '—'}</b> · เมื่อแอดมินอนุมัติและกำหนดสิทธิ์แล้ว ท่านจะใช้แอปได้ตามสิทธิ์นั้น (แอปตรวจให้อัตโนมัติ หรือกดปุ่มด้านล่าง)</p>
              <div className="row">
                <button type="button" className="btn btn--gold" onClick={ms.syncNow}>🔄 ตรวจว่าอนุมัติแล้วหรือยัง</button>
                <button type="button" className="btn btn--ghost" onClick={ms.cancelRequest}>ยกเลิกคำขอ</button>
              </div>
            </section>
            <AppCredit />
          </main>
        ) : (
          <main className="main">{workBack && <Link to={`/meeting/${workBack.n}`} state={{ home: Date.now() }} className="mini workback no-print">🏠 หน้า{workBack.name}</Link>}<Outlet /><AppCredit /></main>
        )}

        <nav className="bottomnav" aria-label="เมนูหลัก">
          <ul style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
            {TABS.map(({ to, label, Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end}>
                  <Icon /><span>{label}</span>
                  {to === '/vouchers' && <TaskBadge year={year} />}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </YearContext.Provider>
  )
}

/** จำนวนงานเบิกจ่ายที่ "ท่าน" ต้องทำ — แยกคอมโพเนนต์เพื่อไม่ให้ผู้ดูอย่างเดียวโหลดข้อมูลใบเบิก */
function TaskBadge({ year }: { year: number }) {
  const role = useRole()
  const v = useVouchers(year)
  const { settings } = useSettings()
  const n = tasksFor(role, whoAmI().id, v.items, settings.twoStepOver, isSolo()).length
  return n > 0 ? <b className="nav-badge" aria-label={`มี ${n} งานที่ท่านต้องทำ`}>{n}</b> : null
}
