import { describe, expect, it } from 'vitest'
import { formatCoord, hasCoord, mapsLink, parseCoords } from './geo'

describe('พิกัดบ้านสมาชิก', () => {
  it('อ่านพิกัดล้วนหลายรูปแบบ', () => {
    expect(parseCoords('12.5684, 99.9577')).toEqual({ lat: 12.5684, lng: 99.9577 })
    expect(parseCoords(' 12.5684 99.9577 ')).toEqual({ lat: 12.5684, lng: 99.9577 })
    expect(parseCoords('(12.5684;99.9577)')).toEqual({ lat: 12.5684, lng: 99.9577 })
    expect(parseCoords('-33.8688, 151.2093')).toEqual({ lat: -33.8688, lng: 151.2093 })
  })
  it('อ่านจากลิงก์ Google Maps / OpenStreetMap', () => {
    expect(parseCoords('https://www.google.com/maps/place/Hua+Hin/@12.5684,99.9577,17z/data=!3m1')).toEqual({ lat: 12.5684, lng: 99.9577 })
    expect(parseCoords('https://maps.google.com/?q=12.57,99.96')).toEqual({ lat: 12.57, lng: 99.96 })
    expect(parseCoords('https://www.google.com/maps/place/x/data=!4m2!3d12.5611!4d99.9505')).toEqual({ lat: 12.5611, lng: 99.9505 })
    expect(parseCoords('https://www.openstreetmap.org/#map=17/12.5684/99.9577')).toEqual({ lat: 12.5684, lng: 99.9577 })
  })
  it('ปฏิเสธค่าที่ไม่ใช่พิกัด', () => {
    for (const bad of ['', 'หัวหิน', '91, 100', '12.5, 181', '0, 0', '12.5']) expect(parseCoords(bad)).toBeNull()
  })
  it('ตรวจว่ามีพิกัดที่ใช้ได้ · รูปแบบข้อความ · ลิงก์', () => {
    expect(hasCoord({ lat: 12.5, lng: 99.9 })).toBe(true)
    expect(hasCoord({ lat: 12.5 })).toBe(false)
    expect(hasCoord({ lat: 0, lng: 0 })).toBe(false)
    expect(formatCoord({ lat: 12.5684, lng: 99.9577 })).toBe('12.568400, 99.957700')
    expect(mapsLink({ lat: 12.5, lng: 99.9 })).toBe('https://www.google.com/maps?q=12.5,99.9')
  })
})
