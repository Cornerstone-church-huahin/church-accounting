import { useRef, useState } from 'react'
import AnnualPlanPaper from './AnnualPlanPaper'
import MoneyInput from './MoneyInput'
import Sheet from './Sheet'
import { can, myWorks } from '../lib/access'
import { planRows, quarterLabel } from '../lib/annualPlan'
import { exportBlankPlan, planFile } from '../lib/blankPlan'
import { useCalendar, usePlanSettings, useSettings } from '../lib/data'
import { useRole } from '../lib/members'
import { be, fmtBaht, isISO, newId, todayISO } from '../lib/money'
import { canSharePdf, downloadSheetPdf, sharePdf } from '../lib/pdf'
import type { CalEvent } from '../lib/types'

type Q = 1 | 2 | 3 | 4
const qOf = (iso: string): Q => (Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1) as Q

/**
 * งานเลขา › แผนงานประจำปี: ตารางกิจกรรมรายไตรมาส (A4 แผ่นละ 3 เดือน) สร้างบนปฏิทินงานเดิม — กิจกรรมที่ติ๊ก “แผนงาน” อยู่ในปฏิทินด้วย ไม่ซ้ำซ้อน
 * วันที่ที่ผ่านแล้วขีดฆ่า · รวมงบรายไตรมาส · คำขวัญแก้ได้ · ดาวน์โหลด/แชร์ PDF ทั้งใบเปล่าและใบที่กรอกแล้ว · พิมพ์ได้
 */
