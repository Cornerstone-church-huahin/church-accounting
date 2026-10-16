import { useState } from 'react'
import MemberAvatar from './MemberAvatar'
import { guessGender, type Confidence } from '../lib/genderGuess'
import { genderStats, statusLabel, type GenderRow } from '../lib/registry'
import type { ChurchMember, Gender } from '../lib/types'

const pct = (n: number, t: number) => (t ? `${Math.round((n / t) * 100)}%` : '—')
const PAGE = 40

/** ตารางตัวเลข: ชาย / หญิง / ไม่ระบุ / รวม */
function Table({ title, rows }: { title: string; rows: GenderRow[] }) {
  return (
    <section className="card" aria-label={title}>
      <h2>{title}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ width: '100%', fontSize: '0.85rem' }}>
          <thead><tr><th style={{ textAlign: 'left' }}>{title.replace('แยกตาม', '')}</th><th className="num">ชาย</th><th className="num">หญิง</th><th className="num">ไม่ระบุ</th><th className="num">รวม</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><td>{r.key}</td><td className="num">{r.ชาย}</td><td className="num">{r.หญิง}</td><td className="num">{r.ไม่ระบุ}</td><td className="num"><b>{r.total}</b></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * ดูเพศ: ชายกี่คน หญิงกี่คน (รวม แยกตามสถานะ แยกตามกลุ่ม) + ตัวช่วยระบุเพศคนที่ยังว่าง (แตะ ชาย/หญิง ทีละคน)
 * ผู้บันทึกและแอดมินระบุได้ · ผู้ตรวจสอบดูอย่างเดียว
 */
