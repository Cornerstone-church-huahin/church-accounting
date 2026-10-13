import { createRoot } from 'react-dom/client'
import { IncomeSheetPaper, VoucherPaper } from '../components/PaperSheets'
import { sheetSunday, todayISO } from './money'
import { downloadSheetPdf } from './pdf'

/** ดาวน์โหลดใบเปล่า (ฟอร์มเดียวกับที่แอปสร้างให้) ขนาดจริง A4 — วาดนอกจอแล้วแปลงเป็น PDF */
export async function downloadBlankSheet(kind: 'offering' | 'voucher', church: string, sunday?: string): Promise<void> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${kind === 'offering' ? 1123 : 794}px;pointer-events:none`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const sun = sunday ?? sheetSunday(todayISO())
    root.render(kind === 'offering' ? <IncomeSheetPaper church={church} entries={[]} types={[]} sunday={sun} /> : <VoucherPaper church={church} entries={[]} sunday={sun} />)
    await new Promise<void>((r) => setTimeout(r, 150))
    const pages = Array.from(host.querySelectorAll<HTMLDivElement>('.a4page'))
    await downloadSheetPdf(pages, kind === 'offering' ? 'offering-sheet-blank.pdf' : 'cash-voucher-blank.pdf', kind === 'offering' ? 'landscape' : 'full')
  } finally {
    root.unmount()
    host.remove()
  }
}
