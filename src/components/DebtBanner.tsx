import { fmtBaht, fmtDate } from '../lib/money'
import { lenderLabel, loanBalance } from '../lib/loans'
import type { IncomeType, Loan } from '../lib/types'

/** แถบเตือนสีแดง: เงินก้อนนี้ยืมมาจากใคร วันไหน เพื่ออะไร — แสดงจนกว่าจะคืนครบ (ยอดเงินจริงของกองทุน/เงินหมุนเวียนไม่ถูกหัก) */
export default function DebtBanner({ loans, types, lent }: { loans: Loan[]; types: IncomeType[]; /** วันตัดยอดตั้งต้น — เงินยืมก่อนหน้านี้ถือว่านับรวมในยอดตั้งต้นแล้ว (ไม่ถูกหักซ้ำ) */ openingDate?: string; /** true = กองทุนนี้เป็นฝ่ายถูกยืมไป (ยืมให้กองทุนอื่น) */ lent?: boolean }) {
  const open = loans.filter((l) => !l.deleted && loanBalance(l) > 0).sort((a, b) => a.date.localeCompare(b.date))
  if (open.length === 0) return null
  const name = (id?: string) => types.find((t) => t.id === id)?.name ?? ''
  return (
    <div className={`debtbanner${lent ? ' debtbanner--lent' : ''}`} role="alert" aria-label={lent ? 'เงินกองทุนนี้ถูกยืมไป' : 'หนี้ที่ต้องคืน'}>
      {open.map((l) => (
        <p key={l.id}>{lent
          ? <>💚 <b>ให้ยืมไป {fmtBaht(loanBalance(l), { dec: false })} บาท · รอรับคืน</b> โดย {l.borrower === 'own' ? 'เงินหมุนเวียน' : name(l.borrower) || 'ไม่ระบุ'} · {fmtDate(l.date)} {l.purpose ? ` · ${l.purpose}` : ''}</>
          : <>⚠️ <b>ยืมมา {fmtBaht(l.principal, { dec: false })} บาท · ค้างคืน {fmtBaht(loanBalance(l), { dec: false })}</b> จาก {lenderLabel(l, name)} · เมื่อ {fmtDate(l.date)} {l.purpose ? ` · ${l.purpose}` : ''}</>}</p>
      ))}
    </div>
  )
}
