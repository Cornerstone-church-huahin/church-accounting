import { useEffect, type ReactNode } from 'react'

/** แผ่นล่างสำหรับฟอร์มบนมือถือ */
export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="sheet no-print" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card">
        <div className="row row--between"><h2>{title}</h2><button type="button" className="mini" onClick={onClose}>ปิด</button></div>
        {children}
      </div>
    </div>
  )
}
