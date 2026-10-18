import { useState } from 'react'
import { Link } from 'react-router-dom'
import Sheet from './Sheet'
import { clearEtagCache, SYNC_EVENT } from '../lib/sync'
import { useGlobalSync } from '../lib/syncStatus'
import { IconRefresh } from './Icons'

const hm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/** ปุ่มรีเฟรชข้อมูลที่หัวแอป: แตะเพื่อดูสถานะซิงก์ (ล่าสุดเมื่อไร / ผิดพลาดเพราะอะไร) และสั่งดึงข้อมูลใหม่ทันที */
export default function SyncButton() {
  const g = useGlobalSync()
  const [open, setOpen] = useState(false)
  const bad = g.connected && g.errors.length > 0
  const warn = !g.connected || bad
  const pull = () => { clearEtagCache(); window.dispatchEvent(new Event(SYNC_EVENT)) } // ล้างค่าจำ (ETag) แล้วดึงทุกไฟล์ใหม่
  return (
    <>
      <button type="button" className={`topbar__sync${g.syncing > 0 ? ' topbar__sync--spin' : ''}${warn ? ' topbar__sync--warn' : ''}`} onClick={() => setOpen(true)} aria-label={bad ? 'ซิงก์ผิดพลาด แตะดูสาเหตุ' : g.connected ? 'รีเฟรชข้อมูล' : 'ยังไม่ได้เชื่อมต่อออนไลน์'} title="รีเฟรชข้อมูล">
        <IconRefresh />
      </button>
      {open && (
        <Sheet title="สถานะข้อมูลออนไลน์" onClose={() => setOpen(false)}>
          {!g.connected ? (
            <>
              <p style={{ margin: 0 }}><b>เครื่องนี้ยังไม่ได้เชื่อมต่อออนไลน์</b> ข้อมูลที่เห็นเป็นสำเนาในเครื่อง จึงไม่อัปเดตตามเครื่องอื่น</p>
              <p className="pagehint" style={{ margin: 0 }}>ให้แอดมินส่งลิงก์เชิญใหม่ แล้วเปิดลิงก์นั้นในเครื่องนี้ใช้ชื่อเดิม หรือไปที่ตั้งค่า &gt; เชื่อมต่อออนไลน์</p>
              <Link className="btn btn--gold bigbtn btn--block" to="/settings" onClick={() => setOpen(false)}>ไปตั้งค่าเชื่อมต่อออนไลน์</Link>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }} role="status">
                {g.syncing > 0 ? 'กำลังดึงข้อมูล…' : bad ? <b style={{ color: 'var(--bad)' }}>⚠ ซิงก์ไม่สำเร็จ</b> : g.lastOk ? <b style={{ color: 'var(--good)' }}>✓ ข้อมูลเป็นปัจจุบัน ซิงก์ล่าสุด {hm(g.lastOk)} น.</b> : 'ยังไม่เคยซิงก์ในรอบนี้'}
              </p>
              {bad && (
                <div aria-label="สาเหตุ" style={{ display: 'grid', gap: '0.4rem' }}>
                  {g.errors.map((e) => <p key={e} role="alert" style={{ margin: 0, padding: '0.6rem 0.75rem', borderRadius: '0.7rem', border: '1.5px solid var(--bad)', color: 'var(--ink)', fontSize: '1rem', lineHeight: 1.45, background: 'var(--surface)' }}>{e}</p>)}
                </div>
              )}
              {bad && g.lastOk && <p className="pagehint" style={{ margin: 0 }}>ล่าสุดที่ซิงก์สำเร็จ {hm(g.lastOk)} น. ข้อมูลที่แก้ในเครื่องนี้เก็บไว้ จะส่งขึ้นเองเมื่อซิงก์ได้</p>}
              <button type="button" className="btn btn--gold bigbtn btn--block" disabled={g.syncing > 0} onClick={pull}>🔄 ดึงข้อมูลใหม่ตอนนี้</button>
              <p className="pagehint" style={{ margin: 0 }}>แอปดึงข้อมูลเองทุก 1 นาทีขณะเปิดหน้าจอ · ข้อมูลที่ยังไม่ได้ส่งขึ้นจะไม่หายเมื่อกดปุ่มนี้</p>
            </>
          )}
        </Sheet>
      )}
    </>
  )
}
