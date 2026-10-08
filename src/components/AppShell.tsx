import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { can, isSolo, READONLY_EVENT, whoAmI } from '../lib/access'
import { useMembership, useRole } from '../lib/members'
import { useSettings, useVouchers } from '../lib/data'
import { tasksFor } from '../lib/ledger'
import { be, todayISO, yearOf } from '../lib/money'
import { initialYear, saveYear, YearContext } from '../lib/year'
import OpenInChrome from './OpenInChrome'
import { IconBack, IconCalendar, IconChart, IconCoins, IconHome, IconMore, IconReceipt, IconWallet, Logo } from './Icons'

const FULL = [
  { to: '/', label: 'หน้าแรก', Icon: IconHome, end: true },
  { to: '/income', label: 'รายรับ', Icon: IconCoins, end: false },
  { to: '/rounds', label: 'อาทิตย์', Icon: IconCalendar, end: false },
  { to: '/vouchers', label: 'เบิกจ่าย', Icon: IconReceipt, end: false },
  { to: '/more', label: 'เพิ่มเติม', Icon: IconMore, end: false },
]
const VIEW = [
  { to: '/', label: 'หน้าแรก', Icon: IconHome, end: true },
  { to: '/budget', label: 'งบประมาณ', Icon: IconWallet, end: false },
  { to: '/reports', label: 'รายงาน', Icon: IconChart, end: false },
  { to: '/more', label: 'เพิ่มเติม', Icon: IconMore, end: false },
]
const ROOTS = ['/', '/income', '/rounds', '/vouchers', '/more', '/budget', '/reports']

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const role = useRole()
  const ms = useMembership()
  const [year, setYearState] = useState(initialYear)
  const setYear = (y: number) => { setYearState(y); saveYear(y) }
  const [roToast, setRoToast] = useState(false)
  const full = can(role, 'detail')
  const TABS = full ? FULL : VIEW

  useEffect(() => { document.documentElement.dataset.role = role }, [role])
  useEffect(() => {
    let t = 0
    const on = () => { setRoToast(true); window.clearTimeout(t); t = window.setTimeout(() => setRoToast(false), 3500) }
    window.addEventListener(READONLY_EVENT, on)
    return () => { window.removeEventListener(READONLY_EVENT, on); window.clearTimeout(t) }
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  const years = useMemo(() => { const y = yearOf(todayISO()); return [y + 1, y, y - 1, y - 2, y - 3, y - 4] }, [])
  if (!years.includes(year)) years.push(year)

  return (
    <YearContext.Provider value={{ year, setYear }}>
      <div className="app">
        <header className="topbar">
          {ROOTS.includes(pathname) ? (
            <Link to="/" className="topbar__logo" aria-label="หน้าแรก บัญชีคริสตจักร"><Logo /></Link>
          ) : (
            <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="ย้อนกลับ"><IconBack /></button>
          )}
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

        {role === 'pending' ? (
          <main className="main">
            <section className="card" role="status" aria-live="polite">
              <h2>⏳ ส่งคำขอร่วมใช้แล้ว — รอแอดมินอนุมัติ</h2>
              <p>ชื่อที่ส่ง: <b>{ms.myName || '—'}</b> · เมื่อแอดมินอนุมัติและกำหนดสิทธิ์แล้ว ท่านจะใช้แอปได้ตามสิทธิ์นั้น (แอปตรวจให้อัตโนมัติ หรือกดปุ่มด้านล่าง)</p>
              <div className="row">
                <button type="button" className="btn btn--gold" onClick={ms.syncNow}>🔄 ตรวจว่าอนุมัติแล้วหรือยัง</button>
                <button type="button" className="btn btn--ghost" onClick={ms.cancelRequest}>ยกเลิกคำขอ</button>
              </div>
            </section>
          </main>
        ) : (
          <main className="main"><Outlet /></main>
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
