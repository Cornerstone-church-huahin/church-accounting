import { Link, useNavigate } from 'react-router-dom'
import { useFlowTicks } from '../lib/data'

/** งานเลขา › ลำดับงาน: เลือกลำดับงานที่จะทำ — แต่ละอันมีเช็คลิสต์ของตัวเอง · เก็บเอกสารไปที่คลังเอกสารโดยตรง */
export function WorkflowMenu() {
  const opts = [
    { to: '/meeting/1/1/meeting', icon: '🗓️', title: 'ประชุมธรรมกิจ', blurb: 'เช็คลิสต์ 10 ขั้น ตั้งแต่เตรียมประชุมจนเก็บเอกสาร' },
    { to: '/meeting/1/1/invite', icon: '✉️', title: 'หนังสือเชิญ', blurb: 'ลำดับสิ่งที่ต้องทำ ตั้งแต่ร่างจนส่งและเก็บสำเนา' },
    { to: '/meeting/1/3', icon: '🗄️', title: 'เก็บเอกสาร', blurb: 'เข้าสู่คลังเอกสารโดยตรง' },
  ]
  return (
    <>
      <div className="page-head no-print"><h1>📋 ลำดับงาน</h1><Link to="/meeting/1" className="mini">‹ งานเลขา</Link></div>
      <p className="muted" style={{ margin: '0 0 0.7rem' }}>เลือกลำดับงานที่ต้องการทำ</p>
      <nav className="mcgrid" aria-label="เลือกลำดับงาน" style={{ gridTemplateColumns: '1fr' }}>
        {opts.map((o, i) => (
          <Link key={o.to} to={o.to} className={`mcbtn btile--${(['own', 'fund', 'total'] as const)[i]}`}>
            <span className="mcbtn__icon" aria-hidden="true">{o.icon}</span>
            <b>{o.title}</b>
            <small>{o.blurb}</small>
          </Link>
        ))}
      </nav>
    </>
  )
}

const INVITE_STEPS: { id: string; title: string; hint: string; to?: string; toLabel?: string }[] = [
  { id: 'topic', title: 'กำหนดเรื่อง วัน เวลา และสถานที่', hint: 'สร้างหรือเลือกการประชุมก่อน เพื่อให้หนังสือเชิญใช้ข้อมูลชุดเดียวกัน', to: '/meeting/1/1/meeting', toLabel: 'ไปประชุมธรรมกิจ ›' },
  { id: 'draft', title: 'ร่างหนังสือเชิญ', hint: 'ใช้ขั้น “แจ้งประชุม” ในเช็คลิสต์การประชุม สร้างหนังสือและดูตัวอย่างหน้ากระดาษ', to: '/meeting/1/1/3', toLabel: 'ไปขั้นแจ้งประชุม ›' },
  { id: 'agenda', title: 'แนบระเบียบวาระที่ประธานตรวจแล้ว', hint: 'ให้ประธานเห็นชอบวาระก่อนส่ง' },
  { id: 'sign', title: 'ประธานตรวจและลงนาม', hint: 'ตรวจชื่อ วันที่ เวลา สถานที่ ให้ถูกต้อง' },
  { id: 'send', title: 'ส่งให้ผู้รับ', hint: 'LINE อีเมล หรือเอกสารกระดาษ ตามที่ตกลง' },
  { id: 'reply', title: 'ติดตามการตอบรับและการลา', hint: 'จดว่าใครมา ใครลา ใครยังไม่ตอบ' },
  { id: 'file', title: 'เก็บสำเนาเข้าคลังเอกสาร', hint: 'ติ๊กข้อนี้แล้วระบบพาไปคลังเอกสารเพื่อนำเข้าไฟล์ทันที' },
]

/** ลำดับงาน: หนังสือเชิญ — เช็คลิสต์ติ๊กทีละข้อ (บันทึกร่วมกัน) · ข้อสุดท้ายส่งต่อไปคลังเอกสาร */
export function InviteFlow() {
  const t = useFlowTicks()
  const navigate = useNavigate()
  const row = t.items.find((x) => x.id === 'invite')
  const ticks = row?.ticks ?? []
  const done = INVITE_STEPS.filter((s) => ticks.includes(s.id)).length
  const set = (next: string[]) => t.put([{ ...(row ?? { id: 'invite', updated: Date.now() }), ticks: next, updated: Date.now() }])
  const toggle = (id: string) => {
    const on = !ticks.includes(id)
    set(on ? [...ticks, id] : ticks.filter((x) => x !== id))
    if (on && id === 'file') navigate('/meeting/1/3', { state: { importMeeting: { title: 'หนังสือเชิญประชุม', date: new Date().toISOString().slice(0, 10), note: 'สำเนาหนังสือเชิญ' } } })
  }
  return (
    <>
      <div className="page-head no-print"><h1>✉️ หนังสือเชิญ</h1><Link to="/meeting/1/1" className="mini">‹ ลำดับงาน</Link></div>
      <section className="card mcard" aria-label="ลำดับงานหนังสือเชิญ">
        <div className="mcard__head"><div><b>ลำดับสิ่งที่ต้องทำ</b><div className="small muted">ติ๊กเมื่อทำเสร็จแต่ละข้อ</div></div><span className="mcard__n" aria-label={`ทำแล้ว ${done} จาก ${INVITE_STEPS.length} ข้อ`}>{done}/{INVITE_STEPS.length}</span></div>
        <ol className="mcheck" aria-label="เช็คลิสต์หนังสือเชิญ">
          {INVITE_STEPS.map((s, i) => {
            const on = ticks.includes(s.id)
            return (
              <li key={s.id}>
                <div className={`mcheck__row mcheck__row--${on ? 'done' : 'todo'}`}>
                  <button type="button" className="mcheck__box" role="checkbox" aria-checked={on} aria-label={`${i + 1}. ${s.title}`} onClick={() => toggle(s.id)} style={{ background: undefined, cursor: 'pointer' }}>{on ? '✓' : ''}</button>
                  <span className="mcheck__t"><b>{i + 1}. {s.title}</b><small>{s.hint}</small>{s.to && <Link to={s.to} className="small">{s.toLabel}</Link>}</span>
                </div>
              </li>
            )
          })}
        </ol>
        {done > 0 && <div className="row" style={{ marginTop: '0.4rem' }}><button type="button" className="mini" onClick={() => { if (window.confirm('เริ่มเช็คลิสต์ใหม่ (ล้างเครื่องหมายทั้งหมด) ?')) set([]) }}>↺ เริ่มใหม่</button></div>}
      </section>
    </>
  )
}
