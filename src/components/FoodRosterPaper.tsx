import { forwardRef } from 'react'
import FoodIcon, { type FoodKind } from './FoodIcons'
import { PaperHead } from './PaperSheets'
import ScaledPage from './ScaledPage'
import { be, monthName } from '../lib/money'
import { sundaysOfMonth, shortThaiDate, type YM } from '../lib/foodRoster'
import type { FoodPay, FoodSlot } from '../lib/types'

const ICONS: [FoodKind, FoodKind][] = [['burger', 'taco'], ['donut', 'sandwich']] // เดือนที่ 1 / 2 ของแผ่น
const ROWS = 5 // เดือนหนึ่งมีวันอาทิตย์ได้ 4–5 วัน — เว้นแถวไว้ 5 เสมอเพื่อให้ทุกเดือนหน้าตาเหมือนกัน

/**
 * ตารางถวายอาหาร A4 แนวตั้ง แผ่นละ 2 เดือน (ตามใบที่ติดบอร์ด): วันที่ (วันอาทิตย์ ถูกต้องตามปฏิทิน) · ชื่อผู้ถวาย · เนื่องในโอกาส
 * blank = ใบเปล่า (เหลือเฉพาะวันที่) สำหรับให้พี่น้องเขียนชื่อเอง · onRowClick = แตะแถวเพื่อบันทึก/แก้ชื่อ
 */
const FoodRosterPaper = forwardRef<HTMLDivElement, { church: string; months: YM[]; slots: Map<string, FoodSlot>; blank?: boolean; onRowClick?: (date: string) => void; pageNo?: string; /** บัญชีธนาคารรับถวาย (แสดงกรอบท้ายแผ่นเมื่อมีเลขที่บัญชี) */ pay?: FoodPay }>(function FoodRosterPaper({ church, months, slots, blank, onRowClick, pageNo, pay }, ref) {
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '0 0 6px' }}>
                  <FoodIcon kind={ICONS[months.indexOf(x) % 2][0]} />
                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, background: '#fff', border: '2px solid #1a2b4c', borderRadius: 999, padding: '4px 14px', flex: 1, maxWidth: '62%' }}>เดือน{monthName(x.m)} {be(x.y)}</div>
                  <FoodIcon kind={ICONS[months.indexOf(x) % 2][1]} />
                </div>
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
        {pay?.accNo.trim() && (
          <aside aria-label="บัญชีรับถวายอาหาร" style={{ marginTop: 10, border: '2.5px solid #1a2b4c', borderRadius: 14, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12, background: '#fff8e6' }}>
            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
              <path d="M4 16 L22 5 L40 16 Z" fill="#1a2b4c" /><rect x="7" y="18" width="5" height="14" fill="#1a2b4c" /><rect x="15" y="18" width="5" height="14" fill="#1a2b4c" /><rect x="24" y="18" width="5" height="14" fill="#1a2b4c" /><rect x="32" y="18" width="5" height="14" fill="#1a2b4c" /><rect x="4" y="34" width="36" height="5" rx="1" fill="#b8860b" />
            </svg>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>ถวายด้วยการโอนเงิน{pay.note.trim() ? ` · ${pay.note.trim()}` : ''}</div>
              <div style={{ fontSize: 13 }}>{[pay.bank.trim(), pay.accName.trim() && `ชื่อบัญชี ${pay.accName.trim()}`].filter(Boolean).join(' · ')}</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1.5, color: '#1a2b4c' }} aria-label="เลขที่บัญชี">เลขที่บัญชี {pay.accNo.trim()}</div>
            </div>
          </aside>
        )}
      </>
    </ScaledPage>
  )
})
export default FoodRosterPaper
