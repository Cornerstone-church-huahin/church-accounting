import { useMemo, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import MultiPick from './MultiPick'
import { absenceBar, absentMonths, visitCandidates, type VisitStat } from '../lib/pastoral'
import { OFFICIAL_STATUSES, statusShort } from '../lib/registry'
import type { ChurchMember } from '../lib/types'

export const monthsText = (n: number | null) => (n === null ? 'ไม่เคยมีบันทึกการมา' : n < 1 ? 'มาภายใน 1 เดือน' : n >= 12 ? `ขาด ${Math.floor(n / 12)} ปี${n % 12 ? ` ${n % 12} เดือน` : ''}` : `ขาด ${n} เดือน`)

/**
 * รายชื่อสมาชิกที่ควรไปเยี่ยม: ค้นหาชื่อ + เลือกสถานะ (หลายสถานะ) แถวเดียว → รายชื่อคนที่ขาดนมัสการตั้งแต่ 1 เดือนขึ้นไป
 * เรียงจากขาดน้อย → มาก มีรูป สถานะ และแถบสีแดงตามเดือนที่ขาด · ใช้ทั้งในฟอร์มบันทึกการเยี่ยม (แตะเลือกคน) และหน้าวางแผน (ดูอย่างเดียว)
 */
export default function AbsentList({ members, stats, today, selectedId, onPick, label }: {
  members: ChurchMember[]; stats: Map<string, VisitStat>; today: string
  selectedId?: string; onPick?: (m: ChurchMember, absentLabel: string) => void; label: string
}) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string[]>([])
  const list = useMemo(() => visitCandidates(members, { status, q }, stats, today).slice(0, 80), [members, status, q, stats, today])
  return (
    <>
      <div className="field"><label htmlFor="pv-q">{label}</label>
        <div className="pvfind">
          <input id="pv-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / ชื่อเล่น" />
          <MultiPick id="pv-st" title="สถานะสมาชิก" options={OFFICIAL_STATUSES.map((x) => ({ value: x, label: statusShort(x) }))} value={status} onChange={setStatus} empty="ทุกสถานะ" />
        </div></div>
      <div className="field"><span className="pvhint">② {q.trim() ? 'ผลการค้นหา' : `ขาดนมัสการตั้งแต่ 1 เดือนขึ้นไป${status.length ? ` · ${status.map(statusShort).join(', ')}` : ''}`} · เรียงจากขาดน้อย → มาก ({list.length} คน)</span>
        <ul className="pvpick" aria-label="รายชื่อสมาชิก">
          {list.map((m) => {
            const mo = absentMonths(stats.get(m.id)?.last, today), absent = mo === null || mo >= 1
            const body = (
              <>
                <MemberAvatar path={m.photoPath} name={m.name} size={48} />
                <span className="pvpick__body">
                  <span className="pvpick__who"><span><b>{m.name}</b>{m.nick?.trim() ? ` (${m.nick.trim()})` : ''} <small className="muted">{statusShort(m.status)}</small></span>
                    <b className={absent ? 'pvpick__abs' : 'pvpick__ok'}>{monthsText(mo)}</b></span>
                  {absent && <span className="pvabs" role="img" aria-label={`ขาดนมัสการ ${mo ?? 'ไม่ทราบ'} เดือน`}><span className="pvabs__f" style={{ width: `${Math.round(absenceBar(mo) * 100)}%` }} /></span>}
                </span>
              </>
            )
            return (
              <li key={m.id}>
                {onPick
                  ? <button type="button" className={`pvpick__r${selectedId === m.id ? ' on' : ''}`} aria-pressed={selectedId === m.id} onClick={() => onPick(m, absent ? monthsText(mo) : '')}>{body}</button>
                  : <div className="pvpick__r pvpick__r--ro">{body}</div>}
              </li>
            )
          })}
          {list.length === 0 && <li className="muted small">{q.trim() ? 'ไม่พบสมาชิก' : 'ไม่มีสมาชิกที่ขาดนมัสการตั้งแต่ 1 เดือนในสถานะนี้ — พิมพ์ค้นหาชื่อได้เลย'}</li>}
        </ul></div>
    </>
  )
}
