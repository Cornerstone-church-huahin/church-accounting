import { useMemo, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import MoneyInput from './MoneyInput'
import Sheet from './Sheet'
import DonorReport from './DonorReport'
import DonorBoard from './DonorBoard'
import { can } from '../lib/access'
import { useChurchMembers, useDonorExts, useDonorGifts, useIncome, useLoans } from '../lib/data'
import { GIFT_KINDS, checkImport, parseImportText, giftId, projectTotals, guessKind, isMonthlyGiver, kindInfo, missingMonths, missingWeeks, parseGiftLines } from '../lib/donorGifts'
import { useRole } from '../lib/members'
import { be, fmtBaht, fmtDate, monthName, todayISO, weekRange } from '../lib/money'
import type { DonorExt, DonorGift, GiftKind } from '../lib/types'

const NAVY = '#14264a'
/** เรียงใหม่ → เก่า */
const byNewest = (a: DonorGift, b: DonorGift) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`)

/** รายงานการโอนถวายรายบุคคล (เห็นเฉพาะแอดมิน): รวบรวมสลิปโอนถวายของสมาชิกทีละคน ย้อนหลัง · เก็บเป็นประวัติแยกจากบัญชีรายรับ ไม่เปลี่ยนยอดบัญชี */
export default function DonorGifts({ year, onBack }: { year: number; onBack: () => void }) {
  const role = useRole()
  const isAdmin = can(role, 'settings')
  const store = useDonorGifts()
  const members = useChurchMembers()
  const exts = useDonorExts()
  const [addExt, setAddExt] = useState(false)
  const [pasteImp, setPasteImp] = useState(false)
  const [tab, setTab] = useState<'rec' | 'mem' | 'rep'>('mem')
  const [editExt, setEditExt] = useState(false)
  const income = useIncome(year)
  const loans = useLoans()
  const [code, setCode] = useState('')
  const [codeText, setCodeText] = useState('')
  const [edit, setEdit] = useState<DonorGift | 'new' | null>(null)
  const [paste, setPaste] = useState(false)
  const [msg, setMsg] = useState('')

  const all = useMemo(() => store.items.filter((g) => !g.deleted), [store.items])
  const people = useMemo(() => {
    const m = new Map<string, { code: string; n: number; total: number }>()
    for (const g of all) { const e = m.get(g.code) ?? { code: g.code, n: 0, total: 0 }; e.n++; if (g.kind !== 'loan') e.total += g.amount; m.set(g.code, e) }
    for (const x of exts.items) if (!x.deleted && !m.has(x.code)) m.set(x.code, { code: x.code, n: 0, total: 0 })
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  }, [all, exts.items])
  const extOf = (c: string) => exts.items.find((x) => !x.deleted && x.code === c)
  const nameOf = (c: string) => memberOf(c)?.name ?? extOf(c)?.name ?? `สมาชิก ${c}`
  const newExtCode = () => { let n = 1; const used = new Set([...exts.items.map((x) => x.code), ...store.items.map((g) => g.code)]); const fmt = (i: number) => `X${String(i).padStart(3, '0')}`; while (used.has(fmt(n))) n++; return fmt(n) }
  const importFile = async (f: File) => {
    let j: unknown
    try { j = JSON.parse(await f.text()) } catch { return setMsg('อ่านไฟล์ไม่ได้ (ไม่ใช่ JSON)') }
    runImport(checkImport(j))
  }
  const runImport = (r: ReturnType<typeof checkImport>) => {
    if (!r.ok) return setMsg(r.error)
    const have = new Set(store.items.filter((g) => !g.deleted).map((g) => g.id))
    const fresh = r.data.gifts.filter((g) => !have.has(g.id))
    const takenExt = new Set(exts.items.filter((x) => !x.deleted).map((x) => x.code))
    const newExts = r.data.exts.filter((x) => !takenExt.has(x.code))
    const clash = r.data.exts.filter((x) => takenExt.has(x.code) && exts.items.find((y) => y.code === x.code)?.name !== x.name)
    const total = fresh.reduce((a, g) => a + g.amount, 0)
    const warn = clash.length ? `\n\n⚠ รหัสต่อไปนี้มีชื่ออื่นอยู่แล้วในระบบ จะใช้ชื่อเดิม: ${clash.map((x) => `${x.code}=${x.name}`).join(', ')}` : ''
    if (!fresh.length) return setMsg('ไม่มีรายการใหม่ (มีอยู่แล้วทั้งหมด)')
    if (!confirm(`นำเข้า ${fresh.length} รายการ รวม ${fmtBaht(total)} บาท (ข้ามที่ซ้ำ ${r.data.gifts.length - fresh.length}) และผู้ถวายภายนอกใหม่ ${newExts.length} ราย\nเป็นประวัติ/รายงานเท่านั้น ไม่กระทบยอดเงินจริง${warn}\n\nยืนยัน?`)) return
    const ok = store.put(fresh.map((g) => ({ ...g, updated: 0 }))) && (newExts.length === 0 || exts.put(newExts.map((x) => ({ ...x, updated: 0 }))))
    setMsg(ok ? `นำเข้าแล้ว ${fresh.length} รายการ รวม ${fmtBaht(total)} บาท` : 'นำเข้าไม่ได้ (ไม่มีสิทธิ์)')
  }
  const moveCode = (from: string) => {
    const to = prompt(`ย้ายรายการทั้งหมดของ “${nameOf(from)}” ไปเป็นรหัสสมาชิก (เช่น 1357)`)?.trim()
    if (!to || to === from) return
    if (!confirm(`ย้ายประวัติทั้งหมดจากรหัส ${from} ไปรหัส ${to} ?`)) return
    store.put(store.items.filter((g) => g.code === from && !g.deleted).map((g) => ({ ...g, code: to, updated: 0 })))
    const x = extOf(from); if (x) exts.put([{ ...x, deleted: true, updated: 0 }])
    setCode(to); setMsg(`ย้ายไปรหัส ${to} แล้ว`)
  }
  function memberOf(c: string) { return members.items.find((x) => !x.deleted && x.code === c) }

  if (!isAdmin) return <section className="card"><button type="button" className="mini" onClick={onBack}>‹ กลับ</button><p className="empty">หน้านี้สำหรับแอดมินเท่านั้น</p></section>

  const mine = all.filter((g) => g.code === code).sort(byNewest)
  const gifts = mine.filter((g) => g.kind !== 'loan')
  const lent = mine.filter((g) => g.kind === 'loan')
  const sum = (xs: DonorGift[]) => xs.reduce((s, x) => s + x.amount, 0)
  const m = code ? memberOf(code) : undefined
  const monthly = code ? isMonthlyGiver(mine) : false
  const miss = code ? (monthly ? missingMonths(mine) : missingWeeks(mine)) : []
  const refs = new Set(income.items.filter((x) => !x.deleted && x.ref).map((x) => x.ref as string))
  const inLedger = (g: DonorGift) => (g.kind === 'loan'
    ? loans.items.some((l) => !l.deleted && l.lender.kind === 'person' && l.principal === g.amount && l.date === g.date)
    : !!g.ref && refs.has(g.ref))
  const byMonth = new Map<string, number>()
  for (const g of gifts) { const ym = g.date.slice(0, 7); byMonth.set(ym, (byMonth.get(ym) ?? 0) + g.amount) }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  const save = (g: DonorGift) => { if (store.put([{ ...g, updated: 0 }])) { setEdit(null); setMsg('บันทึกแล้ว') } else setMsg('บันทึกไม่ได้ (ไม่มีสิทธิ์)') }
  const del = (g: DonorGift) => { if (confirm(`ลบรายการ ${fmtDate(g.date)} ${fmtBaht(g.amount)} บาท ?`)) { store.put([{ ...g, deleted: true, updated: 0 }]); setEdit(null) } }

  return (
    <section className="card" aria-label="รายงานการโอนถวายรายบุคคล">
      <div className="row row--between no-print"><button type="button" className="mini" onClick={code ? () => setCode('') : onBack}>‹ {code ? 'รายชื่อผู้ถวาย' : 'กลับ'}</button><span className="small muted">🔒 เห็นเฉพาะแอดมิน</span></div>
      <h2>🙏 รายงานการโอนถวายรายบุคคล</h2>
      <p className="small muted" style={{ margin: '2px 0' }}>📊 รายงานเท่านั้น ไม่กระทบยอดเงินจริง</p>
      {msg && <p className="note" role="status" onClick={() => setMsg('')}>{msg}</p>}

      {!code && (
        <div className="seg seg--3 no-print" role="tablist" aria-label="หน้ารายงานโอนถวาย" style={{ marginBottom: 8 }}>
          <button type="button" role="tab" aria-selected={tab === 'rec'} className={tab === 'rec' ? 'on' : ''} onClick={() => setTab('rec')}>✍️ บันทึก</button>
          <button type="button" role="tab" aria-selected={tab === 'mem'} className={tab === 'mem' ? 'on' : ''} onClick={() => setTab('mem')}>👥 สมาชิก</button>
          <button type="button" role="tab" aria-selected={tab === 'rep'} className={tab === 'rep' ? 'on' : ''} onClick={() => setTab('rep')}>📊 รายงาน</button>
        </div>
      )}
      {!code && tab === 'mem' && <DonorBoard gifts={all} members={members.items} nameOf={nameOf} onOpen={(c) => setCode(c)} />}
      {!code && tab === 'rep' && <DonorReport gifts={all} nameOf={nameOf} />}

      {!code && tab === 'rec' && (
        <>
          <p className="small muted">เก็บเป็นประวัติการถวายของสมาชิกแต่ละคน (อ่านจากสลิป) แยกจากบัญชีรายรับ ไม่เปลี่ยนยอดบัญชีของคริสตจักร · ใส่รหัสสมาชิกเพื่อเริ่ม</p>
          <div className="row" style={{ gap: 6 }}>
            <input className="input" inputMode="numeric" aria-label="รหัสสมาชิก" placeholder="รหัสสมาชิก เช่น 1357" value={codeText} onChange={(e) => setCodeText(e.target.value.trim())} />
            <button type="button" className="btn btn--gold" disabled={!codeText} onClick={() => { setCode(codeText); setCodeText('') }}>เปิด</button>
          </div>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => setAddExt(true)}>＋ ผู้ถวายภายนอก (ไม่มีรหัส · บุคคล/กลุ่ม)</button>
          <label className="btn" style={{ marginTop: 8, display: 'inline-flex' }}>📥 นำเข้าไฟล์ประวัติการถวาย (.json)
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f) }} />
          </label>
          <button type="button" className="btn" style={{ marginTop: 6 }} onClick={() => setPasteImp(true)}>📋 วางข้อมูลนำเข้า (คัดลอกจากแชต)</button>
          <p className="small muted">นำเข้าเป็นประวัติ/รายงานเท่านั้น ไม่เปลี่ยนยอดเงินหมุนเวียน กองทุน หรือเงินยืม · รายการที่มีอยู่แล้วจะถูกข้าม</p>
          <h3 style={{ marginTop: 12 }}>ผู้ถวายที่มีประวัติแล้ว ({people.length})</h3>
          {people.length === 0 && <p className="empty">ยังไม่มีข้อมูล — ใส่รหัสสมาชิกแล้วเพิ่มรายการหรือวางข้อมูลได้เลย</p>}
          {people.map((p) => {
            const mm = memberOf(p.code)
            return (
              <button key={p.code} type="button" className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', margin: '6px 0' }} onClick={() => setCode(p.code)}>
                <MemberAvatar path={mm?.photoPath} name={nameOf(p.code)} size={44} />
                <span style={{ flex: 1 }}><b>{nameOf(p.code)}</b>{extOf(p.code) && <small className="muted"> · ผู้ถวายภายนอก{extOf(p.code)?.group ? ' (กลุ่ม)' : ''}</small>}<br /><small className="muted">รหัส {p.code} · {p.n} รายการ</small></span>
                <b className="num">{fmtBaht(p.total)}</b>
              </button>
            )
          })}
        </>
      )}

      {code && (
        <>
          <div className="row" style={{ gap: 10, alignItems: 'center', margin: '6px 0' }}>
            <MemberAvatar path={m?.photoPath} name={nameOf(code)} size={52} />
            <div><b style={{ fontSize: '1.1rem' }}>{nameOf(code)}</b>{m?.nick ? ` (${m.nick})` : ''}<br /><small className="muted">รหัส {code}{m ? '' : extOf(code) ? ` · ผู้ถวายภายนอก${extOf(code)?.group ? ' (กลุ่ม)' : ''}` : ' · ไม่พบในทะเบียน'}</small>{!m && <><br /><button type="button" className="mini no-print" onClick={() => setEditExt(true)}>✎ แก้ชื่อ/รหัส</button> <button type="button" className="mini no-print" onClick={() => moveCode(code)}>🔁 ย้ายเป็นรหัสสมาชิก…</button></>}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
            {[['🙏 ยอดถวายรวม', fmtBaht(sum(gifts)), '#e3f4ea'], ['🔢 จำนวนครั้ง', String(gifts.length), '#e6eefc'], ['🤝 ให้ยืม', fmtBaht(sum(lent)), '#efe6f9']].map(([l, v, c]) => (
              <div key={l} style={{ flex: '1 1 30%', minWidth: 96, background: c, color: NAVY, borderRadius: 12, padding: '6px 8px', textAlign: 'center' }}><small>{l}</small><div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{v}</div></div>
            ))}
          </div>
          <div className="row no-print" style={{ gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
            <button type="button" className="btn btn--gold" onClick={() => setEdit('new')}>＋ เพิ่มรายการ</button>
            <button type="button" className="btn" onClick={() => setPaste(true)}>📋 วางข้อมูลหลายรายการ</button>
          </div>

          <h3>🙏 การถวาย ({gifts.length})</h3>
          {gifts.length === 0 && <p className="empty">ยังไม่มีรายการ</p>}
          {gifts.map((g) => <GiftRow key={g.id} g={g} ok={inLedger(g)} onClick={() => setEdit(g)} />)}

          <h3 style={{ marginTop: 12, color: '#7a3fb0' }}>🤝 ให้คริสตจักรยืม ({lent.length}) · {fmtBaht(sum(lent))}</h3>
          {lent.length === 0 && <p className="empty">ไม่มีรายการให้ยืม</p>}
          {lent.map((g) => <GiftRow key={g.id} g={g} ok={inLedger(g)} onClick={() => setEdit(g)} />)}
          {lent.length > 0 && <p className="small muted">“ยังไม่อยู่ในหนี้ภายนอก” = ยังไม่ได้บันทึกเป็นเงินยืมในหน้าหนี้สิน (รายงานนี้เป็นประวัติเท่านั้น)</p>}

          {projectTotals(mine).length > 0 && (
            <>
              <h3 style={{ marginTop: 12, color: '#8a6a00' }}>🏗 ยอดถวายแยกตามโครงการ</h3>
              {projectTotals(mine).map((p) => <div key={p.project} className="row row--between small" style={{ padding: '3px 0', borderBottom: '1px solid #e3e7ef' }}><span>{p.project} · {p.n} ครั้ง</span><b className="num">{fmtBaht(p.total)}</b></div>)}
            </>
          )}

          {months.length > 0 && (
            <>
              <h3 style={{ marginTop: 12 }}>📅 ยอดถวายรายเดือน</h3>
              {months.map(([ym, v]) => <div key={ym} className="row row--between small" style={{ padding: '3px 0', borderBottom: '1px solid #e3e7ef' }}><span>{monthName(Number(ym.slice(5)))} {be(Number(ym.slice(0, 4)))}</span><b className="num">{fmtBaht(v)}</b></div>)}
            </>
          )}

          {miss.length > 0 && (
            <>
              <h3 style={{ marginTop: 12, color: '#c4332a' }}>⚠ {monthly ? 'เดือน' : 'สัปดาห์'}ที่ไม่พบสลิปถวายประจำ (ประจำสัปดาห์/สิบลด) ({miss.length})</h3>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{[...miss].reverse().map((d) => <span key={d} className="small" style={{ background: '#fdecea', color: '#a1281f', borderRadius: 999, padding: '2px 10px' }}>{monthly ? `${monthName(Number(d.slice(5)))} ${be(Number(d.slice(0, 4)))}` : weekRange(d)}</span>)}</div>
              <p className="small muted">อาจถวายเงินสดหรือยังไม่ได้ส่งสลิปมา</p>
            </>
          )}
        </>
      )}

      {pasteImp && <ImportPaste onClose={() => setPasteImp(false)} onRun={(r) => { setPasteImp(false); runImport(r) }} />}
      {addExt && <ExtForm code={newExtCode()} taken={new Set([...exts.items.filter((x) => !x.deleted).map((x) => x.code), ...store.items.filter((g) => !g.deleted).map((g) => g.code)])} onClose={() => setAddExt(false)} onSave={(x) => { exts.put([x]); setAddExt(false); setCode(x.code) }} />}
      {editExt && code && <ExtForm edit code={code} name={extOf(code)?.name ?? (code.startsWith('X') && !/^X\d+$/.test(code) ? code : '')} group={!!extOf(code)?.group} taken={new Set([...exts.items.filter((x) => !x.deleted).map((x) => x.code), ...store.items.filter((g) => !g.deleted).map((g) => g.code)])} onClose={() => setEditExt(false)} onSave={(x) => {
        if (x.code !== code) { store.put(store.items.filter((g) => g.code === code && !g.deleted).map((g) => ({ ...g, code: x.code, updated: 0 }))); const o = extOf(code); if (o) exts.put([{ ...o, deleted: true, updated: 0 }]) }
        exts.put([{ ...x, id: `dx:${x.code}` }]); setEditExt(false); setCode(x.code); setMsg('แก้ไขแล้ว')
      }} />}
      {edit && <GiftForm g={edit === 'new' ? null : edit} code={code} onClose={() => setEdit(null)} onSave={save} onDelete={del} />}
      {paste && <PasteSheet code={code} existing={store.items} onClose={() => setPaste(false)} onSave={(rows) => { const ok = store.put(rows); setPaste(false); setMsg(ok ? `เพิ่ม ${rows.length} รายการแล้ว` : 'บันทึกไม่ได้ (ไม่มีสิทธิ์)') }} />}
    </section>
  )
}

function GiftRow({ g, ok, onClick }: { g: DonorGift; ok: boolean; onClick: () => void }) {
  const k = kindInfo(g.kind)
  return (
    <button type="button" onClick={onClick} style={{ display: 'flex', width: '100%', textAlign: 'left', gap: 8, alignItems: 'center', background: k.soft, borderLeft: `6px solid ${k.color}`, borderRadius: 10, padding: '6px 10px', margin: '4px 0', border: 0, borderLeftStyle: 'solid', borderLeftWidth: 6, borderLeftColor: k.color }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{fmtDate(g.date)}{g.time ? ` · ${g.time}` : ''}</b> <span className="small" style={{ background: k.color, color: '#fff', borderRadius: 999, padding: '1px 8px' }}>{g.kind === 'project' && g.project ? g.project : k.short}</span>{g.src === 'xlsx' && <span className="small muted"> · จากไฟล์เดิม</span>}
        <br /><small className="muted">{g.ref ? `เลขที่ ${g.ref}` : g.src === 'xlsx' ? 'บันทึกเดิม (ไม่มีเลขที่รายการ)' : 'ไม่มีเลขที่รายการ'}{g.note ? ` · ${g.note}` : ''}</small>
        {g.src !== 'xlsx' && <><br /><small style={{ color: ok ? '#1b6b3a' : '#8a6a00' }}>{ok ? (g.kind === 'loan' ? '✓ อยู่ในหนี้ภายนอกแล้ว' : '✓ อยู่ในบัญชีรายรับแล้ว') : (g.kind === 'loan' ? 'ยังไม่อยู่ในหนี้ภายนอก' : 'ยังไม่พบในบัญชีรายรับ')}</small></>}
      </span>
      <b className="num" style={{ fontSize: '1.05rem' }}>{fmtBaht(g.amount)}</b>
    </button>
  )
}

function GiftForm({ g, code, onClose, onSave, onDelete }: { g: DonorGift | null; code: string; onClose: () => void; onSave: (g: DonorGift) => void; onDelete: (g: DonorGift) => void }) {
  const [date, setDate] = useState(g?.date ?? todayISO())
  const [time, setTime] = useState(g?.time ?? '')
  const [amount, setAmount] = useState<number | null>(g?.amount ?? null)
  const [kind, setKind] = useState<GiftKind>(g?.kind ?? 'weekly')
  const [ref, setRef] = useState(g?.ref ?? '')
  const [note, setNote] = useState(g?.note ?? '')
  const [project, setProject] = useState(g?.project ?? '')
  const [err, setErr] = useState('')
  const go = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('ใส่วันที่')
    if (!amount || amount <= 0) return setErr('ใส่จำนวนเงิน')
    const base = { code, date, ...(time ? { time } : {}), amount, kind, ...(ref.trim() ? { ref: ref.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(kind === 'project' && project.trim() ? { project: project.trim() } : {}), ...(g?.src ? { src: g.src } : {}) }
    onSave({ ...base, id: g?.id ?? giftId(code, base), updated: 0 })
  }
  return (
    <Sheet title={g ? 'แก้รายการถวาย' : 'เพิ่มรายการถวาย'} onClose={onClose}>
      <div className="field"><label htmlFor="dg-date">วันที่ (ตามสลิป)</label><input id="dg-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label htmlFor="dg-time">เวลา</label><input id="dg-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      <div className="field"><label htmlFor="dg-amt">จำนวนเงิน (บาท)</label><MoneyInput id="dg-amt" value={amount} onChange={(v) => { setAmount(v); if (!g && v) setKind(guessKind(v)) }} /></div>
      <div className="field"><label htmlFor="dg-kind">ประเภท</label>
        <select id="dg-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as GiftKind)}>{GIFT_KINDS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select></div>
      {kind === 'project' && <div className="field"><label htmlFor="dg-proj">ชื่อโครงการ/งานพิเศษ</label><input id="dg-proj" className="input" list="dg-projs" value={project} onChange={(e) => setProject(e.target.value)} placeholder="เช่น งานขอบคุณพระเจ้า · คริสต์มาส · ค่าแอร์" /><datalist id="dg-projs">{['งานขอบคุณพระเจ้า', 'คริสต์มาส', 'ค่าแอร์', 'ตกแต่งสถานที่', 'ค่าอาหาร'].map((x) => <option key={x} value={x} />)}</datalist></div>}
      <div className="field"><label htmlFor="dg-ref">เลขที่รายการในสลิป</label><input id="dg-ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
      <div className="field"><label htmlFor="dg-note">หมายเหตุ</label><input id="dg-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {err && <p className="note" role="alert">{err}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn--gold" onClick={go}>บันทึก</button>
        {g && <button type="button" className="btn btn--ghost" onClick={() => onDelete(g)}>🗑 ลบ</button>}
      </div>
    </Sheet>
  )
}

const EXAMPLE = `2030-01-06 10:05 300 weekly 0123456789AB
2030-01-13 09:30 5000 thanks 0123456789CD
2030-01-20 11:00 50000 building`

function PasteSheet({ code, existing, onClose, onSave }: { code: string; existing: DonorGift[]; onClose: () => void; onSave: (rows: DonorGift[]) => void }) {
  const [text, setText] = useState('')
  const { rows, errors } = useMemo(() => parseGiftLines(text, code), [text, code])
  const live = existing.filter((g) => !g.deleted)
  const known = new Set(live.map((g) => g.id))
  const knownRef = new Set(live.filter((g) => g.ref).map((g) => g.ref as string))
  const fresh = rows.map((r) => ({ ...r, id: giftId(code, r), updated: 0 }) as DonorGift).filter((r) => !known.has(r.id) && !(r.ref && knownRef.has(r.ref)))
  return (
    <Sheet title="วางข้อมูลหลายรายการ" onClose={onClose}>
      <p className="small muted">หนึ่งบรรทัดต่อหนึ่งรายการ: วันที่(ปี ค.ศ.) เวลา จำนวน ประเภท [เลขที่รายการ] [หมายเหตุ] · ประเภท = weekly / tithe / thanks / building / welfare / loan / other</p>
      <textarea className="input" rows={8} aria-label="ข้อมูลที่วาง" placeholder={EXAMPLE} value={text} onChange={(e) => setText(e.target.value)} />
      {text.trim() && <p className="small">อ่านได้ {rows.length} รายการ · ใหม่ {fresh.length}{rows.length - fresh.length > 0 ? ` · ซ้ำกับที่มีอยู่ ${rows.length - fresh.length} (ข้าม)` : ''}{errors.length ? ` · ผิดรูปแบบ ${errors.length}` : ''}</p>}
      {errors.map((e) => <p key={e} className="note small" role="alert">{e}</p>)}
      <button type="button" className="btn btn--gold" disabled={!fresh.length} onClick={() => onSave(fresh)}>เพิ่ม {fresh.length} รายการ</button>
    </Sheet>
  )
}

function ExtForm({ code: code0, name: name0 = '', group: group0 = false, edit, taken, onClose, onSave }: { code: string; name?: string; group?: boolean; /** true = แก้ของเดิม */ edit?: boolean; taken: Set<string>; onClose: () => void; onSave: (x: DonorExt) => void }) {
  const [code, setCode] = useState(code0)
  const [name, setName] = useState(name0)
  const [group, setGroup] = useState(group0)
  return (
    <Sheet title={edit ? 'แก้ชื่อ/รหัสผู้ถวายภายนอก' : 'เพิ่มผู้ถวายภายนอก'} onClose={onClose}>
      <p className="small muted">สำหรับคนหรือกลุ่มที่ยังไม่มีรหัสสมาชิก ระบบให้รหัสภายในเรียงตามลำดับ X001, X002, … (แก้เองได้ด้านล่าง) ไปก่อน ภายหลังกด “ย้ายเป็นรหัสสมาชิก” ได้ ประวัติย้ายตามทั้งหมด</p>
      <div className="field"><label htmlFor="ex-code">รหัสภายใน</label><input id="ex-code" className="input" value={code} onChange={(e) => setCode(e.target.value.trim().toUpperCase())} />{code !== code0 && taken.has(code) && <small className="note">รหัสนี้ถูกใช้แล้ว</small>}</div>
      <div className="field"><label htmlFor="ex-name">ชื่อ (ตามสลิปหรือชื่อกลุ่ม)</label><input id="ex-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น นาง ลภัสดา ว. หรือ กลุ่มอนุชน" /></div>
      <label className="small"><input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} /> เป็นกลุ่ม/โครงการ (ไม่ใช่บุคคล)</label>
      <div style={{ marginTop: 8 }}><button type="button" className="btn btn--gold" disabled={!name.trim() || !/^X\d+$/.test(code) || (code !== code0 && taken.has(code))} onClick={() => onSave({ id: `dx:${code}`, updated: 0, code, name: name.trim(), ...(group ? { group: true } : {}) })}>{edit ? 'บันทึก' : 'เพิ่ม'}</button></div>
    </Sheet>
  )
}

function ImportPaste({ onClose, onRun }: { onClose: () => void; onRun: (r: ReturnType<typeof checkImport>) => void }) {
  const [text, setText] = useState('')
  const r = useMemo(() => (text.trim() ? parseImportText(text) : null), [text])
  return (
    <Sheet title="วางข้อมูลนำเข้า" onClose={onClose}>
      <p className="small muted">วางข้อความที่คัดลอกจากแชตได้ทีละชุด (วางต่อกันหลายครั้งได้ ระบบข้ามรายการที่ซ้ำ)</p>
      <textarea className="input" rows={8} aria-label="ข้อมูลนำเข้า" value={text} onChange={(e) => setText(e.target.value)} />
      {r && (r.ok ? <p className="small">อ่านได้ {r.data.gifts.length} รายการ รวม {fmtBaht(r.data.gifts.reduce((a, g) => a + g.amount, 0))} บาท · ผู้ถวายภายนอก {r.data.exts.length}</p> : <p className="note" role="alert">{r.error}</p>)}
      <button type="button" className="btn btn--gold" disabled={!r || !r.ok} onClick={() => r && onRun(r)}>ตรวจและนำเข้า…</button>
    </Sheet>
  )
}
