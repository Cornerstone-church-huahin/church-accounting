import { createRoot } from 'react-dom/client'
import AnnualPlanPaper from '../components/AnnualPlanPaper'
import { be } from './money'
import { downloadSheetPdf, sharePdf } from './pdf'

export const planFile = (year: number, q: number | 'all', blank: boolean) => `แผนงานประจำปี-${be(year)}-${q === 'all' ? 'ทั้งปี' : `ไตรมาส${q}`}${blank ? '-เปล่า' : ''}.pdf`

/** วาดใบแผนงานเปล่า 4 ไตรมาส (หรือไตรมาสเดียว) นอกจอ แล้วดาวน์โหลด/แชร์เป็น PDF A4 */
export async function exportBlankPlan(mode: 'download' | 'share', church: string, year: number, motto: string, q: 1 | 2 | 3 | 4 | 'all'): Promise<'done' | 'unsupported' | 'cancelled'> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;pointer-events:none'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const qs: (1 | 2 | 3 | 4)[] = q === 'all' ? [1, 2, 3, 4] : [q]
    root.render(<div>{qs.map((x) => <AnnualPlanPaper key={x} church={church} year={year} q={x} rows={[]} motto={motto} blank />)}</div>)
    await new Promise<void>((r) => setTimeout(r, 200))
    const els = Array.from(host.querySelectorAll<HTMLDivElement>('.a4page'))
    const file = planFile(year, q, true)
    if (mode === 'download') { await downloadSheetPdf(els, file, 'full'); return 'done' }
    const r = await sharePdf(els, file, 'full', 'แผนงานประจำปี (ใบเปล่า)')
    if (r === 'unsupported') { await downloadSheetPdf(els, file, 'full'); return 'unsupported' }
    return r === 'cancelled' ? 'cancelled' : 'done'
  } finally {
    root.unmount()
    host.remove()
  }
}
