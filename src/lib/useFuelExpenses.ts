import { useMemo } from 'react'
import { useFuelPaid, useLiveActs, useSettings, useTripLogs, useVisits } from './data'
import { buildTrips, fuelCharges, fuelExpenses, tripChain, tripMeters } from './fuelCharges'
import { useRoadLegs } from './road'
import type { Coord } from './geo'
import type { ExpenseEntry } from './types'

/**
 * รายจ่ายค่าน้ำมันอัตโนมัติ (ข้อมูลจริง ไม่รวมโหมดทดลอง) ของปี from–to: คำนวณจากการเช็คอินเยี่ยม/กิจกรรม/เที่ยวพิเศษ ×
 * อัตราบาท/กม.ของรถแต่ละคัน → 1 แถวต่อ (เจ้าของรถส่วนตัว, สัปดาห์, เดือน) · ใส่ต่อท้ายรายจ่ายของปีเพื่อให้ใบเบิก/ต้องเบิก/ใบสรุปนับรวมเอง
 */
export function useFuelExpenses(fromYear: number, toYear = fromYear): ExpenseEntry[] {
  const visits = useVisits(true, '')
  const acts = useLiveActs('')
  const tl = useTripLogs('')
  const st = useSettings().settings
  const paid = useFuelPaid()
  const church: Coord | null = typeof st.churchLat === 'number' && typeof st.churchLng === 'number' ? { lat: st.churchLat, lng: st.churchLng } : null
  const trips = useMemo(() => buildTrips(visits.list, acts.list, `${fromYear}-01-01`, `${toYear}-12-31`), [visits.list, acts.list, fromYear, toYear])
  // เฉพาะรถส่วนตัวต้องรู้ระยะตามถนน (รถคริสตจักรไม่ต้องคำนวณ) — ดึงเฉพาะที่ยังไม่มีในแคช
  const pairs = useMemo(() => trips.slice(-300).flatMap((t) => { const c = tripChain(t.pts, church); return c.slice(1).map((p, i) => [c[i], p] as [Coord, Coord]) }), [trips, church?.lat, church?.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  const road = useRoadLegs(pairs)
  const paidMap = useMemo(() => Object.fromEntries(paid.items.filter((x) => !x.deleted).map((x) => [x.id, x.paidDate])), [paid.items])
  const rows = fuelExpenses(fuelCharges({ trips: trips.map((t) => ({ date: t.date, vehicle: t.vehicle, meters: tripMeters(t.pts, church, road) })), tripLogs: tl.list, settings: st }), paidMap)
  // เสถียรตามเนื้อหา — ไม่ให้ผู้ใช้ (useMemo ของยอดเงิน) คำนวณใหม่ทุกครั้งที่วาด
  const sig = rows.map((r) => `${r.id}|${r.amount}|${r.status}|${r.paidDate ?? ''}|${r.date}`).join(';')
  return useMemo(() => rows, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
}
