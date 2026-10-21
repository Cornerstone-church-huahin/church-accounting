import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { myRole, whoAmI } from '../lib/access'
import { audioExt, canDictate, canRecord, pickAudioType, startDictation } from '../lib/audioNote'
import { canTouchEvent } from '../lib/calendar'
import { useNotes } from '../lib/data'
import { cacheImage, cachedImage } from '../lib/imageCache'
import { fmtDate, newId, todayISO } from '../lib/money'
import { getBinary, getSync, putBinary } from '../lib/sync'
import type { Note, NoteClip } from '../lib/types'

const MAX_SECS = 15 * 60
/** เสียงในโน้ตที่กำลังแก้: ของเดิม (path) หรือที่เพิ่งอัด (blob) */
interface Clip { key: string; type: string; secs: number; path?: string; blob?: Blob }
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const preview = (n: Note) => (n.body.trim().split('\n')[0] || '').slice(0, 90)

/** บันทึกโน้ตของห้องทำงาน: เขียนเอง · พูดให้พิมพ์ (ไทย) · อัดเสียงแนบ — ใช้ร่วมกันทุกเครื่องที่เข้าใช้ร่วม แก้/ลบได้เฉพาะผู้บันทึก */
export default function Notes() {
  const notes = useNotes()
  const [editing, setEditing] = useState<Note | 'new' | null>(null)
  const me = whoAmI()
  return (
    <>
      <div className="page-head"><h1>📝 บันทึกโน้ต</h1><Link to="/meeting" className="mini">‹ ห้องทำงาน</Link></div>
      {editing ? <Editor key={editing === 'new' ? 'new' : editing.id} note={editing === 'new' ? null : editing} put={notes.put} remove={notes.remove} onDone={() => setEditing(null)} /> : (
        <>
          <button type="button" className="btn btn--gold" onClick={() => setEditing('new')}>＋ โน้ตใหม่</button>
          {notes.list.length === 0 && <p className="empty">ยังไม่มีโน้ต — กด “＋ โน้ตใหม่” เพื่อเขียน พูดให้พิมพ์ หรืออัดเสียง</p>}
          <ul className="list" aria-label="รายการโน้ต">
            {notes.list.map((n) => (
              <li key={n.id}>
                <button type="button" className="row row--between" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', padding: '0.5rem 0' }} onClick={() => setEditing(n)} aria-label={`เปิดโน้ต ${n.title || preview(n) || 'ไม่มีชื่อ'}`}>
                  <span className="grow"><b>{n.title || preview(n) || '(เสียงอย่างเดียว)'}</b><br />
                    <span className="small muted">{[fmtDate(n.date), n.rec, n.clips?.length ? `🎧 ${n.clips.length} คลิป` : ''].filter(Boolean).join(' · ')}</span>
                    {n.title && preview(n) && <><br /><span className="small">{preview(n)}</span></>}
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="small muted">โน้ตใช้ร่วมกันทุกเครื่องที่เข้าใช้ร่วม · แก้ไข/ลบได้เฉพาะผู้บันทึก{me.name ? ` (ตอนนี้: ${me.name})` : ''}</p>
        </>
      )}
    </>
  )
}

function Editor({ note, put, remove, onDone }: { note: Note | null; put: (x: Note[]) => boolean; remove: (id: string) => boolean; onDone: () => void }) {
  const allowed = !note || canTouchEvent(note, whoAmI().id, myRole() === 'admin')
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [clips, setClips] = useState<Clip[]>(() => (note?.clips ?? []).map((c, i) => ({ key: `o${i}`, type: c.type, secs: c.secs, path: c.path })))
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [recSecs, setRecSecs] = useState<number | null>(null) // null = ไม่ได้อัด
  const stopDictate = useRef<() => void>(() => undefined)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const tick = useRef<number | undefined>(undefined)

  useEffect(() => () => { stopDictate.current(); window.clearInterval(tick.current); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach((t) => t.stop()) }, [])

  const toggleDictate = () => {
    if (dictating) return stopDictate.current()
    setMsg('')
    setDictating(true)
    stopDictate.current = startDictation(
      (t) => t && setBody((b) => `${b}${b && !/\s$/.test(b) ? ' ' : ''}${t}`),
      (err) => { setDictating(false); if (err) setMsg(err) },
    )
  }
  const startRec = async () => {
    setMsg('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = s
      const type = pickAudioType()
      const mr = new MediaRecorder(s, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 })
      const parts: Blob[] = []
      const t0 = Date.now()
      mr.ondataavailable = (e) => e.data.size && parts.push(e.data)
      mr.onstop = () => {
        window.clearInterval(tick.current); s.getTracks().forEach((t) => t.stop()); setRecSecs(null)
        const t = mr.mimeType || type || 'audio/webm'
        const blob = new Blob(parts, { type: t })
        if (blob.size) setClips((cs) => [...cs, { key: newId('clip'), type: t, secs: Math.max(1, Math.round((Date.now() - t0) / 1000)), blob }])
      }
      recorder.current = mr
      mr.start(1000)
      setRecSecs(0)
      tick.current = window.setInterval(() => setRecSecs((v) => { const n = (v ?? 0) + 1; if (n >= MAX_SECS) mr.stop(); return n }), 1000)
    } catch (e) {
      setMsg(e instanceof DOMException && e.name === 'NotAllowedError' ? 'ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน' : 'เปิดไมโครโฟนไม่ได้')
    }
  }
  const stopRec = () => recorder.current?.stop()

  const save = async () => {
    if (!title.trim() && !body.trim() && clips.length === 0) return setMsg('เขียนหรืออัดเสียงก่อนบันทึก')
    setSaving(true); setMsg('')
    try {
      const id = note?.id ?? newId('note')
      const cfg = getSync()
      const out: NoteClip[] = []
      let i = 0
      for (const c of clips) {
        if (c.path) { out.push({ path: c.path, type: c.type, secs: c.secs }); continue }
        const path = `notes/audio/${id}-${Date.now().toString(36)}${i++}.${audioExt(c.type)}`
        const data = await c.blob!.arrayBuffer()
        await cacheImage(path, data, c.type)
        if (cfg) await putBinary(cfg, path, data, 'เสียงโน้ต')
        out.push({ path, type: c.type, secs: c.secs })
      }
      const n: Note = { ...(note ?? { id, updated: 0, recId: whoAmI().id, rec: whoAmI().name, date: todayISO() }), title: title.trim(), body, clips: out.length ? out : undefined }
      if (!put([n])) { setMsg('ไม่มีสิทธิ์บันทึกโน้ต'); setSaving(false); return }
      onDone()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); setSaving(false) }
  }

  return (
    <section className="card" aria-label={note ? 'แก้ไขโน้ต' : 'โน้ตใหม่'}>
      {!allowed && <p className="small muted" role="status">โน้ตนี้ {note?.rec ? `ของ ${note.rec} ` : ''}แก้ไข/ลบได้เฉพาะผู้บันทึก — ดูและฟังได้อย่างเดียว</p>}
      <div className="field"><label htmlFor="nt-t">หัวข้อ (ไม่บังคับ)</label><input id="nt-t" className="input" value={title} disabled={!allowed} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label htmlFor="nt-b">ข้อความ</label><textarea id="nt-b" className="input" rows={9} value={body} disabled={!allowed} onChange={(e) => setBody(e.target.value)} placeholder="พิมพ์โน้ตที่นี่ หรือกด 🎙️ พูดให้พิมพ์" /></div>
      {allowed && (
        <div className="row" style={{ margin: '0.5rem 0' }}>
          {canDictate() && <button type="button" className="btn" aria-pressed={dictating} onClick={toggleDictate} disabled={recSecs !== null}>{dictating ? '⏹ หยุดพูดให้พิมพ์' : '🎙️ พูดให้พิมพ์'}</button>}
          {canRecord() && (recSecs === null
            ? <button type="button" className="btn" onClick={startRec} disabled={dictating}>🔴 อัดเสียง</button>
            : <button type="button" className="btn btn--gold" onClick={stopRec}>⏹ หยุดอัด · {mmss(recSecs)}</button>)}
          {!canDictate() && !canRecord() && <span className="small muted">เบราว์เซอร์นี้ยังไม่รองรับไมโครโฟน</span>}
        </div>
      )}
      {dictating && <p className="small" role="status">กำลังฟัง… พูดเป็นภาษาไทยได้เลย ข้อความจะเติมต่อท้ายโน้ต</p>}
      {clips.length > 0 && (
        <ul className="list" aria-label="เสียงที่แนบ">
          {clips.map((c) => <ClipRow key={c.key} clip={c} canDelete={allowed} onDelete={() => setClips((cs) => cs.filter((x) => x.key !== c.key))} />)}
        </ul>
      )}
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row" style={{ marginTop: '0.6rem' }}>
        {allowed && <button type="button" className="btn btn--gold" onClick={save} disabled={saving || recSecs !== null}>{saving ? 'กำลังบันทึก…' : 'บันทึกโน้ต'}</button>}
        <button type="button" className="btn" onClick={onDone}>{allowed ? 'ยกเลิก' : 'กลับ'}</button>
        {note && allowed && <button type="button" className="mini" onClick={() => { if (window.confirm('ลบโน้ตนี้ ?')) { if (remove(note.id)) onDone(); else setMsg('ไม่มีสิทธิ์ลบ') } }}>ลบโน้ต</button>}
      </div>
    </section>
  )
}

function ClipRow({ clip, canDelete, onDelete }: { clip: Clip; canDelete: boolean; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(() => (clip.blob ? URL.createObjectURL(clip.blob) : null))
  const [err, setErr] = useState('')
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  const load = async () => {
    setErr('')
    try {
      const cfg = getSync()
      const b = (await cachedImage(clip.path!)) ?? (cfg ? await getBinary(cfg, clip.path!) : null)
      if (!b) return setErr('ไม่พบไฟล์เสียงในเครื่องนี้')
      setUrl(URL.createObjectURL(new Blob([b], { type: clip.type })))
    } catch (e) { setErr(e instanceof Error ? e.message : 'เปิดเสียงไม่ได้') }
  }
  return (
    <li className="row row--between">
      <span className="small">🎧 {mmss(clip.secs)}{clip.blob ? ' (ยังไม่บันทึก)' : ''}</span>
      {url ? <audio controls src={url} style={{ flex: 1, minWidth: 0 }} aria-label="เล่นเสียงโน้ต" /> : <button type="button" className="mini" onClick={load}>▶ เล่น</button>}
      {canDelete && <button type="button" className="mini" onClick={onDelete} aria-label="เอาคลิปเสียงออก">เอาออก</button>}
      {err && <span className="error small">{err}</span>}
    </li>
  )
}
