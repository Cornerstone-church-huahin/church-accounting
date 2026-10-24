import { useMemo, useRef, useState } from 'react'
import NoticePaper from './NoticePaper'
import { can } from '../lib/access'
import { useRole } from '../lib/members'
import { useLoans, useSettings } from '../lib/data'
import { fmtBaht, sheetSunday, sundaysOf, todayISO, weekRange, weekTitle } from '../lib/money'
import { expenseLines, weekNotice } from '../lib/notice'
import { summarizeLoans } from '../lib/loans'
import { useBalances } from '../lib/useBalances'
import { computeLedger, rangeOf } from '../lib/weekLedger'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })

/**
 * ภาพรวมรายรับ-รายจ่าย (ดูอย่างเดียว ใช้ในทุกงาน)
 * โซน 1: เงินคริสตจักร ณ วันนี้ (6 ช่อง ไม่มีลิงก์) · โซน 2: ใบสรุปรายรับ-รายจ่ายประจำสัปดาห์ของสัปดาห์ที่เลือก · โซน 3: แถบสัปดาห์ย้อนหลัง (แตะแล้วโซน 2 เปลี่ยนตาม)
 */
export default function OverviewView({ year }: { year: number }) {
  const { settings } = useSettings()
  const showTiles = can(useRole(), 'detail')
  const { balances: b, input } = useBalances(year)
  const ls = summarizeLoans(useLoans().items)
  const church = settings.churchName.split(' ')[0]
  const paper = useRef<HTMLDivElement[]>([])
  const zone2 = useRef<HTMLDivElement>(null)
  const weeks = useMemo(() => {
    const today = todayISO()
    return sundaysOf(year).filter((s) => s <= sheetSunday(today)).reverse().map((sunday) => {
      const range = rangeOf('week', year, { sunday })
      const L = computeLedger({ range, ...input, withFunds: false })
      return { sunday, n: weekNotice(L, expenseLines(range, { vouchers: input.vouchers, expenses: input.expenses, entries: input.entries })) }
    }).filter((w) => w.n.inc.length + w.n.fund.length + w.n.out.length > 0)
  }, [year, input])
  const [pick, setPick] = useState<string | null>(null)
  const cur = weeks.find((w) => w.sunday === pick) ?? weeks[0]
  const tiles: [string, string, string, string][] = [
    ['own', '🏠 หมุนเวียน', fmtBaht(b.own.balance, { dec: false }), 'เงินหมุนเวียน'], ['fund', '💰 กองทุน', fmtBaht(b.fundTotal, { dec: false }), 'กองทุน'], ['total', '🧮 รวมเงินสด', fmtBaht(b.total, { dec: false }), 'รวมเงินสด'],
    ['indebt', '🔁 หนี้ภายใน', fmtBaht(ls.fromFunds, { dec: false }), 'หนี้ภายใน'], ['debt', '🧾 หนี้ภายนอก', fmtBaht(ls.external, { dec: false }), 'หนี้ภายนอก'], ['land', '🏞️ ภาระที่ดิน', '6,000,000', 'ภาระที่ดิน'],
  ]
  return (
    <div className="ovw">
      {showTiles && <section aria-label="โซน 1 เงินคริสตจักร ณ วันนี้">
        <p className="home-label">เงินคริสตจักร ณ วันนี้</p>
        <div className="balance-tiles" role="group" aria-label="เงินคริสตจักร: ดูอย่างเดียว">
          {tiles.map(([k, l, v, a]) => <div key={k} className={`btile btile--${k}`} aria-label={`${a} ${v}`}><small>{l}</small><b>{v}</b></div>)}
        </div>
      </section>}
      <section aria-label="โซน 2 ใบสรุปรายรับ-รายจ่ายประจำสัปดาห์" ref={zone2} className="ovw__paper">
        {cur ? <NoticePaper pagesRef={paper} church={church} sunday={cur.sunday} n={cur.n} /> : <p className="empty">ยังไม่มีรายการรับ-จ่ายในปี {year + 543}</p>}
      </section>
      <section aria-label="โซน 3 สัปดาห์ย้อนหลัง">
        <p className="home-label">สัปดาห์ย้อนหลัง <span>(แตะเพื่อดูใบสรุปของสัปดาห์นั้น)</span></p>
        <ul className="sumlist">
          {weeks.map((w) => (
            <li key={w.sunday}>
              <button type="button" className={`sumrow${cur?.sunday === w.sunday ? ' on' : ''}`} aria-pressed={cur?.sunday === w.sunday} onClick={() => { setPick(w.sunday); zone2.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }} aria-label={`ดูใบสรุป ${weekTitle(w.sunday)}`}>
                <span className="sumrow__t"><b>{weekTitle(w.sunday).replace(' ของเดือน', ' · ')}</b><span className="small muted">{weekRange(w.sunday)}</span></span>
                <span className="sumrow__n"><span className="sumrow__in">รับ {m(w.n.totalInc)}</span><span className="sumrow__out">จ่าย {m(w.n.totalOut)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
