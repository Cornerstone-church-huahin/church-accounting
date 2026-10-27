import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
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
  | { t: 'inc'; title: string; note?: string; /** ตารางเงินกองทุน: เพิ่มช่องสถานะ (เก็บไว้ เตรียมนำฝาก) */ status?: string; rows: NoticeLine[]; start: number; total?: { label: string; cash: number; tr: number; all: number; cn: number; tn: number } }
  | { t: 'out'; title: string; rows: NoticeExpense[]; start: number; total?: number; label?: string }
  | { t: 'sum' }

/** ใบประกาศแผ่นเดียวเสมอ: ทุกตารางอยู่หน้าเดียวกัน (พี่น้องไม่สับสนว่าเป็นคนละส่วน) — ถ้าข้อมูลมากจะบีบความสูงแถวแล้วย่อทั้งใบให้พอดี (ดู FitBox) */
function piecesOf(n: Notice): Piece[] {
  const tot = (xs: NoticeLine[]) => ({ cash: xs.reduce((s, x) => s + x.cash, 0), tr: xs.reduce((s, x) => s + x.tr, 0), all: xs.reduce((s, x) => s + x.amt, 0), cn: xs.reduce((s, x) => s + x.cashN, 0), tn: xs.reduce((s, x) => s + x.trN, 0) })
  const out: Piece[] = [
    { t: 'inc', title: 'รายรับเงินหมุนเวียน', rows: n.inc, start: 0, total: { label: 'รวมรายรับ', ...tot(n.inc) } },
    { t: 'out', title: 'รายจ่ายเงินหมุนเวียน', rows: n.out, start: 0, total: n.totalOut },
  ]
  if (n.fund.length > 0) {
    out.push({ t: 'inc', title: 'เงินกองทุนที่รับสัปดาห์นี้', note: FUND_NOTE, status: 'เก็บไว้ เตรียมนำฝาก', rows: n.fund, start: 0, total: { label: 'รวมเงินถวายกองทุน · เตรียมนำฝากเข้าบัญชีกองทุน', ...tot(n.fund) } })
  }
  out.push({ t: 'sum' })
  return out
}

/** กล่องเนื้อหาที่ยืดถึงท้ายหน้า: ล้น → บีบแถว 2 ระดับ (fit--d1/d2) → ยังล้นก็ย่อทั้งก้อนให้พอดี (ต่ำสุด 35%) */
export function FitBox({ sig, children }: { sig: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null)
  const [d, setD] = useState(0), [k, setK] = useState(1)
  useEffect(() => { setD(0); setK(1) }, [sig])
  useLayoutEffect(() => {
    const b = box.current, i = inner.current
    if (!b || !i || i.offsetHeight <= b.clientHeight + 1) return
    if (d < 2) setD(d + 1)
    else { const nk = Math.max(0.35, Math.min(k, b.clientHeight / i.offsetHeight)); if (Math.abs(nk - k) > 0.002) setK(nk) }
  })
  return (
    <div ref={box} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div ref={inner} className={d ? `fit--d${d}` : undefined} style={k < 1 ? { transform: `scale(${k})`, transformOrigin: 'top left', width: `${100 / k}%` } : undefined}>{children}</div>
    </div>
  )
}

