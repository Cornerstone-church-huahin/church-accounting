import { useMemo, useRef, useState } from 'react'
import NoticePaper from '../components/NoticePaper'
import WeekFile from '../components/WeekFile'
import { MonthTab, WeekTab, YearTab } from '../components/report/Tabs'
import { can } from '../lib/access'
import { useLoans } from '../lib/data'
import { useRole } from '../lib/members'
import { useSettings } from '../lib/data'
import { fmtBaht, sheetSunday, sundaysOf, todayISO } from '../lib/money'
import { summarizeLoans } from '../lib/loans'
import { useWeekWithdraw } from '../lib/useWeekWithdraw'
import { buildPeriod, type PeriodKind } from '../lib/periodData'
import PeriodPaper from '../components/PeriodPaper'
import { expenseLines, weekNotice } from '../lib/notice'
import { canSharePdf, downloadSheetPdf, sharePdf } from '../lib/pdf'
import { periodReport } from '../lib/report'
import { useBalances } from '../lib/useBalances'
import { isFundZone } from '../lib/funds'
import { computeLedger, rangeOf } from '../lib/weekLedger'

type Tab = 'week' | 'month' | 'year'
const TABS: { k: Tab; t: string }[] = [{ k: 'week', t: 'รายสัปดาห์' }, { k: 'month', t: 'รายเดือน' }, { k: 'year', t: 'ภาพรวมปี' }]

/**
 * แท็บ "สรุปและรายงาน": ศูนย์รวมรายงาน 3 ระดับ (รายสัปดาห์ · รายเดือน · ภาพรวมปี) คำนวณจากข้อมูลเดิมชุดเดียวกัน
 * เจาะลงได้ ปี → เดือน → สัปดาห์ → รายการ · ใบสรุปรายสัปดาห์เดิม (ติดประกาศ/พิมพ์/PDF) เปิดจากแท็บรายสัปดาห์
 * รายละเอียดภายใน (ผู้เบิก หลักฐาน รายการต้องติดตาม ตารางกองทุน) แสดงเฉพาะผู้มีสิทธิ์ดูรายงานภายใน
 */
