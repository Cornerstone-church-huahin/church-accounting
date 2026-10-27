import { forwardRef } from 'react'
import { PaperHead } from './PaperSheets'
import ScaledPage from './ScaledPage'
import { be, monthName } from '../lib/money'
import { sundaysOfMonth, shortThaiDate, type YM } from '../lib/foodRoster'
import type { FoodSlot } from '../lib/types'

const ROWS = 5 // เดือนหนึ่งมีวันอาทิตย์ได้ 4–5 วัน — เว้นแถวไว้ 5 เสมอเพื่อให้ทุกเดือนหน้าตาเหมือนกัน

/**
 * ตารางถวายอาหาร A4 แนวตั้ง แผ่นละ 2 เดือน (ตามใบที่ติดบอร์ด): วันที่ (วันอาทิตย์ ถูกต้องตามปฏิทิน) · ชื่อผู้ถวาย · เนื่องในโอกาส
 * blank = ใบเปล่า (เหลือเฉพาะวันที่) สำหรับให้พี่น้องเขียนชื่อเอง · onRowClick = แตะแถวเพื่อบันทึก/แก้ชื่อ
 */
const FoodRosterPaper = forwardRef<HTMLDivElement, { church: string; months: YM[]; slots: Map<string, FoodSlot>; blank?: boolean; onRowClick?: (date: string) => void; pageNo?: string }>(function FoodRosterPaper({ church, months, slots, blank, onRowClick, pageNo }, ref) {
  const title = months.map((x) => `${monthName(x.m)}`).join(' – ')
  const yrs = [...new Set(months.map((x) => be(x.y)))].join('–')
  return (
    <ScaledPage ref={ref}>
      <>
        <PaperHead church={church} title="ตารางถวายอาหาร" sub={`เดือน${title} ${yrs}${pageNo ? ` · ${pageNo}` : ''}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
          {months.map((x) => {
            const sun = sundaysOfMonth(x.y, x.m)
            return (
              <section key={`${x.y}-${x.m}`} aria-label={`เดือน${monthName(x.m)} ${be(x.y)}`} style={{ border: '2.5px solid #1a2b4c', borderRadius: 14, padding: '8px 10px 10px', background: '#eef5fb' }}>
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 17, background: '#fff', border: '2px solid #1a2b4c', borderRadius: 999, padding: '3px 12px', margin: '0 auto 8px', width: 'fit-content', minWidth: '58%' }}>เดือน{monthName(x.m)} {be(x.y)}</div>
                <table className="sheetpaper sheetpaper--foodrow" aria-label={`ตารางถวายอาหาร เดือน${monthName(x.m)} ${be(x.y)}`} style={{ background: '#fff' }}>
                  <colgroup><col style={{ width: '17%' }} /><col style={{ width: '41%' }} /><col style={{ width: '42%' }} /></colgroup>
                  <thead><tr><th>วันที่</th><th>ชื่อผู้ถวาย</th><th>เนื่องในโอกาส</th></tr></thead>
                  <tbody>
                    {Array.from({ length: ROWS }, (_, i) => {
                      const d = sun[i], s = d && !blank ? slots.get(d) : undefined
                      return (
                        <tr key={i} className={onRowClick && d ? 'sheetrow' : undefined} onClick={onRowClick && d ? (e) => { e.stopPropagation(); onRowClick(d) } : undefined}>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{d ? shortThaiDate(d) : ''}</td>
                          <td>{s?.donor ?? ''}</td>
                          <td>{s?.occasion ?? ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>
      </>
    </ScaledPage>
  )
})
export default FoodRosterPaper
