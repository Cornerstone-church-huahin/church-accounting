import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { HUAHIN, type Coord } from '../lib/geo'

export interface MapPin { id: string; lat: number; lng: number; label: string; sub?: string; /** สีหมุด (ไม่ใส่ = ชมพูมาตรฐาน) */ color?: string; /** ข้อความในหมุด เช่น ลำดับจุด หรือ ⛪ */ badge?: string; /** ขนาดหมุดกลม (px · ค่าเริ่มต้น 30) — ใช้ทำหมุดเด่น เช่น คริสตจักร */ size?: number }
export interface MapLine { /** เส้นทางแต่ละช่วง (จุดตามถนน หรือเส้นตรง 2 จุด) */ segments: Coord[][]; /** สีเส้นของแต่ละช่วง (ไม่ใส่ = น้ำเงิน) */ colors?: string[]; /** ป้ายระยะ/เวลาวางบนเส้น */ labels?: { at: Coord; text: string }[] }

const badgeIcon = (color: string, badge: string, size = 30) => L.divIcon({ className: '', html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${color};color:#fff;font:700 ${Math.round(size / 2)}px/1 sans-serif;border:${size > 34 ? 4 : 3}px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.7)">${badge}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -(size / 2 + 2)] })
const dot = (cls = '') => L.divIcon({ className: '', html: `<span class="mapdot${cls}"></span>`, iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -20] })

/**
 * แผนที่ (OpenStreetMap + Leaflet): แสดงหมุดหลายจุด (pins) หรือโหมดเลือกจุด (onPick — แตะ/ลากหมุดเพื่อบันทึกพิกัด)
 * โหลดแบบ lazy จึงไม่หนักหน้าอื่น · ส่งเฉพาะตำแหน่งกระเบื้องแผนที่ไปยังเซิร์ฟเวอร์แผนที่ ไม่ส่งพิกัดหมุดของสมาชิก
 */
export default function LeafletMap({ pins = [], line, pick, onPick, height = 320, label, noLinks }: { pins?: MapPin[]; /** เส้นทาง (สีน้ำเงินแบบ Google Maps) */ line?: MapLine; pick?: Coord | null; onPick?: (c: Coord) => void; height?: number; label: string; /** ไม่มีลิงก์ออกนอกแอป (ข้อความอ้างอิงแผนที่เป็นตัวอักษรล้วน) */ noLinks?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const pickMark = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!box.current) return
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([HUAHIN.lat, HUAHIN.lng], 12)
    const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: noLinks ? '© OpenStreetMap' : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' })
    // ดาวเทียม (Esri World Imagery · ไม่ต้องใช้คีย์) — สลับด้วยปุ่มมุมขวาบน
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' })
    sat.addTo(m) // เริ่มที่มุมมองดาวเทียมเสมอ
    L.control.layers({ '🗺️ แผนที่ถนน': street, '🛰️ ดาวเทียม': sat }, undefined, { position: 'topright', collapsed: height < 250 }).addTo(m)
    if (noLinks) m.attributionControl.setPrefix(false)
    layer.current = L.layerGroup().addTo(m)
    if (onPickRef.current) m.on('click', (e: L.LeafletMouseEvent) => onPickRef.current?.({ lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 }))
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(box.current)
    return () => { ro.disconnect(); m.stop(); m.remove(); map.current = null; layer.current = null; pickMark.current = null }
  }, [])

  // หมุดหลายจุด
  useEffect(() => {
    const g = layer.current, m = map.current
    if (!g || !m) return
    g.clearLayers()
    for (const p of pins) {
      const el = document.createElement('div')
      const b = document.createElement('b'); b.textContent = p.label; el.appendChild(b)
      if (p.sub) { el.appendChild(document.createElement('br')); const s = document.createElement('span'); s.style.whiteSpace = 'pre-line'; s.textContent = p.sub; el.appendChild(s) }
      L.marker([p.lat, p.lng], { icon: p.color || p.badge ? badgeIcon(p.color ?? '#c2255c', p.badge ?? '', p.size) : dot(), title: p.label }).bindPopup(el).addTo(g)
    }
    if (pins.length > 1) m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [24, 24], maxZoom: 17, animate: false })
    else if (pins.length === 1) m.setView([pins[0].lat, pins[0].lng], 16, { animate: false })
  }, [pins])

  // เส้นทาง: เส้นน้ำเงินหนา + ป้ายระยะกลางแต่ละช่วง
  useEffect(() => {
    const m = map.current
    if (!m || !line || line.segments.length === 0) return
    const g = L.layerGroup().addTo(m)
    line.segments.forEach((seg, si) => {
      const pts = seg.map((c) => [c.lat, c.lng] as [number, number])
      L.polyline(pts, { color: '#ffffff', weight: 9, opacity: 0.9, lineJoin: 'round' }).addTo(g) // ขอบขาวให้เด่นบนภาพดาวเทียม
      L.polyline(pts, { color: line.colors?.[si] ?? '#1a73e8', weight: 5, opacity: 1, lineJoin: 'round' }).addTo(g)
    })
    line.labels?.forEach(({ at, text }) => {
      L.marker([at.lat, at.lng], { interactive: false, icon: L.divIcon({ className: '', html: `<span style="display:inline-block;transform:translate(-50%,-50%);background:#fff;color:#1a3b8f;font:700 12px/1 sans-serif;padding:3px 6px;border-radius:10px;border:1.5px solid #1a73e8;white-space:nowrap">${text}</span>`, iconSize: [0, 0] }) }).addTo(g)
    })
    return () => { g.remove() }
  }, [line])

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
    m.setView([pick.lat, pick.lng], Math.max(m.getZoom(), 16), { animate: false })
  }, [pick?.lat, pick?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="leafletbox" style={{ height }} role="application" aria-label={label} data-pins={pins.length} />
}