export default function Summary({ year }: { year: number }) {
  const role = useRole()
  const { settings } = useSettings()
  const { input, opening } = useBalances(year)
  const loans = useLoans().items
  // รายงาน/ใบสรุป/แฟ้มรายสัปดาห์ = บัญชีหมุนเวียน: รายรับที่บันทึกจากโซนกองทุนไม่ปนเข้ามา
  const a = useMemo(() => ({ ...input, income: input.income.filter((x) => !isFundZone(x)), opening, loans }), [input, opening, loans])
  const detail = can(role, 'detail')
  const church = settings.churchName.split(' ')[0]
  const today = todayISO()
  const latest = useMemo(() => {
    const ss = sundaysOf(year).filter((s) => s <= sheetSunday(today)).reverse()
    return ss.find((s) => !periodReport(rangeOf('week', year, { sunday: s }), a).empty) ?? ss[0] ?? sheetSunday(`${year}-01-01`)
  }, [year, a, today])
  const [tab, setTab] = useState<Tab>('week')
  const [sunday, setSunday] = useState(latest)
  const [month, setMonth] = useState(() => Number(sheetSunday(latest).slice(5, 7)))
  const [notice, setNotice] = useState<PeriodKind | null>(null)
  const [busy, setBusy] = useState(false)
  const [copy, setCopy] = useState<'evidence' | 'report' | 'public' | 'file'>(detail ? 'evidence' : 'public')
  const kind = detail ? copy : 'public'
  const periodic = notice === 'month' || notice === 'year'
  const fileMode = kind === 'file' && !periodic
  const pad2 = (x: number) => String(x).padStart(2, '0')
  const stamp = notice === 'month' ? `${year}-${pad2(month)}` : notice === 'year' ? String(year) : sunday
  const tag = (kind === 'evidence' ? 'ต้นฉบับ' : kind === 'report' ? 'รายงานที่ประชุม' : 'ประกาศ')
  const paper = useRef<HTMLDivElement[]>([])
  const asOf = sunday <= today ? sunday : today
  const bw = useBalances(year, asOf).balances
  const wd = useWeekWithdraw(year, sunday)
  const meeting = useMemo(() => {
    const ls = summarizeLoans(loans, asOf)
    const f = (x: number) => fmtBaht(x, { dec: false })
    return { tiles: [['🏠 หมุนเวียน', f(bw.own.balance)], ['💰 กองทุน', f(bw.fundTotal)], ['🧮 รวมเงินสด', f(bw.total)], ['🔁 หนี้ภายใน', f(ls.fromFunds)], ['🧾 หนี้ภายนอก', f(ls.external)], ['🏞️ ภาระที่ดิน', '6,000,000']] as [string, string][], withdraw: { totalC: wd.totalC, totalF: wd.totalF, total: wd.total }, follow: periodReport(rangeOf('week', year, { sunday }), a).follow.map((x) => x.text) }
  }, [bw, wd, loans, asOf, a, year, sunday])
  const pd = useMemo(() => (notice === 'month' || notice === 'year' ? buildPeriod(notice, year, month, a, loans) : null), [notice, year, month, a, loans])
  const n = useMemo(() => {
    const range = rangeOf('week', year, { sunday })
    const L = computeLedger({ range, ...a, withFunds: false })
    return weekNotice(L, expenseLines(range, { vouchers: a.vouchers, expenses: a.expenses, entries: a.entries }))
  }, [a, year, sunday])
  const download = async () => {
    if (paper.current.length === 0) return
    setBusy(true)
    try { await downloadSheetPdf(paper.current, `สรุปรับจ่าย-${tag}-${stamp}.pdf`, 'full') } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF แทน') }
    setBusy(false)
  }
  const share = async () => {
    if (paper.current.length === 0) return
    setBusy(true)
    try {
      const file = `สรุปรับจ่าย-${tag}-${stamp}.pdf`
      const r = await sharePdf(paper.current, file, 'full', `สรุปรายรับ-รายจ่าย ${church}`)
      if (r === 'unsupported') { await downloadSheetPdf(paper.current, file, 'full'); alert('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ PDF ให้แทนแล้ว นำไปแชร์ต่อจากไฟล์ที่ดาวน์โหลดได้') }
    } catch (e) { console.error('share', e); alert('แชร์ไม่สำเร็จ — ลองกด “ดาวน์โหลด PDF” แทน') }
    setBusy(false)
  }
  const canExport = can(role, 'detail')
  if (notice) {
    return (
      <>
        <div className="row no-print" style={{ margin: '8px 0', gap: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={() => setNotice(null)}>‹ สรุปและรายงาน</button>
          <span className="grow" />
          {canExport && !fileMode && <>
            <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void download()} aria-label="ดาวน์โหลดใบสรุปเป็น PDF">{busy ? 'กำลังสร้าง…' : '⬇️ ดาวน์โหลด PDF'}</button>
            <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void share()} aria-label="แชร์ใบสรุปเป็น PDF" title={canSharePdf() ? undefined : 'เครื่องนี้จะดาวน์โหลดไฟล์ให้แทน'}>📤 แชร์ PDF</button>
            <button type="button" className="btn btn--ghost" onClick={() => window.print()} aria-label="พิมพ์ใบสรุป">🖨️ พิมพ์</button>
          </>}
        </div>
        <div className="rtabs no-print" role="tablist" aria-label="ช่วงเวลาของใบสรุป">
          {([['week', 'รายสัปดาห์'], ['month', 'รายเดือน'], ['year', 'รายปี']] as [PeriodKind, string][]).map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={notice === k} className={`rtab${notice === k ? ' on' : ''}`} onClick={() => setNotice(k)}>{t}</button>)}
        </div>
        {notice === 'month' && <div className="row no-print" style={{ justifyContent: 'center', gap: 10, margin: '4px 0' }}><button type="button" className="mini" aria-label="เดือนก่อน" disabled={month <= 1} onClick={() => setMonth(month - 1)}>‹</button><b>{pd?.label}</b><button type="button" className="mini" aria-label="เดือนถัดไป" disabled={month >= 12} onClick={() => setMonth(month + 1)}>›</button></div>}
        {detail && (
          <div className="rtabs no-print" role="tablist" aria-label="ฉบับของใบสรุป">
            <button type="button" role="tab" aria-selected={copy === 'evidence'} className={`rtab${copy === 'evidence' ? ' on' : ''}`} onClick={() => setCopy('evidence')}>🔒 สำหรับแอดมินและเหรัญญิก</button>
            {!periodic && <button type="button" role="tab" aria-selected={copy === 'file'} className={`rtab${copy === 'file' ? ' on' : ''}`} onClick={() => setCopy('file')}>🗂️ แฟ้มประจำสัปดาห์</button>}
            <button type="button" role="tab" aria-selected={copy === 'report'} className={`rtab${copy === 'report' ? ' on' : ''}`} onClick={() => setCopy('report')}>📑 รายงานที่ประชุม</button>
            <button type="button" role="tab" aria-selected={copy === 'public'} className={`rtab${copy === 'public' ? ' on' : ''}`} onClick={() => setCopy('public')}>📢 สำหรับประกาศสมาชิก</button>
          </div>
        )}
        {detail && !fileMode && <p className="muted small no-print" style={{ margin: '4px 0' }}>{kind === 'report' ? 'รายงานเสนอที่ประชุม (ใช้ภายในคณะทำงาน): ข้อมูลครบ มีชื่อและเงินเดือนรายคน + เงินคริสตจักรสิ้นสัปดาห์ · ต้องเบิก · เรื่องต้องติดตาม · ช่องลงนาม — ห้ามนำไปติดประกาศหรือแชร์สมาชิก' : kind === 'evidence' ? 'ฉบับเก็บเป็นหลักฐานต้นฉบับ: ข้อมูลครบ มีชื่อผู้เบิก/ผู้สำรองจ่ายและเงินเดือนรายคน — ห้ามนำไปติดประกาศหรือแชร์สมาชิก' : 'ฉบับติดประกาศ/แชร์สมาชิก: ไม่มีชื่อบุคคล เงินเดือนและสวัสดิการผู้รับใช้รวมเป็นแถวเดียว'}</p>}
        {periodic && pd ? <PeriodPaper key={`${notice}-${kind}`} church={church} d={pd} variant={kind === 'report' ? 'report' : kind === 'evidence' ? 'evidence' : 'public'} pagesRef={paper} /> : fileMode ? <WeekFile year={year} a={a} sunday={sunday} church={church} /> : <NoticePaper key={kind} pagesRef={paper} church={church} sunday={sunday} n={n} variant={kind === 'report' ? 'evidence' : (kind as 'evidence' | 'public')} meeting={kind === 'report' ? meeting : undefined} />}
        <p className="muted small no-print" style={{ textAlign: 'center' }}>แตะที่หน้ากระดาษเพื่อขยาย (แตะอีกครั้งเพื่อย่อ){canExport ? '' : ' · ดูได้อย่างเดียว (ดาวน์โหลด/พิมพ์สำหรับผู้บันทึกบัญชีและผู้ตรวจสอบ)'}</p>
      </>
    )
  }
  return (
    <section aria-label="สรุปและรายงาน">
      <h2 style={{ margin: '10px 0 4px' }}>📊 สรุปและรายงาน</h2>
      <div className="rtabs no-print" role="tablist" aria-label="ระดับรายงาน">
        {TABS.map((x) => <button key={x.k} type="button" role="tab" aria-selected={tab === x.k} className={`rtab${tab === x.k ? ' on' : ''}`} onClick={() => setTab(x.k)}>{x.t}</button>)}
      </div>
      {tab === 'week' && <WeekTab year={year} a={a} detail={detail} sunday={sunday} setSunday={setSunday} openNotice={() => setNotice('week')} />}
      {tab === 'month' && <MonthTab year={year} a={a} detail={detail} month={month} setMonth={setMonth} openWeek={(s) => { setSunday(s); setTab('week') }} openNotice={() => setNotice('month')} />}
      {tab === 'year' && <YearTab year={year} a={a} detail={detail} loans={loans} openMonth={(m) => { setMonth(m); setTab('month') }} openNotice={() => setNotice('year')} />}
    </section>
  )
}
