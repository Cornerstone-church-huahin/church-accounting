import { useRef, useState } from 'react'
import { holdTalk, voiceMode, type VoiceState } from '../lib/voiceInput'

/**
 * แถบพูดสั่งงานติดล่างหน้า (ระยะ 1: พูด → เห็นข้อความ → ส่ง/พูดใหม่ · ยังไม่ส่งให้ AI)
 * กดปุ่มไมค์ค้างเพื่อพูด ปล่อยเพื่อหยุด · ตรวจ/แก้ข้อความได้ก่อนกดส่ง เพราะเสียงภาษาไทยอาจฟังผิด
 * onSend คืนข้อความสั้นๆ ที่บอกผู้ใช้ว่าเกิดอะไรขึ้น · undo = ปุ่มย้อนกลับ (จำนวนขั้นที่ย้อนได้ + ฟังก์ชันย้อน)
 */
export default function VoiceDock({ onSend, undo }: { onSend: (text: string) => string | void; undo?: { steps: number; run: () => void } }) {
  const [state, setState] = useState<VoiceState | 'idle'>('idle')
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [showLog, setShowLog] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const mode = voiceMode()

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (stopRef.current || state === 'transcribing') return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setErr(''); setNote('')
    stopRef.current = holdTalk({
      onState: setState,
      onText: (t) => { setState('idle'); stopRef.current = null; setText((old) => (old ? `${old} ${t}` : t)) },
      onError: (m) => { setState('idle'); stopRef.current = null; setErr(m) },
    })
  }
  const up = () => { const s = stopRef.current; if (s && state === 'listening') s() }

  const send = () => {
    const t = text.trim()
    if (!t) return
    const msg = onSend(t)
    setLog((l) => [t, ...l].slice(0, 20))
    setNote(typeof msg === 'string' ? msg : 'ส่งแล้ว')
    setText('')
  }

  const busy = state !== 'idle'
  return (
    <div className="vdock no-print" role="region" aria-label="พูดสั่งงาน">
      {(text || err || note || busy || showLog) && (
        <div className="vdock__panel">
          {state === 'listening' && <p className="vdock__live" role="status">🎙️ กำลังฟัง… ปล่อยนิ้วเมื่อพูดจบ</p>}
          {state === 'transcribing' && <p className="vdock__live" role="status">⏳ กำลังแปลงเสียงเป็นข้อความ…</p>}
          {err && <p className="error small" role="alert" style={{ margin: 0 }}>{err}</p>}
          {note && <p className="small" role="status" style={{ margin: 0 }}>✓ {note}</p>}
          {text && (
            <>
              <label className="small muted" htmlFor="vd-text">ข้อความที่ฟังได้ (แก้ได้ก่อนส่ง)</label>
              <textarea id="vd-text" className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
              <div className="vdock__btns">
                <button type="button" className="btn btn--gold" onClick={send}>ส่ง</button>
                <button type="button" className="btn btn--ghost" onClick={() => { setText(''); setErr('') }}>พูดใหม่</button>
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
        <button type="button" className="mini" onClick={() => setShowLog((v) => !v)} aria-pressed={showLog}>🕘 ประวัติ</button>
        <button type="button" className="mini" disabled={!undo || undo.steps === 0} onClick={undo?.run} aria-label="ย้อนกลับ">↩ ย้อนกลับ{undo ? ` (${undo.steps})` : ''}</button>
        <button type="button" className={`vdock__mic${busy ? ' vdock__mic--on' : ''}`} aria-label="กดค้างเพื่อพูด" aria-describedby="vd-hint"
          disabled={mode === 'none'} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
          🎤
        </button>
      </div>
      <p id="vd-hint" className="vdock__hint">{mode === 'none' ? 'เครื่องนี้ใช้พูดสั่งไม่ได้' : 'กดค้างเพื่อพูด · ปล่อยเพื่อหยุด'}</p>
    </div>
  )
}
