/** เมนูแท็บแบบช่องสีใหญ่ (หน้าตาเดียวกับช่องเงินคริสตจักรบนหน้าแรก): ใช้ในห้องทำงานแทนแถบแท็บเล็ก ๆ */
const TONES = ['own', 'fund', 'total', 'indebt', 'debt', 'land'] as const
export interface TileTab<K extends string = string> { key: K; label: string; icon: string }

export default function TileTabs<K extends string>({ items, value, onChange, label }: { items: readonly TileTab<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <nav className="balance-tiles tiletabs no-print" role="tablist" aria-label={label}>
      {items.map((t, i) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} className={`btile btile--${TONES[i % TONES.length]}`} onClick={() => onChange(t.key)}>
          <small aria-hidden="true">{t.icon}</small><b>{t.label}</b>
        </button>
      ))}
    </nav>
  )
}
