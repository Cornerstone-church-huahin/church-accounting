import type { MutableRefObject, ReactNode } from 'react'
import { PaperHead } from './PaperSheets'
import ScaledPage from './ScaledPage'
import { actDays, goalProgress } from '../lib/fundActs'
import { fmtBaht, fmtDate, todayISO } from '../lib/money'
import type { FundActivity } from '../lib/types'

export type ActReportKind = 'all' | 'acct' | 'prog' | 'eval'
export interface ActAcctData {
  cats: { name: string; moneyIn: number; moneyOut: number; balance: number }[]
  items: { date: string; cat: string; label: string; amount: number }[]
  total: { moneyIn: number; moneyOut: number; balance: number }
}
export const REPORT_TITLE: Record<ActReportKind, string> = { all: 'รายงานสรุปกิจกรรม', acct: 'รายงานบัญชีกิจกรรม', prog: 'รายงานความคืบหน้ากิจกรรม', eval: 'รายงานการประเมินผลกิจกรรม' }

const m = (x: number) => fmtBaht(x)
const th: React.CSSProperties = { textAlign: 'center' }
const pct = (v: number, color: string) => <div style={{ height: 14, border: '1px solid #1a2b4c', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${v}%`, height: '100%', background: color, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} /></div>
const barColor = (v: number) => (v < 40 ? '#c4332a' : v < 70 ? '#d9a21b' : '#1f8a4c')
const chunk = <T,>(xs: T[], n: number): T[][] => (xs.length === 0 ? [[]] : Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, (i + 1) * n)))

function Info({ act }: { act: FundActivity }) {
  const end = act.endDate ?? act.date
  const status = act.closed ? `ปิดกิจกรรมแล้ว ${fmtDate(act.closed.date)}` : end < todayISO() ? 'สิ้นสุดแล้ว' : 'กำลังดำเนินการ'
  const row = (k: string, v: ReactNode) => <tr key={k}><td style={{ width: '24%', fontWeight: 700, verticalAlign: 'top' }}>{k}</td><td style={{ whiteSpace: 'pre-wrap' }}>{v}</td></tr>
  return (
    <table className="sheetpaper sheetpaper--full" aria-label="ข้อมูลกิจกรรม" style={{ marginBottom: 8 }}>
      <tbody>
        {row('กิจกรรม', act.name)}
        {row('ระยะเวลา', `${fmtDate(act.date)}${end !== act.date ? ` – ${fmtDate(end)}` : ''} · ${actDays(act)} วัน`)}
        {row('สถานะ', status)}
        {act.purpose && row('เหตุผล / วัตถุประสงค์', act.purpose)}
        {act.resolution && (act.resolution.meeting || act.resolution.date || act.resolution.text) && row('มติคณะกรรมการ', `${act.resolution.meeting ? `ประชุมครั้งที่ ${act.resolution.meeting}` : ''}${act.resolution.date ? `${act.resolution.meeting ? ' · ' : ''}${fmtDate(act.resolution.date)}` : ''}${act.resolution.text ? `\n${act.resolution.text}` : ''}`)}
        {(act.team ?? []).length > 0 && row('อนุกรรมการจัดงาน', (act.team ?? []).map((m) => `${m.name}${m.duty ? ` — ${m.duty}` : ''}`).join('\n'))}
        {act.note && row('หมายเหตุ', act.note)}
      </tbody>
    </table>
  )
}
const Sign = () => (
  <div style={{ display: 'flex', gap: 14, marginTop: 'auto', fontSize: 13 }}>
    {['ประธานอนุกรรมการจัดงาน (ผู้รายงาน)', 'เหรัญญิก / ผู้ตรวจสอบ', 'ประธานคณะกรรมการ (ผู้ประเมิน)'].map((r) => <div key={r} style={{ flex: 1, border: '1px solid #1a2b4c', padding: 8 }}><b>{r}</b><br /><br />ลงชื่อ......................................<br />(......................................)<br />วันที่........../........../..........</div>)}
  </div>
)
const heading = (t: string) => <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0 2px' }}>{t}</div>

function ProgressBody({ act }: { act: FundActivity }) {
  const gp = goalProgress(act)
  return (
    <>
      {heading('เป้าหมายของงาน')}
      <p style={{ margin: '0 0 4px', fontSize: 13 }}>{gp.total ? `ทำแล้ว ${gp.done} จาก ${gp.total} เป้าหมาย (${gp.pct}%)` : 'ยังไม่มีเป้าหมาย'}</p>
      {gp.total > 0 && pct(gp.pct, barColor(gp.pct))}
      <table className="sheetpaper sheetpaper--full" aria-label="เป้าหมายของงาน" style={{ marginTop: 8 }}>
        <colgroup><col style={{ width: '7%' }} /><col style={{ width: '63%' }} /><col style={{ width: '14%' }} /><col style={{ width: '16%' }} /></colgroup>
        <thead><tr><th style={th}>ที่</th><th style={th}>เป้าหมาย / ขั้นตอน</th><th style={th}>สถานะ</th><th style={th}>วันที่ทำแล้ว</th></tr></thead>
        <tbody>
          {(act.goals ?? []).length === 0 && <tr><td /><td>— ไม่มีรายการ —</td><td /><td /></tr>}
          {(act.goals ?? []).map((g, i) => <tr key={g.id}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{g.text}</td><td style={{ textAlign: 'center' }}>{g.done ? '☑ ทำแล้ว' : '☐ ยังไม่ทำ'}</td><td style={{ textAlign: 'center' }}>{g.doneDate ? fmtDate(g.doneDate) : ''}</td></tr>)}
        </tbody>
      </table>
    </>
  )
}
function EvalBody({ act }: { act: FundActivity }) {
  const ev = act.eval
  return (
    <>
      {heading('การประเมินผลโดยคณะกรรมการ')}
      {ev ? (
        <>
          <p style={{ margin: '0 0 4px', fontSize: 14 }}><b>ความพึงพอใจต่อกิจกรรม {ev.score}/100</b></p>
          {pct(ev.score, barColor(ev.score))}
          <table className="sheetpaper sheetpaper--full" aria-label="ผลการประเมิน" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td style={{ width: '24%', fontWeight: 700, verticalAlign: 'top' }}>ข้อดี</td><td style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{ev.pros ?? '-'}</td></tr>
              <tr><td style={{ fontWeight: 700, verticalAlign: 'top' }}>ข้อเสีย / ควรปรับปรุง</td><td style={{ whiteSpace: 'pre-wrap' }}>{ev.cons ?? '-'}</td></tr>
              <tr><td style={{ fontWeight: 700, verticalAlign: 'top' }}>ความเห็นคณะกรรมการ</td><td style={{ whiteSpace: 'pre-wrap' }}>{ev.comment ?? '-'}</td></tr>
              <tr><td style={{ fontWeight: 700, verticalAlign: 'top' }}>สรุป</td><td>{ev.summary ?? '-'}</td></tr>
              {ev.evaluatedDate && <tr><td style={{ fontWeight: 700 }}>ประเมินเมื่อวันที่</td><td>{fmtDate(ev.evaluatedDate)}</td></tr>}
            </tbody>
          </table>
        </>
      ) : <p style={{ fontSize: 13 }}>ยังไม่มีการประเมินผล</p>}
    </>
  )
}
function AcctBody({ data, rows, first, last }: { data: ActAcctData; rows: ActAcctData['items']; first: boolean; last: boolean }) {
  return (
    <>
      {first && <>
        {heading('สรุปบัญชีแต่ละหมวด')}
        <table className="sheetpaper sheetpaper--full" aria-label="สรุปบัญชีแต่ละหมวด">
          <thead><tr><th>หมวด</th><th style={th}>รับ</th><th style={th}>จ่าย</th><th style={th}>คงเหลือ</th></tr></thead>
          <tbody>{data.cats.map((c) => <tr key={c.name}><td>{c.name}</td><td className="num">{m(c.moneyIn)}</td><td className="num">{m(c.moneyOut)}</td><td className="num"><b>{m(c.balance)}</b></td></tr>)}</tbody>
          <tfoot><tr><td>รวมกิจกรรม</td><td className="num">{m(data.total.moneyIn)}</td><td className="num">{m(data.total.moneyOut)}</td><td className="num"><b>{m(data.total.balance)}</b></td></tr></tfoot>
        </table>
      </>}
      {heading(first ? 'รายการรับ-จ่ายทั้งหมดของกิจกรรม (เรียงตามวันที่)' : 'รายการรับ-จ่าย (ต่อ)')}
      <table className="sheetpaper sheetpaper--full" aria-label="รายการรับ-จ่ายของกิจกรรม">
        <colgroup><col style={{ width: '13%' }} /><col style={{ width: '17%' }} /><col style={{ width: '40%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} /></colgroup>
        <thead><tr><th style={th}>วันที่</th><th style={th}>หมวด</th><th style={th}>รายการ</th><th style={th}>รับ</th><th style={th}>จ่าย</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td /><td /><td>— ไม่มีรายการ —</td><td /><td /></tr>}
          {rows.map((r, i) => <tr key={i}><td style={{ fontSize: 11 }}>{fmtDate(r.date)}</td><td>{r.cat}</td><td>{r.label}</td><td className="num">{r.amount > 0 ? m(r.amount) : ''}</td><td className="num">{r.amount < 0 ? m(-r.amount) : ''}</td></tr>)}
        </tbody>
        {last && <tfoot><tr><td colSpan={3} style={{ textAlign: 'center' }}>รวมทั้งสิ้น</td><td className="num">{m(data.total.moneyIn)}</td><td className="num">{m(data.total.moneyOut)}</td></tr></tfoot>}
      </table>
    </>
  )
}

/** รายงานกิจกรรม A4 (พิมพ์/PDF/แชร์ได้): บัญชี · ความคืบหน้า · ประเมินผล · รวมทุกขั้นตอน — ScaledPage ใส่เครดิตผู้พัฒนาท้ายทุกแผ่น */
export default function ActReportPages({ kind, church, fundName, act, acct, pagesRef }: { kind: ActReportKind; church: string; fundName: string; act: FundActivity; acct: ActAcctData; pagesRef: MutableRefObject<HTMLDivElement[]> }) {
  pagesRef.current = []
  const ROWS = 24
  const pages: { sub: string; node: ReactNode }[] = []
  const withAcct = kind === 'all' || kind === 'acct'
  const withProg = kind === 'all' || kind === 'prog'
  const withEval = kind === 'all' || kind === 'eval'
  const accChunks = withAcct ? chunk(acct.items, ROWS) : []
  accChunks.forEach((rows, i) => pages.push({ sub: `บัญชีกิจกรรม${accChunks.length > 1 ? ` · แผ่นที่ ${i + 1}/${accChunks.length}` : ''}`, node: <>{i === 0 && <Info act={act} />}<AcctBody data={acct} rows={rows} first={i === 0} last={i === accChunks.length - 1} /></> }))
  if (withProg || withEval) pages.push({ sub: kind === 'all' ? 'ความคืบหน้าและการประเมินผล' : withProg ? 'ความคืบหน้า' : 'การประเมินผล', node: <>{!withAcct && <Info act={act} />}{withProg && <ProgressBody act={act} />}{withEval && <EvalBody act={act} />}</> })
  return (
    <div>
      {pages.map((p, i) => (
        <ScaledPage key={i} ref={(el) => { if (el) pagesRef.current[i] = el }}>
          <>
            <PaperHead church={church} title={REPORT_TITLE[kind]} sub={`${fundName} · ${act.name} · ${p.sub}`} compact={i > 0} />
            {p.node}
            {i === pages.length - 1 && <Sign />}
          </>
        </ScaledPage>
      ))}
    </div>
  )
}
