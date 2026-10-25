import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fmtBaht, fmtDate } from '../lib/money'
import { useYear } from '../lib/year'
import DebtBanner from '../components/DebtBanner'
import { isLoanMove, type FundScope } from '../lib/fundScope'
import { useFundAccounts } from './FundAccounts'
import { FundSheetPaper } from '../components/PaperSheets'
import { fundSheets } from '../lib/fundSheet'
import { useSettings } from '../lib/data'
import { can } from '../lib/access'
import { useRole } from '../lib/members'
import type { CatalogOps } from '../components/CatalogManager'
import { activeSubs, addSub, removeSub, subAccount, subSummary } from '../lib/fundSubs'
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
  const [tab, setTab] = useState<'in' | 'out' | 'sheet'>('in')
  const { settings } = useSettings()
  const role = useRole()
  const [pick, setPick] = useState<string | null>(null)
  const [newSub, setNewSub] = useState('')
  const [sheetPick, setSheetPick] = useState<string | null>(null) // ใบกองทุน: หมวดที่เลือกดู (null = ยังไม่เลือก)
  const [subErr, setSubErr] = useState('')
  const f = rows.find((r) => r.id === id)
  if (!f) return <><div className="page-head"><h1>💰 กองทุน</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div><p className="empty">ไม่พบกองทุนนี้ (อาจถูกลบหรือเปลี่ยนชื่อ)</p></>
  const t = types.list.find((x) => x.id === f.id)
  const subs = activeSubs(t)
  const sum = subSummary(f, t)
  // มีหมวด: เริ่มที่หมวดแรก (พร้อมบันทึกได้ทันที) · ไม่มีหมวด: ทำงานเหมือนเดิมทุกประการ
  const canManage = can(role, 'settings')
  // ตัวเลือก/ตารางหมวดในหน้านี้เห็นเฉพาะแอดมิน · คนอื่นเลือกหมวดในฟอร์มบันทึก (เห็นรายการทุกหมวด)
  const sub = subs.length && canManage ? (pick !== null && (pick === 'all' || pick === '' || subs.some((q) => q.id === pick)) ? pick : subs[0].id) : 'all'
  const acct = subAccount(f, sub)
  const subName = sub === 'all' ? '' : sub === '' ? 'ส่วนกลาง' : subs.find((q) => q.id === sub)?.name ?? ''
  const saveSubs = (next: ReturnType<typeof removeSub>) => { if (t) types.put([{ ...t, subs: next }]) }
  const subOps: CatalogOps | undefined = canManage && t ? {
    add: (name) => { const r = addSub(t, name); if ('error' in r) return r; const id = r.subs[r.subs.length - 1].id; saveSubs(r.subs); return { id } },
    rename: (id, cur) => { const n = prompt('แก้ชื่อหมวด', cur)?.trim(); if (n && n !== cur) saveSubs((t.subs ?? []).map((q) => (q.id === id ? { ...q, name: n } : q))) },
    remove: (id, nm) => { const has = f.moves.some((m) => m.subId === id); if (confirm(has ? `หมวด “${nm}” มีรายการแล้ว จะเก็บถาวร (ซ่อนจากตัวเลือก แต่รายงานยังเห็น) — ต้องการหรือไม่?` : `ลบหมวด “${nm}” ?`)) { saveSubs(removeSub(t, id, has)); if (pick === id) setPick(null) } },
  } : undefined
  const fund: FundScope = {
    id: f.id, name: f.name, balance: acct.balance,
    loanMoves: sub === 'all' || sub === '' ? f.moves.filter(isLoanMove) : [],
    ...(subs.length || subOps ? { subs, subOps, sub, subLabel: subName, subBal: { '': sum.central.balance, ...Object.fromEntries(sum.rows.map((r) => [r.id, r.acc.balance])) } } : {}),
  }
  const add = () => { if (!t) return; const r = addSub(t, newSub); if ('error' in r) return setSubErr(r.error); saveSubs(r.subs); setNewSub(''); setSubErr('') }
  const rename = (id: string, cur: string) => { const n = prompt('แก้ชื่อหมวด', cur)?.trim(); if (n && n !== cur && t) saveSubs((t.subs ?? []).map((q) => (q.id === id ? { ...q, name: n } : q))) }
  const del = (id: string, nm: string) => { if (!t) return; const has = f.moves.some((m) => m.subId === id); if (confirm(has ? `หมวด “${nm}” มีรายการแล้ว จะเก็บถาวร (ซ่อนจากตัวเลือก แต่รายงานยังเห็น) — ต้องการหรือไม่?` : `ลบหมวด “${nm}” ?`)) { saveSubs(removeSub(t, id, has)); if (pick === id) setPick(null) } }
  return (
    <>
      <div className="page-head no-print"><h1>💰 {f.name}</h1><Link to="/funds" className="mini">‹ ทุกกองทุน</Link></div>
      <section className="card no-print" role="status" aria-label={`ยอดคงเหลือ กองทุน ${f.name}`}>
        <p className="muted small" style={{ margin: 0 }}>เงินคงเหลือของกองทุนนี้</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: '2px 0', color: f.balance < 0 ? '#b3261e' : undefined }}>{fmtBaht(f.balance)} บาท{f.balance < 0 ? ' (ติดลบ)' : ''}</p>
        <p className="muted small" style={{ margin: 0 }}>ตั้งต้น {fmtBaht(f.opening)}{opening ? ` (${fmtDate(opening.date)})` : ''} + เข้า {fmtBaht(f.moneyIn)} − ออก {fmtBaht(f.moneyOut)} = <b>{fmtBaht(f.balance)}</b></p>
      </section>
      {canManage && tab !== 'sheet' && (
        <section className="card no-print" aria-label="หมวดของกองทุน">
          <b>หมวดของกองทุนนี้</b>
          <p className="muted small" style={{ margin: '2px 0 6px' }}>{subs.length ? 'เลือกหมวดก่อนบันทึกรับ/จ่าย — รายการใหม่จะอยู่ในหมวดที่เลือก และแต่ละหมวดมียอดคงเหลือแยกกัน' : 'ยังไม่มีหมวด — เพิ่มหมวด (เช่น พืชผัก โต๊ะจีน) เพื่อแยกบัญชีและรายงานภายในกองทุนนี้'}</p>
          {subs.length > 0 && (
            <div className="rtabs" role="tablist" aria-label="หมวดที่กำลังดู/บันทึก">
              {subs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={sub === q.id} className={`rtab${sub === q.id ? ' on' : ''}`} onClick={() => setPick(q.id)}>{q.name}</button>)}
              <button type="button" role="tab" aria-selected={sub === ''} className={`rtab${sub === '' ? ' on' : ''}`} onClick={() => setPick('')}>ส่วนกลาง</button>
              <button type="button" role="tab" aria-selected={sub === 'all'} className={`rtab${sub === 'all' ? ' on' : ''}`} onClick={() => setPick('all')}>ทุกหมวด</button>
            </div>
          )}
          {sub === 'all' && subs.length > 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>กำลังดูทุกหมวด — จะบันทึกรายจ่ายไม่ได้จนกว่าจะเลือกหมวด (รายรับบันทึกเป็นส่วนกลาง แล้วย้ายเข้าหมวดทีหลังได้โดยแตะแถวแล้วเปลี่ยนหมวด)</p>}
          {subs.length > 0 && (
            <table className="sheetpaper" style={{ marginTop: 8, fontSize: 13 }} aria-label="สรุปยอดแต่ละหมวด">
              <thead><tr><th>หมวด</th><th>รับ</th><th>จ่าย</th><th>คงเหลือ</th></tr></thead>
              <tbody>
                {sum.rows.map((r) => <tr key={r.id}><td>{r.name}{r.active ? '' : ' (เก็บถาวร)'}{canManage && r.active && <> <button type="button" className="mini" onClick={() => rename(r.id, r.name)} aria-label={`แก้ชื่อหมวด ${r.name}`}>✎</button> <button type="button" className="mini" onClick={() => del(r.id, r.name)} aria-label={`ลบหมวด ${r.name}`}>🗑️</button></>}</td><td className="num">{fmtBaht(r.acc.moneyIn)}</td><td className="num">{fmtBaht(r.acc.moneyOut)}</td><td className="num" style={neg(r.acc.balance)}><b>{fmtBaht(r.acc.balance)}</b></td></tr>)}
                <tr><td>ส่วนกลาง (ยังไม่ระบุหมวด)</td><td className="num">{fmtBaht(sum.central.moneyIn)}</td><td className="num">{fmtBaht(sum.central.moneyOut)}</td><td className="num" style={neg(sum.central.balance)}><b>{fmtBaht(sum.central.balance)}</b></td></tr>
              </tbody>
              <tfoot><tr><td>รวมทั้งกองทุน</td><td className="num">{fmtBaht(f.moneyIn)}</td><td className="num">{fmtBaht(f.moneyOut)}</td><td className="num"><b>{fmtBaht(f.balance)}</b></td></tr></tfoot>
            </table>
          )}
          {canManage && (
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <input className="input grow" aria-label="ชื่อหมวดใหม่" placeholder="ชื่อหมวดใหม่ เช่น พืชผัก" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
              <button type="button" className="btn btn--gold" onClick={add}>＋ เพิ่มหมวด</button>
            </div>
          )}
          {subErr && <p className="err" role="alert">{subErr}</p>}
        </section>
      )}
      <DebtBanner loans={loans.filter((l) => l.borrower === f.id)} types={types.list} />
      <DebtBanner lent loans={loans.filter((l) => l.lender.kind === 'fund' && l.lender.fundId === f.id)} types={types.list} />
      <div className="home-tabs home-tabs--mini no-print" role="tablist" aria-label="กองทุนนี้: รับ จ่าย ใบกองทุน" style={{ margin: '6px 0', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button type="button" role="tab" aria-selected={tab === 'in'} className={`home-tab home-tab--in${tab === 'in' ? ' on' : ''}`} onClick={() => setTab('in')}><i className="hn">1</i><span>💚 รับ</span></button>
        <button type="button" role="tab" aria-selected={tab === 'out'} className={`home-tab home-tab--out${tab === 'out' ? ' on' : ''}`} onClick={() => setTab('out')}><i className="hn">2</i><span>🔴 จ่าย</span></button>
        <button type="button" role="tab" aria-selected={tab === 'sheet'} className={`home-tab home-tab--sum${tab === 'sheet' ? ' on' : ''}`} onClick={() => setTab('sheet')}><i className="hn">3</i><span>📄 ใบกองทุน</span></button>
      </div>
      <div className="fullmode">
        {tab === 'sheet' ? (() => {
          const church = settings.churchName.split(' ')[0]
          if (!subs.length) return <FundSheetPaper church={church} fundName={f.name} sheets={fundSheets(f)} />
          // กองทุนที่มีหมวด: แถบเลือกหมวดขึ้นก่อน แล้วจึงแสดงใบรับ/ใบจ่ายของหมวดนั้น
          const valid = sheetPick !== null && (sheetPick === 'all' || sheetPick === '' || subs.some((q) => q.id === sheetPick))
          const cur = valid ? sheetPick : subs[0].id // เปิดหมวดแรกให้อัตโนมัติ ไม่ปล่อยให้ว่าง
          const name = cur === 'all' ? '' : cur === '' ? 'ส่วนกลาง' : subs.find((q) => q.id === cur)?.name ?? ''
          return (
            <>
              <div className="rtabs no-print" role="tablist" aria-label="เลือกหมวดของใบกองทุน">
                {subs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={cur === q.id} className={`rtab${cur === q.id ? ' on' : ''}`} onClick={() => setSheetPick(q.id)}>{q.name}</button>)}
                <button type="button" role="tab" aria-selected={cur === ''} className={`rtab${cur === '' ? ' on' : ''}`} onClick={() => setSheetPick('')}>ส่วนกลาง</button>
                <button type="button" role="tab" aria-selected={cur === 'all'} className={`rtab${cur === 'all' ? ' on' : ''}`} onClick={() => setSheetPick('all')}>รวมทุกหมวด</button>
              </div>
              <FundSheetPaper church={church} fundName={name ? `${f.name} · ${name}` : f.name} sheets={fundSheets(subAccount(f, cur))} />
            </>
          )
        })() : tab === 'in' ? <Receive key={`${year}-${f.id}-in-${sub}`} year={year} fund={fund} /> : <Pay key={`${year}-${f.id}-out-${sub}`} year={year} fund={fund} />}
      </div>
    </>
  )
}
const neg = (x: number) => (x < 0 ? { color: '#b3261e' } : undefined)
