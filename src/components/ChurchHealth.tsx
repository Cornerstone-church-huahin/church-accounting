import { Link } from 'react-router-dom'
import { canSeeBalances } from '../lib/access'
import { useRole } from '../lib/members'
import { LEVEL_UI, TARGET_WEEKS, TREND_UI } from '../lib/churchHealth'
import { fmtBaht } from '../lib/money'
import { useChurchHealth } from '../lib/useChurchHealth'
import { useYear } from '../lib/year'

/** ปุ่มเดียวในหน้างาน: แสดงสถานะการเงินสด ๆ (สี + ใช้ได้กี่สัปดาห์) แตะเข้าหน้าสถานะ */
export function HealthButton({ n }: { n: number }) {
  const { year } = useYear()
  const { health: h } = useChurchHealth(year)
  const ui = LEVEL_UI[h.level]
  return (
    <nav className="acctlinks no-print" aria-label="สถานะการเงินคริสตจักร">
      <Link to={`/meeting/${n}/health`} className={`healthbtn healthbtn--${h.level}`}>
        <span aria-hidden="true">🩺</span> <b>สถานะการเงินคริสตจักร</b>
        <span className="healthbtn__s">{ui.icon} {ui.title}{h.weeks !== null ? ` · พอใช้ ${h.weeks >= 99 ? '99+' : Math.floor(h.weeks)} สัปดาห์` : ''}</span>
      </Link>
    </nav>
  )
}

/** หน้าสถานะการเงินคริสตจักร: ใบสรุปใบเดียวสำหรับผู้นำทุกงาน — เห็นสุขภาพการเงิน เป้าสำรอง แนวโน้ม และทางช่วยกัน · ตัวเลขเงินเห็นเฉพาะผู้มีสิทธิ์ · ไม่มีชื่อผู้ถวาย/รายคน */
export default function ChurchHealth({ n, name }: { n: number; name: string }) {
  const { year } = useYear()
  const { health: h, own, fund } = useChurchHealth(year)
  const ui = LEVEL_UI[h.level]
  const nums = canSeeBalances(useRole())
  const pct = Math.round(h.progress * 100)
  const wk = h.weeks === null ? null : Math.floor(h.weeks)
  return (
    <>
      <div className="page-head no-print">
        <h1>🩺 สถานะการเงิน</h1>
        <Link to={`/meeting/${n}`} className="mini">‹ {name}</Link>
      </div>
      <section className={`card healthcard healthcard--${h.level}`} aria-label="สถานะการเงินคริสตจักร">
        <div className="healthcard__top"><span className="healthcard__icon" aria-hidden="true">{ui.icon}</span><div><b className="healthcard__title">{ui.title}</b><p className="healthcard__msg">{ui.message}</p></div></div>
        <div className="healthmeter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`เงินสำรองหมุนเวียน ${pct}% ของเป้า ${TARGET_WEEKS} สัปดาห์`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="small" style={{ margin: '0.2rem 0 0' }}>เงินสำรองหมุนเวียน {wk === null ? 'ยังไม่มีรายจ่ายให้เทียบ' : `พอใช้ ${wk} สัปดาห์`} · เป้าหมาย {TARGET_WEEKS} สัปดาห์ ({pct}%)</p>
        <p className="small" style={{ margin: '0.2rem 0 0' }}>{TREND_UI[h.trend]}</p>
      </section>
      {nums && (
        <section className="card healthnums" aria-label="ตัวเลขเงินคริสตจักร">
          <div><small>🏠 เงินหมุนเวียน</small><b>{fmtBaht(own, { dec: false })}</b></div>
          <div><small>💰 เงินกองทุน</small><b>{fmtBaht(fund, { dec: false })}</b></div>
          <div><small>🧾 ใช้จ่ายเฉลี่ย/สัปดาห์</small><b>{fmtBaht(Math.round(h.weeklyOut), { dec: false })}</b></div>
        </section>
      )}
      <section className="card" aria-label="เราช่วยกันได้อย่างไร">
        <b>🤝 เราช่วยกันได้อย่างไร</b>
        <ul className="healthtips">{ui.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
      <section className="card no-print" aria-label="ดูรายละเอียดบัญชี">
        <b>📚 ดูรายละเอียดบัญชี (ดูอย่างเดียว)</b>
        <nav className="acctlinks" style={{ marginTop: '0.4rem' }} aria-label="บัญชีรับ บัญชีจ่าย และภาพรวม (ดูอย่างเดียว)">
          <Link to={`/meeting/${n}/in`} className="acctlink acctlink--in"><span aria-hidden="true">💚</span> บัญชีรับ</Link>
          <Link to={`/meeting/${n}/out`} className="acctlink acctlink--out"><span aria-hidden="true">🔴</span> บัญชีจ่าย</Link>
          <Link to={`/meeting/${n}/all`} className="acctlink acctlink--all"><span aria-hidden="true">📊</span> ภาพรวม</Link>
        </nav>
      </section>
    </>
  )
}
