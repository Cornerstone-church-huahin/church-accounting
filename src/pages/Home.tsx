import { useState } from 'react'
import { useYear } from '../lib/year'
import Receive from './Receive'
import Summary from './Summary'

type Tab = 'in' | 'out' | 'sum' | null

/** หน้าแรก: ชื่อ + แท็บ รับ / จ่าย — กดแล้วมีหน้าใหม่ปรากฏด้านล่าง (เนื้อหาจะเพิ่มทีละส่วน) */
export default function Home() {
  const { year } = useYear()
  const [tab, setTab] = useState<Tab>(null)
  return (
    <>
      <div className="page-head no-print"><h1>บัญชีคริสตจักรศิลาเอก</h1></div>
      <div className="home-tabs no-print" role="tablist" aria-label="รับ จ่าย หรือสรุป">
        <button type="button" role="tab" aria-selected={tab === 'in'} className={`home-tab home-tab--in${tab === 'in' ? ' on' : ''}`} onClick={() => setTab('in')}>💚 รับ</button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={`home-tab home-tab--out${tab === 'out' ? ' on' : ''}`} onClick={() => setTab('out')}>🔴 จ่าย</button>
        <button type="button" role="tab" aria-selected={tab === 'sum'} className={`home-tab home-tab--sum${tab === 'sum' ? ' on' : ''}`} onClick={() => setTab('sum')}>📊 สรุป</button>
      </div>
      {tab === 'in' && <Receive key={year} year={year} />}
      {tab === 'sum' && <Summary key={year} year={year} />}
      {tab === 'out' && (
        <section className="card" role="tabpanel" aria-label="หน้าจ่าย">
          <h2>🔴 จ่าย</h2>
          <p className="muted small">หน้าจ่าย — ยังว่าง รอกำหนดเนื้อหา</p>
        </section>
      )}
    </>
  )
}
