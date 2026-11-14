import { LIGHT } from '../lib/lightBox'
import { VEHICLES, inkOf } from '../lib/vehicles'
import NoCarToggle from './NoCarToggle'

/** เลือกรถเป็นรูปรถ 4 คัน + ติ๊ก “ไม่ใช้รถ” (กดรถที่เลือกซ้ำ = ยกเลิก) */
export default function VehicleGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }} role="radiogroup" aria-label="ยานพาหนะ">
        {VEHICLES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={value === c.id} onClick={() => onChange(value === c.id ? '' : c.id)} style={{ ...LIGHT, background: '#fff', padding: 3, borderRadius: 10, border: `3px solid ${value === c.id ? inkOf(c.color) : '#d6dbe8'}`, font: 'inherit', textAlign: 'center' }}>
            <img src={c.img} alt={c.name} style={{ width: '100%', height: 44, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
            <div style={{ fontSize: 10.5, fontWeight: 700 }}>{c.name.replace('รถ', '')}{value === c.id ? ' ✓' : ''}</div>
          </button>))}
      </div>
      <NoCarToggle value={value} onChange={onChange} />
    </>
  )
}
