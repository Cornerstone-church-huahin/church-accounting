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
const OFFLINE = 'ไม่มีอินเทอร์เน็ต — บันทึกไว้ในเครื่องก่อน จะส่งขึ้นเมื่อเชื่อมต่อได้'
const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

/**
 * epoch = เวลาที่ไฟล์นี้ถูก "ลบถาวร/ล้างข้อมูล" ครั้งล่าสุด · เครื่องที่ซิงก์ครั้งสุดท้ายก่อน epoch นี้ต้องยอมรับไฟล์ออนไลน์เป็นหลัก
 * (ทิ้งของเก่าในเครื่อง) ไม่อย่างนั้นข้อมูลที่ลบแล้วจะผุดกลับมาจากเครื่องที่ยังไม่ซิงก์
 */
export const remoteWins = (localEpoch: number, remoteEpoch: number | undefined) => (remoteEpoch ?? 0) > localEpoch

export async function pullFile<T extends SharedItem>(cfg: SyncConfig, file: string): Promise<{ items: T[]; sha?: string; exists: boolean; epoch?: number }> {
  let r: Response
  try {
    r = await api(cfg, `contents/${encPath(file)}`)
  } catch {
    throw new Error(OFFLINE)
  }
  if (r.status === 404) {
    // repo มีอยู่แต่ยังไม่มีไฟล์ = ครั้งแรก · repo ไม่มี/ไม่มีสิทธิ์ = ผิดพลาด
    const repo = await api(cfg, '').catch(() => null)
    if (repo?.ok) return { items: [], exists: false }
    throw new Error(explain(repo?.status ?? 404))
  }
  if (!r.ok) throw new Error(explain(r.status))
  const body = (await r.json()) as { content?: string; sha: string; encoding?: string }
  let text = body.content && body.encoding === 'base64' ? b64decode(body.content) : ''
  if (!text) {
    // ไฟล์ใหญ่เกิน 1MB API ไม่ส่งเนื้อหามา → อ่านแบบ raw
    const raw = await api(cfg, `contents/${encPath(file)}`, { headers: { accept: 'application/vnd.github.raw' } })
    text = raw.ok ? await raw.text() : ''
  }
  const data = JSON.parse(text || '{"items":[]}') as { items?: T[]; epoch?: number }
  return { items: (data.items ?? []).filter((x) => x && x.id), sha: body.sha, exists: true, epoch: data.epoch }
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
    if (!r.ok) return explain(r.status)
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

/** ดึงไฟล์จาก repo ข้อมูลเมื่อกดเปิด */
export async function getBinary(cfg: SyncConfig, path: string): Promise<Blob> {
  const r = await api(cfg, `contents/${encPath(path)}`, { headers: { accept: 'application/vnd.github.raw' } }).catch(() => null)
  if (!r) throw new Error('ไม่มีอินเทอร์เน็ต — เปิดไฟล์ไม่ได้')
  if (!r.ok) throw new Error(r.status === 404 ? 'ไม่พบไฟล์นี้ใน repo' : explain(r.status))
  return r.blob()
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
