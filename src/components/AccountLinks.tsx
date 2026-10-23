import { Link } from 'react-router-dom'

/** ปุ่มเข้าดูบัญชีรับ / บัญชีจ่าย / ภาพรวมรายรับ-รายจ่าย (ดูอย่างเดียว) — ทุกงานมีเหมือนกัน */
export default function AccountLinks({ n }: { n: number }) {
  return (
    <nav className="acctlinks no-print" aria-label="บัญชีรับ บัญชีจ่าย และภาพรวม (ดูอย่างเดียว)">
      <Link to={`/meeting/${n}/in`} className="acctlink acctlink--in"><span aria-hidden="true">💚</span> บัญชีรับ</Link>
      <Link to={`/meeting/${n}/out`} className="acctlink acctlink--out"><span aria-hidden="true">🔴</span> บัญชีจ่าย</Link>
          <Link to={`/meeting/${n}/all`} className="acctlink acctlink--all"><span aria-hidden="true">📊</span> ภาพรวม</Link>
    </nav>
  )
}
