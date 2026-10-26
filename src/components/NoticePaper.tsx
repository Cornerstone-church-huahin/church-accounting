import type { MutableRefObject } from 'react'
import { PaperHead, weekHeading } from './PaperSheets'
import ScaledPage from './ScaledPage'
import { fmtBaht, fmtDate } from '../lib/money'
import { isCompensation, maskNoticeOut } from '../lib/maskPay'
import { can } from '../lib/access'
import { useRole } from '../lib/members'
import type { Notice, NoticeExpense, NoticeLine } from '../lib/notice'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })
const blank = (x: number) => (x ? m(x) : '')

type Piece =
  | { t: 'inc'; title: string; note?: string; rows: NoticeLine[]; start: number; total?: { label: string; cash: number; tr: number; all: number; cn: number; tn: number } }
  | { t: 'out'; title: string; rows: NoticeExpense[]; start: number; total?: number; label?: string }
  | { t: 'sum' }

/** จัดแถวลงหน้า A4 (นับเป็น "ช่องแถว"): หน้าแรกมีหัวใบใหญ่ หน้าต่อไปหัวเล็ก · ตารางยาวเกินหน้าต่อหน้าถัดไปพร้อมหัวตารางซ้ำ */
function paginate(n: Notice): Piece[][] {
  const FIRST = 46, NEXT = 54
  const pages: Piece[][] = [[]]
  let used = 0, cap = FIRST
  const newPage = () => { pages.push([]); used = 0; cap = NEXT }
  const cur = () => pages[pages.length - 1]
  const section = <R,>(rows: R[], mk: (chunk: R[], start: number, last: boolean) => Piece) => {
    if (rows.length === 0) { if (cap - used < 5) newPage(); cur().push(mk([], 0, true)); used += 5; return }
    let start = 0
    while (start < rows.length) {
      const avail = cap - used - 3 // หัวข้อ + หัวตาราง + เว้นบรรทัด
      if (avail < 3) { newPage(); continue }
      const rest = rows.length - start
      if (rest + 1 <= avail) { cur().push(mk(rows.slice(start), start, true)); used += 3 + rest + 1; return }
      cur().push(mk(rows.slice(start, start + avail), start, false)); newPage(); start += avail
    }
  }
  const tot = (xs: NoticeLine[]) => ({ cash: xs.reduce((s, x) => s + x.cash, 0), tr: xs.reduce((s, x) => s + x.tr, 0), all: xs.reduce((s, x) => s + x.amt, 0), cn: xs.reduce((s, x) => s + x.cashN, 0), tn: xs.reduce((s, x) => s + x.trN, 0) })
  section(n.inc, (rows, start, last) => ({ t: 'inc', title: 'รายรับเงินหมุนเวียน', rows, start, ...(last ? { total: { label: 'รวมรายรับ', ...tot(n.inc) } } : {}) }))
  section(n.out, (rows, start, last) => ({ t: 'out', title: 'รายจ่ายเงินหมุนเวียน', rows, start, ...(last ? { total: n.totalOut } : {}) }))
  if (n.fund.length > 0) {
    section(n.fund, (rows, start, last) => ({ t: 'inc', title: 'รายรับเงินกองทุน', note: FUND_NOTE, rows, start, ...(last ? { total: { label: 'รวมเงินถวายกองทุน', ...tot(n.fund) } } : {}) }))
    const fundOut: NoticeExpense[] = n.fund.map((f) => ({ key: `fo:${f.key}`, date: '', desc: `${f.label} · เบิกแล้ว เตรียมนำฝาก`, amount: f.amt }))
    section(fundOut, (rows, start, last) => ({ t: 'out', title: 'รายจ่ายเงินกองทุน (เบิกพร้อมเงินหมุนเวียน เตรียมนำฝากเข้าบัญชีกองทุน)', rows, start, ...(last ? { total: n.totalFund, label: 'รวมเงินกองทุนที่เบิก' } : {}) }))
  }
  if (cap - used < 6) newPage()
  cur().push({ t: 'sum' })
  return pages
}

