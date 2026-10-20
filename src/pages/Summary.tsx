import { useMemo, useRef, useState } from 'react'
import NoticePaper from '../components/NoticePaper'
import { can } from '../lib/access'
import { useBudgetEntries, useBudgetLines, useExpenseCats, useExpenses, useFunds, useIncome, useIncomeTypes, usePassbook, useRounds, useSettings, useVouchers } from '../lib/data'
import { useRole } from '../lib/members'
import { fmtBaht, sheetSunday, sundaysOf, todayISO, weekRange, weekTitle } from '../lib/money'
import { weekNotice } from '../lib/notice'
import { downloadSheetPdf } from '../lib/pdf'
import { computeLedger, rangeOf } from '../lib/weekLedger'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })

/**
 * แท็บ "สรุป": รายการสัปดาห์ที่ผ่านมาเป็นแถบเล็กยาว (ใหม่สุดอยู่บน) → แตะแล้วเห็นใบสรุปรับ-จ่าย A4 ใบเดียวสำหรับติดประกาศ
 * ใบมีเฉพาะสิ่งที่สมาชิกควรเห็น (ไม่มีวางบิล/สำรองจ่าย/รายละเอียดภายใน) · ดาวน์โหลด/พิมพ์ได้เฉพาะผู้มีสิทธิ์
 */
export default function Summary({ year }: { year: number }) {
  const role = useRole()
  const { settings } = useSettings()
  const income = useIncome(year), rounds = useRounds(year), vouchers = useVouchers(year), lines = useBudgetLines(year), funds = useFunds()
  const entries = useBudgetEntries(year), passbook = usePassbook(year), types = useIncomeTypes(), cats = useExpenseCats(), expenses = useExpenses(year)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const paper = useRef<HTMLDivElement>(null)
  const canExport = can(role, 'detail')
  const church = settings.churchName.split(' ')[0]

  const weeks = useMemo(() => {
    const today = todayISO()
    return sundaysOf(year).filter((s) => s <= sheetSunday(today)).reverse().map((sunday) => {
      const L = computeLedger({ range: rangeOf('week', year, { sunday }), income: income.items, rounds: rounds.items, vouchers: vouchers.items, lines: lines.items, funds: funds.items, entries: entries.items, types: types.list, cats: cats.list, expenses: expenses.items, passbook: passbook.items, withFunds: false })
      return { sunday, n: weekNotice(L) }
    }).filter((w) => w.n.inc.length + w.n.fund.length + w.n.out.length > 0)
  }, [year, income.items, rounds.items, vouchers.items, lines.items, funds.items, entries.items, types.list, cats.list, expenses.items, passbook.items])
  const cur = weeks.find((w) => w.sunday === open)

  const download = async () => {
    if (!paper.current || !cur) return
    setBusy(true)
    try { await downloadSheetPdf([paper.current], `สรุปรับจ่าย-${cur.sunday}.pdf`, 'full') } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF แทน') }
    setBusy(false)
  }

  if (cur) {
    return (
      <>
        <div className="row no-print" style={{ margin: '8px 0', gap: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={() => setOpen(null)}>‹ รายการสัปดาห์</button>
          <span className="grow" />
          {canExport && <>
            <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void download()} aria-label="ดาวน์โหลดใบสรุปเป็น PDF">{busy ? 'กำลังสร้าง…' : '⬇️ ดาวน์โหลด PDF'}</button>
            <button type="button" className="btn btn--ghost" onClick={() => window.print()} aria-label="พิมพ์ใบสรุป">🖨️ พิมพ์</button>
          </>}
        </div>
        <NoticePaper ref={paper} church={church} sunday={cur.sunday} n={cur.n} />
        <p className="muted small no-print" style={{ textAlign: 'center' }}>แตะที่หน้ากระดาษเพื่อขยาย (แตะอีกครั้งเพื่อย่อ){canExport ? '' : ' · ดูได้อย่างเดียว (ดาวน์โหลด/พิมพ์สำหรับผู้บันทึกบัญชีและผู้ตรวจสอบ)'}</p>
      </>
    )
  }
  return (
    <section aria-label="ใบสรุปรายสัปดาห์">
      <h2 style={{ margin: '10px 0 4px' }}>📊 ใบสรุปรายสัปดาห์</h2>
      <p className="muted small" style={{ margin: '0 0 8px' }}>แตะสัปดาห์เพื่อดูใบสรุปรับ-จ่าย (ใหม่สุดอยู่บน) — ใช้ติดประกาศได้</p>
      {weeks.length === 0 ? <p className="empty">ยังไม่มีรายการรับ-จ่ายในปี {year + 543}</p> : (
        <ul className="sumlist">
          {weeks.map((w) => (
            <li key={w.sunday}>
              <button type="button" className="sumrow" onClick={() => setOpen(w.sunday)} aria-label={`เปิดใบสรุป ${weekTitle(w.sunday)}`}>
                <span className="sumrow__t"><b>{weekTitle(w.sunday).replace(' ของเดือน', ' · ')}</b><span className="small muted">{weekRange(w.sunday)}</span></span>
                <span className="sumrow__n"><span className="sumrow__in">รับ {m(w.n.totalInc)}</span><span className="sumrow__out">จ่าย {m(w.n.totalOut)}</span></span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
