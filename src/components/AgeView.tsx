import { useMemo, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import { AGE_BANDS, ageStats, ageYears, isLive } from '../lib/pastoral'
import type { ChurchMember } from '../lib/types'

const BLUE = '#2f6fb5', ROSE = '#d6578a', GRAY = '#9aa3ad'
const nf = (n: number) => n.toLocaleString('th-TH')

/** อายุสมาชิก: ตัวเลขสำคัญ · แผนภูมิช่วงวัย (ชาย/หญิง) · ปิรามิดตามช่วง 10 ปี · แตะช่วงวัยดูรายชื่อ */
export default function AgeView({ members, today, onOpen }: { members: ChurchMember[]; today: string; onOpen: (id: string) => void }) {
  const live = useMemo(() => members.filter(isLive), [members])
  const s = useMemo(() => ageStats(live, today), [live, today])
  const [band, setBand] = useState<string>('')
  const maxBand = Math.max(1, ...s.bands.map((b) => b.count))
  const maxDec = Math.max(1, ...s.decades.map((d) => Math.max(d.male, d.female + d.other)))
  const sel = AGE_BANDS.find((b) => b.key === band)
  const list = sel
    ? live.map((m) => ({ m, a: ageYears(m.birth, today) })).filter((x): x is { m: ChurchMember; a: number } => x.a != null && x.a >= sel.from && x.a <= sel.to).sort((x, y) => y.a - x.a || x.m.name.localeCompare(y.m.name, 'th'))
    : []
  const kpi = (label: string, v: string, sub?: string) => (
    <div className="kpi__c" style={{ textAlign: 'center' }}><span className="muted small">{label}</span><b style={{ display: 'block', fontSize: '1rem' }}>{v}</b>{sub && <small className="muted">{sub}</small>}</div>
  )
  return (
    <>
      <section className="card card--tight" aria-label="ภาพรวมอายุ">
        <h2 style={{ margin: 0 }}>อายุสมาชิก <span className="muted small">(ไม่รวมย้ายออก/เสียชีวิต)</span></h2>
        {s.known === 0 ? <p className="empty">ยังไม่มีวันเกิดในทะเบียน</p> : (
          <div className="kpi kpi--tight" role="group" aria-label="ตัวเลขอายุ" style={{ marginTop: '0.4rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
            {kpi('เฉลี่ย (ปี)', `${s.avg.toFixed(1)}`)}
            {kpi('กลาง (ปี)', `${s.median % 1 ? s.median.toFixed(1) : s.median}`)}
            {kpi('ต่ำสุด (ปี)', `${s.min}`)}
            {kpi('สูงสุด (ปี)', `${s.max}`)}
          </div>
        )}
        <p className="muted small" style={{ margin: '0.4rem 0 0' }}>ทราบวันเกิด {nf(s.known)} จาก {nf(live.length)} คน · ไม่ทราบ {nf(s.unknown)} คน — ยิ่งเก็บวันเกิดครบ ภาพรวมยิ่งตรง</p>
      </section>

      {s.known > 0 && (
        <>
          <section className="card card--tight" aria-label="ช่วงวัย">
            <h2 style={{ margin: 0 }}>ช่วงวัย <span className="muted small">(แตะเพื่อดูรายชื่อ)</span></h2>
            <p className="small" style={{ margin: '0.2rem 0' }}><span style={{ color: BLUE }}>■</span> ชาย &nbsp;<span style={{ color: ROSE }}>■</span> หญิง &nbsp;<span style={{ color: GRAY }}>■</span> ไม่ระบุ</p>
            {s.bands.map((b) => (
              <button key={b.key} type="button" aria-pressed={band === b.key} onClick={() => setBand(band === b.key ? '' : b.key)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: band === b.key ? 'var(--surface-2)' : 'transparent', border: 0, padding: '0.3rem 0.2rem', borderRadius: 8, textAlign: 'left', font: 'inherit', color: 'inherit' }}>
                <span style={{ width: '8.2rem', fontSize: '0.82rem' }}>{b.label}</span>
                <span aria-hidden style={{ flex: 1, display: 'flex', height: 18, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
                  <span style={{ width: `${(b.male / maxBand) * 100}%`, background: BLUE }} />
                  <span style={{ width: `${(b.female / maxBand) * 100}%`, background: ROSE }} />
                  <span style={{ width: `${(b.other / maxBand) * 100}%`, background: GRAY }} />
                </span>
                <b className="num" style={{ width: '4.6rem', textAlign: 'right' }}>{nf(b.count)} <small className="muted">({Math.round((b.count / s.known) * 100)}%)</small></b>
              </button>
            ))}
          </section>

          {sel && (
            <section className="card card--tight" aria-label={`รายชื่อ ${sel.label}`}>
              <h2 style={{ margin: 0 }}>{sel.label} · {nf(list.length)} คน</h2>
              {list.map(({ m, a }) => (
                <button key={m.id} type="button" onClick={() => onOpen(m.id)} className="row" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', background: 'transparent', border: 0, padding: '0.25rem 0', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
                  <MemberAvatar path={m.photoPath} name={m.name} size={36} member={m} />
                  <span style={{ flex: 1 }}>{m.name}{m.nick ? <span className="muted small"> ({m.nick})</span> : null}</span>
                  <b className="num">{a} ปี</b>
                </button>
              ))}
            </section>
          )}

          <section className="card card--tight" aria-label="ปิรามิดอายุ">
            <h2 style={{ margin: 0 }}>ปิรามิดอายุ <span className="muted small">(ชายซ้าย · หญิงขวา)</span></h2>
            <div role="img" aria-label="ปิรามิดอายุแยกเพศตามช่วง 10 ปี" style={{ marginTop: '0.3rem' }}>
              {[...s.decades].reverse().map((d) => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', height: 20, fontSize: '0.75rem' }}>
                  <b className="num" style={{ width: '1.6rem', textAlign: 'right', color: BLUE }}>{d.male || ''}</b>
                  <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}><span style={{ width: `${(d.male / maxDec) * 100}%`, height: 14, background: BLUE, borderRadius: '4px 0 0 4px' }} /></span>
                  <span style={{ width: '3.2rem', textAlign: 'center' }} className="muted">{d.label}</span>
                  <span style={{ flex: 1 }}><span style={{ display: 'block', width: `${((d.female + d.other) / maxDec) * 100}%`, height: 14, background: ROSE, borderRadius: '0 4px 4px 0' }} /></span>
                  <b className="num" style={{ width: '1.6rem', color: ROSE }}>{d.female + d.other || ''}</b>
                </div>
              ))}
            </div>
            <p className="muted small" style={{ margin: '0.3rem 0 0' }}>ฝั่งหญิงรวมคนไม่ระบุเพศ</p>
          </section>
        </>
      )}
    </>
  )
}
