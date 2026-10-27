import { createRoot } from 'react-dom/client'
import FoodRosterPaper from '../components/FoodRosterPaper'
import { monthName, be } from './money'
import { monthPages, shiftMonth, type YM } from './foodRoster'
import { downloadSheetPdf, sharePdf } from './pdf'
import type { FoodSlot } from './types'

/** ชื่อไฟล์: ตารางถวายอาหาร-ต.ค.2569-ก.ย.2570-เปล่า.pdf */
export const foodFile = (start: YM, count: number, blank: boolean) => {
  const end = shiftMonth(start, count - 1)
  return `ตารางถวายอาหาร-${monthName(start.m)}${be(start.y)}-${monthName(end.m)}${be(end.y)}${blank ? '-เปล่า' : ''}.pdf`
}

/** วาดแผ่นเปล่า (ไม่มีชื่อ มีเฉพาะวันอาทิตย์ถูกต้อง) นอกจอ แล้วดาวน์โหลด/แชร์เป็น PDF ขนาดจริง A4 */
export async function exportBlankFood(mode: 'download' | 'share', church: string, start: YM, count: number): Promise<'done' | 'unsupported' | 'cancelled'> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;pointer-events:none'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const pages = monthPages(start, count)
    root.render(<div>{pages.map((mp, i) => <FoodRosterPaper key={i} church={church} months={mp} slots={new Map<string, FoodSlot>()} blank pageNo={pages.length > 1 ? `แผ่นที่ ${i + 1}/${pages.length}` : undefined} />)}</div>)
    await new Promise<void>((r) => setTimeout(r, 200))
    const els = Array.from(host.querySelectorAll<HTMLDivElement>('.a4page'))
    const file = foodFile(start, count, true)
    if (mode === 'download') { await downloadSheetPdf(els, file, 'full'); return 'done' }
    const r = await sharePdf(els, file, 'full', 'ตารางถวายอาหาร (ใบเปล่า)')
    if (r === 'unsupported') { await downloadSheetPdf(els, file, 'full'); return 'unsupported' }
    return r === 'cancelled' ? 'cancelled' : 'done'
  } finally {
    root.unmount()
    host.remove()
  }
}
