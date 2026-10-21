/** พิกัดบนแผนที่ (ละติจูด/ลองจิจูด องศาทศนิยม) */
export interface Coord { lat: number; lng: number }
/** หัวหิน — จุดกลางแผนที่เมื่อยังไม่มีพิกัดใด ๆ */
export const HUAHIN: Coord = { lat: 12.5684, lng: 99.9577 }

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
const round = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * อ่านพิกัดจากข้อความที่ผู้ใช้วาง: “12.5684, 99.9577” · “12.5684 99.9577” · ลิงก์ Google Maps (…/@12.5684,99.9577,17z · ?q=12.5684,99.9577 · !3d12.5684!4d99.9577) · ลิงก์ OpenStreetMap (#map=17/12.5684/99.9577 · mlat/mlon)
 * ไม่ใช่พิกัดที่ถูกต้อง = null
 */
export function parseCoords(text: string): Coord | null {
  const t = decodeURIComponent(text.trim().replace(/%(?![0-9a-f]{2})/gi, '%25'))
  if (!t) return null
  const pairs: RegExp[] = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // google @lat,lng
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // google place data
    /[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // google ?q= / ll=
    /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/, // osm #map=z/lat/lng
    /mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/, // osm marker
    /^\s*\(?(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\)?\s*$/, // ล้วน
  ]
  for (const re of pairs) {
    const m = t.match(re)
    if (m) { const lat = Number(m[1]), lng = Number(m[2]); if (valid(lat, lng)) return { lat: round(lat), lng: round(lng) } }
  }
  return null
}
export const formatCoord = (c: Coord) => `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`
export const hasCoord = (m: { lat?: number; lng?: number }): m is { lat: number; lng: number } => typeof m.lat === 'number' && typeof m.lng === 'number' && valid(m.lat, m.lng)
/** ลิงก์เปิดพิกัดใน Google Maps */
export const mapsLink = (c: Coord) => `https://www.google.com/maps?q=${c.lat},${c.lng}`
