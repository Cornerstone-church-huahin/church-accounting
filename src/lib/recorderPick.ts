import { useEffect, useState } from 'react'

/** ผู้บันทึกของเครื่องนี้ (จำในเครื่องจนกว่าจะเปลี่ยนเอง) · ใช้ร่วมกันระหว่างชิปหัวหน้าจอกับหน้าลงชื่อ */
const KEY = 'acct.recorder'
const CHANGED = 'acct-recorder'
/** สั่งเปิดหน้าต่างเลือกผู้บันทึก (เช่น กดลงทะเบียนโดยยังไม่ได้เลือก) */
export const OPEN_RECORDER = 'acct-recorder-open'
const read = () => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }

export function useRecorderPick(recorders: { id: string; name: string }[]) {
  const [id, setId] = useState(read)
  useEffect(() => {
    const on = () => setId(read())
    window.addEventListener(CHANGED, on)
    return () => window.removeEventListener(CHANGED, on)
  }, [])
  const picked = recorders.find((r) => r.id === id) ?? recorders.find((r) => r.name === id) // ค่าเก่าที่เป็นชื่อก็อ่านได้
  const pick = (v: string) => { try { localStorage.setItem(KEY, v) } catch { /* ignore */ } setId(v); window.dispatchEvent(new Event(CHANGED)) }
  // มีผู้บันทึกคนเดียว = เลือกให้เลย · ไม่ล้างค่าที่เลือกไว้แม้รายชื่อกำลังโหลด/ซิงก์
  useEffect(() => { if (!picked && recorders.length === 1) pick(recorders[0].id) }, [picked?.id, recorders.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return { picked, pick }
}
