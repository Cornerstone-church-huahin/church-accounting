import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fmtBaht, fmtDate, sheetSunday, sundaysOf, todayISO } from '../lib/money'
import WeekBar from '../components/WeekBar'
import { useYear } from '../lib/year'
import DebtBanner from '../components/DebtBanner'
import { isLoanMove, type FundScope } from '../lib/fundScope'
import { useFundAccounts } from './FundAccounts'
import { FundSheetPaper } from '../components/PaperSheets'
import { fundSheets } from '../lib/fundSheet'
import { useSettings } from '../lib/data'
import { can, myFunds } from '../lib/access'
import { useRole } from '../lib/members'
import type { CatalogOps } from '../components/CatalogManager'
import { activeSubs, addSub, removeSub, subAccount, subSummary } from '../lib/fundSubs'
import { actAccount, actSubIds, addActivity, autoActivities, lockedSubIds, sortedActs } from '../lib/fundActs'
import { ActEvaluation, ActHeader, ActivityCards, ActProgress, AddActivity } from '../components/FundActivities'
import ActReportPages, { type ActReportKind } from '../components/ActReport'
import Pay from './Pay'
import Receive from './Receive'

/**
 * หน้ากองทุนเดียว: มีแค่ 2 ฟังก์ชัน รับ · จ่าย — ใช้หน้าตา/ใบ A4/แนบบิลชุดเดียวกับ รับ-จ่ายหน้าแรกทุกประการ
 * แต่ข้อมูลเป็นของกองทุนนี้ล้วน (ไม่ปนบัญชีหมุนเวียน) · ยอดคงเหลือกองทุนไปรวมที่ช่อง “กองทุน” หน้าแรก · ลบกองทุน = หน้านี้หาย · สร้างกองทุนใหม่ = หน้านี้ขึ้นเอง
 */
