import { useEffect, useState } from 'react'
import { getSync } from '../lib/sync'
import { getMeter, refreshRateLimit, subscribeMeter, type Meter } from '../lib/syncMeter'

const hm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const n = (x: number) => x.toLocaleString('en-US')

/**
 * มาตรวัดโควตา GitHub ของรหัสเข้าใช้ร่วม (นับรวมทุกเครื่องที่ใช้รหัสเดียวกัน) + จำนวนการเรียกของเครื่องนี้ใน 1 ชั่วโมงล่าสุด
 * ใช้ดูว่าการซิงก์กินโควตาเท่าไร · แตะ “อ่านค่าล่าสุด” เพื่ออัปเดต (การอ่านค่านี้ไม่กินโควตา)
 */
export default function QuotaMeter() {
  const [m, setM] = useState<Meter>(() => getMeter())
  const [busy, setBusy] = useState(false)
  const refresh = async () => {
    const cfg = getSync()
    if (!cfg) return
    setBusy(true)
    await refreshRateLimit(cfg.token)
    setM(getMeter()); setBusy(false)
  }
  useEffect(() => {
    const off = subscribeMeter(() => setM(getMeter()))
    void refresh()
    const t = window.setInterval(() => setM(getMeter()), 15_000) // ตัวนับ 1 ชม. เลื่อนตามเวลา
    return () => { off(); window.clearInterval(t) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const known = m.limit !== undefined && m.remaining !== undefined
  const pct = known ? Math.max(0, Math.min(100, Math.round((m.remaining! / m.limit!) * 100))) : 0
  const level = !known ? 'na' : pct <= 10 ? 'low' : pct <= 30 ? 'warn' : 'ok'
  return (
    <section className={`quota quota--${level}`} aria-label="มาตรวัดโควตา GitHub">
      <div className="quota__head"><b>📶 โควตา GitHub (ทุกเครื่องที่ใช้รหัสเดียวกัน)</b><button type="button" className="mini" disabled={busy} onClick={() => void refresh()} aria-label="อ่านค่าโควตาล่าสุด">{busy ? '…' : '🔄 อ่านค่าล่าสุด'}</button></div>
      {known ? (
        <>
          <div className="quota__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`โควตาคงเหลือ ${pct}%`}><i style={{ width: `${pct}%` }} /></div>
          <p className="quota__nums" role="status">เหลือ <b>{n(m.remaining!)}</b> จาก {n(m.limit!)} ครั้ง · ใช้ไปแล้ว {n(m.used ?? m.limit! - m.remaining!)} · เริ่มนับใหม่ {hm(m.reset!)} น.</p>
          {level === 'low' && <p className="quota__tip">⚠ ใกล้เต็ม — แอปจะหยุดถามอัตโนมัติจนกว่าจะถึงเวลาเริ่มนับใหม่ (ข้อมูลที่บันทึกยังเก็บในเครื่องและส่งขึ้นเมื่อโควตากลับมา)</p>}
        </>
      ) : <p className="quota__nums muted small">ยังไม่มีค่าโควตา — แตะ “อ่านค่าล่าสุด” (ต้องเชื่อมต่อออนไลน์)</p>}
      <p className="quota__calls small muted">เครื่องนี้เรียก GitHub {n(m.total)} ครั้งใน 1 ชม. ล่าสุด: ตรวจการเปลี่ยนแปลง {n(m.calls.check)} · ดึงไฟล์ {n(m.calls.pull)} · บันทึก {n(m.calls.push)} · ถามแล้วไม่เปลี่ยน {n(m.calls.cond)} (ไม่นับโควตา)</p>
    </section>
  )
}
