import { useMemo, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import { GIFT_KINDS, filterGifts, rankDonors, type RankKey } from '../lib/donorGifts'
import { fmtBaht, fmtDate, todayISO } from '../lib/money'
import type { ChurchMember, DonorGift, GiftKind } from '../lib/types'

const NAVY = '#14264a'
const MEDAL = ['🥇', '🥈', '🥉']
/** ยอดใหญ่ย่อเป็น ล้าน ให้พอดีช่อง */
const short = (satang: number) => (satang >= 100_000_000 ? `${(satang / 100_000_000).toFixed(2)} ล้าน` : fmtBaht(satang, { dec: false }))

/** กระดานผู้ถวาย: การ์ดสมาชิก (รูป ชื่อ จำนวนครั้ง ยอด แถบสัดส่วน %) เรียงมากสุดไว้บนสุด · เลือกดูตามกลุ่ม สถานะ เก่า/ใหม่ ช่วงเวลา ประเภท */
export default function DonorBoard({ gifts, members, nameOf, onOpen }: { gifts: DonorGift[]; members: ChurchMember[]; nameOf: (c: string) => string; onOpen: (code: string) => void }) {
  const today = todayISO()
  const all = useMemo(() => gifts.filter((g) => !g.deleted), [gifts])
  const year = '' // ตัวกรองอื่น (ปี กลุ่ม สถานะ เก่า/ใหม่ ประเภท) ปิดไว้ก่อน รอกำหนดเพิ่ม
  const kinds: GiftKind[] = GIFT_KINDS.filter((k) => k.k !== 'loan').map((k) => k.k)
  const group = '', status = ''
  const age = '' as '' | 'new' | 'old'
  const [sort, setSort] = useState<RankKey>('total')
  const [desc, setDesc] = useState(true)
  const [top, setTop] = useState(30)

  const byCode = useMemo(() => new Map(members.filter((m) => !m.deleted && m.code).map((m) => [m.code as string, m])), [members])
  /** ใหม่ = เข้าร่วมภายใน 12 เดือนล่าสุด */
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`
  const pass = (code: string) => {
    const m = byCode.get(code)
    if (group && (m?.group ?? (m ? '' : 'ผู้ถวายภายนอก')) !== group && !(group === 'ผู้ถวายภายนอก' && !m)) return false
    if (status && m?.status !== status) return false
    if (age && (!m?.since || (age === 'new') !== (m.since >= yearAgo))) return false
    return true
  }
  const fl = useMemo(() => filterGifts(all, { ...(kinds.length ? { kinds } : {}), ...(year ? { from: `${year}-01-01`, to: `${year}-12-31` } : {}) }).filter((g) => pass(g.code)), [all, kinds, year, group, status, age, byCode]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => rankDonors(fl, nameOf, sort, desc), [fl, nameOf, sort, desc])
  const total = fl.reduce((s, g) => s + g.amount, 0)
  const maxTotal = Math.max(1, ...rows.map((r) => r.total))
  const maxN = Math.max(1, ...rows.map((r) => r.n))
  const shown = rows.slice(0, top)

  return (
    <div className="stack">
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="bd-sort">เรียงตาม (มาก → น้อย)</label>
        <select id="bd-sort" className="input" value={sort} onChange={(e) => { setSort(e.target.value as RankKey); setDesc(true) }}>
          <option value="total">จำนวนเงิน</option>
          <option value="count">จำนวนครั้ง</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['👥 ผู้ถวาย', `${rows.length} คน`, '#e6eefc'], ['🔢 ครั้ง', `${fl.length}`, '#e3f4ea'], ['💰 ยอดรวม', short(total), '#fdecd8']].map(([l, v, c]) => <div key={l} style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden', background: c, color: NAVY, borderRadius: 12, padding: '6px 8px', textAlign: 'center' }}><small>{l}</small><div style={{ fontWeight: 800, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>{v}</div></div>)}
      </div>

      {shown.map((r, i) => {
        const m = byCode.get(r.code)
        const pct = total ? (r.total / total) * 100 : 0
        return (
          <button key={r.code} type="button" onClick={() => onOpen(r.code)} className="card" style={{ display: 'block', width: '100%', textAlign: 'left', margin: 0, padding: '6px 10px', borderLeft: `5px solid ${i === 0 ? '#c99a14' : i < 3 ? '#8fa6d6' : '#d6dbe8'}` }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 24, textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', flex: 'none' }}>{MEDAL[i] ?? i + 1}</span>
              <MemberAvatar path={m?.photoPath} name={r.name} size={40} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: '0.92rem', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}{m?.nick ? ` (${m.nick})` : ''}</b>
                <small className="muted" style={{ display: 'block', fontSize: '0.74rem', lineHeight: 1.2 }}>{r.n} ครั้ง · ล่าสุด {fmtDate(r.last)}</small>
              </span>
              <span style={{ textAlign: 'right', flex: 'none' }}><b className="num" style={{ fontSize: '0.98rem' }}>{fmtBaht(r.total, { dec: false })}</b><small style={{ display: 'block', fontSize: '0.72rem' }}>{pct.toFixed(1)}%</small></span>
            </span>
            <span style={{ display: 'grid', gap: 2, marginTop: 4 }}>
              <span style={{ background: '#eef0f5', borderRadius: 4, height: 5, display: 'block' }} aria-label="ยอดเทียบอันดับ 1"><span style={{ display: 'block', width: `${Math.max(2, (r.total / maxTotal) * 100)}%`, height: '100%', background: '#2f8f5b', borderRadius: 4 }} /></span>
              <span style={{ background: '#eef0f5', borderRadius: 4, height: 5, display: 'block' }} aria-label="จำนวนครั้งเทียบสูงสุด"><span style={{ display: 'block', width: `${Math.max(2, (r.n / maxN) * 100)}%`, height: '100%', background: '#3b6fd8', borderRadius: 4 }} /></span>
            </span>
          </button>
        )
      })}
      {rows.length === 0 && <p className="empty">ไม่มีข้อมูลตามที่เลือก</p>}
      {rows.length > top && <button type="button" className="btn" onClick={() => setTop(top + 30)}>แสดงเพิ่ม (อีก {rows.length - top} คน)</button>}
      <p className="small muted">แถบเขียว = ยอดเทียบอันดับ 1 · แถบฟ้า = จำนวนครั้งเทียบสูงสุด · % = สัดส่วนของยอดรวม · แตะการ์ดเพื่อเปิดประวัติรายคน</p>
    </div>
  )
}
