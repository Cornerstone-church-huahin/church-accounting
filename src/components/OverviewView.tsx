import { useMemo, useRef, useState } from 'react'
import NoticePaper from './NoticePaper'
import { can, canSeeBalances } from '../lib/access'
import { useRole } from '../lib/members'
import { useLoans, useSettings } from '../lib/data'
import { fmtBaht, fmtDate, sheetSunday, sundaysOf, todayISO, weekRange, weekTitle } from '../lib/money'
import { expenseLines, weekNotice } from '../lib/notice'
import { summarizeLoans } from '../lib/loans'
import { isFundZone } from '../lib/funds'
import { useBalances } from '../lib/useBalances'
import { computeLedger, rangeOf } from '../lib/weekLedger'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })

/**
 * ภาพรวมรายรับ-รายจ่าย (ดูอย่างเดียว ใช้ในทุกงาน)
 * โซน 1: เงินคริสตจักร ณ วันนี้ (6 ช่อง ไม่มีลิงก์) · โซน 2: ใบสรุปรายรับ-รายจ่ายประจำสัปดาห์ของสัปดาห์ที่เลือก · โซน 3: แถบสัปดาห์ย้อนหลัง (แตะแล้วโซน 2 เปลี่ยนตาม)
 */
export default function OverviewView({ year }: { year: number }) {
  const { settings } = useSettings()
  const role = useRole()
  const showTiles = canSeeBalances(role)
  const { save } = useSettings()
  const [editNote, setEditNote] = useState<string | null>(null)
  const { balances: b, input: fullInput } = useBalances(year)
  const input = useMemo(() => ({ ...fullInput, income: fullInput.income.filter((x) => !isFundZone(x)) }), [fullInput])
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
      {showTiles && settings.leaderNote?.text && editNote === null && <section className="card" aria-label="สรุปสถานการณ์การเงินจากแอดมิน"><b>📝 สรุปสถานการณ์การเงิน</b><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{settings.leaderNote.text}</p><span className="muted small">ปรับปรุง {fmtDate(new Date(settings.leaderNote.at).toISOString().slice(0, 10))} · ข้อมูลภายในผู้นำ โปรดไม่เผยแพร่ต่อ</span></section>}
      {can(role, 'settings') && (editNote === null
        ? <button type="button" className="btn btn--ghost no-print" onClick={() => setEditNote(settings.leaderNote?.text ?? '')}>✏️ {settings.leaderNote?.text ? 'แก้' : 'เขียน'}ข้อความสรุปสถานการณ์ถึงผู้นำงาน</button>
        : <section className="card no-print" aria-label="เขียนข้อความสรุปสถานการณ์"><label htmlFor="ov-note"><b>ข้อความสรุปสถานการณ์การเงิน (ผู้นำงานทุกคนเห็น)</b></label><textarea id="ov-note" className="input" rows={4} value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="เช่น เดือนนี้เงินหมุนเวียนลดเพราะ… แผนคือ… คาดว่าจะดีขึ้นเมื่อ…" />
            <div className="row"><button type="button" className="btn btn--gold" onClick={() => { save({ leaderNote: editNote.trim() ? { text: editNote.trim(), at: Date.now() } : undefined }); setEditNote(null) }}>บันทึก</button><button type="button" className="btn btn--ghost" onClick={() => setEditNote(null)}>ยกเลิก</button></div></section>)}
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
