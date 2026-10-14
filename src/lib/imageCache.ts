/** เก็บสำเนารูปที่แนบไว้ในเครื่อง (IndexedDB) ตามที่อยู่ไฟล์ใน repo — เปิดดูได้ทันทีบนเครื่องที่แนบ แม้ดึงจาก GitHub ไม่ได้ · ใช้ไม่ได้ก็ข้ามเงียบ ๆ */
const DB = 'acct-images', STORE = 'img'
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
export async function cacheImage(path: string, data: ArrayBuffer, type = 'image/jpeg'): Promise<void> {
  if (!path) return
  try {
    const db = await open()
    await new Promise<void>((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(new Blob([data], { type }), path); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
    db.close()
  } catch { /* ignore */ }
}
export async function cachedImage(path: string): Promise<Blob | null> {
  if (!path) return null
  try {
    const db = await open()
    const b = await new Promise<Blob | null>((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(path); q.onsuccess = () => res((q.result as Blob | undefined) ?? null); q.onerror = () => rej(q.error) })
    db.close()
    return b
  } catch { return null }
}
