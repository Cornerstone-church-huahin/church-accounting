/**
 * ใช้ร่วมกันออนไลน์ผ่าน GitHub เท่านั้น: ข้อมูลเป็นไฟล์ JSON ใน repo ส่วนตัว (Private) ของคริสตจักร
 * เช่น Cornerstone-church-huahin/church-accounting-data · รูปใบเสร็จเก็บในโฟลเดอร์ attachments/ ของ repo เดียวกัน
 * แต่ละเครื่องใส่ "รหัสเข้าใช้ร่วม" (GitHub fine-grained token ที่แก้ได้เฉพาะ repo นั้น) ครั้งเดียว
 * รหัสเก็บในเครื่องนั้นเท่านั้น — ห้ามใส่ในโค้ดหรือ repo ของแอป
 */
export interface SyncConfig { repo: string; token: string; name: string }
export type SyncStatus =
  | { state: 'off' }
  | { state: 'idle' }
  | { state: 'syncing' }
  | { state: 'ok'; at: number }
  | { state: 'error'; message: string }

/** ทุกรายการที่ใช้ร่วมกันต้องมี id และเวลาแก้ไข (ใหม่กว่าชนะ · ลบ = ตั้ง deleted เพื่อให้เครื่องอื่นรู้) */
export interface SharedItem { id: string; updated: number; deleted?: boolean; by?: string }

const STORE = 'acct.sync.v1'
export const SYNC_EVENT = 'acct-sync-config'
export const DEFAULT_REPO = 'Cornerstone-church-huahin/church-accounting-data'

export function getSync(): SyncConfig | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null') as SyncConfig | null
    return v && v.token && v.repo ? v : null
  } catch {
    return null
  }
}
export function saveSync(v: SyncConfig | null) {
  try {
    if (v && v.token.trim()) localStorage.setItem(STORE, JSON.stringify({ repo: v.repo.trim() || DEFAULT_REPO, token: v.token.trim(), name: v.name.trim() }))
    else localStorage.removeItem(STORE)
  } catch { /* ignore */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SYNC_EVENT))
}

const b64encode = (s: string) => toB64(new TextEncoder().encode(s))
const toB64 = (bytes: Uint8Array) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const b64decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0)))

function api(cfg: SyncConfig, path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${cfg.repo}${path ? `/${path}` : ''}`, {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${cfg.token}`,
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  })
}

function explain(status: number): string {
  if (status === 401) return 'รหัสเข้าใช้ร่วมไม่ถูกต้องหรือหมดอายุ'
  if (status === 403) return 'รหัสนี้ไม่มีสิทธิ์แก้ไขข้อมูล (ตรวจสิทธิ์ Contents: Read and write)'
  if (status === 404) return 'ไม่พบ repo ข้อมูล หรือรหัสนี้ไม่ได้รับสิทธิ์ใน repo นั้น'
  return `เชื่อมต่อไม่สำเร็จ (${status})`
}
/**
 * บอกสาเหตุจริงที่ GitHub ปฏิเสธ (403 มีได้หลายสาเหตุ: โควตาการเรียกเต็ม · รหัสยังไม่ได้รับอนุมัติ/ไม่ได้เลือก repo · สิทธิ์ไม่พอ)
 * remaining/reset มาจากหัว x-ratelimit-remaining / x-ratelimit-reset (วินาที epoch)
 */
