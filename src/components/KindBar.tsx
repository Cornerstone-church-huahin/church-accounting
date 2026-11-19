import { useMemo } from 'react'
import { GIFT_KINDS } from '../lib/donorGifts'
import { fmtBaht } from '../lib/money'
import type { DonorGift, GiftKind } from '../lib/types'

/** แถบเลือกดูแยกประเภท (เลื่อนซ้าย-ขวาได้): ทั้งหมด · สิบลด · ประจำสัปดาห์ · … · ให้ยืม — แต่ละปุ่มบอกจำนวนคนและยอด · แตะซ้ำ = กลับไปทั้งหมด */
export default function KindBar({ gifts, value, onChange }: { gifts: DonorGift[]; value: GiftKind | ''; onChange: (k: GiftKind | '') => void }) {
  const stats = useMemo(() => {
    const m = new Map<GiftKind, { people: Set<string>; total: number }>()
    for (const g of gifts) { if (g.deleted) continue; const e = m.get(g.kind) ?? { people: new Set<string>(), total: 0 }; e.people.add(g.code); e.total += g.amount; m.set(g.kind, e) }
    return m
  }, [gifts])
  const allPeople = useMemo(() => new Set(gifts.filter((g) => !g.deleted && g.kind !== 'loan').map((g) => g.code)).size, [gifts])
  const chip = (active: boolean, color: string): React.CSSProperties => ({ flex: 'none', textAlign: 'left', border: `2px solid ${color}`, background: active ? color : '#fff', color: active ? '#fff' : '#14264a', borderRadius: 12, padding: '4px 10px', cursor: 'pointer', lineHeight: 1.2 })
  return (
    <div role="group" aria-label="เลือกดูแยกประเภท" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
      <button type="button" aria-pressed={value === ''} onClick={() => onChange('')} style={chip(value === '', '#14264a')}><b style={{ fontSize: '0.85rem' }}>ทั้งหมด</b><br /><small>{allPeople} คน · ไม่รวมให้ยืม</small></button>
      {GIFT_KINDS.map((k) => {
        const s = stats.get(k.k)
        return <button key={k.k} type="button" aria-pressed={value === k.k} onClick={() => onChange(value === k.k ? '' : k.k)} style={{ ...chip(value === k.k, k.color), opacity: s ? 1 : 0.5 }}><b style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{k.short}</b><br /><small style={{ whiteSpace: 'nowrap' }}>{s ? `${s.people.size} คน · ${fmtBaht(s.total, { dec: false })}` : 'ไม่มีข้อมูล'}</small></button>
      })}
    </div>
  )
}
