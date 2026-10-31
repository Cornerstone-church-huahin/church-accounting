import { useEffect, useRef, useState } from 'react'
import { can } from '../lib/access'
import { effectiveRules, proposeRegroup } from '../lib/ageGroups'
import { useChurchMembers, useSettings } from '../lib/data'
import { useRole } from '../lib/members'
import { todayISO } from '../lib/money'

/**
 * ย้ายกลุ่มตามอายุอัตโนมัติ: เมื่อมีคนถึงช่วงวัยใหม่ (อายุครบเกณฑ์ของกลุ่มอื่น) ระบบย้ายกลุ่มให้เองเมื่อเปิดแอปด้วยบัญชีที่แก้ทะเบียนได้
 * · รอดึงข้อมูลล่าสุดก่อนเสมอ · ไม่แตะคนไม่มีวันเกิด/กลุ่มพิเศษ/ผู้ถูกล็อก/สิ้นสภาพ-เสียชีวิต · ปิดได้ที่ “จัดกลุ่มตามอายุ” · แจ้งผลให้เห็นและคืนกลุ่มเดิมได้
 */
export default function AutoRegroup() {
  const role = useRole()
  const allowed = can(role, 'registry')
  const people = useChurchMembers()
  const { settings } = useSettings()
  const done = useRef('')
  const [moved, setMoved] = useState<{ name: string; from: string; to: string }[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!allowed || settings.ageAuto === false) return
    if (people.sync.state !== 'ok' && people.sync.state !== 'off') return   // รอดึงข้อมูลล่าสุดก่อน (กันเขียนทับด้วยข้อมูลเก่า)
    const groups = [...new Set(people.items.map((x) => x.group?.trim()).filter(Boolean) as string[])]
    const props = proposeRegroup(people.items, effectiveRules(settings.ageRules, groups), todayISO())
    if (props.length === 0) return
    const sig = props.map((p) => `${p.m.id}>${p.to}`).join()
    if (done.current === sig) return   // ครั้งนี้ลองแล้ว (เช่น ไม่มีสิทธิ์เขียน) ไม่วนซ้ำ
    done.current = sig
    const now = Date.now()
    if (people.put(props.map((p) => ({ ...p.m, group: p.to, groupMoved: { from: p.from, at: now }, updated: now })))) setMoved(props.map((p) => ({ name: p.m.name, from: p.from, to: p.to })))
  }, [allowed, people.items, people.sync.state, settings.ageAuto, settings.ageRules]) // eslint-disable-line react-hooks/exhaustive-deps
  if (moved.length === 0) return null
  return (
    <div className="no-print" role="status" style={{ background: '#e8f6ea', borderBottom: '1px solid #9bd2a4', padding: '0.4rem 0.8rem', fontSize: '0.92rem' }}>
      🎂 ย้ายกลุ่มตามอายุอัตโนมัติ <b>{moved.length} คน</b> แล้ว{' '}
      <button type="button" className="mini" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'ซ่อนรายการ' : 'ดูรายการ'}</button>{' '}
      <button type="button" className="mini" onClick={() => setMoved([])}>ปิด</button>
      {open && <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem' }}>{moved.map((x, i) => <li key={i}>{x.name}: {x.from || '(ไม่มีกลุ่ม)'} → <b>{x.to}</b></li>)}</ul>}
    </div>
  )
}
