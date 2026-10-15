import { useState } from 'react'
import MemberAvatar from './MemberAvatar'
import { genderFromGroup, genderStats, statusLabel, type GenderRow } from '../lib/registry'
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
  const hinted = missing.filter((m) => genderFromGroup(m.group))
  const set = (m: ChurchMember, gender: Gender) => put([{ ...m, gender }])
  const fillByGroup = () => {
    if (!hinted.length || !confirm(`เติมเพศให้ ${hinted.length} คนที่อยู่ในกลุ่ม “สตรี” (→ หญิง) และ “บรุษ” (→ ชาย) ตามชื่อกลุ่ม?\n\nผลอาจไม่ตรงทุกคน (เช่น ชื่อกลุ่มไม่ได้บอกเพศเสมอไป) แก้รายคนได้ภายหลัง`)) return
    put(hinted.map((m) => ({ ...m, gender: genderFromGroup(m.group)! })))
  }
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
      <section className="card" aria-label="สัดส่วนเพศ">
        {bar('ชาย', g.total.ชาย, 'bar-male')}
        {bar('หญิง', g.total.หญิง, 'bar-female')}
        {bar('ไม่ระบุ', g.total.ไม่ระบุ, 'bar-none')}
      </section>
      <Table title="แยกตามสถานะ" rows={g.byStatus} />
      <Table title="แยกตามกลุ่ม" rows={g.byGroup} />
      {canEdit && missing.length > 0 && (
        <section className="card" aria-label="ระบุเพศคนที่ยังว่าง">
          <h2>ระบุเพศ ({missing.length} คนยังว่าง)</h2>
          <p className="small muted" style={{ margin: 0 }}>แตะ “ชาย” หรือ “หญิง” ที่แต่ละคน บันทึกทันทีและซิงก์ให้ทุกเครื่อง</p>
          <div className="row no-print">
            <input className="input grow" placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} aria-label="ค้นหาคนที่ยังไม่ระบุเพศ" />
            {hinted.length > 0 && <button type="button" className="btn btn--ghost" onClick={fillByGroup}>เติมตามกลุ่ม สตรี/บรุษ ({hinted.length})</button>}
          </div>
          <ul className="list">
            {list.slice(0, shown).map((m) => (
              <li key={m.id}>
                <div className="item">
                  <MemberAvatar path={m.photoPath} name={m.name} size={48} />
                  <button type="button" className="grow" style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => onOpen(m.id)} aria-label={`ดูข้อมูล ${m.name}`}>
                    <b>{m.name}</b>{m.nick ? <span className="muted"> ({m.nick})</span> : null}
                    <br /><span className="small muted">{[m.code && `#${m.code}`, statusLabel(m.status), m.group].filter(Boolean).join(' · ')}</span>
                  </button>
                  <span style={{ display: 'flex', gap: 6 }}>
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
