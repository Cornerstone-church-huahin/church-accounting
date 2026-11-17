import { distanceM, type Coord } from './geo'
import { monthShort, sheetSunday } from './money'
import { NO_CAR, actVehicle, fuelBaht, vehicleOf, vehicleOwner, vehicleRate } from './vehicles'
import type { ActivityLog, ExpenseEntry, Settings, TripLog, Visit } from './types'

/** หมวด/ข้อความของรายจ่ายค่าน้ำมันที่ระบบสร้างให้อัตโนมัติ (จ่ายคืนเจ้าของรถส่วนตัวตามระยะจริง) */
export const FUEL_CAT = '__fuel'
/** ข้อความรายการของเจ้าของรถแต่ละคน เช่น “ค่าน้ำมัน อ.พิชิต (10–13 พ.ย.)” — ใส่วันที่เดินทางให้ตรวจเทียบกับเส้นทางได้ */
export const fuelDesc = (owner: string, days?: string): string => `ค่าน้ำมัน ${owner}${days ? ` (${days})` : ''}`
/** วันที่เดินทางในเดือนเดียวกัน → “10–13, 15 พ.ย.” */
export function daysText(dates: string[]): string {
  const ds = [...new Set(dates)].sort()
  if (ds.length === 0) return ''
  const m = Number(ds[0].slice(5, 7)), n = ds.map((d) => Number(d.slice(8)))
  const runs: string[] = []
  for (let i = 0; i < n.length; ) { let j = i; while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++; runs.push(j - i >= 2 ? `${n[i]}–${n[j]}` : n.slice(i, j + 1).join(', ')); i = j + 1 }
  return `${runs.join(', ')} ${monthShort(m)}`
}
export const FUEL_LABEL = 'ค่าน้ำมัน กิจกรรมและเยี่ยมสมาชิก'
/** รายการอัตโนมัติ: รหัส fuel:… (ใบสรุปใช้ key e:fuel:…) หรือแถว “ต้องเบิก” ที่ระบุ fuel */
export const isFuelAuto = (x: { id?: string; key?: string; derived?: string; fuel?: boolean }): boolean => !!(x.derived === 'fuel' || x.fuel || x.id?.startsWith('fuel:') || x.key?.startsWith('e:fuel:'))

/** จุดเช็คอินห่างกันเกิน 3 ชม. = คนละรอบ (กลับคริสตจักรแล้วออกใหม่) */
export const GAP_MS = 3 * 3600 * 1000
export interface RawTrip { date: string; vehicle: string; pts: Coord[] }

/** รอบเดินทาง = (วัน, รถ): จุดเช็คอินของการเยี่ยม + กิจกรรมที่ทำแล้วและเช็คอิน เรียงเวลา แยกรอบเมื่อห่าง > 3 ชม. */
export function buildTrips(visits: Pick<Visit, 'date' | 'vehicle' | 'checkin'>[], acts: Pick<ActivityLog, 'date' | 'vehicle' | 'checkin' | 'at'>[], from: string, to: string): RawTrip[] {
  const byKey = new Map<string, Map<number, Coord>>()
  const put = (date: string, vehicle: string, at: number, c: Coord) => { const key = `${date}|${vehicle}`; const m = byKey.get(key) ?? new Map<number, Coord>(); m.set(at, c); byKey.set(key, m) }
  for (const v of visits) {
    if (!v.checkin || v.date < from || v.date > to || v.vehicle === NO_CAR) continue
    put(v.date, v.vehicle ?? '', v.checkin.at, { lat: v.checkin.lat, lng: v.checkin.lng })
  }
  for (const a of acts) {
    if (!a.checkin || actVehicle(a) === NO_CAR || a.date < from || a.date > to) continue
    put(a.date, a.vehicle ?? '', a.at, { lat: a.checkin.lat, lng: a.checkin.lng })
  }
  const out: RawTrip[] = []
  for (const [key, m] of byKey) {
    const [date, vehicle] = key.split('|')
    const stops = [...m.entries()].sort((a, b) => a[0] - b[0])
    let cur: [number, Coord][] = []
    for (const s of stops) { if (cur.length && s[0] - cur[cur.length - 1][0] > GAP_MS) { out.push({ date, vehicle, pts: cur.map((x) => x[1]) }); cur = [] } cur.push(s) }
    if (cur.length) out.push({ date, vehicle, pts: cur.map((x) => x[1]) })
  }
  return out
}

