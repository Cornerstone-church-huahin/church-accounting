import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { can } from '../lib/access'
import { usePassbook, useIncome, useIncomeTypes, useRounds, useSettings, useSheetFiles } from '../lib/data'
import { roundTotal } from '../lib/ledger'
import { computeLedger, rangeOf } from '../lib/weekLedger'
import LedgerTable from '../components/LedgerTable'
import ScaledPage from '../components/ScaledPage'
import { makeIncomeType } from '../lib/catalog'
import WeekBar from '../components/WeekBar'
import { useRole } from '../lib/members'
import Sheet from '../components/Sheet'
import { deleteFile, getSync, listDir } from '../lib/sync'
import { addDays, fmtBaht, fmtDate, fmtDateLong, sheetSunday, sundaysOf, todayISO, yearOf } from '../lib/money'
import { UNSORTED, type IncomeEntry, type SheetFile } from '../lib/types'
import { IncomeForm, type SlipInit } from './Income'
import SheetFlow from './SheetFlow'
import CaptureBar from '../components/CaptureBar'
import SheetEntryList from '../components/SheetEntryList'
import { IncomeRowEditor } from '../components/RowEditors'
import { IncomeSheetPaper } from '../components/PaperSheets'
import ManualIncome from '../components/ManualIncome'
import { downloadPdf } from '../lib/pdf'
import { downloadBlankSheet } from '../lib/blankSheet'
import { readSlip } from '../lib/slipOcr'
import { borrowedWarnings, loanIncomeRows, type FundScope } from '../lib/fundScope'

type Sub = 'manual' | 'slip' | 'sheet' | 'total' | null

/** แต่ละรายการอยู่ช่องไหน: ใบถวาย (มาจากรอบนับ) · สลิป · ไม่ทราบที่มา · บันทึกด้วยมือ */
const kindOf = (x: IncomeEntry): 'sheet' | 'slip' | 'unknown' | 'manual' =>
  x.roundId ? 'sheet' : x.unknown ? 'unknown' : x.source === 'slip' || (!x.source && (x.slip || x.method === 'transfer')) ? 'slip' : 'manual'

const byDateDesc = (a: IncomeEntry, b: IncomeEntry) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updated - a.updated)

