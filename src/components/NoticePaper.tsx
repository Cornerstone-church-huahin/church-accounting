import { forwardRef } from 'react'
import { PaperHead, weekHeading } from './PaperSheets'
import ScaledPage from './ScaledPage'
import { fmtBaht } from '../lib/money'
import type { Notice, NoticeLine } from '../lib/notice'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })

function Block({ color, tint, title, rows, totalLabel, total, empty }: { color: string; tint: string; title: string; rows: NoticeLine[]; totalLabel: string; total: number; empty: string }) {
  return (
    <section style={{ marginTop: 14 }}>
      <div style={{ background: color, color: '#fff', fontWeight: 800, fontSize: 20, padding: '5px 12px', borderRadius: '8px 8px 0 0' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: `2px solid ${color}`, fontSize: 18 }}>
        <thead><tr style={{ background: tint }}><th style={{ textAlign: 'left', padding: '4px 12px', fontSize: 14 }}>รายการ</th><th style={{ textAlign: 'right', padding: '4px 12px', fontSize: 14, width: 190 }}>จำนวนเงิน (บาท)</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={2} style={{ padding: '8px 12px', color: '#666' }}>{empty}</td></tr>}
          {rows.map((r) => <tr key={r.key} style={{ borderTop: '1px solid #cfd5df' }}><td style={{ padding: '5px 12px' }}>{r.label}</td><td style={{ padding: '5px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m(r.amt)}</td></tr>)}
        </tbody>
        <tfoot><tr style={{ background: tint, borderTop: `2px solid ${color}`, fontWeight: 800 }}><td style={{ padding: '6px 12px' }}>{totalLabel}</td><td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 21, fontVariantNumeric: 'tabular-nums' }}>{m(total)}</td></tr></tfoot>
      </table>
    </section>
  )
}

/** ใบสรุปรับ-จ่ายรายสัปดาห์สำหรับติดประกาศ — A4 แนวตั้งใบเดียว: รายรับ (เขียว) · รายจ่าย (แดง) · สรุป */
const NoticePaper = forwardRef<HTMLDivElement, { church: string; sunday: string; n: Notice }>(function NoticePaper({ church, sunday, n }, ref) {
  return (
    <ScaledPage ref={ref}>
      <>
        <PaperHead church={church} title="สรุปรายรับ - รายจ่ายประจำสัปดาห์" sub={weekHeading(sunday)} />
        <Block color="#1f8a4c" tint="#e3f3e9" title="💚 รายรับ" rows={n.inc} totalLabel="รวมรายรับ" total={n.totalInc} empty="ไม่มีรายรับในสัปดาห์นี้" />
        {n.fund.length > 0 && <Block color="#b8860b" tint="#fff4d6" title="💰 เงินถวายกองทุน (แยกจากรายรับข้างบน)" rows={n.fund} totalLabel="รวมเงินถวายกองทุน" total={n.totalFund} empty="" />}
        <Block color="#c4332a" tint="#fbe4e2" title="🔴 รายจ่าย" rows={n.out} totalLabel="รวมรายจ่าย" total={n.totalOut} empty="ไม่มีรายจ่ายในสัปดาห์นี้" />
        <div style={{ marginTop: 16, border: '3px solid #1a2b4c', borderRadius: 10, padding: '8px 14px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 16px', fontSize: 19 }}>
          <span style={{ color: '#1f8a4c', fontWeight: 700 }}>รายรับ</span><span style={{ textAlign: 'right' }}>{m(n.totalInc)}</span>
          <span style={{ color: '#c4332a', fontWeight: 700 }}>หัก รายจ่าย</span><span style={{ textAlign: 'right' }}>{m(n.totalOut)}</span>
          <b style={{ fontSize: 21 }}>{n.net >= 0 ? 'รับมากกว่าจ่าย' : 'จ่ายมากกว่ารับ'}</b><b style={{ textAlign: 'right', fontSize: 23, color: n.net >= 0 ? '#1f8a4c' : '#c4332a' }}>{m(Math.abs(n.net))} บาท</b>
        </div>
        <p style={{ marginTop: 'auto', textAlign: 'center', fontSize: 14, color: '#555' }}>ขอบพระคุณพระเจ้าสำหรับการถวายและการร่วมสนับสนุนพันธกิจของทุกท่าน · {church}</p>
      </>
    </ScaledPage>
  )
})
export default NoticePaper
