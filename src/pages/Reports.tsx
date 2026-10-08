import { useMemo, useState } from 'react'
import BarChart from '../components/BarChart'
import { IconPrint } from '../components/Icons'
import { useBudgetAdjs, useBudgetLines, useIncome, useIncomeTypes, useRounds, useSettings, useVouchers } from '../lib/data'
import { budgetRows, buckets, liveIncome, paidIn, periodOf, shiftPeriod, stageOf, sumBy, type Period, type PeriodKind } from '../lib/ledger'
import { be, fmtBaht, fmtDate, monthName, monthShort, todayISO, yearOf } from '../lib/money'
import { mergeItems } from '../lib/sync'
import type { IncomeEntry, Voucher } from '../lib/types'

const KIND_LABEL: Record<PeriodKind, string> = { week: 'รายสัปดาห์', month: 'รายเดือน', year: 'รายปี' }

function periodTitle(p: Period): string {
  if (p.kind === 'week') return `สัปดาห์ ${fmtDate(p.from)} – ${fmtDate(p.to)}`
  if (p.kind === 'month') return `เดือน${monthName(Number(p.from.slice(5, 7)))} ${be(yearOf(p.from))}`
  return `ปี ${be(yearOf(p.from))}`
}

/** ข้อมูลของช่วงเวลา: สัปดาห์/เดือนที่คาบเกี่ยวปีใหม่ต้องรวมไฟล์ 2 ปี */
function usePeriodData(p: Period) {
  const y1 = yearOf(p.from), y2 = yearOf(p.to)
  const i1 = useIncome(y1), i2 = useIncome(y2)
  const v1 = useVouchers(y1), v2 = useVouchers(y2)
  const r1 = useRounds(y1), r2 = useRounds(y2)
  const income: IncomeEntry[] = mergeItems(i1.items, i2.items)
  const vouchers: Voucher[] = mergeItems(v1.items, v2.items)
  const rounds = mergeItems(r1.items, r2.items)
  return { income, vouchers, rounds }
}

export default function Reports() {
  const [kind, setKind] = useState<PeriodKind>('week')
  const [p, setP] = useState<Period>(() => periodOf('week', todayISO()))
  const pick = (k: PeriodKind) => { setKind(k); setP(periodOf(k, p.from)) }
  // key ทำให้สลับช่วงเวลาข้ามปีแล้วโหลดไฟล์ปีที่ถูกต้อง
  return <Report key={`${yearOf(p.from)}-${yearOf(p.to)}`} kind={kind} pick={pick} p={p} setP={setP} />
}