export default function GenderView({ members, canEdit, put, onOpen }: { members: ChurchMember[]; canEdit: boolean; put: (x: ChurchMember[]) => boolean; onOpen: (id: string) => void }) {
  const g = genderStats(members)
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)
  const missing = members.filter((m) => !m.gender)
  const t = q.trim().toLowerCase().replace(/\s+/g, '')
  const list = (t ? missing.filter((m) => `${m.name}${m.nick ?? ''}${m.code ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t)) : missing).sort((a, b) => (Number(a.code) || 1e9) - (Number(b.code) || 1e9) || a.name.localeCompare(b.name, 'th'))
  const [conf, setConf] = useState<'' | Confidence>('')
  const set = (m: ChurchMember, gender: Gender) => put([{ ...m, gender, genderGuess: undefined }])
  const confirmGuess = (m: ChurchMember) => put([{ ...m, genderGuess: undefined }])
  const guesses = missing.map((m) => ({ m, g: guessGender(m) })).filter((x): x is { m: ChurchMember; g: NonNullable<ReturnType<typeof guessGender>> } => !!x.g)
  const cnt = (c: Confidence) => guesses.filter((x) => x.g.confidence === c).length
  const guessAll = () => {
    if (!guesses.length) return
    if (!confirm(`เดาเพศให้ ${guesses.length} คน จากที่ยังว่าง ${missing.length} คน\n(มั่นใจสูง ${cnt('high')} · กลาง ${cnt('mid')} · ต่ำ ${cnt('low')} · เดาไม่ได้ ${missing.length - guesses.length})\n\nทุกคนที่เดาจะมีเครื่องหมาย “เดา” ให้ตามตรวจ/แก้ภายหลัง ผลอาจผิดได้ โดยเฉพาะชื่อที่ใช้ได้ทั้งสองเพศและชื่อต่างชาติ`)) return
    put(guesses.map(({ m, g }) => ({ ...m, gender: g.gender, genderGuess: g.confidence })))
  }
  const guessed = members.filter((m) => m.gender && m.genderGuess)
  const order: Record<string, number> = { low: 0, mid: 1, high: 2 }
  const review = guessed.filter((m) => !conf || m.genderGuess === conf).sort((a, b) => order[a.genderGuess!] - order[b.genderGuess!] || a.name.localeCompare(b.name, 'th'))
  const [rshown, setRshown] = useState(PAGE)
  const confLabel: Record<Confidence, string> = { high: 'มั่นใจสูง', mid: 'ปานกลาง', low: 'ต่ำ' }
  const bar = (label: string, n: number, cls: string) => (
    <div className="row" style={{ flexWrap: 'nowrap', gap: '0.5rem' }}>
      <span style={{ width: '3.2rem' }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden', height: 18 }} aria-hidden><div className={cls} style={{ width: pct(n, g.total.total), height: '100%', minWidth: n ? 3 : 0 }} /></div>
      <b className="num" style={{ width: '5.5rem', textAlign: 'right' }}>{n} ({pct(n, g.total.total)})</b>
    </div>
  )
  return (
    <>
      <div className="kpi">
        <div><span>ชาย</span><b>{g.total.ชาย}</b></div>
        <div><span>หญิง</span><b>{g.total.หญิง}</b></div>
        <div><span>ยังไม่ระบุเพศ</span><b>{g.total.ไม่ระบุ}</b></div>
        <div><span>รวมทั้งหมด</span><b>{g.total.total}</b></div>
      </div>
      {guessed.length > 0 && <p className="small" role="note">ในตัวเลขนี้มี <b>{guessed.length} คน</b>ที่แอปเดาไว้ (ยังไม่ยืนยัน) — ตรวจได้ที่ “ตรวจเพศที่เดา” ด้านล่าง</p>}
      <section className="card" aria-label="สัดส่วนเพศ">
        {bar('ชาย', g.total.ชาย, 'bar-male')}
        {bar('หญิง', g.total.หญิง, 'bar-female')}
        {bar('ไม่ระบุ', g.total.ไม่ระบุ, 'bar-none')}
      </section>
      <Table title="แยกตามสถานะ" rows={g.byStatus} />
      <Table title="แยกตามกลุ่ม" rows={g.byGroup} />
      {canEdit && missing.length > 0 && (
        <section className="card" aria-label="เดาเพศให้ทุกคน">
          <h2>เดาเพศให้ทุกคน</h2>
          <p className="small" style={{ margin: 0 }}>เดาจาก คำนำหน้า · หมายเหตุ · ชื่อกลุ่ม (สตรี/บรุษ) · ชื่อต้น/ชื่อเล่น (ไทยและอังกฤษ) ตอนนี้เดาได้ <b>{guesses.length}</b> จาก {missing.length} คนที่ยังว่าง (มั่นใจสูง {cnt('high')} · ปานกลาง {cnt('mid')} · ต่ำ {cnt('low')}) ที่เหลือ {missing.length - guesses.length} คนเดาไม่ได้ ต้องระบุเอง</p>
          <button type="button" className="btn btn--gold btn--block" onClick={guessAll} disabled={!guesses.length}>เดาเพศให้ {guesses.length} คน</button>
          <p className="small muted" style={{ margin: 0 }}>เป็นแค่การคาดเดา ผิดได้ ทุกคนที่เดาจะมีเครื่องหมาย “เดา” และแก้ภายหลังได้</p>
        </section>
      )}
      {canEdit && guessed.length > 0 && (
        <section className="card" aria-label="ตรวจเพศที่เดา">
          <h2>ตรวจเพศที่เดา ({guessed.length} คน)</h2>
          <div className="chips no-print" aria-label="กรองตามความมั่นใจ">
            {(['', 'low', 'mid', 'high'] as const).map((c) => <button key={c} type="button" className={`mini${conf === c ? ' on' : ''}`} onClick={() => { setConf(c); setRshown(PAGE) }}>{c ? `${confLabel[c]} · ${guessed.filter((m) => m.genderGuess === c).length}` : `ทั้งหมด · ${guessed.length}`}</button>)}
          </div>
          <p className="small muted" style={{ margin: 0 }}>เรียงจากมั่นใจต่ำสุดก่อน · กด “ถูก” เพื่อยืนยัน หรือกด ชาย/หญิง เพื่อแก้</p>
          <ul className="list list--tight">
            {review.slice(0, rshown).map((m) => (
              <li key={m.id}>
                <div className="mrow mrow--tight">
                  <MemberAvatar path={m.photoPath} name={m.name} size={48} />
                  <button type="button" className="mrow__main" style={{ all: 'unset', cursor: 'pointer', minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.4 }} onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                    <b>{m.name}</b>{m.nick ? <span className="muted"> ({m.nick})</span> : null}
                    <br /><span className="small">เดาว่า <b>{m.gender}</b> · {confLabel[m.genderGuess!]}</span> <span className="small muted">({guessGender(m)?.why ?? ''})</span>
                  </button>
                  <span className="mrow__act">
                    <button type="button" className="mini" onClick={() => confirmGuess(m)} aria-label={`ยืนยันว่า ${m.name} เป็น${m.gender}`}>ถูก</button>
                    <button type="button" className="mini" onClick={() => set(m, m.gender === 'ชาย' ? 'หญิง' : 'ชาย')} aria-label={`แก้ ${m.name} เป็น${m.gender === 'ชาย' ? 'หญิง' : 'ชาย'}`}>แก้เป็น{m.gender === 'ชาย' ? 'หญิง' : 'ชาย'}</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {review.length > rshown && <button type="button" className="btn btn--ghost btn--block" onClick={() => setRshown(rshown + PAGE)}>แสดงเพิ่ม (เหลือ {review.length - rshown} คน)</button>}
        </section>
      )}
      {canEdit && missing.length > 0 && (
        <section className="card" aria-label="ระบุเพศคนที่ยังว่าง">
          <h2>ระบุเพศ ({missing.length} คนยังว่าง)</h2>
          <p className="small muted" style={{ margin: 0 }}>แตะ “ชาย” หรือ “หญิง” ที่แต่ละคน บันทึกทันทีและซิงก์ให้ทุกเครื่อง</p>
          <div className="toolbar no-print">
            <input className="input full" placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} aria-label="ค้นหาคนที่ยังไม่ระบุเพศ" />
          </div>
          <ul className="list list--tight">
            {list.slice(0, shown).map((m) => (
              <li key={m.id}>
                <div className="mrow mrow--tight">
                  <MemberAvatar path={m.photoPath} name={m.name} size={48} />
                  <button type="button" className="mrow__main" style={{ all: 'unset', cursor: 'pointer', minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.4 }} onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                    <b>{m.name}</b>{m.nick ? <span className="muted"> ({m.nick})</span> : null}
                    <br /><span className="small muted">{[m.code && `#${m.code}`, statusLabel(m.status), m.group].filter(Boolean).join(' · ')}</span>
                  </button>
                  <span className="mrow__act" style={{ flexDirection: 'row', minWidth: 0 }}>
                    <button type="button" className="mini" onClick={() => set(m, 'ชาย')} aria-label={`ระบุว่า ${m.name} เป็นชาย`}>ชาย</button>
                    <button type="button" className="mini" onClick={() => set(m, 'หญิง')} aria-label={`ระบุว่า ${m.name} เป็นหญิง`}>หญิง</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {list.length > shown && <button type="button" className="btn btn--ghost btn--block" onClick={() => setShown(shown + PAGE)}>แสดงเพิ่ม (เหลือ {list.length - shown} คน)</button>}
          {list.length === 0 && <p className="empty">ไม่พบรายชื่อตามที่ค้นหา</p>}
        </section>
      )}
    </>
  )
}
