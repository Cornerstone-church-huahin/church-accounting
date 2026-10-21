import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { landSummary } from '../lib/land'
import { fmtBaht, fmtDate } from '../lib/money'
import { useFundAccounts } from './FundAccounts'

/**
 * หน้า “ภาระที่ดิน” (ต้นแบบ): ส่วนเงินสะสมเชื่อมกับกองทุนที่ดินจริงแล้ว (ยอดสุทธิ · เงินถวายเพิ่มเติม · รายการล่าสุด)
 * ยอดภาระ 6,000,000 เป็นตัวอย่างบนหน้าจอ ยังไม่ได้บันทึกเป็นหนี้ · ส่วนชำระแล้ว/ภาระคงเหลือ/ข้อตกลงยังไม่เชื่อมระบบ
 */
const NONE = 'ยังไม่ระบุ'
const Row = ({ k, v, neg }: { k: string; v: string; neg?: boolean }) => <div className="landrow"><span>{k}</span><b style={neg ? { color: '#b3261e' } : undefined}>{v}</b></div>
const baht = (n: number) => `${fmtBaht(n)} บาท`

export default function Land() {
  const { rows } = useFundAccounts()
  const land = useMemo(() => landSummary(rows), [rows])
  return (
    <div className="landpage">
      <div className="page-head"><h1>🏞️ ภาระที่ดิน</h1><Link to="/" className="mini">‹ หน้าแรก</Link></div>
      <p className="muted small" role="note">หน้าต้นแบบ — เงินสะสมเชื่อมกองทุนที่ดินแล้ว · ยอดภาระและการชำระยังไม่เชื่อมระบบบัญชี</p>

      <section className="card" aria-labelledby="land-1">
        <h2 id="land-1">1 · ภาระที่ดิน</h2>
        <Row k="ยอดภาระตั้งต้น" v="6,000,000 บาท" />
        <Row k="ชำระแล้ว" v="—" />
        <Row k="ภาระคงเหลือ" v="—" />
        <Row k="วันที่อ้างอิง" v="—" />
      </section>

      <section className="card" aria-labelledby="land-2">
        <h2 id="land-2">2 · เงินสะสมเพื่อที่ดิน</h2>
        <Row k="เงินกองทุนที่ดินคงเหลือ" v={land.funds.length ? baht(land.balance) : '—'} neg={land.balance < 0} />
        <Row k="เงินถวายเพิ่มเติม" v={land.funds.length ? baht(land.offered) : '—'} />
        <p className="muted small" style={{ margin: '0.4rem 0 0' }}>เงินสะสมและยอดชำระเป็นคนละส่วนกัน · “เงินถวายเพิ่มเติม” = เงินถวายเข้ากองทุนที่ดินหลังยอดตั้งต้น (ไม่รวมเงินยืม/คืน)</p>
        {land.funds.length === 0
          ? <p className="empty">ยังไม่พบกองทุนที่ดิน (กองทุนที่ชื่อมีคำว่า “ที่ดิน”)</p>
          : (
            <ul className="list" aria-label="กองทุนที่ดินแต่ละกองทุน" style={{ marginTop: '0.5rem' }}>
              {land.funds.map((f) => (
                <li key={f.id}>
                  <Link to={`/funds/${f.id}`} className="item">
                    <span className="grow"><b>{f.name}</b><br />
                      <span className="muted small">ตั้งต้น {fmtBaht(f.opening)} · ถวายเพิ่ม {fmtBaht(f.offered)} · ออก {fmtBaht(f.out)}</span></span>
                    <b style={f.balance < 0 ? { color: '#b3261e' } : undefined}>{fmtBaht(f.balance)}</b><span aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="card" aria-labelledby="land-3">
        <h2 id="land-3">3 · รายละเอียดข้อตกลง</h2>
        <Row k="เจ้าหนี้หรือคู่สัญญา" v={NONE} />
        <Row k="เอกสารอ้างอิง" v={NONE} />
        <Row k="เงื่อนไขการชำระ" v={NONE} />
        <Row k="กำหนดชำระ" v={NONE} />
        <Row k="หมายเหตุ" v={NONE} />
      </section>

      <section className="card" aria-labelledby="land-4">
        <h2 id="land-4">4 · ประวัติการถวายและการชำระ</h2>
        {land.recent.length === 0
          ? <p className="empty">ยังไม่มีรายการในกองทุนที่ดิน</p>
          : (
            <>
              <ul className="list" aria-label="รายการล่าสุดของกองทุนที่ดิน">
                {land.recent.map((m) => (
                  <li key={m.key} className="row row--between">
                    <span className="grow"><b>{m.label}</b><br /><span className="muted small">{fmtDate(m.date)} · {m.fund}</span></span>
                    <b style={{ color: m.amount < 0 ? '#b3261e' : '#1b6b3a' }}>{m.amount < 0 ? '−' : '+'}{fmtBaht(Math.abs(m.amount))}</b>
                  </li>
                ))}
              </ul>
              <p className="muted small" style={{ margin: '0.4rem 0 0' }}>แสดง {land.recent.length} รายการล่าสุด · ดูทั้งหมดในหน้ากองทุนแต่ละกอง</p>
            </>
          )}
      </section>
    </div>
  )
}
