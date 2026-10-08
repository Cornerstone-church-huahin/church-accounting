import { useState } from 'react'
import { chromeIntentUrl, isAndroid, isInAppBrowser, lineExternalUrl } from '../lib/inapp'

/** แจ้งเมื่อเปิดผ่าน Line/Facebook: แถบชื่อเว็บด้านบนเป็นของเบราว์เซอร์ในแอปนั้น → เปิดใน Chrome แล้วติดตั้งเป็นแอปจึงจะเต็มจอ */
export default function OpenInChrome() {
  const [copied, setCopied] = useState(false)
  if (!isInAppBrowser()) return null
  const href = location.href
  const copy = async () => { try { await navigator.clipboard.writeText(href); setCopied(true) } catch { /* ignore */ } }
  return (
    <section className="install-banner no-print" role="note" style={{ flexDirection: 'column', alignItems: 'stretch', borderRadius: 0 }}>
      <span>🧭 ตอนนี้เปิดผ่านแอป Line/โซเชียล จึงมีแถบชื่อเว็บและลิงก์ครอบอยู่ด้านบน — <b>เปิดใน Chrome แล้วติดตั้งเป็นแอป</b> หน้าจอจะสะอาดเต็มจอ</span>
      <span className="row">
        <a className="btn btn--gold" href={isAndroid() ? chromeIntentUrl(href) : lineExternalUrl(href)}>เปิดใน Chrome</a>
        <button type="button" className="btn btn--ghost" style={{ color: 'var(--bar-ink)', borderColor: 'rgba(249,248,245,.4)' }} onClick={copy}>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}</button>
      </span>
      <span className="small">ถ้ากดแล้วไม่เปิด: กดเมนู ⋮ มุมขวาบนของหน้านี้ แล้วเลือก “เปิดในเบราว์เซอร์” หรือคัดลอกลิงก์ไปวางใน Chrome</span>
    </section>
  )
}
