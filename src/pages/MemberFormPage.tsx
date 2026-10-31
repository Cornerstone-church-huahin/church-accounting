import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import logoUrl from '../assets/logo.png'
import { decodeFormLink, replyText, type FormAnswer } from '../lib/memberForm'
import { formatCoord, hasCoord, mapsLink, parseCoords } from '../lib/geo'

/**
 * หน้าให้สมาชิกกรอกข้อมูลเอง (เปิดจากลิงก์ที่ฝ่ายทะเบียนส่งให้ในไลน์) — ไม่ต้องเข้าแอป ไม่มีการเขียนข้อมูลเข้าระบบ
 * กรอกเสร็จ → ส่งข้อความกลับทางไลน์ (หรือคัดลอก) → ฝ่ายทะเบียนวางตรวจและนำเข้า
 */
export default function MemberFormPage() {
  const [params] = useSearchParams()
  const link = decodeFormLink(params.get('d'))
  const [f, setF] = useState({ name: link?.name ?? '', nick: link?.nick ?? '', tel: link?.tel ?? '', gender: link?.gender ?? '', birth: link?.birth ?? '', note: '' })
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(link && hasCoord(link) ? { lat: link.lat!, lng: link.lng! } : null)
  const [coordText, setCoordText] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const shell = (children: React.ReactNode) => (
    <main className="mform">
      <header className="mform__head"><img src={logoUrl} alt="" width={56} height={56} /><div><b>คริสตจักรศิลาเอก</b><br /><span className="small muted">แบบกรอกข้อมูลสมาชิก</span></div></header>
      {children}
    </main>
  )
  if (!link) return shell(<section className="card"><p className="error" role="alert" style={{ margin: 0 }}>ลิงก์นี้ไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากฝ่ายทะเบียน</p></section>)
  if (link.exp < Date.now()) return shell(<section className="card"><p className="error" role="alert" style={{ margin: 0 }}>ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่จากฝ่ายทะเบียน</p></section>)

  const answer = (): FormAnswer => ({
    mid: link.mid, code: link.code, name: f.name.trim(), nick: f.nick.trim() || undefined, tel: f.tel.trim() || undefined,
    gender: f.gender || undefined, birth: f.birth || undefined, ...(coord ? { lat: coord.lat, lng: coord.lng } : {}), note: f.note.trim() || undefined,
  })
  const ok = f.name.trim().length > 0
  const locate = () => {
    if (!navigator.geolocation) return setMsg('เครื่องนี้ไม่รองรับการหาตำแหน่ง — พิมพ์พิกัดหรือวางลิงก์ Google Maps แทนได้')
    setMsg('กำลังหาตำแหน่ง… (ควรกดตอนอยู่ที่บ้าน)')
    navigator.geolocation.getCurrentPosition((p) => { setCoord({ lat: p.coords.latitude, lng: p.coords.longitude }); setMsg('') }, () => setMsg('หาตำแหน่งไม่ได้ — อนุญาตการเข้าถึงตำแหน่ง หรือพิมพ์พิกัดแทน'), { enableHighAccuracy: true, timeout: 15000 })
  }
  const applyCoordText = () => { const c = parseCoords(coordText); if (!c) return setMsg('อ่านพิกัดไม่ออก — วางลิงก์ Google Maps หรือพิมพ์ เช่น 12.5684, 99.9577'); setCoord(c); setMsg('') }
  const sendLine = () => { if (!ok) return setMsg('ใส่ชื่อ-สกุลก่อนส่ง'); window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent(replyText(answer()))}` }
  const copy = async () => {
    if (!ok) return setMsg('ใส่ชื่อ-สกุลก่อนส่ง')
    try { await navigator.clipboard.writeText(replyText(answer())); setCopied(true); setMsg('คัดลอกแล้ว — นำไปวางในไลน์ส่งให้ฝ่ายทะเบียน') } catch { setMsg('คัดลอกไม่สำเร็จ — ใช้ปุ่มส่งทางไลน์แทน') }
  }
  const set = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setCopied(false) }
  return shell(
    <form className="card" onSubmit={(e) => e.preventDefault()} aria-label="แบบกรอกข้อมูลสมาชิก">
      <p style={{ margin: 0 }}>กรุณาตรวจและกรอกข้อมูลของท่านให้ครบ ข้อมูลที่ส่งจะไปถึงฝ่ายทะเบียนเท่านั้น</p>
      {link.code && <p className="small muted" style={{ margin: '0.3rem 0 0' }}>รหัสสมาชิก {link.code}</p>}
      <div className="field"><label htmlFor="mf-name">ชื่อ-สกุล</label><input id="mf-name" className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></div>
      <div className="field"><label htmlFor="mf-nick">ชื่อเล่น</label><input id="mf-nick" className="input" value={f.nick} onChange={(e) => set({ nick: e.target.value })} /></div>
      <div className="field"><label htmlFor="mf-tel">โทรศัพท์</label><input id="mf-tel" className="input" type="tel" inputMode="tel" value={f.tel} onChange={(e) => set({ tel: e.target.value })} autoComplete="tel" /></div>
      <div className="field"><label id="mf-g">เพศ</label>
        <div className="row" role="radiogroup" aria-labelledby="mf-g" style={{ gap: 6 }}>
          {['ชาย', 'หญิง'].map((g) => <button key={g} type="button" role="radio" aria-checked={f.gender === g} className={f.gender === g ? 'btn btn--gold' : 'btn btn--ghost'} onClick={() => set({ gender: f.gender === g ? '' : g })}>{g}</button>)}
        </div></div>
      <div className="field"><label htmlFor="mf-birth">วันเกิด</label><input id="mf-birth" className="input" type="date" value={f.birth} onChange={(e) => set({ birth: e.target.value })} /></div>
      <div className="field"><label>พิกัดบ้าน <span className="muted small">(ไม่บังคับ)</span></label>
        {coord && <p className="small" style={{ margin: '0 0 0.3rem' }}>📍 {formatCoord(coord)} · <a href={mapsLink(coord)} target="_blank" rel="noreferrer">เปิดแผนที่</a></p>}
        <button type="button" className="btn btn--ghost" onClick={locate}>📍 ใช้ตำแหน่งปัจจุบัน (กดตอนอยู่ที่บ้าน)</button>
        <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'nowrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 0 }} aria-label="พิมพ์พิกัดหรือวางลิงก์ Google Maps" placeholder="หรือวางลิงก์ Google Maps / พิมพ์พิกัด" value={coordText} onChange={(e) => setCoordText(e.target.value)} />
          <button type="button" className="mini" onClick={applyCoordText}>ใช้</button>
        </div></div>
      <div className="field"><label htmlFor="mf-note">ข้อความถึงฝ่ายทะเบียน <span className="muted small">(ไม่บังคับ เช่น ย้ายที่อยู่ เปลี่ยนเบอร์)</span></label><textarea id="mf-note" className="input" rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} /></div>
      {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
      <button type="button" className="btn btn--gold bigbtn btn--block" disabled={!ok} onClick={sendLine}>📤 ส่งกลับทางไลน์</button>
      <button type="button" className="btn btn--ghost btn--block" disabled={!ok} onClick={copy}>{copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกข้อความ (ถ้าส่งไลน์ไม่ได้)'}</button>
      <p className="small muted" style={{ margin: 0 }}>กดส่งแล้ว เลือกแชตฝ่ายทะเบียนใน LINE แล้วกดส่งข้อความอีกครั้งหนึ่ง ฝ่ายทะเบียนจะตรวจและบันทึกให้</p>
    </form>,
  )
}
