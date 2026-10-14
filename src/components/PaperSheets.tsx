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
export function IncomeSheetPaper({ church, entries, types, sunday, onRowClick }: { church: string; entries: IncomeEntry[]; types: IncomeType[]; sunday?: string; /** แตะแถวเพื่อแก้ไข (แถวว่าง = เพิ่มใหม่) */ onRowClick?: (x: IncomeEntry | null) => void }) {
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
                    <tr key={i} className={onRowClick ? 'sheetrow' : undefined} onClick={onRowClick ? (e) => { e.stopPropagation(); onRowClick(x ?? null) } : undefined}>
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
      <DownloadRow kind="offering" church={church} sunday={sunday} onData={() => void downloadSheetPdf(refs.current.filter((e): e is HTMLDivElement => !!e), 'offering-sheet.pdf', 'landscape')} />
    </div>
  )
}

/** ใบเบิก - จ่ายเงินสด เต็มแผ่น A4 ขนาดจริง 25 แถวล็อกไว้ — รายการที่บันทึกเติมทีละแถว เกิน 25 แถวขึ้นแผ่นถัดไป */
export function VoucherPaper({ church, entries, sunday, onRowClick, summary }: { church: string; entries: ExpenseEntry[]; sunday?: string; /** สรุปประจำสัปดาห์ 3 กรอบใต้ตาราง (เงินหมุนเวียนเท่านั้น ไม่รวมกองทุน) — ไม่ใส่ = ใบเปล่า ช่องว่างไว้เขียนมือ */ summary?: WeekSummary; /** แตะแถวเพื่อแก้ไข (แถวว่าง = เพิ่มใหม่) */ onRowClick?: (x: ExpenseEntry | null) => void }) {
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
              <colgroup><col style={{ width: '11%' }} /><col style={{ width: '5%' }} /><col style={{ width: '27%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /></colgroup>
              <thead><tr><th>วันที่</th><th>ลำดับที่</th><th>รายการ</th><th>จำนวนเงิน</th><th>หมายเหตุ / รูป</th><th>รอจ่าย</th><th>ผู้รับเงิน</th></tr></thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => {
                  const x = rows[i]
                  return (
                    <tr key={i} className={onRowClick ? 'sheetrow' : undefined} onClick={onRowClick ? (e) => { e.stopPropagation(); onRowClick(x ?? null) } : undefined}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{x ? fmtDate(x.date) : ''}</td>
                      <td style={{ textAlign: 'center' }}>{pi * ROWS + i + 1}</td>
                      <td>{x?.desc ?? ''}</td>
                      <td className="num" style={{ fontSize: 11.5 }}>{x ? m(x.amount) : ''}</td>
                      <td style={{ fontSize: 11 }}>{x ? [x.requester || x.note, x.file ? '📎 มีรูป' : ''].filter(Boolean).join(' ') : ''}</td>
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
          </>
        </ScaledPage>
      ))}
      <DownloadRow kind="voucher" church={church} sunday={sunday} onData={() => void downloadSheetPdf(refs.current.filter((e): e is HTMLDivElement => !!e), 'cash-voucher.pdf', 'full')} />
    </div>
  )
}

