import type { MutableRefObject } from 'react'
import { FitBox } from './NoticePaper'
import { FundBars, HBarRows, PairedBars, TrendLine } from './PeriodCharts'
import { PaperHead } from './PaperSheets'
import ScaledPage from './ScaledPage'
import type { PeriodData } from '../lib/periodData'
import { fmtBaht, fmtDate, todayISO } from '../lib/money'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })
const th: React.CSSProperties = { fontSize: 13 }
type Variant = 'evidence' | 'report' | 'public'
const kindWord = (k: 'month' | 'year') => (k === 'month' ? 'ประจำเดือน' : 'ประจำปี')

/**
 * ใบสรุปรายเดือน/รายปี 2 แผ่น: (1) ตารางสรุปสองโซนสี (2) กราฟประกอบ — ติดประกาศคู่กัน
 * evidence/report = ฉบับมีชื่อ (ค่าตอบแทนรายบุคคล · ภายในคณะทำงาน) · public = ปิดชื่อ ค่าตอบแทนรวมเป็นยอดเดียว
 */
export default function PeriodPaper({ church, d, variant, pagesRef }: { church: string; d: PeriodData; variant: Variant; pagesRef: MutableRefObject<HTMLDivElement[]> }) {
  const named = variant !== 'public', meeting = variant === 'report'
  const incTotal = d.r.inTotal, outTotal = d.r.outTotal, net = incTotal - outTotal
  const incomplete = d.complete.have < d.complete.total && d.range.to < todayISO()
  const title = meeting ? `รายงานการเงิน${kindWord(d.kind)} · เสนอที่ประชุม` : `สรุปรายรับ - รายจ่าย${kindWord(d.kind)}`
  const sub = `${d.label} · ระหว่างวันที่ ${fmtDate(d.range.from)} – ${fmtDate(d.range.to)}`
  const topCat = d.catRows[0]
  const fundRows = d.funds.filter((f) => f.moneyIn || f.moneyOut || f.transfer || (f.end ?? 0))
  const fundSig = `${d.catRows.length}:${d.incRows.length}:${d.comp.length}:${fundRows.length}:${d.r.follow.length}`
  pagesRef.current = []
  const zoneHead = (txt: string, bg: string) => <div className="zone__head" style={{ background: bg }}>{txt}</div>
  return (
    <div>
      <ScaledPage ref={(el) => { if (el) pagesRef.current[0] = el }}>
        <div data-keep={named ? '1' : undefined} style={{ display: 'contents' }}>
          <PaperHead church={church} title={title} sub={sub} />
          <FitBox sig={fundSig}>
            <div style={{ fontSize: 12.5, margin: '2px 0 4px', color: incomplete ? '#b3261e' : '#333' }} aria-label="ความครบถ้วนของข้อมูล">{incomplete ? '⚠ ' : '✓ '}ข้อมูลที่บันทึกแล้ว {d.complete.have}/{d.complete.total} {d.complete.unit}{incomplete ? ' — ยังไม่ครบ ตัวเลขอาจเปลี่ยนเมื่อบันทึกเพิ่ม' : ''}</div>
            {meeting && <div aria-label="เงินคริสตจักรสิ้นช่วง" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '4px 0' }}>{([['🏠 หมุนเวียน', d.tiles.own], ['💰 กองทุน', d.tiles.fund], ['🧮 รวมเงินสด', d.tiles.total], ['🔁 หนี้ภายใน', d.tiles.inDebt], ['🧾 หนี้ภายนอก', d.tiles.outDebt]] as [string, number][]).map(([k, v]) => <div key={k} style={{ border: '1.5px solid #1a2b4c', borderRadius: 6, padding: '3px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{k}</span><b className="num">{fmtBaht(v, { dec: false })}</b></div>)}</div>}
            <div className="zone zone--circ" style={{ border: '3px solid #1a2b4c', background: '#f4f7fd' }}>
              {zoneHead('■ ส่วนที่ 1 · เงินหมุนเวียน (เงินที่คริสตจักรบริหารจัดการ)', '#1a2b4c')}
              <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0 2px' }}>รายรับเงินหมุนเวียน</div>
              <table className="sheetpaper sheetpaper--full" aria-label="รายรับเงินหมุนเวียน">
                <colgroup><col style={{ width: '7%' }} /><col style={{ width: '53%' }} /><col style={{ width: '22%' }} /><col style={{ width: '18%' }} /></colgroup>
                <thead><tr><th style={th}>ที่</th><th style={th}>รายการ</th><th style={th}>จำนวนเงิน</th><th style={th}>ร้อยละ</th></tr></thead>
                <tbody>
                  {d.incRows.length === 0 && <tr><td /><td colSpan={3}>— ไม่มีรายการ —</td></tr>}
                  {d.incRows.map((r, i) => <tr key={i}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{r.label}</td><td className="num"><b>{m(r.amount)}</b></td><td className="num">{r.pct}%</td></tr>)}
                </tbody>
                <tfoot><tr><td colSpan={2}>รวมรายรับ</td><td className="num">{m(incTotal)}</td><td /></tr></tfoot>
              </table>
              <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0 2px' }}>รายจ่ายเงินหมุนเวียน (แยกตามหมวด)</div>
              <table className="sheetpaper sheetpaper--full" aria-label="รายจ่ายเงินหมุนเวียนแยกหมวด">
                <colgroup><col style={{ width: '7%' }} /><col style={{ width: '53%' }} /><col style={{ width: '22%' }} /><col style={{ width: '18%' }} /></colgroup>
                <thead><tr><th style={th}>ที่</th><th style={th}>หมวดรายจ่าย</th><th style={th}>จำนวนเงิน</th><th style={th}>% ของรายรับ</th></tr></thead>
                <tbody>
                  {d.catRows.length === 0 && <tr><td /><td colSpan={3}>— ไม่มีรายการ —</td></tr>}
                  {d.catRows.map((r, i) => <tr key={i}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{r.label}</td><td className="num"><b>{m(r.amount)}</b></td><td className="num">{r.pct}%</td></tr>)}
                </tbody>
                <tfoot><tr><td colSpan={2}>รวมรายจ่ายทั้งสิ้น</td><td className="num">{m(outTotal)}</td><td className="num">{incTotal > 0 ? `${Math.round((outTotal / incTotal) * 1000) / 10}%` : ''}</td></tr></tfoot>
              </table>
              {d.compTotal > 0 && (named ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: 15, margin: '8px 0 2px' }}>ค่าตอบแทนและสวัสดิการ (รายบุคคล · ภายในคณะทำงาน)</div>
                  <table className="sheetpaper sheetpaper--full" aria-label="ค่าตอบแทนรายบุคคล">
                    <colgroup><col style={{ width: '7%' }} /><col style={{ width: '71%' }} /><col style={{ width: '22%' }} /></colgroup>
                    <thead><tr><th style={th}>ที่</th><th style={th}>ผู้รับ / รายการ</th><th style={th}>จำนวนเงิน</th></tr></thead>
                    <tbody>{d.comp.map((c, i) => <tr key={i}><td style={{ textAlign: 'center' }}>{i + 1}</td><td data-c="x"><span className="pname">{c.name}</span></td><td className="num"><b>{m(c.amount)}</b></td></tr>)}</tbody>
                    <tfoot><tr><td colSpan={2}>รวมค่าตอบแทนและสวัสดิการ</td><td className="num">{m(d.compTotal)}</td></tr></tfoot>
                  </table>
                </>
              ) : <div style={{ fontSize: 13, margin: '6px 0 0' }}>ในรายจ่ายข้างต้น <b>สวัสดิการผู้รับใช้ (ยอดรวม) {m(d.compTotal)} บาท</b>{incTotal > 0 ? ` (${Math.round((d.compTotal / incTotal) * 1000) / 10}% ของรายรับ)` : ''}</div>)}
            </div>
            <div className="zone zone--fund" style={{ border: '3px dashed #b8860b', background: '#fff8e6' }}>
              {zoneHead('▲ ส่วนที่ 2 · เงินกองทุน (เงินของแต่ละกองทุน คริสตจักรเก็บรักษาไว้ ไม่ใช่รายรับ-รายจ่ายของคริสตจักร)', '#b8860b')}
              <table className="sheetpaper sheetpaper--full" aria-label="เงินกองทุนในช่วง" style={{ marginTop: 6 }}>
                <colgroup><col style={{ width: '7%' }} /><col style={{ width: '33%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /></colgroup>
                <thead><tr><th style={th}>ที่</th><th style={th}>กองทุน</th><th style={th}>รับในช่วงนี้</th><th style={th}>ใช้ในช่วงนี้</th><th style={th}>คงเหลือสิ้นช่วง</th></tr></thead>
                <tbody>
                  {fundRows.length === 0 && <tr><td /><td colSpan={4}>— ไม่มีความเคลื่อนไหว —</td></tr>}
                  {fundRows.map((f, i) => <tr key={f.id}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{f.name}</td><td className="num">{m(f.moneyIn)}</td><td className="num">{f.moneyOut ? m(f.moneyOut) : '—'}</td><td className="num"><b>{f.end === null ? '—' : m(f.end)}</b></td></tr>)}
                </tbody>
              </table>
            </div>
            <div style={{ border: '2px solid #1a2b4c', borderRadius: 6, background: '#f4f7fd', padding: '8px 12px', marginTop: 8, fontSize: 15, display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 16px' }}>
              <span>รวมรายรับเงินหมุนเวียน</span><span className="num">{m(incTotal)}</span>
              <span>หัก รวมรายจ่ายเงินหมุนเวียน</span><span className="num">{m(outTotal)}</span>
              <b style={{ fontSize: 17 }}>{net >= 0 ? 'รับมากกว่าจ่าย' : 'จ่ายมากกว่ารับ'}</b><b className="num" style={{ fontSize: 17 }}>{net < 0 ? '−' : ''}{m(Math.abs(net))} บาท</b>
            </div>
            {meeting && <div aria-label="เรื่องต้องติดตาม" style={{ border: '1.5px solid #555', borderRadius: 6, padding: '4px 10px', marginTop: 8, fontSize: 12.5 }}><b>เรื่องต้องติดตาม</b>{d.r.follow.length === 0 ? <div>ไม่พบรายการค้างตามสถานะที่ระบบบันทึกไว้</div> : d.r.follow.map((f) => <div key={f.key}>• {f.text}</div>)}</div>}
          </FitBox>
          {meeting && <div style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 6 }}>{['เหรัญญิก (ผู้จัดทำ)', 'ผู้ตรวจสอบ', 'ประธาน'].map((r) => <div key={r} style={{ flex: 1, border: '1px solid #1a2b4c', padding: 5 }}><b>{r}</b><br />ลงชื่อ.......................................<br />วันที่........../........../..........</div>)}</div>}
        </div>
      </ScaledPage>
      <ScaledPage ref={(el) => { if (el) pagesRef.current[1] = el }}>
        <div data-keep={named ? '1' : undefined} style={{ display: 'contents' }}>
          <PaperHead church={church} title={`กราฟสรุป${kindWord(d.kind)}`} sub={sub} />
          <div aria-label="ตัวเลขเด่น" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '4px 0' }}>
            {([['รายรับหมุนเวียน', m(incTotal)], ['รายจ่ายหมุนเวียน', m(outTotal)], [net >= 0 ? 'รับมากกว่าจ่าย' : 'จ่ายมากกว่ารับ', `${net < 0 ? '−' : ''}${m(Math.abs(net))}`], ['เงินหมุนเวียนคงเหลือ', fmtBaht(d.tiles.own, { dec: false })]] as [string, string][]).map(([k, v]) => <div key={k} style={{ border: '2px solid #1a2b4c', borderRadius: 6, padding: '4px 8px', textAlign: 'center' }}><div style={{ fontSize: 11.5 }}>{k}</div><b className="num" style={{ fontSize: 17 }}>{v}</b></div>)}
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>1 · รายรับ <span style={{ fontWeight: 400 }}>(แท่งทึบ)</span> กับรายจ่าย <span style={{ fontWeight: 400 }}>(แท่งลายเฉียง)</span> แต่ละ{d.kind === 'month' ? 'สัปดาห์' : 'เดือน'}</div>
          <PairedBars pairs={d.pairs} id={d.kind} />
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>2 · เงินไปไหน — รายจ่ายแยกตามหมวด</div>
          <HBarRows rows={d.catRows} />
          {topCat && <div style={{ fontSize: 12, color: '#333' }}>หมวดที่ใช้มากที่สุดคือ “{topCat.label}” {m(topCat.amount)} บาท ({topCat.pct}% ของรายรับ)</div>}
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>3 · เงินหมุนเวียนคงเหลือ ณ สิ้นแต่ละเดือน</div>
          <TrendLine points={d.trend} />
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>4 · เงินกองทุนคงเหลือสิ้นช่วง (แยกจากเงินหมุนเวียน)</div>
          <FundBars rows={fundRows.map((f) => ({ label: f.name, amount: f.end ?? 0 }))} />
        </div>
      </ScaledPage>
    </div>
  )
}
