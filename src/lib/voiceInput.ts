import { canDictate, canRecord, pickAudioType, speechCtor } from './audioNote'
import { transcribeAudio } from './gemini'

/**
 * พูดแล้วเห็นข้อความทันที: แตะปุ่มไมค์ครั้งเดียวเพื่อเริ่ม · ข้อความขึ้นระหว่างพูด · แตะอีกครั้งเพื่อหยุด
 * · native = ระบบพูดให้พิมพ์ของเบราว์เซอร์ (Android/Chrome) ข้อความขึ้นสดทีละคำ ฟรี ไม่ใช้โควตา
 * · record = เครื่องที่ไม่มีระบบนั้น (iPhone/Safari): อัดเสียงเป็นช่วงสั้นๆ แล้วให้ Gemini ถอดเสียงทีละช่วง ข้อความขึ้นช้ากว่าเสียงเล็กน้อย
 */
export type VoiceMode = 'native' | 'record' | 'none'
export const voiceMode = (): VoiceMode => (canDictate() ? 'native' : canRecord() ? 'record' : 'none')

export interface ListenHandlers {
  /** ข้อความรวมของรอบพูดนี้ (อัปเดตสดระหว่างพูด) */
  onText: (full: string) => void
  /** จบรอบพูดแล้ว (หยุดเอง/แตะหยุด) */
  onDone: () => void
  onError: (m: string) => void
  /** กำลังถอดเสียงช่วงที่เพิ่งพูด (เฉพาะโหมดอัดเสียง) */
  onBusy?: (busy: boolean) => void
}

/**
 * รวมผลจากระบบพูดให้พิมพ์เป็นข้อความเดียว โดยตัดข้อความที่ซ้ำ: บางเครื่อง (Android/Chrome โหมดต่อเนื่อง) ส่งประโยคเดิมซ้ำเป็นผลสุดท้าย + ผลชั่วคราว
 * ทำให้พูดครั้งเดียวขึ้นสองรอบ เช่น “การทำอาหาร การทำอาหาร”
 */
export function mergeSpeech(parts: string[]): string {
  const out: string[] = []
  for (const raw of parts) {
    const t = raw.trim()
    if (!t) continue
    const prev = out[out.length - 1]
    if (prev === t || (prev && prev.startsWith(t))) continue   // ซ้ำเดิม / เป็นช่วงต้นของที่มีแล้ว
    if (prev && t.startsWith(prev)) { out[out.length - 1] = t; continue }   // ผลชั่วคราวที่ยาวขึ้น → แทนที่
    out.push(t)
  }
  let text = out.join(' ')
  // ทั้งก้อนเป็นประโยคเดียวกันซ้ำสองครั้งติดกัน (มีหรือไม่มีเว้นวรรค) → เหลือครั้งเดียว
  for (let k = 0; k < 3; k++) { const m = /^(.{2,}?)\s*\1$/s.exec(text); if (!m) break; text = m[1].trim() }
  return text
}

/** ความยาวช่วงอัดเสียงของโหมด record (มิลลิวินาที) */
const segMs = () => (window as unknown as { __voiceSegMs?: number }).__voiceSegMs ?? 5000

/** เริ่มฟัง · คืนฟังก์ชันหยุด */
export function startListening(h: ListenHandlers, mode: VoiceMode = voiceMode()): () => void {
  if (mode === 'none') { h.onError('เบราว์เซอร์นี้ยังใช้พูดสั่งไม่ได้ — พิมพ์เองได้ตามปกติ'); h.onDone(); return () => undefined }
  if (mode === 'native') {
    const C = speechCtor()!
    const r = new C()
    r.lang = 'th-TH'; r.continuous = true; r.interimResults = true
    let err: string | undefined
    let got = false
    r.onresult = (e) => {
      const text = mergeSpeech(Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>, (x) => x[0].transcript))
      if (text) { got = true; h.onText(text) }
    }
    r.onerror = (e) => { err = e.error === 'not-allowed' ? 'ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน — เปิดสิทธิ์ไมค์ในการตั้งค่าเบราว์เซอร์' : e.error === 'no-speech' || e.error === 'aborted' ? undefined : `พูดให้พิมพ์ไม่สำเร็จ (${e.error})` }
    r.onend = () => { if (err) h.onError(err); else if (!got) h.onError('ไม่ได้ยินเสียงพูด — แตะไมค์แล้วพูดอีกครั้ง'); h.onDone() }
    r.start()
    return () => r.stop()
  }
  // record: อัดเป็นช่วงสั้นๆ ต่อเนื่อง ถอดเสียงทีละช่วงตามลำดับ
  let active = true
  let stream: MediaStream | null = null
  let acc = ''
  let chain: Promise<void> = Promise.resolve()
  let pending = 0
  const release = () => stream?.getTracks().forEach((t) => t.stop())
  const finishIfIdle = () => { if (!active && pending === 0) { release(); h.onDone() } }
  const transcribe = (blob: Blob) => {
    pending++; h.onBusy?.(true)
    chain = chain.then(() => transcribeAudio(blob)).then(
      (t) => { acc = mergeSpeech([acc, t]); h.onText(acc) },
      (e) => { const m = e instanceof Error ? e.message : 'ถอดเสียงไม่สำเร็จ'; if (!/ไม่ได้ยินเสียงพูด/.test(m)) h.onError(m) },
    ).finally(() => { pending--; if (pending === 0) h.onBusy?.(false); finishIfIdle() })
  }
  const type = pickAudioType()
  const segment = () => {
    if (!stream) return
    const chunks: Blob[] = []
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: type || 'audio/webm' })
      if (blob.size >= 1500) transcribe(blob)
      if (active) segment(); else finishIfIdle()
    }
    rec.start()
    window.setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, segMs())
    stopCur = () => { if (rec.state !== 'inactive') rec.stop() }
  }
  let stopCur: () => void = () => undefined
  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!active) { release(); h.onDone(); return }
      segment()
    } catch (e) {
      active = false; release()
      h.onError((e as DOMException)?.name === 'NotAllowedError' ? 'ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน — เปิดสิทธิ์ไมค์ในการตั้งค่าเบราว์เซอร์' : 'เปิดไมโครโฟนไม่ได้')
      h.onDone()
    }
  })()
  return () => { active = false; stopCur() }
}
