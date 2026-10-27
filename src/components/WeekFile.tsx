import { useEffect, useMemo, useRef, useState } from 'react'
import { computeWeekWithdraw } from '../lib/useWeekWithdraw'
import { IncomeSheetPaper, PaperHead, VoucherPaper, weekHeading } from './PaperSheets'
import ScaledPage from './ScaledPage'
import { circulatingOnly } from '../lib/balances'
import { getBinary, getSync, prefetchBinaries } from '../lib/sync'
import { cachedImage } from '../lib/imageCache'
import { useIncomeTypes, useSettings } from '../lib/data'
import { fmtBaht, fmtDate, sheetSunday, sundaysOf, todayISO } from '../lib/money'
import { ownLent, summarizeLoans } from '../lib/loans'
import { canSharePdf, downloadPagesPdf, sharePagesPdf } from '../lib/pdf'
import { useBalances } from '../lib/useBalances'
import { computeLedger, rangeOf } from '../lib/weekLedger'
import type { ExpenseEntry, IncomeEntry } from '../lib/types'

const effDate = (x: ExpenseEntry) => (x.channel === 'manual' ? x.date : (x.paidDate ?? x.date))
const kindManual = (x: IncomeEntry) => !x.roundId && !x.unknown && !(x.source === 'slip' || (!x.source && (x.slip || x.method === 'transfer')))
const sheetOf = (x: ExpenseEntry): ExpenseEntry => x.channel === 'manual' ? x : { ...x, date: effDate(x), biller: x.biller || (x.channel === 'advance' ? x.who : undefined), who: x.channel === 'bill' ? x.who : undefined, requester: [x.channel === 'bill' ? 'วางบิล' : 'สำรองจ่าย', x.status === 'open' ? 'รอจ่าย' : ''].filter(Boolean).join(' · ') }
const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b) })
const PER_PAGE = 4 // 2×2 ต่อหน้า: รูปบิลยาวๆ ยังเห็นเต็มใบและอ่านออก
const pg = (from: number, n: number) => (n <= 0 ? '—' : n === 1 ? `หน้า ${from}` : `หน้า ${from}–${from + n - 1}`)
const TILE_COLORS = ['#1a2b4c', '#8a6414', '#1f5fc4', '#17766b', '#6b2d82', '#8a3d12']