const FUND_NOTE = 'เงินส่วนกองทุน — แสดงเป็นรายงานให้ทราบเท่านั้น ไม่รวมกับเงินหมุนเวียน และไม่นำไปคำนวณรวมกับยอดรายรับ รายจ่าย หรือผลต่างของสัปดาห์นี้'
const th: React.CSSProperties = { fontSize: 13 }
function IncTable({ p }: { p: Extract<Piece, { t: 'inc' }> }) {
  return (
    <>
      <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0 2px' }}>{p.title}</div>
      {p.note && <div style={{ fontSize: 12.5, margin: '0 0 3px', fontStyle: 'italic' }}>{p.note}</div>}
      <table className="sheetpaper sheetpaper--full" aria-label={p.title}>
        <colgroup><col style={{ width: '6%' }} /><col style={{ width: '31%' }} /><col style={{ width: '10%' }} /><col style={{ width: '15%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /></colgroup>
        <thead><tr><th style={th}>ที่</th><th style={th}>รายการ</th><th style={th}>จำนวนซอง</th><th style={th}>จำนวนเงิน</th><th style={th}>จำนวนโอน</th><th style={th}>จำนวนเงิน</th><th style={th}>รวม</th></tr></thead>
        <tbody>
          {p.rows.length === 0 && <tr><td /><td colSpan={6}>— ไม่มีรายการ —</td></tr>}
          {p.rows.map((r, i) => (
            <tr key={r.key}><td style={{ textAlign: 'center' }}>{p.start + i + 1}</td><td>{r.label}</td><td className="num">{r.cashN || ''}</td><td className="num">{blank(r.cash)}</td><td className="num">{r.trN || ''}</td><td className="num">{blank(r.tr)}</td><td className="num"><b>{m(r.amt)}</b></td></tr>
          ))}
        </tbody>
        {p.total && <tfoot><tr><td colSpan={2}>{p.total.label}</td><td className="num">{p.total.cn || ''}</td><td className="num">{m(p.total.cash)}</td><td className="num">{p.total.tn || ''}</td><td className="num">{m(p.total.tr)}</td><td className="num">{m(p.total.all)}</td></tr></tfoot>}
      </table>
    </>
  )
}
function OutTable({ p, noNames }: { p: Extract<Piece, { t: 'out' }>; noNames?: boolean }) {
  return (
    <>
      <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0 2px' }}>{p.title}</div>
      <table className="sheetpaper sheetpaper--full" aria-label={p.title}>
        <colgroup><col style={{ width: '7%' }} /><col style={{ width: '16%' }} /><col style={{ width: '55%' }} /><col style={{ width: '22%' }} /></colgroup>
        <thead><tr><th style={th}>ที่</th><th style={th}>วันที่</th><th style={th}>รายการ</th><th style={th}>จำนวนเงิน</th></tr></thead>
        <tbody>
          {p.rows.length === 0 && <tr><td /><td /><td>— ไม่มีรายการ —</td><td /></tr>}
          {p.rows.map((r, i) => <tr key={r.key} data-comp={isCompensation(r) ? '1' : undefined} data-amt={r.amount}><td data-c="no" style={{ textAlign: 'center' }}>{p.start + i + 1}</td><td data-c="date" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r.date ? fmtDate(r.date) : ''}</td><td data-c="desc">{r.desc}{r.by && !noNames ? <span className="pname">{` (${r.by})`}</span> : ''}</td><td data-c="amt" className="num"><b>{m(r.amount)}</b></td></tr>)}
        </tbody>
        {p.total !== undefined && <tfoot><tr><td colSpan={3} style={{ textAlign: 'center' }}>{p.label ?? 'รวมรายจ่ายทั้งสิ้น'}</td><td className="num">{m(p.total)}</td></tr></tfoot>}
      </table>
    </>
  )
}

/** ใบสรุปรับ-จ่ายรายสัปดาห์สำหรับติดประกาศ — A4 แนวตั้งแบบเดียวกับใบ PDF (ขาว-ดำ พิมพ์ได้) · รายการจริงครบ เกินหน้าต่อแผ่นถัดไป */
/** variant: 'evidence' = ฉบับเก็บเป็นหลักฐาน (ชื่อ/เงินเดือนรายคนครบ ทั้งตอนพิมพ์/PDF) · 'public' = ฉบับติดประกาศ/แชร์สมาชิก (ไม่มีชื่อบุคคล เงินเดือนรวมแถวเดียว) · ไม่ระบุ = ตามสิทธิ์ผู้ใช้ */
export default function NoticePaper({ church, sunday, n: full, pagesRef, variant }: { church: string; sunday: string; n: Notice; pagesRef: MutableRefObject<HTMLDivElement[]>; variant?: 'evidence' | 'public' }) {
  const detail = can(useRole(), 'detail')
  const evidence = variant === 'evidence'
  const pub = variant === 'public'
  const n = evidence || (!pub && detail) ? full : { ...full, out: maskNoticeOut(full.out) } // ผู้นำ/สมาชิกเห็นเงินเดือนเป็นแถวรวม · แอดมิน/ผู้บันทึก/ผู้ตรวจเห็นรายคน
  const pages = paginate(n)
  pagesRef.current = []
  return (
    <div>
      {pages.map((pcs, pi) => (
        <ScaledPage key={pi} ref={(el) => { if (el) pagesRef.current[pi] = el }}>
          <div data-keep={evidence ? '1' : undefined} style={{ display: 'contents' }}>
            <PaperHead church={church} title="สรุปรายรับ - รายจ่ายประจำสัปดาห์" sub={`${weekHeading(sunday)}${pages.length > 1 ? ` · แผ่นที่ ${pi + 1}/${pages.length}` : ''}`} compact={pi > 0} />
            {pcs.map((p, i) => p.t === 'inc' ? <IncTable key={i} p={p} /> : p.t === 'out' ? <OutTable key={i} p={p} noNames={pub} /> : (
              <div key={i} style={{ border: '1px solid #1a2b4c', padding: '8px 12px', marginTop: 10, fontSize: 15, display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 16px' }}>
                <span>รวมรายรับเงินหมุนเวียน</span><span className="num">{m(n.totalInc)}</span>
                <span>หัก รวมรายจ่ายเงินหมุนเวียน</span><span className="num">{m(n.totalOut)}</span>
                <b style={{ fontSize: 17 }}>{n.net >= 0 ? 'รับมากกว่าจ่าย' : 'จ่ายมากกว่ารับ'}</b><b className="num" style={{ fontSize: 17 }}>{n.net < 0 ? '−' : ''}{m(Math.abs(n.net))} บาท</b>
                {n.totalFund > 0 && <><span className="small">เงินถวายกองทุน (รายงานให้ทราบ ไม่รวมในยอดข้างบน)</span><span className="num small">{m(n.totalFund)}</span></>}
              </div>
            ))}
          </div>
        </ScaledPage>
      ))}
    </div>
  )
}
