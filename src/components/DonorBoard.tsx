import { useMemo, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import { GIFT_KINDS, filterGifts, kindInfo, rankDonors, type RankKey } from '../lib/donorGifts'
import { fmtBaht, fmtDate, todayISO } from '../lib/money'
import type { ChurchMember, DonorGift, GiftKind } from '../lib/types'

const NAVY = '#14264a'
const MEDAL = ['🥇', '🥈', '🥉']

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
        <label htmlFor="bd-sort">เรียงลำดับ</label>
        <select id="bd-sort" className="input" value={`${sort}-${desc ? 'd' : 'a'}`} onChange={(e) => { const [k, d] = e.target.value.split('-'); setSort(k as RankKey); setDesc(d === 'd') }}>
          <option value="total-d">จำนวนเงิน (มาก → น้อย)</option>
          <option value="total-a">จำนวนเงิน (น้อย → มาก)</option>
          <option value="count-d">จำนวนครั้ง (มาก → น้อย)</option>
          <option value="count-a">จำนวนครั้ง (น้อย → มาก)</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['👥 ผู้ถวาย', `${rows.length} คน`, '#e6eefc'], ['🔢 ครั้ง', `${fl.length}`, '#e3f4ea'], ['💰 ยอดรวม', fmtBaht(total, { dec: false }), '#fdecd8']].map(([l, v, c]) => <div key={l} style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden', background: c, color: NAVY, borderRadius: 12, padding: '6px 8px', textAlign: 'center' }}><small>{l}</small><div style={{ fontWeight: 800, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>{v}</div></div>)}
      </div>

      {shown.map((r, i) => {
        const m = byCode.get(r.code)
        const pct = total ? (r.total / total) * 100 : 0
        const big = i < 3 && sort !== 'last'
        return (
          <button key={r.code} type="button" onClick={() => onOpen(r.code)} className="card" style={{ display: 'block', width: '100%', textAlign: 'left', margin: 0, padding: big ? '10px 12px' : '8px 12px', borderLeft: `6px solid ${i === 0 ? '#c99a14' : i < 3 ? '#8fa6d6' : '#d6dbe8'}` }}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 28, textAlign: 'center', fontWeight: 800 }}>{MEDAL[i] ?? i + 1}</span>
              <MemberAvatar path={m?.photoPath} name={r.name} size={big ? 60 : 44} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: big ? '1.1rem' : '1rem' }}>{r.name}</b>
                <br /><small className="muted">{m ? `${m.group ?? ''}${m.status ? ` · ${m.status}` : ''}` : 'ผู้ถวายภายนอก'} · ล่าสุด {fmtDate(r.last)}</small>
              </span>
              <span style={{ textAlign: 'right' }}><b className="num" style={{ fontSize: big ? '1.2rem' : '1.05rem' }}>{fmtBaht(r.total, { dec: false })}</b><br /><small>{r.n} ครั้ง</small></span>
            </span>
            <span style={{ display: 'grid', gap: 3, marginTop: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><small style={{ width: 62 }}>ยอด {pct.toFixed(1)}%</small><span style={{ flex: 1, background: '#eef0f5', borderRadius: 6, height: 10 }}><span style={{ display: 'block', width: `${Math.max(2, (r.total / maxTotal) * 100)}%`, height: '100%', background: '#2f8f5b', borderRadius: 6 }} /></span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><small style={{ width: 62 }}>ครั้ง</small><span style={{ flex: 1, background: '#eef0f5', borderRadius: 6, height: 10 }}><span style={{ display: 'block', width: `${Math.max(2, (r.n / maxN) * 100)}%`, height: '100%', background: '#3b6fd8', borderRadius: 6 }} /></span></span>
              <span style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden' }} aria-label="สัดส่วนประเภท">{Object.entries(r.byKind).map(([k, v]) => <span key={k} title={`${kindInfo(k as GiftKind).short} ${fmtBaht(v ?? 0, { dec: false })}`} style={{ width: `${((v ?? 0) / r.total) * 100}%`, background: kindInfo(k as GiftKind).color }} />)}</span>
            </span>
          </button>
        )
      })}
      {rows.length === 0 && <p className="empty">ไม่มีข้อมูลตามที่เลือก</p>}
      {rows.length > top && <button type="button" className="btn" onClick={() => setTop(top + 30)}>แสดงเพิ่ม (อีก {rows.length - top} คน)</button>}
      <p className="small muted">แถบเขียว = สัดส่วนยอดเทียบอันดับ 1 · แถบฟ้า = จำนวนครั้ง · แถบสีล่าง = สัดส่วนประเภทที่ถวาย · แตะการ์ดเพื่อเปิดประวัติรายคน</p>
    </div>
  )
}