/** เส้นของรอบ: คริสตจักร → จุด → กลับคริสตจักร (ไม่มีพิกัดคริสตจักร = เฉพาะจุด) */
export const tripChain = (pts: Coord[], church: Coord | null): Coord[] => (church ? [church, ...pts, church] : pts)
/** ระยะรอบ (เมตร) ตามถนนจริงถ้ามี ไม่มี = เส้นตรง */
export function tripMeters(pts: Coord[], church: Coord | null, road: (a: Coord, b: Coord) => { m: number } | undefined): number {
  const c = tripChain(pts, church)
  return c.slice(1).reduce((a, p, i) => a + (road(c[i], p)?.m ?? distanceM(c[i], p)), 0)
}

export interface FuelCharge { date: string; vehicle: string; owner: string; meters: number; /** สตางค์ (ปัดเป็นบาทเต็มต่อรอบแล้ว) */ amount: number }

/** ค่าน้ำมันที่ต้องจ่ายคืนเจ้าของรถส่วนตัว (รถคริสตจักรและรถที่ไม่ระบุคัน ไม่นับ) */
export function fuelCharges(a: { trips: { date: string; vehicle: string; meters: number }[]; tripLogs: Pick<TripLog, 'date' | 'vehicle' | 'km' | 'deleted'>[]; settings: Pick<Settings, 'vehicleFuel' | 'vehicleOwner' | 'fuelPerKm'> }): FuelCharge[] {
  const base = typeof a.settings.fuelPerKm === 'number' ? a.settings.fuelPerKm : 3.5
  const out: FuelCharge[] = []
  const add = (date: string, vehicle: string, meters: number) => {
    if (!vehicle || vehicle === NO_CAR || meters <= 0) return
    const o = vehicleOwner(a.settings.vehicleOwner, vehicle)
    if (o.kind === 'church') return
    const owner = o.name?.trim() || vehicleOf(vehicle)?.name || vehicle
    out.push({ date, vehicle, owner, meters, amount: fuelBaht(meters, vehicleRate(a.settings.vehicleFuel, vehicle, base)) * 100 })
  }
  for (const t of a.trips) add(t.date, t.vehicle, t.meters)
  for (const x of a.tripLogs) if (!x.deleted) add(x.date, x.vehicle, x.km * 1000)
  return out
}

/**
 * รายจ่ายอัตโนมัติ: 1 แถวต่อ (เจ้าของรถ, สัปดาห์ใบวันอาทิตย์, เดือน) ปัดเป็นบาทเต็ม
 * ยังไม่จ่ายคืน = ค้างจ่าย/รอคืนเงิน (นับเป็นรายจ่ายและขึ้น “ต้องเบิก”) · จ่ายคืนแล้ว (paid มีวันที่) = จ่ายแล้ว
 */
export function fuelExpenses(charges: FuelCharge[], paid: Record<string, string> = {}): ExpenseEntry[] {
  const g = new Map<string, { owner: string; sunday: string; ym: string; last: string; amount: number; days: string[] }>()
  for (const c of charges) {
    const sunday = sheetSunday(c.date), ym = c.date.slice(0, 7)
    const id = `fuel:${c.owner}:${sunday}:${ym}`
    const x = g.get(id) ?? { owner: c.owner, sunday, ym, last: c.date, amount: 0, days: [] }
    x.days.push(c.date); x.amount += c.amount; if (c.date > x.last) x.last = c.date; g.set(id, x)
  }
  const out: ExpenseEntry[] = []
  for (const [id, x] of g) {
    const amount = Math.round(x.amount / 100) * 100
    if (amount <= 0) continue
    const pd = paid[id]
    out.push({ id, updated: 1, channel: 'bill', date: x.last, amount, desc: fuelDesc(x.owner, daysText(x.days)), catId: FUEL_CAT, biller: x.owner, who: x.owner, derived: 'fuel' as const, status: pd ? 'paid' : 'open', ...(pd ? { paidDate: pd, method: 'cash' as const } : {}) })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}
