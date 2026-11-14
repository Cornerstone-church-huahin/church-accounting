import { useRef, useState } from 'react'

/**
 * วางแผนกิจกรรมของช่วงนั้น: เพิ่มได้หลายรายการ (แต่ละรายการแยกช่อง กด ＋ เพิ่มต่อได้เรื่อยๆ)
 * เก็บเป็นข้อความทีละบรรทัดเหมือนเดิม จึงเข้ากับข้อมูลที่บันทึกไว้แล้ว
 */
export default function ActivityPlanEditor({ value, onDraft, onCommit }: { value: string | undefined; /** ข้อความล่าสุดทุกครั้งที่พิมพ์ (ใช้บันทึกตอนปิดหน้าต่าง) */ onDraft: (text: string) => void; /** ออกจากช่องพิมพ์ → บันทึก */ onCommit: (text: string) => void }) {
  const [items, setItems] = useState<string[]>(() => { const l = (value ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean); return l.length ? l : [''] })
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const join = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).join('\n')
  const set = (next: string[]) => { setItems(next); onDraft(join(next)) }
  const add = () => { set([...items, '']); window.setTimeout(() => refs.current[items.length]?.focus(), 30) }
  return (
    <div className="field">
      <label>📋 กิจกรรมของช่วงนี้ — เพิ่มได้หลายรายการ <span className="muted small">(ไปติ๊ก “ทำแล้ว” ที่หน้าบันทึก/เช็คอิน)</span></label>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
        {items.map((t, i) => (
          <li key={i} className="row" style={{ gap: 6, alignItems: 'center' }}>
            <b style={{ width: 22, textAlign: 'right' }}>{i + 1}.</b>
            <input ref={(el) => { refs.current[i] = el }} className="input grow" aria-label={`กิจกรรมที่ ${i + 1}`} value={t} placeholder="เช่น พาทีมแม่ครัวไปจ่ายตลาด"
              onChange={(e) => set(items.map((x, j) => (j === i ? e.target.value : x)))}
              onBlur={() => onCommit(join(items))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
            <button type="button" className="mini" aria-label={`ลบกิจกรรมที่ ${i + 1}`} onClick={() => { const next = items.filter((_, j) => j !== i); const n = next.length ? next : ['']; setItems(n); onDraft(join(n)); onCommit(join(n)) }}>✕</button>
          </li>))}
      </ol>
      <button type="button" className="btn btn--gold" style={{ marginTop: 6 }} onClick={add}>＋ เพิ่มกิจกรรม</button>
    </div>
  )
}
