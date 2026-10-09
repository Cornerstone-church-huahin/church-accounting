import { useMemo, useRef, useState } from 'react'
import { useBudgetEntries, useBudgetLines, useExpenseCats, useExpenses, useFunds, useIncome, useIncomeTypes, useRounds, useSettings, useVouchers } from '../lib/data'
import { fmtBaht, fmtDate, fmtDateLong, monthName, monthOf, sheetSunday, sundaysOf, todayISO, yearOf } from '../lib/money'
import { downloadPdf } from '../lib/pdf'
import { computeLedger, rangeOf, type SumKind } from '../lib/weekLedger'
import LedgerTable from '../components/LedgerTable'
import ScaledPage from '../components/ScaledPage'
import PeriodBar from '../components/PeriodBar'

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
  const expenses = useExpenses(year)
  const sundays = useMemo(() => sundaysOf(year), [year])
  const nowM = yearOf(todayISO()) === year ? monthOf(todayISO()) : 12
  const [kind, setKind] = useState<SumKind>('week')
  const [sunday, setSunday] = useState(() => { const s = sheetSunday(todayISO()); return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0]) })
  const [month, setMonth] = useState(nowM)
  const [quarter, setQuarter] = useState(Math.ceil(nowM / 3))
  const [busy, setBusy] = useState(false)
  const idx = sundays.indexOf(sunday)
  const range = rangeOf(kind, year, { sunday, month, quarter })

  const L = useMemo(() => computeLedger({ range, income: income.items, rounds: rounds.items, vouchers: vouchers.items, lines: lines.items, funds: funds.items, entries: entries.items, types: types.list, cats: cats.list, expenses: expenses.items }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.from, range.to, income.items, rounds.items, vouchers.items, lines.items, funds.items, entries.items, types.list, cats.list, expenses.items])
  const { incRows, outRows, inSum, outSum } = L
  const paperRef = useRef<HTMLDivElement>(null)

  const be = year + 543
  const kindWord = { week: 'สัปดาห์', month: 'เดือน', quarter: 'ไตรมาส', year: 'ปี' }[kind]
  const label = kind === 'week' ? fmtDateLong(sunday) : kind === 'month' ? `${monthName(month)} ${be}` : kind === 'quarter' ? `ไตรมาส ${quarter} · ${monthName(quarter * 3 - 2)}–${monthName(quarter * 3)} ${be}` : `ปี ${be}`
  const rangeText = `${fmtDate(range.from)} – ${fmtDate(range.to)}`
  const nav = kind === 'week' ? { onPrev: () => setSunday(sundays[idx - 1]), onNext: () => setSunday(sundays[idx + 1]), canPrev: idx > 0, canNext: idx < sundays.length - 1 }
    : kind === 'month' ? { onPrev: () => setMonth(month - 1), onNext: () => setMonth(month + 1), canPrev: month > 1, canNext: month < 12 }
    : kind === 'quarter' ? { onPrev: () => setQuarter(quarter - 1), onNext: () => setQuarter(quarter + 1), canPrev: quarter > 1, canNext: quarter < 4 }
    : { onPrev: () => undefined, onNext: () => undefined, canPrev: false, canNext: false }
  const period = kind === 'week' ? `ประจำวันอาทิตย์ที่ ${fmtDateLong(sunday).replace('วันอาทิตย์ที่ ', '')} (${rangeText})` : kind === 'month' ? `ประจำเดือน${monthName(month)} ${be} (${rangeText})` : kind === 'quarter' ? `ประจำไตรมาส ${quarter} ปี ${be} (${rangeText})` : `ประจำปี ${be}`
  const fileKey = kind === 'week' ? sunday : kind === 'month' ? `${year}-${String(month).padStart(2, '0')}` : kind === 'quarter' ? `${year}-Q${quarter}` : String(be)
  const tabBtn = (k: SumKind, n: number, text: string) => <button type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{n}<span>{text}</span></button>

  const church = settings.churchName
  const dateLine = <span>วันที่ ........../........../..........</span>

  return (
    <div role="tabpanel" aria-label="สรุป" className="mode-sum">
      <PeriodBar label={label} rangeText={rangeText} {...nav} />
      <div className="subtabs subtabs--sum no-print" role="tablist" aria-label="ช่วงของใบสรุป">
        {tabBtn('week', 1, 'สัปดาห์')}{tabBtn('month', 2, 'เดือน')}{tabBtn('quarter', 3, 'ไตรมาส')}{tabBtn("year", 4, `ปี ${be}`)}
      </div>
      <div className="no-print" style={{ display: 'grid', gap: 8, margin: '0.6rem 0' }}>
        <div className="grid2">
          <button type="button" className="btn btn--gold" disabled={busy} onClick={async () => {
            if (!paperRef.current) return
            setBusy(true)
            try { await downloadPdf(paperRef.current, `summary-${kind}-${fileKey}.pdf`, { fullPage: true }) } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF แทน') }
            setBusy(false)
          }}>{busy ? 'กำลังสร้าง PDF…' : '⬇️ ดาวน์โหลด PDF'}</button>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>🖨️ พิมพ์</button>
        </div>
      </div>

      <ScaledPage ref={paperRef}>
        <>
          <div className="a4head"><b>สรุปรับ-จ่ายประจำ{kindWord} · {church}</b><span>{period}</span></div>
          <LedgerTable band="รายรับ — ได้รับการถวายประจำสัปดาห์" labels={['ประเภท', 'จำนวนซอง', 'จำนวนโอน']} rows={incRows} total="รวมรายรับ" tone="in" />
          <LedgerTable band="รายจ่าย" labels={['หมวดรายจ่าย', 'รายการ', 'จำนวนโอน']} rows={outRows} total="รวมรายจ่าย" tone="out" minRows={0} pendingCol />
          <table className="tbl tbl--paper paper__close" aria-label="ปิดยอด">
            <thead><tr><th>ปิดยอด{kindWord === 'ปี' ? 'ทั้งปี' : `ราย${kindWord}`}</th><th className="num">เงินสด</th><th className="num">เงินโอน</th><th className="num">ค้างจ่าย</th><th className="num">รวม</th></tr></thead>
            <tbody>
              <tr><td>รวมรายรับ</td><td className="num">{fmtBaht(inSum.cash)}</td><td className="num">{fmtBaht(inSum.transfer)}</td><td className="num">{fmtBaht(0)}</td><td className="num">{fmtBaht(inSum.cash + inSum.transfer)}</td></tr>
              <tr><td>หัก รวมรายจ่าย</td><td className="num">{fmtBaht(outSum.cash)}</td><td className="num">{fmtBaht(outSum.transfer)}</td><td className="num">{fmtBaht(outSum.pending)}</td><td className="num">{fmtBaht(outSum.cash + outSum.transfer + outSum.pending)}</td></tr>
            </tbody>
            <tfoot><tr><td>คงเหลือ</td><td className="num">{fmtBaht(inSum.cash - outSum.cash)}</td><td className="num">{fmtBaht(inSum.transfer - outSum.transfer)}</td><td className="num">{fmtBaht(outSum.pending ? -outSum.pending : 0)}</td><td className="num">{fmtBaht(inSum.cash + inSum.transfer - outSum.cash - outSum.transfer - outSum.pending)}</td></tr></tfoot>
          </table>
          {outSum.pending > 0 && <p className="a4note">ยอดค้างจ่ายที่ต้องเตรียมเบิก (วางบิลที่ยังไม่จ่าย + สำรองจ่ายที่ยังไม่คืนเงิน): <b>{fmtBaht(outSum.pending)}</b> บาท</p>}
          <div className="sign" style={{ display: 'grid' }}>
            <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br />{dateLine}</div>
            <div>ผู้ตรวจสอบ<br />{dateLine}</div>
            <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br />{dateLine}</div>
          </div>
        </>
      </ScaledPage>
      <p className="muted small no-print" style={{ textAlign: 'center' }}>รายรับ: ใบถวาย + สลิป + บันทึกด้วยมือ · รายจ่าย: ใบเบิกที่จ่ายแล้ว + บันทึกตรงในงบ + บันทึกด้วยมือ/วางบิล/สำรองจ่าย (ที่ยังไม่จ่ายแสดงในช่อง “ค้างจ่าย”) · เงินโอนวันจันทร์–อาทิตย์นับรวมในใบวันอาทิตย์ของสัปดาห์นั้น</p>
    </div>
  )
}
