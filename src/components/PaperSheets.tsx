import { useRef } from 'react'
import { addDays, be, fmtBaht, fmtDate, monthName, monthShort } from '../lib/money'
import { downloadSheetPdf } from '../lib/pdf'
import type { ExpenseEntry, IncomeEntry, IncomeType } from '../lib/types'
import ScaledPage from './ScaledPage'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })
const chunk = <T,>(xs: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out.length ? out : [[]] }

/** "ประจำวันอาทิตย์ที่ 3 ของเดือนตุลาคม · ระหว่างวันที่ 12–18 ตุลาคม พ.ศ. 2569" — นับว่าเป็นวันอาทิตย์ที่เท่าไรของเดือนและช่วงวันที่จริง (จันทร์–อาทิตย์) */
export function weekHeading(sunday: string): string {
  const [y, mo, d] = sunday.split('-').map(Number)
  const mon = addDays(sunday, -6)
  const [, mm, md] = mon.split('-').map(Number)
  const range = mm === mo ? `${md}–${d} ${monthName(mo)}` : `${md} ${monthShort(mm)} – ${d} ${monthName(mo)}`
  return `ประจำวันอาทิตย์ที่ ${Math.ceil(d / 7)} ของเดือน${monthName(mo)} · ระหว่างวันที่ ${range} พ.ศ. ${be(y)}`
}

/** โลโก้คริสตจักร: กางเขนขาวบนสี่เหลี่ยมข้าวหลามตัดสีกรมท่า (ตามใบเบิก-จ่ายเงินสด) */
export function ChurchMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="9" y="9" width="22" height="22" rx="4" transform="rotate(45 20 20)" fill="#1a2b4c" />
      <path d="M20 11.5v17M13.2 17.5h13.6" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}
function PaperHead({ church, title, sub, compact }: { church: string; title: string; sub: string; compact?: boolean }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: compact ? 2 : 6 }}>
      <ChurchMark size={compact ? 22 : 30} />
      <div style={{ fontSize: compact ? 20 : 28, fontWeight: 700, color: '#1a2b4c', lineHeight: 1.1 }}>{church}</div>
      <div style={{ fontSize: compact ? 15 : 20, fontWeight: 700, textDecoration: 'underline', color: '#111', margin: '1px 0' }}>{title}</div>
      <div style={{ fontSize: compact ? 11 : 13, textAlign: 'center' }}>{sub}</div>
    </div>
  )
}

const DOWNLOAD_NOTE = 'ดาวน์โหลด PDF ขนาดจริง'

/** ใบบันทึกการถวาย เต็มแผ่น A4 แนวนอน (297 × 210 มม. ขนาดจริง) 20 แถวล็อกไว้ — รายการที่บันทึกเติมทีละแถว เกิน 20 แถวขึ้นแผ่นถัดไป */
export function IncomeSheetPaper({ church, entries, types, sunday }: { church: string; entries: IncomeEntry[]; types: IncomeType[]; sunday?: string }) {
  const ROWS = 20
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const all = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const pages = chunk(all, ROWS)
  const name = (id: string) => types.find((t) => t.id === id)?.name ?? (id === '' ? 'โอน (ยังไม่แยกประเภท)' : '(ประเภทที่ถูกลบ)')
  const sum = (xs: IncomeEntry[], k: 'cash' | 'transfer') => xs.filter((x) => x.method === k).reduce((s, x) => s + x.amount, 0)
  const cnt = (xs: IncomeEntry[], k: 'cash' | 'transfer') => xs.filter((x) => x.method === k).reduce((s, x) => s + (x.count ?? 1), 0)
  const heading = sunday ? weekHeading(sunday) : 'รวมทุกสัปดาห์'
  return (
    <div>
      {pages.map((rows, pi) => (
        <ScaledPage key={pi} landscape className="a4page a4page--sheet" ref={(el) => { refs.current[pi] = el }}>
          <>
            <PaperHead church={church} title="ใบบันทึกการถวาย" sub={`${heading}${pages.length > 1 ? ` · แผ่นที่ ${pi + 1}/${pages.length}` : ''}`} compact />
            <table className="sheetpaper sheetpaper--land" aria-label="ใบบันทึกการถวาย (A4 แนวนอน)">
              <colgroup><col style={{ width: '9%' }} /><col style={{ width: '5%' }} /><col style={{ width: '29%' }} /><col style={{ width: '9%' }} /><col style={{ width: '12%' }} /><col style={{ width: '9%' }} /><col style={{ width: '12%' }} /><col style={{ width: '15%' }} /></colgroup>
              <thead><tr><th>วันที่</th><th>No.</th><th>ประเภท</th><th>จำนวนซอง</th><th>จำนวนเงิน</th><th>จำนวนโอน</th><th>จำนวนเงิน</th><th>รวม</th></tr></thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => {
                  const x = rows[i]
                  return (
                    <tr key={i}>
                      <td>{x ? fmtDate(x.date) : ''}</td>
                      <td>{pi * ROWS + i + 1}.</td>
                      <td>{x ? name(x.typeId) : ''}</td>
                      <td className="num">{x && x.method === 'cash' ? x.count ?? 1 : ''}</td>
                      <td className="num">{x && x.method === 'cash' ? m(x.amount) : ''}</td>
                      <td className="num">{x && x.method === 'transfer' ? x.count ?? 1 : ''}</td>
                      <td className="num">{x && x.method === 'transfer' ? m(x.amount) : ''}</td>
                      <td className="num"><b>{x ? m(x.amount) : ''}</b></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr><td colSpan={3}>รวมทั้งสิ้น{pages.length > 1 ? ' (แผ่นนี้)' : ''}</td><td className="num">{cnt(rows, 'cash')}</td><td className="num">{m(sum(rows, 'cash'))}</td><td className="num">{cnt(rows, 'transfer')}</td><td className="num">{m(sum(rows, 'transfer'))}</td><td className="num">{m(sum(rows, 'cash') + sum(rows, 'transfer'))}</td></tr></tfoot>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 'auto' }}>
              <div>รวมจากตู้ถวาย {m(sum(rows, 'cash'))} บาท<br />รวมจากการโอน {m(sum(rows, 'transfer'))} บาท{pages.length > 1 && pi === pages.length - 1 ? <><br />ยอดรวมทุกแผ่น {m(sum(all, 'cash') + sum(all, 'transfer'))} บาท</> : null}</div>
              <div>ลงชื่อผู้ตรวจนับ 1 ................................................<br />ลงชื่อผู้ตรวจนับ 2 ................................................</div>
            </div>
          </>
        </ScaledPage>
      ))}
      <div className="row no-print" style={{ margin: '0.4rem 0' }}>
        <button type="button" className="btn btn--ghost" onClick={() => void downloadSheetPdf(refs.current.filter((e): e is HTMLDivElement => !!e), 'offering-sheet.pdf', 'landscape')}>⬇️ {DOWNLOAD_NOTE} (A4 แนวนอน)</button>
      </div>
    </div>
  )
}

