import { useMemo, useState } from 'react'
import WeekStrip from './WeekStrip'
import ShareReportSheet from './ShareReportSheet'
import { reportFromPeople } from '../lib/serviceReport'
import { weekDates } from '../lib/attendanceWeeks'
import { fmtDate, fmtDateLong, todayISO, yearOf } from '../lib/money'
import { serviceStats } from '../lib/registry'
import type { Attendance, ChurchMember } from '../lib/types'

const MAX_BARS = 26

/** ยอดผู้เข้าร่วมแต่ละครั้ง: กราฟ + ตาราง (แตะแถวดูรายชื่อคนที่มา) */
export default function Stats({ attendance, members }: { attendance: Attendance[]; members: ChurchMember[] }) {
  const stats = useMemo(() => serviceStats(attendance, members), [attendance, members])
  const [sel, setSel] = useState('')
  const [sharing, setSharing] = useState(false)   // อาทิตย์ที่เลือก ('' = ล่าสุดที่มีบันทึก)
  if (stats.length === 0) return <p className="empty">ยังไม่มีบันทึกลงชื่อนมัสการ — นำเข้าไฟล์ลงชื่อที่แท็บ “ทะเบียน” หรือลงชื่อทีละครั้งที่แท็บ “ลงชื่อ”</p>
  const total = stats.reduce((a, x) => a + x.count, 0)
  const recent = stats.slice(0, MAX_BARS).reverse()
  const max = Math.max(1, ...recent.map((x) => x.count))
  const peak = stats.reduce((a, x) => (x.count > a.count ? x : a), stats[0])
  const last12 = stats.filter((x) => x.date >= `${yearOf(stats[0].date) - 1}${stats[0].date.slice(4)}`)
  const avg = (xs: typeof stats) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.count, 0) / xs.length) : 0)
  const complete = (x: (typeof stats)[number]) => Object.entries(x.byStatus).filter(([st]) => /สมบูรณ์/.test(st)).reduce((a, [, n]) => a + n, 0)
  const W = 360, H = 64, bw = W / recent.length
  const today = todayISO()
  const picked = sel || stats[0].date
  const stat = stats.find((x) => x.date === picked)
  const counts = new Map(stats.map((x) => [x.date, x.count]))
  return (
    <>
      <WeekStrip dates={weekDates(stats.map((x) => x.date), today)} value={picked} onPick={setSel} counts={counts} today={today} />
      <div className="kpi kpi--tight">
        <div><span>จำนวนครั้งที่มีบันทึก</span><b>{stats.length}</b></div>
        <div><span>เฉลี่ยต่อครั้ง (ทั้งหมด)</span><b>{avg(stats)}</b></div>
        <div><span>เฉลี่ยต่อครั้ง (12 เดือนล่าสุด)</span><b>{avg(last12)}</b></div>
        <div><span>ล่าสุด {fmtDate(stats[0].date)}</span><b>{stats[0].count}</b></div>
        <div><span>สูงสุด {fmtDate(peak.date)}</span><b>{peak.count}</b></div>
        <div><span>รวมการมาทั้งหมด</span><b>{total.toLocaleString('th-TH')}</b></div>
      </div>
      <section className="card card--tight">
        <h2>ผู้เข้าร่วมแต่ละครั้ง (ล่าสุด {recent.length} ครั้ง)</h2>
        <figure className="chart" style={{ margin: 0 }} aria-label="จำนวนผู้เข้าร่วมนมัสการแต่ละครั้ง">
          <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`จำนวนผู้เข้าร่วม ${recent.map((x) => `${fmtDate(x.date)} ${x.count} คน`).join(', ')}`}>
            <line className="grid" x1={0} x2={W} y1={H} y2={H} />
            {recent.map((x, i) => {
              const h = Math.max(2, (x.count / max) * (H - 16))
              return (
                <g key={x.date}>
                  <rect className="s1" x={i * bw + 1.5} y={H - h} width={Math.max(2, bw - 3)} height={h} rx={2}><title>{`${fmtDate(x.date)} · ${x.count} คน`}</title></rect>
                  {(recent.length <= 13 || i % 2 === 0) && <text className="val" x={i * bw + bw / 2} y={H - h - 3} textAnchor="middle" fontSize="8">{x.count}</text>}
                </g>
              )
            })}
            <text x={0} y={H + 13} fontSize="9">{fmtDate(recent[0].date)}</text>
            <text x={W} y={H + 13} fontSize="9" textAnchor="end">{fmtDate(recent[recent.length - 1].date)}</text>
          </svg>
        </figure>
      </section>
      {stat && (
        <div className="sharebar no-print">
          <span className="small muted">สรุป {fmtDate(picked)} · {stat.count} คน</span>
          <button type="button" className="mini sharebar__b" onClick={() => setSharing(true)} aria-label={`แชร์สรุปนมัสการ ${fmtDateLong(picked)}`}>📤 แชร์</button>
        </div>
      )}
      {sharing && stat && <ShareReportSheet report={reportFromPeople(picked, stat.people, members)} onClose={() => setSharing(false)} />}
      <section className="card" aria-label="ตารางผู้เข้าร่วมแต่ละครั้ง">
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>วันที่ (แตะดูรูปรายชื่อ)</th><th className="num">รวม</th><th className="num">สมาชิกสมบูรณ์</th><th className="num">อื่น ๆ</th><th className="num">ใหม่</th></tr></thead>
            <tbody>
              {stats.map((x) => (
                <tr key={x.date} onClick={() => { setSel(x.date); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ cursor: 'pointer', ...(x.date === picked ? { background: '#fff6d6' } : {}) }} aria-selected={x.date === picked}>
                  <td>{x.date === picked ? '●' : '▸'} {fmtDate(x.date)}</td><td className="num"><b>{x.count}</b></td>
                  <td className="num">{complete(x)}</td><td className="num">{x.count - complete(x)}</td><td className="num">{x.people.some((p) => p.isNew) ? <b className="newcomer">{x.people.filter((p) => p.isNew).length}</b> : <span className="muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
