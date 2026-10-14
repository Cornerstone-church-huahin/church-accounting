import { fmtBaht, fmtDate } from '../lib/money'

export interface SheetListItem { id: string; date: string; updated: number; title: string; sub?: string; amount: number }

/** รายการทั้งหมดในใบของสัปดาห์นี้ เรียงตามวันที่จากเก่าไปใหม่ — แต่ละรายการมีปุ่ม ✎ แก้ไข และ 🗑 ลบ ให้เห็นตลอด (แทนการต้องแตะแถวในใบ) */
export default function SheetEntryList({ title, items, canWrite, onEdit, onDelete }: { title: string; items: SheetListItem[]; canWrite: boolean; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.updated - b.updated)
  return (
    <section className="sheetlist no-print" aria-label={title}>
      <h3>{title} ({sorted.length})</h3>
      {sorted.length === 0 ? <p className="muted small">ยังไม่มีรายการในสัปดาห์นี้ — แตะแถวว่างในใบด้านบนเพื่อเพิ่ม</p> : (
        <ul className="list">
          {sorted.map((x, i) => (
            <li key={x.id}>
              <span className="sheetlist__no">{i + 1}</span>
              <span className="grow"><b>{x.title}</b><br /><span className="small muted">{fmtDate(x.date)}{x.sub ? ` · ${x.sub}` : ''}</span></span>
              <b className="num">{fmtBaht(x.amount)}</b>
              {canWrite && <>
                <button type="button" className="mini" aria-label={`แก้ไข ${x.title} ${fmtDate(x.date)}`} onClick={() => onEdit(x.id)}>✎ แก้ไข</button>
                <button type="button" className="mini" aria-label={`ลบ ${x.title} ${fmtDate(x.date)}`} onClick={() => onDelete(x.id)}>🗑 ลบ</button>
              </>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
