import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { can } from '../lib/access'
import { useRole } from '../lib/members'

/** ยอดเงินคงเหลือ กองทุน และเงินยืม (หนี้) ดูได้เฉพาะผู้มีสิทธิ์ดูรายละเอียด: แอดมิน · ผู้บันทึกบัญชี · ผู้ตรวจสอบ — คนอื่นเห็นเฉพาะใบสรุปรับ-จ่ายประจำสัปดาห์ */
export default function DetailGate({ children }: { children: ReactNode }) {
  const role = useRole()
  if (can(role, 'detail')) return <>{children}</>
  return (
    <>
      <div className="page-head"><h1>เงินคริสตจักร</h1><Link to="/" className="mini">‹ หน้าแรก</Link></div>
      <p className="empty" role="status">ยอดเงินคงเหลือ กองทุน และเงินยืม ดูได้เฉพาะแอดมิน ผู้บันทึกบัญชี และผู้ตรวจสอบ · พี่น้องดูใบสรุปรับ-จ่ายประจำสัปดาห์ได้ที่หน้า “สรุป”</p>
    </>
  )
}
