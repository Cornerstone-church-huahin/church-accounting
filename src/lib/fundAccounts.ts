import { addDays } from './money'
import { isFundType } from './funds'
import { lineDate, typeFromNote, unknownBankIn } from './passbook'
import type { ExpenseEntry, IncomeEntry, IncomeType, Loan, Opening, PassbookLine, Round } from './types'

export interface FundMove { key: string; date: string; label: string; /** + เข้า · − ออก */ amount: number }
export interface FundAccount { id: string; name: string; opening: number; moves: FundMove[]; moneyIn: number; moneyOut: number; balance: number }

/**
 * บัญชีของแต่ละกองทุน: ยอดตั้งต้น (ตั้งในตั้งค่า ครั้งเดียว) + เงินถวายกองทุนนั้น − รายจ่ายที่เลือก "จ่ายจากกองทุน"
 * นับเฉพาะรายการหลังวันตัดยอดตั้งต้น · เรียงจากใหม่ไปเก่า พร้อมยอดคงเหลือสะสม ณ รายการนั้น
 */
export function fundAccounts(a: { types: IncomeType[]; opening?: Opening; income: IncomeEntry[]; rounds: Round[]; expenses: ExpenseEntry[]; passbook?: PassbookLine[]; /** เงินยืมระหว่างกองทุน: กองทุนที่ให้ยืมถูกหักออก กองทุนที่ยืมมาได้เงินสดเข้า (หนี้แสดงเป็นแถบเตือน ไม่หักลบ) */ loans?: Loan[] }): FundAccount[] {
  const from = a.opening?.date ? addDays(a.opening.date, 1) : '0000-00-00'
  const funds = a.types.filter((t) => isFundType(t))
  const bankIn = unknownBankIn(a.passbook ?? [], a.income)
  const nm = (id?: string) => (id === 'own' ? 'เงินหมุนเวียน' : a.types.find((x) => x.id === id)?.name ?? 'กองทุนอื่น')
  return funds.map((t) => {
    const mv: FundMove[] = []
    for (const r of a.rounds) { const v = r.lines[t.id]; if (v > 0 && r.date >= from) mv.push({ key: `rd:${r.id}`, date: r.date, label: `นับเงินถวาย${r.envelopes?.[t.id] ? ` · ${r.envelopes[t.id]} ซอง` : ''}`, amount: v }) }
    for (const x of a.income) if (!x.deleted && !x.roundId && !x.unknown && x.typeId === t.id && x.date >= from) mv.push({ key: `in:${x.id}`, date: x.date, label: `${x.method === 'transfer' ? 'โอน' : 'เงินสด'}${x.memberNo ? ` · ${x.memberNo}` : ''}${x.note && x.source !== 'slip' ? ` · ${x.note}` : ''}`, amount: x.amount })
    for (const l of bankIn) if (typeFromNote(l.desc, a.types) === t.id && lineDate(l) >= from) mv.push({ key: `pb:${l.id}`, date: lineDate(l), label: `โอนเข้าบัญชี (สมุด)${l.desc ? ` · ${l.desc}` : ''}`, amount: l.amount })
    for (const x of a.expenses) if (!x.deleted && x.fundId === t.id && x.date >= from) mv.push({ key: `ex:${x.id}`, date: x.date, label: `จ่าย · ${x.desc}${x.status === 'open' ? ' (ค้างจ่าย)' : ''}`, amount: -x.amount })
    // เงินยืมระหว่างกองทุน (ผู้ให้ยืมเป็นกองทุน) — เงินยืมก่อนวันตัดยอดถือว่ารวมอยู่ในยอดตั้งต้นแล้ว
    for (const l of a.loans ?? []) {
      if (l.deleted || l.lender.kind !== 'fund' || l.date < from) continue
      const note = l.purpose ? ` · ${l.purpose}` : ''
      if (l.lender.fundId === t.id) {
        mv.push({ key: `ln:${l.id}`, date: l.date, label: `ให้ ${nm(l.borrower)} ยืม${note}`, amount: -l.principal })
        for (const r of l.repayments) mv.push({ key: `lr:${r.id}`, date: r.date, label: `รับคืนจาก ${nm(l.borrower)}`, amount: r.amount })
      }
      if (l.borrower === t.id) {
        mv.push({ key: `lb:${l.id}`, date: l.date, label: `ยืมจาก ${nm(l.lender.fundId)}${note}`, amount: l.principal })
        for (const r of l.repayments) mv.push({ key: `lq:${r.id}`, date: r.date, label: `คืนเงินยืมให้ ${nm(l.lender.fundId)}`, amount: -r.amount })
      }
    }
    mv.sort((p, q) => p.date.localeCompare(q.date) || p.key.localeCompare(q.key))
    const opening = a.opening?.funds?.[t.id] ?? 0
    const moneyIn = mv.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0)
    const moneyOut = mv.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0)
    return { id: t.id, name: t.name, opening, moves: mv, moneyIn, moneyOut, balance: opening + moneyIn - moneyOut }
  })
}

/** รายการเคลื่อนไหวเรียงใหม่→เก่า พร้อมยอดคงเหลือสะสม ณ รายการนั้น */
export function withRunning(f: FundAccount): (FundMove & { balance: number })[] {
  let bal = f.opening
  return f.moves.map((m) => ({ ...m, balance: (bal += m.amount) })).reverse()
}
