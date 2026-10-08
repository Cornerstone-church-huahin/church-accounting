import { useState } from 'react'

type Tab = 'in' | 'out' | null

/** หน้าแรก: ชื่อ + แท็บ รับ / จ่าย — กดแล้วมีหน้าใหม่ปรากฏด้านล่าง (เนื้อหาจะเพิ่มทีละส่วน) */
export default function Home() {
  const [tab, setTab] = useState<Tab>(null)
  return (
    <>
      <div className="page-head"><h1>บัญชีคริสตจักรศิลาเอก</h1></div>
      <div className="seg home-tabs" role="tablist" aria-label="รับหรือจ่าย">
        <button type="button" role="tab" aria-selected={tab === 'in'} className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>💚 รับ</button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')}>🔴 จ่าย</button>
      </div>
      {tab === 'in' && (
        <section className="card" role="tabpanel" aria-label="หน้ารับ">
          <h2>💚 รับ</h2>
          <p className="muted small">หน้ารับ — ยังว่าง รอกำหนดเนื้อหา</p>
        </section>
      )}
      {tab === 'out' && (
        <section className="card" role="tabpanel" aria-label="หน้าจ่าย">
          <h2>🔴 จ่าย</h2>
          <p className="muted small">หน้าจ่าย — ยังว่าง รอกำหนดเนื้อหา</p>
        </section>
      )}
    </>
  )
}