export default function FundDetailPage() {
  const { id } = useParams()
  const { year } = useYear()
  const { rows, opening, loans, types } = useFundAccounts()
  const sundays = useMemo(() => sundaysOf(year), [year])
  const [sunday, setSunday] = useState(() => {
    const d = sheetSunday(todayISO())
    return sundays.includes(d) ? d : (sundays.filter((x) => x <= todayISO()).pop() ?? sundays[0])
  })
  const { settings } = useSettings()
  const role = useRole()
  const [pick, setPick] = useState<string | null>(null)
  const [newSub, setNewSub] = useState('')
  const [sheetPick, setSheetPick] = useState<string | null>(null) // ใบกองทุน: หมวดที่เลือกดู (null = ยังไม่เลือก)
  const [subErr, setSubErr] = useState('')
  const [actId, setActId] = useState<string | null>(null) // โหมดกิจกรรม: กิจกรรมที่เปิดอยู่ (null = หน้าการ์ดกิจกรรม)
  const [report, setReport] = useState<ActReportKind | null>(null)
  const repRef = useRef<HTMLDivElement[]>([])
  const [actTab, setActTab] = useState<'acct' | 'prog' | 'eval'>('acct')
  const f = rows.find((r) => r.id === id)
  // "กองทุนกิจกรรม": เปิดโหมดกิจกรรมให้เองครั้งแรกที่แอดมินเข้า (หมวดที่ชื่อเป็นกิจกรรมกลายเป็นการ์ดกิจกรรม) — ไม่มีหน้าถามเพิ่ม
  useEffect(() => {
    const ft = types.list.find((x) => x.id === id)
    if (!f || !ft || ft.actMode || !can(role, 'settings') || !/กิจกรรม/.test(ft.name)) return
    const first = (sid: string) => f.moves.filter((m) => m.subId === sid).map((m) => m.date).sort()[0]
    types.put([{ ...ft, ...autoActivities(ft, first, new Date().toISOString().slice(0, 10)) }])
  }, [id, f, types.list, role]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return <><div className="page-head"><h1>💰 กองทุน</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div><p className="empty">ไม่พบกองทุนนี้ (อาจถูกลบหรือเปลี่ยนชื่อ)</p></>
  const t = types.list.find((x) => x.id === f.id)
  const keeper = role === 'fundkeeper'
  // ผู้ดูแลกองทุน: จำกัดเฉพาะหมวดที่ได้รับมอบหมาย (ถ้าแอดมินกำหนดหมวดไว้)
  const keeperOnly = keeper ? myFunds()?.find((a) => a.id === f.id)?.subs?.length ? myFunds()!.find((a) => a.id === f.id)!.subs! : null : null
  // โหมดกิจกรรม: กองทุนแบ่งเป็นกิจกรรม (การ์ดกิจกรรมก่อน) แต่ละกิจกรรมมีหมวดของตัวเอง
  const actMode = !!t?.actMode
  const acts = sortedActs(t)
  const act = actMode && actId ? acts.find((a) => a.id === actId) ?? null : null
  const actIds = act ? actSubIds(t, act.id) : null
  const only = actIds ? (keeperOnly ? actIds.filter((i) => keeperOnly.includes(i)) : actIds) : keeperOnly
  const subs = activeSubs(t).filter((q) => !only || only.includes(q.id))
  const sum = subSummary(f, t)
  // มีหมวด: เริ่มที่หมวดแรก (พร้อมบันทึกได้ทันที) · ไม่มีหมวด: ทำงานเหมือนเดิมทุกประการ
  const canManage = can(role, 'settings')
  // ตัวเลือก/ตารางหมวดในหน้านี้เห็นเฉพาะแอดมิน · คนอื่นเลือกหมวดในฟอร์มบันทึก (เห็นรายการทุกหมวด)
  const sub = only && subs.length ? (pick !== null && subs.some((q) => q.id === pick) ? pick : subs[0].id) : subs.length && canManage ? (pick !== null && (pick === 'all' || pick === '' || subs.some((q) => q.id === pick)) ? pick : subs[0].id) : 'all'
  const acct = subAccount(f, sub)
  const subName = sub === 'all' ? '' : sub === '' ? 'ส่วนกลาง' : subs.find((q) => q.id === sub)?.name ?? ''
  const saveSubs = (next: ReturnType<typeof removeSub>) => { if (t) types.put([{ ...t, subs: next }]) }
  const subOps: CatalogOps | undefined = canManage && t ? {
    add: (name, scope) => { const r = addSub(t, name, scope ?? act?.id); if ('error' in r) return r; const id = r.subs[r.subs.length - 1].id; saveSubs(r.subs); return { id } },
    rename: (id, cur) => { const n = prompt('แก้ชื่อหมวด', cur)?.trim(); if (n && n !== cur) saveSubs((t.subs ?? []).map((q) => (q.id === id ? { ...q, name: n } : q))) },
    remove: (id, nm) => { const has = f.moves.some((m) => m.subId === id); if (confirm(has ? `หมวด “${nm}” มีรายการแล้ว จะเก็บถาวร (ซ่อนจากตัวเลือก แต่รายงานยังเห็น) — ต้องการหรือไม่?` : `ลบหมวด “${nm}” ?`)) { saveSubs(removeSub(t, id, has)); if (pick === id) setPick(null) } },
  } : undefined
  // โหมดกิจกรรม: ฟอร์มบันทึกเลือกได้ว่า กิจกรรมไหน → หมวดอะไรของกิจกรรมนั้น (กิจกรรมที่ปิดแล้วไม่แสดง)
  const lockedIds = lockedSubIds(t)
  const pickSubs = actMode ? activeSubs(t).filter((q) => !lockedIds.includes(q.id) && (!keeperOnly || keeperOnly.includes(q.id))) : undefined
  const formActs = actMode ? acts.filter((a) => !a.closed && (!keeperOnly || (pickSubs ?? []).some((q) => q.actId === a.id))) : []
  const fund: FundScope = {
    id: f.id, name: f.name, balance: acct.balance,
    loanMoves: sub === 'all' || sub === '' ? f.moves.filter(isLoanMove) : [],
    ...(actMode && formActs.length ? { acts: formActs, pickSubs } : {}),
    ...(subs.length || subOps ? { subs, subOps, lockedSubs: lockedSubIds(t), subsOnly: !!only, sub, subLabel: subName, subBal: { '': sum.central.balance, ...Object.fromEntries(sum.rows.map((r) => [r.id, r.acc.balance])) } } : {}),
  }
  const add = () => { if (!t) return; const r = addSub(t, newSub, act?.id); if ('error' in r) return setSubErr(r.error); saveSubs(r.subs); setNewSub(''); setSubErr('') }
  const rename = (id: string, cur: string) => { const n = prompt('แก้ชื่อหมวด', cur)?.trim(); if (n && n !== cur && t) saveSubs((t.subs ?? []).map((q) => (q.id === id ? { ...q, name: n } : q))) }
  const del = (id: string, nm: string) => { if (!t) return; const has = f.moves.some((m) => m.subId === id); if (confirm(has ? `หมวด “${nm}” มีรายการแล้ว จะเก็บถาวร (ซ่อนจากตัวเลือก แต่รายงานยังเห็น) — ต้องการหรือไม่?` : `ลบหมวด “${nm}” ?`)) { saveSubs(removeSub(t, id, has)); if (pick === id) setPick(null) } }
  const saveActs = (next: NonNullable<typeof t>['activities']) => { if (t) types.put([{ ...t, activities: next }]) }
  const patchAct = (id: string, patch: Partial<NonNullable<typeof act>>) => saveActs((t?.activities ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const visibleActs = acts.filter((a) => !keeperOnly || actSubIds(t, a.id).some((i) => keeperOnly.includes(i)))
  if (actMode && !act) {
    return (
      <>
        <div className="page-head no-print"><h1>💰 {f.name}</h1>{!keeper && <Link to="/funds" className="mini">‹ ทุกกองทุน</Link>}</div>
        {!keeper && (
          <section className="card no-print" role="status" aria-label={`ยอดคงเหลือ กองทุน ${f.name}`}>
            <p className="muted small" style={{ margin: 0 }}>เงินคงเหลือของกองทุนนี้ (รวมทุกกิจกรรม)</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: '2px 0', color: f.balance < 0 ? '#b3261e' : undefined }}>{fmtBaht(f.balance)} บาท{f.balance < 0 ? ' (ติดลบ)' : ''}</p>
          </section>
        )}
        {canManage && <AddActivity onAdd={(name, date, end) => { if (!t) return 'ไม่พบกองทุน'; const r = addActivity(t, name, date, end); if ('error' in r) return r.error; saveActs(r.activities); return null }} />}
        <ActivityCards acts={visibleActs} stat={(a) => actAccount(f, actSubIds(t, a.id).filter((i) => !keeperOnly || keeperOnly.includes(i)))} onOpen={(id) => { setActId(id); setPick(null); setSheetPick(null); setActTab('acct') }} />
      </>
    )
  }
  if (act && report) {
    const ids = only ?? actIds ?? []
    const nameOf = (id?: string) => (t?.subs ?? []).find((q) => q.id === id)?.name ?? 'ส่วนกลาง'
    const items = f.moves.filter((m) => m.subId && ids.includes(m.subId)).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)).map((m) => ({ date: m.date, cat: nameOf(m.subId), label: m.label, amount: m.amount }))
    const total = actAccount(f, ids)
    const acctData = { cats: sum.rows.filter((q) => ids.includes(q.id)).map((q) => ({ name: q.name, moneyIn: q.acc.moneyIn, moneyOut: q.acc.moneyOut, balance: q.acc.balance })), items, total: { moneyIn: total.moneyIn, moneyOut: total.moneyOut, balance: total.balance } }
    const file = `กิจกรรม-${act.name}-${report}.pdf`
    const church = settings.churchName.split(' ')[0]
    return (
      <>
        <div className="row no-print" style={{ margin: '8px 0', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost" onClick={() => setReport(null)}>‹ กลับ</button>
          <span className="grow" />
        </div>
        <ActReportPages kind={report} church={church} fundName={f.name} act={act} acct={acctData} pagesRef={repRef} file={file} title={`${act.name} ${church}`} />
        <p className="muted small no-print" style={{ textAlign: 'center' }}>แตะที่หน้ากระดาษเพื่อขยาย (แตะอีกครั้งเพื่อย่อ) · พิมพ์/PDF ขนาด A4 มีเครดิตผู้พัฒนาท้ายทุกแผ่น</p>
      </>
    )
  }
  return (
    <>
      {act && <div className="no-print" style={{ margin: '6px 0' }}><button type="button" className="btn btn--ghost" onClick={() => { setActId(null); setPick(null); setSheetPick(null) }}>‹ ทุกกิจกรรม</button></div>}
      {act && <ActHeader act={act} onReport={() => setReport('all')} onTeam={canManage ? (team) => patchAct(act.id, { team: team.length ? team : undefined }) : undefined} onEdit={canManage ? (patch) => {
        if (!patch.name) return 'พิมพ์ชื่อกิจกรรม'
        if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) return 'เลือกวันที่เริ่มกิจกรรม'
        if (patch.endDate && patch.endDate < patch.date) return 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มกิจกรรม'
        patchAct(act.id, patch); return null
      } : undefined} onDelete={canManage ? () => {
        if (!t) return
        const ids = actSubIds(t, act.id)
        if (f.moves.some((m) => m.subId && ids.includes(m.subId))) { alert('กิจกรรมนี้มีรายการรับ-จ่ายแล้ว ลบไม่ได้ — ใช้ “ปิดกิจกรรม” แทน (ข้อมูลบัญชียังอยู่ครบ)'); return }
        if (!confirm(`ลบกิจกรรม “${act.name}” ?`)) return
        types.put([{ ...t, activities: (t.activities ?? []).filter((a) => a.id !== act.id), subs: (t.subs ?? []).filter((q) => q.actId !== act.id) }])
        setActId(null)
      } : undefined} />}
      {act && (
        <div className="home-tabs home-tabs--mini no-print" role="tablist" aria-label="หมวดงานของกิจกรรม" style={{ margin: '6px 0', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <button type="button" role="tab" aria-selected={actTab === 'acct'} className={`home-tab home-tab--in${actTab === 'acct' ? ' on' : ''}`} onClick={() => setActTab('acct')}><i className="hn">1</i><span>📒 ระบบบัญชี</span></button>
          <button type="button" role="tab" aria-selected={actTab === 'prog'} className={`home-tab home-tab--sum${actTab === 'prog' ? ' on' : ''}`} onClick={() => setActTab('prog')}><i className="hn">2</i><span>🎯 ความคืบหน้า</span></button>
          <button type="button" role="tab" aria-selected={actTab === 'eval'} className={`home-tab home-tab--out${actTab === 'eval' ? ' on' : ''}`} onClick={() => setActTab('eval')}><i className="hn">3</i><span>⭐ ประเมินผล</span></button>
        </div>
      )}
      {act && actTab === 'prog' && <ActProgress act={act} canManage={canManage} locked={!!act.closed}
        onSave={(patch) => { if (!patch.name) return 'พิมพ์ชื่อกิจกรรม'; if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.date ?? '')) return 'เลือกวันที่เริ่มกิจกรรม'; if (patch.endDate && patch.endDate < (patch.date ?? '')) return 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มกิจกรรม'; patchAct(act.id, patch); return null }}
        onReport={() => setReport('prog')} onGoals={(goals) => patchAct(act.id, { goals })} />}
      {act && actTab === 'eval' && <ActEvaluation act={act} canManage={canManage} onReport={() => setReport('eval')}
        onSaveEval={(ev) => patchAct(act.id, { eval: ev })}
        onClose={() => patchAct(act.id, { closed: { date: new Date().toISOString().slice(0, 10) } })}
        onReopen={() => patchAct(act.id, { closed: undefined })} />}
      {(!act || actTab === 'acct') && (<>
      {act && <div className="no-print" style={{ margin: '4px 0' }}><button type="button" className="btn btn--ghost" onClick={() => setReport('acct')}>🧾 รายงานบัญชีกิจกรรม (พิมพ์ / PDF / แชร์)</button></div>}
      {act?.closed && <p className="role-bar no-print" role="status">🔒 กิจกรรมนี้ปิดแล้ว — ดูได้อย่างเดียว (แอดมินเปิดกิจกรรมอีกครั้งได้เพื่อบันทึกเพิ่ม)</p>}
      <div className="page-head no-print"><h1>💰 {f.name}</h1>{!keeper && <Link to="/funds" className="mini">‹ ทุกกองทุน</Link>}</div>
      {only ? (
        <section className="card no-print fundbal" role="status" aria-label={act ? `ยอดคงเหลือ กิจกรรม ${act.name}` : `ยอดคงเหลือ หมวดที่ดูแลของ ${f.name}`}>
          <div className="fundbal__row"><span className="muted small">{act ? `เงินคงเหลือของกิจกรรมนี้ (${subs.map((q) => q.name).join(', ') || 'ยังไม่มีหมวด'})` : `เงินคงเหลือของหมวดที่ท่านดูแล (${subs.map((q) => q.name).join(', ')})`}</span><b className="fundbal__amt" style={{ color: acct.balance < 0 ? '#b3261e' : undefined }}>{fmtBaht(subs.reduce((n, q) => n + subAccount(f, q.id).balance, 0))} บาท</b></div>
        </section>
      ) : (
      <section className="card no-print fundbal" role="status" aria-label={`ยอดคงเหลือ กองทุน ${f.name}`}>
        <div className="fundbal__row"><span className="muted small">เงินคงเหลือของกองทุนนี้</span><b className="fundbal__amt" style={{ color: f.balance < 0 ? '#b3261e' : undefined }}>{fmtBaht(f.balance)} บาท{f.balance < 0 ? ' (ติดลบ)' : ''}</b></div>
        <p className="muted small" style={{ margin: 0 }}>ตั้งต้น {fmtBaht(f.opening)}{opening ? ` (${fmtDate(opening.date)})` : ''} + เข้า {fmtBaht(f.moneyIn)} − ออก {fmtBaht(f.moneyOut)} = <b>{fmtBaht(f.balance)}</b></p>
      </section>
      )}
      {canManage && (
        <section className="card no-print fundcats" aria-label="หมวดของกองทุน">
          <b>หมวดของกองทุนนี้</b>
          {subs.length > 0 && (
            <div className="rtabs" role="tablist" aria-label="หมวดที่กำลังดู/บันทึก">
              {subs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={sub === q.id} className={`rtab${sub === q.id ? ' on' : ''}`} onClick={() => setPick(q.id)}>{q.name}</button>)}
              {!only && <button type="button" role="tab" aria-selected={sub === ''} className={`rtab${sub === '' ? ' on' : ''}`} onClick={() => setPick('')}>ส่วนกลาง</button>}
              {!only && <button type="button" role="tab" aria-selected={sub === 'all'} className={`rtab${sub === 'all' ? ' on' : ''}`} onClick={() => setPick('all')}>ทุกหมวด</button>}
            </div>
          )}
          {sub === 'all' && subs.length > 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>กำลังดูทุกหมวด — จะบันทึกรายจ่ายไม่ได้จนกว่าจะเลือกหมวด (รายรับบันทึกเป็นส่วนกลาง แล้วย้ายเข้าหมวดทีหลังได้โดยแตะแถวแล้วเปลี่ยนหมวด)</p>}
          <details className="fundcats__more">
            <summary>จัดการหมวด · ยอดแต่ละหมวด</summary>
          <p className="muted small" style={{ margin: '2px 0 6px' }}>{subs.length ? 'เลือกหมวดก่อนบันทึกรับ/จ่าย — รายการใหม่จะอยู่ในหมวดที่เลือก และแต่ละหมวดมียอดคงเหลือแยกกัน' : 'ยังไม่มีหมวด — เพิ่มหมวด (เช่น พืชผัก โต๊ะจีน) เพื่อแยกบัญชีและรายงานภายในกองทุนนี้'}</p>
          {subs.length > 0 && (
            <table className="sheetpaper" style={{ marginTop: 8, fontSize: 13 }} aria-label="สรุปยอดแต่ละหมวด">
              <thead><tr><th>หมวด</th><th>รับ</th><th>จ่าย</th><th>คงเหลือ</th></tr></thead>
              <tbody>
                {sum.rows.filter((r) => !only || only.includes(r.id)).map((r) => <tr key={r.id}><td>{r.name}{r.active ? '' : ' (เก็บถาวร)'}{canManage && r.active && <> <button type="button" className="mini" onClick={() => rename(r.id, r.name)} aria-label={`แก้ชื่อหมวด ${r.name}`}>✎</button> <button type="button" className="mini" onClick={() => del(r.id, r.name)} aria-label={`ลบหมวด ${r.name}`}>🗑️</button></>}</td><td className="num">{fmtBaht(r.acc.moneyIn)}</td><td className="num">{fmtBaht(r.acc.moneyOut)}</td><td className="num" style={neg(r.acc.balance)}><b>{fmtBaht(r.acc.balance)}</b></td></tr>)}
                {!only && <tr><td>ส่วนกลาง (ยังไม่ระบุหมวด)</td><td className="num">{fmtBaht(sum.central.moneyIn)}</td><td className="num">{fmtBaht(sum.central.moneyOut)}</td><td className="num" style={neg(sum.central.balance)}><b>{fmtBaht(sum.central.balance)}</b></td></tr>}
              </tbody>
              <tfoot>{only ? (() => { const x = actAccount(f, subs.map((q) => q.id)); return <tr><td>รวมกิจกรรมนี้</td><td className="num">{fmtBaht(x.moneyIn)}</td><td className="num">{fmtBaht(x.moneyOut)}</td><td className="num"><b>{fmtBaht(x.balance)}</b></td></tr> })() : <tr><td>รวมทั้งกองทุน</td><td className="num">{fmtBaht(f.moneyIn)}</td><td className="num">{fmtBaht(f.moneyOut)}</td><td className="num"><b>{fmtBaht(f.balance)}</b></td></tr>}</tfoot>
            </table>
          )}
          {canManage && (
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <input className="input grow" aria-label="ชื่อหมวดใหม่" placeholder="ชื่อหมวดใหม่ เช่น พืชผัก" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
              <button type="button" className="btn btn--gold" onClick={add}>＋ เพิ่มหมวด</button>
            </div>
          )}
          </details>
          {subErr && <p className="err" role="alert">{subErr}</p>}
        </section>
      )}
      {!keeper && !act && <DebtBanner loans={loans.filter((l) => l.borrower === f.id)} types={types.list} />}
      {!keeper && !act && <DebtBanner lent loans={loans.filter((l) => l.lender.kind === 'fund' && l.lender.fundId === f.id)} types={types.list} />}
      {only && subs.length > 1 && (
        <div className="rtabs no-print" role="tablist" aria-label="หมวดที่ดูแล">
          {subs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={sub === q.id} className={`rtab${sub === q.id ? ' on' : ''}`} onClick={() => setPick(q.id)}>{q.name}</button>)}
        </div>
      )}
      {act && subs.length === 0 && <p className="empty no-print" role="status">กิจกรรมนี้ยังไม่มีหมวด{canManage ? ' — เพิ่มหมวด (เช่น พืชผัก โต๊ะจีน) ที่ช่องด้านบนก่อนจึงจะบันทึกรับ-จ่ายได้' : ' — แจ้งแอดมินให้เพิ่มหมวดก่อน'}</p>}
      {!(act && subs.length === 0) && <div className="fullmode fundsheets">
        <WeekBar sunday={sunday} sundays={sundays} onChange={setSunday} />
        <section className="record__sec record__sec--in" aria-label="รายรับ">
          <h2 className="record__h record__h--in">รายรับ <small>ใบบันทึกการถวาย</small></h2>
          <Receive key={`${year}-${f.id}-in-${sub}`} year={year} fund={fund} weekCtl={{ sunday, set: setSunday }} hideWeekBar fourTools />
        </section>
        <section className="record__sec record__sec--out" aria-label="รายจ่าย">
          <h2 className="record__h record__h--out">รายจ่าย <small>ใบเบิก-จ่ายเงินสด</small></h2>
          <Pay key={`${year}-${f.id}-out-${sub}`} year={year} fund={fund} weekCtl={{ sunday, set: setSunday }} hideWeekBar fourTools />
        </section>
        <section className="record__sec record__sec--fund" aria-label="สรุป ใบกองทุน">
          <h2 className="record__h record__h--fund">สรุป <small>ใบกองทุน (รับ-จ่ายต่อเนื่อง)</small></h2>
          {(() => {
          const church = settings.churchName.split(' ')[0]
          if (!subs.length) return <FundSheetPaper church={church} fundName={f.name} sheets={fundSheets(f)} />
          // กองทุนที่มีหมวด: แถบเลือกหมวดขึ้นก่อน แล้วจึงแสดงใบรับ/ใบจ่ายของหมวดนั้น
          const valid = sheetPick !== null && ((!only && (sheetPick === 'all' || sheetPick === '')) || subs.some((q) => q.id === sheetPick))
          const cur = valid ? sheetPick : subs[0].id // เปิดหมวดแรกให้อัตโนมัติ ไม่ปล่อยให้ว่าง
          const name = cur === 'all' ? '' : cur === '' ? 'ส่วนกลาง' : subs.find((q) => q.id === cur)?.name ?? ''
          return (
            <>
              <div className="rtabs no-print" role="tablist" aria-label="เลือกหมวดของใบกองทุน">
                {subs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={cur === q.id} className={`rtab${cur === q.id ? ' on' : ''}`} onClick={() => setSheetPick(q.id)}>{q.name}</button>)}
                {!only && <button type="button" role="tab" aria-selected={cur === ''} className={`rtab${cur === '' ? ' on' : ''}`} onClick={() => setSheetPick('')}>ส่วนกลาง</button>}
                {!only && <button type="button" role="tab" aria-selected={cur === 'all'} className={`rtab${cur === 'all' ? ' on' : ''}`} onClick={() => setSheetPick('all')}>รวมทุกหมวด</button>}
              </div>
              <FundSheetPaper church={church} fundName={name ? `${f.name} · ${name}` : f.name} sheets={fundSheets(subAccount(f, cur))} />
            </>
          )
        })()}
        </section>
      </div>}
      </>)}
    </>
  )
}
const neg = (x: number) => (x < 0 ? { color: '#b3261e' } : undefined)
