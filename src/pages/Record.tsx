import { useMemo, useRef, useState } from 'react'
import Receive from './Receive'
import Pay from './Pay'
import WeekBar from '../components/WeekBar'
import { sheetSunday, sundaysOf, todayISO } from '../lib/money'

/**
 * บันทึก — รับและจ่ายในหน้าเดียว: เลือกสัปดาห์ครั้งเดียว แล้วบันทึกใบรายรับ (ใบบันทึกการถวาย) และใบรายจ่าย (ใบเบิก-จ่ายเงินสด) ต่อกันในหน้านี้
 * แถบสลับด้านบนกดข้ามไปส่วนรับ/ส่วนจ่ายได้ทันที · ทุกอย่างในแต่ละส่วนทำงานเหมือนหน้า “รับ” และ “จ่าย” เดิม
 */
export default function Record({ year }: { year: number }) {
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const s = sheetSunday(todayISO())
    return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0])
  })
  const inRef = useRef<HTMLElement>(null), outRef = useRef<HTMLElement>(null)
  const go = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const week = { sunday, set: setSunday }
  return (
    <div className="record">
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <div className="record__jump no-print" role="tablist" aria-label="ไปส่วนรับหรือส่วนจ่าย">
        <button type="button" role="tab" className="record__jump-in" onClick={() => go(inRef.current)}>💚 รายรับ</button>
        <button type="button" role="tab" className="record__jump-out" onClick={() => go(outRef.current)}>🔴 รายจ่าย</button>
      </div>
      <section ref={inRef} className="record__sec record__sec--in" aria-label="บันทึกรายรับ">
        <h2 className="record__h record__h--in">💚 รายรับ <small>ใบบันทึกการถวาย</small></h2>
        <Receive key={`in-${year}`} year={year} weekCtl={week} hideWeekBar />
      </section>
      <section ref={outRef} className="record__sec record__sec--out" aria-label="บันทึกรายจ่าย">
        <h2 className="record__h record__h--out">🔴 รายจ่าย <small>ใบเบิก-จ่ายเงินสด</small></h2>
        <Pay key={`out-${year}`} year={year} weekCtl={week} hideWeekBar />
      </section>
    </div>
  )
}
