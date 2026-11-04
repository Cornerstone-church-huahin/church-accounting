import { createRoot } from 'react-dom/client'
import { FundLedgerPages, IncomeSheetPaper, VoucherPaper } from '../components/PaperSheets'
import { sheetSunday, todayISO } from './money'
import { downloadSheetPdf } from './pdf'

/** ดาวน์โหลดใบเปล่า (ฟอร์มเดียวกับที่แอปสร้างให้) ขนาดจริง A4 — วาดนอกจอแล้วแปลงเป็น PDF */
export async function downloadBlankSheet(kind: 'offering' | 'voucher' | 'fund', church: string, sunday?: string, fundName = ''): Promise<void> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${kind === 'offering' ? 1123 : 794}px;pointer-events:none`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const sun = sunday ?? sheetSunday(todayISO())
    if (kind === 'fund') {
      const sh = { opening: 0, inn: [], out: [], totalIn: 0, totalOut: 0, balance: 0 }
      const refs = { current: [] as (HTMLDivElement | null)[] }
      root.render(<><FundLedgerPages church={church} fundName={fundName} kind="in" lines={[]} sheets={sh} refs={refs} start={0} /><FundLedgerPages church={church} fundName={fundName} kind="out" lines={[]} sheets={sh} refs={refs} start={1} /></>)
    } else root.render(kind === 'offering' ? <IncomeSheetPaper church={church} entries={[]} types={[]} sunday={sun} blank /> : <VoucherPaper church={church} entries={[]} sunday={sun} blank />)
    await new Promise<void>((r) => setTimeout(r, 150))
    const pages = Array.from(host.querySelectorAll<HTMLDivElement>('.a4page'))
    await downloadSheetPdf(pages, kind === 'fund' ? 'fund-blank.pdf' : kind === 'offering' ? 'offering-sheet-blank.pdf' : 'cash-voucher-blank.pdf', 'full')
  } finally {
    root.unmount()
    host.remove()
  }
}
