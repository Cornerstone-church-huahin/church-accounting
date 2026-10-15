import { useRef, type MutableRefObject, type ReactNode } from 'react'
import { addDays, be, fmtBaht, fmtDate, monthName, monthShort } from '../lib/money'
import { downloadSheetPdf } from '../lib/pdf'
import type { ExpenseEntry, IncomeEntry, IncomeType } from '../lib/types'
import type { LRow } from '../lib/weekLedger'
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

/** ปุ่มดาวน์โหลดใต้ใบ: ไฟล์เปล่า (ไว้จดมือ) + ไฟล์ข้อมูล (พิมพ์ เซ็นกำกับ เก็บเข้าแฟ้ม) — A4 ขนาดจริงทั้งคู่ */
function DownloadRow({ onData, kind, church, sunday }: { onData: () => void; kind: 'offering' | 'voucher'; church: string; sunday?: string }) {
  return (
    <div className="row no-print dlrow" style={{ margin: '0.4rem 0' }}>
      <button type="button" className="btn btn--ghost grow" onClick={() => void import('../lib/blankSheet').then((m) => m.downloadBlankSheet(kind, church, sunday))}>⬇️ ดาวน์โหลด PDF ไฟล์เปล่า</button>
      <button type="button" className="btn btn--gold grow" onClick={onData}>⬇️ ดาวน์โหลด PDF ข้อมูล</button>
    </div>
  )
}

