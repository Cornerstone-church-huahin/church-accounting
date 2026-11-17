import { describe, expect, it } from 'vitest'
import { buildTrips, fuelCharges, fuelExpenses, tripMeters } from './fuelCharges'

const S = { vehicleFuel: { pickup: 3, jazz: 2.5, suv: 3.5, van: 3.8 }, vehicleOwner: { pickup: { kind: 'personal' as const, name: 'อ.กฤต' }, jazz: { kind: 'personal' as const, name: 'อ.ดารา' }, suv: { kind: 'personal' as const, name: 'อ.พิชิต' }, van: { kind: 'church' as const } }, fuelPerKm: 3.5 }

describe('fuelCharges', () => {
  it('รอบเดินทางแยกตามวัน/รถ และแยกเมื่อห่างเกิน 3 ชม.', () => {
    const v = (date: string, vehicle: string, at: number) => ({ date, vehicle, checkin: { lat: 12.5, lng: 99.9, at } })
    const t = buildTrips([v('2026-11-10', 'pickup', 1000), v('2026-11-10', 'pickup', 2000), v('2026-11-10', 'pickup', 1000 + 4 * 3600e3), v('2026-11-10', 'none', 5)], [], '2026-11-01', '2026-11-30')
    expect(t.filter((x) => x.vehicle === 'pickup')).toHaveLength(2)
    expect(t.find((x) => x.vehicle === 'none')).toBeUndefined()
  })
  it('ระยะรอบ = คริสตจักร→จุด→กลับ ใช้ถนนจริงถ้ามี', () => {
    const ch = { lat: 12.5, lng: 99.9 }, p = { lat: 12.6, lng: 99.9 }
    expect(tripMeters([p], ch, () => ({ m: 5000 }))).toBe(10000)
    expect(tripMeters([p], ch, () => undefined)).toBeGreaterThan(20000)
  })
  it('รถคริสตจักรและไม่ระบุรถไม่นับ · รถส่วนตัวคิดตามอัตรา และรวมเป็นแถวเดียวต่อคนต่อสัปดาห์', () => {
    const ch = fuelCharges({ trips: [{ date: '2026-11-09', vehicle: 'pickup', meters: 10000 }, { date: '2026-11-10', vehicle: 'pickup', meters: 6000 }, { date: '2026-11-10', vehicle: 'van', meters: 99000 }, { date: '2026-11-10', vehicle: '', meters: 5000 }, { date: '2026-11-11', vehicle: 'jazz', meters: 4000 }], tripLogs: [{ date: '2026-11-12', vehicle: 'pickup', km: 10, deleted: false }], settings: S })
    expect(ch.map((c) => c.owner).sort()).toEqual(['อ.กฤต', 'อ.กฤต', 'อ.กฤต', 'อ.ดารา'])
    const ex = fuelExpenses(ch)
    expect(ex).toHaveLength(2)
    const k = ex.find((e) => e.biller === 'อ.กฤต')!
    expect(k.amount).toBe(Math.round((16 * 3 + 10 * 3) * 100)) // 78 บาท
    expect(k.status).toBe('open'); expect(k.channel).toBe('bill')
    expect(ex.find((e) => e.biller === 'อ.ดารา')!.amount).toBe(1000) // 4กม.×2.5=10บาท
  })
  it('สัปดาห์คร่อมเดือนแยกแถวตามเดือน · จ่ายคืนแล้วเป็น paid', () => {
    const ch = fuelCharges({ trips: [{ date: '2026-11-30', vehicle: 'suv', meters: 10000 }, { date: '2026-12-01', vehicle: 'suv', meters: 10000 }], tripLogs: [], settings: S })
    const ex = fuelExpenses(ch, { [fuelExpenses(ch)[0].id]: '2026-12-02' })
    expect(ex).toHaveLength(2)
    expect(ex[0].status).toBe('paid'); expect(ex[0].paidDate).toBe('2026-12-02'); expect(ex[1].status).toBe('open')
  })
})

import { maskExpenses, maskNoticeOut, maskPending } from './maskPay'
import { FUEL_DESC, FUEL_LABEL } from './fuelCharges'
describe('ใบประกาศ: ค่าน้ำมันรวมเป็นบรรทัดเดียว ไม่มีชื่อ', () => {
  const out = [
    { key: 'e:fuel:a', date: '2026-11-10', desc: FUEL_DESC, amount: 5000, by: 'อ.กฤต' },
    { key: 'e:fuel:b', date: '2026-11-11', desc: FUEL_DESC, amount: 3000, by: 'อ.ดารา' },
    { key: 'e:x', date: '2026-11-12', desc: 'ค่าอาหาร', amount: 100, by: 'อ.สายฝน' },
  ]
  it('maskNoticeOut', () => {
    const m = maskNoticeOut(out)
    expect(m).toHaveLength(2)
    const f = m.find((x) => x.desc === FUEL_LABEL)!
    expect(f.amount).toBe(8000); expect(f.by).toBeUndefined()
  })
  it('maskPending', () => {
    const m = maskPending([{ desc: FUEL_DESC, person: 'อ.กฤต', kind: 'bill', amount: 5000 }, { desc: FUEL_DESC, person: 'อ.ดารา', kind: 'bill', amount: 3000 }])
    expect(m).toEqual([{ desc: FUEL_LABEL, person: '', kind: 'bill', amount: 8000 }])
  })
  it('maskExpenses', () => {
    const e = (id: string, amount: number) => ({ id, updated: 1, channel: 'bill' as const, date: '2026-11-10', amount, desc: FUEL_DESC, status: 'open' as const })
    const m = maskExpenses([e('fuel:a', 5000), e('fuel:b', 3000)])
    expect(m).toHaveLength(1); expect(m[0].amount).toBe(8000); expect(m[0].desc).toBe(FUEL_LABEL)
  })
})
