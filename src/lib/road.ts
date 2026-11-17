import { useEffect, useState } from 'react'
import type { Coord } from './geo'

// ---- ระยะตามถนนจริง: OSRM (OpenStreetMap routing · ฟรี ไม่ต้องใช้คีย์) · ล้มเหลว/ออฟไลน์ = ใช้เส้นตรงแทน ----
export interface Road { m: number; s: number; g: Coord[] }
export const roadCache = new Map<string, Road>()
export const keyOf = (a: Coord, b: Coord) => `${a.lat},${a.lng}>${b.lat},${b.lng}`
const inflight = new Map<string, Promise<Road | null>>()
/** ขอระยะถนน (ผู้เรียกหลายที่พร้อมกันใช้คำขอเดียวกัน ไม่ยิง OSRM ซ้ำ) */
export function fetchRoad(a: Coord, b: Coord): Promise<Road | null> {
  const k = keyOf(a, b)
  const p = inflight.get(k) ?? fetchRoadRaw(a, b).finally(() => inflight.delete(k))
  inflight.set(k, p)
  return p
}
async function fetchRoadRaw(a: Coord, b: Coord): Promise<Road | null> {
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)
    if (!r.ok) return null
    const j = await r.json() as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
    const x = j.routes?.[0]
    return x ? { m: Math.round(x.distance), s: Math.round(x.duration), g: x.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) } : null
  } catch { return null }
}
export function useRoadLegs(pairs: [Coord, Coord][]) {
  const [, bump] = useState(0)
  const sig = pairs.map(([a, b]) => keyOf(a, b)).join('|')
  useEffect(() => {
    let dead = false
    void (async () => {
      let changed = false
      await Promise.all(pairs.map(async ([a, b]) => {
        const k = keyOf(a, b)
        if (roadCache.has(k)) return
        if (a.lat === b.lat && a.lng === b.lng) { roadCache.set(k, { m: 0, s: 0, g: [a, b] }); changed = true; return }
        const r = await fetchRoad(a, b)
        if (r) { roadCache.set(k, r); changed = true }
      }))
      if (changed && !dead) bump((n) => n + 1)
    })()
    return () => { dead = true }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  return (a: Coord, b: Coord) => roadCache.get(keyOf(a, b))
}
