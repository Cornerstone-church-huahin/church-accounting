import { useEffect, useMemo, useRef, useState } from 'react'
import { IncomeSheetPaper, PaperHead, VoucherPaper, weekHeading } from './PaperSheets'
import ScaledPage from './ScaledPage'
import { circulatingOnly } from '../lib/balances'
import { getBinary, getSync } from '../lib/sync'
import { cachedImage } from '../lib/imageCache'
import { useIncomeTypes, useSettings } from '../lib/data'
import { fmtBaht, fmtDate, sheetSunday, todayISO } from '../lib/money'
import { canSharePdf, downloadPagesPdf, sharePagesPdf } from '../lib/pdf'
import { useBalances } from '../lib/useBalances'
import { computeLedger, rangeOf } from '../lib/weekLedger'
import type { ExpenseEntry, IncomeEntry } from '../lib/types'

const effDate = (x: ExpenseEntry) => (x.channel === 'manual' ? x.date : (x.paidDate ?? x.date))
const kindManual = (x: IncomeEntry) => !x.roundId && !x.unknown && !(x.source === 'slip' || (!x.source && (x.slip || x.method === 'transfer')))
const sheetOf = (x: ExpenseEntry): ExpenseEntry => x.channel === 'manual' ? x : { ...x, date: effDate(x), biller: x.biller || (x.channel === 'advance' ? x.who : undefined), who: x.channel === 'bill' ? x.who : undefined, requester: [x.channel === 'bill' ? 'วางบิล' : 'สำรองจ่าย', x.status === 'open' ? 'รอจ่าย' : ''].filter(Boolean).join(' · ') }
const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b) })
const PER_PAGE = 6

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
  return url ? <img src={url} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span className="muted small">กำลังโหลดรูป…</span>
}

