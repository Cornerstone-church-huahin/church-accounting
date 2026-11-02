import { useEffect, useRef, useState } from 'react'
import { createHistory } from '../lib/editHistory'
import { startListening, voiceMode } from '../lib/voiceInput'

type Field = HTMLInputElement | HTMLTextAreaElement
const isFillable = (el: EventTarget | null): el is Field =>
  (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ['text', 'search', ''].includes(el.type))) && !el.readOnly && !el.disabled
/** ใส่ค่าแล้วให้ React รับรู้เหมือนพิมพ์เอง (ช่องของฟอร์มเป็น controlled) */
function setValue(el: Field, v: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const labelOf = (el: Field) => {
  const t = el.getAttribute('aria-label') || (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : '') || el.placeholder || 'ช่องนี้'
  return t.replace(/\s*[(·].*$/, '').trim().slice(0, 30)
}

/**
 * แถบพูดสั่งงานติดล่างหน้า: แตะไมค์เพื่อพูด → ข้อความขึ้นทันทีระหว่างพูด (แก้ได้) → ส่ง/พูดใหม่
 * ส่ง = ใส่ข้อความลง “ช่องที่แตะเลือกไว้” ในฟอร์ม (เฉพาะช่องกรอกข้อความใน scope · ไม่แตะเลขที่/วันที่/หัวท้าย/ลายเซ็น) · ย้อนกลับได้
 * ยังไม่ส่งให้ AI (ระยะ 2)
 */
export default function VoiceDock({ scope, onStart }: { scope: string; /** เริ่มพูดแล้ว (เช่น เปิดโหมดแบ่งจอ) */ onStart?: () => void }) {
  const [target, setTarget] = useState<Field | null>(null)
  const hist = useRef(createHistory<{ el: Field; prev: string; label: string }>(50))
  const [steps, setSteps] = useState(0)
  useEffect(() => {
    const on = (e: FocusEvent) => { if (isFillable(e.target) && document.querySelector(scope)?.contains(e.target)) setTarget(e.target) }
    // เลือกช่องเป็นเป้าหมายโดยไม่โฟกัส (เช่น หลังกด ＋ ในรายการวาระ) — ไม่เรียกแป้นพิมพ์ขึ้นมา
    const pick = (e: Event) => { const el = (e as CustomEvent<Element>).detail; if (isFillable(el) && document.querySelector(scope)?.contains(el)) setTarget(el) }
    document.addEventListener('focusin', on)
    window.addEventListener('voice-target', pick)
    return () => { document.removeEventListener('focusin', on); window.removeEventListener('voice-target', pick) }
  }, [scope])
  // ไฮไลต์ช่องที่เสียงจะใส่ให้
  useEffect(() => {
    if (!target) return
    target.setAttribute('data-voice-target', '1')
    return () => target.removeAttribute('data-voice-target')
  }, [target])
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [showLog, setShowLog] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const baseRef = useRef('')
  const mode = voiceMode()
  // ข้อความแจ้งสถานะหายเองหลัง 5 วินาที (ไม่บังฟอร์ม)
  useEffect(() => { if (!err) return; const t = window.setTimeout(() => setErr(''), 5000); return () => window.clearTimeout(t) }, [err])

  /** แตะเพื่อเริ่มพูด (ข้อความขึ้นสดระหว่างพูด) · แตะอีกครั้งเพื่อหยุด */
  const toggle = () => {
    if (listening) { stopRef.current?.(); return }
    setErr('')
    baseRef.current = text.trim() ? `${text.trim()} ` : ''
    setListening(true)
    onStart?.()
    stopRef.current = startListening({
      onText: (t) => setText(baseRef.current + t),
      onBusy: setBusy,
      onError: (m) => setErr(m),
      onDone: () => { setListening(false); stopRef.current = null },
    })
  }

  const send = () => {
    const t = text.trim()
    if (!t) return
    setErr('')
    if (!target || !document.contains(target)) return setErr('แตะช่องที่ต้องการใส่ข้อความก่อน (เช่น ช่องข้อย่อย 7.1) แล้วแตะไมค์พูด และกดส่ง')
    const prev = target.value, label = labelOf(target)
    hist.current.push({ el: target, prev, label })
    setValue(target, prev.trim() ? `${prev}${target instanceof HTMLTextAreaElement ? '\n' : ' '}${t}` : t)
    setSteps(hist.current.size)
    setLog((l) => [`${label}: ${t}`, ...l].slice(0, 20))
    setText('')
  }
  const undo = () => {
    const h = hist.current.undo()
    setSteps(hist.current.size)
    if (!h) return
    if (!document.contains(h.el)) return setErr('ย้อนไม่ได้ — ช่องนั้นถูกลบหรือย้ายไปแล้ว')
    setValue(h.el, h.prev)
    setErr('')
  }

  return (
    <div className="vdock no-print" role="region" aria-label="พูดสั่งงาน">
      {(text || err || listening || showLog) && (
        <div className="vdock__panel">
          {listening && <p className="vdock__live" role="status">🎙️ กำลังฟัง… พูดได้เลย ข้อความจะขึ้นทันที · แตะไมค์อีกครั้งเมื่อพูดจบ{busy ? ' (กำลังถอดเสียง…)' : ''}</p>}
          {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
          {err && !text && <button type="button" className="mini" style={{ alignSelf: 'flex-end' }} onClick={() => { setErr('') }} aria-label="ปิดข้อความ">ปิด</button>}
          {text && (
            <>
              <label className="small muted" htmlFor="vd-text">ข้อความที่ฟังได้ (แก้ได้ก่อนส่ง)</label>
              <textarea id="vd-text" className="input" rows={3} value={text} readOnly={listening} onChange={(e) => setText(e.target.value)} />
              <div className="vdock__btns">
                <button type="button" className="btn btn--gold" onClick={send} disabled={listening}>ส่ง</button>
                <button type="button" className="btn btn--ghost" onClick={() => { stopRef.current?.(); setText(''); setErr('') }}>พูดใหม่</button>
              </div>
            </>
          )}
          {showLog && (
            <div className="small" aria-label="ประวัติคำสั่ง">
              <b>ประวัติคำสั่ง</b>
              {log.length === 0 ? <p className="muted" style={{ margin: 0 }}>ยังไม่มีคำสั่ง</p> : <ol style={{ margin: '0.2rem 0 0', paddingLeft: '1.2rem' }}>{log.map((l, i) => <li key={i}>{l}</li>)}</ol>}
            </div>
          )}
        </div>
      )}
      <div className="vdock__bar">
        {target && document.contains(target) && <span className="vdock__target--bar" role="status">✍️ <b>{labelOf(target)}</b> <button type="button" className="mini" onClick={() => setTarget(null)} aria-label="ยกเลิกการเลือก">✕</button></span>}
        <button type="button" className="mini vdock__log" onClick={() => setShowLog((v) => !v)} aria-pressed={showLog} aria-label="ประวัติ">🕘<span className="vdock__lbl"> ประวัติ</span></button>
        <button type="button" className="mini" disabled={steps === 0} onClick={undo} aria-label="ย้อนกลับ">↩<span className="vdock__lbl"> ย้อนกลับ</span> ({steps})</button>
        <button type="button" className={`vdock__mic${listening ? ' vdock__mic--on' : ''}`} aria-label={listening ? 'แตะเพื่อหยุดพูด' : 'แตะเพื่อพูด'} aria-pressed={listening} aria-describedby="vd-hint"
          disabled={mode === 'none'} onClick={toggle}>
          {listening ? '⏹' : '🎤'}
        </button>
      </div>
      {target && document.contains(target) && <p className="vdock__hint vdock__target vdock__target--below" role="status">✍️ จะใส่ลงช่อง: <b>{labelOf(target)}</b> <button type="button" className="mini" onClick={() => setTarget(null)}>ยกเลิกการเลือก</button></p>}
      <p id="vd-hint" className="vdock__hint">{mode === 'none' ? 'เครื่องนี้ใช้พูดสั่งไม่ได้' : 'แตะไมค์เพื่อพูด · ข้อความขึ้นทันที · แตะอีกครั้งเพื่อหยุด'}</p>
    </div>
  )
}