const FUND_NOTE = 'เงินส่วนกองทุน — แสดงเป็นรายงานให้ทราบเท่านั้น ไม่รวมกับเงินหมุนเวียน และไม่นำไปคำนวณรวมกับยอดรายรับ รายจ่าย หรือผลต่างของสัปดาห์นี้'
const th: React.CSSProperties = { fontSize: 13 }
/** จัดชิ้นเรียงกันในหน้าเดียวให้อยู่ในกรอบโซนเดียวกัน (หมุนเวียน / กองทุน) — sum อยู่นอกกรอบ · cont = โซนนี้ต่อจากหน้าก่อน */
function groupZones(pcs: Piece[]): { zone: 'circ' | 'fund' | 'sum'; pieces: Piece[]; cont: boolean }[] {
  const out: { zone: 'circ' | 'fund' | 'sum'; pieces: Piece[]; cont: boolean }[] = []
  for (const p of pcs) {
    const zone = p.t === 'sum' ? 'sum' : p.title.includes('กองทุน') ? 'fund' : 'circ'
    const last = out[out.length - 1]
    if (last && last.zone === zone && zone !== 'sum') last.pieces.push(p)
    else out.push({ zone, pieces: [p], cont: p.t !== 'sum' && p.start > 0 })
  }
  return out
}
function IncTable({ p }: { p: Extract<Piece, { t: 'inc' }> }) {
  return (
    <>
      <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0 2px' }}>{p.title}</div>
      {p.note && <div style={{ fontSize: 12.5, margin: '0 0 3px', fontStyle: 'italic' }}>{p.note}</div>}
      <table className="sheetpaper sheetpaper--full" aria-label={p.title}>
        <colgroup>{p.status ? <><col style={{ width: '5%' }} /><col style={{ width: '23%' }} /><col style={{ width: '9%' }} /><col style={{ width: '12%' }} /><col style={{ width: '9%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} /><col style={{ width: '18%' }} /></> : <><col style={{ width: '6%' }} /><col style={{ width: '31%' }} /><col style={{ width: '10%' }} /><col style={{ width: '15%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /></>}</colgroup>
        <thead><tr><th style={th}>ที่</th><th style={th}>รายการ</th><th style={th}>จำนวนซอง</th><th style={th}>จำนวนเงิน</th><th style={th}>จำนวนโอน</th><th style={th}>จำนวนเงิน</th><th style={th}>รวม</th>{p.status && <th style={th}>สถานะ</th>}</tr></thead>
        <tbody>
          {p.rows.length === 0 && <tr><td /><td colSpan={p.status ? 7 : 6}>— ไม่มีรายการ —</td></tr>}
          {p.rows.map((r, i) => (
            <tr key={r.key}><td style={{ textAlign: 'center' }}>{p.start + i + 1}</td><td>{r.label}</td><td className="num">{r.cashN || ''}</td><td className="num">{blank(r.cash)}</td><td className="num">{r.trN || ''}</td><td className="num">{blank(r.tr)}</td><td className="num"><b>{m(r.amt)}</b></td>{p.status && <td style={{ fontSize: 12 }}>{p.status}</td>}</tr>
          ))}
        </tbody>
        {p.total && <tfoot><tr><td colSpan={2}>{p.total.label}</td><td className="num">{p.total.cn || ''}</td><td className="num">{m(p.total.cash)}</td><td className="num">{p.total.tn || ''}</td><td className="num">{m(p.total.tr)}</td><td className="num">{m(p.total.all)}</td>{p.status && <td />}</tr></tfoot>}
      </table>
    </>
  )
}
function OutTable({ p, noNames }: { p: Extract<Piece, { t: 'out' }>; noNames?: boolean }) {
  return (
    <>
      <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0 2px' }}>{p.title}</div>
      <table className="sheetpaper sheetpaper--full" aria-label={p.title}>
        <colgroup>{noNames ? <><col style={{ width: '7%' }} /><col style={{ width: '16%' }} /><col style={{ width: '55%' }} /><col style={{ width: '22%' }} /></> : <><col style={{ width: '6%' }} /><col style={{ width: '14%' }} /><col style={{ width: '39%' }} /><col style={{ width: '20%' }} /><col style={{ width: '21%' }} /></>}</colgroup>
        <thead><tr><th style={th}>ที่</th><th style={th}>วันที่</th><th style={th}>รายการ</th>{!noNames && <th style={th}>ผู้วางบิล</th>}<th style={th}>จำนวนเงิน</th></tr></thead>
        <tbody>
          {p.rows.length === 0 && <tr><td /><td /><td>— ไม่มีรายการ —</td>{!noNames && <td />}<td /></tr>}
          {p.rows.map((r, i) => <tr key={r.key} data-comp={isCompensation(r) ? '1' : undefined} data-amt={r.amount}><td data-c="no" style={{ textAlign: 'center' }}>{p.start + i + 1}</td><td data-c="date" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r.date ? fmtDate(r.date) : ''}</td><td data-c="desc">{r.desc}</td>{!noNames && <td data-c="x" style={{ fontSize: 12 }}>{r.by ? <span className="pname">{r.by}</span> : ''}</td>}<td data-c="amt" className="num"><b>{m(r.amount)}</b></td></tr>)}
        </tbody>
        {p.total !== undefined && <tfoot><tr><td colSpan={noNames ? 3 : 4} style={{ textAlign: 'center' }}>{p.label ?? 'รวมรายจ่ายทั้งสิ้น'}</td><td className="num">{m(p.total)}</td></tr></tfoot>}
      </table>
    </>
  )
}

/** ใบสรุปรับ-จ่ายรายสัปดาห์สำหรับติดประกาศ — A4 แนวตั้งแบบเดียวกับใบ PDF (ขาว-ดำ พิมพ์ได้) · รายการจริงครบ เกินหน้าต่อแผ่นถัดไป */
/** variant: 'evidence' = ฉบับเก็บเป็นหลักฐาน (ชื่อ/เงินเดือนรายคนครบ ทั้งตอนพิมพ์/PDF) · 'public' = ฉบับติดประกาศ/แชร์สมาชิก (ไม่มีชื่อบุคคล เงินเดือนรวมแถวเดียว) · ไม่ระบุ = ตามสิทธิ์ผู้ใช้ */
/** รายงานเสนอที่ประชุม (ฉบับมีชื่อ): ใบสรุปเดียวกัน + เงินคริสตจักร ณ สิ้นสัปดาห์ + ต้องเบิก + เรื่องต้องติดตาม + ช่องลงนาม */
export interface MeetingExtra { tiles: [string, string][]; withdraw: { totalC: number; totalF: number; total: number }; follow: string[] }
export default function NoticePaper({ church, sunday, n: full, pagesRef, variant, meeting }: { church: string; sunday: string; n: Notice; pagesRef: MutableRefObject<HTMLDivElement[]>; variant?: 'evidence' | 'public'; meeting?: MeetingExtra }) {
  const detail = can(useRole(), 'detail')
  const evidence = variant === 'evidence'
  const pub = variant === 'public'
  const n = evidence || (!pub && detail) ? full : { ...full, out: maskNoticeOut(full.out) } // ผู้นำ/สมาชิกเห็นเงินเดือนเป็นแถวรวม · แอดมิน/ผู้บันทึก/ผู้ตรวจเห็นรายคน
  const pcs = piecesOf(n)
  const sig = `${n.inc.length}:${n.out.length}:${n.fund.length}:${meeting ? meeting.follow.length : -1}`
  pagesRef.current = []
  return (
    <div>
      {[0].map((pi) => (
        <ScaledPage key={pi} ref={(el) => { if (el) pagesRef.current[pi] = el }}>
          <div data-keep={evidence ? '1' : undefined} style={{ display: 'contents' }}>
            <PaperHead church={church} title={meeting ? 'รายงานการเงินประจำสัปดาห์ · เสนอที่ประชุม' : 'สรุปรายรับ - รายจ่ายประจำสัปดาห์'} sub={weekHeading(sunday)} />
            <FitBox sig={sig}>{meeting && <div aria-label="เงินคริสตจักรสิ้นสัปดาห์" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '4px 0' }}>{meeting.tiles.map(([k, v]) => <div key={k} style={{ border: '1.5px solid #1a2b4c', borderRadius: 6, padding: '3px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{k}</span><b className="num">{v}</b></div>)}</div>}{groupZones(pcs).map((g, gi) => g.zone === 'sum' ? (
              <div key={gi}>
                <div style={{ border: '2px solid #1a2b4c', borderRadius: 6, background: '#f4f7fd', padding: '8px 12px', marginTop: 10, fontSize: 15, display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 16px' }}>
                  <span>รวมรายรับเงินหมุนเวียน</span><span className="num">{m(n.totalInc)}</span>
                  <span>หัก รวมรายจ่ายเงินหมุนเวียน</span><span className="num">{m(n.totalOut)}</span>
                  <b style={{ fontSize: 17 }}>{n.net >= 0 ? 'รับมากกว่าจ่าย' : 'จ่ายมากกว่ารับ'}</b><b className="num" style={{ fontSize: 17 }}>{n.net < 0 ? '−' : ''}{m(Math.abs(n.net))} บาท</b>
                </div>
                {n.totalFund > 0 && <div style={{ border: '2px dashed #b8860b', borderRadius: 6, background: '#fff8e6', padding: '6px 12px', marginTop: 8, display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 16px' }}><span className="small">เงินถวายกองทุน (รายงานให้ทราบ ไม่รวมในยอดข้างบน)</span><span className="num small">{m(n.totalFund)}</span></div>}
              </div>
            ) : (
              <div key={gi} className={`zone zone--${g.zone}`} style={g.zone === 'circ' ? { border: '3px solid #1a2b4c', background: '#f4f7fd' } : { border: '3px dashed #b8860b', background: '#fff8e6' }}>
                <div className="zone__head" style={{ background: g.zone === 'circ' ? '#1a2b4c' : '#b8860b' }}>{g.zone === 'circ' ? '■ ส่วนที่ 1 · เงินหมุนเวียน (เงินที่คริสตจักรบริหารจัดการ)' : '▲ ส่วนที่ 2 · เงินกองทุน (เงินของแต่ละกองทุน คริสตจักรเก็บรักษาไว้ ไม่ใช่รายรับ-รายจ่ายของคริสตจักร)'}{g.cont ? ' · (ต่อ)' : ''}</div>
                {g.pieces.map((p, i) => p.t === 'inc' ? <IncTable key={i} p={p} /> : p.t === 'out' ? <OutTable key={i} p={p} noNames={pub} /> : null)}
              </div>
            ))}{meeting && <>
              <div aria-label="ต้องเบิกประจำสัปดาห์" style={{ border: '2px solid #5b3a8c', borderRadius: 6, background: '#f6f1fc', padding: '6px 12px', marginTop: 8, fontSize: 14, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><b>ต้องเบิกสัปดาห์นี้ {m(meeting.withdraw.total)} บาท</b><span>หมุนเวียน {m(meeting.withdraw.totalC)} + กองทุน (เตรียมนำฝาก) {m(meeting.withdraw.totalF)}</span></div>
              <div aria-label="เรื่องต้องติดตาม" style={{ border: '1.5px solid #555', borderRadius: 6, padding: '4px 10px', marginTop: 8, fontSize: 12.5 }}><b>เรื่องต้องติดตาม</b>{meeting.follow.length === 0 ? <div>ไม่พบรายการค้างตามสถานะที่ระบบบันทึกไว้</div> : meeting.follow.map((f, i) => <div key={i}>• {f}</div>)}</div>
            </>}</FitBox>
            {meeting && <div style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 6 }}>{['เหรัญญิก (ผู้จัดทำ)', 'ผู้ตรวจสอบ', 'ประธาน'].map((r) => <div key={r} style={{ flex: 1, border: '1px solid #1a2b4c', padding: 5 }}><b>{r}</b><br />ลงชื่อ.......................................<br />วันที่........../........../..........</div>)}</div>}
          </div>
        </ScaledPage>
      ))}
    </div>
  )
}
