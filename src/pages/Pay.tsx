import { useMemo, useRef, useState } from 'react'
import MoneyInput from '../components/MoneyInput'
import LedgerTable from '../components/LedgerTable'
import ScaledPage from '../components/ScaledPage'
import Sheet from '../components/Sheet'
import StoredImage, { LocalImage } from '../components/StoredImage'
import { can } from '../lib/access'
import { useBudgetEntries, useBudgetLines, useExpenseCats, useExpenses, useFunds, useIncomeTypes, useIncome, useRounds, useSettings, useVouchers } from '../lib/data'
import { getGemini, readBill } from '../lib/gemini'
import { compressImage } from '../lib/image'
import { readSlip } from '../lib/slipOcr'
import { useRole } from '../lib/members'
import { addDays, fmtBaht, fmtDate, fmtDateLong, newId, sheetSunday, sundaysOf, todayISO, yearOf } from '../lib/money'
import { downloadPdf } from '../lib/pdf'
import { deleteFile, getSync, listDir, putBinary } from '../lib/sync'
import type { ExpenseEntry } from '../lib/types'
import { computeLedger } from '../lib/weekLedger'

type Channel = ExpenseEntry['channel']
type Sub = Channel | 'total' | null
/** ค่าที่ระบบอ่านจากรูปมาใส่ในฟอร์มล่วงหน้า (ผู้ใช้ตรวจแล้วกดบันทึก) */
interface ExpInit { file: File; date?: string; amount?: number; desc?: string; who?: string; catId?: string; method?: 'cash' | 'transfer'; ref?: string; due?: string; note?: string }

const CH: Record<Channel, { n: number; title: string; dateLabel: string; whoLabel: string; add: string; hint: string; openLabel: string; doneLabel: string }> = {
  manual: { n: 1, title: 'บันทึกด้วยมือ', dateLabel: 'วันที่จ่าย', whoLabel: 'ผู้รับเงิน/ร้านค้า', add: '＋ บันทึก', hint: 'รายจ่ายที่จ่ายไปแล้ว บันทึกได้ทุกวัน ระบุวันที่ หมวดรายจ่าย และจ่ายด้วยเงินสดหรือโอน', openLabel: '', doneLabel: '' },
  bill: { n: 2, title: 'วางบิล', dateLabel: 'วันที่ในบิล', whoLabel: 'ผู้ออกบิล/ร้านค้า', add: '＋ วางบิล', hint: 'บิลที่ได้รับแต่ยังไม่จ่าย (เช่น ค่าไฟ ค่าน้ำ) แนบรูปบิลได้ — กด “จ่ายแล้ว” เมื่อจ่าย (ยอดนับเป็นรายจ่ายทันที ช่อง “ค้างจ่าย” จนกว่าจะจ่าย)', openLabel: 'ค้างจ่าย', doneLabel: '✓ จ่ายแล้ว' },
  advance: { n: 3, title: 'สำรองจ่าย', dateLabel: 'วันที่สำรองจ่าย', whoLabel: 'ผู้สำรองจ่าย', add: '＋ สำรองจ่าย', hint: 'ผู้รับใช้ออกเงินส่วนตัวไปก่อน แนบใบเสร็จได้ — กด “คืนเงินแล้ว” เมื่อคริสตจักรคืนเงิน (ยอดนับเป็นรายจ่ายทันที ช่อง “ค้างจ่าย” จนกว่าจะคืน)', openLabel: 'รอคืนเงิน', doneLabel: '✓ คืนเงินแล้ว' },
}
const effDate = (x: ExpenseEntry) => (x.channel === 'manual' ? x.date : (x.paidDate ?? x.date))
const byDateDesc = (a: ExpenseEntry, b: ExpenseEntry) => (effDate(a) < effDate(b) ? 1 : effDate(a) > effDate(b) ? -1 : b.updated - a.updated)

