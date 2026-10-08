import { useEffect, useState } from 'react'
import { canInstall, install, isIOS, isInstalled, onInstallChange } from '../lib/install'

const KEY = 'acct.installDismissed'
const dismissed = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

/** ติดตั้งเป็นแอปบนหน้าจอหลัก: เปิดแล้วเต็มจอ ไม่มีแถบชื่อเว็บ/ลิงก์ของเบราว์เซอร์ (เหมือนแอปคู่มือผู้ปกครอง) */
export default function InstallApp({ banner }: { banner?: boolean }) {
  const [, tick] = useState(0)
  const [hide, setHide] = useState(dismissed)
  const [msg, setMsg] = useState('')
  useEffect(() => { const off = onInstallChange(() => tick((n) => n + 1)); return () => { off() } }, [])
  if (isInstalled()) return banner ? null : <p className="ok small">✓ ติดตั้งเป็นแอปแล้ว</p>
  const ios = isIOS()
  const go = async () => setMsg((await install()) ? 'ติดตั้งแล้ว ✓ เปิดจากไอคอนบนหน้าจอหลักได้เลย' : 'ถ้าไม่มีหน้าต่างขึ้น ให้เปิดเมนู ⋮ ของ Chrome แล้วเลือก “เพิ่มลงในหน้าจอหลัก / ติดตั้งแอป”')
  if (banner) {
    if (hide || (!canInstall() && !ios)) return null
    return (
      <div className="install-banner no-print" role="note">
        <span className="grow">📲 <b>ติดตั้งเป็นแอป</b> — เปิดแล้วเต็มจอ ไม่มีแถบเว็บ</span>
        {canInstall() ? <button type="button" className="btn btn--gold" onClick={go}>ติดตั้ง</button> : <span className="small">เมนู แชร์ › เพิ่มลงหน้าจอโฮม</span>}
        <button type="button" className="mini" aria-label="ปิดข้อความนี้" onClick={() => { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } setHide(true) }}>✕</button>
      </div>
    )
  }
  return (
    <>
      <p className="muted small">ติดตั้งแล้วเปิดจากไอคอนบนหน้าจอหลักได้เลย ไม่มีแถบชื่อเว็บและลิงก์ของเบราว์เซอร์ด้านบน และหน้าจอเต็มขึ้น</p>
      {canInstall() && <button type="button" className="btn btn--gold" onClick={go}>📲 ติดตั้งแอปบนหน้าจอหลัก</button>}
      {ios ? (
        <ol className="install-steps"><li>เปิดลิงก์นี้ด้วย <b>Safari</b></li><li>กดปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น)</li><li>เลือก <b>เพิ่มไปยังหน้าจอโฮม</b> แล้วกด เพิ่ม</li></ol>
      ) : !canInstall() && (
        <ol className="install-steps"><li>เปิดลิงก์นี้ด้วย <b>Chrome</b> (ไม่ใช่เบราว์เซอร์ในแอป Line/Facebook)</li><li>กดเมนู <b>⋮</b> มุมขวาบน</li><li>เลือก <b>เพิ่มลงในหน้าจอหลัก</b> หรือ <b>ติดตั้งแอป</b></li></ol>
      )}
      {msg && <p className="ok" role="status">{msg}</p>}
    </>
  )
}