export function describeFailure(status: number, ghMessage = '', remaining: string | null = null, reset: string | null = null): string {
  const msg = ghMessage.trim()
  if ((status === 403 || status === 429) && (remaining === '0' || /rate limit/i.test(msg))) {
    const t = reset && Number(reset) ? new Date(Number(reset) * 1000) : null
    const at = t ? ` ใช้ได้อีกประมาณ ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} น.` : ' รอสักครู่'
    return `โควตาการเรียก GitHub ของรหัสนี้เต็มชั่วคราว (ทุกเครื่องที่ใช้รหัสเดียวกันใช้โควตาร่วมกัน)${at} แล้วลองใหม่`
  }
  if (status === 403 && /not accessible by (personal access token|integration)|resource not accessible/i.test(msg)) {
    return 'รหัสนี้ยังไม่ได้รับสิทธิ์ใช้ repo ข้อมูล: ตอนสร้างรหัสต้องเลือก repo นี้และตั้ง Contents: Read and write (ถ้า repo อยู่ในองค์กร เจ้าขององค์กรต้องอนุมัติรหัสนี้ก่อน)'
  }
  return explain(status) + (msg ? ` · GitHub แจ้งว่า: ${msg}` : '')
}
/** อ่านสาเหตุจากคำตอบของ GitHub ที่ไม่สำเร็จ */
async function explainResponse(r: Response): Promise<string> {
  let message = ''
  try { message = ((await r.clone().json()) as { message?: string }).message ?? '' } catch { /* ไม่ใช่ JSON */ }
  return describeFailure(r.status, message, r.headers.get('x-ratelimit-remaining'), r.headers.get('x-ratelimit-reset'))
}
const OFFLINE = 'ไม่มีอินเทอร์เน็ต — บันทึกไว้ในเครื่องก่อน จะส่งขึ้นเมื่อเชื่อมต่อได้'
const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

/**
 * epoch = เวลาที่ไฟล์นี้ถูก "ลบถาวร/ล้างข้อมูล" ครั้งล่าสุด · เครื่องที่ซิงก์ครั้งสุดท้ายก่อน epoch นี้ต้องยอมรับไฟล์ออนไลน์เป็นหลัก
 * (ทิ้งของเก่าในเครื่อง) ไม่อย่างนั้นข้อมูลที่ลบแล้วจะผุดกลับมาจากเครื่องที่ยังไม่ซิงก์
 */
export const remoteWins = (localEpoch: number, remoteEpoch: number | undefined) => (remoteEpoch ?? 0) > localEpoch

type Pulled<T extends SharedItem> = { items: T[]; sha?: string; exists: boolean; epoch?: number }
/** ETag ล่าสุดของแต่ละไฟล์: ถามซ้ำแบบมีเงื่อนไข (If-None-Match) ถ้าไม่มีอะไรเปลี่ยน GitHub ตอบ 304 ซึ่งไม่นับโควตาการเรียก (โควตา 5,000/ชั่วโมงใช้ร่วมกันทุกเครื่องที่ใช้รหัสเดียวกัน) */
const etags = new Map<string, { etag: string; res: Pulled<SharedItem> }>()
export const clearEtagCache = () => etags.clear()

export async function pullFile<T extends SharedItem>(cfg: SyncConfig, file: string): Promise<Pulled<T>> {
  let r: Response
  const key = `${cfg.repo}:${file}`
  const cached = etags.get(key)
  try {
    r = await api(cfg, `contents/${encPath(file)}`, cached ? { headers: { 'if-none-match': cached.etag } } : {})
  } catch {
    throw new Error(OFFLINE)
  }
  if (r.status === 304 && cached) return { ...(cached.res as Pulled<T>), items: [...(cached.res.items as T[])] }
  if (r.status === 404) {
    // repo มีอยู่แต่ยังไม่มีไฟล์ = ครั้งแรก · repo ไม่มี/ไม่มีสิทธิ์ = ผิดพลาด
    const repo = await api(cfg, '').catch(() => null)
    if (repo?.ok) return { items: [], exists: false }
    throw new Error(explain(repo?.status ?? 404))
  }
  if (!r.ok) throw new Error(await explainResponse(r))
  const body = (await r.json()) as { content?: string; sha: string; encoding?: string }
  let text = body.content && body.encoding === 'base64' ? b64decode(body.content) : ''
  if (!text) {
    // ไฟล์ใหญ่เกิน 1MB API ไม่ส่งเนื้อหามา → อ่านแบบ raw
    const raw = await api(cfg, `contents/${encPath(file)}`, { headers: { accept: 'application/vnd.github.raw' } })
    text = raw.ok ? await raw.text() : ''
  }
  const data = JSON.parse(text || '{"items":[]}') as { items?: T[]; epoch?: number }
  const res: Pulled<T> = { items: (data.items ?? []).filter((x) => x && x.id), sha: body.sha, exists: true, epoch: data.epoch }
  const etag = r.headers.get('etag')
  if (etag) etags.set(key, { etag, res: { ...res, items: [...res.items] } as Pulled<SharedItem> })
  return res
}