/** โหมด "จ่าย": 1 บันทึกด้วยมือ · 2 วางบิล · 3 สำรองจ่าย · 4 รวมจ่าย (หักลบกับรายรับในแท็บสรุป) */
export default function Pay({ year }: { year: number }) {
  const role = useRole()
  const exp = useExpenses(year)
  const cats = useExpenseCats()
  const vouchers = useVouchers(year)
  const lines = useBudgetLines(year)
  const funds = useFunds()
  const entries = useBudgetEntries(year)
  const income = useIncome(year)
  const rounds = useRounds(year)
  const types = useIncomeTypes()
  const { settings } = useSettings()
  const canWrite = can(role, 'voucherPay')
  const [sub, setSub] = useState<Sub>(null)
  const [form, setForm] = useState<{ entry: ExpenseEntry | null; channel: Channel } | null>(null)
  const [flow, setFlow] = useState<Channel | null>(null)
  const [payFor, setPayFor] = useState<ExpenseEntry | null>(null)
  const [scope, setScope] = useState<'week' | 'year'>('year')
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => { const s = sheetSunday(todayISO()); return sundays.includes(s) ? s : (sundays.filter((d) => d <= todayISO()).pop() ?? sundays[0]) })
  const idx = sundays.indexOf(sunday)
  const paperRef = useRef<HTMLDivElement>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const all = useMemo(() => [...exp.items].sort(byDateDesc), [exp.items])
  const of = (c: Channel) => all.filter((x) => x.channel === c)
  const catName = (id?: string) => { const c = id ? cats.byId(id) : undefined; return c ? `${c.code} ${c.name}` : 'ยังไม่ระบุหมวด' }
  const L = useMemo(() => computeLedger({ year, sunday, scope, income: income.items, rounds: rounds.items, vouchers: vouchers.items, lines: lines.items, funds: funds.items, entries: entries.items, types: types.list, cats: cats.list, expenses: exp.items }),
    [year, sunday, scope, income.items, rounds.items, vouchers.items, lines.items, funds.items, entries.items, types.list, cats.list, exp.items])
  const pending = (c: Channel) => of(c).filter((x) => x.status === 'open')
  const sum = (xs: ExpenseEntry[]) => xs.reduce((s, x) => s + x.amount, 0)

  /** ลบรูปที่แนบออกจาก repo ข้อมูลด้วย (ถ้าทำไม่ได้ ไม่เป็นไร — รายการถูกลบแล้ว) */
  const dropFile = async (path?: string) => {
    const cfg = getSync()
    if (!path || !cfg) return
    try {
      const f = (await listDir(cfg, path.slice(0, path.lastIndexOf('/')))).find((x) => x.path === path)
      if (f) await deleteFile(cfg, f.path, f.sha, 'บิล/ใบเสร็จที่ลบ')
    } catch { /* ignore */ }
  }
  const del = (x: ExpenseEntry) => { if (confirm(`ลบรายการ ${x.desc || catName(x.catId)} ${fmtBaht(x.amount)} ?`) && exp.remove(x.id)) void dropFile(x.file?.path) }

  const card = (x: ExpenseEntry) => (
    <li key={x.id} style={{ display: 'block', padding: '0.4rem 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span className="grow">
          <b>{x.desc || catName(x.catId)}</b><br />
          <span className="small muted">{CH[x.channel].dateLabel} {fmtDate(x.date)}{x.who ? ` · ${x.who}` : ''} · {catName(x.catId)}{x.file ? ' · 📎' : ''}</span><br />
          {x.channel === 'manual'
            ? <span className="small muted">จ่ายด้วย{x.method === 'transfer' ? 'โอน' : 'เงินสด'}</span>
            : x.status === 'open'
              ? <span className="badge badge--gold">{CH[x.channel].openLabel}{x.due ? ` · ครบกำหนด ${fmtDate(x.due)}` : ''}</span>
              : <span className="badge">{x.channel === 'bill' ? 'จ่ายแล้ว' : 'คืนเงินแล้ว'} {x.paidDate ? fmtDate(x.paidDate) : ''} · {x.method === 'transfer' ? 'โอน' : 'เงินสด'}</span>}
        </span>
        <b className="num">{fmtBaht(x.amount)}</b>
      </div>
      {canWrite && (
        <span className="row" style={{ gap: 8, marginTop: 6 }}>
          {x.channel !== 'manual' && x.status === 'open' && <button type="button" className="mini" onClick={() => setPayFor(x)}>{CH[x.channel].doneLabel}</button>}
          <button type="button" className="mini" onClick={() => setForm({ entry: x, channel: x.channel })}>✎ แก้ไข</button>
          <button type="button" className="mini" onClick={() => del(x)}>🗑️ ลบ</button>
        </span>
      )}
    </li>
  )

  const panel = (c: Channel) => {
    const xs = of(c)
    const open = pending(c)
    return (
      <section className="card no-print" role="tabpanel" aria-label={CH[c].title}>
        <div className="row row--between"><h2>{CH[c].n} · {CH[c].title}</h2>{canWrite && <button type="button" className="btn btn--gold" onClick={() => (c === 'manual' ? setForm({ entry: null, channel: c }) : setFlow(c))}>{CH[c].add}</button>}</div>
        <p className="muted small">{CH[c].hint}</p>
        <div className="row row--between" style={{ margin: '0.4rem 0' }}>
          <b>{xs.length} รายการ · รวม {fmtBaht(sum(xs))}</b>
          {c !== 'manual' && open.length > 0 && <span className="badge badge--gold">{CH[c].openLabel} {open.length} · {fmtBaht(sum(open))}</span>}
        </div>
        {xs.length === 0 ? <p className="muted small">ยังไม่มีรายการ</p> : <ul className="list">{xs.map(card)}</ul>}
      </section>
    )
  }
  const tab = (k: Exclude<Sub, null>, n: number, label: string, badge?: number) => (
    <button type="button" role="tab" aria-selected={sub === k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{n}<span>{label}{badge ? ` (${badge})` : ''}</span></button>
  )

  return (
    <>
      <div className="subtabs subtabs--out no-print" role="tablist" aria-label="ช่องบันทึกรายจ่าย">
        {tab('manual', 1, 'บันทึกด้วยมือ', of('manual').length)}
        {tab('bill', 2, 'วางบิล', of('bill').length)}
        {tab('advance', 3, 'สำรองจ่าย', of('advance').length)}
        {tab('total', 4, 'รวมจ่าย')}
      </div>

      {sub === 'manual' && panel('manual')}
      {sub === 'bill' && panel('bill')}
      {sub === 'advance' && panel('advance')}

      {sub === 'total' && (
        <section className="card" role="tabpanel" aria-label="รวมจ่าย">
          <div className="no-print" style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <button type="button" className="mini" aria-label="สัปดาห์ก่อน" disabled={scope === 'year' || idx <= 0} onClick={() => setSunday(sundays[idx - 1])}>‹</button>
              <b style={{ textAlign: 'center' }}>{scope === 'year' ? `ทั้งปี ${year + 543}` : fmtDateLong(sunday)}</b>
              <button type="button" className="mini" aria-label="สัปดาห์ถัดไป" disabled={scope === 'year' || idx >= sundays.length - 1} onClick={() => setSunday(sundays[idx + 1])}>›</button>
            </div>
            <div className="seg" role="group" aria-label="ช่วงของใบสรุป">
              <button type="button" className={scope === 'week' ? 'on' : ''} onClick={() => setScope('week')}>สัปดาห์ที่เลือก</button>
              <button type="button" className={scope === 'year' ? 'on' : ''} onClick={() => setScope('year')}>ทั้งปี {year + 543}</button>
            </div>
            <div className="grid2">
              <button type="button" className="btn btn--gold" disabled={pdfBusy} onClick={async () => {
                if (!paperRef.current) return
                setPdfBusy(true)
                try { await downloadPdf(paperRef.current, `expense-${scope === 'year' ? year + 543 : sunday}.pdf`, { fullPage: true }) } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ PDF ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF แทน') }
                setPdfBusy(false)
              }}>{pdfBusy ? 'กำลังสร้าง PDF…' : '⬇️ ดาวน์โหลด PDF'}</button>
              <button type="button" className="btn btn--ghost" onClick={() => window.print()}>🖨️ พิมพ์</button>
            </div>
            {(pending('bill').length > 0 || pending('advance').length > 0) && (
              <p className="note">นับเป็นรายจ่ายแล้ว (ช่อง “ค้างจ่าย”) แต่เงินยังไม่ออก — ต้องเตรียมเบิก {fmtBaht(sum(pending('bill')) + sum(pending('advance')))}: วางบิลค้างจ่าย {pending('bill').length} รายการ ({fmtBaht(sum(pending('bill')))}) · สำรองจ่ายรอคืนเงิน {pending('advance').length} รายการ ({fmtBaht(sum(pending('advance')))}) — เมื่อกด “จ่ายแล้ว/คืนเงินแล้ว” จะย้ายเข้าเงินสด/โอน</p>
            )}
          </div>
          <ScaledPage ref={paperRef} className="a4page a4page--doc">
            <>
          <header className="paper__head">
            <p className="muted small">{settings.churchName}</p>
            <h2 id="h-pay">รวมจ่ายประจำสัปดาห์</h2>
            <p>{scope === 'year' ? `ประจำปี ${year + 543} (รวมทุกสัปดาห์)` : `ประจำวันอาทิตย์ที่ ${fmtDateLong(sunday).replace('วันอาทิตย์ที่ ', '')}`}</p>
            {scope === 'week' && <p className="muted small">จ่ายระหว่างวันที่ {fmtDate(addDays(sunday, -6))} – {fmtDate(sunday)}</p>}
          </header>
          <LedgerTable labels={['หมวดรายจ่าย', 'รายการ', 'จำนวนโอน']} rows={L.outRows} total="รวมทั้งสิ้น" tone="out" minRows={0} pendingCol />
          <div className="sign" style={{ display: 'grid' }}>
            <div>ผู้จัดทำรายงาน (ผู้บันทึกบัญชี)<br /><span className="small">วันที่ ........../........../..........</span></div>
            <div>ผู้ตรวจสอบ<br /><span className="small">วันที่ ........../........../..........</span></div>
            <div>ผู้รับรอง (ผู้ปกครอง/ประธาน)<br /><span className="small">วันที่ ........../........../..........</span></div>
          </div>
            </>
          </ScaledPage>
          <p className="muted small no-print" style={{ textAlign: 'center' }}>แตะที่หน้ากระดาษเพื่อขยาย (แตะอีกครั้งเพื่อย่อ) หรือหมุนจอเป็นแนวนอน · พิมพ์/ดาวน์โหลดได้ขนาด A4 เต็มหน้า</p>
        </section>
      )}

      {flow && <ExpenseFlow year={year} channel={flow} exp={exp} onClose={() => setFlow(null)} />}
      {form && <ExpenseForm year={year} entry={form.entry} channel={form.channel} exp={exp} onClose={() => setForm(null)} />}
      {payFor && <MarkPaid entry={payFor} exp={exp} onClose={() => setPayFor(null)} />}
    </>
  )
}

/** ฟอร์มรายจ่าย: ใช้ร่วมกัน 3 ช่องทาง (ต่างกันที่ป้ายชื่อ/ช่องวันครบกำหนด/สถานะ/รูปแนบ) */
function ExpenseForm({ year, entry, channel, exp, onClose, init }: { year: number; entry: ExpenseEntry | null; channel: Channel; exp: ReturnType<typeof useExpenses>; onClose: () => void; init?: ExpInit }) {
  const cats = useExpenseCats()
  const c = CH[channel]
  const today = yearOf(todayISO()) === year ? todayISO() : `${year}-01-01`
  const [date, setDate] = useState(entry?.date ?? init?.date ?? today)
  const [who, setWho] = useState(entry?.who ?? init?.who ?? '')
  const [catId, setCatId] = useState(entry?.catId ?? init?.catId ?? '')
  const [desc, setDesc] = useState(entry?.desc ?? init?.desc ?? '')
  const [amount, setAmount] = useState<number | null>(entry?.amount ?? init?.amount ?? null)
  const [method, setMethod] = useState<'cash' | 'transfer'>(entry?.method ?? init?.method ?? 'cash')
  const [due, setDue] = useState(entry?.due ?? init?.due ?? '')
  const [status, setStatus] = useState<'open' | 'paid'>(channel === 'manual' ? 'paid' : (entry?.status ?? 'open'))
  const [paidDate, setPaidDate] = useState(entry?.paidDate ?? today)
  const [note, setNote] = useState(entry?.note ?? init?.note ?? '')
  const [ref, setRef] = useState(entry?.ref ?? init?.ref ?? '')
  const [file, setFile] = useState<File | null>(init?.file ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (yearOf(date) !== year) return setErr(`วันที่ต้องอยู่ในปี ${year + 543} (เปลี่ยนปีบัญชีที่มุมขวาบนก่อน)`)
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงินมากกว่า 0')
    const name = desc.trim() || (catId ? cats.byId(catId)?.name ?? '' : '')
    if (!name) return setErr('เลือกหมวดรายจ่ายหรือพิมพ์ชื่อรายการ')
    if (status === 'paid' && yearOf(paidDate) !== year && channel !== 'manual') return setErr(`วันที่จ่ายต้องอยู่ในปี ${year + 543}`)
    let f = entry?.file
    if (file) {
      const cfg = getSync()
      if (cfg) {
        setBusy(true)
        try {
          const { data, ext } = await compressImage(file)
          const path = `attachments/${year}/exp-${Date.now().toString(36)}.${ext}`
          await putBinary(cfg, path, data, 'บิล/ใบเสร็จ')
          f = { path, name: file.name }
        } catch (e) { setBusy(false); return setErr(e instanceof Error ? e.message : 'แนบรูปไม่สำเร็จ') }
        setBusy(false)
      } else f = { path: '', name: file.name }
    }
    const rec: ExpenseEntry = {
      id: entry?.id ?? newId('ex'), channel, date, amount, desc: name, status, method,
      ...(catId ? { catId } : {}), ...(who.trim() ? { who: who.trim() } : {}), ...(due && channel === 'bill' ? { due } : {}),
      ...(status === 'paid' ? { paidDate: channel === 'manual' ? date : paidDate } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(ref.trim() ? { ref: ref.trim() } : {}), ...(f ? { file: f } : {}), updated: 0,
    }
    if (exp.put([rec])) onClose()
  }
  return (
    <Sheet title={init ? `ตรวจและยืนยัน${c.title}` : `${entry ? 'แก้ไข' : ''}${c.title}`} onClose={onClose}>
      {init && <LocalImage file={init.file} alt="รูปที่แนบ" />}
      <div className="field"><label htmlFor="e-date">{c.dateLabel}</label><input id="e-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="e-cat">หมวดรายจ่าย (เลือกจากรายการ)</label>
        <select id="e-cat" className="input" value={catId} onChange={(e) => { setCatId(e.target.value); const x = cats.byId(e.target.value); if (x && !desc.trim()) setDesc(x.name) }}>
          <option value="">— ยังไม่ระบุหมวด —</option>
          {cats.groups.filter((g) => g.active).map((g) => <optgroup key={g.id} label={`${g.code}. ${g.name}`}><option value={g.id}>{g.code}. {g.name} (ทั้งหมวด)</option>{cats.itemsOf(g.id).filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.code} {x.name}</option>)}</optgroup>)}
        </select>
      </div>
      <div className="field"><label htmlFor="e-desc">รายการ</label><input id="e-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="เช่น ค่าไฟฟ้า ก.ย. 69" /></div>
      <div className="field"><label htmlFor="e-amt">จำนวนเงิน (บาท)</label><MoneyInput id="e-amt" value={amount} onChange={setAmount} /></div>
      {channel === 'manual' ? (
        <div className="seg" role="group" aria-label="จ่ายด้วย">
          <button type="button" className={method === 'cash' ? 'on' : ''} onClick={() => setMethod('cash')}>เงินสด</button>
          <button type="button" className={method === 'transfer' ? 'on' : ''} onClick={() => setMethod('transfer')}>โอนเงิน</button>
        </div>
      ) : (
        <>
          {channel === 'bill' && <div className="field"><label htmlFor="e-due">วันครบกำหนดจ่าย (ไม่บังคับ)</label><input id="e-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>}
          <div className="field"><label htmlFor="e-status">สถานะ</label>
            <select id="e-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'paid')}>
              <option value="open">{c.openLabel} (นับเป็นรายจ่ายค้างจ่าย)</option>
              <option value="paid">{channel === 'bill' ? 'จ่ายแล้ว' : 'คืนเงินแล้ว'}</option>
            </select>
          </div>
          {status === 'paid' && (
            <>
              <div className="field"><label htmlFor="e-paid">วันที่{channel === 'bill' ? 'จ่าย' : 'คืนเงิน'}</label><input id="e-paid" className="input" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></div>
              <div className="seg" role="group" aria-label="จ่ายด้วย">
                <button type="button" className={method === 'cash' ? 'on' : ''} onClick={() => setMethod('cash')}>เงินสด</button>
                <button type="button" className={method === 'transfer' ? 'on' : ''} onClick={() => setMethod('transfer')}>โอนเงิน</button>
              </div>
            </>
          )}
        </>
      )}
      <div className="field"><label htmlFor="e-who">{c.whoLabel}</label><input id="e-who" className="input" value={who} onChange={(e) => setWho(e.target.value)} /></div>
      {channel !== 'manual' && !init && <div className="field"><label htmlFor="e-file">รูป{channel === 'bill' ? 'บิล' : 'ใบเสร็จ'} {entry?.file ? '(มีแล้ว — เลือกใหม่เพื่อแทนที่)' : '(ไม่บังคับ)'}</label><input id="e-file" className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>}
      {entry?.file && !file && <StoredImage path={entry.file.path} alt="รูปที่แนบไว้" />}
      <div className="field"><label htmlFor="e-ref">เลขที่บิล/เลขอ้างอิง (ไม่บังคับ)</label><input id="e-ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
      <div className="field"><label htmlFor="e-note">หมายเหตุ (ไม่บังคับ)</label><input id="e-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button type="button" className="btn btn--gold grow" disabled={busy} onClick={save}>{busy ? 'กำลังอัปโหลด…' : 'บันทึก'}</button></div>
    </Sheet>
  )
}

/** กด "จ่ายแล้ว/คืนเงินแล้ว": ใส่วันที่และวิธีจ่าย แล้วยอดเข้ารวมจ่าย */
function MarkPaid({ entry, exp, onClose }: { entry: ExpenseEntry; exp: ReturnType<typeof useExpenses>; onClose: () => void }) {
  const [paidDate, setPaidDate] = useState(todayISO())
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash')
  const [ref, setRef] = useState('')
  return (
    <Sheet title={entry.channel === 'bill' ? 'บันทึกการจ่ายบิล' : 'บันทึกการคืนเงินสำรองจ่าย'} onClose={onClose}>
      <p><b>{entry.desc}</b> · {fmtBaht(entry.amount)}</p>
      <div className="field"><label htmlFor="mp-date">วันที่{entry.channel === 'bill' ? 'จ่าย' : 'คืนเงิน'}</label><input id="mp-date" className="input" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></div>
      <div className="seg" role="group" aria-label="จ่ายด้วย">
        <button type="button" className={method === 'cash' ? 'on' : ''} onClick={() => setMethod('cash')}>เงินสด</button>
        <button type="button" className={method === 'transfer' ? 'on' : ''} onClick={() => setMethod('transfer')}>โอนเงิน</button>
      </div>
      {method === 'transfer' && <div className="field"><label htmlFor="mp-ref">เลขอ้างอิงการโอน (ไม่บังคับ)</label><input id="mp-ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></div>}
      <button type="button" className="btn btn--gold" onClick={() => { if (exp.put([{ ...entry, status: 'paid', paidDate, method, ...(ref.trim() ? { ref: ref.trim() } : {}), updated: 0 }])) onClose() }}>ยืนยัน</button>
    </Sheet>
  )
}

/** วางบิล / สำรองจ่าย: เลือกรูป → ระบบอ่าน (Gemini ถ้ามีรหัส · ไม่มีใช้อ่านสลิปในเครื่อง) → ใส่ในฟอร์มให้ตรวจและยืนยัน */
function ExpenseFlow({ year, channel, exp, onClose }: { year: number; channel: Channel; exp: ReturnType<typeof useExpenses>; onClose: () => void }) {
  const cats = useExpenseCats()
  const c = CH[channel]
  const [stage, setStage] = useState<'pick' | 'read' | 'form'>('pick')
  const [init, setInit] = useState<ExpInit | null>(null)
  const [msg, setMsg] = useState('')
  const hasKey = !!getGemini().key
  const choose = async (file: File) => {
    setStage('read'); setMsg('')
    const out: ExpInit = { file }
    try {
      if (hasKey) {
        const r = await readBill(file, cats.list.filter((x) => x.kind === 'item' && x.active).map((x) => ({ code: x.code, name: x.name })))
        const cat = r.category ? cats.list.find((x) => x.kind === 'item' && x.code === r.category) : undefined
        Object.assign(out, {
          date: r.date, amount: r.total, desc: r.summary ?? cat?.name, catId: cat?.id, method: r.method, ref: r.ref, due: r.due,
          ...(channel === 'bill' ? { who: r.vendor } : r.vendor ? { note: `ร้าน/ผู้รับเงิน: ${r.vendor}` } : {}),
        })
        const miss = [!r.date && 'วันที่', !r.total && 'ยอดเงิน'].filter(Boolean)
        if (miss.length) setMsg(`อ่าน${miss.join('และ')}ไม่ได้ — กรุณากรอกเอง`)
      } else {
        const r = await readSlip(file)
        Object.assign(out, { date: r.date, amount: r.amount, ref: r.ref, method: 'transfer', desc: r.memo })
        setMsg('ยังไม่ได้ใส่รหัส Gemini — อ่านได้เฉพาะสลิปโอน (วันที่ ยอด เลขอ้างอิง) ถ้าเป็นบิลร้านค้าให้ใส่รหัสที่ ตั้งค่า › ตัวอ่านใบถวาย (Gemini) หรือกรอกเอง')
      }
    } catch (e) { setMsg(e instanceof Error ? e.message : 'อ่านรูปไม่สำเร็จ — กรอกเอง') }
    setInit(out); setStage('form')
  }
  if (stage === 'form') return (
    <>
      {msg && <p className="role-toast" role="alert" style={{ position: 'fixed', top: 8, left: 8, right: 8, zIndex: 100 }}>{msg}</p>}
      <ExpenseForm year={year} entry={null} channel={channel} exp={exp} onClose={onClose} init={init ?? undefined} />
    </>
  )
  return (
    <Sheet title={c.title} onClose={onClose}>
      {stage === 'pick' ? (
        <>
          <p className="muted small">{channel === 'bill' ? 'เลือกรูปบิลหรือใบแจ้งหนี้ (บิลซื้อของ ค่าไฟ ค่าน้ำ ฯลฯ)' : 'เลือกรูปใบเสร็จหรือสลิปโอนที่ผู้สำรองจ่ายจ่ายไปก่อน'} ระบบจะอ่านวันที่ ยอดเงิน ร้านค้า และเสนอหมวดรายจ่ายให้ ท่านตรวจแล้วกดยืนยัน{hasKey ? '' : ' (ยังไม่ได้ใส่รหัส Gemini: อ่านได้เฉพาะสลิปโอน)'}</p>
          <label className="btn btn--gold" style={{ display: 'block', textAlign: 'center' }}>
            📷 เลือกรูป{channel === 'bill' ? 'บิล' : 'ใบเสร็จ/สลิป'}
            <input type="file" accept="image/*" aria-label={`เลือกรูป${channel === 'bill' ? 'บิล' : 'ใบเสร็จหรือสลิป'}`} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void choose(f) }} />
          </label>
          <button type="button" className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => { setInit(null); setStage('form') }}>กรอกเอง (ไม่มีรูป)</button>
        </>
      ) : (
        <div role="status" aria-live="polite"><p><b>กำลังอ่าน{channel === 'bill' ? 'บิล' : 'ใบเสร็จ'}…</b></p><progress style={{ width: '100%' }} /><p className="muted small">ใช้เวลาประมาณ 5–15 วินาที</p></div>
      )}
    </Sheet>
  )
}
