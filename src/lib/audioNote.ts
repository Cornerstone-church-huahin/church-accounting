/** เครื่องมือบันทึกเสียงและพูดให้พิมพ์สำหรับโน้ต (ใช้ API ของเบราว์เซอร์) */

/** ชนิดเสียงที่เบราว์เซอร์นี้อัดได้ (เลือกแบบเล็ก: opus/webm ก่อน แล้ว mp4) */
export function pickAudioType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}
export const audioExt = (type: string) => (type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm')
export const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

type SR = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }
const speechCtor = (): (new () => SR) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
export const canDictate = () => speechCtor() !== null

/** เริ่มพูดให้พิมพ์ (ภาษาไทย): onText ถูกเรียกทุกครั้งที่จบประโยค · คืนฟังก์ชันหยุด */
export function startDictation(onText: (t: string) => void, onEnd: (err?: string) => void): () => void {
  const C = speechCtor()
  if (!C) { onEnd('เบราว์เซอร์นี้ยังไม่รองรับการพูดให้พิมพ์'); return () => undefined }
  const r = new C()
  r.lang = 'th-TH'; r.continuous = true; r.interimResults = false
  let err: string | undefined
  r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onText(e.results[i][0].transcript.trim()) }
  r.onerror = (e) => { err = e.error === 'not-allowed' ? 'ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน' : e.error === 'no-speech' ? undefined : `พูดให้พิมพ์ไม่สำเร็จ (${e.error})` }
  r.onend = () => onEnd(err)
  r.start()
  return () => r.stop()
}
