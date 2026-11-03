import { useMemo, useState } from 'react'
import Receive from './Receive'
import Pay from './Pay'
import WeekBar from '../components/WeekBar'
import { sheetSunday, sundaysOf, todayISO } from '../lib/money'

/**
 * บันทึก — รับและจ่ายในหน้าเดียว: เลือกสัปดาห์ครั้งเดียว แล้วบันทึกใบรายรับ (ใบบันทึกการถวาย) และใบรายจ่าย (ใบเบิก-จ่ายเงินสด) ต่อกันในหน้านี้
 * แสดงเฉพาะแผ่นบันทึกรับ/จ่าย (แตะแถวในใบเพื่อเพิ่ม/แก้) + ปุ่มดาวน์โหลด/แชร์/พิมพ์ของแต่ละใบ — ตัดส่วนอื่นออกเพื่อให้หน้าสั้น
 */
export default function Record({ year, onBack }: { year: number; onBack?: () => void }) {
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const s = sheetSunday(todayISO())
    return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0])
  })
  const week = { sunday, set: setSunday }
  return (
    <div className="record">
      {onBack && <button type="button" className="mini no-print record__back" onClick={onBack} aria-label="กลับหน้างานเหรัญญิก">‹ กลับ</button>}
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <section className="record__sec record__sec--in" aria-label="บันทึกรายรับ">
        <h2 className="record__h record__h--in">💚 รายรับ <small>ใบบันทึกการถวาย</small></h2>
        <Receive key={`in-${year}`} year={year} weekCtl={week} hideWeekBar compact />
      </section>
      <section className="record__sec record__sec--out" aria-label="บันทึกรายจ่าย">
        <h2 className="record__h record__h--out">🔴 รายจ่าย <small>ใบเบิก-จ่ายเงินสด</small></h2>
        <Pay key={`out-${year}`} year={year} weekCtl={week} hideWeekBar compact />
      </section>
    </div>
  )
}
