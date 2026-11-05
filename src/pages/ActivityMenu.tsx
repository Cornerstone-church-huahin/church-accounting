import { useEffect, useState } from 'react'
import { can } from '../lib/access'
import { useExpenses, useIncome, useIncomeTypes } from '../lib/data'
import { ACT_TYPE_ID, migratable, planActMigration, type ActMigration } from '../lib/actMigrate'
import { activityMoney } from '../lib/fundActs'
import { useRole } from '../lib/members'
import { fmtBaht } from '../lib/money'
import FundDetailPage, { useFundAccounts } from './FundDetail'

const REPORT_KEY = 'acct.actmig.report.v1'
type Report = ActMigration['summary'] & { at: number }
const readReport = (): Report | null => { try { const r = localStorage.getItem(REPORT_KEY); return r ? (JSON.parse(r) as Report) : null } catch { return null } }

/** ย้ายกิจกรรมจากกองทุนเข้า “เงินกิจกรรม” (กดครั้งเดียว) — ข้อมูลเดิม รายรับ-จ่าย และสลิป/รูปแนบย้ายตามไปทั้งหมด */
function MigrateCard({ onDone }: { onDone: (r: Report) => void }) {
  const types = useIncomeTypes()
  const Y = new Date().getFullYear()
  const ys = [Y - 2, Y - 1, Y] // จำนวน hook คงที่
  const incs = ys.map((y) => useIncome(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const exps = ys.map((y) => useExpenses(y)) // eslint-disable-line react-hooks/rules-of-hooks
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const src = migratable(types.list)
  const plan = planActMigration(types.list, incs.flatMap((s) => s.all), exps.flatMap((s) => s.all), Date.now())
  if (!plan) return null
  const run = () => {
    if (!confirm(`ย้ายกิจกรรมจาก “${plan.summary.from.join(', ')}” เข้า “เงินกิจกรรม” ?\n\nกิจกรรม ${plan.summary.activities} · รายรับ ${plan.summary.income} · รายจ่าย ${plan.summary.expenses} รายการ (สลิป/รูปแนบย้ายตามไปด้วย)`)) return
    setBusy(true); setErr('')
    // ลำดับปลอดภัย: สร้างเงินกิจกรรมก่อน → ย้ายรายการ → ค่อยถอดกิจกรรมออกจากกองทุนเดิม (หยุดกลางทางแล้วกดซ้ำได้)
    let ok = types.put([plan.target])
    ys.forEach((_y, i) => {
      const ids = new Set(incs[i].all.map((x) => x.id)); const mine = plan.income.filter((x) => ids.has(x.id))
      if (ok && mine.length) ok = incs[i].put(mine)
      const eids = new Set(exps[i].all.map((x) => x.id)); const em = plan.expenses.filter((x) => eids.has(x.id))
      if (ok && em.length) ok = exps[i].put(em)
    })
    if (ok) ok = types.put(plan.sources)
    setBusy(false)
    if (!ok) { setErr('ย้ายไม่สำเร็จ (ไม่มีสิทธิ์หรือบันทึกไม่ได้) — ข้อมูลเดิมยังอยู่ครบ กดย้ายซ้ำได้'); return }
    const r = { ...plan.summary, at: Date.now() }
    try { localStorage.setItem(REPORT_KEY, JSON.stringify(r)) } catch { /* ignore */ }
    onDone(r)
  }
  return (
    <section className="card no-print" role="region" aria-label="ย้ายกิจกรรมเข้าเงินกิจกรรม" style={{ borderLeft: '8px solid #c62828' }}>
      <h2 style={{ marginTop: 0 }}>📦 ย้ายกิจกรรมเดิมเข้า “เงินกิจกรรม”</h2>
      <p className="small">พบกิจกรรมที่ยังอยู่ใน {src.map((s) => `“${s.name}”`).join(', ')} — กดย้ายครั้งเดียว กิจกรรม รายรับ-จ่าย สลิป และรูปแนบจะมาอยู่ที่นี่ครบ และไม่ผูกกับกองทุนอีก</p>
      <p className="small muted">จะย้าย: กิจกรรม {plan.summary.activities} · หมวด {plan.summary.subs} · รายรับ {plan.summary.income} · รายจ่าย {plan.summary.expenses} รายการ · สลิป/รูปแนบ {plan.summary.slips} · ยอดคงเหลือ {fmtBaht(plan.summary.balance)} บาท (ย้ายรายการของ 3 ปีล่าสุด)</p>
      {err && <p role="alert" style={{ color: '#b3261e' }}>{err}</p>}
      <button type="button" className="btn" disabled={busy} onClick={run}>{busy ? 'กำลังย้าย…' : 'ย้ายเข้าเงินกิจกรรม'}</button>
    </section>
  )
}

/** ผลการย้าย + ตรวจยอดจริงเทียบกับตอนย้าย */
function Report({ r, onClose }: { r: Report; onClose: () => void }) {
  const fa = useFundAccounts()
  const types = useIncomeTypes()
  const t = types.list.find((x) => x.standalone)
  const live = t ? activityMoney(fa.rows, [t]).total : 0
  const same = live === r.balance
  return (
    <section className="card no-print" role="status" aria-label="ผลการย้ายเงินกิจกรรม" style={{ borderLeft: `8px solid ${same ? '#1b7a52' : '#b36b00'}` }}>
      <p style={{ margin: 0 }}><b>{same ? '✅ ย้ายครบและยอดตรงกัน' : '⚠️ ย้ายแล้ว แต่ยอดยังไม่ตรง (รอซิงค์แล้วรีเฟรช)'}</b></p>
      <p className="small" style={{ margin: '4px 0' }}>กิจกรรม {r.activities} · รายรับ {r.income} · รายจ่าย {r.expenses} · สลิป/รูปแนบ {r.slips} · ยอดตอนย้าย {fmtBaht(r.balance)} บาท · ยอดตอนนี้ {fmtBaht(live)} บาท</p>
      {same && <p className="small" style={{ margin: '4px 0' }}>ตรวจแล้ว: ลบ “{r.from.join(', ')}” ออกจากกองทุนแล้วสร้างใหม่ได้ โดยเงินกิจกรรมไม่กระทบ</p>}
      <button type="button" className="mini" onClick={onClose}>ซ่อนข้อความนี้</button>
    </section>
  )
}

/** เมนู “เงินกิจกรรม”: ระบบแยกจากกองทุน มีกิจกรรม/รับ-จ่าย/รายงานครบ */
export default function ActivityMenu() {
  const types = useIncomeTypes()
  const role = useRole()
  const admin = can(role, 'settings')
  const target = types.list.find((x) => x.standalone && x.active)
  const pending = migratable(types.list).length > 0
  const [report, setReport] = useState<Report | null>(readReport)
  useEffect(() => {
    if (admin && !target && !pending) types.put([{ id: ACT_TYPE_ID, name: 'เงินกิจกรรม', order: 900, active: true, fund: true, actMode: true, standalone: true, noActAuto: true, activities: [], subs: [], updated: 0 }])
  }, [admin, target, pending]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {admin && pending && <MigrateCard onDone={setReport} />}
      {report && !pending && <Report r={report} onClose={() => { try { localStorage.removeItem(REPORT_KEY) } catch { /* ignore */ } setReport(null) }} />}
      {target ? <FundDetailPage forceId={target.id} /> : !pending && <p className="empty">กำลังเตรียมเงินกิจกรรม… (ถ้าไม่ขึ้น ให้แอดมินเปิดหน้านี้)</p>}
    </>
  )
}
