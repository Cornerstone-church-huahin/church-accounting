import { APP_CREDIT, DOC_CREDIT } from '../lib/credit'

/** เครดิตท้ายหน้าแอป: อยู่ในลำดับเนื้อหา (ไม่ลอย ไม่บังปุ่ม) · ไม่พิมพ์ (เอกสารมีเครดิตของตัวเอง) */
export function AppCredit() {
  return <footer className="app-credit no-print" data-credit="app">{APP_CREDIT}</footer>
}

/**
 * กรอบเอกสารที่พิมพ์จากหน้าเว็บ (ไม่ใช่ใบ A4): บนจอไม่เปลี่ยนหน้าตา · ตอนพิมพ์เป็นตารางที่มีส่วนท้ายซ้ำทุกหน้า
 * จึงมีเครดิตท้ายทุกหน้ากระดาษ โดยกันที่ไว้ให้ ไม่ทับเนื้อหา และไม่ทำให้เกิดหน้าว่างเพิ่ม
 */
export function PrintFrame({ children }: { children: React.ReactNode }) {
  return (
    <table className="print-frame">
      <tbody><tr><td><div className="print-frame__body">{children}</div></td></tr></tbody>
      <tfoot><tr><td className="print-frame__credit" data-credit="print">{DOC_CREDIT}</td></tr></tfoot>
    </table>
  )
}

/** เครดิตท้ายใบ A4 — ใส่ใน ScaledPage อัตโนมัติ (ทุกใบ/ทุกหน้า ทั้งบนจอ PDF และพิมพ์) */
export function DocCredit() {
  return <div className="doccredit" data-credit="doc">{DOC_CREDIT}</div>
}
