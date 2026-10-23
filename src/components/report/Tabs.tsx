import { useMemo, useState } from 'react'
import PeriodBar from '../PeriodBar'
import { HBars, GroupBars, Lines, money, TONE } from './charts'
import { Card, Follow, IncTable, Kpis, OutTable, StatusLine } from './parts'
import { fmtDate, monthName, monthShort, sheetSunday, sundaysOf, todayISO, weekRange, weekTitle, be } from '../../lib/money'
import { fundAsOf, fundTable, fundsOf, monthRange, monthWeeks, periodReport, yearMonths, type ReportInput } from '../../lib/report'
import { rangeOf } from '../../lib/weekLedger'
import { computeBalances } from '../../lib/balances'
import { circulatingOnly } from '../../lib/balances'
import type { Loan } from '../../lib/types'

interface TabProps { year: number; a: ReportInput; detail: boolean; /** ภาพรวมดูอย่างเดียว: ไม่มีทางเจาะรายการ/เปิดใบประกาศ */ view?: boolean }

/** เปิด/ปิดรายการยาว ๆ (พับไว้ก่อน) */
const Fold = ({ title, children }: { title: string; children: React.ReactNode }) => <details className="rfold"><summary>{title}</summary>{children}</details>

const pickNote = (detail: boolean, view?: boolean) => view ? '' : detail ? 'แตะแท่งเพื่อดูรายการที่ประกอบเป็นยอดนั้น' : 'ดูรายการละเอียดได้เฉพาะผู้มีสิทธิ์ดูรายงานภายใน'

export function WeekTab({ year, a, detail, view, sunday, setSunday, openNotice }: TabProps & { sunday: string; setSunday: (s: string) => void; openNotice: () => void }) {
  const [cat, setCat] = useState<string | null>(null), [inc, setInc] = useState<string | null>(null)
  const all = useMemo(() => sundaysOf(year).filter((s) => s <= sheetSunday(todayISO())), [year])
  const i = all.indexOf(sunday)
  const r = useMemo(() => periodReport(rangeOf('week', year, { sunday }), a), [a, year, sunday])
  return (
    <>
      {all.length > 0 && <PeriodBar label={weekTitle(sunday).replace(' ของเดือน', ' · ')} rangeText={weekRange(sunday)} canPrev={i > 0} canNext={i >= 0 && i < all.length - 1} onPrev={() => { setSunday(all[i - 1]); setCat(null); setInc(null) }} onNext={() => { setSunday(all[i + 1]); setCat(null); setInc(null) }} />}
      <StatusLine r={r} range={r.range} />
      {r.empty ? <p className="empty">ยังไม่มีรายการรับ-จ่ายในสัปดาห์นี้</p> : <>
        <Kpis items={[{ label: 'รายรับหมุนเวียน', value: money(r.inTotal), tone: 'in' }, { label: 'เงินจ่ายออก', value: money(r.outTotal), tone: 'out', sub: r.advance > 0 ? `= ค่าใช้จ่าย ${money(r.expenseTotal)} + สำรองจ่ายรอคืน ${money(r.advance)}` : undefined }, { label: 'ส่วนต่างรับ–จ่าย', value: money(r.net), tone: 'bal' }, { label: 'เงินถวายเข้ากองทุน', value: money(r.fundTotal), sub: 'แยกจากรายรับหมุนเวียน' }]} />
        <Card title="01 รายรับเข้าจากที่ใด" hint={pickNote(detail, view)}>
          <HBars title="รายรับแยกประเภท" tone="in" bars={r.incBars} active={inc} onPick={detail ? (k) => setInc(inc === k ? null : k) : undefined} />
          {r.fundBars.length > 0 && <><p className="small" style={{ margin: 0 }}><b>เงินถวายเข้ากองทุน</b> (ไม่รวมในรายรับหมุนเวียน)</p><HBars title="เงินถวายกองทุน" tone="bal" bars={r.fundBars} /></>}
          {detail && inc && <IncTable title="รายการรายรับ" lines={r.incLines.filter((x) => x.typeId === inc)} />}
        </Card>
        <Card title="02 ค่าใช้จ่ายแยกหมวด" hint={pickNote(detail, view)}>
          <HBars title="ค่าใช้จ่ายแยกหมวด" tone="out" bars={r.catBars} active={cat} onPick={detail ? (k) => setCat(cat === k ? null : k) : undefined} />
          {r.advance > 0 && <p className="small" style={{ margin: 0 }}>เงินสำรองจ่ายรอคืนเงิน (แยกจากค่าใช้จ่าย): <b style={{ color: TONE.out }}>{money(r.advance)}</b></p>}
          {detail && cat && <OutTable title="รายการจ่ายของหมวด" lines={r.outLines.filter((l) => l.catKey === cat && l.status !== 'advance')} />}
        </Card>
        {detail && <Card title="03 รายละเอียดรายการจ่ายทั้งหมด"><Fold title={`ดูทั้ง ${r.outLines.length} รายการ`}><OutTable title="รายการจ่ายทั้งหมด" lines={r.outLines} /></Fold></Card>}
        {detail && <Follow items={r.follow} />}
      </>}
      {!view && <div className="row no-print" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--gold" onClick={openNotice} disabled={r.empty}>📄 เปิดใบสรุปรายสัปดาห์ (ติดประกาศ / พิมพ์ / PDF)</button>
      </div>}
    </>
  )
}

