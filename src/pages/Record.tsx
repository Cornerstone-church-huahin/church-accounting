import { useMemo, useRef, useState } from 'react'
import Receive from './Receive'
import Pay from './Pay'
import WeekBar from '../components/WeekBar'
import { BOARD_OTHER, STANDARD_BOARD, boardLabel, groupBoard, splitByChannel } from '../lib/boardGroup'
import NoticePaper from '../components/NoticePaper'
import PdfTools from '../components/PdfTools'
import PickDock, { SheetTick } from '../components/PickDock'
import { useIncomeTypes, useSettings } from '../lib/data'
import { can } from '../lib/access'
import { useRole } from '../lib/members'
import { useBalances } from '../lib/useBalances'
import { computeLedger, rangeOf } from '../lib/weekLedger'
import { expenseLines, weekNotice } from '../lib/notice'
import { outLinesOf } from '../lib/report'
import { isFundZone } from '../lib/funds'
import { sheetSunday, sundaysOf, todayISO } from '../lib/money'

/**
 * ใบสรุปรายรับ-รายจ่ายประจำสัปดาห์ สำหรับติดบอร์ดประกาศ — คำนวณสดจากรายการรับ/จ่ายของสัปดาห์ที่เลือก (ตัวเดียวกับหน้า “สรุป/ภาพรวม”)
 * บันทึกรายการในใบรับ/ใบจ่ายด้านบน ใบนี้เปลี่ยนตามทันที
 */
function BoardNotice({ year, sunday, byCategory, noTools }: { /** ดูอย่างเดียว: ไม่มีแถบดาวน์โหลด/แชร์/พิมพ์ */ noTools?: boolean; year: number; sunday: string; /** ฉบับติดบอร์ด: รายจ่ายแสดงเป็นหมวด ไม่แสดงรายการละเอียด */ byCategory?: boolean }) {
  const { settings } = useSettings()
  const { input: full } = useBalances(year)
  const input = useMemo(() => ({ ...full, income: full.income.filter((x) => !isFundZone(x)) }), [full])
  const church = settings.churchName.split(' ')[0]
  const paper = useRef<HTMLDivElement[]>([])
  const role = useRole()
  const itypes = useIncomeTypes()
  const [pick, setPick] = useState<Record<string, string>>({})
  const n = useMemo(() => {
    const range = rangeOf('week', year, { sunday })
    const L = computeLedger({ range, ...input, withFunds: false })
    const n0 = weekNotice(L, expenseLines(range, { vouchers: input.vouchers, expenses: input.expenses, entries: input.entries }))
    if (!byCategory) return n0
    // ใบติดบอร์ด: รายรับไม่แจ้งชื่อบุคคล — รวมเป็นหมวด
    const inc = splitByChannel(groupBoard(n0.inc, input.types, (a, b) => ({ ...a, cashN: a.cashN + b.cashN, cash: a.cash + b.cash, trN: a.trN + b.trN, tr: a.tr + b.tr, amt: a.amt + b.amt })))
    // รวมรายจ่ายเป็นหมวด (ชุดรายการเดียวกับใบละเอียด → ยอดรวมตรงกัน) เรียงมากไปน้อย
    const by = new Map<string, number>()
    for (const x of outLinesOf(range, input)) by.set(x.catLabel, (by.get(x.catLabel) ?? 0) + x.amount)
    const out = [...by].sort((a, b) => b[1] - a[1]).map(([label, amount], i) => ({ key: `cat:${i}`, date: '', desc: label, amount }))
    return { ...n0, inc, fund: splitByChannel(n0.fund), out }
  }, [input, year, sunday, byCategory])
  const els = () => paper.current.filter(Boolean)
  // รายการที่เพิ่มเอง (ชื่อคน ฯลฯ) ที่ยังรวมเป็น “ถวายอื่น ๆ” — แอดมินเลือกหมวดให้ได้ที่นี่ (ตั้ง boardCat)
  const customs = useMemo(() => {
    if (!byCategory || noTools || !can(role, 'settings')) return []
    const range = rangeOf('week', year, { sunday })
    const L = computeLedger({ range, ...input, withFunds: false })
    return L.incRows.filter((r) => !r.key.startsWith('__') && boardLabel(r.key, r.label, input.types) === BOARD_OTHER)
  }, [byCategory, noTools, role, input, year, sunday])
  const file = `${byCategory ? 'board' : 'notice-detail'}-${sunday}.pdf`
  return (
    <>
      <NoticePaper pagesRef={paper} church={church} sunday={sunday} n={n} variant={byCategory ? 'category' : undefined} />
      {customs.length > 0 && (
        <section className="card no-print" aria-label="จัดหมวดรายรับที่เพิ่มเอง">
          <b className="small">🏷️ รายการที่เพิ่มเองในสัปดาห์นี้ (บนบอร์ดรวมเป็น “{BOARD_OTHER}”)</b>
          <p className="muted small" style={{ margin: '0.1rem 0 0.3rem' }}>เลือกหมวดที่ถูกต้อง เช่น สิบลด แล้วกด “ตั้งหมวด” — ใบติดบอร์ดจะรวมเป็นหมวดนั้นและแยกแถวตู้ถวาย/โอนให้เอง (ไม่แสดงชื่อบุคคล)</p>
          {customs.map((r) => (
            <div key={r.key} className="row" style={{ alignItems: 'center', margin: '0.2rem 0' }}>
              <span className="grow">{r.label}</span>
              <select className="input" aria-label={`หมวดบอร์ดของ ${r.label}`} value={pick[r.key] ?? STANDARD_BOARD[0]} onChange={(e) => setPick({ ...pick, [r.key]: e.target.value })}>{STANDARD_BOARD.map((nm) => <option key={nm}>{nm}</option>)}</select>
              <button type="button" className="btn btn--gold" aria-label={`ตั้งหมวดบอร์ดของ ${r.label}`} onClick={() => { const t = itypes.byId(r.key); if (t) itypes.put([{ ...t, boardCat: pick[r.key] ?? STANDARD_BOARD[0] }]) }}>ตั้งหมวด</button>
            </div>
          ))}
        </section>
      )}
      {!noTools && <PdfTools els={els} file={file} title="สรุปรายรับ-รายจ่ายประจำสัปดาห์" label={byCategory ? 'ใบสำหรับติดบอร์ดประกาศ' : 'ข้อมูลก่อนติดบอร์ด'} />}
    </>
  )
}

