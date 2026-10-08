import { Link } from 'react-router-dom'
import { can } from '../lib/access'
import { useRole } from '../lib/members'

export default function More() {
  const role = useRole()
  const items = [
    { to: '/budget', icon: '📊', title: 'งบประมาณรายปี', sub: 'แยกหมวด ปรับเพิ่มลด ประวัติ งบฉุกเฉิน', show: true },
    { to: '/reports', icon: '🖨️', title: 'รายงาน (สัปดาห์ · เดือน · ปี)', sub: 'กราฟแท่ง พิมพ์ติดประกาศพร้อมช่องเซ็นชื่อ', show: true },
    { to: '/rounds/statement', icon: '🏦', title: 'เทียบสเตตเมนต์ธนาคาร', sub: 'อัปโหลดไฟล์ จับคู่กับยอดฝากและรายจ่าย', show: can(role, 'detail') },
    { to: '/settings', icon: '⚙️', title: 'ตั้งค่า', sub: 'เชื่อมออนไลน์ ผู้ใช้ ประเภทถวาย บัญชีธนาคาร', show: true },
  ]
  return (
    <>
      <div className="page-head"><h1>เพิ่มเติม</h1></div>
      <ul className="list card">
        {items.filter((i) => i.show).map((i) => (
          <li key={i.to}><Link to={i.to} className="item"><span style={{ fontSize: '1.6rem' }} aria-hidden>{i.icon}</span><span className="grow"><b>{i.title}</b><br /><span className="muted small">{i.sub}</span></span><span aria-hidden>›</span></Link></li>
        ))}
      </ul>
    </>
  )
}