export function MonthTab({ year, a, detail, view, month, setMonth, openWeek }: TabProps & { month: number; setMonth: (m: number) => void; openWeek: (sunday: string) => void }) {
  const [wk, setWk] = useState<string | null>(null), [cat, setCat] = useState<string | null>(null)
  const range = monthRange(year, month)
  const r = useMemo(() => periodReport(range, a), [a, year, month]) // eslint-disable-line react-hooks/exhaustive-deps
  const ws = useMemo(() => monthWeeks(year, month, a), [a, year, month])
  const funds = useMemo(() => fundsOf(a), [a])
  const ft = useMemo(() => fundTable(funds, range, a.opening), [funds, a.opening, year, month]) // eslint-disable-line react-hooks/exhaustive-deps
  const curM = year === Number(todayISO().slice(0, 4)) ? Number(todayISO().slice(5, 7)) : 12
  const sel = ws.find((w) => w.sunday === wk)
  const partials = ws.filter((w) => w.partial)
  return (
    <>
      <PeriodBar label={`${monthName(month)} ${be(year)}`} rangeText={`${fmtDate(range.from)} – ${fmtDate(range.to)}`} canPrev={month > 1} canNext={month < curM} onPrev={() => { setMonth(month - 1); setWk(null); setCat(null) }} onNext={() => { setMonth(month + 1); setWk(null); setCat(null) }} />
      <StatusLine r={r} range={range} />
      {r.empty ? <p className="empty">ยังไม่มีรายการในเดือนนี้</p> : <>
        <Kpis items={[{ label: 'รายรับหมุนเวียนรวมเดือน', value: money(r.inTotal), tone: 'in' }, { label: 'เงินจ่ายออกรวมเดือน', value: money(r.outTotal), tone: 'out', sub: r.advance > 0 ? `ค่าใช้จ่าย ${money(r.expenseTotal)} + สำรองจ่ายรอคืน ${money(r.advance)}` : undefined }, { label: 'ส่วนต่าง', value: money(r.net), tone: 'bal' }, { label: 'เงินถวายเข้ากองทุน', value: money(r.fundTotal), sub: 'แยกจากรายรับหมุนเวียน' }]} />
        <Card title="01 เปรียบเทียบรับ–จ่ายแต่ละสัปดาห์" hint={view ? 'ยอดนับเฉพาะวันที่อยู่ในเดือนนี้' : 'แตะช่วงสัปดาห์เพื่อดูรายการ · ยอดนับเฉพาะวันที่อยู่ในเดือนนี้'}>
          <GroupBars title="รับ-จ่ายรายสัปดาห์" items={ws.map((w) => ({ key: w.sunday, label: `${Number(w.clipped.from.slice(8))}–${Number(w.clipped.to.slice(8))}`, a: w.report.inTotal, b: w.report.outTotal, note: w.report.empty ? 'ไม่มีข้อมูล' : w.partial ? 'บางส่วน' : undefined }))} active={wk} onPick={view ? undefined : (k) => setWk(wk === k ? null : k)} />
          {partials.length > 0 && <p className="muted small" style={{ margin: 0 }}>สัปดาห์ที่คร่อมเดือน ({partials.map((w) => weekRange(w.sunday)).join(' · ')}) กราฟนี้นับเฉพาะวันที่อยู่ในเดือน — รายงานสัปดาห์เต็มอาจมียอดต่างจากช่วงที่ตัดเฉพาะเดือน</p>}
          {sel && <div className="rsel" role="region" aria-label={`สัปดาห์ ${weekRange(sel.sunday)}`}>
            <b>{weekRange(sel.sunday)}</b> · รับ {money(sel.report.inTotal)} · จ่าย {money(sel.report.outTotal)}{sel.partial ? ' (เฉพาะวันในเดือน)' : ''}
            {detail && <OutTable title="รายการจ่ายของสัปดาห์" lines={sel.report.outLines} />}
            <button type="button" className="btn btn--gold" onClick={() => openWeek(sel.sunday)}>เปิดรายงานสัปดาห์เต็ม ›</button>
          </div>}
        </Card>
        <Card title="02 ค่าใช้จ่ายรวมเดือนแยกหมวด" hint={pickNote(detail, view)}>
          <HBars title="ค่าใช้จ่ายรวมเดือน" tone="out" bars={r.catBars} active={cat} onPick={detail ? (k) => setCat(cat === k ? null : k) : undefined} />
          {r.advance > 0 && <p className="small" style={{ margin: 0 }}>เงินสำรองจ่ายรอคืนเงิน (แยกจากค่าใช้จ่าย): <b style={{ color: TONE.out }}>{money(r.advance)}</b></p>}
          {detail && cat && <OutTable title="รายการจ่ายของหมวด" lines={r.outLines.filter((l) => l.catKey === cat && l.status !== 'advance')} />}
        </Card>
      </>}
      {detail && <Card title="03 กองทุนประจำเดือน" hint="ยอดต้นเดือน + รับ − จ่าย ± โอน/เงินยืม = ยอดปลายเดือน (คำนวณจากรายการเคลื่อนไหว)">
        {ft.length === 0 ? <p className="empty">ยังไม่มีกองทุน</p> : <div className="rtblwrap"><table className="tbl rtbl" aria-label="ตารางกองทุนประจำเดือน">
          <thead><tr><th>กองทุน</th><th className="num">ต้นเดือน</th><th className="num">รับเข้า</th><th className="num">จ่ายออก</th><th className="num">โอน/ยืม</th><th className="num">ปลายเดือน</th></tr></thead>
          <tbody>{ft.map((f) => <tr key={f.id}><td>{f.name}</td><td className="num">{f.start === null ? <small>ข้อมูลยังไม่ครบ</small> : money(f.start)}</td><td className="num">{money(f.moneyIn)}</td><td className="num">{money(f.moneyOut)}</td><td className="num">{money(f.transfer)}</td><td className="num">{f.end === null ? <small>ข้อมูลยังไม่ครบ</small> : money(f.end)}</td></tr>)}</tbody>
        </table></div>}
        {ft.some((f) => f.start === null) && <p className="muted small" style={{ margin: 0 }}>“ข้อมูลยังไม่ครบ” = เดือนนี้เริ่มก่อนหรือตรงวันตัดยอดตั้งต้น (หรือยังไม่ตั้งยอดตั้งต้น) ระบบจึงไม่นำยอดปัจจุบันมาแทน</p>}
      </Card>}
      {detail && !r.empty && <Follow items={r.follow} />}
    </>
  )
}

