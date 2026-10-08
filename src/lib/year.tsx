import { createContext, useContext } from 'react'
import { todayISO, yearOf } from './money'

/** ปีบัญชีที่เลือกอยู่ (ค.ศ.) — ปีบัญชี = ปีปฏิทิน */
export const YearContext = createContext<{ year: number; setYear: (y: number) => void }>({ year: yearOf(todayISO()), setYear: () => undefined })
export const useYear = () => useContext(YearContext)

const KEY = 'acct.year'
export function initialYear(): number {
  try {
    const v = Number(localStorage.getItem(KEY))
    if (v >= 2000 && v <= 2100) return v
  } catch { /* ignore */ }
  return yearOf(todayISO())
}
export function saveYear(y: number) { try { localStorage.setItem(KEY, String(y)) } catch { /* ignore */ } }
