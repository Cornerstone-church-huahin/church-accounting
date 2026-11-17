import { useMemo, useState } from 'react'
import ImageTools from './ImageTools'
import Sheet from './Sheet'
import { loadAttachment } from '../lib/imageExport'
import { fmtBaht, fmtDate, sheetSunday } from '../lib/money'
import type { IncomeEntry } from '../lib/types'

/**
 * แชร์สลิปปิดชื่อ: รายการสลิปที่มีรูป เรียงใหม่ → เก่าเสมอ (วันที่-เวลาโอน) · ติ๊กเลือกกี่ไฟล์ก็ได้ แล้วแชร์/ดาวน์โหลด/พิมพ์ทีเดียว (ส่งรูปที่ปิดชื่อแล้วเท่านั้น)
 * ใบที่ยังไม่มีรูปปิดชื่อ ติ๊กไม่ได้ — กด “ดู/ปรับ” เพื่อสร้างก่อน
 */
export default function SlipSharePicker({ entries, sunday, typeName, donorOf, onOpen, onClose }: { entries: IncomeEntry[]; sunday: string; typeName: (id: string) => string; donorOf: (id?: string) => string; onOpen: (x: IncomeEntry) => void; onClose: () => void }) {
  const [scope, setScope] = useState<'all' | 'week'>('all')
  const [pick, setPick] = useState<Set<string>>(new Set())
  const list = useMemo(() => entries.filter((x) => scope === 'all' || sheetSunday(x.date) === sunday).sort((a, b) => `${b.date} ${b.time ?? '00:00'}`.localeCompare(`${a.date} ${a.time ?? '00:00'}`) || b.updated - a.updated), [entries, scope, sunday])
  const ready = list.filter((x) => x.slipMasked)
  const chosen = ready.filter((x) => pick.has(x.id))
  const toggle = (id: string) => setPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <Sheet title="🔒 แชร์สลิปปิดชื่อ" onClose={onClose}>
      <div className="seg seg--2" role="tablist" aria-label="ช่วงที่แสดง">
        <button type="button" role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>ทุกสัปดาห์ (ใหม่สุดก่อน)</button>
        <button type="button" role="tab" aria-selected={scope === 'week'} className={scope === 'week' ? 'on' : ''} onClick={() => setScope('week')}>เฉพาะสัปดาห์ที่เลือก</button>
      </div>
      {list.length === 0 ? <p className="muted">ยังไม่มีสลิปที่แนบรูปไว้{scope === 'week' ? 'ในสัปดาห์นี้' : ''} — กด “📷 ถ่ายรูปสลิป” หรือ “📎 แนบสลิป” เพื่อสแกนก่อน</p> : (
        <>
          <div className="row row--between" style={{ alignItems: 'center' }}>
            <span className="small">เลือกแล้ว <b>{chosen.length}</b> จาก {ready.length} ไฟล์ที่พร้อมแชร์</span>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="mini" onClick={() => setPick(new Set(ready.map((x) => x.id)))}>เลือกทั้งหมด</button>
              <button type="button" className="mini" onClick={() => setPick(new Set())}>ล้าง</button>
            </span>
          </div>
          <ul className="list">{list.map((x) => (
            <li key={x.id} style={{ display: 'block', padding: '6px 0', borderBottom: '1px solid var(--line)', background: pick.has(x.id) ? '#eef4ff' : undefined }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" style={{ width: 26, height: 26, marginTop: 4 }} disabled={!x.slipMasked} checked={pick.has(x.id)} onChange={() => toggle(x.id)} aria-label={`เลือกสลิป ${typeName(x.typeId)} ${fmtBaht(x.amount)}`} />
                <span className="grow"><b>{typeName(x.typeId)}</b>{x.memberNo ? <span className="small muted"> · {x.memberNo}</span> : null}{donorOf(x.donorId) ? <span className="small" style={{ color: '#1a56db' }}> · 👤 {donorOf(x.donorId)}</span> : null}<br />
                  <span className="small muted">{fmtDate(x.date)}{x.time ? ` ${x.time} น.` : ''}</span>{!x.slipMasked && <span className="small" style={{ color: '#a4262c' }}> · ⚠ ยังไม่มีรูปปิดชื่อ</span>}</span>
                <b className="num">{fmtBaht(x.amount)}</b>
              </div>
              <button type="button" className="mini" style={{ marginTop: 4, marginLeft: 36 }} onClick={() => onOpen(x)}>{x.slipMasked ? '🔒 ดู/ปรับ' : '🔒 สร้างรูปปิดชื่อ'}</button>
            </li>))}</ul>
          {chosen.length > 0
            ? <ImageTools key={chosen.map((x) => x.id).join(',')} load={() => Promise.all(chosen.map((x) => loadAttachment((x.slipMasked as { path: string }).path)))} title={`สลิปปิดชื่อ ${chosen.length} ใบ`} base={`สลิปปิดชื่อ-${chosen.length}ใบ`} />
            : <p className="muted small" style={{ margin: 0 }}>ติ๊กเลือกสลิปที่ต้องการส่ง แล้วปุ่มดาวน์โหลด / แชร์ PDF / แชร์เป็นรูป / พิมพ์ จะขึ้นให้ (ส่งเฉพาะรูปที่ปิดชื่อแล้ว)</p>}
        </>)}
    </Sheet>
  )
}
