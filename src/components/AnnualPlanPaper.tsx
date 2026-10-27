import { forwardRef } from 'react'
import { FitBox } from './NoticePaper'
import { PaperHead } from './PaperSheets'
import ScaledPage from './ScaledPage'
import { planTotal, planTotalOf, quarterLabel, quarterMonths, type PlanRow } from '../lib/annualPlan'
import { be, fmtBaht, monthName } from '../lib/money'

const BLANK_ROWS = 7

/**
 * แผนงานประจำปี A4 แนวตั้ง แผ่นละ 1 ไตรมาส (3 เดือน): เดือน (รวมช่อง) · วัน · วันที่ · รายละเอียด · ผู้รับผิดชอบ · งบประมาณ
 * วันที่ที่ผ่านไปแล้ว (หรือทำเสร็จแล้ว) ขีดฆ่า · ท้ายแผ่นรวมงบของไตรมาส · blank = ใบเปล่า (เหลือแต่เดือน) ให้เขียนเอง
 */
const AnnualPlanPaper = forwardRef<HTMLDivElement, { church: string; year: number; q: 1 | 2 | 3 | 4; rows: PlanRow[]; motto: string; blank?: boolean; onRowClick?: (eventId: string) => void }>(function AnnualPlanPaper({ church, year, q, rows, motto, blank, onRowClick }, ref) {
  const months = quarterMonths(q)
  const shown = blank ? [] : rows
  return (
    <ScaledPage ref={ref}>
      <>
        <PaperHead church={church} title={`แผนงานประจำปี ${be(year)}`} sub={`ไตรมาส ${q} · ${quarterLabel(year, q)}`} />
        <div style={{ background: '#ffd84d', border: '2px solid #1a2b4c', borderRadius: 10, padding: '6px 10px', textAlign: 'center', margin: '0 0 8px' }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{'<<<'} แผนงานปี {be(year)} {'>>>'}</div>
          {motto.trim() && <div style={{ fontWeight: 700, fontSize: 14 }}>{motto.trim()}</div>}
        </div>
        <FitBox sig={`${blank}-${shown.length}-${shown.map((r) => r.title.length).join(',')}`}>
          <table className="sheetpaper sheetpaper--plan" aria-label={`แผนงาน ไตรมาส ${q}`}>
            <colgroup><col style={{ width: '10%' }} /><col style={{ width: '13%' }} /><col style={{ width: '10%' }} /><col style={{ width: '37%' }} /><col style={{ width: '18%' }} /><col style={{ width: '12%' }} /></colgroup>
            <thead><tr><th>เดือน</th><th>วัน</th><th>วันที่</th><th>รายละเอียด</th><th>ผู้รับผิดชอบ</th><th>งบประมาณ</th></tr></thead>
            <tbody>
              {months.map((m) => {
                const mine = shown.filter((r) => r.month === m)
                const n = blank ? BLANK_ROWS : Math.max(mine.length, 1)
                return Array.from({ length: n }, (_, i) => {
                  const r = mine[i]
                  const strike = r?.struck ? { textDecoration: 'line-through' as const } : undefined
                  return (
                    <tr key={`${m}-${i}`} className={`${onRowClick && r ? 'sheetrow ' : ''}${i === 0 ? 'plan-first' : ''}`} onClick={onRowClick && r ? (e) => { e.stopPropagation(); onRowClick(r.eventId) } : undefined}>
                      {i === 0 && <td rowSpan={n} className="plan-month">{monthName(m)}</td>}
                      <td style={{ textAlign: 'center', ...strike }}>{r?.dayLabel ?? ''}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, ...strike }}>{r?.dateLabel ?? ''}</td>
                      <td>{r?.title ?? ''}</td>
                      <td>{r?.lead ?? ''}</td>
                      <td style={{ textAlign: 'right' }}>{r && r.budget > 0 ? fmtBaht(r.budget) : ''}</td>
                    </tr>
                  )
                })
              })}
            </tbody>
            <tfoot>
              <tr className="plan-total">
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 800 }}>รวมงบประมาณไตรมาส {q}{blank ? '' : ` (${months.map((m) => `${monthName(m)} ${fmtBaht(planTotalOf(shown, m))}`).join(' · ')})`}</td>
                <td style={{ textAlign: 'right', fontWeight: 800 }}>{blank ? '' : fmtBaht(planTotal(shown))}</td>
              </tr>
            </tfoot>
          </table>
        </FitBox>
      </>
    </ScaledPage>
  )
})
export default AnnualPlanPaper