/** หน้าสรุปรายสัปดาห์ (สีขาวเหมือนใบในแท็บรับ/จ่าย): ใบที่ 1 = รายรับ เรียงตามประเภท · A4 แนวนอน · เติมแถวว่างให้ครบ 20 แถว */
export function IncomeSummaryPaper({ church, rows, heading, pagesRef, note }: { church: string; rows: LRow[]; heading: string; pagesRef: MutableRefObject<HTMLDivElement[]>; /** หมายเหตุท้ายตาราง (เช่น เงินถวายกองทุนที่แยกไว้) */ note?: string }) {
  const ROWS = 20
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
              <thead><tr><th>No.</th><th>ประเภท</th><th>จำนวนซอง</th><th>จำนวนเงิน</th><th>จำนวนโอน</th><th>จำนวนเงิน</th><th>รวม</th></tr></thead>
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
export function ExpenseSummaryPaper({ church, rows, heading, pagesRef, children }: { church: string; rows: LRow[]; heading: string; pagesRef: MutableRefObject<HTMLDivElement[]>; children?: ReactNode }) {
  const ROWS = 14
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
  pending: { name: string; amount: number }[]
  out: { cash: number; transfer: number; pending: number }
  /** เงินหมุนเวียนคงเหลือ ณ วันที่ asOf (ไม่รวมกองทุน) */
  balance: number; asOf: string
}

/** 3 กรอบใต้ตารางใบเบิก-จ่าย: 1 สรุปรับประจำสัปดาห์ · 2 สรุปจ่ายประจำสัปดาห์ · 3 สรุปยอดเงินในบัญชีทั้งสิ้น (เงินหมุนเวียน) */
function WeekSummaryBoxes({ summary }: { summary?: WeekSummary }) {
  const dots = '..............'
  const v = (x: number | undefined) => (x === undefined ? dots : m(x))
  const row = (label: string, val: string, bold?: boolean, key?: string) => <div key={key ?? label} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontWeight: bold ? 700 : 400 }}><span>{label}</span><span className="num">{val}</span></div>
  const fundSum = summary ? summary.funds.reduce((a, f) => a + f.amount, 0) : undefined
  const circIn = summary ? summary.inn.cash + summary.inn.transfer : undefined
  const circOut = summary ? summary.out.cash + summary.out.transfer + summary.out.pending : undefined
  const withdraw = summary ? fundSum! + summary.pending.reduce((a, b) => a + b.amount, 0) : undefined
  const inTotal = summary ? circIn! + fundSum! : undefined
  const outTotal = summary ? circOut! + fundSum! : undefined
  const box: React.CSSProperties = { flex: 1, border: '1.5px solid #1a2b4c', borderRadius: 4, padding: '8px 10px', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }
  const head: React.CSSProperties = { fontWeight: 700, borderBottom: '1px solid #1a2b4c', paddingBottom: 3, marginBottom: 2 }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, margin: '8px 0' }}>
      <div style={{ display: 'flex', gap: 10, width: '100%' }} aria-label="สรุปประจำสัปดาห์">
        <div style={box}><div style={head}>① สรุปรับประจำสัปดาห์</div>{row('เงินหมุนเวียน', v(circIn), true)}{summary?.funds.map((f) => row(`กองทุน · ${f.name}`, m(f.amount)))}{summary && summary.funds.length === 0 && row('กองทุน', m(0))}{row('รวมรับทั้งสิ้น', v(inTotal), true)}</div>
        <div style={box}><div style={head}>② สรุปจ่ายประจำสัปดาห์</div>{row('รายจ่ายหมุนเวียน', v(circOut), true)}{row('  ค้างจ่าย (ยังไม่ออกเงิน)', v(summary?.out.pending))}{summary?.funds.map((f) => row(`กองทุน · ${f.name}`, m(f.amount)))}{summary && summary.funds.length === 0 && row('กองทุน', m(0))}{row('รวมจ่ายทั้งสิ้น', v(outTotal), true)}</div>
        <div style={box}><div style={head}>③ สรุปยอดเงินในบัญชีทั้งสิ้น</div><div style={{ fontSize: 11, color: '#444' }}>เงินหมุนเวียน (ไม่รวมกองทุน){summary ? ` ณ ${fmtDate(summary.asOf)}` : ''}</div>{row('คงเหลือ', v(summary?.balance), true)}</div>
      </div>
      <div style={{ ...box, flex: 'none' }} aria-label="จำนวนที่ต้องเบิก">
        <div style={head}>จำนวนที่ต้องเบิก <span style={{ fontWeight: 400, fontSize: 11 }}>(กองทุน + รายการรอจ่าย — เตรียมเบิกที่ธนาคาร)</span></div>
        {summary?.funds.map((f) => row(`กองทุน · ${f.name}`, m(f.amount)))}
        {summary?.pending.map((b, i) => row(`รอจ่าย · ${b.name}`, m(b.amount), false, `p${i}`))}
        {row('รวมที่ต้องเบิก', v(withdraw), true)}
      </div>
    </div>
  )
}