/**
 * บันทึก — รับและจ่ายในหน้าเดียว: เลือกสัปดาห์ครั้งเดียว แล้วบันทึกใบรายรับ (ใบบันทึกการถวาย) และใบรายจ่าย (ใบเบิก-จ่ายเงินสด) ต่อกันในหน้านี้
 * แสดงเฉพาะแผ่นบันทึกรับ/จ่าย (แตะแถวในใบเพื่อเพิ่ม/แก้) + ปุ่มดาวน์โหลด/แชร์/พิมพ์ของแต่ละใบ — ตัดส่วนอื่นออกเพื่อให้หน้าสั้น
 */
export default function Record({ year, onBack, readOnly }: { year: number; onBack?: () => void; /** ผู้ดูอย่างเดียว (หน้าสถานะการเงิน): ใบรับ/ใบจ่ายแบบปกปิดตามสิทธิ์ ไม่แก้ไข · ไม่มีใบ “ข้อมูลก่อนติดบอร์ด” ถ้าไม่มีสิทธิ์ดูรายละเอียด */ readOnly?: boolean }) {
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const s = sheetSunday(todayISO())
    return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0])
  })
  const week = { sunday, set: setSunday }
  const [picked, setPicked] = useState<string[]>([]) // แผ่นที่ติ๊กเลือกไว้ส่งออก (in · out · chk · brd)
  const box = useRef<HTMLDivElement>(null)
  const on = (k: string) => picked.includes(k)
  const tick = (k: string, v: boolean) => setPicked((p) => (v ? (p.includes(k) ? p : [...p, k]) : p.filter((x) => x !== k)))
  const sel = (k: string) => (on(k) ? '1' : undefined)
  return (
    <div className="record" ref={box}>
      {onBack && <button type="button" className="mini no-print record__back" onClick={onBack} aria-label="กลับหน้างานเหรัญญิก">‹ กลับ</button>}
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      {!readOnly && <section className="record__sec record__sec--in" aria-label="บันทึกรายรับ" data-sheet="in" data-sel={sel('in')}>
        <h2 className="record__h record__h--in">รายรับ <small>ใบบันทึกการถวาย</small>{!readOnly && <SheetTick on={on('in')} onChange={(v) => tick('in', v)} label="รายรับ" />}</h2>
        <Receive key={`in-${year}`} year={year} weekCtl={week} hideWeekBar compact fourTools={!readOnly} view={readOnly} />
      </section>}
      {!readOnly && <section className="record__sec record__sec--out" aria-label="บันทึกรายจ่าย" data-sheet="out" data-sel={sel('out')}>
        <h2 className="record__h record__h--out">รายจ่าย <small>ใบเบิก-จ่ายเงินสด</small>{!readOnly && <SheetTick on={on('out')} onChange={(v) => tick('out', v)} label="รายจ่าย" />}</h2>
        <Pay key={`out-${year}`} year={year} weekCtl={week} hideWeekBar compact fourTools={!readOnly} view={readOnly} />
      </section>}
      {!readOnly && <section className="record__sec record__sec--board" aria-label="ข้อมูลก่อนติดบอร์ด" data-sheet="chk" data-sel={sel('chk')}>
        <h2 className="record__h record__h--check">📋 ข้อมูลก่อนติดบอร์ด <small>รายละเอียดค่าใช้จ่าย ไว้ตรวจก่อนนำไปติดบอร์ด (ยังไม่ติดบอร์ดใบนี้)</small>{!readOnly && <SheetTick on={on('chk')} onChange={(v) => tick('chk', v)} label="ข้อมูลก่อนติดบอร์ด" />}</h2>
        <BoardNotice year={year} sunday={sunday} noTools={readOnly} />
      </section>}
      <section className="record__sec record__sec--board" aria-label="สำหรับติดบอร์ดประกาศ" data-sheet="brd" data-sel={sel('brd')}>
        <h2 className="record__h record__h--board">📌 สำหรับติดบอร์ดประกาศ <small>รายจ่ายแสดงเป็นหมวด — พิมพ์ติดบอร์ดได้เลย</small>{!readOnly && <SheetTick on={on('brd')} onChange={(v) => tick('brd', v)} label="สำหรับติดบอร์ดประกาศ" />}</h2>
        <BoardNotice year={year} sunday={sunday} byCategory noTools={readOnly} />
      </section>
      {!readOnly && <PickDock keys={picked} file={`บันทึก-${sunday}-แผ่นงานที่เลือก.pdf`} title="บันทึกประจำสัปดาห์ แผ่นงานที่เลือก" onClear={() => setPicked([])} getEls={() => Array.from(box.current?.querySelectorAll<HTMLDivElement>('[data-sheet][data-sel="1"] .a4page') ?? [])} />}
    </div>
  )
}
