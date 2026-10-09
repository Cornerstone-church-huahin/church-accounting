import { useState } from 'react'
import { useYear } from '../lib/year'
import Receive from './Receive'
import Summary from './Summary'
import Pay from './Pay'
import Adjust from './Adjust'

type Tab = 'in' | 'out' | 'adj' | 'sum' | null

/** หน้าแรก: ชื่อ + แท็บ รับ / จ่าย — กดแล้วมีหน้าใหม่ปรากฏด้านล่าง (เนื้อหาจะเพิ่มทีละส่วน) */
export default function Home() {
  const { year } = useYear()
  const [tab, setTab] = useState<Tab>(null)
  return (
    <>
      <div className="page-head no-print"><h1>บัญชีคริสตจักรศิลาเอก</h1></div>
      <div className="home-tabs no-print" role="tablist" aria-label="ขั้นตอน: รับ จ่าย ปรับ สรุป">
        <button type="button" role="tab" aria-selected={tab === 'in'} className={`home-tab home-tab--in${tab === 'in' ? ' on' : ''}`} onClick={() => setTab('in')}>💚 รับ<small>ขั้น 1</small></button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={`home-tab home-tab--out${tab === 'out' ? ' on' : ''}`} onClick={() => setTab('out')}>🔴 จ่าย<small>ขั้น 2</small></button>
        <button type="button" role="tab" aria-selected={tab === 'adj'} className={`home-tab home-tab--adj${tab === 'adj' ? ' on' : ''}`} onClick={() => setTab('adj')}>🏦 ปรับ<small>ขั้น 3</small></button>
        <button type="button" role="tab" aria-selected={tab === 'sum'} className={`home-tab home-tab--sum${tab === 'sum' ? ' on' : ''}`} onClick={() => setTab('sum')}>📊 สรุป<small>ขั้น 4</small></button>
      </div>
      {tab === 'in' && <Receive key={year} year={year} />}
      {tab === 'adj' && <Adjust key={year} year={year} />}
      {tab === 'sum' && <Summary key={year} year={year} />}
      {tab === 'out' && <Pay key={year} year={year} />}
    </>
  )
}
