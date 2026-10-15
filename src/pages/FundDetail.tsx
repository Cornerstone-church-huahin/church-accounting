import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fmtBaht, fmtDate } from '../lib/money'
import { useYear } from '../lib/year'
import { useFundAccounts } from './FundAccounts'
import Pay from './Pay'
import Receive from './Receive'

/**
 * หน้ากองทุนเดียว: มีแค่ 2 ฟังก์ชัน รับ · จ่าย — ใช้หน้าตา/ใบ A4/แนบบิลชุดเดียวกับ รับ-จ่ายหน้าแรกทุกประการ
 * แต่ข้อมูลเป็นของกองทุนนี้ล้วน (ไม่ปนบัญชีหมุนเวียน) · ยอดคงเหลือกองทุนไปรวมที่ช่อง “กองทุน” หน้าแรก · ลบกองทุน = หน้านี้หาย · สร้างกองทุนใหม่ = หน้านี้ขึ้นเอง
 */
export default function FundDetailPage() {
  const { id } = useParams()
  const { year } = useYear()
  const { rows, opening } = useFundAccounts()
  const [tab, setTab] = useState<'in' | 'out'>('in')
  const f = rows.find((r) => r.id === id)
  if (!f) return <><div className="page-head"><h1>💰 กองทุน</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div><p className="empty">ไม่พบกองทุนนี้ (อาจถูกลบหรือเปลี่ยนชื่อ)</p></>
  const fund = { id: f.id, name: f.name, balance: f.balance }
  return (
    <>
      <div className="page-head no-print"><h1>💰 {f.name}</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div>
      <section className="card no-print" role="status" aria-label={`ยอดคงเหลือ กองทุน ${f.name}`}>
        <p className="muted small" style={{ margin: 0 }}>เงินคงเหลือของกองทุนนี้</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: '2px 0', color: f.balance < 0 ? '#b3261e' : undefined }}>{fmtBaht(f.balance)} บาท{f.balance < 0 ? ' (ติดลบ)' : ''}</p>
        <p className="muted small" style={{ margin: 0 }}>ตั้งต้น {fmtBaht(f.opening)}{opening ? ` (${fmtDate(opening.date)})` : ''} + เข้า {fmtBaht(f.moneyIn)} − ออก {fmtBaht(f.moneyOut)} = <b>{fmtBaht(f.balance)}</b></p>
      </section>
      <div className="home-tabs home-tabs--mini no-print" role="tablist" aria-label="กองทุนนี้: รับ จ่าย" style={{ margin: '6px 0' }}>
        <button type="button" role="tab" aria-selected={tab === 'in'} className={`home-tab home-tab--in${tab === 'in' ? ' on' : ''}`} onClick={() => setTab('in')}><i className="hn">1</i><span>💚 รับ</span></button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={`home-tab home-tab--out${tab === 'out' ? ' on' : ''}`} onClick={() => setTab('out')}><i className="hn">2</i><span>🔴 จ่าย</span></button>
      </div>
      <div className="fullmode">
        {tab === 'in' ? <Receive key={`${year}-${f.id}-in`} year={year} fund={fund} /> : <Pay key={`${year}-${f.id}-out`} year={year} fund={fund} />}
      </div>
    </>
  )
}