/**
 * แฟ้มประจำสัปดาห์ (สำหรับแอดมิน/เหรัญญิก เก็บเป็นหลักฐานต้นฉบับ): ใบรับ → ใบเบิก-จ่ายเงินสด → ภาพหลักฐานที่แนบ (หน้าละ 6 รูป เรียงตามลำดับในใบเบิก-จ่าย)
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
  const wf = useMemo(() => computeLedger({ range: week, income: a.income, rounds: a.rounds, vouchers: [], lines: [], funds: [], entries: [], types: a.types, cats: a.cats, expenses: [], passbook: a.passbook, withFunds: true }).fundRows, [a, sunday]) // eslint-disable-line react-hooks/exhaustive-deps
  const fundRowsE: ExpenseEntry[] = wf.map((r, i) => ({ id: `fx:${i}`, channel: 'manual', date: sunday, amount: r.cash.amt + r.transfer.amt, desc: r.label, status: 'paid', requester: 'กองทุน · รอเบิก', updated: 1e15 + i }) as ExpenseEntry)
  const entries = [...expRows.map(sheetOf), ...fundRowsE]
  const ordered = [...entries].sort((x, y) => x.date.localeCompare(y.date) || x.updated - y.updated)
  const photos = ordered.map((x, i) => ({ x, no: i + 1 })).filter((p) => p.x.file?.path)
  const pages = Array.from({ length: Math.ceil(photos.length / PER_PAGE) }, (_, i) => photos.slice(i * PER_PAGE, (i + 1) * PER_PAGE))
  const fundOut = wf.map((r) => ({ name: r.label, amount: r.cash.amt + r.transfer.amt }))
  const pending = expRows.filter((x) => x.status === 'open' || (x.channel === 'manual' && x.biller)).map((x) => ({ desc: x.desc, person: x.biller || x.who || '', kind: x.channel, amount: x.amount }))
  const net = (r: { from: string; to: string }) => { const l = computeLedger({ range: r, ...a } as Parameters<typeof computeLedger>[0]); return l.inSum.cash + l.inSum.transfer - l.outSum.cash - l.outSum.transfer - l.outSum.pending }
  const summary = { inn: L.inSum, funds: fundOut, pending, out: L.outSum, balance: circulatingOnly(balances, a.loans as never), asOf, net: { week: net(week), month: net(rangeOf('month', year, { month: Number(sunday.slice(5, 7)) })), year: net(rangeOf('year', year)) } }
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
        <p className="muted small" style={{ margin: '4px 0' }}>รวมใบรับ → ใบเบิก-จ่ายเงินสด → ภาพสลิป/บิลที่แนบ (เฉพาะรายการที่มีรูป หน้าละ 6 รูป) เป็น PDF ไฟล์เดียว · ข้อมูลต้นฉบับครบ มีชื่อบุคคล — ห้ามนำไปติดประกาศหรือแชร์สมาชิก · ถ้าจะพิมพ์ ให้ดาวน์โหลดแล้วพิมพ์จากไฟล์ PDF</p>
        <p className="small" style={{ margin: '2px 0' }}>ใบรับ {Math.max(1, Math.ceil(incomeRows.length / 20))} แผ่น · ใบเบิก-จ่าย {Math.max(1, Math.ceil(ordered.length / 25))} แผ่น · {photos.length === 0 ? 'ไม่มีรูปแนบในสัปดาห์นี้ (ไม่มีหน้ารูป)' : `รูปแนบ ${photos.length} รูป ${pages.length} แผ่น`}</p>
        {!settled && <p className="small" role="status">กำลังโหลดรูป {Object.keys(loaded).length}/{photos.length}…</p>}
        {settled && missing.length > 0 && <p className="small" role="alert" style={{ color: 'var(--danger, #c4332a)' }}>โหลดรูปไม่ได้ {missing.length} รูป (ลำดับที่ {missing.map((p) => p.no).join(', ')}) — ต้องออนไลน์จึงจะได้รูปครบ</p>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--gold" disabled={busy || !settled} onClick={() => void run(false)} aria-label="ดาวน์โหลดแฟ้มประจำสัปดาห์เป็น PDF">{busy ? 'กำลังสร้าง…' : '⬇️ ดาวน์โหลด PDF แฟ้มประจำสัปดาห์'}</button>
          <button type="button" className="btn btn--gold" disabled={busy || !settled} onClick={() => void run(true)} aria-label="แชร์แฟ้มประจำสัปดาห์เป็น PDF" title={canSharePdf() ? undefined : 'เครื่องนี้จะดาวน์โหลดไฟล์ให้แทน'}>📤 แชร์ PDF</button>
        </div>
      </div>
      <div ref={box}>
        <IncomeSheetPaper church={church} entries={incomeRows} types={types} sunday={sunday} noDownload />
        <VoucherPaper church={church} entries={entries} sunday={sunday} summary={summary} noDownload />
        {pages.map((ps, pi) => (
          <ScaledPage key={pi}>
            <>
              <PaperHead church={church} title="ภาพหลักฐานประกอบใบเบิก-จ่าย" sub={`${weekHeading(sunday)} · แผ่นที่ ${pi + 1}/${pages.length}`} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(3, 1fr)', gap: 10, flex: 1, minHeight: 0, marginTop: 6 }}>
                {ps.map(({ x, no }) => (
                  <figure key={x.id} style={{ margin: 0, border: '1px solid #1a2b4c', display: 'flex', flexDirection: 'column', minHeight: 0, padding: 4 }}>
                    <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                      <Photo path={x.file!.path} label={x.desc} onDone={(ok) => setLoaded((m) => (x.id in m ? m : { ...m, [x.id]: ok }))} />
                    </div>
                    <figcaption style={{ fontSize: 12, textAlign: 'center', paddingTop: 3 }}><b>ลำดับที่ {no}</b> · {x.desc} · {fmtBaht(x.amount)} บาท · {fmtDate(x.date)}</figcaption>
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
