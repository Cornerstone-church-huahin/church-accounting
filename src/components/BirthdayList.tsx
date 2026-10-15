import { useState } from 'react'
import MemberAvatar from './MemberAvatar'
import { be, daysInMonth, diffDays, monthName } from '../lib/money'
import { ageText, statusLabel } from '../lib/registry'
import type { ChurchMember } from '../lib/types'

/** วันเกิดแบบอ่านง่าย: 12 มกราคม 2530 */
const longDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${monthName(m)} ${be(y)}` }

/** วันเกิดครั้งถัดไปของคนนี้ (ปีนี้หรือปีหน้า · 29 ก.พ. ปีไม่อธิกสุรทินนับ 28 ก.พ.) แล้วนับจำนวนวันจากวันนี้ */
export function daysUntilBirthday(birth: string, today: string): number {
  const [, bm, bd] = birth.split('-').map(Number)
  const ty = Number(today.slice(0, 4))
  const at = (y: number) => `${y}-${String(bm).padStart(2, '0')}-${String(Math.min(bd, daysInMonth(y, bm))).padStart(2, '0')}`
  const d = diffDays(at(ty), today)
  return d >= 0 ? d : diffDays(at(ty + 1), today)
}

/**
 * ดูวันเกิด: เรียงตาม เดือน → วัน → ปี พ.ศ. (จัดกลุ่มตามเดือน) · ตัวกรองเดือน · ไฮไลต์คนที่ใกล้ถึงวันเกิด
 * อายุคำนวณใหม่ทุกวันจากวันเกิดที่บันทึกไว้ ไม่ต้องรีเฟรช
 */
export default function BirthdayList({ members, today, onOpen }: { members: ChurchMember[]; today: string; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(0)
  const [q, setQ] = useState('')
  const withBirth = members.filter((m) => m.birth && /^\d{4}-\d{2}-\d{2}$/.test(m.birth))
  const key = (m: ChurchMember) => { const [y, mo, d] = m.birth!.split('-').map(Number); return mo * 1e6 + d * 1e4 + y }
  const t = q.trim().toLowerCase().replace(/\s+/g, '')
  const list = withBirth
    .filter((m) => (!month || Number(m.birth!.slice(5, 7)) === month) && (!t || `${m.name}${m.nick ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t)))
    .sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name, 'th'))
  const months = [...new Set(list.map((m) => Number(m.birth!.slice(5, 7))))]
  const counts = new Map<number, number>()
  for (const m of withBirth) counts.set(Number(m.birth!.slice(5, 7)), (counts.get(Number(m.birth!.slice(5, 7))) ?? 0) + 1)
  const soon = withBirth.filter((m) => daysUntilBirthday(m.birth!, today) <= 7).length
  return (
    <>
      <div className="kpi">
        <div><span>มีวันเกิดบันทึกไว้</span><b>{withBirth.length}</b></div>
        <div><span>ยังไม่มีวันเกิด</span><b>{members.length - withBirth.length}</b></div>
        <div><span>วันเกิดภายใน 7 วัน</span><b>{soon}</b></div>
      </div>
      <div className="row no-print">
        <input className="input grow" placeholder="ค้นหาชื่อ" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาชื่อ" />
        <select className="input" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="เดือนเกิด">
          <option value={0}>ทุกเดือน</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i + 1)} ({counts.get(i + 1) ?? 0})</option>)}
        </select>
      </div>
      <p className="small muted">เรียงตาม เดือน → วัน → ปีเกิด (พ.ศ.) · แตะชื่อเพื่อดูข้อมูลครบ · เพิ่ม/แก้วันเกิดได้ในข้อมูลรายคน</p>
      {list.length === 0 && <p className="empty">{withBirth.length ? 'ไม่พบรายชื่อตามที่กรอง' : 'ยังไม่มีใครบันทึกวันเกิด — กรอกในข้อมูลรายคน หรือใส่คอลัมน์ “วันเกิด” ในไฟล์นำเข้า'}</p>}
      {months.map((mo) => (
        <section className="card" key={mo} aria-label={`เกิดเดือน${monthName(mo)}`}>
          <h2>{monthName(mo)} <span className="muted small">({list.filter((m) => Number(m.birth!.slice(5, 7)) === mo).length} คน)</span></h2>
          <ul className="list">
            {list.filter((m) => Number(m.birth!.slice(5, 7)) === mo).map((m) => {
              const until = daysUntilBirthday(m.birth!, today)
              return (
                <li key={m.id}>
                  <button type="button" className="item" style={{ all: 'unset', display: 'flex', gap: '0.6rem', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                    <MemberAvatar path={m.photoPath} name={m.name} size={56} />
                    <span className="grow"><b>{m.name}</b>{m.nick ? <span className="muted"> ({m.nick})</span> : null}
                      <br /><span style={{ fontWeight: 600 }}>{longDate(m.birth!)}</span>
                      <br /><span className="small muted">อายุ {ageText(m.birth, today)} · {statusLabel(m.status)}</span>
                    </span>
                    {until === 0 ? <span className="badge badge--gold">🎂 วันนี้</span> : until <= 7 ? <span className="badge">อีก {until} วัน</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