export function mergeItems<T extends SharedItem>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>()
  for (const x of [...a, ...b]) {
    const cur = m.get(x.id)
    if (!cur || (x.updated ?? 0) > (cur.updated ?? 0)) m.set(x.id, x)
  }
  return [...m.values()]
}

export async function pushFile<T extends SharedItem>(cfg: SyncConfig, file: string, label: string, items: T[], sha?: string, retry = true, epoch?: number, replace = false): Promise<void> {
  const content = JSON.stringify({ app: 'church-accounting', version: 1, saved: new Date().toISOString(), ...(epoch ? { epoch } : {}), items }, null, 1)
  const r = await api(cfg, `contents/${encPath(file)}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `อัปเดต${label}${cfg.name ? ` โดย ${cfg.name}` : ''}`, content: b64encode(content), ...(sha ? { sha } : {}) }),
  }).catch(() => null)
  if (!r) throw new Error(OFFLINE)
  if ((r.status === 409 || r.status === 422) && retry) {
    // อีกเครื่องเพิ่งบันทึก → ดึงของล่าสุดมารวมแล้วส่งใหม่ (ถ้าเป็นการลบถาวร/ล้างข้อมูล ไม่รวม ใช้ของเราแทนทั้งไฟล์)
    const remote = await pullFile<T>(cfg, file)
    return replace
      ? pushFile(cfg, file, label, items, remote.sha, false, epoch, true)
      : pushFile(cfg, file, label, mergeItems(items, remote.items), remote.sha, false, Math.max(epoch ?? 0, remote.epoch ?? 0) || undefined)
  }
  if (!r.ok) throw new Error(explain(r.status))
}

/** ทดสอบการเชื่อมต่อ: '' = ใช้ได้ · ต้องเป็น repo Private เท่านั้น เพราะเป็นข้อมูลบัญชี */
export async function testSync(cfg: SyncConfig): Promise<string> {
  try {
    const r = await api(cfg, '')
    if (!r.ok) return await explainResponse(r)
    const j = (await r.json()) as { private?: boolean; permissions?: { push?: boolean } }
    if (j.permissions && !j.permissions.push) return 'รหัสนี้อ่านได้อย่างเดียว ต้องให้สิทธิ์ Contents: Read and write'
    if (j.private === false) return 'repo ข้อมูลนี้เป็นสาธารณะ — ต้องตั้งเป็น Private เพื่อไม่ให้คนนอกเห็นบัญชี'
    return ''
  } catch {
    return 'ไม่มีอินเทอร์เน็ต'
  }
}

// ---------- ไฟล์แนบ (รูปใบเสร็จ / ไฟล์สเตตเมนต์) ----------
/** อัปโหลดไฟล์ขึ้น repo ข้อมูล (path ใหม่เสมอ) */
export async function putBinary(cfg: SyncConfig, path: string, data: ArrayBuffer, label: string): Promise<void> {
  const r = await api(cfg, `contents/${encPath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `แนบไฟล์${label}${cfg.name ? ` โดย ${cfg.name}` : ''}`, content: toB64(new Uint8Array(data)) }),
  }).catch(() => null)
  if (!r) throw new Error('ไม่มีอินเทอร์เน็ต — อัปโหลดไฟล์ไม่ได้')
  if (!r.ok) throw new Error(r.status === 422 ? 'มีไฟล์ชื่อนี้อยู่แล้ว ลองอัปโหลดใหม่อีกครั้ง' : explain(r.status))
}

import { cachedImage } from './imageCache'
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }
const withType = (b: Blob, path: string) => new Blob([b], { type: MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? (b.type || 'application/octet-stream') })
const readFail = (status: number) => (status === 404 ? 'ไม่พบไฟล์นี้ใน repo' : status === 401 ? 'รหัสเข้าใช้ร่วมไม่ถูกต้องหรือหมดอายุ' : `GitHub ไม่ให้ดึงรูปนี้ (${status}) — รหัสอาจไม่มีสิทธิ์อ่านไฟล์ (Contents: Read) หรือเรียกถี่เกินโควต้า ลองใหม่อีกครั้งภายหลัง`)

