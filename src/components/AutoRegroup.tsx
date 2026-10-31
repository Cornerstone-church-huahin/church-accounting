import { useEffect, useMemo, useRef, useState } from 'react'
import { can } from '../lib/access'
import { effectiveRules, mergeGroupNames, proposeRegroup } from '../lib/ageGroups'
import { useAttendance, useChurchMembers, useSettings } from '../lib/data'
import { useRole } from '../lib/members'
import { todayISO, yearOf } from '../lib/money'
import { statusLabel, toAttendance } from '../lib/registry'
import { effectiveStatusRules, proposeStatusMoves } from '../lib/statusRules'
import type { CheckIn } from '../lib/types'

type Note = { name: string; text: string }
/**
 * งานอัตโนมัติของทะเบียน (ทำเมื่อเปิดแอปด้วยบัญชีที่แก้ทะเบียนได้ · รอดึงข้อมูลล่าสุดก่อนเสมอ):
 * 1) แปลงสถานะเดิมที่มีเลขนำหน้า (1. 5. …) ให้เป็นชื่อสถานะล้วน
 * 2) เปลี่ยนสถานะตามเกณฑ์ความถี่ (ตั้งค่าได้ที่ “เกณฑ์สถานะ”): คนใหม่ → ผู้ร่วมนมัสการ → สมาชิกสำรอง
 * 3) ย้ายกลุ่มตามอายุ+เพศเมื่อถึงช่วงวัย
 * ไม่แตะคนที่ไม่มีข้อมูลพอ · ปิด 2) 3) ได้ในตั้งค่า · แจ้งผลให้เห็น
 */
export default function AutoRegroup() {
  const role = useRole()
  const allowed = can(role, 'registry')
  const people = useChurchMembers()
  const { settings } = useSettings()
  const thisYear = yearOf(todayISO())
  const a0 = useAttendance(thisYear), a1 = useAttendance(thisYear - 1, false), a2 = useAttendance(thisYear - 2, false), a3 = useAttendance(thisYear - 3, false)
  const attendance = useMemo(() => toAttendance([a3, a2, a1, a0].flatMap((s) => s.items) as (CheckIn | import('../lib/types').Attendance)[]), [a0.items, a1.items, a2.items, a3.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = useRef('')
  const [notes, setNotes] = useState<Note[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!allowed) return
    if (people.sync.state !== 'ok' && people.sync.state !== 'off') return   // รอดึงข้อมูลล่าสุดก่อน (กันเขียนทับด้วยข้อมูลเก่า)
    const today = todayISO(), now = Date.now()
    let items = people.items
    const patches = new Map<string, Record<string, unknown>>()
    const apply = (id: string, patch: Record<string, unknown>) => patches.set(id, { ...(patches.get(id) ?? {}), ...patch })
    const log: Note[] = []
    // 1) เอาเลขนำหน้าสถานะออก
    for (const m of items) {
      if (m.status && m.status !== statusLabel(m.status) && statusLabel(m.status) !== statusLabel(undefined)) apply(m.id, { status: statusLabel(m.status) })
    }
    // 1.5) รวมชื่อกลุ่มซ้ำ (ไม่มีเลข → มีเลข) ก่อนจัดกลุ่มตามอายุ
    for (const [id, to] of mergeGroupNames(items)) {
      const m = items.find((x) => x.id === id)!
      apply(id, { group: to })
      log.push({ name: m.name, text: `กลุ่ม ${m.group} → ${to} (รวมชื่อกลุ่มซ้ำ)` })
    }
    const view = () => items.map((m) => (patches.has(m.id) ? { ...m, ...patches.get(m.id) } : m))
    // 2) เปลี่ยนสถานะตามระยะเวลาที่มานมัสการ
    if (settings.statusAuto !== false && attendance.length > 0) {
      for (const mv of proposeStatusMoves(view(), attendance, today, effectiveStatusRules(settings.statusRules))) {
        apply(mv.m.id, { status: mv.to, statusAt: today, statusMoved: { from: mv.from, at: now, why: mv.why } })
        log.push({ name: mv.m.name, text: `สถานะ ${mv.from} → ${mv.to} (${mv.why})` })
      }
    }
    // 3) ย้ายกลุ่มตามอายุ
    if (settings.ageAuto !== false) {
      const cur = view()
      const groups = [...new Set(cur.map((x) => x.group?.trim()).filter(Boolean) as string[])]
      for (const p of proposeRegroup(cur, effectiveRules(settings.ageRules, groups), today)) {
        apply(p.m.id, { group: p.to, groupMoved: { from: p.from, at: now } })
        log.push({ name: p.m.name, text: `กลุ่ม ${p.from || '(ไม่มีกลุ่ม)'} → ${p.to} (อายุ ${p.age} ปี)` })
      }
    }
    if (patches.size === 0) return
    const sig = [...patches].map(([id, p]) => id + JSON.stringify(p)).join('|').replace(/"at":\d+/g, '')
    if (done.current === sig) return   // ครั้งนี้ลองแล้ว (เช่น ไม่มีสิทธิ์เขียน) ไม่วนซ้ำ
    done.current = sig
    items = view()
    const changed = items.filter((m) => patches.has(m.id)).map((m) => ({ ...m, updated: now }))
    if (people.put(changed) && log.length > 0) setNotes(log)
  }, [allowed, people.items, people.sync.state, attendance, settings.ageAuto, settings.statusAuto, settings.ageRules, settings.statusRules]) // eslint-disable-line react-hooks/exhaustive-deps
  if (notes.length === 0) return null
  const names = new Set(notes.map((n) => n.name)).size
  return (
    <div className="no-print" role="status" style={{ background: '#e8f6ea', borderBottom: '1px solid #9bd2a4', padding: '0.4rem 0.8rem', fontSize: '0.92rem' }}>
      🔄 ปรับข้อมูลทะเบียนอัตโนมัติ <b>{names} คน</b> แล้ว{' '}
      <button type="button" className="mini" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'ซ่อนรายการ' : 'ดูรายการ'}</button>{' '}
      <button type="button" className="mini" onClick={() => setNotes([])}>ปิด</button>
      {open && <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem' }}>{notes.map((x, i) => <li key={i}><b>{x.name}</b>: {x.text}</li>)}</ul>}
    </div>
  )
}
