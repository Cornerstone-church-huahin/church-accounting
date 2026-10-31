import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import logoUrl from '../assets/logo.png'
import Sheet from '../components/Sheet'
import { BY_NAME, DAY_OPTIONS, NEW_MID, OTHER_SERVE, SERVE_OPTIONS, decodeFormLink, decodeGroupLink, replyText, type FormAnswer, type FormLink, type GroupLink } from '../lib/memberForm'

/**
 * หน้าให้สมาชิกกรอกข้อมูลเอง (เปิดจากลิงก์ที่ฝ่ายทะเบียนส่งให้ในไลน์) — ไม่ต้องเข้าแอป ไม่มีการเขียนข้อมูลเข้าระบบ
 * กรอกเสร็จ → ส่งข้อความกลับทางไลน์ (หรือคัดลอก) → ฝ่ายทะเบียนวางตรวจและนำเข้า
 */
export default function MemberFormPage() {
  const [params] = useSearchParams()
  const group = decodeGroupLink(params.get('d'))
  const [picked, setPicked] = useState<FormLink | null>(null)
  if (group && !picked) return <GroupPicker group={group} onPick={setPicked} />
  const d = params.get('d')
  // ไม่มี d = ลิงก์ทั่วไป (ส่งทั้งกลุ่ม): กรอกเอง ฝ่ายทะเบียนจับคู่จากชื่อ
  const link: FormLink | null = picked ?? (d ? decodeFormLink(d) : { v: 1, mid: BY_NAME, name: '', exp: Number.MAX_SAFE_INTEGER })
  return <FormBody key={picked?.mid ?? 'one'} link={link} grouped={!!group} onReselect={() => setPicked(null)} />
}

