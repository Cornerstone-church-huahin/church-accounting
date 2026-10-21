import type { ReactNode } from 'react'
import { fmtDate, todayISO } from '../../lib/money'
import type { FollowUp, OutLine, IncLine, PeriodReport, Range } from '../../lib/report'
import { money, TONE, type Tone } from './charts'

export function Kpis({ items }: { items: { label: string; value: string; tone?: Tone; sub?: string }[] }) {
  return (
    <div className="rkpis" role="group" aria-label="ตัวเลขสรุป">
      {items.map((k) => <div key={k.label} className="rkpi"><span>{k.label}</span><b style={{ color: k.tone ? TONE[k.tone] : undefined }}>{k.value}</b>{k.sub && <small>{k.sub}</small>}</div>)}
    </div>
  )
}

/** สถานะข้อมูลตามที่ระบบมีจริง: ระบบยังไม่มีการปิดงวด/ยืนยันความครบถ้วน จึงไม่เคลมว่าตรวจสอบแล้ว */
export function StatusLine({ r, range, empty }: { r?: PeriodReport; range: Range; empty?: boolean }) {
  const t = todayISO(), ongoing = range.from <= t && t <= range.to, future = range.from > t
  const e = empty ?? r?.empty
  return (
    <p className="rstatus" role="status">
      <b>สถานะข้อมูล:</b> {future ? 'ยังไม่ถึงช่วงนี้' : e ? 'ยังไม่มีข้อมูลในช่วงนี้' : `${ongoing ? 'ระหว่างบันทึก · ' : ''}ยังไม่ยืนยันความครบถ้วน`}
      <span className="muted small"> · ช่วงวันที่ {fmtDate(range.from)} – {fmtDate(range.to)} · หน่วย: บาท</span>
    </p>
  )
}

const STATUS = { paid: 'จ่ายแล้ว', bill: 'ค้างจ่าย (วางบิล)', advance: 'สำรองจ่าย รอคืนเงิน' } as const
export function OutTable({ lines, title }: { lines: OutLine[]; title: string }) {
  if (lines.length === 0) return <p className="empty">ไม่มีรายการ</p>
  return (
    <div className="rtblwrap"><table className="tbl rtbl" aria-label={title}>
      <thead><tr><th>วันที่</th><th>รายการ</th><th>หมวด</th><th className="num">บาท</th></tr></thead>
      <tbody>{lines.map((l) => (
        <tr key={l.key}><td>{fmtDate(l.date)}</td>
          <td>{l.desc}{l.by ? <span className="muted"> ({l.by})</span> : null}<br /><small className="muted">{STATUS[l.status]}{l.evidence === true ? ' · มีหลักฐาน' : l.evidence === false ? ' · ยังไม่มีหลักฐาน' : ''}</small></td>
          <td>{l.catLabel}</td><td className="num">{money(l.amount)}</td></tr>))}</tbody>
      <tfoot><tr><th colSpan={3}>รวม</th><th className="num">{money(lines.reduce((s, l) => s + l.amount, 0))}</th></tr></tfoot>
    </table></div>
  )
}
export function IncTable({ lines, title }: { lines: IncLine[]; title: string }) {
  if (lines.length === 0) return <p className="empty">ไม่มีรายการ</p>
  return (
    <div className="rtblwrap"><table className="tbl rtbl" aria-label={title}>
      <thead><tr><th>วันที่</th><th>รายการ</th><th className="num">บาท</th></tr></thead>
      <tbody>{lines.map((l) => <tr key={l.key}><td>{fmtDate(l.date)}</td><td>{l.label}</td><td className="num">{money(l.amount)}</td></tr>)}</tbody>
      <tfoot><tr><th colSpan={2}>รวม</th><th className="num">{money(lines.reduce((s, l) => s + l.amount, 0))}</th></tr></tfoot>
    </table></div>
  )
}

export function Follow({ items, status }: { items: FollowUp[]; status?: string }) {
  return (
    <section className="card" aria-label="รายการต้องติดตาม">
      <h3 style={{ margin: 0 }}>🔎 รายการต้องติดตาม</h3>
      {items.length === 0 ? <p className="muted small" style={{ margin: 0 }}>{status ?? 'ไม่พบรายการค้างตามสถานะที่ระบบบันทึกไว้'}</p> : <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{items.map((f) => <li key={f.key}>{f.text}</li>)}</ul>}
      <p className="muted small" style={{ margin: 0 }}>แสดงจากสถานะที่ระบบบันทึกจริงเท่านั้น (ยังไม่ระบุหมวด · ค้างจ่าย · สำรองจ่ายรอคืน · เงินเข้า/ออกสมุดที่ยังไม่ทราบที่มา) ระบบไม่เดาประเภทรายการจากชื่อ</p>
    </section>
  )
}

export function Card({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return <section className="card" aria-label={title}><h3 style={{ margin: 0 }}>{title}</h3>{hint && <p className="muted small" style={{ margin: 0 }}>{hint}</p>}{children}</section>
}
