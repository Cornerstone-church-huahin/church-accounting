import { useMemo, useRef, useState } from 'react'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import { GIFT_KINDS, filterGifts, kindInfo, rankDonors, type RankKey } from '../lib/donorGifts'
import { useSettings } from '../lib/data'
import { be, fmtBaht, fmtDate, monthName, todayISO } from '../lib/money'
import { paginate } from '../lib/paginate'
import type { DonorGift, GiftKind } from '../lib/types'

const NAVY = '#14264a'
const PER = 16
type Period = 'all' | 'year' | 'month' | 'custom'
const keep: React.CSSProperties = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties

/** รายงานการถวายรายบุคคล: กรองตามช่วงเวลา/ประเภท/โครงการ/ชื่อ · เรียงตามยอด จำนวนครั้ง ชื่อ ล่าสุด · แชร์เป็น PDF/รูป/ข้อความ (แชร์ออกนอกแอปซ่อนชื่อเป็นรหัสโดยค่าเริ่มต้น) */
export default function DonorReport({ gifts, nameOf }: { gifts: DonorGift[]; nameOf: (c: string) => string }) {
  const church = useSettings().settings.churchName.split(' ')[0]
  const today = todayISO()
  const all = useMemo(() => gifts.filter((g) => !g.deleted), [gifts])
  const years = useMemo(() => [...new Set(all.map((g) => g.date.slice(0, 4)))].sort().reverse(), [all])
  // ตัวกรองช่วงเวลา/ประเภท/โครงการ ปิดไว้ก่อน (ทุกช่วง · ทุกประเภทยกเว้นให้ยืม) รอกำหนดเพิ่ม
  const period = 'all' as Period, year = years[0] ?? today.slice(0, 4), month = today.slice(0, 7), from = '', to = ''
  const kinds: GiftKind[] = GIFT_KINDS.filter((k) => k.k !== 'loan').map((k) => k.k)
  const project = ''
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<RankKey>('total')
  const desc = true
  const [codeOnly, setCodeOnly] = useState(false) // ติ๊ก = แสดงเฉพาะรหัส (ตัวใหญ่) ไม่แสดงชื่อ · มีผลทั้งหน้าจอและตอนแชร์
  const refs = useRef<(HTMLDivElement | null)[]>([])

  const range = period === 'year' ? { from: `${year}-01-01`, to: `${year}-12-31` } : period === 'month' ? { from: `${month}-01`, to: `${month}-31` } : period === 'custom' ? { from: from || undefined, to: to || undefined } : {}
  const codes = useMemo(() => { const t = q.trim().toLowerCase(); if (!t) return undefined; return new Set([...new Set(all.map((g) => g.code))].filter((c) => c.toLowerCase().includes(t) || nameOf(c).toLowerCase().includes(t))) }, [q, all, nameOf])
  const fl = useMemo(() => filterGifts(all, { ...range, ...(kinds.length ? { kinds } : {}), ...(project ? { project } : {}), ...(codes ? { codes } : {}) }), [all, range.from, range.to, kinds, project, codes]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => rankDonors(fl, nameOf, sort, desc), [fl, nameOf, sort, desc])
  const total = fl.reduce((s, g) => s + g.amount, 0)
  const periodText = period === 'all' ? 'ทุกช่วงเวลา' : period === 'year' ? `ปี ${be(Number(year))}` : period === 'month' ? `${monthName(Number(month.slice(5)))} ${be(Number(month.slice(0, 4)))}` : `${from ? fmtDate(from) : 'เริ่มต้น'} – ${to ? fmtDate(to) : 'ปัจจุบัน'}`
  const kindText = !kinds.length || kinds.length === GIFT_KINDS.length ? 'ทุกประเภท' : kinds.map((k) => kindInfo(k).short).join(' · ')
  const filterText = `${periodText} · ${kindText}${project ? ` · โครงการ ${project}` : ''}${q.trim() ? ` · ค้น “${q.trim()}”` : ''}`
  const pages = paginate(rows, PER)



  return (
    <div className="stack">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input id="rp-q" className="input" aria-label="ค้นชื่อหรือรหัส" placeholder="🔎 ค้นชื่อ/รหัส" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 0 }} />
        <select id="rp-sort" className="input" aria-label="เรียงตาม" value={sort} onChange={(e) => setSort(e.target.value as RankKey)} style={{ minWidth: 0 }}>
          <option value="total">จำนวนเงิน (มาก → น้อย)</option>
          <option value="count">จำนวนครั้ง (มาก → น้อย)</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['👥 ผู้ถวาย', `${rows.length} คน`, '#e6eefc'], ['🔢 ครั้ง', `${fl.length}`, '#e3f4ea'], ['💰 ยอดรวม', fmtBaht(total, { dec: false }), '#fdecd8']].map(([l, v, c]) => <div key={l} style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden', background: c, color: NAVY, borderRadius: 12, padding: '6px 8px', textAlign: 'center' }}><small>{l}</small><div style={{ fontWeight: 800, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>{v}</div></div>)}
      </div>
      <div className="no-print">
        <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" checked={codeOnly} onChange={(e) => setCodeOnly(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} /> แสดงเฉพาะรหัส (ซ่อนชื่อ)</label>
      </div>
      <PdfTools compact mode="full" els={() => refs.current.slice(0, pages.length).filter((x): x is HTMLDivElement => !!x)} file="รายงานการถวายรายบุคคล.pdf" title="รายงานการถวายรายบุคคล" label="รายงานการถวายรายบุคคล" />

      {pages.map((pg, pi) => (
        <ScaledPage key={pi} ref={(el) => { refs.current[pi] = el }}>
          <div style={{ ...keep, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', color: '#111' }}>
            <div style={{ ...keep, textAlign: 'center', border: '2px solid #c99a14', borderBottom: '5px solid #c99a14', borderRadius: 12, padding: '8px 12px', color: NAVY }}>
              <div style={{ fontSize: 14 }}>{church} · ✝</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>🙏 รายงานการถวายรายบุคคล</div>
              <div style={{ fontSize: 14 }}>{filterText}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{rows.length} คน · {fl.length} ครั้ง · รวม {fmtBaht(total)} บาท{pages.length > 1 ? ` · หน้า ${pi + 1}/${pages.length}` : ''}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, tableLayout: 'fixed' }}>
              <thead><tr style={{ ...keep, background: NAVY, color: '#fff' }}><th style={{ padding: 4, width: '7%' }}>#</th><th style={{ padding: 4, textAlign: 'left', width: '40%' }}>{codeOnly ? 'รหัสสมาชิก' : 'ผู้ถวาย'}</th><th style={{ padding: 4, width: '13%' }}>ครั้ง</th><th style={{ padding: 4, width: '20%', textAlign: 'right' }}>ยอดรวม</th><th style={{ padding: 4, width: '20%' }}>ถวายล่าสุด</th></tr></thead>
              <tbody>
                {pg.map((r, i) => (
                  <tr key={r.code} style={{ ...keep, background: i % 2 ? '#f3f6fc' : '#fff', borderBottom: '1px solid #d6dbe8' }}>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>{pi * PER + i + 1}</td>
                    <td style={{ padding: '4px 6px', fontWeight: 700, maxWidth: 360 }}>{codeOnly ? <span style={{ fontSize: 20 }}>สมาชิกเลขที่ <span style={{ fontSize: 24, letterSpacing: 1 }}>{r.code}</span></span> : <>{r.name} <span style={{ fontSize: 11, fontWeight: 400, color: '#555' }}>รหัส {r.code}</span></>}<div style={{ fontWeight: 400, fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>{Object.entries(r.byKind).map(([k, v]) => `${kindInfo(k as GiftKind).short} ${fmtBaht(v ?? 0, { dec: false })}`).join(' · ')}</div></td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>{r.n}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>{fmtBaht(r.total)}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>{r.last ? fmtDate(r.last) : ''}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center', color: '#777' }}>ไม่มีข้อมูลตามตัวกรองนี้</td></tr>}
              </tbody>
            </table>
            <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 12, color: '#666' }}>พิมพ์/สรุปเมื่อ {fmtDate(today)} · รายงานเท่านั้น ไม่กระทบยอดเงินจริง</div>
          </div>
        </ScaledPage>
      ))}
    </div>
  )
}
