import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { INVITE_FOR_KEY, INVITE_ROLE_KEY, ME_KEY } from '../lib/access'
import { DEFAULT_REPO, getSync, saveSync, testSync } from '../lib/sync'

/**
 * ลิงก์เข้าร่วม: เปิดครั้งเดียวบนเครื่องใหม่ → พิมพ์ชื่อ → ส่งคำขอให้แอดมินอนุมัติ (ไม่ต้องพิมพ์รหัส)
 * รหัสอยู่หลังเครื่องหมาย # จึงไม่ถูกส่งไปที่เซิร์ฟเวอร์ใด และถูกลบออกจากแถบที่อยู่ทันทีที่เปิด
 */
export default function Join() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [token] = useState(params.get('t') ?? '')
  const [repo] = useState(params.get('r') || DEFAULT_REPO)
  const [forName] = useState(params.get('for') ?? '')
  const [role] = useState(['bookkeeper', 'auditor'].includes(params.get('role') ?? '') ? (params.get('role') as string) : 'viewer')
  const [name, setName] = useState(getSync()?.name ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { history.replaceState(null, '', `${location.pathname}#/join`) }, [])

  const join = async () => {
    if (!token) return setMsg({ ok: false, text: 'ลิงก์นี้ไม่มีรหัส ขอลิงก์ใหม่จากแอดมิน' })
    if (!name.trim()) return setMsg({ ok: false, text: 'ใส่ชื่อของท่านก่อน เพื่อให้แอดมินรู้ว่าเป็นใคร' })
    setBusy(true)
    const cfg = { token, repo, name: name.trim() }
    const err = await testSync(cfg)
    setBusy(false)
    if (err) return setMsg({ ok: false, text: err })
    try {
      localStorage.setItem(INVITE_ROLE_KEY, role)
      localStorage.setItem(INVITE_FOR_KEY, forName)
      localStorage.setItem('acct.rejoin', '1')
      localStorage.removeItem(ME_KEY) // ตัวตนใหม่คำนวณจากชื่อที่ใส่ตอนเข้าร่วม
    } catch { /* ignore */ }
    saveSync(cfg)
    setMsg({ ok: true, text: 'ส่งคำขอร่วมใช้ให้แอดมินแล้ว ✓ รอแอดมินอนุมัติ' })
    setTimeout(() => nav('/', { replace: true }), 1500)
  }

  return (
    <>
      <div className="page-head"><h1>☁️ ขอร่วมใช้แอปบัญชี</h1></div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); join() }}>
        <p>พิมพ์ชื่อของท่านแล้วส่งคำขอ แอดมินจะเห็นชื่อและกดอนุมัติพร้อมกำหนดสิทธิ์ ท่านใช้แอปได้หลังอนุมัติ · ถ้าเคยใช้จากเครื่องอื่น ให้ใส่ชื่อเดิม</p>
        <div className="field">
          <label htmlFor="join-name">ชื่อของท่าน</label>
          <input id="join-name" className="input" value={name} placeholder="พิมพ์ชื่อของท่าน" onChange={(e) => { setName(e.target.value); setMsg(null) }} autoFocus />
        </div>
        <button type="submit" className="btn btn--gold" disabled={busy || !token}>{busy ? 'กำลังส่งคำขอ…' : '✓ ส่งคำขอร่วมใช้'}</button>
        {!token && <p className="err">ลิงก์นี้ใช้แล้วหรือไม่มีรหัส ขอลิงก์ใหม่จากแอดมิน</p>}
        {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}
      </form>
    </>
  )
}
