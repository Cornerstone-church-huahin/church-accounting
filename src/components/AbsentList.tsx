import { useMemo, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import MultiPick from './MultiPick'
import { absenceBar, absentMonths, ageYears, attendanceInWindow, isLive, orderByFrequency, orderByTenure, REG_PERIODS, tenureDays, tenureText, visitCandidates, type RegPeriod, type VisitStat } from '../lib/pastoral'
import { ageText, OFFICIAL_STATUSES, statusLabel, statusShort } from '../lib/registry'
import type { ChurchMember } from '../lib/types'

export const monthsText = (n: number | null) => (n === null ? 'ไม่เคยมีบันทึกการมา' : n < 1 ? 'มาภายใน 1 เดือน' : n >= 12 ? `ขาด ${Math.floor(n / 12)} ปี${n % 12 ? ` ${n % 12} เดือน` : ''}` : `ขาด ${n} เดือน`)

/**
 * รายชื่อสมาชิกที่ควรไปเยี่ยม: ค้นหาชื่อ + เลือกสถานะ (หลายสถานะ) แถวเดียว → รายชื่อคนที่ขาดนมัสการตั้งแต่ 1 เดือนขึ้นไป
 * เรียงจากขาดน้อย → มาก มีรูป สถานะ และแถบสีแดงตามเดือนที่ขาด · ใช้ทั้งในฟอร์มบันทึกการเยี่ยม (แตะเลือกคน) และหน้าวางแผน (ดูอย่างเดียว)
 */
const TABS = [['own', 'เก่าแก่'], ['fund', 'สม่ำเสมอ'], ['total', 'สถานะ'], ['indebt', 'กลุ่ม'], ['debt', 'อายุ'], ['land', 'เพศ']] as const
const grpOf = (m: { group?: string }) => { const raw = (m.group ?? '').trim(); return !raw || /ไม่มีกลุ่ม/.test(raw) ? 'ไม่มีกลุ่ม' : raw }

export default function AbsentList({ members, stats, today, selectedId, selectedIds, onPick, label, hideLabel, att }: {
  /** ใส่เมื่อต้องการแถบวิเคราะห์ 6 แบบ (เก่าแก่ · สม่ำเสมอ · สถานะ · กลุ่ม · อายุ · เพศ) แบบเดียวกับหน้ารวมสมาชิก */ att?: { date: string; ids: string[]; deleted?: boolean }[]
  members: ChurchMember[]; stats: Map<string, VisitStat>; today: string
  selectedId?: string; /** เลือกได้หลายคน (ตะกร้าแผนเยี่ยม) */ selectedIds?: string[]; onPick?: (m: ChurchMember, absentLabel: string) => void; label: string; /** ซ่อนข้อความหัวช่องค้นหา (ยังอ่านออกเสียงได้) */ hideLabel?: boolean
}) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string[]>([])
  const [tab, setTab] = useState(0) // 0 = ค่าเริ่มต้น (ขาดนมัสการ) · 1–6 = แถบวิเคราะห์
  const [period, setPeriod] = useState<RegPeriod>('3y')
  const per = REG_PERIODS.find((x) => x.k === period) ?? REG_PERIODS[0]
  const win = useMemo(() => attendanceInWindow(att ?? [], today, per.days), [att, today, per.days])
  const metric = (m: ChurchMember): string => {
    if (tab === 1) return tenureText(tenureDays(m.since, undefined, today))
    if (tab === 2) { const t = win.times.get(m.id) ?? 0; return `มา ${t}/${win.services} · ${Math.round(Math.min(1, t / Math.max(1, win.services)) * 100)}%` }
    if (tab === 3) return statusShort(m.status)
    if (tab === 4) return grpOf(m)
    if (tab === 5) return ageText(m.birth, today) || 'ไม่ทราบอายุ'
    if (tab === 6) return m.gender || 'ไม่ระบุเพศ'
    return ''
  }
  const list = useMemo(() => {
    if (!tab) return visitCandidates(members, { status, q }, stats, today).slice(0, 80)
    const needle = q.trim().toLowerCase()
    const base = members.filter((m) => isLive(m) && (status.length === 0 || status.includes(statusLabel(m.status))) && (!needle || `${m.name} ${m.nick ?? ''} ${m.code ?? ''}`.toLowerCase().includes(needle)))
    const byName = (a: ChurchMember, b: ChurchMember) => a.name.localeCompare(b.name, 'th')
    const rank = (m: ChurchMember) => { const i = OFFICIAL_STATUSES.indexOf(statusLabel(m.status)); return i < 0 ? 99 : i }
    let out: ChurchMember[]
    if (tab === 1) out = orderByTenure(base, (id) => { const m = base.find((x) => x.id === id); return m ? tenureDays(m.since, undefined, today) : null }, true)
    else if (tab === 2) out = orderByFrequency(base, (id) => win.times.get(id) ?? 0, true)
    else if (tab === 3) out = [...base].sort((a, b) => rank(a) - rank(b) || byName(a, b))
    else if (tab === 4) out = [...base].sort((a, b) => grpOf(a).localeCompare(grpOf(b), 'th', { numeric: true }) || byName(a, b))
    else if (tab === 5) out = [...base].sort((a, b) => (ageYears(b.birth, today) ?? -1) - (ageYears(a.birth, today) ?? -1) || byName(a, b))
    else out = [...base].sort((a, b) => (a.gender === b.gender ? 0 : a.gender === 'ชาย' ? -1 : b.gender === 'ชาย' ? 1 : a.gender === 'หญิง' ? -1 : 1) || byName(a, b))
    return out.slice(0, 150)
  }, [members, status, q, stats, today, tab, win]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {att && (
        <div className="field">
          <nav className="ptabs" role="tablist" aria-label="วิเคราะห์รายชื่อ">
            {TABS.map(([tone, name], i) => (
              <button key={tone} type="button" role="tab" aria-selected={tab === i + 1} className={`ptab btile--${tone}`} onClick={() => setTab(tab === i + 1 ? 0 : i + 1)}>{i + 1} {name}</button>
            ))}
          </nav>
          {tab === 2 && <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 6 }}><label htmlFor="pv-per" className="small">ความสม่ำเสมอ</label>
            <select id="pv-per" className="input" value={period} onChange={(e) => setPeriod(e.target.value as RegPeriod)}>{REG_PERIODS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select></div>}
        </div>
      )}
      <div className="field"><label htmlFor="pv-q" className={hideLabel ? 'sr-only' : undefined}>{label}</label>
        <div className="pvfind">
          <input id="pv-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / ชื่อเล่น" />
          <MultiPick id="pv-st" title="สถานะสมาชิก" allLabel="ทุกสถานะ" options={OFFICIAL_STATUSES.map((x) => ({ value: x, label: statusShort(x) }))} value={status} onChange={setStatus} empty="ทุกสถานะ" />
        </div></div>
      <div className="field"><span className="pvhint">② {tab ? `${TABS[tab - 1][1]}${tab === 2 ? ` · ${per.label}` : ''} · ${list.length} คน` : q.trim() ? 'ผลการค้นหา' : `ขาดนมัสการตั้งแต่ 1 เดือนขึ้นไป${status.length ? ` · ${status.map(statusShort).join(', ')}` : ''}`} · เรียงจากขาดน้อย → มาก ({list.length} คน)</span>
        <ul className="pvpick" aria-label="รายชื่อสมาชิก">
          {list.map((m) => {
            const mo = absentMonths(stats.get(m.id)?.last, today), absent = mo === null || mo >= 1
            const body = (
              <>
                <MemberAvatar path={m.photoPath} name={m.name} size={48} member={m} />
                <span className="pvpick__body">
                  <span className="pvpick__who"><span><b>{m.name}</b>{m.nick?.trim() ? ` (${m.nick.trim()})` : ''} <small className="muted">{statusShort(m.status)}</small></span>
                    {tab ? <b className="pvpick__ok">{metric(m)}</b> : <b className={absent ? 'pvpick__abs' : 'pvpick__ok'}>{monthsText(mo)}</b>}</span>
                  {!tab && absent && <span className="pvabs" role="img" aria-label={`ขาดนมัสการ ${mo ?? 'ไม่ทราบ'} เดือน`}><span className="pvabs__f" style={{ width: `${Math.round(absenceBar(mo) * 100)}%` }} /></span>}
                </span>
              </>
            )
            return (
              <li key={m.id}>
                {onPick
                  ? <button type="button" className={`pvpick__r${(selectedIds ? selectedIds.includes(m.id) : selectedId === m.id) ? ' on' : ''}`} aria-pressed={selectedIds ? selectedIds.includes(m.id) : selectedId === m.id} onClick={() => onPick(m, absent ? monthsText(mo) : '')}>{body}{selectedIds && <b className={`pvpick__add${selectedIds.includes(m.id) ? ' in' : ''}`} aria-hidden="true">{selectedIds.includes(m.id) ? '✓' : '＋'}</b>}</button>
                  : <div className="pvpick__r pvpick__r--ro">{body}</div>}
              </li>
            )
          })}
          {list.length === 0 && <li className="muted small">{q.trim() ? 'ไม่พบสมาชิก' : 'ไม่มีสมาชิกที่ขาดนมัสการตั้งแต่ 1 เดือนในสถานะนี้ — พิมพ์ค้นหาชื่อได้เลย'}</li>}
        </ul></div>
    </>
  )
}
