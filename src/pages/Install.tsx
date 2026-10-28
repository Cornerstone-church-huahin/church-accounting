import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canInstall, install, isIOS, isInstalled, onInstallChange } from '../lib/install'
import { chromeIntentUrl, isAndroid, isInAppBrowser, lineExternalUrl } from '../lib/inapp'

const Share = () => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3" /><path d="M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
const Plus = () => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></svg>
const Step = ({ n, children }: { n: number; children: React.ReactNode }) => <li className="instl-step"><span className="instl-n" aria-hidden="true">{n}</span><div>{children}</div></li>

/**
 * หน้าติดตั้งแอป (ลิงก์เดียวสำหรับทุกเครื่อง): ตรวจว่าเป็น Android / iPhone / เปิดในแอปแชต แล้วโชว์ปุ่มและขั้นตอนที่ถูกต้อง
 * Android = ปุ่มติดตั้งคลิกเดียว · iPhone = Apple ไม่ให้เว็บติดตั้งเอง จึงมีขั้นตอน 3 ขั้นพร้อมไอคอนให้ตามง่าย
 */
export default function Install() {
  const [, tick] = useState(0)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { const off = onInstallChange(() => tick((n) => n + 1)); return () => { off() } }, [])
  const href = location.href
  const installed = isInstalled(), ios = isIOS(), android = isAndroid(), inapp = isInAppBrowser()
  const go = async () => setMsg((await install()) ? 'ติดตั้งแล้ว ✓ เปิดแอปจากไอคอนบนหน้าจอหลักได้เลย' : 'ถ้าไม่มีหน้าต่างติดตั้งขึ้น ให้เปิดเมนู ⋮ ของ Chrome แล้วเลือก “ติดตั้งแอป”')
  const copy = async () => { try { await navigator.clipboard.writeText(href); setCopied(true) } catch { setMsg('คัดลอกไม่ได้ — กดค้างที่ลิงก์ในแถบด้านบนเพื่อคัดลอก') } }
  return (
    <>
      <div className="page-head"><h1>📲 ติดตั้งแอปบัญชีคริสตจักร</h1></div>
      <section className="card" aria-label="ติดตั้งแอป">
        <h2>① ติดตั้งแอป</h2>
        <p style={{ margin: '0 0 0.5rem' }}>ติดตั้งแล้วเปิดจากไอคอนบนหน้าจอหลัก <b>เต็มจอ ไม่มีแถบเว็บ</b> ข้อมูลไม่หายแม้ไม่ได้เปิดนาน</p>
        {installed ? (
          <p className="ok" role="status">✓ เครื่องนี้ติดตั้งแอปแล้ว — ไปขั้น ② ด้านล่าง</p>
        ) : inapp ? (
          <div role="alert" className="instl-warn">
            <b>⚠️ ตอนนี้เปิดอยู่ในแอปแชต (LINE/Facebook ฯลฯ) ติดตั้งจากตรงนี้ไม่ได้</b>
            {android ? (
              <p style={{ margin: '0.4rem 0 0' }}><a className="btn btn--gold" href={chromeIntentUrl(href)}>เปิดใน Chrome</a> <a className="btn btn--ghost" href={lineExternalUrl(href)}>เปิดในเบราว์เซอร์หลัก</a></p>
            ) : (
              <ol className="install-steps" style={{ margin: '0.4rem 0 0' }}>
                <li>แตะไอคอนแชร์ หรือ “⋯” มุมล่าง/ขวาบนของหน้านี้</li>
                <li>เลือก <b>เปิดใน Safari</b></li>
              </ol>
            )}
            <p style={{ margin: '0.4rem 0 0' }}><button type="button" className="btn btn--ghost" onClick={() => void copy()}>{copied ? '✓ คัดลอกลิงก์แล้ว' : '📋 คัดลอกลิงก์นี้'}</button> <span className="small muted">แล้วไปวางในเบราว์เซอร์</span></p>
          </div>
        ) : ios ? (
          <div aria-label="ขั้นตอนสำหรับ iPhone">
            <p className="small muted" style={{ margin: '0 0 0.4rem' }}>iPhone: Apple ไม่ให้เว็บกดติดตั้งเองได้ ทำตาม 3 ขั้นนี้ใน <b>Safari</b></p>
            <ol className="instl-steps">
              <Step n={1}>เปิดหน้านี้ด้วย <b>Safari</b></Step>
              <Step n={2}>แตะปุ่มแชร์ <span className="instl-ico"><Share /></span> (ล่างกลางจอ)</Step>
              <Step n={3}>เลื่อนลง เลือก <b>เพิ่มลงหน้าจอโฮม</b> <span className="instl-ico"><Plus /></span> แล้วแตะ <b>เพิ่ม</b></Step>
            </ol>
          </div>
        ) : android || canInstall() ? (
          <div aria-label="ติดตั้งบน Android">
            {canInstall() ? <button type="button" className="btn btn--gold bigbtn btn--block" onClick={() => void go()}>📲 ติดตั้งแอป</button> : (
              <ol className="install-steps">
                <Step n={1}>เปิดหน้านี้ด้วย <b>Chrome</b></Step>
                <Step n={2}>แตะเมนู <b>⋮</b> มุมขวาบน</Step>
                <Step n={3}>เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b></Step>
              </ol>
            )}
          </div>
        ) : (
          <p className="muted">เปิดลิงก์นี้ในโทรศัพท์ (Android ใช้ Chrome · iPhone ใช้ Safari) เพื่อติดตั้ง</p>
        )}
        {msg && <p className="ok" role="status">{msg}</p>}
      </section>
      <section className="card" aria-label="ขั้นต่อไป">
        <h2>② หลังติดตั้ง: เข้าร่วมใช้งาน</h2>
        <ol className="install-steps">
          <li>เปิดแอปจาก <b>ไอคอนบนหน้าจอหลัก</b> (ไม่ใช่จาก Safari/Chrome)</li>
          <li>แตะปุ่มรีเฟรช 🔄 มุมขวาบน แล้ว <b>วางลิงก์เชิญ</b> ที่แอดมินส่งให้</li>
          <li>พิมพ์ชื่อของท่านเพื่อส่งคำขอ รอแอดมินอนุมัติ</li>
        </ol>
        <p className="small muted">iPhone: ต้องวางลิงก์เชิญ <b>ในแอปที่ติดตั้งแล้ว</b> เพราะ Safari กับแอปที่ติดตั้งแยกกัน ถ้ากดลิงก์เชิญใน Safari ก่อน ให้ทำซ้ำในแอปอีกครั้ง</p>
        <Link to="/" className="mini">‹ ไปหน้าแรก</Link>
      </section>
    </>
  )
}
