import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import BirthdayList from './BirthdayList'
import AttendanceStats from './AttendanceStats'
import { isLive } from '../lib/pastoral'
import { todayISO } from '../lib/money'
import { useAttendance, useChurchMembers } from '../lib/data'
import { toAttendance } from '../lib/registry'

/**
 * ทางลัด 2 ปุ่มบนหน้า “รวมสมาชิก” ของทุกห้องงาน: วันเกิดสมาชิก · รายงานการนมัสการ
 * ผู้ใช้ทุกระดับเห็นได้ แต่ดูอย่างเดียว และเห็นเท่าที่จำเป็น (วัน-เดือนเกิด ไม่แสดงปีเกิด/อายุ/สถานะ · รายงานเป็นตัวเลขสรุป ไม่แสดงรายชื่อ)
 */
export default function QuickReports() {
  const [open, setOpen] = useState<'bday' | 'att' | null>(null)
  return (
    <>
      <div className="qrow no-print" role="group" aria-label="ทางลัดดูอย่างเดียว">
        <button type="button" className="qpill qpill--bday" onClick={() => setOpen('bday')}><span className="qpill__ic" aria-hidden="true">🎂</span>วันเกิดสมาชิก</button>
        <button type="button" className="qpill qpill--att" onClick={() => setOpen('att')}><span className="qpill__ic" aria-hidden="true">📊</span>รายงานการนมัสการ</button>
      </div>
      {open === 'bday' && (
        <Sheet title="วันเกิดสมาชิก" onClose={() => setOpen(null)}>
          <p className="muted small" style={{ margin: 0 }}>ดูอย่างเดียว · แสดงวันและเดือนเกิดของสมาชิกที่ยังอยู่</p>
          <BdayBody />
        </Sheet>
      )}
      {open === 'att' && (
        <Sheet title="รายงานการนมัสการ" onClose={() => setOpen(null)}>
          <p className="muted small" style={{ margin: 0 }}>ดูอย่างเดียว · ตัวเลขสรุปผู้เข้านมัสการแต่ละสัปดาห์</p>
          <AttBody />
        </Sheet>
      )}
    </>
  )
}

/** โหลดข้อมูลเมื่อเปิดแผ่นเท่านั้น (ปุ่มอยู่ทุกหน้างาน ไม่ให้หน้าหนักขึ้น) */
function BdayBody() {
  const people = useChurchMembers()
  return <BirthdayList members={people.items.filter(isLive)} today={todayISO()} onOpen={() => undefined} hideYear readOnly />
}
function AttBody() {
  const people = useChurchMembers()
  const y = new Date().getFullYear()
  const a0 = useAttendance(y), a1 = useAttendance(y - 1, false), a2 = useAttendance(y - 2, false), a3 = useAttendance(y - 3, false)
  const att = useMemo(() => toAttendance([a3, a2, a1, a0].flatMap((st) => st.items)), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  return <AttendanceStats attendance={att} members={people.items} />
}