/** โหมด "รับ": ช่อง 1 บันทึกด้วยมือ · 2 บันทึกสลิป · 3 ใบบันทึกการถวาย → รวมเป็นใบสรุปรายสัปดาห์ (4) ใบเดียว */
export default function Receive({ year, fund }: { year: number; /** หน้ากองทุน: รับของกองทุนนี้เท่านั้น (แยกจากบัญชีหมุนเวียนโดยสิ้นเชิง) */ fund?: FundScope }) {
  const role = useRole()
  const inc = useIncome(year)
  const passbook = usePassbook(year)
  const rounds = useRounds(year)
  const types = useIncomeTypes()
  const { settings } = useSettings()
  const files = useSheetFiles(year)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [newSheetFile, setNewSheetFile] = useState<File | null>(null)
  const [attach, setAttach] = useState<SheetFile | 'new' | null>(null)
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const s = sheetSunday(todayISO())
    return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0])
  })
  const [sub, setSub] = useState<Sub>(null)
  const [rowEdit, setRowEdit] = useState<{ entry: IncomeEntry | null } | null>(null)
  const [form, setForm] = useState<{ entry: IncomeEntry | null; preset: 'manual' | 'slip' } | null>(null)
  const canWrite = can(role, 'income')

  const paperRef = useRef<HTMLDivElement>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [allWeeks, setAllWeeks] = useState(true)
  const [repScope, setRepScope] = useState<'week' | 'year'>('year')
  const fid = fund?.id
  const allEnt = useMemo(() => inc.items.filter((x) => !x.roundId && (!fid || x.typeId === fid)).sort(byDateDesc), [inc.items, fid])
  const scopeTypes = useMemo(() => (fid ? types.list.filter((t) => t.id === fid) : types.list), [types.list, fid])
  const week = useMemo(() => allEnt.filter((x) => sheetSunday(x.date) === sunday), [allEnt, sunday])
  const byDateF = (a: SheetFile, b: SheetFile) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updated - a.updated)
  const weekFiles = files.items.filter((f) => sheetSunday(f.date) === sunday).sort(byDateF)
  const allFiles = [...files.items].sort(byDateF)
  const round = rounds.items.find((r) => r.date === sunday)
  const cash = round ? roundTotal(round) : 0
  // รายการในการ์ดของช่อง 1–3: สัปดาห์ที่เลือก หรือ "ทุกสัปดาห์"
  const lst = allWeeks ? allEnt : week
  const manual = lst.filter((x) => kindOf(x) === 'manual')
  /** เพิ่ม/แก้ชื่อ/ลบประเภทรับ จากฟอร์มและป๊อปอัพ — ข้อมูลชุดเดียวกับ ตั้งค่า › รายการรับ */
  const incomeOps = !fid && can(role, 'settings') ? {
    add: (name: string) => { const t = makeIncomeType(types.list, name); if (typeof t === 'string') return { error: t }; return types.put([t]) ? { id: t.id } : { error: 'สิทธิ์ของท่านเพิ่มไม่ได้' } },
    rename: (id: string, cur: string) => { const n = prompt('แก้ชื่อรายการ', cur)?.trim(); const t = types.byId(id); if (n && t && n !== cur) types.put([{ ...t, name: n }]) },
    remove: (id: string, nm: string) => { if (confirm(`ลบรายการ “${nm}” ออกจากรายการรับ?\n(รายการที่บันทึกไว้แล้วยังอยู่ แต่จะแสดงเป็น “ประเภทที่ถูกลบ”)`)) types.remove(id) },
  } : undefined
  const loanRows = useMemo(() => (fund ? loanIncomeRows(fund).filter((x) => sheetSunday(x.date) === sunday) : []), [fund, sunday])
  const weekManual = week.filter((x) => kindOf(x) === 'manual') // ใบบันทึกการถวายเป็นรายสัปดาห์ แสดงเฉพาะสัปดาห์ที่เลือก
  const slips = lst.filter((x) => kindOf(x) === 'slip' || kindOf(x) === 'unknown')
  const lstFiles = allWeeks ? allFiles : weekFiles
  const otherWeeks = (k: 'manual' | 'slip' | 'sheet') => (k === 'sheet' ? allFiles.length - weekFiles.length : allEnt.filter((x) => sheetSunday(x.date) !== sunday && (k === 'manual' ? kindOf(x) === 'manual' : kindOf(x) === 'slip' || kindOf(x) === 'unknown')).length)
  const sum = (xs: IncomeEntry[]) => xs.reduce((s, x) => s + x.amount, 0)
  const typeName = (id: string) => (id === UNSORTED ? 'โอน (ยังไม่แยกรายการ)' : types.byId(id)?.name ?? '(รายการที่ถูกลบ)')
  /** ลบรูปที่แนบออกจาก repo ข้อมูลด้วย (ถ้าทำไม่ได้ ไม่เป็นไร — รายการถูกลบแล้ว) */
  const dropFile = async (path?: string) => {
    const cfg = getSync()
    if (!path || !cfg) return
    try {
      const dir = path.slice(0, path.lastIndexOf('/'))
      const f = (await listDir(cfg, dir)).find((x) => x.path === path)
      if (f) await deleteFile(cfg, f.path, f.sha, 'สลิป/ใบถวายที่ลบ')
    } catch { /* ignore */ }
  }
  const delEntry = (x: IncomeEntry) => {
    if (!confirm(`ลบรายการ ${fmtBaht(x.amount)} (${fmtDate(x.date)}) พร้อมรูปสลิปที่แนบ?`)) return
    if (inc.remove(x.id)) void dropFile(x.slip?.path)
  }
  const delFile = (f: SheetFile) => {
    const rd = rounds.items.find((r) => r.sheetFileId === f.id)
    const extra = rd ? (rd.status === 'counting' ? '\nยอดเงินสดที่ระบบใส่ในใบนับจากไฟล์นี้จะถูกลบด้วย' : '\n(ใบนับวันอาทิตย์นี้ยืนยันยอดแล้ว จึงไม่ลบยอด — แก้ที่หน้านับเงิน)') : ''
    if (!confirm(`ลบไฟล์ ${f.file.name} (${fmtDate(f.date)})?${extra}`)) return
    if (files.remove(f.id)) {
      if (rd?.status === 'counting') rounds.remove(rd.id)
      void dropFile(f.file.path)
    }
  }
  const actions = (edit: () => void, del: () => void) => canWrite && (
    <span className="row" style={{ gap: 8, marginTop: 6 }}>
      <button type="button" className="mini" onClick={edit}>✎ แก้ไข</button>
      <button type="button" className="mini" onClick={del}>🗑️ ลบ</button>
    </span>
  )
  const row = (x: IncomeEntry, preset: 'manual' | 'slip') => (
    <li key={x.id} style={{ display: 'block', padding: '0.4rem 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span className="grow"><b>{typeName(x.typeId)}</b>{x.memberNo ? <span className="small muted"> · {x.memberNo}</span> : null}<br /><span className="small muted">บันทึกวันที่ {fmtDate(x.date)}{x.time ? ` ${x.time} น.` : ''}{allWeeks ? ` · ใบวันที่ ${fmtDate(sheetSunday(x.date))}` : ''}{x.ref ? ` · อ้างอิง ${x.ref}` : ''}{x.slip ? ' · 📎สลิป' : ''}{x.note && x.source !== 'slip' ? ` · ${x.note}` : ''}</span></span>
        <b className="num">{fmtBaht(x.amount)}</b>
      </div>
      {actions(() => setForm({ entry: x, preset }), () => delEntry(x))}
    </li>
  )

  // บันทึกแล้วสลับไปดูสัปดาห์ของรายการนั้นเลย (เห็นว่าเข้าใบสรุปไหน)
  const goWeek = (d: string) => { const w = sheetSunday(d); if (sundays.includes(w)) setSunday(w) }

  // ใบสรุปรายรับ (แท็บ 4): สัปดาห์ที่เลือก หรือ ทั้งปี
  const { incRows } = useMemo(() => computeLedger(fid
    ? { range: rangeOf(repScope === 'year' ? 'year' : 'week', year, { sunday }), income: inc.items.filter((x) => x.typeId === fid), rounds: [], vouchers: [], lines: [], funds: [], entries: [], types: scopeTypes, passbook: [], withFunds: true }
    : { range: rangeOf(repScope === 'year' ? 'year' : 'week', year, { sunday }), income: inc.items, rounds: rounds.items, vouchers: [], lines: [], funds: [], entries: [], types: types.list, passbook: passbook.items }), [year, sunday, repScope, inc.items, rounds.items, types.list, scopeTypes, passbook.items, fid])

  /** หัวการ์ด: จำนวนรายการ + รวม + สลับ "สัปดาห์นี้/ทุกสัปดาห์" */
  const scopeBar = (k: 'manual' | 'slip' | 'sheet', n: number, amt: number) => {
    const other = otherWeeks(k)
    return (
      <div className="row row--between" style={{ margin: '0.4rem 0' }}>
        <b>{n} รายการ · รวม {fmtBaht(amt)}</b>
        {(allWeeks || other > 0) && <button type="button" className="mini" onClick={() => setAllWeeks(!allWeeks)}>{allWeeks ? 'เฉพาะสัปดาห์นี้' : `ดูทุกสัปดาห์ (อีก ${other})`}</button>}
      </div>
    )
  }

  return (
    <>
      <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
      <div className="no-print">
        <IncomeSheetPaper church={settings.churchName.split(' ')[0]} entries={[...weekManual, ...loanRows]} types={scopeTypes} scope={fund?.name} warn={borrowedWarnings(fund)} sunday={sunday} onRowClick={canWrite ? (x) => { if (x?.id.startsWith('l')) return; setRowEdit({ entry: x }) } : undefined} />
        {canWrite && <p className="muted small sheethint">แตะแถวในใบเพื่อแก้ไข หรือแตะแถวว่างเพื่อเพิ่มรายการ · เปลี่ยนสัปดาห์ด้วยลูกศรด้านบน ใบจะเปลี่ยนตาม</p>}
        <SheetEntryList title="รายการในใบนี้ (เรียงตามวันที่)" canWrite={canWrite} items={weekManual.map((x) => ({ id: x.id, date: x.date, updated: x.updated, title: typeName(x.typeId) + (fid && x.note ? ` · ${x.note}` : ''), sub: `${x.method === 'transfer' ? 'โอน' : 'เงินสด'}${x.count ? ` · ${x.count} ${x.method === 'transfer' ? 'ครั้ง' : 'ซอง'}` : ''}`, amount: x.amount }))}
          onEdit={(id) => { const x = weekManual.find((e) => e.id === id); if (x) setRowEdit({ entry: x }) }} onDelete={(id) => { const x = weekManual.find((e) => e.id === id); if (x) delEntry(x) }} />
      </div>
      {rowEdit && <IncomeRowEditor onManage={incomeOps} noteMode={!!fid} entry={rowEdit.entry} types={scopeTypes} defaultDate={(() => { const t = todayISO(); return sheetSunday(t) === sunday ? t : sunday })()} onClose={() => setRowEdit(null)} onDelete={delEntry}
        onSave={(e) => { if (yearOf(e.date) !== year) return `วันที่ต้องอยู่ในปี ${year + 543} (เปลี่ยนปีบัญชีที่มุมขวาบนก่อน)`; if (!inc.put([e])) return 'สิทธิ์ของท่านบันทึกไม่ได้'; goWeek(e.date); return null }} />}

      <div className="subtabs no-print" role="tablist" aria-label="ช่องบันทึกเงินรับ">
        <button type="button" role="tab" aria-selected={sub === 'manual'} className={sub === 'manual' ? 'on' : ''} onClick={() => setSub('manual')}><i className="dot">1</i><span>บันทึกด้วยมือ{manual.length ? ` (${manual.length})` : ''}</span></button>
        {!fid && <button type="button" role="tab" aria-selected={sub === 'slip'} className={sub === 'slip' ? 'on' : ''} onClick={() => setSub('slip')}><i className="dot">2</i><span>บันทึกสลิป{slips.length ? ` (${slips.length})` : ''}</span></button>}
        {!fid && <button type="button" role="tab" aria-selected={sub === 'sheet'} className={sub === 'sheet' ? 'on' : ''} onClick={() => setSub('sheet')}><i className="dot">3</i><span>ใบบันทึกการถวาย{lstFiles.length ? ` (${lstFiles.length})` : ''}</span></button>}
              <button type="button" role="tab" aria-selected={sub === 'total'} className={sub === 'total' ? 'on' : ''} onClick={() => setSub('total')}><i className="dot">4</i><span>รวมรับ</span></button>
      </div>

      {sub === 'manual' && (
        <section className="card no-print" role="tabpanel" aria-label="บันทึกด้วยมือ">
          <h2>1 · บันทึกด้วยมือ</h2>
          <p className="muted small">เลือกรายการตามรายชื่อในใบบันทึกการถวาย กรอกซอง/เงินสด/โอน แล้วกด “เพิ่มลงตาราง” — ผลขึ้นเป็นแผ่นใบบันทึกการถวายด้านล่าง พร้อมยอดรวม และรวมเข้าใบสรุปให้เอง</p>
          <ManualIncome withNote={!!fid} types={scopeTypes} entries={weekManual} canWrite={canWrite} defaultDate={(() => { const t = todayISO(); return sheetSunday(t) === sunday ? t : sunday })()}
            onManage={incomeOps}
            onAdd={(items) => { const ok = inc.put(items); if (ok && items[0]) goWeek(items[0].date); return ok }} onEdit={(x) => (fid ? setRowEdit({ entry: x }) : setForm({ entry: x, preset: 'manual' }))} onDelete={delEntry} />
          {canWrite && !fid && <button type="button" className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => setForm({ entry: null, preset: 'manual' })}>＋ บันทึกแบบละเอียด (เลขอ้างอิง เลขสมาชิก หมายเหตุ)</button>}
        </section>
      )}
      {sub === 'slip' && (
        <section className="card no-print" role="tabpanel" aria-label="บันทึกสลิป">
          <h2>2 · บันทึกสลิป</h2>
          {canWrite && <CaptureBar noun="สลิป" onFile={setSlipFile} />}
          <p className="muted small">แนบรูปสลิปโอนเงินไปเรื่อย ๆ ระหว่างสัปดาห์ — ระบบอ่านวันที่ ยอด และเลขอ้างอิงจากสลิปให้ ท่านตรวจแล้วกดยืนยัน</p>
          {scopeBar('slip', slips.length, sum(slips))}
          {slips.length === 0 ? <p className="muted small">ยังไม่มีสลิป{allWeeks ? '' : 'ในสัปดาห์นี้'}</p> : <ul className="list">{slips.map((x) => row(x, 'slip'))}</ul>}
        </section>
      )}
      {sub === 'sheet' && (
        <section className="card no-print" role="tabpanel" aria-label="ใบบันทึกการถวาย">
          <h2>3 · ใบบันทึกการถวาย</h2>
          {canWrite ? (
            <CaptureBar noun="ใบถวาย" onFile={setNewSheetFile} downloads={[{ label: 'ใบบันทึกการถวาย (เปล่า)', run: () => downloadBlankSheet('offering', settings.churchName.split(' ')[0], sunday) }]} />
          ) : null}
          <p className="muted small">ถ่ายรูปใบบันทึกการถวายวันอาทิตย์แล้วแนบ — ระบบอ่านแถวเงินสดให้ ท่านตรวจแล้วกดยืนยัน ยอดจะเข้าใบสรุปช่อง 4</p>
          {scopeBar('sheet', lstFiles.length, lstFiles.reduce((a, f) => a + (f.read?.rows.reduce((q, r) => q + r.amount, 0) ?? 0), 0))}
          {lstFiles.length === 0 ? <p className="muted small">ยังไม่มีไฟล์{allWeeks ? '' : 'ในสัปดาห์นี้'}</p> : (
            <ul className="list">
              {lstFiles.map((f) => (
                <li key={f.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span className="grow"><b>📎 {f.file.name}</b><br /><span className="small muted">ใบวันอาทิตย์ที่ {fmtDate(f.date)}{f.read ? ` · อ่านแล้ว ${f.read.rows.length} แถว รวมเงินสด ${fmtBaht(f.read.rows.reduce((a, r) => a + r.amount, 0))}` : ' · ยังไม่ได้อ่านข้อมูล'}{f.file.path ? '' : ' · (โหมดทดลอง ไม่ได้เก็บรูป)'}</span></span>
                  {actions(() => setAttach(f), () => delFile(f))}
                </li>
              ))}
            </ul>
          )}
          <Link className="mini" to={`/rounds/${sunday}`} style={{ display: 'inline-block', marginTop: 8 }}>{!round ? 'กรอกยอดนับเอง ›' : `เปิดใบนับเงิน (${fmtBaht(cash)}) ›`}</Link>
        </section>
      )}

      {sub === 'total' && (
        <section className="card" role="tabpanel" aria-labelledby="h-rep">
          <div className="no-print" style={{ display: 'grid', gap: 8 }}>
            <div className="seg" role="group" aria-label="ช่วงของใบสรุป">
              <button type="button" className={repScope === 'week' ? 'on' : ''} onClick={() => setRepScope('week')}>สัปดาห์ที่เลือก</button>
              <button type="button" className={repScope === 'year' ? 'on' : ''} onClick={() => setRepScope('year')}>ทั้งปี {year + 543}</button>
            </div>
            <div className="grid2">
              <button type="button" className="btn btn--gold" disabled={pdfBusy} onClick={async () => {
                if (!paperRef.current) return
                setPdfBusy(true)
                try { await downloadPdf(paperRef.current, `offering-${repScope === 'year' ? year + 543 : sunday}.pdf`, { fullPage: true }) } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF แทน') }
                setPdfBusy(false)
              }}>{pdfBusy ? 'กำลังสร้าง PDF…' : '⬇️ ดาวน์โหลด PDF'}</button>
              <button type="button" className="btn btn--ghost" onClick={() => window.print()}>🖨️ พิมพ์</button>
            </div>
          </div>
          <ScaledPage ref={paperRef} className="a4page a4page--doc">
            <>
          <header className="paper__head">
            <p className="muted small">{settings.churchName}</p>
            <h2 id="h-rep">ได้รับการถวายประจำสัปดาห์</h2>
            <p>{repScope === 'year' ? `ประจำปี ${year + 543} (รวมทุกสัปดาห์)` : `ประจำวันอาทิตย์ที่ ${fmtDateLong(sunday).replace('วันอาทิตย์ที่ ', '')}`}</p>
            {repScope === 'week' && <p className="muted small">รับระหว่างวันที่ {fmtDate(addDays(sunday, -6))} – {fmtDate(sunday)}</p>}
          </header>

          <LedgerTable labels={['รายการ', 'จำนวนซอง', 'จำนวนโอน']} rows={incRows} total="รวมทั้งสิ้น" />

          <div className="sign" style={{ display: 'grid' }}>
            <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br /><span className="small">วันที่ ........../........../..........</span></div>
            <div>ผู้ตรวจสอบ<br /><span className="small">วันที่ ........../........../..........</span></div>
            <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br /><span className="small">วันที่ ........../........../..........</span></div>
          </div>
            </>
          </ScaledPage>
          <p className="muted small no-print" style={{ textAlign: 'center' }}>แตะที่หน้ากระดาษเพื่อขยาย (แตะอีกครั้งเพื่อย่อ) หรือหมุนจอเป็นแนวนอน · พิมพ์/ดาวน์โหลดได้ขนาด A4 เต็มหน้า</p>
        </section>
      )}


      {attach && attach !== 'new' && <SheetFlow year={year} sunday={sunday} existing={attach} onClose={() => setAttach(null)} onSaved={goWeek} />}
      {newSheetFile && <SheetFlow year={year} sunday={sunday} existing={null} initialFile={newSheetFile} onClose={() => setNewSheetFile(null)} onSaved={goWeek} />}
      {slipFile && <SlipFlow year={year} inc={inc} initialFile={slipFile} onClose={() => setSlipFile(null)} onSaved={goWeek} />}
      {form && <IncomeForm year={year} entry={form.entry} preset={form.preset} onSaved={goWeek} defaultDate={yearOf(todayISO()) === year ? todayISO() : undefined} onClose={() => setForm(null)} inc={inc} />}
    </>
  )
}


/** แนบสลิป: เลือกรูป → ระบบอ่านในเครื่อง → ใส่ค่าให้ในฟอร์ม → ตรวจและยืนยัน */
function SlipFlow({ year, inc, initialFile, onClose, onSaved }: { year: number; initialFile?: File; inc: ReturnType<typeof useIncome>; onClose: () => void; onSaved?: (date: string) => void }) {
  const types = useIncomeTypes()
  const [stage, setStage] = useState<'pick' | 'read' | 'confirm'>('pick')
  const [pct, setPct] = useState(0)
  const [init, setInit] = useState<SlipInit | null>(null)
  const [msg, setMsg] = useState('')
  const choose = async (file: File) => {
    setStage('read'); setPct(0); setMsg('')
    let r: Awaited<ReturnType<typeof readSlip>> | null = null
    try { r = await readSlip(file, setPct) } catch { setMsg('ระบบอ่านสลิปไม่สำเร็จ — กรอกข้อมูลเองได้ในขั้นต่อไป') }
    const memo = r?.memo ?? ''
    const hit = memo ? types.list.find((t) => t.active && memo.includes(t.name.split(' ')[0])) : undefined
    const missing = r ? [!r.date && 'วันที่', !r.amount && 'ยอดเงิน'].filter(Boolean) : []
    if (r && missing.length) setMsg(`อ่าน${missing.join('และ')}ไม่ได้ — กรุณากรอกเอง`)
    setInit({ file, date: r?.date, amount: r?.amount, ref: r?.ref, typeId: hit?.id, time: r?.time, note: memo })
    setStage('confirm')
  }
  useEffect(() => { if (initialFile) void choose(initialFile) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (stage === 'confirm' && init) return (
    <>
      {msg && <p className="role-toast" role="alert" style={{ position: 'fixed', top: 8, left: 8, right: 8, zIndex: 100 }}>{msg}</p>}
      <IncomeForm year={year} entry={null} preset="slip" init={init} inc={inc} onClose={onClose} onSaved={onSaved} />
    </>
  )
  return (
    <Sheet title="แนบสลิป" onClose={onClose}>
      {stage === 'pick' ? (
        <>
          <p className="muted small">เลือกรูปสลิปโอนเงิน ระบบจะอ่านวันที่ ยอดเงิน และเลขอ้างอิงให้เอง (อ่านในเครื่อง รูปไม่ถูกส่งไปที่อื่น)</p>
          <label className="btn btn--gold" style={{ display: 'block', textAlign: 'center' }}>
            📷 เลือกรูปสลิป
            <input type="file" accept="image/*" aria-label="เลือกรูปสลิป" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void choose(f) }} />
          </label>
        </>
      ) : (
        <div role="status" aria-live="polite">
          <p><b>กำลังอ่านสลิป…</b></p>
          <progress value={pct} max={1} style={{ width: '100%' }} />
          <p className="muted small">ครั้งแรกอาจนานขึ้นเล็กน้อยเพราะต้องโหลดตัวอ่านภาษาไทย</p>
        </div>
      )}
    </Sheet>
  )
}