/** ลิงก์กลุ่ม ขั้นที่ 1: เลือกชื่อของตัวเองจากรายชื่อ */
function GroupPicker({ group, onPick }: { group: GroupLink; onPick: (l: FormLink) => void }) {
  const [q, setQ] = useState('')
  const t = q.trim().toLowerCase().replace(/\s+/g, '')
  const shown = group.list.filter((x) => !t || `${x.name}${x.nick ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(t))
  return (
    <main className="mform">
      <header className="mform__head"><img src={logoUrl} alt="" width={56} height={56} /><div><b>คริสตจักรศิลาเอก</b><br /><span className="small muted">แบบกรอกข้อมูลสมาชิก</span></div></header>
      {group.exp < Date.now()
        ? <section className="card"><p className="error" role="alert" style={{ margin: 0 }}>ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่จากฝ่ายทะเบียน</p></section>
        : (
          <section className="card" aria-label="เลือกชื่อของท่าน">
            <p style={{ margin: 0 }}><b>ขั้นที่ 1:</b> เลือกชื่อของท่านจากรายชื่อ</p>
            <p className="mform__warn" role="note">⚠️ เลือกให้ตรงกับตัวท่านเอง เพราะข้อมูลที่กรอกจะถูกบันทึกในชื่อที่เลือก</p>
            <div className="field"><label htmlFor="mf-find">🔎 พิมพ์ชื่อเพื่อค้นหา</label><input id="mf-find" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อหรือชื่อเล่น" /></div>
            <div role="list" aria-label="รายชื่อ" style={{ display: 'grid', gap: 6 }}>
              {shown.map((x) => <button key={x.id} role="listitem" type="button" className="btn btn--ghost" style={{ textAlign: 'left' }} onClick={() => onPick({ v: 1, mid: x.id, name: x.name, nick: x.nick, exp: group.exp })}>{x.name}{x.nick ? <span className="muted small"> ({x.nick})</span> : null}</button>)}
              {shown.length === 0 && <p className="muted small" style={{ margin: 0 }}>ไม่พบชื่อที่ค้นหา</p>}
            </div>
            <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => onPick({ v: 1, mid: NEW_MID, name: '', exp: group.exp })}>➕ ไม่พบชื่อของฉันในรายการ</button>
          </section>
        )}
    </main>
  )
}

type Draft = { f: Record<string, string>; serve: string[]; days: string[] }
const draftKey = (mid: string) => `acct.formdraft.${mid}`
const readDraft = (mid: string): Draft | null => { try { const d = JSON.parse(localStorage.getItem(draftKey(mid)) ?? 'null') as Draft | null; return d && d.f ? d : null } catch { return null } }

function FormBody({ link, grouped, onReselect }: { link: FormLink | null; grouped: boolean; onReselect: () => void }) {
  // ส่งซ้ำได้ภายในอายุลิงก์: เปิดลิงก์ใหม่ → นำสิ่งที่เคยกรอกไว้ในเครื่องนี้กลับมาให้ (ถ้ามี)
  const saved = useMemo(() => (link ? readDraft(link.mid) : null), [link?.mid]) // eslint-disable-line react-hooks/exhaustive-deps
  const [restored] = useState(!!saved)
  const [f, setF] = useState<{ name: string; nick: string; tel: string; lineId: string; facebook: string; gender: string; birth: string; first: string; since: string; skills: string; other: string; note: string; address?: string }>(saved?.f ? saved.f as never : { name: link?.name ?? '', nick: link?.nick ?? '', tel: link?.tel ?? '', lineId: link?.lineId ?? '', facebook: link?.facebook ?? '', gender: link?.gender ?? '', birth: link?.birth ?? '', first: link?.first ?? '', since: link?.since ?? '', skills: link?.skills ?? '', other: (link?.serve ?? []).find((x) => x.startsWith(`${OTHER_SERVE}: `))?.slice(OTHER_SERVE.length + 2) ?? '', note: '' })
  const [serve, setServe] = useState<string[]>(saved?.serve ?? (link?.serve ?? []).map((x) => (x.startsWith(`${OTHER_SERVE}: `) ? OTHER_SERVE : x)))
  const [pick, setPick] = useState<'' | 'skills' | 'serve' | 'days'>('')
  const [geo, setGeo] = useState<{ lat: number; lng: number; acc?: number } | null>((saved as { geo?: { lat: number; lng: number; acc?: number } } | null)?.geo ?? null)
  const [geoMsg, setGeoMsg] = useState('')
  const locate = () => {
    if (!navigator.geolocation) return setGeoMsg('เครื่องนี้ไม่รองรับการระบุตำแหน่ง')
    setGeoMsg('กำลังหาตำแหน่ง…')
    navigator.geolocation.getCurrentPosition((p) => { setGeo({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, acc: Math.round(p.coords.accuracy) }); setGeoMsg(''); setCopied(false) }, () => setGeoMsg('หาตำแหน่งไม่ได้ — กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์แล้วลองใหม่'), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }
  const [days, setDays] = useState<string[]>(saved?.days ?? link?.serveDays ?? [])
  useEffect(() => { if (link) try { localStorage.setItem(draftKey(link.mid), JSON.stringify({ f, serve, days, geo })) } catch { /* ignore */ } }, [f, serve, days, geo]) // eslint-disable-line react-hooks/exhaustive-deps
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
    address: (f.address ?? '').trim() || undefined, ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
    lineId: f.lineId.trim() || undefined, facebook: f.facebook.trim() || undefined,
    gender: f.gender || undefined, birth: f.birth || undefined, first: f.first || undefined, since: f.since || undefined, at: Date.now(), skills: f.skills.trim() || undefined,
    serve: serve.length ? serve.map((x) => (x === OTHER_SERVE ? (f.other.trim() ? `${OTHER_SERVE}: ${f.other.trim()}` : OTHER_SERVE) : x)) : undefined, serveDays: days.length ? days : undefined, note: f.note.trim() || undefined,
  })
  const initial = [link.name, link.nick, link.tel, link.gender, link.birth, link.first, link.lineId, link.facebook, link.skills]
  const have = initial.filter((x) => (x ?? '').trim()).length
  const empty = initial.length - have
  const ok = f.name.trim().length > 0
  const sendLine = () => { if (!ok) return setMsg('ใส่ชื่อ-สกุลก่อนส่ง'); window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent(replyText(answer()))}` }
  const copy = async () => {
    if (!ok) return setMsg('ใส่ชื่อ-สกุลก่อนส่ง')
    try { await navigator.clipboard.writeText(replyText(answer())); setCopied(true); setMsg('คัดลอกแล้ว — นำไปวางในไลน์ส่งให้ฝ่ายทะเบียน') } catch { setMsg('คัดลอกไม่สำเร็จ — ใช้ปุ่มส่งทางไลน์แทน') }
  }
  const set = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setCopied(false) }
  return shell(
    <form className="card" onSubmit={(e) => e.preventDefault()} aria-label="แบบกรอกข้อมูลสมาชิก">
      {grouped && link && <p className="small" style={{ margin: 0 }}>{link.mid === NEW_MID ? 'ท่านไม่พบชื่อในรายการ — กรอกข้อมูลของท่านด้านล่าง ฝ่ายทะเบียนจะเพิ่มชื่อให้' : <>ท่านเลือกชื่อ <b>{link.name}</b> · <button type="button" className="mini" onClick={onReselect}>เลือกใหม่</button></>}</p>}
      {restored && <p className="small" role="status" style={{ margin: 0, background: '#e8f6ea', padding: '0.4rem 0.6rem', borderRadius: 10 }}>✅ นำข้อมูลที่ท่านกรอกไว้ครั้งก่อนกลับมาให้แล้ว — แก้ไขหรือเพิ่มเติมได้ แล้วกดส่งกลับอีกครั้ง <button type="button" className="mini" onClick={() => { try { localStorage.removeItem(draftKey(link.mid)) } catch { /* ignore */ } location.reload() }}>เริ่มใหม่จากข้อมูลตั้งต้น</button></p>}
      <p style={{ margin: 0 }}>กรุณาตรวจและกรอกข้อมูลของท่านให้ครบ ข้อมูลที่ส่งจะไปถึงฝ่ายทะเบียนเท่านั้น</p>
      {link.mid !== BY_NAME && link.mid !== NEW_MID && (
        <div className="mform__guide" role="note">
          <b>📋 ตรวจข้อมูลของท่านทุกช่อง</b>
          <ul>
            <li>ข้อมูลที่ฝ่ายทะเบียนมีอยู่แล้ว ระบบ<b>ดึงมาใส่ให้</b>ในแต่ละช่องแล้ว ({have} ช่อง) — <b>แก้ไขได้ทุกจุด</b></li>
            <li>ช่องที่ยังว่าง ({empty} ช่อง) กรุณา<b>กรอกให้ครบ</b></li>
            <li>ถ้าข้อมูลไหนไม่ตรงกับความจริง เช่น ชื่อ เบอร์โทร วัน เดือน ปีเกิด ให้<b>แก้ก่อนส่ง</b> ฝ่ายทะเบียนจะตรวจส่วนที่เปลี่ยนอีกครั้ง</li>
          </ul>
        </div>
      )}
      {link.mid === BY_NAME && <p className="mform__warn" role="note">✍️ พิมพ์ <b>ชื่อ-นามสกุลจริง</b> ให้ตรงกับที่ลงทะเบียนไว้กับคริสตจักร เพื่อให้ฝ่ายทะเบียนจับคู่ข้อมูลของท่านได้ถูกต้อง</p>}
      <p className="mform__warn" role="note">⚠️ กรุณาตรวจ <b>ชื่อ-นามสกุล</b> และ <b>ชื่อเล่น</b> ให้ถูกต้อง เพราะจะใช้เป็นชื่อในทะเบียนของคริสตจักร ถ้าสะกดไม่ถูก ให้แก้ในช่องด้านล่างก่อนส่ง</p>
      <div className="field"><label htmlFor="mf-name">ชื่อ-สกุล <span className="mform__chk">ตรวจให้ถูกต้อง</span></label><input id="mf-name" className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></div>
      <div className="field"><label htmlFor="mf-nick">ชื่อเล่น <span className="mform__chk">ตรวจให้ถูกต้อง</span></label><input id="mf-nick" className="input" value={f.nick} onChange={(e) => set({ nick: e.target.value })} /></div>
      <div className="field"><label htmlFor="mf-tel">โทรศัพท์{!f.tel.trim() && <span className="mform__empty">ยังว่าง — กรุณากรอก</span>}</label><input id="mf-tel" className="input" type="tel" inputMode="tel" value={f.tel} onChange={(e) => set({ tel: e.target.value })} autoComplete="tel" /></div>
      <div className="field"><label htmlFor="mf-line">LINE ID <span className="muted small">(ไม่บังคับ)</span></label><input id="mf-line" className="input" value={f.lineId} onChange={(e) => set({ lineId: e.target.value })} autoCapitalize="none" autoCorrect="off" placeholder="ไอดีไลน์ของท่าน" /></div>
      <div className="field"><label htmlFor="mf-fb">Facebook <span className="muted small">(ไม่บังคับ · พิมพ์ชื่อเฟซบุ๊ก/ชื่อเพจ หรือวางลิงก์ก็ได้)</span></label><input id="mf-fb" className="input" value={f.facebook} onChange={(e) => set({ facebook: e.target.value })} placeholder="ชื่อใน Facebook หรือลิงก์โปรไฟล์/เพจ" /></div>
      <div className="field"><label htmlFor="mf-addr">ที่อยู่ปัจจุบัน <span className="muted small">(ไม่บังคับ)</span></label><textarea id="mf-addr" className="input" rows={3} value={f.address ?? ''} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด" />
        <button type="button" className="btn btn--ghost btn--block" onClick={locate} style={{ marginTop: 6 }}>📍 บันทึกพิกัดปัจจุบัน</button>
        <p className="small" role="note" style={{ margin: '0.3rem 0 0', color: '#b45309', fontWeight: 700 }}>⚠️ กดเมื่ออยู่ที่บ้านเท่านั้น — ระบบจะใช้ตำแหน่งนี้เป็นพิกัดบ้านของท่านบนแผนที่ (ถ้าไม่ได้อยู่บ้าน อย่ากด)</p>
        {geoMsg && <p className="small" role="status" style={{ margin: '0.2rem 0 0' }}>{geoMsg}</p>}
        {geo && <p className="small" role="status" style={{ margin: '0.2rem 0 0', color: '#1b7f4b', fontWeight: 700 }}>✅ บันทึกพิกัดแล้ว ({geo.lat}, {geo.lng}){geo.acc ? ` · คลาดเคลื่อนประมาณ ${geo.acc} ม.` : ''} <button type="button" className="mini" onClick={() => { setGeo(null); setCopied(false) }}>ลบพิกัด</button></p>}</div>
      <div className="field"><label id="mf-g">เพศ{!f.gender && <span className="mform__empty">ยังว่าง — กรุณาเลือก</span>}</label>
        <div className="row" role="radiogroup" aria-labelledby="mf-g" style={{ gap: 6 }}>
          {['ชาย', 'หญิง'].map((g) => <button key={g} type="button" role="radio" aria-checked={f.gender === g} className={f.gender === g ? 'btn btn--gold' : 'btn btn--ghost'} onClick={() => set({ gender: f.gender === g ? '' : g })}>{g}</button>)}
        </div></div>
      <div className="field"><label htmlFor="mf-birth">วันเกิด{!f.birth && <span className="mform__empty">ยังว่าง — กรุณากรอก</span>}</label><input id="mf-birth" className="input" type="date" value={f.birth} onChange={(e) => set({ birth: e.target.value })} /></div>
      <div className="field"><label htmlFor="mf-first">วัน เดือน ปี ที่มาร่วมนมัสการครั้งแรก <span className="muted small">(โดยประมาณ · จำไม่ได้แน่ ใส่วันที่ใกล้เคียงได้)</span>{!f.first && <span className="mform__empty">ยังว่าง — กรุณากรอก</span>}</label><input id="mf-first" className="input" type="date" value={f.first} onChange={(e) => set({ first: e.target.value })} /></div>
      <div className="field"><label htmlFor="mf-since">วัน เดือน ปี ที่คริสตจักรรับท่านเป็นสมาชิก <span className="muted small">(ไม่บังคับ · ถ้าไม่ทราบ เว้นว่างได้)</span></label><input id="mf-since" className="input" type="date" value={f.since} onChange={(e) => set({ since: e.target.value })} /></div>
      <div className="field"><label>อาชีพ / ความสามารถของท่าน <span className="muted small">(ไม่บังคับ)</span></label>
        <button type="button" className="btn btn--ghost btn--block" aria-haspopup="dialog" onClick={() => setPick('skills')}>💼 กรอก อาชีพ / ความสามารถ{f.skills.trim() ? ' (กรอกแล้ว)' : ''}</button>
        {f.skills.trim() && <Fold label="อาชีพ / ความสามารถที่กรอก"><p style={{ margin: 0 }}>{f.skills.trim()}</p></Fold>}</div>
      <div className="field"><label>งานรับใช้คริสตจักรที่ท่านเต็มใจช่วย <span className="muted small">(ติ๊กได้หลายข้อ · ไม่บังคับ)</span></label>
        <button type="button" className="btn btn--ghost btn--block" aria-haspopup="dialog" onClick={() => setPick('serve')}>🙌 เลือก งาน/หน้าที่ เพื่อมีส่วนในการรับใช้{serve.length ? ` (เลือกแล้ว ${serve.length} ข้อ)` : ''}</button>
        {serve.length > 0 && (
          <Fold label="งานรับใช้ที่เลือกไว้" count={serve.length}>
            <div className="mform__chips" aria-label="งานรับใช้ที่เลือกไว้">{serve.map((o) => <span key={o} className="mform__chip on">✓ {o === OTHER_SERVE && f.other.trim() ? `${OTHER_SERVE}: ${f.other.trim()}` : o}</span>)}</div>
          </Fold>
        )}</div>
      <div className="field"><label>วันที่สะดวกรับใช้ <span className="muted small">(ติ๊กได้หลายวัน · ไม่บังคับ)</span></label>
        <button type="button" className="btn btn--ghost btn--block" aria-haspopup="dialog" onClick={() => setPick('days')}>📅 เลือก วันที่สะดวกรับใช้{days.length ? ` (เลือกแล้ว ${days.length} วัน)` : ''}</button>
        {days.length > 0 && (
          <Fold label="วันที่สะดวกที่เลือกไว้" count={days.length}>
            <div className="mform__chips">{days.map((o) => <span key={o} className="mform__chip on">✓ {o}</span>)}</div>
          </Fold>
        )}</div>
      <div className="field"><label htmlFor="mf-note">ข้อความถึงฝ่ายทะเบียน <span className="muted small">(ไม่บังคับ เช่น ย้ายที่อยู่ เปลี่ยนเบอร์)</span></label><textarea id="mf-note" className="input" rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} /></div>
      {msg && <p role="status" className="small" style={{ margin: 0 }}>{msg}</p>}
      <button type="button" className="btn btn--gold bigbtn btn--block" disabled={!ok} onClick={sendLine}>📤 ส่งกลับทางไลน์</button>
      <button type="button" className="btn btn--ghost btn--block" disabled={!ok} onClick={copy}>{copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกข้อความ (ถ้าส่งไลน์ไม่ได้)'}</button>
      {pick === 'skills' && (
        <Sheet title="กรอก อาชีพ / ความสามารถ" onClose={() => setPick('')}>
          <p className="small muted" style={{ margin: 0 }}>เช่น ครู พยาบาล ช่างไฟ เล่นกีตาร์ ทำอาหาร — พิมพ์ได้หลายอย่าง คั่นด้วยเครื่องหมายจุลภาค</p>
          <textarea className="input" rows={3} aria-label="อาชีพ / ความสามารถ" value={f.skills} onChange={(e) => set({ skills: e.target.value })} placeholder="อาชีพหรือความสามารถของท่าน" autoFocus />
          <button type="button" className="btn btn--gold btn--block" onClick={() => setPick('')}>✓ เสร็จ</button>
        </Sheet>
      )}
      {pick === 'serve' && (
        <Sheet title="เลือก งาน/หน้าที่ เพื่อมีส่วนในการรับใช้" onClose={() => setPick('')}>
          <p className="small muted" style={{ margin: 0 }}>ติ๊กได้หลายข้อ — งานที่ท่านเต็มใจช่วยคริสตจักร</p>
          <div className="mform__chips" role="group" aria-label="งานรับใช้">
            {[...SERVE_OPTIONS, OTHER_SERVE].map((o) => <button key={o} type="button" role="checkbox" aria-checked={serve.includes(o)} className={`mform__chip${serve.includes(o) ? ' on' : ''}`} onClick={() => toggle(serve, o, setServe)}>{serve.includes(o) ? '✓ ' : ''}{o}</button>)}
          </div>
          {serve.includes(OTHER_SERVE) && <input className="input" aria-label="งานรับใช้อื่นๆ" placeholder="พิมพ์งานรับใช้อื่นๆ ที่ท่านช่วยได้" value={f.other} onChange={(e) => set({ other: e.target.value })} />}
          <button type="button" className="btn btn--gold btn--block" onClick={() => setPick('')}>✓ เสร็จ ({serve.length} ข้อ)</button>
        </Sheet>
      )}
      {pick === 'days' && (
        <Sheet title="เลือก วันที่สะดวกรับใช้" onClose={() => setPick('')}>
          <p className="small muted" style={{ margin: 0 }}>ติ๊กได้หลายวัน</p>
          <div className="mform__chips" role="group" aria-label="วันที่สะดวกรับใช้">
            {DAY_OPTIONS.map((o) => <button key={o} type="button" role="checkbox" aria-checked={days.includes(o)} className={`mform__chip${days.includes(o) ? ' on' : ''}`} onClick={() => toggle(days, o, setDays)}>{days.includes(o) ? '✓ ' : ''}{o}</button>)}
          </div>
          <button type="button" className="btn btn--gold btn--block" onClick={() => setPick('')}>✓ เสร็จ ({days.length} วัน)</button>
        </Sheet>
      )}
      <p className="small muted" style={{ margin: 0 }}>กดส่งแล้ว เลือกแชตฝ่ายทะเบียนใน LINE แล้วกดส่งข้อความอีกครั้งหนึ่ง ฝ่ายทะเบียนจะตรวจและบันทึกให้</p>
    </form>,
  )
}

/** สรุปที่เลือกไว้ใต้แถบ: พับ/ขยายได้ (ย่อเหลือจำนวน · กดขยายเพื่อดูรายการ) */
function Fold({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mform__fold">
      <button type="button" className="mini" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▲ พับ' : '▼ ขยาย'} {label}{count !== undefined ? ` (${count})` : ''}</button>
      {open && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  )
}
