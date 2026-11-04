import { useMemo, useRef, useState } from 'react'
import WeekBar from './WeekBar'
import PickDock, { SheetTick } from './PickDock'
import Receive from '../pages/Receive'
import Pay from '../pages/Pay'
import { sheetSunday, sundaysOf, todayISO } from '../lib/money'

/**
 * แผ่นงานเงินหมุนเวียนใต้ยอดคงเหลือ: รายรับ (เขียว) · รายจ่าย (แดง) ใช้สัปดาห์ร่วมกัน — เป็นหน้ารับ/จ่ายเต็มรูปแบบ (แตะแถวแก้ไข สแกนใบ รายการใต้ใบ)
 * แต่ละแผ่นมีแถบไอคอน 4 ปุ่มใต้แผ่น + ติ๊กเลือกที่หัวแถบเพื่อส่งออกหลายแผ่นพร้อมกัน — ดึงใบจริงจากหน้าจอตอนกด จึงตรงกับข้อมูลล่าสุดเสมอ
 */
export default function OwnSheets({ year }: { year: number }) {
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const d = sheetSunday(todayISO())
    return sundays.includes(d) ? d : (sundays.filter((x) => x <= todayISO()).pop() ?? sundays[0])
  })
  const [picked, setPicked] = useState<string[]>([])
  const box = useRef<HTMLDivElement>(null)
  const on = (k: string) => picked.includes(k)
  const tick = (k: string, v: boolean) => setPicked((p) => (v ? (p.includes(k) ? p : [...p, k]) : p.filter((x) => x !== k)))
  const week = { sunday, set: setSunday }
  return (
    <div className="fullmode fundsheets" ref={box}>
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <section className="record__sec record__sec--in" aria-label="รายรับเงินหมุนเวียน" data-sheet="in" data-sel={on('in') ? '1' : undefined}>
        <h2 className="record__h record__h--in">รายรับ <small>ใบบันทึกการถวาย</small><SheetTick on={on('in')} onChange={(v) => tick('in', v)} label="รายรับ" /></h2>
        <Receive key={`own-in-${year}`} year={year} weekCtl={week} hideWeekBar fourTools />
      </section>
      <section className="record__sec record__sec--out" aria-label="รายจ่ายเงินหมุนเวียน" data-sheet="out" data-sel={on('out') ? '1' : undefined}>
        <h2 className="record__h record__h--out">รายจ่าย <small>ใบเบิก-จ่ายเงินสด</small><SheetTick on={on('out')} onChange={(v) => tick('out', v)} label="รายจ่าย" /></h2>
        <Pay key={`own-out-${year}`} year={year} weekCtl={week} hideWeekBar fourTools />
      </section>
      <PickDock keys={picked} file={`เงินหมุนเวียน-${sunday}-แผ่นงานที่เลือก.pdf`} title="เงินหมุนเวียน แผ่นงานที่เลือก" onClear={() => setPicked([])} getEls={() => Array.from(box.current?.querySelectorAll<HTMLDivElement>('[data-sheet][data-sel="1"] .a4page') ?? [])} />
    </div>
  )
}
