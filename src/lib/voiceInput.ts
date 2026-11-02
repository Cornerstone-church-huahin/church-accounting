import { canDictate, canRecord, pickAudioType, startDictation } from './audioNote'
import { transcribeAudio } from './gemini'

/**
 * กดค้างเพื่อพูด ปล่อยเพื่อหยุด → ได้ข้อความภาษาไทย
 * · native = ระบบพูดให้พิมพ์ของเบราว์เซอร์ (Android/Chrome ฟรี ไม่ใช้โควตา)
 * · record = อัดเสียงแล้วให้ Gemini ถอดเสียง (iPhone/Safari ที่ไม่มีระบบพูดให้พิมพ์) — ใช้รหัส Gemini เดียวกับตัวอ่านใบถวาย
 */
export type VoiceMode = 'native' | 'record' | 'none'
export const voiceMode = (): VoiceMode => (canDictate() ? 'native' : canRecord() ? 'record' : 'none')

export type VoiceState = 'listening' | 'transcribing'
export interface HoldTalkHandlers { onState: (s: VoiceState) => void; onText: (t: string) => void; onError: (m: string) => void }

/** เริ่มฟัง (เรียกตอนกดลง) · คืน stop() เรียกตอนปล่อย */
export function holdTalk(h: HoldTalkHandlers, mode: VoiceMode = voiceMode()): () => void {
  if (mode === 'none') { h.onError('เบราว์เซอร์นี้ยังใช้พูดสั่งไม่ได้ — พิมพ์เองได้ตามปกติ'); return () => undefined }
  if (mode === 'native') {
    const parts: string[] = []
    h.onState('listening')
    const stop = startDictation((t) => { if (t) parts.push(t) }, (err) => {
      const text = parts.join(' ').trim()
      if (text) h.onText(text)
      else h.onError(err ?? 'ไม่ได้ยินเสียงพูด — กดค้างแล้วพูดใหม่อีกครั้ง')
    })
    return () => { h.onState('transcribing'); stop() }
  }
  // record
  let stopped = false
  let rec: MediaRecorder | null = null
  let stream: MediaStream | null = null
  const chunks: Blob[] = []
  const release = () => stream?.getTracks().forEach((t) => t.stop())
  h.onState('listening')
  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (stopped) return release() // ปล่อยนิ้วก่อนที่ไมค์จะพร้อม (เช่น กำลังขอสิทธิ์)
      const type = pickAudioType()
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = () => {
        release()
        const blob = new Blob(chunks, { type: type || 'audio/webm' })
        if (blob.size < 1500) return h.onError('สั้นเกินไป — กดค้างแล้วพูดให้นานขึ้นอีกนิด')
        h.onState('transcribing')
        transcribeAudio(blob).then(h.onText, (e) => h.onError(e instanceof Error ? e.message : 'ถอดเสียงไม่สำเร็จ'))
      }
      rec.start()
    } catch (e) {
      release()
      h.onError((e as DOMException)?.name === 'NotAllowedError' ? 'ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน — เปิดสิทธิ์ไมค์ในการตั้งค่าเบราว์เซอร์' : 'เปิดไมโครโฟนไม่ได้')
    }
  })()
  return () => {
    stopped = true
    if (rec && rec.state !== 'inactive') { h.onState('transcribing'); rec.stop() }
  }
}
