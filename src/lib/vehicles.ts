/** ยานพาหนะของทีมเยี่ยม (แท็บทดลอง): แต่ละคันมีสีเส้นทางของตัวเอง */
export interface Vehicle { id: string; name: string; color: string; img: string }
const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './'
export const VEHICLES: Vehicle[] = [
  { id: 'pickup', name: 'รถกระบะส้ม', color: '#e8710a', img: `${base}vehicles/pickup.jpg` },
  { id: 'jazz', name: 'รถเก๋งขาว (แจ๊ซ)', color: '#ffffff', img: `${base}vehicles/jazz.jpg` },
  { id: 'van', name: 'รถตู้ขาว', color: '#1a56db', img: `${base}vehicles/van.jpg` },
  { id: 'suv', name: 'รถ SUV แดง', color: '#d32f2f', img: `${base}vehicles/suv.jpg` },
]
/** อัตราค่าน้ำมัน (บาท/กม.) ของรถคันนั้น: ตั้งรายคัน → ใช้ค่านั้น ไม่ตั้ง → ใช้ค่ากลาง */
export const vehicleRate = (map: Record<string, number> | undefined, id: string, fallback: number): number => (typeof map?.[id] === 'number' && map[id] >= 0 ? map[id] : fallback)
/** เจ้าของรถ: ค่าเริ่มต้น รถตู้ = ของคริสตจักร · คันอื่น = รถส่วนตัว (ตั้งเปลี่ยนได้) */
export const vehicleOwner = (map: Record<string, { kind: 'church' | 'personal'; name?: string }> | undefined, id: string): { kind: 'church' | 'personal'; name?: string } => map?.[id] ?? { kind: id === 'van' ? 'church' : 'personal' }
/** สีสำหรับตัวหนังสือ/ขอบบนพื้นขาว (สีขาวมองไม่เห็น จึงใช้เทาน้ำเงินแทน) */
export const inkOf = (c: string): string => (c.toLowerCase() === '#ffffff' ? '#7b8aa8' : c)
export const vehicleOf = (id?: string): Vehicle | undefined => VEHICLES.find((v) => v.id === id)