/** ใบเบิก - จ่ายเงินสด เต็มแผ่น A4 ขนาดจริง 25 แถวล็อกไว้ — รายการที่บันทึกเติมทีละแถว เกิน 25 แถวขึ้นแผ่นถัดไป */
export function VoucherPaper({ church, entries, sunday }: { church: string; entries: ExpenseEntry[]; sunday?: string }) {
  const ROWS = 25
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const all = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const pages = chunk(all, ROWS)
  const heading = sunday ? weekHeading(sunday).replace('ประจำวันอาทิตย์', 'ประจำสัปดาห์ · วันอาทิตย์') : 'รวมทุกสัปดาห์'
  const sumOf = (xs: ExpenseEntry[]) => xs.reduce((s, x) => s + x.amount, 0)
  return (
    <div>
      {pages.map((rows, pi) => (
        <ScaledPage key={pi} ref={(el) => { refs.current[pi] = el }}>
          <>
            <PaperHead church={church} title="ใบเบิก - จ่ายเงินสด" sub={`${heading}${pages.length > 1 ? ` · แผ่นที่ ${pi + 1}/${pages.length}` : ''}`} />
            <table className="sheetpaper sheetpaper--full" aria-label="ใบเบิก-จ่ายเงินสด (A4)">
              <colgroup><col style={{ width: '11%' }} /><col style={{ width: '7%' }} /><col style={{ width: '33%' }} /><col style={{ width: '14%' }} /><col style={{ width: '17%' }} /><col style={{ width: '18%' }} /></colgroup>
              <thead><tr><th>วันที่</th><th>ลำดับที่</th><th>รายการ</th><th>จำนวนเงิน</th><th>ผู้เบิกเงิน</th><th>ผู้รับเงิน</th></tr></thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => {
                  const x = rows[i]
                  return (
                    <tr key={i}>
                      <td>{x ? fmtDate(x.date) : ''}</td>
                      <td style={{ textAlign: 'center' }}>{pi * ROWS + i + 1}</td>
                      <td>{x?.desc ?? ''}</td>
                      <td className="num">{x ? m(x.amount) : ''}</td>
                      <td>{x?.requester ?? ''}</td>
                      <td>{x?.who ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr><td colSpan={3} style={{ textAlign: 'center' }}>รวมจ่ายเป็นเงินทั้งสิ้น{pages.length > 1 ? ' (แผ่นนี้)' : ''}</td><td className="num">{m(sumOf(rows))}</td><td colSpan={2}>บาท{pages.length > 1 && pi === pages.length - 1 ? ` · รวมทุกแผ่น ${m(sumOf(all))}` : ''}</td></tr></tfoot>
            </table>
            <div style={{ display: 'flex', gap: 18, marginTop: 'auto', fontSize: 13 }}>
              <div style={{ flex: 1, border: '1px solid #1a2b4c', padding: 8 }}><b>ผู้อนุมัติ / ตรวจสอบ</b><br /><br />ลงชื่อ.................................................<br />(.................................................)<br />วันที่........../........../..........</div>
              <div style={{ flex: 1, border: '1px solid #1a2b4c', padding: 8 }}><b>ผู้จ่าย / ฝ่ายบัญชี</b><br /><br />ลงชื่อ.................................................<br />(.................................................)<br />วันที่........../........../..........</div>
            </div>
          </>
        </ScaledPage>
      ))}
      <div className="row no-print" style={{ margin: '0.4rem 0' }}>
        <button type="button" className="btn btn--ghost" onClick={() => void downloadSheetPdf(refs.current.filter((e): e is HTMLDivElement => !!e), 'cash-voucher.pdf', 'full')}>⬇️ {DOWNLOAD_NOTE} (A4)</button>
      </div>
    </div>
  )
}
