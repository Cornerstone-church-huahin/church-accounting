import { useMemo, useRef, useState } from 'react'
import PdfTools from './PdfTools'
import ScaledPage from './ScaledPage'
import { GIFT_KINDS, filterGifts, kindInfo, rankDonors, type RankKey } from '../lib/donorGifts'
import { useSettings } from '../lib/data'
import { shareText } from '../lib/serviceReport'
import { be, fmtBaht, fmtDate, monthName, todayISO } from '../lib/money'
import { paginate } from '../lib/paginate'
import type { DonorGift, GiftKind } from '../lib/types'

const NAVY = '#14264a'
const PER = 30
type Period = 'all' | 'year' | 'month' | 'custom'
const SORTS: { k: RankKey; label: string }[] = [{ k: 'total', label: 'ยอดเงิน' }, { k: 'count', label: 'จำนวนครั้ง' }, { k: 'name', label: 'ชื่อ' }, { k: 'last', label: 'ล่าสุด' }]
const keep: React.CSSProperties = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties

/** รายงานการถวายรายบุคคล: กรองตามช่วงเวลา/ประเภท/โครงการ/ชื่อ · เรียงตามยอด จำนวนครั้ง ชื่อ ล่าสุด · แชร์เป็น PDF/รูป/ข้อความ (แชร์ออกนอกแอปซ่อนชื่อเป็นรหัสโดยค่าเริ่มต้น) */
export default function DonorReport({ gifts, nameOf, isExt }: { gifts: DonorGift[]; nameOf: (c: string) => string; isExt: (c: string) => boolean }) {
  const church = useSettings().settings.churchName.split(' ')[0]
  const today = todayISO()
  const all = useMemo(() => gifts.filter((g) => !g.deleted), [gifts])
  const years = useMemo(() => [...new Set(all.map((g) => g.date.slice(0, 4)))].sort().reverse(), [all])
  const [period, setPeriod] = useState<Period>('all')
  const [year, setYear] = useState(years[0] ?? today.slice(0, 4))
  const [month, setMonth] = useState(today.slice(0, 7))
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [kinds, setKinds] = useState<GiftKind[]>(GIFT_KINDS.filter((k) => k.k !== 'loan').map((k) => k.k))
  const [project, setProject] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<RankKey>('total')
  const [desc, setDesc] = useState(true)
  const [names, setNames] = useState(false)
  const [msg, setMsg] = useState('')
  const refs = useRef<(HTMLDivElement | null)[]>([])

  const range = period === 'year' ? { from: `${year}-01-01`, to: `${year}-12-31` } : period === 'month' ? { from: `${month}-01`, to: `${month}-31` } : period === 'custom' ? { from: from || undefined, to: to || undefined } : {}
  const projects = useMemo(() => [...new Set(all.filter((g) => g.kind === 'project' && g.project).map((g) => g.project as string))].sort(), [all])
  const codes = useMemo(() => { const t = q.trim().toLowerCase(); if (!t) return undefined; return new Set([...new Set(all.map((g) => g.code))].filter((c) => c.toLowerCase().includes(t) || nameOf(c).toLowerCase().includes(t))) }, [q, all, nameOf])
  const fl = useMemo(() => filterGifts(all, { ...range, kinds, ...(project ? { project } : {}), ...(codes ? { codes } : {}) }), [all, range.from, range.to, kinds, project, codes]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => rankDonors(fl, nameOf, sort, sort === 'name' ? !desc : desc), [fl, nameOf, sort, desc])
  const total = fl.reduce((s, g) => s + g.amount, 0)
  const label = (r: { code: string; name: string }) => (names ? r.name : isExt(r.code) ? `ผู้ถวายภายนอก ${r.code}` : `สมาชิก ${r.code}`)
  const periodText = period === 'all' ? 'ทุกช่วงเวลา' : period === 'year' ? `ปี ${be(Number(year))}` : period === 'month' ? `${monthName(Number(month.slice(5)))} ${be(Number(month.slice(0, 4)))}` : `${from ? fmtDate(from) : 'เริ่มต้น'} – ${to ? fmtDate(to) : 'ปัจจุบัน'}`
  const kindText = kinds.length === GIFT_KINDS.length ? 'ทุกประเภท' : kinds.map((k) => kindInfo(k).short).join(' · ')
  const filterText = `${periodText} · ${kindText}${project ? ` · โครงการ ${project}` : ''}${q.trim() ? ` · ค้น “${q.trim()}”` : ''}`
  const pages = paginate(rows, PER)
  const toggleKind = (k: GiftKind) => setKinds((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]))

  const copy = async () => {
    const lines = [`รายงานการถวายรายบุคคล · ${filterText}`, `${rows.length} คน · ${fl.length} ครั้ง · รวม ${fmtBaht(total)} บาท`, ...rows.map((r, i) => `${i + 1}. ${label(r)} — ${r.n} ครั้ง ${fmtBaht(r.total)}`)]
    const r = await shareText('รายงานการถวายรายบุคคล', lines.join('\n'))
    setMsg(r === 'copied' ? 'คัดลอกแล้ว วางในแชตได้เลย' : r === 'failed' ? 'แชร์/คัดลอกไม่สำเร็จ' : '')
  }

  return (
    <div className="stack">
      <div className="card" style={{ background: '#f6f8fc' }}>
        <b className="small">🔎 กรอง</b>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {([['all', 'ทั้งหมด'], ['year', 'รายปี'], ['month', 'รายเดือน'], ['custom', 'กำหนดเอง']] as const).map(([k, l]) => <button key={k} type="button" className={`mini${period === k ? ' on' : ''}`} aria-pressed={period === k} style={period === k ? { background: NAVY, color: '#fff' } : undefined} onClick={() => setPeriod(k)}>{l}</button>)}
        </div>
        {period === 'year' && <select className="input" aria-label="ปี" value={year} onChange={(e) => setYear(e.target.value)} style={{ marginTop: 6 }}>{years.map((y) => <option key={y} value={y}>{be(Number(y))}</option>)}</select>}
        {period === 'month' && <input className="input" type="month" aria-label="เดือน" value={month} onChange={(e) => setMonth(e.target.value)} style={{ marginTop: 6 }} />}
        {period === 'custom' && <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}><input className="input" type="date" aria-label="ตั้งแต่" value={from} onChange={(e) => setFrom(e.target.value)} /><span className="small">ถึง</span><input className="input" type="date" aria-label="ถึง" value={to} onChange={(e) => setTo(e.target.value)} /></div>}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }} role="group" aria-label="ประเภท">
          {GIFT_KINDS.map((k) => <button key={k.k} type="button" className="mini" aria-pressed={kinds.includes(k.k)} style={kinds.includes(k.k) ? { background: k.color, color: '#fff' } : { opacity: 0.55 }} onClick={() => toggleKind(k.k)}>{k.short}</button>)}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <input className="input" aria-label="ค้นชื่อหรือรหัส" placeholder="🔎 ค้นชื่อ/รหัส" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 10rem' }} />
          {projects.length > 0 && <select className="input" aria-label="โครงการ" value={project} onChange={(e) => setProject(e.target.value)} style={{ flex: '1 1 8rem' }}><option value="">ทุกโครงการ</option>{projects.map((p) => <option key={p} value={p}>{p}</option>)}</select>}
        </div>
        <b className="small" style={{ display: 'block', marginTop: 8 }}>↕ เรียงตาม</b>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {SORTS.map((s) => <button key={s.k} type="button" className="mini" aria-pressed={sort === s.k} style={sort === s.k ? { background: NAVY, color: '#fff' } : undefined} onClick={() => { if (sort === s.k) setDesc(!desc); else { setSort(s.k); setDesc(s.k !== 'name') } }}>{s.label}{sort === s.k ? (desc ? ' ▼' : ' ▲') : ''}</button>)}
        </div>
        <label className="small" style={{ display: 'block', marginTop: 8 }}><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> แสดงชื่อจริงในรายงานและตอนแชร์ (ปิดไว้ = แสดงเป็นรหัสสมาชิก)</label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['👥 ผู้ถวาย', `${rows.length} คน`, '#e6eefc'], ['🔢 จำนวนครั้ง', `${fl.length}`, '#e3f4ea'], ['💰 ยอดรวม', fmtBaht(total), '#fdecd8']].map(([l, v, c]) => <div key={l} style={{ flex: '1 1 30%', minWidth: 96, background: c, color: NAVY, borderRadius: 12, padding: '6px 8px', textAlign: 'center' }}><small>{l}</small><div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{v}</div></div>)}
      </div>
      {msg && <p className="note" role="status" onClick={() => setMsg('')}>{msg}</p>}
      <div className="row no-print" style={{ gap: 6 }}><button type="button" className="mini" onClick={() => void copy()}>📤 แชร์/คัดลอกเป็นข้อความ</button></div>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead><tr style={{ ...keep, background: NAVY, color: '#fff' }}><th style={{ padding: 4, width: '7%' }}>#</th><th style={{ padding: 4, textAlign: 'left' }}>{names ? 'ชื่อ' : 'ผู้ถวาย'}</th><th style={{ padding: 4, width: '13%' }}>ครั้ง</th><th style={{ padding: 4, width: '20%', textAlign: 'right' }}>ยอดรวม</th><th style={{ padding: 4, width: '20%' }}>ถวายล่าสุด</th></tr></thead>
              <tbody>
                {pg.map((r, i) => (
                  <tr key={r.code} style={{ ...keep, background: i % 2 ? '#f3f6fc' : '#fff', borderBottom: '1px solid #d6dbe8' }}>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>{pi * PER + i + 1}</td>
                    <td style={{ padding: '4px 6px', fontWeight: 700 }}>{label(r)}<div style={{ fontWeight: 400, fontSize: 11, color: '#555' }}>{Object.entries(r.byKind).map(([k, v]) => `${kindInfo(k as GiftKind).short} ${fmtBaht(v ?? 0, { dec: false })}`).join(' · ')}</div></td>
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
