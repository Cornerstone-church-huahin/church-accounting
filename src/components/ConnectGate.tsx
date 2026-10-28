import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { parseInviteLink } from '../lib/invite'
import { Logo } from './Icons'

/** หน้าเดียวที่เห็นได้เมื่อเครื่องยังไม่ได้เชื่อมต่อ: วางลิงก์เชิญ (ไม่มีตัวเลข/เมนู/ห้องงานใด ๆ) */
export default function ConnectGate() {
  const nav = useNavigate()
  const [pasted, setPasted] = useState('')
  const [err, setErr] = useState('')
  const go = () => {
    const qs = parseInviteLink(pasted)
    if (!qs) return setErr('ไม่พบรหัสในลิงก์ที่วาง ลองคัดลอกลิงก์เชิญจากแชตอีกครั้ง (ลิงก์ต้องมีคำว่า #/join?t=…)')
    setErr(''); setPasted('')
    nav(`/join?${qs}`)
  }
  return (
    <div className="app">
      <main className="main" style={{ display: 'grid', gap: '1rem', justifyItems: 'center', textAlign: 'center', paddingTop: '2.5rem' }}>
        <span aria-hidden="true" style={{ width: '5rem', height: '5rem', display: 'grid' }}><Logo /></span>
        <h1 style={{ margin: 0 }}>ห้องทำงานคริสตจักร</h1>
        <p style={{ margin: 0 }}><b>เครื่องนี้ยังไม่ได้เชื่อมต่อ</b></p>
        <p className="pagehint" style={{ margin: 0 }}>วางลิงก์เชิญที่ได้รับจากแอดมิน (คัดลอกจากแชต LINE) เพื่อเข้าใช้งาน</p>
        <div className="field" style={{ width: '100%', textAlign: 'left' }}>
          <label htmlFor="cg-link">ลิงก์เชิญ</label>
          <textarea id="cg-link" className="input" rows={3} value={pasted} onChange={(e) => { setPasted(e.target.value); setErr('') }} placeholder="วางลิงก์ที่มี #/join?t=… ตรงนี้" style={{ minHeight: '5rem' }} />
        </div>
        {err && <p role="alert" className="small" style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>}
        <button type="button" className="btn btn--gold bigbtn btn--block" disabled={!pasted.trim()} onClick={go}>เชื่อมต่อด้วยลิงก์นี้</button>
        <p className="pagehint" style={{ margin: 0 }}>iPhone: เปิดจากไอคอนบนหน้าจอโฮมแล้ววางลิงก์ตรงนี้ (Safari กับไอคอนเก็บข้อมูลแยกกัน)</p>
        <Link className="small" to="/settings">ผู้ดูแลหลัก: ตั้งค่าเชื่อมต่อครั้งแรก</Link>
      </main>
    </div>
  )
}
