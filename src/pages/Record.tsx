import { useMemo, useRef, useState } from 'react'
import Receive from './Receive'
import Pay from './Pay'
import WeekBar from '../components/WeekBar'
import NoticePaper from '../components/NoticePaper'
import { IconDownload, IconPrint, IconShare } from '../components/ToolIcons'
import { useSettings } from '../lib/data'
import { useBalances } from '../lib/useBalances'
import { computeLedger, rangeOf } from '../lib/weekLedger'
import { expenseLines, weekNotice } from '../lib/notice'
import { outLinesOf } from '../lib/report'
import { isFundZone } from '../lib/funds'
import { downloadSheetPdf, sharePdf } from '../lib/pdf'
import { sheetSunday, sundaysOf, todayISO } from '../lib/money'

/**
 * ใบสรุปรายรับ-รายจ่ายประจำสัปดาห์ สำหรับติดบอร์ดประกาศ — คำนวณสดจากรายการรับ/จ่ายของสัปดาห์ที่เลือก (ตัวเดียวกับหน้า “สรุป/ภาพรวม”)
 * บันทึกรายการในใบรับ/ใบจ่ายด้านบน ใบนี้เปลี่ยนตามทันที
 */
function BoardNotice({ year, sunday, byCategory }: { year: number; sunday: string; /** ฉบับติดบอร์ด: รายจ่ายแสดงเป็นหมวด ไม่แสดงรายการละเอียด */ byCategory?: boolean }) {
  const { settings } = useSettings()
  const { input: full } = useBalances(year)
  const input = useMemo(() => ({ ...full, income: full.income.filter((x) => !isFundZone(x)) }), [full])
  const church = settings.churchName.split(' ')[0]
  const paper = useRef<HTMLDivElement[]>([])
  const n = useMemo(() => {
    const range = rangeOf('week', year, { sunday })
    const L = computeLedger({ range, ...input, withFunds: false })
    const n0 = weekNotice(L, expenseLines(range, { vouchers: input.vouchers, expenses: input.expenses, entries: input.entries }))
    if (!byCategory) return n0
    // รวมรายจ่ายเป็นหมวด (ชุดรายการเดียวกับใบละเอียด → ยอดรวมตรงกัน) เรียงมากไปน้อย
    const by = new Map<string, number>()
    for (const x of outLinesOf(range, input)) by.set(x.catLabel, (by.get(x.catLabel) ?? 0) + x.amount)
    const out = [...by].sort((a, b) => b[1] - a[1]).map(([label, amount], i) => ({ key: `cat:${i}`, date: '', desc: label, amount }))
    return { ...n0, out }
  }, [input, year, sunday, byCategory])
  const [busy, setBusy] = useState(false)
  const els = () => paper.current.filter(Boolean)
  const file = `${byCategory ? 'board' : 'notice-detail'}-${sunday}.pdf`
  const share = async () => {
    setBusy(true)
    try {
      if ((await sharePdf(els(), file, 'full', 'สรุปรายรับ-รายจ่ายประจำสัปดาห์')) === 'unsupported') { await downloadSheetPdf(els(), file, 'full'); alert('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ PDF ให้แล้ว ส่งต่อจากไฟล์ที่ดาวน์โหลดได้เลย') }
    } finally { setBusy(false) }
  }
  return (
    <>
      <NoticePaper pagesRef={paper} church={church} sunday={sunday} n={n} variant={byCategory ? 'category' : undefined} />
      <div className="no-print rec-tools" role="toolbar" aria-label={byCategory ? 'เครื่องมือใบสำหรับติดบอร์ดประกาศ' : 'เครื่องมือข้อมูลก่อนติดบอร์ด'}>
        <button type="button" className="rec-tool" onClick={() => void downloadSheetPdf(els(), file, 'full')} aria-label={byCategory ? 'ดาวน์โหลด PDF ใบสำหรับติดบอร์ด' : 'ดาวน์โหลด PDF ข้อมูลก่อนติดบอร์ด'} title="ดาวน์โหลด PDF"><IconDownload /><span>ดาวน์โหลด</span></button>
        <button type="button" className="rec-tool" disabled={busy} onClick={() => void share()} aria-label={byCategory ? 'แชร์ใบสำหรับติดบอร์ด' : 'แชร์ข้อมูลก่อนติดบอร์ด'} title="แชร์ไฟล์ PDF"><IconShare /><span>{busy ? 'กำลังสร้าง…' : 'แชร์'}</span></button>
        <button type="button" className="rec-tool" onClick={() => window.print()} aria-label={byCategory ? 'พิมพ์ใบสำหรับติดบอร์ด' : 'พิมพ์ข้อมูลก่อนติดบอร์ด'} title="พิมพ์"><IconPrint /><span>พิมพ์</span></button>
      </div>
    </>
  )
}

/**
 * บันทึก — รับและจ่ายในหน้าเดียว: เลือกสัปดาห์ครั้งเดียว แล้วบันทึกใบรายรับ (ใบบันทึกการถวาย) และใบรายจ่าย (ใบเบิก-จ่ายเงินสด) ต่อกันในหน้านี้
 * แสดงเฉพาะแผ่นบันทึกรับ/จ่าย (แตะแถวในใบเพื่อเพิ่ม/แก้) + ปุ่มดาวน์โหลด/แชร์/พิมพ์ของแต่ละใบ — ตัดส่วนอื่นออกเพื่อให้หน้าสั้น
 */
export default function Record({ year, onBack }: { year: number; onBack?: () => void }) {
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const s = sheetSunday(todayISO())
    return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0])
  })
  const week = { sunday, set: setSunday }
  return (
    <div className="record">
      {onBack && <button type="button" className="mini no-print record__back" onClick={onBack} aria-label="กลับหน้างานเหรัญญิก">‹ กลับ</button>}
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <section className="record__sec record__sec--in" aria-label="บันทึกรายรับ">
        <h2 className="record__h record__h--in">💚 รายรับ <small>ใบบันทึกการถวาย</small></h2>
        <Receive key={`in-${year}`} year={year} weekCtl={week} hideWeekBar compact />
      </section>
      <section className="record__sec record__sec--out" aria-label="บันทึกรายจ่าย">
        <h2 className="record__h record__h--out">🔴 รายจ่าย <small>ใบเบิก-จ่ายเงินสด</small></h2>
        <Pay key={`out-${year}`} year={year} weekCtl={week} hideWeekBar compact />
      </section>
      <section className="record__sec record__sec--board" aria-label="ข้อมูลก่อนติดบอร์ด">
        <h2 className="record__h record__h--check">📋 ข้อมูลก่อนติดบอร์ด <small>รายละเอียดค่าใช้จ่าย ไว้ตรวจก่อนนำไปติดบอร์ด (ยังไม่ติดบอร์ดใบนี้)</small></h2>
        <BoardNotice year={year} sunday={sunday} />
      </section>
      <section className="record__sec record__sec--board" aria-label="สำหรับติดบอร์ดประกาศ">
        <h2 className="record__h record__h--board">📌 สำหรับติดบอร์ดประกาศ <small>รายจ่ายแสดงเป็นหมวด — พิมพ์ติดบอร์ดได้เลย</small></h2>
        <BoardNotice year={year} sunday={sunday} byCategory />
      </section>
    </div>
  )
}