function Report({ kind, pick, p, setP }: { kind: PeriodKind; pick: (k: PeriodKind) => void; p: Period; setP: (p: Period) => void }) {
  const { settings } = useSettings()
  const types = useIncomeTypes()
  const { income, vouchers, rounds } = usePeriodData(p)
  const by = yearOf(p.to)
  const lines = useBudgetLines(by)
  const adjs = useBudgetAdjs(by)

  const inc = liveIncome(income, p)
  const paid = paidIn(vouchers, p)
  const totalIn = inc.reduce((s, x) => s + x.amount, 0)
  const totalOut = paid.reduce((s, v) => s + v.amount, 0)

  const incByType = useMemo(() => {
    const m = sumBy(inc, (x) => x.typeId, (x) => x.amount)
    return types.list.filter((t) => t.active || m.has(t.id)).map((t) => ({ name: t.name, value: m.get(t.id) ?? 0 }))
  }, [inc, types.list])
  const lineName = (id: string) => lines.items.find((l) => l.id === id)?.name ?? 'นอกงบประมาณ'
  const outByLine = useMemo(() => {
    const m = sumBy(paid, (v) => v.lineId, (v) => v.amount)
    return [...m.entries()].map(([id, value]) => ({ name: lineName(id), value })).sort((a, b) => b.value - a.value)
  }, [paid, lines.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const bk = buckets(p)
  const flow = bk.map((b) => ({
    label: p.kind === 'year' ? monthShort(Number(b.label)) : b.label,
    inn: inc.filter((x) => x.date >= b.from && x.date <= b.to).reduce((s, x) => s + x.amount, 0),
    out: paid.filter((v) => v.paid!.date >= b.from && v.paid!.date <= b.to).reduce((s, v) => s + v.amount, 0),
  }))
  // งบเทียบใช้จริง: สะสมตั้งแต่ต้นปีถึงสิ้นช่วง (นับเฉพาะที่จ่ายแล้ว)
  const ytd: Period = { kind: 'year', from: `${by}-01-01`, to: p.to }
  const bRows = budgetRows(lines.items, adjs.items, paidIn(vouchers, ytd).map((v) => ({ ...v })))
  const open = vouchers.filter((v) => { const s = stageOf(v); return s === 'review' || s === 'pay' })
  const unverified = rounds.filter((r) => r.status === 'counting' && r.date >= p.from && r.date <= p.to)
  const flowLabel = p.kind === 'year' ? 'เดือน' : p.kind === 'month' ? 'สัปดาห์ (วันที่เริ่ม)' : 'วันที่'

  return (
    <>
      <div className="page-head no-print">
        <h1>รายงาน</h1>
        <button type="button" className="btn btn--gold" onClick={() => window.print()}><IconPrint /> พิมพ์ / บันทึก PDF</button>
      </div>
      <div className="seg no-print" role="group" aria-label="ช่วงเวลา">{(['week', 'month', 'year'] as PeriodKind[]).map((k) => <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => pick(k)}>{KIND_LABEL[k]}</button>)}</div>
      <div className="row row--between no-print">
        <button type="button" className="mini" onClick={() => setP(shiftPeriod(p, -1))}>‹ ก่อนหน้า</button>
        <b>{periodTitle(p)}</b>
        <button type="button" className="mini" onClick={() => setP(shiftPeriod(p, 1))}>ถัดไป ›</button>
      </div>

      <article className="stack" aria-label="รายงานสำหรับพิมพ์">
        <header className="print-only" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.3rem' }}>{settings.churchName}</h1>
          <h2>รายงานรายรับ–รายจ่าย {KIND_LABEL[kind]}</h2>
          <p>{periodTitle(p)}</p>
          <p className="small">ปิดประกาศตั้งแต่ ........../........../.......... ถึง ........../........../.......... เพื่อให้สมาชิกตรวจสอบ</p>
        </header>
        <h2 className="no-print" style={{ fontSize: '1.05rem' }}>{periodTitle(p)}</h2>

        <div className="kpi">
          <div><span>รายรับรวม</span><b>{fmtBaht(totalIn)}</b></div>
          <div><span>รายจ่ายรวม (จ่ายแล้ว)</span><b>{fmtBaht(totalOut)}</b></div>
          <div><span>รับ − จ่าย</span><b className={totalIn - totalOut < 0 ? 'bad' : ''}>{fmtBaht(totalIn - totalOut)}</b></div>
        </div>

        <section className="card" aria-labelledby="r1">
          <h2 id="r1">รายรับแยกตามประเภทถวาย</h2>
          <BarChart title="รายรับแยกตามประเภทถวาย" cats={incByType.map((x) => x.name)} series={[{ name: 'รายรับ', values: incByType.map((x) => x.value), cls: 's1' }]} />
          <Table head="ประเภท" rows={incByType} total={totalIn} />
        </section>

        <section className="card" aria-labelledby="r2">
          <h2 id="r2">รายรับ–รายจ่ายแยกตาม{flowLabel}</h2>
          <BarChart title="รายรับและรายจ่าย" cats={flow.map((f) => f.label)} series={[{ name: 'รายรับ', values: flow.map((f) => f.inn), cls: 's1' }, { name: 'รายจ่าย', values: flow.map((f) => f.out), cls: 's2' }]} />
          <div className="scroll-x"><table className="tbl"><thead><tr><th>{flowLabel}</th><th className="num">รายรับ</th><th className="num">รายจ่าย</th></tr></thead>
            <tbody>{flow.map((f, i) => <tr key={i}><td>{f.label}</td><td className="num">{fmtBaht(f.inn)}</td><td className="num">{fmtBaht(f.out)}</td></tr>)}</tbody>
            <tfoot><tr><td>รวม</td><td className="num">{fmtBaht(totalIn)}</td><td className="num">{fmtBaht(totalOut)}</td></tr></tfoot></table></div>
        </section>

        <section className="card" aria-labelledby="r3">
          <h2 id="r3">รายจ่ายแยกตามหมวดงบประมาณ</h2>
          {outByLine.length === 0 ? <p className="muted">ไม่มีรายจ่ายในช่วงนี้</p> : <BarChart title="รายจ่ายแยกตามหมวด" cats={outByLine.map((x) => x.name)} series={[{ name: 'รายจ่าย', values: outByLine.map((x) => x.value), cls: 's2' }]} />}
          <Table head="หมวด" rows={outByLine} total={totalOut} />
        </section>

        {bRows.length > 0 && p.kind !== 'week' && (
          <section className="card" aria-labelledby="r4">
            <h2 id="r4">งบประมาณเทียบรายจ่ายจริง (สะสมตั้งแต่ ม.ค. ถึง {fmtDate(p.to)})</h2>
            <BarChart title="งบประมาณเทียบรายจ่ายจริง" cats={bRows.map((r) => r.line.name)} series={[{ name: 'งบประมาณ', values: bRows.map((r) => r.current), cls: 's3' }, { name: 'จ่ายจริง', values: bRows.map((r) => r.spent), cls: 's2' }]} />
            <div className="scroll-x"><table className="tbl"><thead><tr><th>หมวด</th><th className="num">งบ</th><th className="num">จ่ายจริง</th><th className="num">คงเหลือ</th></tr></thead>
              <tbody>{bRows.map((r) => <tr key={r.line.id}><td>{r.line.name}</td><td className="num">{fmtBaht(r.current)}</td><td className="num">{fmtBaht(r.spent)}</td><td className={`num ${r.current - r.spent < 0 ? 'bad' : ''}`}>{fmtBaht(r.current - r.spent)}</td></tr>)}</tbody>
              <tfoot><tr><td>รวม</td><td className="num">{fmtBaht(bRows.reduce((s, r) => s + r.current, 0))}</td><td className="num">{fmtBaht(bRows.reduce((s, r) => s + r.spent, 0))}</td><td className="num">{fmtBaht(bRows.reduce((s, r) => s + r.current - r.spent, 0))}</td></tr></tfoot></table></div>
          </section>
        )}

        <section className="card card--flat" aria-label="หมายเหตุ">
          <p className="small">หมายเหตุ: รายรับนับเมื่อผู้นับคนที่ 2 ยืนยันยอดแล้ว · รายจ่ายนับเมื่อจ่ายเงินแล้วตามวันที่จ่าย{open.length > 0 && ` · ขณะนี้มีใบเบิกยื่นแล้วยังไม่จ่าย ${open.length} ใบ รวม ${fmtBaht(open.reduce((s, v) => s + v.amount, 0))} บาท`}{unverified.length > 0 && ` · มีรอบนับ ${unverified.length} รอบที่ยังรอยืนยัน (ยังไม่รวมในรายงานนี้)`} · รายงานนี้ไม่แสดงชื่อผู้ถวาย</p>
        </section>

        <div className="sign print-only">
          <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br /><span className="small">วันที่ ........../........../..........</span></div>
          <div>ผู้ตรวจสอบ<br /><span className="small">วันที่ ........../........../..........</span></div>
          <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br /><span className="small">วันที่ ........../........../..........</span></div>
        </div>
        <p className="print-only small" style={{ textAlign: 'center' }}>พิมพ์เมื่อ {fmtDate(todayISO())} · สมาชิกมีข้อสงสัยกรุณาแจ้งผู้ปกครองหรือผู้ตรวจสอบ</p>
      </article>
    </>
  )
}

function Table({ head, rows, total }: { head: string; rows: { name: string; value: number }[]; total: number }) {
  return (
    <div className="scroll-x"><table className="tbl"><thead><tr><th>{head}</th><th className="num">บาท</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td className="num">{fmtBaht(r.value)}</td></tr>)}</tbody>
      <tfoot><tr><td>รวม</td><td className="num">{fmtBaht(total)}</td></tr></tfoot></table></div>
  )
}
