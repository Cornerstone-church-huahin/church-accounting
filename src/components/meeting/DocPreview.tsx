import { useRef, type ReactNode } from 'react'
import LetterPage from '../LetterPage'
import { downloadSheetPdf } from '../../lib/pdf'

/** แสดงเอกสารหัวจดหมาย A4 (หลายหน้า) พร้อมปุ่มดาวน์โหลด PDF */
export default function DocPreview({ pages, filename, label, disabled }: { pages: ReactNode[]; filename: string; label: string; disabled?: boolean }) {
  const refs = useRef<HTMLDivElement[]>([])
  refs.current = []
  return (
    <div>
      {pages.map((p, i) => <LetterPage key={i} ref={(el) => { if (el) refs.current[i] = el }}>{p}</LetterPage>)}
      <button type="button" className="btn" disabled={disabled} onClick={() => downloadSheetPdf(refs.current.filter(Boolean), filename, 'full')}>⬇️ ดาวน์โหลด PDF {label}</button>
    </div>
  )
}
