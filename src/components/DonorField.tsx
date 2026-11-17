import { useMemo, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import Sheet from './Sheet'
import { searchMembers } from '../lib/memberSearch'
import type { DonorHint, DonorMatch } from '../lib/donorMatch'
import type { ChurchMember } from '../lib/types'

const nameOf = (m: ChurchMember) => m.name.replace(/^place:/, '')
const Row = ({ m, hint, onPick, mark }: { m: ChurchMember; hint?: string; onPick: () => void; mark?: boolean }) => (
  <button type="button" className="btn btn--block" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', marginBottom: 6, borderColor: mark ? '#1a56db' : undefined }} onClick={onPick} aria-label={`เลือก ${nameOf(m)}`}>
    <MemberAvatar path={m.photoPath} name={nameOf(m)} size={48} member={m} />
    <span className="grow"><b>{nameOf(m)}</b>{m.nick ? ` (${m.nick})` : ''}<br /><small className="muted">{m.code ? `รหัส ${m.code}` : 'ยังไม่มีรหัส'}{hint ? ` · ${hint}` : ''}</small></span>
  </button>
)

/**
 * ผู้ถวายในหน้าสแกนสลิป: ระบบจับคู่กับทะเบียนให้ (รหัสสมาชิก/ชื่อบนสลิป) · ไม่แน่ใจ = แสดงตัวเลือกใกล้เคียงพร้อมรูปให้เลือก · ค้นหาเองได้ · แก้ได้เสมอ
 * (ชื่อผู้ถวายใช้ภายในเพื่อประเมิน/ติดตามเท่านั้น ไม่แสดงในรายงาน/ใบประกาศ)
 */
export default function DonorField({ members, value, onChange, hint, match, remember, onRemember }: { members: ChurchMember[]; value: string; onChange: (id: string) => void; hint: DonorHint; match: DonorMatch | null; remember: boolean; onRemember: (v: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const sel = members.find((m) => m.id === value && !m.deleted)
  const auto = !!match?.member && match.member.id === value
  const found = useMemo(() => (q.trim() ? searchMembers(members, q, 30) : { direct: [] as ChurchMember[], related: [] as ChurchMember[] }), [members, q])
  const pick = (m: ChurchMember) => { onChange(m.id); setOpen(false); setQ('') }
  const learn = !!sel && !!hint.code && (sel.code ?? '').trim() !== hint.code
  return (
    <div className="field" style={{ border: '2px solid #1a56db33', borderRadius: 12, padding: 8 }}>
      <label style={{ fontWeight: 800 }}>👤 ผู้ถวาย (จากทะเบียนสมาชิก · ไม่แสดงในรายงาน)</label>
      {sel ? (
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <MemberAvatar path={sel.photoPath} name={nameOf(sel)} size={56} member={sel} />
          <span className="grow"><b>{nameOf(sel)}</b>{sel.nick ? ` (${sel.nick})` : ''}<br />
            <small style={{ color: auto ? '#1b6b3a' : '#555', fontWeight: 700 }}>{auto ? `✓ ระบบจับคู่ให้ (${match?.reason === 'code' ? 'ตรงรหัสสมาชิก' : 'ตรงชื่อ'})` : 'เลือกเอง'}{sel.code ? ` · รหัส ${sel.code}` : ''}</small></span>
          <button type="button" className="mini" onClick={() => setOpen(true)}>เปลี่ยน</button>
          <button type="button" className="mini" aria-label="ล้างผู้ถวาย" onClick={() => onChange('')}>✕</button>
        </div>
      ) : (
        <>
          <p className="small" style={{ margin: '2px 0', color: '#a4262c', fontWeight: 700 }}>⚠ ยังไม่ได้เลือกผู้ถวาย{hint.senderName || hint.contactName ? ` — ระบบอ่านชื่อได้: “${hint.contactName || hint.senderName}” แต่จับคู่ได้ไม่ชัด` : ''}</p>
          {(match?.candidates ?? []).slice(0, 4).map((m) => <Row key={m.id} m={m} onPick={() => pick(m)} mark hint="ตัวเลือกใกล้เคียง" />)}
          <button type="button" className="btn btn--block" onClick={() => setOpen(true)}>🔍 ค้นหา / เลือกจากทะเบียน (มีรูป)</button>
        </>
      )}
      {learn && sel && <label className="row" style={{ gap: 8, alignItems: 'center', marginTop: 6 }}><input type="checkbox" style={{ width: 22, height: 22 }} checked={remember} onChange={(e) => onRemember(e.target.checked)} /><span className="small">จำรหัส <b>{hint.code}</b> ไว้กับ {nameOf(sel)} (ครั้งต่อไปจับคู่อัตโนมัติ{sel.code ? ` · ของเดิมคือ ${sel.code} จะถูกแทนที่` : ''})</span></label>}
      {open && (
        <Sheet title="เลือกผู้ถวายจากทะเบียน" onClose={() => setOpen(false)}>
          <div className="field"><label htmlFor="df-q">ค้นหา ชื่อ นามสกุล ชื่อเล่น หรือรหัส</label><input id="df-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="พิมพ์ชื่อ…" /></div>
          {!q.trim() && (match?.candidates.length ?? 0) > 0 && <><b className="small">ตัวเลือกใกล้เคียงจากสลิป</b>{match!.candidates.map((m) => <Row key={m.id} m={m} onPick={() => pick(m)} mark />)}</>}
          {q.trim() && found.direct.length === 0 && found.related.length === 0 && <p className="muted">ไม่พบในทะเบียน — ลองพิมพ์ชื่ออื่น หรือกรอกเป็นข้อความเองในช่อง “พิมพ์ชื่อ/เลขเอง” ด้านล่างฟอร์ม</p>}
          {found.direct.map((m) => <Row key={m.id} m={m} onPick={() => pick(m)} />)}
          {found.related.length > 0 && <><b className="small">เกี่ยวข้อง (นามสกุล/ที่อยู่เดียวกัน)</b>{found.related.map((m) => <Row key={m.id} m={m} onPick={() => pick(m)} />)}</>}
        </Sheet>)}
    </div>
  )
}
