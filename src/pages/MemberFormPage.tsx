import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import logoUrl from '../assets/logo.png'
import Sheet from '../components/Sheet'
import { DAY_OPTIONS, OTHER_SERVE, SERVE_OPTIONS, decodeFormLink, replyText, type FormAnswer } from '../lib/memberForm'

/**
 * หน้าให้สมาชิกกรอกข้อมูลเอง (เปิดจากลิงก์ที่ฝ่ายทะเบียนส่งให้ในไลน์) — ไม่ต้องเข้าแอป ไม่มีการเขียนข้อมูลเข้าระบบ
 * กรอกเสร็จ → ส่งข้อความกลับทางไลน์ (หรือคัดลอก) → ฝ่ายทะเบียนวางตรวจและนำเข้า
 */
export default function MemberFormPage() {
  const [params] = useSearchParams()
  const link = decodeFormLink(params.get('d'))
  const [f, setF] = useState({ name: link?.name ?? '', nick: link?.nick ?? '', tel: link?.tel ?? '', lineId: link?.lineId ?? '', facebook: link?.facebook ?? '', gender: link?.gender ?? '', birth: link?.birth ?? '', first: link?.first ?? '', skills: link?.skills ?? '', other: (link?.serve ?? []).find((x) => x.startsWith(`${OTHER_SERVE}: `))?.slice(OTHER_SERVE.length + 2) ?? '', note: '' })
  const [serve, setServe] = useState<string[]>((link?.serve ?? []).map((x) => (x.startsWith(`${OTHER_SERVE}: `) ? OTHER_SERVE : x)))
  const [pickServe, setPickServe] = useState(false)
  const [days, setDays] = useState<string[]>(link?.serveDays ?? [])
  const toggle = (list: string[], x: string, put: (a: string[]) => void) => { put(list.includes(x) ? list.filter((y) => y !== x) : [...list, x]); setCopied(false) }
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
    lineId: f.lineId.trim() || undefined, facebook: f.facebook.trim() || undefined,
    gender: f.gender || undefined, birth: f.birth || undefined, first: f.first || undefined, skills: f.skills.trim() || undefined,
    serve: serve.length ? serve.map((x) => (x === OTHER_SERVE ? (f.other.trim() ? `${OTHER_SERVE}: ${f.other.trim()}` : OTHER_SERVE) : x)) : undefined, serveDays: days.length ? days : undefined, note: f.note.trim() || undefined,
  })
  const ok = f.name.trim().length > 0
  const sendLine = () => { if (!ok) return setMsg('ใส่ชื่อ-สกุลก่อนส่ง'); window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent(replyText(answer()))}` }
  const copy = async () => {
    if (!ok) return setMsg('ใส่ชื่อ-สกุลก่อนส่ง')
    try { await navigator.clipboard.writeText(replyText(answer())); setCopied(true); setMsg('คัดลอกแล้ว — นำไปวางในไลน์ส่งให้ฝ่ายทะเบียน') } catch { setMsg('คัดลอกไม่สำเร็จ — ใช้ปุ่มส่งทางไลน์แทน') }
  }
  const set = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setCopied(false) }
  return shell(
    <form className="card" onSubmit={(e) => e.preventDefault()} aria-label="แบบกรอกข้อมูลสมาชิก">
      <p style={{ margin: 0 }}>กรุณาตรวจและกรอกข้อมูลของท่านให้ครบ ข้อมูลที่ส่งจะไปถึงฝ่ายทะเบียนเท่านั้น</p>
      <div className="field"><label htmlFor="mf-name">ชื่อ-สกุล</label><input id="mf-name" className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></div>
      <div className="field"><label htmlFor="mf-nick">ชื่อเล่น</label><input id="mf-nick" className="input" value={f.nick} onChange={(e) => set({ nick: e.target.value })} /></div>
      <div className="field"><label htmlFor="mf-tel">โทรศัพท์</label><input id="mf-tel" className="input" type="tel" inputMode="tel" value={f.tel} onChange={(e) => set({ tel: e.target.value })} autoComplete="tel" /></div>
      <div className="field"><label htmlFor="mf-line">LINE ID <span className="muted small">(ไม่บังคับ)</span></label><input id="mf-line" className="input" value={f.lineId} onChange={(e) => set({ lineId: e.target.value })} autoCapitalize="none" autoCorrect="off" placeholder="ไอดีไลน์ของท่าน" /></div>
      <div className="field"><label htmlFor="mf-fb">Facebook <span className="muted small">(ไม่บังคับ · พิมพ์ชื่อเฟซบุ๊ก/ชื่อเพจ หรือวางลิงก์ก็ได้)</span></label><input id="mf-fb" className="input" value={f.facebook} onChange={(e) => set({ facebook: e.target.value })} placeholder="ชื่อใน Facebook หรือลิงก์โปรไฟล์/เพจ" /></div>
      <div className="field"><label id="mf-g">เพศ</label>
        <div className="row" role="radiogroup" aria-labelledby="mf-g" style={{ gap: 6 }}>
          {['ชาย', 'หญิง'].map((g) => <button key={g} type="button" role="radio" aria-checked={f.gender === g} className={f.gender === g ? 'btn btn--gold' : 'btn btn--ghost'} onClick={() => set({ gender: f.gender === g ? '' : g })}>{g}</button>)}
        </div></div>
      <div className="field"><label htmlFor="mf-birth">วันเกิด</label><input id="mf-birth" className="input" type="date" value={f.birth} onChange={(e) => set({ birth: e.target.value })} /></div>
      <div className="field"><label htmlFor="mf-first">วัน เดือน ปี ที่มาร่วมนมัสการครั้งแรก <span className="muted small">(โดยประมาณ · จำไม่ได้แน่ ใส่วันที่ใกล้เคียงได้)</span></label><input id="mf-first" className="input" type="date" value={f.first} onChange={(e) => set({ first: e.target.value })} /></div>
      <div className="field"><label htmlFor="mf-skills">อาชีพ / ความสามารถของท่าน <span className="muted small">(ไม่บังคับ)</span></label><input id="mf-skills" className="input" value={f.skills} onChange={(e) => set({ skills: e.target.value })} placeholder="เช่น ครู พยาบาล ช่างไฟ เล่นกีตาร์ ทำอาหาร" /></div>
      <div className="field"><label id="mf-serve">งานรับใช้คริสตจักรที่ท่านเต็มใจช่วย <span className="muted small">(ติ๊กได้หลายข้อ · ไม่บังคับ)</span></label>
        <button type="button" className="btn btn--ghost btn--block" aria-haspopup="dialog" onClick={() => setPickServe(true)}>🙌 เลือกงานรับใช้{serve.length ? ` (เลือกแล้ว ${serve.length} ข้อ)` : ''}</button>
        {serve.length > 0 && (
          <div className="mform__chips" style={{ marginTop: 6 }} aria-label="งานรับใช้ที่เลือกไว้">
            {serve.map((o) => <span key={o} className="mform__chip on">✓ {o === OTHER_SERVE && f.other.trim() ? `${OTHER_SERVE}: ${f.other.trim()}` : o}</span>)}
          </div>
        )}</div>
      <div className="field"><label id="mf-days">วันที่สะดวกรับใช้ <span className="muted small">(ติ๊กได้หลายวัน · ไม่บังคับ)</span></label>
        <div className="mform__chips" role="group" aria-labelledby="mf-days">
          {DAY_OPTIONS.map((o) => <button key={o} type="button" role="checkbox" aria-checked={days.includes(o)} className={`mform__chip${days.includes(o) ? ' on' : ''}`} onClick={() => toggle(days, o, setDays)}>{days.includes(o) ? '✓ ' : ''}{o}</button>)}
        </div></div>
      <div className="field"><label htmlFor="mf-note">ข้อความถึงฝ่ายทะเบียน <span className="muted small">(ไม่บังคับ เช่น ย้ายที่อยู่ เปลี่ยนเบอร์)</span></label><textarea id="mf-note" className="input" rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} /></div>
      {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
      <button type="button" className="btn btn--gold bigbtn btn--block" disabled={!ok} onClick={sendLine}>📤 ส่งกลับทางไลน์</button>
      <button type="button" className="btn btn--ghost btn--block" disabled={!ok} onClick={copy}>{copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกข้อความ (ถ้าส่งไลน์ไม่ได้)'}</button>
      {pickServe && (
        <Sheet title="เลือกงานรับใช้" onClose={() => setPickServe(false)}>
          <p className="small muted" style={{ margin: 0 }}>ติ๊กได้หลายข้อ — งานที่ท่านเต็มใจช่วยคริสตจักร</p>
          <div className="mform__chips" role="group" aria-label="งานรับใช้">
            {[...SERVE_OPTIONS, OTHER_SERVE].map((o) => <button key={o} type="button" role="checkbox" aria-checked={serve.includes(o)} className={`mform__chip${serve.includes(o) ? ' on' : ''}`} onClick={() => toggle(serve, o, setServe)}>{serve.includes(o) ? '✓ ' : ''}{o}</button>)}
          </div>
          {serve.includes(OTHER_SERVE) && <input className="input" aria-label="งานรับใช้อื่นๆ" placeholder="พิมพ์งานรับใช้อื่นๆ ที่ท่านช่วยได้" value={f.other} onChange={(e) => set({ other: e.target.value })} />}
          <button type="button" className="btn btn--gold btn--block" onClick={() => setPickServe(false)}>✓ เสร็จ ({serve.length} ข้อ)</button>
        </Sheet>
      )}
      <p className="small muted" style={{ margin: 0 }}>กดส่งแล้ว เลือกแชตฝ่ายทะเบียนใน LINE แล้วกดส่งข้อความอีกครั้งหนึ่ง ฝ่ายทะเบียนจะตรวจและบันทึกให้</p>
    </form>,
  )
}
