/** เข้ารหัสสมุดส่วนตัวแอดมินในเครื่อง (AES-GCM 256 · กุญแจจากรหัสผ่านด้วย PBKDF2) — ที่เก็บกลางเห็นแต่ข้อความที่อ่านไม่ออก */
const ITER = 200_000
const enc = new TextEncoder(), dec = new TextDecoder()
const toB64 = (b: ArrayBuffer | Uint8Array) => { const u = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s) }
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const CHECK_TEXT = 'acct-vault-ok'

export const randomSalt = () => toB64(crypto.getRandomValues(new Uint8Array(16)))

export async function deriveKey(pass: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}
export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return `${toB64(iv)}.${toB64(ct)}`
}
export async function decryptJson<T = unknown>(key: CryptoKey, blob: string): Promise<T> {
  const [iv, ct] = blob.split('.')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct))
  return JSON.parse(dec.decode(pt)) as T
}
/** สร้างตัวตรวจรหัส (เก็บคู่กับ salt) */
export const makeCheck = (key: CryptoKey) => encryptJson(key, CHECK_TEXT)
export async function verifyKey(key: CryptoKey, check: string): Promise<boolean> {
  try { return (await decryptJson<string>(key, check)) === CHECK_TEXT } catch { return false }
}
export const exportKey = async (key: CryptoKey) => toB64(await crypto.subtle.exportKey('raw', key))
export const importKey = (b64: string) => crypto.subtle.importKey('raw', fromB64(b64), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
