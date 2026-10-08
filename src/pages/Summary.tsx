import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useBudgetEntries, useBudgetLines, useExpenseCats, useFunds, useIncome, useIncomeTypes, useRounds, useSettings, useVouchers } from '../lib/data'
import { addDays, fmtBaht, fmtDate, fmtDateLong, sundaysOf, sheetSunday, todayISO } from '../lib/money'
import { downloadPdf } from '../lib/pdf'
import { computeLedger } from '../lib/weekLedger'
import LedgerTable from '../components/LedgerTable'

const PAGE_W = 794, PAGE_H = 1123 // A4 ที่ 96 dpi

/** แท็บ "สรุป" หน้าแรก: ดึงผลรวมรายรับ + รายจ่าย มาเป็นใบเดียวเต็มหน้า A4 (บนรายรับ ล่างรายจ่าย) แล้วปิดยอดคงเหลือ */
export default function Summary({ year }: { year: number }) {
  const { settings } = useSettings()
  const income = useIncome(year)
  const rounds = useRounds(year)
  const vouchers = useVouchers(year)
  const lines = useBudgetLines(year)
  const funds = useFunds()
  const entries = useBudgetEntries(year)
  const types = useIncomeTypes()
  const cats = useExpenseCats()
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => { const s = sheetSunday(todayISO()); return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0]) })
  const [scope, setScope] = useState<'week' | 'year'>('week')
  const [busy, setBusy] = useState(false)
  const idx = sundays.indexOf(sunday)

  const L = useMemo(() => computeLedger({ year, sunday, scope, income: income.items, rounds: rounds.items, vouchers: vouchers.items, lines: lines.items, funds: funds.items, entries: entries.items, types: types.list, cats: cats.list }),
    [year, sunday, scope, income.items, rounds.items, vouchers.items, lines.items, funds.items, entries.items, types.list, cats.list])
  const { incRows, outRows, inSum, outSum } = L

  // ย่อหน้ากระดาษให้พอดีความกว้างจอ (ตอนพิมพ์/สร้าง PDF ใช้ขนาดจริง)
  const wrapRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(0.45)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const on = () => setK(Math.min(1, el.clientWidth / PAGE_W))
    on()
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const church = settings.churchName
  const period = scope === 'year' ? `ประจำปี ${year + 543}` : `ประจำวันอาทิตย์ที่ ${fmtDateLong(sunday).replace('วันอาทิตย์ที่ ', '')} (${fmtDate(addDays(sunday, -6))} – ${fmtDate(sunday)})`
  const dateLine = <span>วันที่ ........../........../..........</span>

  return (
    <div role="tabpanel" aria-label="สรุป">
      <div className="no-print" style={{ display: 'grid', gap: 8, margin: '0.6rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" className="mini" aria-label="สัปดาห์ก่อน" disabled={scope === 'year' || idx <= 0} onClick={() => setSunday(sundays[idx - 1])}>‹</button>
          <b style={{ textAlign: 'center' }}>{scope === 'year' ? `ทั้งปี ${year + 543}` : fmtDateLong(sunday)}</b>
          <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" disabled={scope === 'year' || idx >= sundays.length - 1} onClick={() => setSunday(sundays[idx + 1])}>›</button>
        </div>
        <div className="seg" role="group" aria-label="ช่วงของใบสรุป">
          <button type="button" className={scope === 'week' ? 'on' : ''} onClick={() => setScope('week')}>สัปดาห์ที่เลือก</button>
          <button type="button" className={scope === 'year' ? 'on' : ''} onClick={() => setScope('year')}>ทั้งปี {year + 543}</button>
        </div>
        <div className="grid2">
          <button type="button" className="btn btn--gold" disabled={busy} onClick={async () => {
            if (!paperRef.current) return
            setBusy(true)
            try { await downloadPdf(paperRef.current, `summary-${scope === 'year' ? year + 543 : sunday}.pdf`, { fullPage: true }) } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF แทน') }
            setBusy(false)
          }}>{busy ? 'กำลังสร้าง PDF…' : '⬇️ ดาวน์โหลด PDF'}</button>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>🖨️ พิมพ์</button>
        </div>
      </div>

      <div ref={wrapRef} className="a4wrap" style={{ height: PAGE_H * k }}>
        <div ref={paperRef} className="a4page" style={{ transform: `scale(${k})` }}>
          <div className="a4head"><b>สรุปรับ-จ่ายประจำสัปดาห์ · {church}</b><span>{period}</span></div>
          <LedgerTable band="รายรับ — ได้รับการถวายประจำสัปดาห์" labels={['ประเภท', 'จำนวนซอง', 'จำนวนโอน']} rows={incRows} total="รวมรายรับ" tone="in" />
          <LedgerTable band="รายจ่าย" labels={['หมวดรายจ่าย', 'รายการ', 'จำนวนโอน']} rows={outRows} total="รวมรายจ่าย" tone="out" />
          <table className="tbl tbl--paper paper__close" aria-label="ปิดยอด">
            <thead><tr><th>ปิดยอด{scope === 'year' ? 'ทั้งปี' : 'รายสัปดาห์'}</th><th className="num">เงินสด</th><th className="num">เงินโอน</th><th className="num">รวม</th></tr></thead>
            <tbody>
              <tr><td>รวมรายรับ</td><td className="num">{fmtBaht(inSum.cash)}</td><td className="num">{fmtBaht(inSum.transfer)}</td><td className="num">{fmtBaht(inSum.cash + inSum.transfer)}</td></tr>
              <tr><td>หัก รวมรายจ่าย</td><td className="num">{fmtBaht(outSum.cash)}</td><td className="num">{fmtBaht(outSum.transfer)}</td><td className="num">{fmtBaht(outSum.cash + outSum.transfer)}</td></tr>
            </tbody>
            <tfoot><tr><td>คงเหลือ</td><td className="num">{fmtBaht(inSum.cash - outSum.cash)}</td><td className="num">{fmtBaht(inSum.transfer - outSum.transfer)}</td><td className="num">{fmtBaht(inSum.cash + inSum.transfer - outSum.cash - outSum.transfer)}</td></tr></tfoot>
          </table>
          <div className="sign" style={{ display: 'grid' }}>
            <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br />{dateLine}</div>
            <div>ผู้ตรวจสอบ<br />{dateLine}</div>
            <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br />{dateLine}</div>
          </div>
        </div>
      </div>
      <p className="muted small no-print" style={{ textAlign: 'center' }}>รายรับ: ใบถวาย + สลิป + บันทึกด้วยมือ · รายจ่าย: ใบเบิกที่จ่ายแล้ว + บันทึกตรงในงบ · เงินโอนวันจันทร์–อาทิตย์นับรวมในใบวันอาทิตย์ของสัปดาห์นั้น</p>
    </div>
  )
}
