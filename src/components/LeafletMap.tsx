import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { HUAHIN, type Coord } from '../lib/geo'

export interface MapPin { id: string; lat: number; lng: number; label: string; sub?: string }

const dot = (cls = '') => L.divIcon({ className: '', html: `<span class="mapdot${cls}"></span>`, iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -20] })

/**
 * แผนที่ (OpenStreetMap + Leaflet): แสดงหมุดหลายจุด (pins) หรือโหมดเลือกจุด (onPick — แตะ/ลากหมุดเพื่อบันทึกพิกัด)
 * โหลดแบบ lazy จึงไม่หนักหน้าอื่น · ส่งเฉพาะตำแหน่งกระเบื้องแผนที่ไปยังเซิร์ฟเวอร์แผนที่ ไม่ส่งพิกัดหมุดของสมาชิก
 */
export default function LeafletMap({ pins = [], pick, onPick, height = 320, label }: { pins?: MapPin[]; pick?: Coord | null; onPick?: (c: Coord) => void; height?: number; label: string }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const pickMark = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!box.current) return
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([HUAHIN.lat, HUAHIN.lng], 12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    if (onPickRef.current) m.on('click', (e: L.LeafletMouseEvent) => onPickRef.current?.({ lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 }))
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(box.current)
    return () => { ro.disconnect(); m.remove(); map.current = null; layer.current = null; pickMark.current = null }
  }, [])

  // หมุดหลายจุด
  useEffect(() => {
    const g = layer.current, m = map.current
    if (!g || !m) return
    g.clearLayers()
    for (const p of pins) {
      const el = document.createElement('div')
      const b = document.createElement('b'); b.textContent = p.label; el.appendChild(b)
      if (p.sub) { el.appendChild(document.createElement('br')); const s = document.createElement('span'); s.textContent = p.sub; el.appendChild(s) }
      L.marker([p.lat, p.lng], { icon: dot(), title: p.label }).bindPopup(el).addTo(g)
    }
    if (pins.length > 1) m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [24, 24], maxZoom: 17 })
    else if (pins.length === 1) m.setView([pins[0].lat, pins[0].lng], 16)
  }, [pins])

  // โหมดเลือกจุด
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!pick) { pickMark.current?.remove(); pickMark.current = null; return }
    if (!pickMark.current) {
      const mk = L.marker([pick.lat, pick.lng], { icon: dot(' mapdot--pick'), draggable: !!onPickRef.current }).addTo(m)
      mk.on('dragend', () => { const p = mk.getLatLng(); onPickRef.current?.({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 }) })
      pickMark.current = mk
    } else pickMark.current.setLatLng([pick.lat, pick.lng])
    m.setView([pick.lat, pick.lng], Math.max(m.getZoom(), 16))
  }, [pick?.lat, pick?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="leafletbox" style={{ height }} role="application" aria-label={label} data-pins={pins.length} />
}
