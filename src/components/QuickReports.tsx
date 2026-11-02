import { useState } from 'react'
import Sheet from './Sheet'
import BirthdayList from './BirthdayList'
import AttendanceStats from './AttendanceStats'
import { isLive } from '../lib/pastoral'
import { todayISO } from '../lib/money'
import type { Attendance, ChurchMember } from '../lib/types'

/**
 * ทางลัด 2 ปุ่มบนหน้า “รวมสมาชิก” ของทุกห้องงาน: วันเกิดสมาชิก · รายงานการนมัสการ
 * ผู้ใช้ทุกระดับเห็นได้ แต่ดูอย่างเดียว และเห็นเท่าที่จำเป็น (วัน-เดือนเกิด ไม่แสดงปีเกิด/อายุ/สถานะ · รายงานเป็นตัวเลขสรุป ไม่แสดงรายชื่อ)
 */
export default function QuickReports({ members, attendance }: { members: ChurchMember[]; attendance: Attendance[] }) {
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
          <BirthdayList members={members.filter(isLive)} today={todayISO()} onOpen={() => undefined} hideYear readOnly />
        </Sheet>
      )}
      {open === 'att' && (
        <Sheet title="รายงานการนมัสการ" onClose={() => setOpen(null)}>
          <p className="muted small" style={{ margin: 0 }}>ดูอย่างเดียว · ตัวเลขสรุปผู้เข้านมัสการแต่ละสัปดาห์</p>
          <AttendanceStats attendance={attendance} members={members} />
        </Sheet>
      )}
    </>
  )
}