/** ดึงไฟล์จาก repo ข้อมูลเมื่อกดเปิด · ลองหลายทาง: contents raw → รายชื่อโฟลเดอร์หา sha แล้วดึง git blob → contents JSON (base64) · ถ้าไม่ได้บอกสถานะของแต่ละทาง */
export async function getBinary(cfg: SyncConfig, path: string): Promise<Blob> {
  const local = await cachedImage(path)
  if (local) return local
  const trace: string[] = []
  const raw = await api(cfg, `contents/${encPath(path)}`, { headers: { accept: 'application/vnd.github.raw' } }).catch(() => null)
  if (!raw) throw new Error('ไม่มีอินเทอร์เน็ต — เปิดไฟล์ไม่ได้')
  if (raw.ok) return withType(await raw.blob(), path)
  trace.push(`raw ${raw.status}`)
  if (raw.status === 404 || raw.status === 401) throw new Error(readFail(raw.status))
  // ทางสำรอง 1: รายชื่อโฟลเดอร์ (ได้ sha แม้ไฟล์ใหญ่) → git blob
  const dir = path.slice(0, path.lastIndexOf('/'))
  const ls = await api(cfg, `contents/${encPath(dir)}`).catch(() => null)
  trace.push(`dir ${ls?.status ?? 'x'}`)
  if (ls?.ok) {
    const list = (await ls.json()) as { path: string; sha: string }[]
    const sha = Array.isArray(list) ? list.find((x) => x.path === path)?.sha : undefined
    if (sha) {
      for (const accept of ['application/vnd.github.raw', 'application/vnd.github+json']) {
        const bl = await api(cfg, `git/blobs/${sha}`, { headers: { accept } }).catch(() => null)
        trace.push(`blob ${bl?.status ?? 'x'}`)
        if (!bl?.ok) continue
        if (accept.endsWith('raw')) return withType(await bl.blob(), path)
        const j = (await bl.json()) as { content?: string; encoding?: string }
        if (j.content && j.encoding === 'base64') return withType(fromB64(j.content), path)
      }
    }
  }
  // ทางสำรอง 2: contents JSON (ไฟล์ ≤ 1MB มี base64 มาให้)
  const meta = await api(cfg, `contents/${encPath(path)}`).catch(() => null)
  trace.push(`json ${meta?.status ?? 'x'}`)
  if (meta?.ok) {
    const j = (await meta.json()) as { content?: string; encoding?: string }
    if (j.content && j.encoding === 'base64') return withType(fromB64(j.content), path)
  }
  throw new Error(`${readFail(raw.status)} [${trace.join(' · ')}]`)
}
const fromB64 = (b64: string) => {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k)
  return new Blob([bytes])
}

/** รายชื่อไฟล์ในโฟลเดอร์ของ repo ข้อมูล (ไม่มีโฟลเดอร์ = ว่าง) */
export async function listDir(cfg: SyncConfig, dir: string): Promise<{ path: string; sha: string; type: 'file' | 'dir' }[]> {
  const r = await api(cfg, `contents/${encPath(dir)}`).catch(() => null)
  if (!r || r.status === 404) return []
  if (!r.ok) throw new Error(explain(r.status))
  const j = (await r.json()) as { path: string; sha: string; type: string }[]
  return Array.isArray(j) ? j.map((x) => ({ path: x.path, sha: x.sha, type: x.type === 'dir' ? 'dir' : 'file' })) : []
}
/** ลบไฟล์ออกจาก repo ข้อมูล (ประวัติ commit เดิมยังอยู่) */
export async function deleteFile(cfg: SyncConfig, path: string, sha: string, label: string): Promise<void> {
  const r = await api(cfg, `contents/${encPath(path)}`, { method: 'DELETE', body: JSON.stringify({ message: `ลบไฟล์${label}${cfg.name ? ` โดย ${cfg.name}` : ''}`, sha }) }).catch(() => null)
  if (!r) throw new Error(OFFLINE)
  if (!r.ok && r.status !== 404) throw new Error(explain(r.status))
}