export function YearTab({ year, a, detail, view, loans, openMonth }: TabProps & { loans: Loan[]; openMonth: (m: number) => void }) {
  const [cat, setCat] = useState<string | null>(null)
  const today = todayISO(), endY = `${year}-12-31`
  const ref = today < endY ? (today < `${year}-01-01` ? `${year}-01-01` : today) : endY
  const ongoing = ref < endY
  const months = useMemo(() => yearMonths(year, a), [a, year])
  const yr = useMemo(() => periodReport(rangeOf('year', year), a), [a, year])
  const funds = useMemo(() => fundsOf(a), [a])
  const b = useMemo(() => computeBalances({ ...a, opening: a.opening, today: ref, loans }), [a, ref, loans])
  const bal = useMemo(() => fundAsOf(funds, ref, a.opening), [funds, ref, a.opening])
  const ft = useMemo(() => fundTable(funds, { from: `${year}-01-01`, to: ref }, a.opening), [funds, year, ref, a.opening])
  const withData = months.filter((m) => !m.report.empty)
  const known = bal.every((f) => f.balance !== null)
  const title = ongoing ? `ภาพรวมปีถึงวันที่ ${fmtDate(ref)}` : `ภาพรวมปี ${be(year)} (ครบปีปฏิทิน)`
  return (
    <>
      <h3 style={{ margin: '0.75rem 0 0' }}>{title}</h3>
      <StatusLine empty={yr.empty} range={{ from: `${year}-01-01`, to: ref }} />
      {yr.empty && <p className="empty">ยังไม่มีรายการในปี {be(year)}</p>}
      {!yr.empty && <>
        <Kpis items={[{ label: 'รายรับหมุนเวียนสะสมในปี', value: money(yr.inTotal), tone: 'in' }, { label: 'เงินจ่ายออกสะสมในปี', value: money(yr.outTotal), tone: 'out' }, { label: 'ส่วนต่างสะสม', value: money(yr.net), tone: 'bal' }]} />
        <p className="muted small" style={{ margin: 0 }}>ยอดรับ–จ่ายของปี นับเฉพาะเดือนที่มีข้อมูลบันทึก — ไม่ใช่ยอดครบทั้งปี (ถ้ามีเดือนที่ยังไม่บันทึก)</p>
        <Card title={`ยอดคงเหลือ ณ วันที่ ${fmtDate(ref)}`} hint="ยอด ณ วันอ้างอิง — แยกจากยอดรับ–จ่ายระหว่างงวดด้านบน">
          <Kpis items={[{ label: 'เงินหมุนเวียนคงเหลือ', value: money(circulatingOnly(b, loans)), tone: 'bal' }, { label: 'เงินกองทุนคงเหลือ', value: known ? money(bal.reduce((s, f) => s + (f.balance ?? 0), 0)) : 'ข้อมูลยังไม่ครบ', tone: 'bal' }, { label: 'เงินสดและเงินฝากรวม', value: money(b.total), tone: 'bal' }]} />
        </Card>
        <Card title="01 แนวโน้มรับ–จ่ายรายเดือน" hint={view ? 'เดือนที่ไม่มีข้อมูลเว้นว่าง ไม่ลากเป็นศูนย์' : 'แตะจุดเพื่อเปิดแท็บรายเดือน · เดือนที่ไม่มีข้อมูลเว้นว่าง ไม่ลากเป็นศูนย์'}>
          <Lines title="แนวโน้มรายเดือน" points={months.map((m) => ({ key: String(m.month), label: monthShort(m.month), a: m.report.empty ? null : m.report.inTotal, b: m.report.empty ? null : m.report.outTotal, partial: m.partial }))} onPick={view ? undefined : (k) => openMonth(Number(k))} />
          {withData.length === 1 && <p className="small" style={{ margin: 0 }}>มีข้อมูลเพียงเดือน{monthName(withData[0].month)}เดือนเดียว — แสดงเป็นจุด ยังไม่สรุปแนวโน้ม</p>}
          <div className="rtblwrap"><table className="tbl rtbl" aria-label="ตารางรายเดือน">
            <thead><tr><th>เดือน</th><th className="num">รับ</th><th className="num">จ่ายออก</th><th>สถานะ</th></tr></thead>
            <tbody>{months.map((m) => <tr key={m.month}><td>{m.report.empty || view ? monthName(m.month) : <button type="button" className="linkbtn" onClick={() => openMonth(m.month)}>{monthName(m.month)} ›</button>}</td>
              <td className="num">{m.report.empty ? '—' : money(m.report.inTotal)}</td><td className="num">{m.report.empty ? '—' : money(m.report.outTotal)}</td>
              <td><small>{m.report.empty ? 'ยังไม่มีข้อมูล' : m.partial ? `ข้อมูลบางส่วน (${m.weeksWithData}/${m.weeks} สัปดาห์)` : 'มีข้อมูล'}</small></td></tr>)}</tbody>
          </table></div>
        </Card>
        <Card title="02 ค่าใช้จ่ายสะสมทั้งปีแยกหมวด" hint={pickNote(detail, view)}>
          <HBars title="ค่าใช้จ่ายสะสมทั้งปี" tone="out" bars={yr.catBars} active={cat} onPick={detail ? (k) => setCat(cat === k ? null : k) : undefined} />
          {yr.advance > 0 && <p className="small" style={{ margin: 0 }}>เงินสำรองจ่ายรอคืนเงิน (แยกจากค่าใช้จ่าย): <b style={{ color: TONE.out }}>{money(yr.advance)}</b></p>}
          {detail && cat && <Fold title="รายการของหมวดนี้"><OutTable title="รายการจ่ายของหมวด" lines={yr.outLines.filter((l) => l.catKey === cat && l.status !== 'advance')} /></Fold>}
        </Card>
      </>}
      {detail && <Card title="03 เงินคงเหลือแยกกองทุน" hint={`ยอดตามวันอ้างอิง ${fmtDate(ref)} · แตะเพื่อเปิดรายละเอียดกองทุน`}>
        <HBars title="เงินคงเหลือแยกกองทุน" tone="bal" bars={bal.map((f) => ({ key: f.id, label: f.name, amount: f.balance }))} onPick={(k) => { location.hash = `#/funds/${k}` }} />
        {ft.some((f) => f.start !== null) && <Fold title="ตารางการเคลื่อนไหวกองทุนสะสม"><div className="rtblwrap"><table className="tbl rtbl" aria-label="การเคลื่อนไหวกองทุนสะสม">
          <thead><tr><th>กองทุน</th><th className="num">ต้นปี</th><th className="num">รับเข้า</th><th className="num">จ่ายออก</th><th className="num">โอน/ยืม</th><th className="num">ยอดอ้างอิง</th></tr></thead>
          <tbody>{ft.map((f) => <tr key={f.id}><td>{f.name}</td><td className="num">{f.start === null ? <small>ข้อมูลยังไม่ครบ</small> : money(f.start)}</td><td className="num">{money(f.moneyIn)}</td><td className="num">{money(f.moneyOut)}</td><td className="num">{money(f.transfer)}</td><td className="num">{f.end === null ? <small>ข้อมูลยังไม่ครบ</small> : money(f.end)}</td></tr>)}</tbody>
        </table></div></Fold>}
        {!known && <p className="muted small" style={{ margin: 0 }}>บางกองทุน “ข้อมูลยังไม่ครบ” เพราะวันอ้างอิงอยู่ก่อนวันตัดยอดตั้งต้นหรือยังไม่ตั้งยอดตั้งต้น</p>}
      </Card>}
      <p className="muted small">ภาระที่ดินยังไม่เชื่อมเข้ารายงานนี้ (หน้าภาระที่ดินเป็นต้นแบบแยกต่างหาก)</p>
    </>
  )
}
