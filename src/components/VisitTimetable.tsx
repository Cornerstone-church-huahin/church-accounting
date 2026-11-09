import { useMemo, useRef } from 'react'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import { PaperHead } from './PaperSheets'
import { useSettings, useVisitPlans, useVisits } from '../lib/data'
import { usePlanDate } from '../lib/planDate'
import { addDays, be, monthName, todayISO } from '../lib/money'
import { dayKind, DAY_NAMES, sundayOf, weekDays } from '../lib/visits'
import { SLOTS, setSlotNote, type PlanDoc, type Slot } from '../lib/visitPlan'

const DEFAULT_FIXED = 'กลุ่มอธิษฐาน\nศึกษาพระคัมภีร์\n09.00-10.00 น.'
const RED = '#a4262c'
const cell: React.CSSProperties = { border: '1.5px solid #333', padding: '6px 8px', verticalAlign: 'top', fontSize: 15, lineHeight: 1.35 }

const dmy = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}/${m}/${String(be(y)).slice(2)}` }
/** “10-14 พฤศจิกายน 2569” หรือข้ามเดือน “30 พ.ย. – 4 ธ.ค. 2569” */
const rangeTitle = (a: string, b: string) => {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number)
  return ya === yb && ma === mb ? `${da}-${db} ${monthName(ma)} ${be(ya)}` : `${da} ${monthName(ma)} ${be(ya)} – ${db} ${monthName(mb)} ${be(yb)}`
}

/** รายการของภาคหนึ่งในแผนวันหนึ่ง: เรียงตามจุดเยี่ยม จุดเดียวกันรวมเป็นบรรทัดเดียว */
function linesOf(doc: PlanDoc, slot: Slot, visited: Set<string>): { text: string; done: boolean }[] {
  const items = doc.items.filter((x) => (x.slot ?? 'บ่าย') === slot)
  const byStop = new Map<number, typeof items>()
  for (const x of items) byStop.set(x.g, [...(byStop.get(x.g) ?? []), x])
  const keys = [...byStop.keys()].sort((a, b) => (a || 1e9) - (b || 1e9))
  const out: { text: string; done: boolean }[] = []
  for (const g of keys) {
    const xs = byStop.get(g)!
    if (g > 0) out.push({ text: `${doc.names[String(g)] ? `${doc.names[String(g)]}: ` : ''}${xs.map((x) => x.name).join(' / ')}`, done: xs.every((x) => visited.has(x.id)) })
    else for (const x of xs) out.push({ text: x.name, done: visited.has(x.id) })
  }
  return out
}

/**
 * ตารางเยี่ยมเยียนรายสัปดาห์ (รูปแบบตารางที่ใช้จริง): แถว = วัน (อังคาร–เสาร์) · คอลัมน์ = กิจกรรมประจำ + ภาคเช้า/บ่าย/ค่ำ
 * ดึงจากแผนเยี่ยม (ขั้น 1 วางแผน → ขั้น 2 จัดกลุ่ม เลือกภาค) · ✓ = บันทึกเยี่ยมแล้ว · แตะช่องเพื่อเพิ่มข้อความ (เช่น เตรียมสถานที่งาน) · พิมพ์/PDF A4 แนวนอน
 */
export default function VisitTimetable() {
  const { settings } = useSettings()
  const church = settings.churchName.split(' ')[0]
  const plans = useVisitPlans()
  const visits = useVisits(true)
  const today = todayISO()
  const [anchor, setAnchor] = usePlanDate(today)
  const sunday = sundayOf(anchor)
  const days = weekDays(sunday).filter((d) => dayKind(d) === 'visit')
  const ref = useRef<HTMLDivElement>(null)
  const canEdit = plans.canEdit()
  const monday = addDays(sunday, 1)
  const fixed = plans.fixedOf(monday) || DEFAULT_FIXED
  const visitedBy = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const v of visits.list) if (!v.absent) m.set(v.date, new Set([...(m.get(v.date) ?? []), v.memberId]))
    return m
  }, [visits.list])
  const shift = (n: number) => { const t = addDays(sunday, n * 7 + 3); setAnchor(t < today ? today : t) }
  const editNote = (d: string, slot: Slot) => {
    if (!canEdit) return
    const doc = plans.of(d)
    const v = window.prompt(`ข้อความเพิ่มเติม ${DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()]} ${dmy(d)} ภาค${slot} (เช่น เตรียมสถานที่งาน · ว่าง = ลบ)`, doc.slotNotes?.[slot] ?? '')
    if (v === null) return
    plans.save(d, setSlotNote(doc, slot, v))
  }
  const total = days.reduce((n, d) => n + plans.of(d).items.length, 0)
  return (
    <section aria-label="ตารางเยี่ยมเยียน">
      <div className="no-print weekbar" style={{ margin: '0.2rem 0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="mini" aria-label="สัปดาห์ก่อน" disabled={addDays(sunday, -4) < today && sunday <= sundayOf(today)} onClick={() => shift(-1)}>‹</button>
        <div style={{ textAlign: 'center', lineHeight: 1.25 }}><b>ตารางเยี่ยม</b><br /><span className="small">{rangeTitle(days[0], days[days.length - 1])} · {total} คนในแผน</span></div>
        <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" onClick={() => shift(1)}>›</button>
      </div>
      {canEdit && (
        <div className="field no-print" style={{ margin: '0 0 0.4rem' }}><label htmlFor="vt-fixed">คอลัมน์กิจกรรมประจำ (เช่น กลุ่มอธิษฐาน · ศึกษาพระคัมภีร์) — แก้ได้</label>
          <textarea id="vt-fixed" className="input" rows={3} defaultValue={fixed} key={monday} onBlur={(e) => { const v = e.target.value.trim(); if (v !== fixed.trim()) plans.saveFixed(monday, v) }} /></div>
      )}
      <ScaledPage ref={ref} landscape>
        <>
          <PaperHead church={church} title="" sub="" compact />
          <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: RED, margin: '2px 0 8px' }}>ตารางเยี่ยมเยียนครอบครัวศิลาเอก วันที่ {rangeTitle(days[0], days[days.length - 1])}</div>
          <table aria-label="ตารางเยี่ยมเยียน" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', color: '#111' }}>
            <colgroup><col style={{ width: '13%' }} /><col style={{ width: '15%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /></colgroup>
            <thead>
              <tr>
                <th style={{ ...cell, textAlign: 'center', color: RED, fontSize: 16, verticalAlign: 'bottom' }}>วัน</th>
                <th style={{ ...cell }} />
                {SLOTS.map((sl) => <th key={sl.k} style={{ ...cell, textAlign: 'center', color: RED, fontSize: 15 }}>{sl.label} {sl.time.replace(' (กลุ่มเซล)', '')}{sl.k === 'ค่ำ' ? <><br />(กลุ่มเซล)</> : null}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const doc = plans.of(d), seen = visitedBy.get(d) ?? new Set<string>()
                return (
                  <tr key={d} style={{ height: 96 }}>
                    <td style={{ ...cell, textAlign: 'center', color: RED, fontWeight: 800, verticalAlign: 'middle' }}>{DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()]}<br />{dmy(d)}</td>
                    {i === 0 && <td rowSpan={days.length} style={{ ...cell, textAlign: 'center', fontWeight: 800, verticalAlign: 'middle', whiteSpace: 'pre-line' }}>{fixed}</td>}
                    {SLOTS.map((sl) => {
                      const ls = linesOf(doc, sl.k, seen), note = doc.slotNotes?.[sl.k]
                      return (
                        <td key={sl.k} style={{ ...cell, cursor: canEdit ? 'pointer' : undefined }} onClick={() => editNote(d, sl.k)} aria-label={`${DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()]} ภาค${sl.k}`}>
                          {ls.map((x, j) => <div key={j}>{j + 1}. {x.text}{x.done ? ' ✓' : ''}</div>)}
                          {note && <div style={{ whiteSpace: 'pre-line', marginTop: ls.length ? 4 : 0, fontWeight: 600 }}>{note}</div>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 12, marginTop: 6, color: '#444' }}>✓ = ไปเยี่ยมและบันทึกแล้ว · ที่ยังไม่เลือกภาคนับเป็นภาคบ่าย</div>
        </>
      </ScaledPage>
      <PdfTools compact mode="landscape" els={() => (ref.current ? [ref.current] : [])} file={`ตารางเยี่ยม-${monday}.pdf`} title={`ตารางเยี่ยมเยียน ${rangeTitle(days[0], days[days.length - 1])}`} label="ตารางเยี่ยมเยียน" />
      <p className="muted small no-print" style={{ margin: '0.3rem 0 0', textAlign: 'center' }}>วางแผนที่ขั้น 1 → เลือกจุดและภาคที่ขั้น 2 → ตารางนี้อัปเดตเอง{canEdit ? ' · แตะช่องในตารางเพื่อเพิ่มข้อความ' : ''}</p>
    </section>
  )
}
