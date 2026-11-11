/** ยานพาหนะของทีมเยี่ยม (แท็บทดลอง): แต่ละคันมีสีเส้นทางของตัวเอง */
export interface Vehicle { id: string; name: string; color: string; img: string }
const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './'
export const VEHICLES: Vehicle[] = [
  { id: 'pickup', name: 'รถกระบะส้ม', color: '#e8710a', img: `${base}vehicles/pickup.jpg` },
  { id: 'jazz', name: 'รถเก๋งขาว (แจ๊ซ)', color: '#1a73e8', img: `${base}vehicles/jazz.jpg` },
  { id: 'van', name: 'รถตู้ขาว', color: '#8e24aa', img: `${base}vehicles/van.jpg` },
  { id: 'suv', name: 'รถ SUV แดง', color: '#d32f2f', img: `${base}vehicles/suv.jpg` },
]
/** อัตราค่าน้ำมัน (บาท/กม.) ของรถคันนั้น: ตั้งรายคัน → ใช้ค่านั้น ไม่ตั้ง → ใช้ค่ากลาง */
export const vehicleRate = (map: Record<string, number> | undefined, id: string, fallback: number): number => (typeof map?.[id] === 'number' && map[id] >= 0 ? map[id] : fallback)
export const vehicleOf = (id?: string): Vehicle | undefined => VEHICLES.find((v) => v.id === id)
