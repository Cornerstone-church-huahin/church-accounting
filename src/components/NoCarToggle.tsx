import { LIGHT } from '../lib/lightBox'
import { NO_CAR } from '../lib/vehicles'

/** ติ๊ก “ไม่ใช้รถ” — กิจกรรมในคริสตจักร หรือไปด้วยรถคนอื่นที่ไม่เบิกน้ำมัน (ไม่ขึ้นเส้นทาง ไม่คิดค่าน้ำมัน) */
export default function NoCarToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const on = value === NO_CAR
  return (
    <label className="row" style={{ gap: 10, alignItems: 'center', marginTop: 8, padding: '8px 10px', borderRadius: 12, border: `2px solid ${on ? '#1e8e3e' : '#d6dbe8'}`, ...LIGHT, background: on ? '#e8f5e9' : '#fff' }}>
      <input type="checkbox" style={{ width: 24, height: 24 }} checked={on} onChange={(e) => onChange(e.target.checked ? NO_CAR : '')} />
      <span><b>🚫 ไม่ใช้รถ</b><br /><small className="muted">เช่น กิจกรรมในคริสตจักร หรือไปด้วยรถคนอื่นที่ไม่เบิกค่าน้ำมัน</small></span>
    </label>
  )
}
