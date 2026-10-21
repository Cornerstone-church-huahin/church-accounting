import { Link } from 'react-router-dom'

/** หน้าต้นแบบ “ภาระที่ดิน” — จัดหน้าจอและการนำทางเท่านั้น ยังไม่เชื่อมระบบบัญชี ไม่มีการบันทึกหรือคำนวณ (6,000,000 เป็นตัวอย่างบนหน้าจอ) */
const NONE = 'ยังไม่ระบุ'
const Row = ({ k, v }: { k: string; v: string }) => <div className="landrow"><span>{k}</span><b>{v}</b></div>

export default function Land() {
  return (
    <div className="landpage">
      <div className="page-head"><h1>🏞️ ภาระที่ดิน</h1><Link to="/" className="mini">‹ หน้าแรก</Link></div>
      <p className="muted small" role="note">หน้าต้นแบบ — ยังไม่เชื่อมระบบบัญชี</p>

      <section className="card" aria-labelledby="land-1">
        <h2 id="land-1">1 · ภาระที่ดิน</h2>
        <Row k="ยอดภาระตั้งต้น" v="6,000,000 บาท" />
        <Row k="ชำระแล้ว" v="—" />
        <Row k="ภาระคงเหลือ" v="—" />
        <Row k="วันที่อ้างอิง" v="—" />
      </section>

      <section className="card" aria-labelledby="land-2">
        <h2 id="land-2">2 · เงินสะสมเพื่อที่ดิน</h2>
        <Row k="เงินกองทุนที่ดินคงเหลือ" v="—" />
        <Row k="เงินถวายเพิ่มเติม" v="—" />
        <p className="muted small" style={{ margin: '0.4rem 0 0' }}>เงินสะสมและยอดชำระเป็นคนละส่วนกัน</p>
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
        <p className="empty">ยังไม่เชื่อมข้อมูล</p>
      </section>
    </div>
  )
}
