import { useMemo, useRef, useState } from 'react'
import { usePassbook, useWeekCloses, useBudgetEntries, useBudgetLines, useExpenseCats, useExpenses, useFunds, useIncome, useIncomeTypes, useRounds, useSettings, useVouchers } from '../lib/data'
import { fmtBaht, fmtDate, fmtDateLong, monthName, monthOf, sheetSunday, sundaysOf, todayISO, yearOf } from '../lib/money'
import { downloadPdfPages } from '../lib/pdf'
import { computeLedger, rangeOf, type SumKind } from '../lib/weekLedger'
import { CODE_LEGEND, reconcileWeek } from '../lib/passbook'
import { computeSeries, topRows, type LedgerInput } from '../lib/seriesLedger'
import { CatBars, CumLine, Donut, GroupedBars, Legend } from '../components/StatCharts'
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
  const closes = useWeekCloses(year)
  const passbook = usePassbook(year)
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
  const sheetBar = (n: 1 | 2, title: string) => (
    <div className="sheetbar no-print">
      <b>{title}</b>
      <span className="grow" />
      <button type="button" className="btn btn--ghost btn--sm" disabled={busy} aria-label="ดาวน์โหลดใบนี้เป็น PDF" title="ดาวน์โหลดใบนี้" onClick={() => downloadSheet(n)}>⬇️</button>
      <button type="button" className="btn btn--ghost btn--sm" aria-label="พิมพ์ใบนี้" title="พิมพ์ใบนี้" onClick={() => printSheet(n)}>🖨️</button>
    </div>
  )
  const downloadSheet = async (n: 1 | 2) => {
    const el = n === 1 ? paperRef.current : paper2Ref.current
    if (!el) return
    setBusy(true)
    try { await downloadPdfPages([{ el, landscape: n === 2 }], `summary-${kind}-${fileKey}-sheet${n}.pdf`) } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF') }
    setBusy(false)
  }
  const printSheet = (n: 1 | 2) => {
    document.body.dataset.printOnly = String(n)
    const done = () => { delete document.body.dataset.printOnly; window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
  }
  const idx = sundays.indexOf(sunday)
  const bank = useMemo(() => (kind === 'week' ? reconcileWeek(sunday, passbook.items, income.items) : null), [kind, sunday, passbook.items, income.items])
  const wkClose = kind === 'week' ? closes.items.find((c) => c.sunday === sunday) : undefined
  const range = rangeOf(kind, year, { sunday, month, quarter })

  const input = useMemo<LedgerInput>(() => ({ range, income: income.items, rounds: rounds.items, vouchers: vouchers.items, lines: lines.items, funds: funds.items, entries: entries.items, types: types.list, cats: cats.list, expenses: expenses.items, passbook: passbook.items }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.from, range.to, income.items, rounds.items, vouchers.items, lines.items, funds.items, entries.items, types.list, cats.list, expenses.items, passbook.items])
  const L = useMemo(() => computeLedger(input), [input])
  // เดือน/ไตรมาส/ปี: ใบที่ 1 = ใบสรุปแยกช่วงย่อย · ใบที่ 2 = สถิติ (กราฟ)
  const series = useMemo(() => computeSeries(input, kind), [input, kind])
  const active = (b: { inTotal: number; outTotal: number }) => b.inTotal > 0 || b.outTotal > 0
  const tableBuckets = series.filter(active) // ตารางแสดงเฉพาะช่วงที่มีรายการจริง
  const catBars = useMemo(() => {
    const val = (r?: { cash: { amt: number }; transfer: { amt: number }; pending?: { amt: number } }) => (r ? r.cash.amt + r.transfer.amt + (r.pending?.amt ?? 0) : 0)
    const gs = cats.list.filter((c) => c.kind === 'group' && c.active).sort((a, b) => a.order - b.order)
    const rows = gs.map((g) => ({ code: g.code, label: g.name, value: val(L.outRows.find((r) => r.key === g.id)) }))
    const un = L.outRows.find((r) => r.key === '__uncat' || (gs.length === 0))
    return gs.length > 0 ? [...rows, ...(un && gs.length > 0 && un.key === '__uncat' ? [{ code: '—', label: 'ยังไม่ระบุหมวด', value: val(un) }] : [])] : L.outRows.map((r, i) => ({ code: String(i + 1), label: r.label, value: val(r) }))
  }, [L, cats.list])
  const first = series.findIndex(active), lastI = series.length - 1 - [...series].reverse().findIndex(active)
  const chartBuckets = first < 0 ? [] : series.slice(first, lastI + 1) // กราฟตัดช่วงว่างหัว-ท้ายออก
  const { incRows, outRows, inSum, outSum } = L
  const paperRef = useRef<HTMLDivElement>(null)
  const paper2Ref = useRef<HTMLDivElement>(null)

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
  const tabBtn = (k: SumKind, n: number, text: string) => <button type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}><i className="dot">{n}</i><span>{text}</span></button>

  const church = settings.churchName
  const dateLine = <span>วันที่ ........../........../..........</span>

  return (
    <div role="tabpanel" aria-label="สรุป" className="mode-sum">
      <PeriodBar label={label} rangeText={rangeText} {...nav} />
      <div className="subtabs subtabs--sum no-print" role="tablist" aria-label="ช่วงของใบสรุป">
        {tabBtn('week', 1, 'สัปดาห์')}{tabBtn('month', 2, 'เดือน')}{tabBtn('quarter', 3, 'ไตรมาส')}{tabBtn("year", 4, `ปี ${be}`)}
      </div>

      {(
        <>
          <div className="sheet-1">
          {kind === 'week' && <p className={`badge ${wkClose ? 'badge--good' : ''} no-print`} role="status">{wkClose ? '✓ ตรวจกับสมุดบัญชีแล้ว' : 'ยังไม่ได้ตรวจกับสมุดบัญชี (ขั้น 3 ปรับ) — พิมพ์ไปแปะได้ แต่ควรปรับสมุดก่อน'}</p>}
          {sheetBar(1, `ใบที่ 1 — ใบสรุปรับ-จ่าย${kindWord === 'ปี' ? 'ทั้งปี' : `ราย${kindWord}`}`)}
          {kind === 'week' ? (
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
          {bank && (bank.deposits.length > 0 || bank.withdraws.length > 0) && (
            <p className="a4note">สมุดบัญชีสัปดาห์นี้: {bank.deposits.length > 0 && <>ฝากเงินสด {fmtBaht(bank.depositSum)} (นับแล้วในใบถวาย) </>}{bank.withdraws.length > 0 && <>· ถอนเงินสด {fmtBaht(bank.withdrawSum)} (ย้ายเงินสดมาจ่าย รายจ่ายนับตามบิลที่จ่ายจริง ไม่นับซ้ำ) </>}· เงินโอนเข้า-ออกที่ไม่มีสลิป/บิลอยู่ในตารางรายรับ-รายจ่ายด้านบนแล้ว (บรรทัด “ไม่ทราบที่มา/ไม่ทราบรายจ่าย”) · รหัสในสมุด: {CODE_LEGEND}</p>
          )}
          {wkClose && <p className="a4note">✓ ตรวจกับสมุดบัญชีธนาคารแล้ว{wkClose.bankBalance !== undefined ? <> · ยอดคงเหลือตามสมุด ณ สิ้นสัปดาห์ <b>{fmtBaht(wkClose.bankBalance)}</b> บาท</> : null}</p>}
          {outSum.pending > 0 && <p className="a4note">ยอดค้างจ่ายที่ต้องเตรียมเบิก (วางบิลที่ยังไม่จ่าย + สำรองจ่ายที่ยังไม่คืนเงิน): <b>{fmtBaht(outSum.pending)}</b> บาท</p>}
          <div className="sign" style={{ display: 'grid' }}>
            <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br />{dateLine}</div>
            <div>ผู้ตรวจสอบ<br />{dateLine}</div>
            <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br />{dateLine}</div>
          </div>
        </>
      </ScaledPage>
          ) : (
          <ScaledPage ref={paperRef}>
            <>
              <div className="a4head"><b>สรุปรับ-จ่ายประจำ{kindWord} · {church}</b><span>{period}</span></div>
              <div className="kpis">
                <div><span>รวมรายรับ</span><b>{fmtBaht(inSum.cash + inSum.transfer, { dec: false })}</b></div>
                <div><span>รวมรายจ่าย</span><b>{fmtBaht(outSum.cash + outSum.transfer + outSum.pending, { dec: false })}</b></div>
                <div><span>คงเหลือ</span><b>{fmtBaht(inSum.cash + inSum.transfer - outSum.cash - outSum.transfer - outSum.pending, { dec: false })}</b></div>
                <div><span>ค้างจ่าย (ต้องเตรียมเบิก)</span><b>{fmtBaht(outSum.pending, { dec: false })}</b></div>
              </div>
              <table className="tbl tbl--paper stat-table" aria-label={`สรุปราย${kind === 'month' ? 'สัปดาห์' : 'เดือน'}`}>
                <thead>
                  <tr><th rowSpan={2}>{kind === 'month' ? 'สัปดาห์ (วันที่)' : 'เดือน'}</th><th colSpan={3} className="grp">รายรับ</th><th colSpan={4} className="grp vthick">รายจ่าย</th><th rowSpan={2} className="num vthick">คงเหลือ</th></tr>
                  <tr><th className="num">เงินสด</th><th className="num">โอน</th><th className="num">รวม</th><th className="num vthick">เงินสด</th><th className="num">โอน</th><th className="num">ค้างจ่าย</th><th className="num">รวม</th></tr>
                </thead>
                <tbody>
                  {tableBuckets.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center' }}>ยังไม่มีรายการในช่วงนี้</td></tr>}
                  {tableBuckets.map((b) => (
                    <tr key={b.from}>
                      <td>{b.label}</td>
                      <td className="num">{b.inCash ? fmtBaht(b.inCash) : ''}</td><td className="num">{b.inTransfer ? fmtBaht(b.inTransfer) : ''}</td><td className="num"><b>{b.inTotal ? fmtBaht(b.inTotal) : ''}</b></td>
                      <td className="num vthick">{b.outCash ? fmtBaht(b.outCash) : ''}</td><td className="num">{b.outTransfer ? fmtBaht(b.outTransfer) : ''}</td><td className="num">{b.pending ? fmtBaht(b.pending) : ''}</td><td className="num"><b>{b.outTotal ? fmtBaht(b.outTotal) : ''}</b></td>
                      <td className="num vthick"><b>{b.inTotal || b.outTotal ? fmtBaht(b.balance) : ''}</b></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <td>รวม{kindWord === 'ปี' ? 'ทั้งปี' : kindWord}</td>
                  <td className="num">{fmtBaht(inSum.cash)}</td><td className="num">{fmtBaht(inSum.transfer)}</td><td className="num">{fmtBaht(inSum.cash + inSum.transfer)}</td>
                  <td className="num vthick">{fmtBaht(outSum.cash)}</td><td className="num">{fmtBaht(outSum.transfer)}</td><td className="num">{fmtBaht(outSum.pending)}</td><td className="num">{fmtBaht(outSum.cash + outSum.transfer + outSum.pending)}</td>
                  <td className="num vthick">{fmtBaht(inSum.cash + inSum.transfer - outSum.cash - outSum.transfer - outSum.pending)}</td>
                </tr></tfoot>
              </table>
              <div className="two-col">
                <div>
                  <div className="ledger__band" style={{ background: '#1b8a4b' }}>รายรับตามประเภทถวาย</div>
                  <table className="tbl tbl--paper mini-table" aria-label="รายรับตามประเภท">
                    <thead><tr><th>ประเภท</th><th className="num">รายการ</th><th className="num">จำนวนเงิน</th></tr></thead>
                    <tbody>{incRows.filter((r) => r.cash.amt + r.transfer.amt > 0).map((r) => <tr key={r.key}><td>{r.label}</td><td className="num">{r.cash.n + r.transfer.n}</td><td className="num">{fmtBaht(r.cash.amt + r.transfer.amt)}</td></tr>)}</tbody>
                    <tfoot><tr><td>รวม</td><td className="num">{incRows.reduce((a, r) => a + r.cash.n + r.transfer.n, 0)}</td><td className="num">{fmtBaht(inSum.cash + inSum.transfer)}</td></tr></tfoot>
                  </table>
                </div>
                <div>
                  <div className="ledger__band" style={{ background: '#b3261e' }}>รายจ่ายตามหมวดหลัก</div>
                  <table className="tbl tbl--paper mini-table" aria-label="รายจ่ายตามหมวด">
                    <thead><tr><th>หมวด</th><th className="num">รายการ</th><th className="num">จำนวนเงิน</th></tr></thead>
                    <tbody>{outRows.map((r) => <tr key={r.key}><td>{r.label}</td><td className="num">{r.cash.n + r.transfer.n + (r.pending?.n ?? 0)}</td><td className="num">{fmtBaht(r.cash.amt + r.transfer.amt + (r.pending?.amt ?? 0))}</td></tr>)}</tbody>
                    <tfoot><tr><td>รวม</td><td className="num">{outRows.reduce((a, r) => a + r.cash.n + r.transfer.n + (r.pending?.n ?? 0), 0)}</td><td className="num">{fmtBaht(outSum.cash + outSum.transfer + outSum.pending)}</td></tr></tfoot>
                  </table>
                </div>
              </div>
              {outSum.pending > 0 && <p className="a4note">ค้างจ่ายที่ต้องเตรียมเบิก (วางบิลที่ยังไม่จ่าย + สำรองจ่ายที่ยังไม่คืนเงิน): <b>{fmtBaht(outSum.pending)}</b> บาท · คงเหลือ = รายรับ − รายจ่าย (รวมค้างจ่าย)</p>}
              <div className="sign" style={{ display: 'grid' }}>
                <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br />{dateLine}</div>
                <div>ผู้ตรวจสอบ<br />{dateLine}</div>
                <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br />{dateLine}</div>
              </div>
            </>
          </ScaledPage>
          )}
          </div>
          <div className="sheet-2">
          {sheetBar(2, `ใบที่ 2 — สถิติรับ-จ่าย${kindWord === 'ปี' ? 'ทั้งปี' : `ราย${kindWord}`} (แนวนอน)`)}
          <ScaledPage ref={paper2Ref} landscape>
            <>
              <div className="a4head"><b>สถิติรับ-จ่ายประจำ{kindWord} · {church}</b><span>{period}</span></div>
              <Legend />
              <div className="land-grid">
                <div>
                  <div className="stat-title">รายรับ-รายจ่ายแยกตาม{kind === 'week' ? 'วัน' : kind === 'month' ? 'สัปดาห์ (วันที่)' : 'เดือน'}</div>
                  <GroupedBars buckets={chartBuckets} height={190} />
                  <div className="stat-title">คงเหลือสะสม (รับ − จ่าย)</div>
                  <CumLine buckets={chartBuckets} height={120} />
                </div>
                <div>
                  <div className="stat-title">สัดส่วนรายรับตามประเภทถวาย (บาท · %)</div>
                  <Donut rows={topRows(incRows, 6)} tone="in" />
                  <div className="stat-title">สัดส่วนรายจ่ายตามหมวดหลัก (บาท · %)</div>
                  <Donut rows={topRows(outRows, 6)} tone="out" />
                </div>
              </div>
              <div className="stat-title" style={{ marginTop: 6 }}>รายจ่ายแยกตามหมวดหลัก — ทุกหมวด (บาท · แท่งสูง = จ่ายมาก · แต่ละหมวดคนละสี)</div>
              <CatBars height={150} cats={catBars} />
              <p className="a4note">รายรับ: ใบถวาย + สลิป + บันทึกด้วยมือ · รายจ่าย: ใบเบิกที่จ่ายแล้ว + บันทึกด้วยมือ/วางบิล/สำรองจ่าย (รวมค้างจ่าย) · ข้อมูลเดียวกับใบที่ 1 ทุกตัวเลข · ชี้ที่แท่งหรือจุดเพื่อดูตัวเลข</p>
            </>
          </ScaledPage>
          </div>
        </>
      )}
      <p className="muted small no-print" style={{ textAlign: 'center' }}>รายรับ: ใบถวาย + สลิป + บันทึกด้วยมือ · รายจ่าย: ใบเบิกที่จ่ายแล้ว + บันทึกตรงในงบ + บันทึกด้วยมือ/วางบิล/สำรองจ่าย (ที่ยังไม่จ่ายแสดงในช่อง “ค้างจ่าย”) · เงินโอนวันจันทร์–อาทิตย์นับรวมในใบวันอาทิตย์ของสัปดาห์นั้น</p>
    </div>
  )
}