/** ใบบันทึกการถวาย เต็มแผ่น A4 แนวนอน (297 × 210 มม. ขนาดจริง) 20 แถวล็อกไว้ — รายการที่บันทึกเติมทีละแถว เกิน 20 แถวขึ้นแผ่นถัดไป */
export function IncomeSheetPaper({ church, entries, types, sunday, onRowClick, scope }: { church: string; /** หน้ากองทุน: ชื่อกองทุน — ขึ้นหัวใบ */ scope?: string; entries: IncomeEntry[]; types: IncomeType[]; sunday?: string; /** แตะแถวเพื่อแก้ไข (แถวว่าง = เพิ่มใหม่) */ onRowClick?: (x: IncomeEntry | null) => void }) {
  const ROWS = 20
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const all = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const pages = chunk(all, ROWS)
  const name = (id: string) => types.find((t) => t.id === id)?.name ?? (id === '' ? 'โอน (ยังไม่แยกรายการ)' : '(รายการที่ถูกลบ)')
  const sum = (xs: IncomeEntry[], k: 'cash' | 'transfer') => xs.filter((x) => x.method === k).reduce((s, x) => s + x.amount, 0)
  const cnt = (xs: IncomeEntry[], k: 'cash' | 'transfer') => xs.filter((x) => x.method === k).reduce((s, x) => s + (x.count ?? 1), 0)
  const heading = (scope ? `${scope} · ` : '') + (sunday ? weekHeading(sunday) : 'รวมทุกสัปดาห์')
  return (
    <div>
      {pages.map((rows, pi) => (
        <ScaledPage key={pi} landscape className="a4page a4page--sheet" ref={(el) => { refs.current[pi] = el }}>
          <>
            <PaperHead church={church} title="ใบบันทึกการถวาย" sub={`${heading}${pages.length > 1 ? ` · แผ่นที่ ${pi + 1}/${pages.length}` : ''}`} compact />
            <table className="sheetpaper sheetpaper--land" aria-label="ใบบันทึกการถวาย (A4 แนวนอน)">
              <colgroup><col style={{ width: '9%' }} /><col style={{ width: '5%' }} /><col style={{ width: '29%' }} /><col style={{ width: '9%' }} /><col style={{ width: '12%' }} /><col style={{ width: '9%' }} /><col style={{ width: '12%' }} /><col style={{ width: '15%' }} /></colgroup>
              <thead><tr><th>วันที่</th><th>No.</th><th>รายการ</th><th>จำนวนซอง</th><th>จำนวนเงิน</th><th>จำนวนโอน</th><th>จำนวนเงิน</th><th>รวม</th></tr></thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => {
                  const x = rows[i]
                  return (
                    <tr key={i} className={onRowClick ? 'sheetrow' : undefined} onClick={onRowClick ? (e) => { e.stopPropagation(); onRowClick(x ?? null) } : undefined}>
                      <td>{x ? fmtDate(x.date) : ''}</td>
                      <td>{pi * ROWS + i + 1}.</td>
                      <td>{x ? name(x.typeId) + (scope && x.note ? ` · ${x.note}` : '') : ''}</td>
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
      <DownloadRow kind="offering" church={church} sunday={sunday} onData={() => void downloadSheetPdf(refs.current.filter((e): e is HTMLDivElement => !!e), 'offering-sheet.pdf', 'landscape')} />
    </div>
  )
}

/** ใบเบิก - จ่ายเงินสด เต็มแผ่น A4 ขนาดจริง 25 แถวล็อกไว้ — รายการที่บันทึกเติมทีละแถว เกิน 25 แถวขึ้นแผ่นถัดไป */
export function VoucherPaper({ church, entries, sunday, onRowClick, onFileClick, summary, scope }: { church: string; entries: ExpenseEntry[]; sunday?: string; /** สรุปประจำสัปดาห์ 3 กรอบใต้ตาราง (เงินหมุนเวียนเท่านั้น ไม่รวมกองทุน) — ไม่ใส่ = ใบเปล่า ช่องว่างไว้เขียนมือ */ summary?: WeekSummary; /** แตะแถวเพื่อแก้ไข (แถวว่าง = เพิ่มใหม่) */ onRowClick?: (x: ExpenseEntry | null) => void; /** แตะ 📎 ในช่องหมายเหตุ = เปิดดูรูปบิล/สลิปเต็มจอ */ onFileClick?: (x: ExpenseEntry) => void; /** หน้ากองทุน: ชื่อกองทุน — ขึ้นหัวใบ */ scope?: string }) {
  const ROWS = 25
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const all = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const pages = chunk(all, ROWS)
  const heading = (scope ? `${scope} · ` : '') + (sunday ? weekHeading(sunday).replace('ประจำวันอาทิตย์', 'ประจำสัปดาห์ · วันอาทิตย์') : 'รวมทุกสัปดาห์')
  const sumOf = (xs: ExpenseEntry[]) => xs.reduce((s, x) => s + x.amount, 0)
  return (
    <div>
      {pages.map((rows, pi) => (
        <ScaledPage key={pi} ref={(el) => { refs.current[pi] = el }}>
          <>
            <PaperHead church={church} title="ใบเบิก - จ่ายเงินสด" sub={`${heading}${pages.length > 1 ? ` · แผ่นที่ ${pi + 1}/${pages.length}` : ''}`} />
            <table className="sheetpaper sheetpaper--full" aria-label="ใบเบิก-จ่ายเงินสด (A4)">
              <colgroup><col style={{ width: '11%' }} /><col style={{ width: '5%' }} /><col style={{ width: '27%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /></colgroup>
              <thead><tr><th>วันที่</th><th>ลำดับที่</th><th>รายการ</th><th>จำนวนเงิน</th><th>หมายเหตุ / รูป</th><th>ผู้วางบิล</th><th>ผู้รับเงิน</th></tr></thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => {
                  const x = rows[i]
                  return (
                    <tr key={i} className={onRowClick ? 'sheetrow' : undefined} onClick={onRowClick ? (e) => { e.stopPropagation(); onRowClick(x ?? null) } : undefined}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{x ? fmtDate(x.date) : ''}</td>
                      <td style={{ textAlign: 'center' }}>{pi * ROWS + i + 1}</td>
                      <td>{x?.desc ?? ''}</td>
                      <td className="num" style={{ fontSize: 11.5 }}>{x ? m(x.amount) : ''}</td>
                      <td style={{ fontSize: 11, ...(x?.file && onFileClick ? { cursor: 'pointer' } : {}) }} onClick={x?.file && onFileClick ? (e) => { e.stopPropagation(); onFileClick(x) } : undefined} role={x?.file && onFileClick ? 'button' : undefined} aria-label={x?.file && onFileClick ? 'ดูรูปแนบ' : undefined} tabIndex={x?.file && onFileClick ? 0 : undefined} onKeyDown={x?.file && onFileClick ? (e) => { if (e.key === 'Enter') { e.stopPropagation(); onFileClick(x) } } : undefined}>{x ? <>{x.requester || x.note || ''}{x.file && <span style={{ marginLeft: 3, textDecoration: onFileClick ? 'underline' : undefined, color: onFileClick ? '#1a5fb4' : undefined }}>📎 มีรูป</span>}</> : ''}</td>
                      <td>{x?.biller ?? ''}</td>
                      <td>{x?.who ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr><td colSpan={3} style={{ textAlign: 'center' }}>รวมจ่ายเป็นเงินทั้งสิ้น{pages.length > 1 ? ' (แผ่นนี้)' : ''}</td><td className="num">{m(sumOf(rows))}</td><td colSpan={3}>บาท{pages.length > 1 && pi === pages.length - 1 ? ` · รวมทุกแผ่น ${m(sumOf(all))}` : ''}</td></tr></tfoot>
            </table>
            {pi === pages.length - 1 && <WeekSummaryBoxes summary={summary} />}
            <div style={{ display: 'flex', gap: 18, marginTop: 'auto', fontSize: 13 }}>
              <div style={{ flex: 1, border: '1px solid #1a2b4c', padding: 8 }}><b>ผู้อนุมัติ / ตรวจสอบ</b><br /><br />ลงชื่อ.................................................<br />(.................................................)<br />วันที่........../........../..........</div>
              <div style={{ flex: 1, border: '1px solid #1a2b4c', padding: 8 }}><b>ผู้จ่าย / ฝ่ายบัญชี</b><br /><br />ลงชื่อ.................................................<br />(.................................................)<br />วันที่........../........../..........</div>
            </div>
            {pi === pages.length - 1 && <WithdrawNote summary={summary} />}
          </>
        </ScaledPage>
      ))}
      <DownloadRow kind="voucher" church={church} sunday={sunday} onData={() => void downloadSheetPdf(refs.current.filter((e): e is HTMLDivElement => !!e), 'cash-voucher.pdf', 'full')} />
    </div>
  )
}

/** หน้าสรุปรายสัปดาห์ (สีขาวเหมือนใบในแท็บรับ/จ่าย): ใบที่ 1 = รายรับ เรียงตามประเภท · A4 แนวนอน · เติมแถวว่างให้ครบ 20 แถว */
export function IncomeSummaryPaper({ church, rows, heading, pagesRef, note, fundRows = [] }: { church: string; rows: LRow[]; /** เงินถวายกองทุนของช่วงนี้ — แสดงแยกใต้ตารางเงินหมุนเวียน (ไม่รวมในยอดหมุนเวียน) */ fundRows?: LRow[]; heading: string; pagesRef: MutableRefObject<HTMLDivElement[]>; /** หมายเหตุท้ายตาราง (เช่น เงินถวายกองทุนที่แยกไว้) */ note?: string }) {
  const ROWS = 20 - (fundRows.length > 0 ? Math.min(fundRows.length + 2, 7) : 0)
  const pages = chunk(rows, ROWS)
  pagesRef.current = []
  const sum = (xs: LRow[], f: (r: LRow) => number) => xs.reduce((a, r) => a + f(r), 0)
  const cash = (xs: LRow[]) => sum(xs, (r) => r.cash.amt), tr = (xs: LRow[]) => sum(xs, (r) => r.transfer.amt)
  return (
    <>
      {pages.map((rs, pi) => (
        <ScaledPage key={pi} landscape className="a4page a4page--sheet" ref={(el) => { if (el) pagesRef.current[pi] = el }}>
          <>
            <PaperHead church={church} title="ใบบันทึกการถวาย" sub={`${heading}${pages.length > 1 ? ` · แผ่นที่ ${pi + 1}/${pages.length}` : ''}`} compact />
            <table className="sheetpaper sheetpaper--land" aria-label="สรุปรายรับ (ใบบันทึกการถวาย)">
              <colgroup><col style={{ width: '6%' }} /><col style={{ width: '34%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} /></colgroup>
              <thead><tr><th>No.</th><th>รายการ</th><th>จำนวนซอง</th><th>จำนวนเงิน</th><th>จำนวนโอน</th><th>จำนวนเงิน</th><th>รวม</th></tr></thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => {
                  const r = rs[i]
                  return (
                    <tr key={i}>
                      <td>{pi * ROWS + i + 1}.</td><td>{r?.label ?? ''}</td>
                      <td className="num">{r?.cash.n || ''}</td><td className="num">{r?.cash.amt ? m(r.cash.amt) : ''}</td>
                      <td className="num">{r?.transfer.n || ''}</td><td className="num">{r?.transfer.amt ? m(r.transfer.amt) : ''}</td>
                      <td className="num"><b>{r && r.cash.amt + r.transfer.amt ? m(r.cash.amt + r.transfer.amt) : ''}</b></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr><td colSpan={2}>รวมทั้งสิ้น{pages.length > 1 ? ' (แผ่นนี้)' : ''}</td><td className="num">{sum(rs, (r) => r.cash.n)}</td><td className="num">{m(cash(rs))}</td><td className="num">{sum(rs, (r) => r.transfer.n)}</td><td className="num">{m(tr(rs))}</td><td className="num">{m(cash(rs) + tr(rs))}</td></tr></tfoot>
            </table>
            {pi === pages.length - 1 && fundRows.length > 0 && (
              <table className="sheetpaper sheetpaper--land" style={{ marginTop: 6 }} aria-label="เงินถวายกองทุน (แยกจากเงินหมุนเวียน)">
                <thead><tr><th colSpan={7} style={{ textAlign: 'left' }}>เงินถวายกองทุน (แยกจากเงินหมุนเวียน — ไม่รวมในยอดข้างบน)</th></tr></thead>
                <tbody>{fundRows.map((r) => <tr key={r.key}><td style={{ width: '40%' }}>{r.label}</td><td className="num">{r.cash.n || ''}</td><td className="num">{r.cash.amt ? m(r.cash.amt) : ''}</td><td className="num">{r.transfer.n || ''}</td><td className="num">{r.transfer.amt ? m(r.transfer.amt) : ''}</td><td className="num"><b>{m(r.cash.amt + r.transfer.amt)}</b></td></tr>)}</tbody>
                <tfoot><tr><td>รวมกองทุน</td><td className="num">{sum(fundRows, (r) => r.cash.n)}</td><td className="num">{m(cash(fundRows))}</td><td className="num">{sum(fundRows, (r) => r.transfer.n)}</td><td className="num">{m(tr(fundRows))}</td><td className="num">{m(cash(fundRows) + tr(fundRows))}</td></tr></tfoot>
              </table>
            )}
            {note && pi === pages.length - 1 && <p style={{ margin: '4px 0 0', fontSize: 12.5 }}>{note}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 'auto' }}>
              <div>รวมจากตู้ถวาย {m(cash(rs))} บาท<br />รวมจากการโอน {m(tr(rs))} บาท{pages.length > 1 && pi === pages.length - 1 ? <><br />ยอดรวมทุกแผ่น {m(cash(rows) + tr(rows))} บาท</> : null}</div>
              <div>ลงชื่อผู้ตรวจนับ 1 ................................................<br />ลงชื่อผู้ตรวจนับ 2 ................................................</div>
            </div>
          </>
        </ScaledPage>
      ))}
    </>
  )
}

/** ใบที่ 2 = รายจ่ายตามหมวด + สรุปปิดยอดสัปดาห์ (children = ส่วนสรุปท้ายใบ แสดงในแผ่นสุดท้าย) · A4 แนวตั้ง */
export function ExpenseSummaryPaper({ church, rows, heading, pagesRef, children, fundRows = [] }: { church: string; rows: LRow[]; /** เงินกองทุนที่เข้ามาในช่วงนี้ = รายจ่ายโอนออกเข้ากองทุนเท่ากัน (ชื่อเดียวกัน) แสดงแยกใต้ตาราง */ fundRows?: LRow[]; heading: string; pagesRef: MutableRefObject<HTMLDivElement[]>; children?: ReactNode }) {
  const ROWS = 14 - (fundRows.length > 0 ? Math.min(fundRows.length + 2, 5) : 0)
  const pages = chunk(rows, ROWS)
  pagesRef.current = []
  const tot = (r: LRow) => r.cash.amt + r.transfer.amt + (r.pending?.amt ?? 0)
  const sum = (xs: LRow[], f: (r: LRow) => number) => xs.reduce((a, r) => a + f(r), 0)
  return (
    <>
      {pages.map((rs, pi) => (
        <ScaledPage key={pi} ref={(el) => { if (el) pagesRef.current[pi] = el }}>
          <>
            <PaperHead church={church} title="ใบเบิก - จ่ายเงินสด (สรุปรายจ่าย)" sub={`${heading}${pages.length > 1 ? ` · แผ่นที่ ${pi + 1}/${pages.length}` : ''}`} />
            <table className="sheetpaper sheetpaper--full" aria-label="สรุปรายจ่าย (ใบเบิก-จ่ายเงินสด)">
              <colgroup><col style={{ width: '7%' }} /><col style={{ width: '31%' }} /><col style={{ width: '9%' }} /><col style={{ width: '15%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} /></colgroup>
              <thead><tr><th>ลำดับที่</th><th>หมวดรายจ่าย</th><th>รายการ</th><th>จ่ายเงินสด</th><th>จ่ายโอน</th><th>ค้างจ่าย</th><th>รวม</th></tr></thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => {
                  const r = rs[i]
                  return (
                    <tr key={i}>
                      <td style={{ textAlign: 'center' }}>{pi * ROWS + i + 1}</td><td>{r?.label ?? ''}</td>
                      <td className="num">{r ? r.cash.n + r.transfer.n + (r.pending?.n ?? 0) || '' : ''}</td>
                      <td className="num">{r?.cash.amt ? m(r.cash.amt) : ''}</td><td className="num">{r?.transfer.amt ? m(r.transfer.amt) : ''}</td><td className="num">{r?.pending?.amt ? m(r.pending.amt) : ''}</td>
                      <td className="num"><b>{r && tot(r) ? m(tot(r)) : ''}</b></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr><td colSpan={2} style={{ textAlign: 'center' }}>รวมจ่ายเป็นเงินทั้งสิ้น{pages.length > 1 ? ' (แผ่นนี้)' : ''}</td><td className="num">{sum(rs, (r) => r.cash.n + r.transfer.n + (r.pending?.n ?? 0))}</td><td className="num">{m(sum(rs, (r) => r.cash.amt))}</td><td className="num">{m(sum(rs, (r) => r.transfer.amt))}</td><td className="num">{m(sum(rs, (r) => r.pending?.amt ?? 0))}</td><td className="num">{m(sum(rs, tot))}</td></tr></tfoot>
            </table>
            {pi === pages.length - 1 && fundRows.length > 0 && (
              <table className="sheetpaper" style={{ marginTop: 6, width: '100%' }} aria-label="รายจ่ายกองทุน (โอนออกเข้ากองทุน)">
                <thead><tr><th colSpan={3} style={{ textAlign: 'left' }}>รายจ่ายกองทุน (โอนออกเข้ากองทุน — แยกจากเงินหมุนเวียน)</th></tr></thead>
                <tbody>{fundRows.map((r) => <tr key={r.key}><td>{r.label}</td><td>เข้ากองทุน · รอเบิก</td><td className="num"><b>{m(r.cash.amt + r.transfer.amt)}</b></td></tr>)}</tbody>
                <tfoot><tr><td colSpan={2}>รวมโอนออกเข้ากองทุน</td><td className="num">{m(sum(fundRows, (r) => r.cash.amt + r.transfer.amt))}</td></tr></tfoot>
              </table>
            )}
            {pi === pages.length - 1 && children}
          </>
        </ScaledPage>
      ))}
    </>
  )
}

export interface WeekSummary {
  inn: { cash: number; transfer: number }
  /** เงินเข้ากองทุนในสัปดาห์ (แยกจากเงินหมุนเวียน) — แต่ละกองทุนมีรายจ่ายโอนออกเท่ากันในตารางทันที */
  funds: { name: string; amount: number }[]
  /** บิลที่วางไว้/สำรองจ่ายที่ยังรอจ่ายในสัปดาห์นี้ — รวมกับกองทุนเป็น "จำนวนที่ต้องเบิก" */
  pending: { desc: string; person: string; kind: 'bill' | 'advance' | 'manual'; amount: number }[]
  out: { cash: number; transfer: number; pending: number }
  /** เงินหมุนเวียนคงเหลือ ณ วันที่ asOf (ไม่รวมกองทุน) */
  balance: number; asOf: string
  /** ผลสุทธิ (รับ − จ่าย) เงินหมุนเวียนล้วน ไม่รวมกองทุน: สัปดาห์นี้ · เดือนนี้ · ปีนี้ */
  net: { week: number; month: number; year: number }
  /** หน้ากองทุน: ชื่อกองทุน — กรอบสรุปเป็นของกองทุนนี้ล้วน (ไม่มีแถวหมุนเวียน/กองทุน) */
  scopeName?: string
}

/** 3 กรอบใต้ตารางใบเบิก-จ่าย: 1 สรุปรับประจำสัปดาห์ · 2 สรุปจ่ายประจำสัปดาห์ · 3 สรุปยอดเงินในบัญชีทั้งสิ้น (เงินหมุนเวียน) */
function WeekSummaryBoxes({ summary }: { summary?: WeekSummary }) {
  const dots = '..............'
  const v = (x: number | undefined) => (x === undefined ? dots : m(x))
  const row = (label: string, val: string, bold?: boolean, key?: string) => <div key={key ?? label} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontWeight: bold ? 700 : 400 }}><span>{label}</span><span className="num">{val}</span></div>
  const fundSum = summary ? summary.funds.reduce((a, f) => a + f.amount, 0) : undefined
  const circIn = summary ? summary.inn.cash + summary.inn.transfer : undefined
  const circOut = summary ? summary.out.cash + summary.out.transfer + summary.out.pending : undefined
  const inTotal = summary ? circIn! + fundSum! : undefined
  const outTotal = summary ? circOut! + fundSum! : undefined
  const box: React.CSSProperties = { flex: 1, border: '1.5px solid #1a2b4c', borderRadius: 4, padding: '8px 10px', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }
  const head: React.CSSProperties = { fontWeight: 700, borderBottom: '1px solid #1a2b4c', paddingBottom: 3, marginBottom: 2 }
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', margin: '8px 0' }}>
      <div style={{ display: 'flex', gap: 10, width: '100%' }} aria-label="สรุปประจำสัปดาห์">
        <div style={box}><div style={head}>① สรุปรับประจำสัปดาห์</div>{summary?.scopeName ? row(`เงินรับ ${summary.scopeName}`, v(circIn), true) : <>{row('เงินหมุนเวียน', v(circIn), true)}{summary?.funds.map((f) => row(`กองทุน · ${f.name}`, m(f.amount)))}{summary && summary.funds.length === 0 && row('กองทุน', m(0))}{row('รวมรับทั้งสิ้น', v(inTotal), true)}</>}</div>
        <div style={box}><div style={head}>② สรุปจ่ายประจำสัปดาห์</div>{summary?.scopeName ? row(`เงินจ่าย ${summary.scopeName}`, v(circOut), true) : <>{row('รายจ่ายหมุนเวียน', v(circOut), true)}{summary?.funds.map((f) => row(`กองทุน · ${f.name}`, m(f.amount)))}{summary && summary.funds.length === 0 && row('กองทุน', m(0))}{row('รวมจ่ายทั้งสิ้น', v(outTotal), true)}</>}</div>
        <div style={{ ...box, justifyContent: 'center' }} aria-label="ยอดเงินหมุนเวียน">{row(summary?.scopeName ? 'เงินกองทุนคงเหลือปัจจุบัน' : 'เงินหมุนเวียนทั้งหมดปัจจุบัน', v(summary?.balance), true)}{row('สรุปสัปดาห์นี้', v(summary?.net.week))}{row('สรุปเดือนนี้', v(summary?.net.month))}{row('สรุปปีนี้', v(summary?.net.year))}</div>
      </div>
    </div>
  )
}

/** หมายเหตุ · ต้องเบิก (ล่างสุดของใบ): ตาราง 4 คอลัมน์ ชื่อรายการ+จำนวนเงินอยู่ช่องเดียวกัน เรียงลงทีละคอลัมน์จนเต็มแล้วขึ้นคอลัมน์ถัดไป (กองทุนก่อน ตามด้วยรายการรอจ่าย — ไม่แยกประเภท) · ขั้นต่ำ 3 แถว เกินขยายแถวเอง */
function WithdrawNote({ summary }: { summary?: WeekSummary }) {
  const items = summary ? [...summary.funds.map((f) => ({ label: f.name, amt: f.amount })), ...summary.pending.map((b) => ({ label: [b.person, b.desc].filter(Boolean).join(' — '), amt: b.amount }))] : []
  const total = summary ? items.reduce((a, x) => a + x.amt, 0) : undefined
  const COLS = 4
  const rows = Math.max(3, Math.ceil(items.length / COLS))
  return (
    <table className="sheetpaper" style={{ marginTop: 8 }} aria-label="หมายเหตุ ต้องเบิก">
      <colgroup>{Array.from({ length: COLS }, (_, c) => <col key={c} style={{ width: `${100 / COLS}%` }} />)}</colgroup>
      <thead><tr><th colSpan={COLS} style={{ textAlign: 'left' }}>หมายเหตุ · ต้องเบิก</th></tr></thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r} style={{ height: 22 }}>
            {Array.from({ length: COLS }, (_, c) => {
              const x = items[c * rows + r]
              return <td key={c} style={{ whiteSpace: 'normal', wordBreak: 'break-word', height: 'auto', verticalAlign: 'top' }}>{x && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><span>{x.label}</span><span className="num" style={{ flex: 'none' }}>{m(x.amt)}</span></div>}</td>
            })}
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan={COLS} style={{ textAlign: 'right' }}>รวมต้องเบิก&nbsp;&nbsp;<span className="num">{total === undefined ? '..............' : m(total)}</span> บาท</td></tr></tfoot>
    </table>
  )
}
