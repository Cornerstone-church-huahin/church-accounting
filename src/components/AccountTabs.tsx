import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const TABS = [{ k: 'in', icon: '💚', label: 'รายรับ' }, { k: 'out', icon: '🔴', label: 'รายจ่าย' }, { k: 'all', icon: '📊', label: 'สรุป' }] as const

/** แถบไอคอนเล็กลอยค้างใต้แถบบนสุด (รายรับ · รายจ่าย · สรุป): แตะแล้วเปลี่ยนหน้าทันทีโดยไม่ต้องย้อนกลับ — เลื่อนหน้าลงก็ยังเห็น */
export default function AccountTabs({ n, active }: { n: number; active: 'in' | 'out' | 'all' }) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const bar = document.querySelector<HTMLElement>('.topbar')
    if (ref.current) ref.current.style.top = `${bar ? bar.offsetHeight : 0}px`
  })
  return (
    <nav ref={ref} className="accttabs no-print" aria-label="สลับรายรับ รายจ่าย สรุป">
      {TABS.map((t) => (
        <Link key={t.k} to={`/meeting/${n}/${t.k}`} replace className={`accttab${t.k === active ? ' accttab--on' : ''}`} aria-current={t.k === active ? 'page' : undefined}>
          <span aria-hidden="true">{t.icon}</span><small>{t.label}</small>
        </Link>
      ))}
    </nav>
  )
}
