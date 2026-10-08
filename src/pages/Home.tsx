import { useState } from 'react'

/** หน้าแรก: เหลือเฉพาะชื่อและแท็บ รับ / จ่าย (เนื้อหาในแต่ละแท็บจะเพิ่มทีละส่วน) */
export default function Home() {
  const [tab, setTabState] = useState<'in' | 'out'>(() => { try { return sessionStorage.getItem('home.tab') === 'out' ? 'out' : 'in' } catch { return 'in' } })
  const setTab = (t: 'in' | 'out') => { setTabState(t); try { sessionStorage.setItem('home.tab', t) } catch { /* ignore */ } }
  return (
    <>
      <div className="page-head"><h1>บัญชีคริสตจักรศิลาเอก</h1></div>
      <div className="seg home-tabs" role="tablist" aria-label="รับหรือจ่าย">
        <button type="button" role="tab" aria-selected={tab === 'in'} className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>💚 รับ</button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')}>🔴 จ่าย</button>
      </div>
    </>
  )
}