/** ใบปะหน้าแฟ้ม: เลขแฟ้ม/สัปดาห์/วันที่ สำหรับค้นหา + สารบัญ + ช่องเงินคริสตจักร 6 ช่อง ณ สัปดาห์นั้น (ตัวเลขชุดเดียวกับหน้าแรก) */
function Cover({ church, sunday, week, asOf, nInc, nOut, nPhoto, tiles, tot, fundTot }: { fundTot: number; church: string; sunday: string; week: number; asOf: string; nInc: number; nOut: number; nPhoto: number; tiles: [string, string][]; tot: { inn: number; out: number } }) {
  const [y] = sunday.split('-').map(Number)
  const no = `${y + 543}-W${String(week).padStart(2, '0')}`
  const net = tot.inn - tot.out
  const rows: [string, string, string][] = [['ใบรับ (ใบบันทึกการถวาย)', pg(2, nInc), `${nInc} แผ่น`], ['ใบเบิก - จ่ายเงินสด พร้อมสรุปประจำสัปดาห์', pg(2 + nInc, nOut), `${nOut} แผ่น`], ['ภาพหลักฐาน (สลิป/บิล ที่แนบ)', pg(2 + nInc + nOut, nPhoto), nPhoto ? `${nPhoto} แผ่น` : 'ไม่มีรูปแนบ']]
  return (
    <ScaledPage>
      <>
        <PaperHead church={church} title="แฟ้มรับ - จ่ายประจำสัปดาห์" sub="ใบปะหน้า · เอกสารต้นฉบับสำหรับเก็บเข้าแฟ้ม" />
        <div style={{ border: '2px solid #1a2b4c', borderRadius: 8, padding: '10px 18px', margin: '8px 0 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#444' }}>เลขที่แฟ้ม (ปี พ.ศ.-สัปดาห์ที่)</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#1a2b4c', letterSpacing: 2, lineHeight: 1.15 }}>{no}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>สัปดาห์ที่ {week} ของปี พ.ศ. {y + 543}</div>
          <div style={{ fontSize: 16, marginTop: 2 }}>{weekHeading(sunday)}</div>
        </div>
        <table className="sheetpaper sheetpaper--full" aria-label="รายละเอียดแฟ้ม" style={{ marginBottom: 10 }}>
          <tbody>
            <tr><td style={{ width: '30%', fontWeight: 700 }}>วันอาทิตย์ประจำสัปดาห์</td><td>{fmtDate(sunday)}</td></tr>
            <tr><td style={{ fontWeight: 700 }}>ข้อมูลเงินคงเหลือ ณ วันที่</td><td>{fmtDate(asOf)}</td></tr>
            <tr><td style={{ fontWeight: 700 }}>ยอดประจำสัปดาห์ (เงินหมุนเวียน)</td><td>รับ {fmtBaht(tot.inn)} · จ่าย {fmtBaht(tot.out)} · {net >= 0 ? 'รับมากกว่าจ่าย' : 'จ่ายมากกว่ารับ'} {fmtBaht(Math.abs(net))} บาท</td></tr>
            {fundTot > 0 && <tr><td style={{ fontWeight: 700 }}>เงินกองทุน (แยก ไม่รวมข้างบน)</td><td>เก็บไว้ เตรียมนำฝาก {fmtBaht(fundTot)} บาท</td></tr>}
          </tbody>
        </table>
        <div style={{ fontWeight: 800, fontSize: 16, margin: '6px 0 2px' }}>สารบัญในแฟ้ม</div>
        <table className="sheetpaper sheetpaper--full" aria-label="สารบัญแฟ้ม">
          <thead><tr><th>รายการ</th><th style={{ width: '22%' }}>หน้าที่</th><th style={{ width: '22%' }}>จำนวน</th></tr></thead>
          <tbody>
            <tr><td>ใบปะหน้า (แผ่นนี้)</td><td style={{ textAlign: 'center' }}>หน้า 1</td><td style={{ textAlign: 'center' }}>1 แผ่น</td></tr>
            {rows.map(([a, b, c]) => <tr key={a}><td>{a}</td><td style={{ textAlign: 'center' }}>{b}</td><td style={{ textAlign: 'center' }}>{c}</td></tr>)}
          </tbody>
        </table>
        <div style={{ fontWeight: 800, fontSize: 16, margin: '10px 0 4px' }}>เงินคริสตจักร ณ วันที่ {fmtDate(asOf)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }} aria-label="เงินคริสตจักร 6 ช่อง">
          {tiles.map(([label, val], i) => (
            <div key={label} style={{ background: TILE_COLORS[i], color: '#fff', borderRadius: 10, padding: '8px 10px', textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ fontSize: 15 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, margin: '10px 0 4px' }}>การรับรองแฟ้ม</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} aria-label="ลงนามรับรอง">
          {['ผู้จัดทำ / ผู้บันทึกบัญชี', 'เหรัญญิก', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ / ศิษยาภิบาล'].map((r) => (
            <div key={r} style={{ border: '1px solid #1a2b4c', padding: '8px 10px', fontSize: 13 }}><b>{r}</b><br /><br />ลงชื่อ.............................................<br />(.............................................)<br />วันที่........../........../..........</div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', fontSize: 12, color: '#555', textAlign: 'center' }}>เอกสารต้นฉบับ มีชื่อบุคคลครบ — ห้ามนำไปติดประกาศหรือแชร์สมาชิก · จัดทำ {fmtDate(todayISO())}</div>
      </>
    </ScaledPage>
  )
}

/** รูปหลักฐานหนึ่งช่อง: โหลดรูปเป็นข้อมูลในหน้า (ให้ติดไปกับ PDF) แล้วแจ้งผลกลับ */
function Photo({ path, label, onDone }: { path: string; label: string; onDone: (ok: boolean) => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let live = true
    const cfg = getSync()
    ;(async () => {
      try {
        const b = cfg ? await getBinary(cfg, path) : await cachedImage(path)
        if (!b) throw new Error('no image')
        const u = await toDataUrl(b)
        if (live) { setUrl(u); onDone(true) }
      } catch { if (live) onDone(false) }
    })()
    return () => { live = false }
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps
  return url ? <img src={url} alt={label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} /> : <span className="muted small">กำลังโหลดรูป…</span>
}

/**
 * แฟ้มประจำสัปดาห์ (สำหรับแอดมิน/เหรัญญิก เก็บเป็นหลักฐานต้นฉบับ): ใบรับ → ใบเบิก-จ่ายเงินสด → ภาพหลักฐานที่แนบ (หน้าละ 4 รูป เรียงตามลำดับในใบเบิก-จ่าย)
 * รวมเป็น PDF ไฟล์เดียว · ชื่อบุคคลครบ ไม่ซ่อน · เฉพาะรายการที่มีรูปแนบ
 */
export default function WeekFile({ year, a, sunday, church }: { year: number; a: ReturnType<typeof useBalances>['input'] & { opening: unknown; loans: unknown }; sunday: string; church: string }) {
  const types = useIncomeTypes().list
  const { settings } = useSettings()
  const box = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const asOf = sunday <= todayISO() ? sunday : todayISO()
  const { balances } = useBalances(year, asOf)
  void settings
  const week = rangeOf('week', year, { sunday })
  const incomeRows = useMemo(() => a.income.filter((x) => !x.deleted && kindManual(x) && sheetSunday(x.date) === sunday), [a.income, sunday])
  const expRows = useMemo(() => a.expenses.filter((x) => !x.deleted && !x.fundId && sheetSunday(effDate(x)) === sunday), [a.expenses, sunday])
  const L = useMemo(() => computeLedger({ range: week, ...a } as Parameters<typeof computeLedger>[0]), [a, sunday]) // eslint-disable-line react-hooks/exhaustive-deps
  const wdk = useMemo(() => computeWeekWithdraw({ expenses: a.expenses, income: a.income, rounds: a.rounds, passbook: a.passbook, types: a.types, cats: a.cats, loans: a.loans } as Parameters<typeof computeWeekWithdraw>[0], year, sunday), [a, year, sunday]) // ชุดคำนวณเดียวกับหน้า เตรียมเบิก และใบเบิก-จ่าย
  const fundRowsE: ExpenseEntry[] = wdk.fund.map((r, i) => ({ id: `fx:${i}`, channel: 'manual', date: sunday, amount: r.amount, desc: r.name, status: 'paid', updated: 1e15 + i }) as ExpenseEntry)
  const entries = [...expRows.map(sheetOf)]
  const nFundInc = incomeRows.filter((x) => types.find((t) => t.id === x.typeId)?.fund).length
  const nIncPg = Math.max(1, Math.ceil((incomeRows.length - nFundInc) / 20)) + (nFundInc > 0 ? Math.ceil(nFundInc / 20) : 0)
  const ordered = [...entries].sort((x, y) => x.date.localeCompare(y.date) || x.updated - y.updated)
  const expPhotos = ordered.map((x, i) => ({ x, no: i + 1 })).filter((p) => p.x.file?.path)
  // รูปหลักฐานของรายรับ (แนบหลายรูปต่อรายการ) ต่อท้าย: ติดป้าย "รับ"
  const incPhotos = incomeRows.flatMap((x) => (x.photos ?? []).map((ph, k) => ({ x: { id: `${x.id}#${k}`, desc: `${types.find((t) => t.id === x.typeId)?.name ?? ''}${x.note ? ` ${x.note}` : ''}`, amount: x.amount, date: x.date, file: ph } as ExpenseEntry, no: 0, inc: true as const })))
  const photos = [...expPhotos.map((p) => ({ ...p, inc: false as boolean })), ...incPhotos]
  const pages = Array.from({ length: Math.ceil(photos.length / PER_PAGE) }, (_, i) => photos.slice(i * PER_PAGE, (i + 1) * PER_PAGE))
  const fundOut = wdk.fund
  const pending = wdk.circ
  const net = (r: { from: string; to: string }) => { const l = computeLedger({ range: r, ...a } as Parameters<typeof computeLedger>[0]); return l.inSum.cash + l.inSum.transfer - l.outSum.cash - l.outSum.transfer - l.outSum.pending }
  const summary = { inn: L.inSum, funds: fundOut, pending, out: L.outSum, balance: circulatingOnly(balances, a.loans as never), asOf, net: { week: net(week), month: net(rangeOf('month', year, { month: Number(sunday.slice(5, 7)) })), year: net(rangeOf('year', year)) }, lent: ownLent(a.loans as never, asOf) }
  const ls = summarizeLoans(a.loans as never, asOf)
  const tiles: [string, string][] = [['🏠 หมุนเวียน', fmtBaht(balances.own.balance, { dec: false })], ['💰 กองทุน', fmtBaht(balances.fundTotal, { dec: false })], ['🧮 รวมเงินสด', fmtBaht(balances.total, { dec: false })], ['🔁 หนี้ภายใน', fmtBaht(ls.fromFunds, { dec: false })], ['🧾 หนี้ภายนอก', fmtBaht(ls.external, { dec: false })], ['🏞️ ภาระที่ดิน', '6,000,000']]
  const [retry, setRetry] = useState(0)
  const paths = photos.map((p) => p.x.file?.path ?? '').join('|')
  useEffect(() => { prefetchBinaries(getSync(), paths.split('|')) }, [paths])
  const settled = photos.every((p) => p.x.id in loaded)
  const missing = photos.filter((p) => loaded[p.x.id] === false)
  const pagesEls = () => [...(box.current?.querySelectorAll<HTMLElement>('.a4page') ?? [])].map((el) => ({ el, landscape: el.classList.contains('a4page--land') }))
  const file = `แฟ้มประจำสัปดาห์-${sunday}.pdf`
  const run = async (share: boolean) => {
    setBusy(true)
    try {
      const els = pagesEls()
      if (share) { if ((await sharePagesPdf(els, file, `แฟ้มรับ-จ่าย ${church}`)) === 'unsupported') { await downloadPagesPdf(els, file); alert('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ PDF ให้แทนแล้ว') } } else await downloadPagesPdf(els, file)
    } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ') }
    setBusy(false)
  }
  return (
    <div data-keep="1" aria-label="แฟ้มประจำสัปดาห์">
      <div className="card no-print" style={{ margin: '6px 0' }}>
        <b>🗂️ แฟ้มประจำสัปดาห์ (เก็บเข้าแฟ้ม)</b>
        <p className="muted small" style={{ margin: '4px 0' }}>ใบปะหน้า (เลขแฟ้ม สัปดาห์ สารบัญ และเงินคริสตจักร 6 ช่อง) → รวมใบรับ → ใบเบิก-จ่ายเงินสด → ภาพสลิป/บิลที่แนบ (เฉพาะรายการที่มีรูป หน้าละ 4 รูป) เป็น PDF ไฟล์เดียว · ข้อมูลต้นฉบับครบ มีชื่อบุคคล — ห้ามนำไปติดประกาศหรือแชร์สมาชิก · ถ้าจะพิมพ์ ให้ดาวน์โหลดแล้วพิมพ์จากไฟล์ PDF</p>
        <p className="small" style={{ margin: '2px 0' }}>ใบปะหน้า 1 แผ่น · ใบรับ {nIncPg} แผ่น · ใบเบิก-จ่าย {Math.max(1, Math.ceil(ordered.length / 25)) + (fundRowsE.length > 0 ? 1 : 0)} แผ่น · {photos.length === 0 ? 'ไม่มีรูปแนบในสัปดาห์นี้ (ไม่มีหน้ารูป)' : `รูปแนบ ${photos.length} รูป ${pages.length} แผ่น`}</p>
        {!settled && <p className="small" role="status">กำลังโหลดรูป {Object.keys(loaded).length}/{photos.length}…</p>}
        {settled && missing.length > 0 && <p className="small" role="alert" style={{ color: 'var(--danger, #c4332a)' }}>โหลดรูปไม่ได้ {missing.length} รูป (ลำดับที่ {missing.map((p) => p.no).join(', ')}) — ต้องออนไลน์จึงจะได้รูปครบ <button type="button" className="mini" onClick={() => { setLoaded((m) => Object.fromEntries(Object.entries(m).filter(([, ok]) => ok))); setRetry((n) => n + 1) }}>🔄 ลองโหลดใหม่</button></p>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--gold" disabled={busy || !settled} onClick={() => void run(false)} aria-label="ดาวน์โหลดแฟ้มประจำสัปดาห์เป็น PDF">{busy ? 'กำลังสร้าง…' : '⬇️ ดาวน์โหลด PDF แฟ้มประจำสัปดาห์'}</button>
          <button type="button" className="btn btn--gold" disabled={busy || !settled} onClick={() => void run(true)} aria-label="แชร์แฟ้มประจำสัปดาห์เป็น PDF" title={canSharePdf() ? undefined : 'เครื่องนี้จะดาวน์โหลดไฟล์ให้แทน'}>📤 แชร์ PDF</button>
        </div>
      </div>
      <div ref={box}>
        <Cover church={church} sunday={sunday} week={sundaysOf(year).indexOf(sunday) + 1} asOf={asOf} nInc={nIncPg} nOut={Math.max(1, Math.ceil(ordered.length / 25)) + (fundRowsE.length > 0 ? 1 : 0)} fundTot={fundOut.reduce((t, f) => t + f.amount, 0)} nPhoto={pages.length} tiles={tiles} tot={{ inn: L.inSum.cash + L.inSum.transfer, out: L.outSum.cash + L.outSum.transfer + L.outSum.pending }} />
        <IncomeSheetPaper church={church} entries={incomeRows} types={types} sunday={sunday} noDownload />
        <VoucherPaper church={church} fundRows={fundRowsE} entries={entries} sunday={sunday} summary={summary} noDownload />
        {pages.map((ps, pi) => (
          <ScaledPage key={pi}>
            <>
              <PaperHead church={church} title="ภาพหลักฐานประกอบใบเบิก-จ่าย" sub={`${weekHeading(sunday)} · แผ่นที่ ${pi + 1}/${pages.length}`} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10, flex: 1, minHeight: 0, marginTop: 6 }}>
                {ps.map(({ x, no, inc }) => (
                  <figure key={x.id} style={{ margin: 0, border: '1px solid #1a2b4c', display: 'flex', flexDirection: 'column', minHeight: 0, padding: 4 }}>
                    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                      <Photo key={`${x.id}-${retry}`} path={x.file!.path} label={x.desc} onDone={(ok) => setLoaded((m) => (x.id in m ? m : { ...m, [x.id]: ok }))} />
                    </div>
                    <figcaption style={{ fontSize: 12, textAlign: 'center', paddingTop: 3 }}><b>{inc ? 'รายรับ' : `ลำดับที่ ${no}`}</b> · {x.desc} · {fmtBaht(x.amount)} บาท · {fmtDate(x.date)}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          </ScaledPage>
        ))}
      </div>
    </div>
  )
}
