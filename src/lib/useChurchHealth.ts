import { useMemo } from 'react'
import { ownFrom } from './balances'
import { healthOf, type Health } from './churchHealth'
import { addDays, todayISO } from './money'
import { useBalances } from './useBalances'
import { computeLedger } from './weekLedger'

/** สถานะการเงินปัจจุบัน: เงินหมุนเวียน + รายจ่าย/สุทธิย้อนหลัง (ใช้ข้อมูลชุดเดียวกับแถบเงินคริสตจักร) */
export function useChurchHealth(year: number): { health: Health; own: number; fund: number } {
  const { balances: b, input, opening } = useBalances(year)
  return useMemo(() => {
    const today = todayISO(), floor = ownFrom(opening)
    const flow = (from: string, to: string) => {
      const L = computeLedger({ ...input, range: { from: from < floor ? floor : from, to } })
      return { inn: L.inSum.cash + L.inSum.transfer, out: L.outSum.cash + L.outSum.transfer + L.outSum.pending }
    }
    const w8 = flow(addDays(today, -55), today), w4 = flow(addDays(today, -27), today), p4 = flow(addDays(today, -55), addDays(today, -28))
    return { health: healthOf(b.own.balance, w8.out, w4.inn - w4.out, p4.inn - p4.out), own: b.own.balance, fund: b.fundTotal }
  }, [b, input, opening])
}