export default function AnnualPlan() {
  const role = useRole()
  const canEdit = can(role, 'detail') || myWorks().includes(1)
  const { settings } = useSettings()
  const church = settings.churchName.split(' ')[0]
  const cal = useCalendar()
  const ps = usePlanSettings()
  const today = todayISO()
  const [year, setYear] = useState(Number(today.slice(0, 4)))
  const [q, setQ] = useState<Q>(qOf(today))
  const [motto, setMotto] = useState<string | null>(null)
  const [edit, setEdit] = useState<CalEvent | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [endDate, setEndDate] = useState('')
  const [lead, setLead] = useState('')
  const [budget, setBudget] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [ferr, setFerr] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)
  const rows = planRows(cal.list, year, q, today)
  const years = Array.from({ length: 5 }, (_, i) => Number(today.slice(0, 4)) - 1 + i)
  const mottoVal = motto ?? ps.motto

  const open = (e: CalEvent | 'new') => {
    if (!canEdit) return
    if (e === 'new') { setTitle(''); setDate(`${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`); setEndDate(''); setLead(''); setBudget(null); setDone(false) }
    else { setTitle(e.title); setDate(e.date); setEndDate(''); setLead(e.lead ?? ''); setBudget(e.budget ?? null); setDone(!!e.done) }
    setFerr(''); setEdit(e)
  }
  const save = () => {
    if (!edit) return
    const errs: string[] = []
    if (!title.trim()) errs.push('ใส่รายละเอียดกิจกรรม')
    if (!isISO(date)) errs.push('เลือกวันที่')
    if (errs.length) return setFerr(errs.join('\n'))
    setFerr('')
    const base: CalEvent = edit === 'new' ? { id: newId('cal'), updated: 0, date, title: '', tab: 1 } : edit
    const dates: string[] = []
    if (edit === 'new' && endDate && isISO(endDate) && endDate > date) for (let d = new Date(`${date}T00:00:00Z`); d.toISOString().slice(0, 10) <= endDate && dates.length < 31; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10))
    const ev: CalEvent = { ...base, date: dates[0] ?? date, extra: edit === 'new' ? (dates.length > 1 ? dates.slice(1) : undefined) : base.extra, title: title.trim(), plan: true, lead: lead.trim() || undefined, budget: budget || undefined, done: done || undefined }
    if (edit === 'new' || edit.date !== date) ev.date = dates[0] ?? date
    if (!cal.put([ev])) return setFerr('ไม่มีสิทธิ์บันทึกในปฏิทิน')
    setEdit(null); setMsg('บันทึกแล้ว — กิจกรรมนี้อยู่ในปฏิทินงานด้วย')
  }
  const remove = () => {
    if (edit && edit !== 'new' && window.confirm(`ลบ “${edit.title}” ออกจากแผนงาน (และปฏิทิน) ?`)) { if (!cal.put([{ ...edit, deleted: true }])) return setMsg('ไม่มีสิทธิ์ลบ'); setEdit(null); setMsg('ลบแล้ว') }
  }
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg('')
    try { await fn(); setMsg(ok) } catch (e) { console.error('plan pdf', e); setMsg('สร้างไฟล์ PDF ไม่สำเร็จ — ลองกด “พิมพ์” แทน') }
    setBusy(false)
  }
  const els = () => (ref.current ? [ref.current] : [])
  const file = planFile(year, q, false)
  const shareFilled = async () => { const r = await sharePdf(els(), file, 'full', 'แผนงานประจำปี'); if (r === 'unsupported') { await downloadSheetPdf(els(), file, 'full'); alert('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ PDF ให้แล้ว ส่งต่อจากไฟล์ที่ดาวน์โหลดได้เลย') } }
  const shareBlank = async () => { const r = await exportBlankPlan('share', church, year, mottoVal, 'all'); if (r === 'unsupported') alert('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ PDF ให้แล้ว ส่งต่อจากไฟล์ที่ดาวน์โหลดได้เลย') }

  return (
    <div aria-label="แผนงานประจำปี">
      <section className="card no-print" aria-label="เลือกไตรมาส" style={{ margin: '0 0 8px' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="field" style={{ width: 100 }}><label htmlFor="ap-y">ปี พ.ศ.</label>
            <select id="ap-y" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{be(y)}</option>)}</select></div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}><label htmlFor="ap-q">ไตรมาส</label>
            <select id="ap-q" className="input" value={q} onChange={(e) => setQ(Number(e.target.value) as Q)}>{([1, 2, 3, 4] as Q[]).map((x) => <option key={x} value={x}>ไตรมาส {x} · {quarterLabel(year, x).replace(/ \d+$/, '')}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="ap-motto">คำขวัญประจำปี (แสดงหัวแผ่น)</label>
          <input id="ap-motto" className="input" maxLength={80} value={mottoVal} disabled={!canEdit} onChange={(e) => setMotto(e.target.value)} onBlur={() => { if (motto !== null && motto !== ps.motto) { ps.save(motto.trim()); setMotto(null); setMsg('บันทึกคำขวัญแล้ว') } }} placeholder="เช่น ก้าวต่อไปในนิมิต สู่ปีแห่งความบริบูรณ์" /></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {canEdit && <button type="button" className="btn btn--gold" onClick={() => open('new')}>➕ เพิ่มกิจกรรม</button>}
          <span className="small muted" style={{ alignSelf: 'center' }}>{rows.length} รายการในไตรมาสนี้{canEdit ? ' · แตะแถวในตารางเพื่อแก้ไข' : ''}</span>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void run(() => exportBlankPlan('download', church, year, mottoVal, 'all'), 'ดาวน์โหลดใบเปล่าทั้งปีแล้ว')}>⬇️ ดาวน์โหลด PDF ไฟล์เปล่า (4 ไตรมาส)</button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void run(shareBlank, 'แชร์ใบเปล่าแล้ว')} title={canSharePdf() ? undefined : 'เครื่องนี้จะดาวน์โหลดไฟล์ให้แทน'}>📤 แชร์ไฟล์เปล่า</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void run(() => downloadSheetPdf(els(), file, 'full'), 'ดาวน์โหลดแผนงานแล้ว')}>⬇️ ดาวน์โหลด PDF (ไตรมาสนี้)</button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void run(shareFilled, 'แชร์แล้ว')}>📤 แชร์ PDF</button>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>🖨️ พิมพ์</button>
        </div>
        {msg && <p className="note" role="status" style={{ margin: '6px 0 0' }}>{msg}</p>}
      </section>
      <AnnualPlanPaper ref={ref} church={church} year={year} q={q} rows={rows} motto={mottoVal} onRowClick={canEdit ? (id) => { const e = cal.list.find((x) => x.id === id); if (e) open(e) } : undefined} />
      {edit && (
        <Sheet title={edit === 'new' ? 'เพิ่มกิจกรรมในแผนงาน' : 'แก้ไขกิจกรรม'} onClose={() => setEdit(null)}>
          <div className="field"><label htmlFor="ap-t">รายละเอียด</label><input id="ap-t" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น จัดค่ายคริสตจักร" autoFocus /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="ap-d">วันที่</label><input id="ap-d" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            {edit === 'new' && <div className="field" style={{ flex: 1 }}><label htmlFor="ap-e">ถึงวันที่ (ถ้ามีหลายวัน)</label><input id="ap-e" type="date" className="input" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} /></div>}
          </div>
          <div className="field"><label htmlFor="ap-l">ผู้รับผิดชอบ</label><input id="ap-l" className="input" maxLength={40} value={lead} onChange={(e) => setLead(e.target.value)} placeholder="เช่น อ. คำสิงห์" /></div>
          <div className="field"><label htmlFor="ap-b">งบประมาณ (บาท)</label><MoneyInput id="ap-b" value={budget} onChange={setBudget} /></div>
          {edit !== 'new' && <label className="row" style={{ gap: 6, margin: '4px 0' }}><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> ทำเสร็จแล้ว (ขีดฆ่าวันที่)</label>}
          <p className="small muted" style={{ margin: '0 0 6px' }}>งบประมาณ = ตัวเลขตามแผน{budget ? ` (${fmtBaht(budget)} บาท)` : ''} · ทำซ้ำหรือแก้เวลาละเอียดได้ที่ปฏิทินงาน</p>
          {ferr && <p className="err" role="alert">{ferr}</p>}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>
            {edit !== 'new' && <button type="button" className="btn btn--ghost" onClick={remove}>ลบ</button>}
          </div>
        </Sheet>
      )}
      <p className="muted small no-print" style={{ textAlign: 'center' }}>แตะที่หน้ากระดาษเพื่อขยาย (แตะอีกครั้งเพื่อย่อ)</p>
    </div>
  )
}
