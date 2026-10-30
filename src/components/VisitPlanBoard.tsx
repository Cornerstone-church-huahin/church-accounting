import { useMemo, useState } from 'react'
import AbsentList from './AbsentList'
import { Link } from 'react-router-dom'
import { useVisitPlans } from '../lib/data'
import type { VisitStat } from '../lib/pastoral'
import { addItem, removeItem, type PlanDoc } from '../lib/visitPlan'
import type { ChurchMember } from '../lib/types'

/**
 * วางแผนเยี่ยม: ค้นหา/กรองสถานะ แล้วแตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า (ตัวเลขบนปุ่มตะกร้าเพิ่มขึ้น) · ตะกร้า (VisitBasket) อยู่บนหัวหน้า
 * แอดมิน ผู้ดูแลหลัก ผู้ช่วย เห็นและแก้ร่วมกันแบบสด (ซิงก์ทุก 10 วินาที) · ที่ปรึกษาดูอย่างเดียว
 */
export default function VisitPlanBoard({ members, stats, today }: { members: ChurchMember[]; stats: Map<string, VisitStat>; today: string }) {
  const plans = useVisitPlans()
  const [msg, setMsg] = useState('')
  const doc = plans.of(today)
  const canEdit = plans.canEdit()
  const ids = useMemo(() => doc.items.map((x) => x.id), [doc])
  const write = (next: PlanDoc) => setMsg(plans.save(today, next) ? '' : 'สิทธิ์ของท่านแก้แผนเยี่ยมไม่ได้')
  const toggle = (m: ChurchMember) => write(ids.includes(m.id) ? removeItem(doc, m.id) : addItem(doc, m))
  return (
    <div className="vplan">
      {msg && <p className="error small" role="alert" style={{ margin: '0.3rem 0 0' }}>{msg}</p>}
      {!canEdit && <p className="pagehint" style={{ margin: '0.3rem 0 0' }}>ดูอย่างเดียว — แอดมิน ผู้ดูแลหลัก และผู้ช่วยเลือกคนเข้าแผนได้</p>}
      {doc.items.length > 0 && (
        <Link to="/meeting/4/group" className="btn btn--gold vplan__next">เลือกแล้ว <b className="cchip" aria-hidden="true"><u>👤</u>{doc.items.length}</b><span className="sr-only"> {doc.items.length}</span> คน — ต่อไป: จัดกลุ่ม ▶</Link>
      )}
      <AbsentList hideLabel={canEdit} label={canEdit ? `แตะ ＋ ที่ชื่อเพื่อใส่ตะกร้า (${doc.items.length} คน)` : 'ค้นหาสมาชิก / เลือกสถานะ'} members={members} stats={stats} today={today}
        {...(canEdit ? { selectedIds: ids, onPick: toggle } : {})} />
    </div>
  )
}
