import { fmtBaht, fmtDate } from '../lib/money'
import type { ExpenseEntry, IncomeEntry, IncomeType } from '../lib/types'
import ScaledPage from './ScaledPage'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })

/** โลโก้คริสตจักร: กางเขนขาวบนสี่เหลี่ยมข้าวหลามตัดสีกรมท่า (ตามใบเบิก-จ่ายเงินสด) */
export function ChurchMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="9" y="9" width="22" height="22" rx="4" transform="rotate(45 20 20)" fill="#1a2b4c" />
      <path d="M20 11.5v17M13.2 17.5h13.6" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}
function PaperHead({ church, title, sub }: { church: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 6 }}>
      <ChurchMark />
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1a2b4c', lineHeight: 1.15 }}>{church}</div>
      <div style={{ fontSize: 20, fontWeight: 700, textDecoration: 'underline', color: '#111', margin: '2px 0' }}>{title}</div>
      {sub && <div style={{ fontSize: 13, textAlign: 'right' }}>{sub}</div>}
    </div>
  )
}

/** แผ่น A4 "ใบบันทึกการถวาย" แสดงเฉพาะรายการที่บันทึกแล้ว พร้อมยอดรวม */
export function IncomeSheetPaper({ church, entries, types, dateText }: { church: string; entries: IncomeEntry[]; types: IncomeType[]; dateText: string }) {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const name = (id: string) => types.find((t) => t.id === id)?.name ?? (id === '' ? 'โอน (ยังไม่แยกประเภท)' : '(ประเภทที่ถูกลบ)')
  const sum = (k: 'cash' | 'transfer') => rows.filter((x) => x.method === k).reduce((s, x) => s + x.amount, 0)
  const cnt = (k: 'cash' | 'transfer') => rows.filter((x) => x.method === k).reduce((s, x) => s + (x.count ?? 1), 0)
  return (
    <ScaledPage>
      <>
        <PaperHead church={church} title="ใบบันทึกการถวาย" sub={dateText} />
        <table className="tbl tbl--paper" aria-label="ใบบันทึกการถวาย (ตัวอย่างหน้ากระดาษ)">
          <thead><tr><th>No.</th><th>ประเภท</th><th className="num">จำนวนซอง</th><th className="num">จำนวนเงิน</th><th className="num">จำนวนโอน</th><th className="num">จำนวนเงิน</th><th className="num">รวม</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '14px 0' }}>ยังไม่มีรายการ — กรอกด้านบนแล้วกด “เพิ่มลงตาราง”</td></tr>}
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}.</td>
                <td>{name(x.typeId)} <span style={{ color: '#666', fontSize: 10.5 }}>({fmtDate(x.date)})</span></td>
                <td className="num">{x.method === 'cash' ? x.count ?? 1 : ''}</td>
                <td className="num">{x.method === 'cash' ? m(x.amount) : ''}</td>
                <td className="num">{x.method === 'transfer' ? x.count ?? 1 : ''}</td>
                <td className="num">{x.method === 'transfer' ? m(x.amount) : ''}</td>
                <td className="num"><b>{m(x.amount)}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2}>รวมทั้งสิ้น</td><td className="num">{cnt('cash')}</td><td className="num">{m(sum('cash'))}</td><td className="num">{cnt('transfer')}</td><td className="num">{m(sum('transfer'))}</td><td className="num">{m(sum('cash') + sum('transfer'))}</td></tr></tfoot>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
          <div>รวมจากตู้ถวาย {m(sum('cash'))} บาท<br />รวมจากการโอน {m(sum('transfer'))} บาท</div>
          <div>ลงชื่อผู้ตรวจนับ 1 ...............................................<br />ลงชื่อผู้ตรวจนับ 2 ...............................................</div>
        </div>
      </>
    </ScaledPage>
  )
}

/** แผ่น A4 "ใบเบิก - จ่ายเงินสด" แสดงเฉพาะรายการที่บันทึกแล้ว พร้อมยอดรวม */
export function VoucherPaper({ church, entries, dateText }: { church: string; entries: ExpenseEntry[]; dateText: string }) {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  const total = rows.reduce((s, x) => s + x.amount, 0)
  return (
    <ScaledPage>
      <>
        <PaperHead church={church} title="ใบเบิก - จ่ายเงินสด" sub={dateText} />
        <table className="tbl tbl--paper" aria-label="ใบเบิก-จ่ายเงินสด (ตัวอย่างหน้ากระดาษ)">
          <thead><tr><th>ลำดับที่</th><th>รายการ</th><th className="num">จำนวนเงิน</th><th>ผู้เบิกเงิน</th><th>ผู้รับเงิน</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '14px 0' }}>ยังไม่มีรายการ — กรอกด้านบนแล้วกด “เพิ่มลงตาราง”</td></tr>}
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td>{x.desc} <span style={{ color: '#666', fontSize: 10.5 }}>({fmtDate(x.date)})</span></td>
                <td className="num">{m(x.amount)}</td>
                <td>{x.requester ?? ''}</td>
                <td>{x.who ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2}>รวมจ่ายเป็นเงินทั้งสิ้น</td><td className="num">{m(total)}</td><td colSpan={2}>บาท</td></tr></tfoot>
        </table>
        <div style={{ display: 'flex', gap: 18, marginTop: 'auto', fontSize: 13 }}>
          <div style={{ flex: 1, border: '1px solid #1a2b4c', padding: 8 }}><b>ผู้อนุมัติ / ตรวจสอบ</b><br /><br />ลงชื่อ.................................................<br />(.................................................)<br />วันที่........../........../..........</div>
          <div style={{ flex: 1, border: '1px solid #1a2b4c', padding: 8 }}><b>ผู้จ่าย / ฝ่ายบัญชี</b><br /><br />ลงชื่อ.................................................<br />(.................................................)<br />วันที่........../........../..........</div>
        </div>
      </>
    </ScaledPage>
  )
}
